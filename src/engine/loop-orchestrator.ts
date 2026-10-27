import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";
import { LoopConfig } from "../config/schema.js";
import { LLMClient } from "../llm/client.js";
import { MCPClientManager } from "../mcp/client-manager.js";
import { ScopedMCPManager } from "../mcp/scoped-mcp-manager.js";
import { globalSkillManager } from "../skills/skill-manager.js";
import { convertLatexToUnicode } from "../llm/latex-to-unicode.js";

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
  private mcpManager: MCPClientManager | ScopedMCPManager;

  constructor(config: LoopConfig, mcpManager: MCPClientManager | ScopedMCPManager) {
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
    history?: Array<{ role: "user" | "assistant"; content: any }>,
    attachedContext?: string,
    enableThinking: boolean = true,
    workspace: string = "default",
    userNumber: string = "00000",
    maxIterationsOverride?: number,
    depth: number = 0,
    sessionFile?: string,
    attachedImages?: Array<{ dataUrl: string; name?: string }>,
    enableCompaction?: boolean
  ): Promise<{ answer: string; iterations: number; history: OpenAI.Chat.Completions.ChatCompletionMessageParam[]; activeSkills?: string[]; limitReached?: boolean }> {
    // 1. Build initial system message combining system prompt, temporal context, attached docs, and AI skills
    const now = new Date();
    const isoTime = now.toISOString();
    const localTimeStr = new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "long",
    }).format(now);

    const sessionIdentifier = sessionFile ? path.basename(sessionFile).replace(/\.md$/i, "") : "";

    const systemPromptParts = [
      this.config.prompts.systemPrompt,
      `\n--- Current System Time & Temporal Context ---\n` +
      `Current Local Date & Time: ${localTimeStr}\n` +
      `Current ISO Timestamp: ${isoTime}\n` +
      (sessionIdentifier ? `Active Session Timestamp ID: ${sessionIdentifier}\n` : "") +
      `Temporal Anchor Rule: When answering queries, evaluating "latest", "recent", "today", or "this year", or constructing search queries with web_search, you MUST anchor your temporal understanding to this current date/time. Do not assume outdated training cutoff dates.\n`
    ];

    if (sessionIdentifier) {
      systemPromptParts.push(
        `\n--- Environment Hygiene: Mandatory Working Sub-Directory Directive ---\n` +
        `CURRENT_SESSION_ID: \`${sessionIdentifier}\`\n` +
        `RULE: Any new build document, report (.docx, .xlsx, .pdf, .md), or script created during this session MUST use \`${sessionIdentifier}\` as its dedicated sub-directory under the workspace.\n` +
        `- When invoking \`run_python_code\`, pass \`subDirectory: "${sessionIdentifier}"\`.\n` +
        `- Inside Python scripts: DO NOT create another nested subfolder with the same name. Files written to current working directory \`./\` will automatically reside inside \`workspace/.../${sessionIdentifier}/\`.\n`
      );
    }

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

    // Mandatory Structured Presentation & Table Protocol (Strict Prohibition of Fragile ASCII/Unicode Box Drawing)
    systemPromptParts.push(
      "\n--- Mandatory Table & Structured Data Presentation Protocol ---\n",
      "1. STRICT PROHIBITION OF ASCII / UNICODE BOX-DRAWING TABLES:\n" +
      "   NEVER output tabular data, comparisons, matrices, curriculums, or summaries using manual ASCII or Unicode box-drawing characters (such as ┌, ─, │, ├, ┼, ┤, └, ┴, ┘, +---, or |---). Because LLM tokenization cannot guarantee monospace character-width column alignment across web fonts and devices, ASCII box art inevitably breaks, truncates words/parentheses, collides with borders, and renders poorly.\n" +
      "2. MANDATORY USE OF GFM MARKDOWN TABLES:\n" +
      "   Whenever presenting structured comparisons, multi-column data, feature matrices, or curriculums, ALWAYS use standard GitHub-Flavored Markdown (GFM) tables:\n" +
      "   | Column 1 | Column 2 |\n" +
      "   |---|---|\n" +
      "   | Value A  | Value B  |\n" +
      "   Standard Markdown tables guarantee responsive auto-scrolling, perfect borders across all browser fonts, seamless Word/PDF export, and zero alignment clipping."
    );

    // Math & Formula Formatting Protocol: Strictly forbid LaTeX unless explicitly requested
    systemPromptParts.push(
      "\n--- Math & Formula Formatting Protocol (No LaTeX by Default) ---\n",
      "DO NOT USE LATEX BY DEFAULT: Unless the user explicitly asks for LaTeX notation (e.g. 'in LaTeX', 'use LaTeX syntax', or rigorous academic math paper specifications), NEVER wrap equations, mathematical formulas, variables, numbers, currency, or units in LaTeX delimiters (such as $...$, $$...$$, \\(...\\), or \\[...\\]).\n" +
      "- For normal math and formulas: Use clean, natural plain text or code spans with standard Unicode symbols (e.g. ×, ÷, ±, ≈, ≠, ≤, ≥, ², ³, √, ∑, ∈, →, %, $, €).\n" +
      "- For currency and numbers: Write '$100' or 'USD 100', NEVER '$100$'.\n" +
      "- For variables and calculations: Write 'x = y + 2' or `x = y + 2`, NEVER '$x = y + 2$'.\n" +
      "- Only generate LaTeX syntax when the user explicitly requests it in their statement."
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
    // Context Compaction Protocol:
    // If compaction is enabled (either via run parameter override or config.contextCompaction.enabled),
    // retain only the most recent N turns and summarize older turns into a structured digest to prevent context overflow.
    const isCompactionActive = typeof enableCompaction === "boolean" 
      ? enableCompaction 
      : Boolean(this.config.contextCompaction?.enabled);
    const windowSize = Math.max(2, this.config.contextCompaction?.windowSize || 10);

    if (history && history.length > 0) {
      const validTurns = history.filter((t) => t.role === "user" || t.role === "assistant");
      if (isCompactionActive && validTurns.length > windowSize) {
        const olderTurns = validTurns.slice(0, validTurns.length - windowSize);
        const recentTurns = validTurns.slice(validTurns.length - windowSize);

        // Build compact summary digest of evicted turns
        const summaryLines: string[] = [
          `[Prior Dialogue Context Compaction - ${olderTurns.length} earlier turns compressed]`,
        ];
        for (const t of olderTurns) {
          const rawText = typeof t.content === "string" ? t.content : JSON.stringify(t.content);
          const snippet = rawText.replace(/\s+/g, " ").slice(0, 140);
          summaryLines.push(`• ${t.role.toUpperCase()}: ${snippet}${rawText.length > 140 ? "..." : ""}`);
        }
        summaryLines.push(`[End of Compressed Prior Context - ${recentTurns.length} full recent turns follow]`);

        messages.push({
          role: "system",
          content: summaryLines.join("\n"),
        });

        for (const turn of recentTurns) {
          messages.push({
            role: turn.role,
            content: turn.content,
          });
        }
      } else {
        for (const turn of validTurns) {
          messages.push({
            role: turn.role,
            content: turn.content,
          });
        }
      }
    }

    // 3. Append current user query (with multimodal vision support if images attached)
    if (attachedImages && attachedImages.length > 0) {
      const userParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
        { type: "text", text: userPrompt || "Please analyze the attached image(s)." },
      ];
      for (const img of attachedImages) {
        if (img?.dataUrl) {
          userParts.push({
            type: "image_url",
            image_url: {
              url: img.dataUrl,
            },
          });
        }
      }
      messages.push({ role: "user", content: userParts });
    } else {
      messages.push({ role: "user", content: userPrompt });
    }

    let iteration = 0;
    const maxIterations = (typeof maxIterationsOverride === "number" && maxIterationsOverride > 0)
      ? maxIterationsOverride
      : this.config.maxLoopIterations;

    while (iteration < maxIterations) {
      iteration++;
      callbacks?.onStepStart?.(iteration);

      // Dynamically fetch tools each iteration so newly installed tools are immediately visible to LLM
      let tools: OpenAI.Chat.Completions.ChatCompletionTool[];
      if ("getOpenAIToolsForContext" in this.mcpManager) {
        tools = (await this.mcpManager.getOpenAIToolsForContext(workspace, userNumber)) as OpenAI.Chat.Completions.ChatCompletionTool[];
      } else {
        tools = this.mcpManager.getOpenAITools() as OpenAI.Chat.Completions.ChatCompletionTool[];
      }

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
            let serverName = "unknown";
            if ("getToolOrigin" in this.mcpManager) {
              const origin = await this.mcpManager.getToolOrigin(toolName, workspace, userNumber);
              serverName = origin ? `${origin.serverName} (${origin.scope})` : "unknown";
            } else {
              serverName = this.mcpManager.getToolServerName(toolName) || "unknown";
            }

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
                sessionFile,
                parentCallbacks: callbacks,
                loopConfig: this.config,
              });
            } catch (execErr: any) {
              toolOutput = `[Tool Execution Error]: ${execErr.message}`;
            }

            callbacks?.onToolResult?.(toolName, toolOutput, serverName);

            // Guardrail: Apply Head-Tail Truncation if tool output exceeds character budget
            const maxToolChars = this.config.contextCompaction?.maxToolOutputChars || 16000;
            let finalToolContent = toolOutput;
            if (isCompactionActive && toolOutput.length > maxToolChars) {
              const headLen = Math.floor(maxToolChars * 0.6);
              const tailLen = Math.floor(maxToolChars * 0.35);
              const omittedCount = toolOutput.length - headLen - tailLen;
              finalToolContent = `${toolOutput.slice(0, headLen)}\n\n... [⚠️ Context Guard: ${omittedCount} characters omitted to protect context window. Key tail output follows] ...\n\n${toolOutput.slice(-tailLen)}`;
            }

            // Append tool response to message history
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: finalToolContent,
            });
          }
          // Loop continues to next iteration to let LLM read tool output
          continue;
        }

        // If no tool call, determine final answer text
        let contentText = message.content?.trim();
        if (!contentText) {
          // If the model finished after tool invocations without emitting text, synthesize from tool outputs
          const lastToolMsg = [...messages].reverse().find((m) => m.role === "tool" && m.content);
          if (lastToolMsg?.content) {
            contentText = typeof lastToolMsg.content === "string" ? lastToolMsg.content : JSON.stringify(lastToolMsg.content);
          } else {
            contentText = "(No response content)";
          }
        }

        const finalAnswer = convertLatexToUnicode(contentText);
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

    const fallbackMsg = convertLatexToUnicode(`[Guardrail]: Loop reached maximum iterations limit (${maxIterations}).${contextSnippet}`);
    callbacks?.onComplete?.(fallbackMsg, iteration, activeSkillNames, true);
    return { answer: fallbackMsg, iterations: iteration, history: messages, activeSkills: activeSkillNames, limitReached: true };
  }
}
