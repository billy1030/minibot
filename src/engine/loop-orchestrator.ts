import OpenAI from "openai";
import { LoopConfig } from "../config/schema.js";
import { LLMClient } from "../llm/client.js";
import { MCPClientManager } from "../mcp/client-manager.js";

export interface LoopEventCallbacks {
  onStepStart?: (iteration: number) => void;
  onLLMResponse?: (response: OpenAI.Chat.Completions.ChatCompletion) => void;
  onToolCall?: (toolName: string, args: any, serverName?: string) => void;
  onToolResult?: (toolName: string, result: string, serverName?: string) => void;
  onComplete?: (finalAnswer: string, iterations: number) => void;
  onError?: (error: Error) => void;
}

export class LoopOrchestrator {
  private config: LoopConfig;
  private llmClient: LLMClient;
  private mcpManager: MCPClientManager;

  constructor(config: LoopConfig, mcpManager: MCPClientManager) {
    this.config = config;
    this.mcpManager = mcpManager;
    this.llmClient = new LLMClient(config.llm);
  }

  /**
   * Run the Loop Engineering protocol on a user query with multi-turn history and document context support
   */
  async run(
    userPrompt: string,
    callbacks?: LoopEventCallbacks,
    history?: Array<{ role: "user" | "assistant"; content: string }>,
    attachedContext?: string,
    enableThinking: boolean = true
  ): Promise<{ answer: string; iterations: number; history: OpenAI.Chat.Completions.ChatCompletionMessageParam[] }> {
    // 1. Build initial system message combining system prompt, attached docs, and AI skills
    const systemPromptParts = [this.config.prompts.systemPrompt];

    if (attachedContext && attachedContext.trim().length > 0) {
      systemPromptParts.push(
        "\n--- [ATTACHED KNOWLEDGE BASE & REFERENCE DOCUMENTS (GROUND TRUTH)] ---\n",
        attachedContext.trim(),
        "\n--- [END OF ATTACHED DOCUMENTS] ---\n"
      );
    }

    systemPromptParts.push(
      "\n--- Active AI Skills & Instructions ---\n",
      this.config.prompts.skillsPrompt
    );

    if (!enableThinking) {
      systemPromptParts.push(
        "\n--- Thinking Protocol ---\n",
        "DIRECT RESPONSE MODE: Do NOT use <think> tags, chain-of-thought, or internal scratchpad reasoning. Answer directly, concisely, and output final content (code, text, SVG, markdown) immediately."
      );
    }

    const fullSystemPrompt = systemPromptParts.join("\n");

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: fullSystemPrompt },
    ];

    // 2. Inject prior conversation turns if provided
    if (history && history.length > 0) {
      for (const turn of history) {
        if (turn.role === "user" || turn.role === "assistant") {
          messages.push({
            role: turn.role,
            content: turn.content,
          });
        }
      }
    }

    // 3. Append current user query
    messages.push({ role: "user", content: userPrompt });

    const tools = this.mcpManager.getOpenAITools() as OpenAI.Chat.Completions.ChatCompletionTool[];

    let iteration = 0;
    const maxIterations = this.config.maxLoopIterations;

    while (iteration < maxIterations) {
      iteration++;
      callbacks?.onStepStart?.(iteration);

      try {
        const completion = await this.llmClient.createChatCompletion(messages, tools);
        callbacks?.onLLMResponse?.(completion);

        const choice = completion.choices[0];
        if (!choice) {
          throw new Error("No completion choice returned by LLM.");
        }

        const message = choice.message;
        messages.push(message);

        // Check if LLM decided to call any tools
        if (message.tool_calls && message.tool_calls.length > 0) {
          for (const toolCall of message.tool_calls) {
            // Function call checking
            if (toolCall.type !== "function") continue;

            const toolName = toolCall.function.name;
            const serverName = this.mcpManager.getToolServerName(toolName) || "unknown";

            let parsedArgs: any = {};
            try {
              parsedArgs = JSON.parse(toolCall.function.arguments || "{}");
            } catch (parseErr) {
              console.warn(`[Loop] Failed to parse JSON arguments for tool ${toolName}`);
            }

            callbacks?.onToolCall?.(toolName, parsedArgs, serverName);

            // Execute via MCP
            let toolOutput = "";
            try {
              toolOutput = await this.mcpManager.executeTool(toolName, parsedArgs);
            } catch (execErr: any) {
              toolOutput = `[Tool Execution Error]: ${execErr.message}`;
            }

            callbacks?.onToolResult?.(toolName, toolOutput, serverName);

            // Append tool response to message history
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: toolOutput,
            });
          }
          // Loop continues to next iteration to let LLM read tool output
          continue;
        }

        // If no tool call, this is the final answer
        const finalAnswer = message.content || "(No response content)";
        callbacks?.onComplete?.(finalAnswer, iteration);
        return { answer: finalAnswer, iterations: iteration, history: messages };
      } catch (err: any) {
        callbacks?.onError?.(err);
        throw err;
      }
    }

    const fallbackMsg = `[Guardrail]: Loop reached maximum iterations limit (${maxIterations}).`;
    callbacks?.onComplete?.(fallbackMsg, iteration);
    return { answer: fallbackMsg, iterations: iteration, history: messages };
  }
}
