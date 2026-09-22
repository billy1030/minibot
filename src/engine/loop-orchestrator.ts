import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";
import { LoopConfig } from "../config/schema.js";
import { LLMClient } from "../llm/client.js";
import { MCPClientManager } from "../mcp/client-manager.js";
import { globalSkillManager } from "../skills/skill-manager.js";

export interface LoopEventCallbacks {
  onStepStart?: (iteration: number) => void;
  onSkillActivated?: (skillNames: string[]) => void;
  onLLMResponse?: (response: OpenAI.Chat.Completions.ChatCompletion) => void;
  onToolCall?: (toolName: string, args: any, serverName?: string) => void;
  onToolResult?: (toolName: string, result: string, serverName?: string) => void;
  onSubAgentEvent?: (event: {
    type: "subagent_start" | "subagent_step" | "subagent_tool_call" | "subagent_tool_result" | "subagent_complete" | "subagent_error";
    role: string;
    instruction?: string;
    iteration?: number;
    toolName?: string;
    args?: any;
    result?: string;
    serverName?: string;
    answer?: string;
    iterations?: number;
    error?: string;
    timestamp: number;
  }) => void;
  onComplete?: (finalAnswer: string, iterations: number, activeSkills?: string[], limitReached?: boolean) => void;
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
    enableThinking: boolean = true,
    workspace: string = "default",
    userNumber: string = "00000",
    maxIterationsOverride?: number,
    depth: number = 0
  ): Promise<{ answer: string; iterations: number; history: OpenAI.Chat.Completions.ChatCompletionMessageParam[]; activeSkills?: string[]; limitReached?: boolean }> {
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

    // 🤖 In supervisor mode (depth === 0), inject AGENTS.md rules to enforce delegation
    if (depth === 0) {
      try {
        const agentsMdPath = path.resolve(process.cwd(), "AGENTS.md");
        if (fs.existsSync(agentsMdPath)) {
          const agentsRules = fs.readFileSync(agentsMdPath, "utf-8");
          systemPromptParts.push("\n--- Multi-Agent System Rules (`AGENTS.md`) ---\n" + agentsRules.trim());
        }
      } catch (err: any) {
        console.warn("[Loop] Could not load AGENTS.md:", err.message);
      }
    }

    if (this.config.prompts.svgPrompt && this.config.prompts.svgPrompt.trim().length > 0) {
      systemPromptParts.push(
        "\n--- Mandatory SVG Palette & Color Theme Directive (Strictly Enforce Configured Palette) ---\n",
        "STRICT COLOR PALETTE REQUIREMENT: When generating SVG diagrams, you MUST strictly use the background, card fills, text, and stroke colors defined in the guideline below. Do NOT use unprompted dark canvases or dark slate backgrounds unless the directive below explicitly specifies dark canvas.\n\n" +
        this.config.prompts.svgPrompt.trim()
      );
    }

    // Strict Language Alignment Protocol: Prevent mixed-language artifacts (e.g. Chinese words like "卡点" in English diagrams)
    systemPromptParts.push(
      "\n--- Mandatory Language Alignment Protocol ---\n",
      "STRICT LANGUAGE MATCHING RULE: Always generate all output (including markdown explanations, headers, diagram titles, badge chips, and SVG node labels) in the EXACT SAME LANGUAGE as the user's prompt.\n" +
      "- If the user asks in English (e.g. 'use serenity skill to do stock market analysis of AI neocloud and data centre'): ALL headings, diagram labels, pill badges, and texts MUST be 100% in English. NEVER insert Chinese characters such as '卡点' (use 'Bottleneck' or 'Chokepoint'), '判据' (use 'Criteria'), or '框架' (use 'Framework') into English responses or diagrams.\n" +
      "- If the user asks in Chinese: Respond naturally in Chinese.\n" +
      "Never mix stray Chinese characters into an English diagram or response."
    );

    // Dynamically resolve and inject global & workspace-scoped skills
    const { promptSection: resolvedSkills, activeSkillNames } = globalSkillManager.resolveSkillPromptSection(
      userPrompt,
      workspace || "default",
      userNumber || "00000"
    );
    if (resolvedSkills && resolvedSkills.trim().length > 0) {
      systemPromptParts.push("\n" + resolvedSkills);
    }

    if (activeSkillNames.length > 0) {
      callbacks?.onSkillActivated?.(activeSkillNames);
    }

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

    let iteration = 0;
    const maxIterations = (typeof maxIterationsOverride === "number" && maxIterationsOverride > 0)
      ? maxIterationsOverride
      : this.config.maxLoopIterations;

    while (iteration < maxIterations) {
      iteration++;
      callbacks?.onStepStart?.(iteration);

      // Dynamically fetch tools each iteration so newly installed tools are immediately visible to LLM
      const tools = this.mcpManager.getOpenAITools() as OpenAI.Chat.Completions.ChatCompletionTool[];

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
              toolOutput = await this.mcpManager.executeTool(toolName, parsedArgs, {
                workspace,
                userNumber,
                depth,
                parentCallbacks: callbacks,
                loopConfig: this.config,
              });
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
        callbacks?.onComplete?.(finalAnswer, iteration, activeSkillNames, false);
        return { answer: finalAnswer, iterations: iteration, history: messages, activeSkills: activeSkillNames, limitReached: false };
      } catch (err: any) {
        callbacks?.onError?.(err);
        throw err;
      }
    }

    // Find the last assistant message or last tool result to preserve context
    const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant" && m.content);
    const lastToolMsg = [...messages].reverse().find((m) => m.role === "tool" && m.content);

    let contextSnippet = "";
    if (lastAssistantMsg?.content) {
      contextSnippet = `\n\n${lastAssistantMsg.content}`;
    } else if (lastToolMsg?.content) {
      const preview = typeof lastToolMsg.content === "string" ? lastToolMsg.content.slice(0, 800) : "";
      contextSnippet = `\n\n**最後執行的步驟輸出**：\n\`\`\`text\n${preview}\n\`\`\``;
    }

    const fallbackMsg = `[Guardrail]: Loop reached maximum iterations limit (${maxIterations}).${contextSnippet}`;
    callbacks?.onComplete?.(fallbackMsg, iteration, activeSkillNames, true);
    return { answer: fallbackMsg, iterations: iteration, history: messages, activeSkills: activeSkillNames, limitReached: true };
  }
}
