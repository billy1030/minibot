import OpenAI from "openai";
import { LoopConfig } from "../config/schema.js";
import { MCPClientManager, OpenAIToolDefinition } from "../mcp/client-manager.js";
import { LoopOrchestrator, LoopEventCallbacks } from "./loop-orchestrator.js";

export type SubAgentRole = "researcher" | "coder" | "designer" | "reviewer" | "general";

export interface SubAgentTaskArgs {
  role: SubAgentRole;
  taskInstruction: string;
  contextSnippet?: string;
  workspace?: string;
  userNumber?: string;
  maxIterations?: number;
}

export interface SubAgentEventCallbacks {
  onSubAgentStart?: (role: SubAgentRole, taskInstruction: string) => void;
  onSubAgentToolCall?: (role: SubAgentRole, toolName: string, args: any, serverName?: string) => void;
  onSubAgentToolResult?: (role: SubAgentRole, toolName: string, result: string, serverName?: string) => void;
  onSubAgentComplete?: (role: SubAgentRole, answer: string, iterations: number) => void;
}

/**
 * Role-specific specialized System Prompts to ensure domain focus and avoid prompt drift
 */
const ROLE_SYSTEM_PROMPTS: Record<SubAgentRole, string> = {
  researcher: `You are a Specialized Research & Ingestion Sub-Agent.
Your job is to thoroughly investigate the given query, search the web, fetch pages, and extract grounded facts.
Protocol:
1. Use web_search and fetch_page to collect current and factual information.
2. Read documents using read_office_document or download_remote_file when relevant.
3. Be precise, cite sources, and eliminate redundant fluff.
4. Output a well-structured, clear summary of your findings to report back to the main agent.`,

  coder: `You are a Specialized Software Engineer & Data Processing Sub-Agent.
Your job is to write, execute, and verify code or process data spreadsheets.
Protocol:
1. When computing, running scripts, or creating charts, invoke run_python_code with required dependencies.
2. If processing spreadsheets, inspect files or invoke create_excel_spreadsheet.
3. Handle errors autonomously by reading execution output and fixing bugs.
4. Conclude with a clear technical breakdown and confirm output file locations.`,

  designer: `You are a Specialized UI/UX & Editorial SVG Diagram Designer Sub-Agent.
Your job is to generate high-fidelity vector architecture posters, pipelines, or flowcharts.
Protocol:
1. Generate standalone editorial SVG code adhering to clean light minimalist theme (#ffffff/#f8fafc canvas, stroke #e2e8f0, #0f172a titles).
2. Adhere strictly to dynamic viewBox dimensions, rounded connectors (r=8), and safe margins.
3. Output the final SVG directly.`,

  reviewer: `You are a Specialized Quality Assurance & Review Sub-Agent.
Your job is to audit deliverables, verify logic against requirements, and highlight potential risks, security vulnerabilities, or performance bottlenecks.
Protocol:
1. Objectively evaluate the provided artifacts or text against the original criteria.
2. Provide constructive, categorized feedback: [Critical], [Suggestion], [Verification Status].`,

  general: `You are an Autonomous Specialist Sub-Agent.
Execute the assigned sub-task efficiently using your available tools and report back with your findings.`,
};

/**
 * Tool Whitelists per role to prevent tool distraction and reduce token bloat
 */
const ROLE_TOOL_WHITELISTS: Record<SubAgentRole, string[]> = {
  researcher: [
    "web_search",
    "fetch_page",
    "download_remote_file",
    "read_office_document",
    "minimax_search",
  ],
  coder: [
    "run_python_code",
    "create_excel_spreadsheet",
    "read_office_document",
  ],
  designer: [
    "run_python_code", // in case math/coordinate calculations are needed
  ],
  reviewer: [
    "read_office_document",
    "web_search",
  ],
  general: [], // empty means allow all except delegate_task
};

export class SubAgentExecutor {
  /**
   * Dispatches and runs a specialized sub-agent with isolated context and scoped tools
   */
  static async runSubAgent(
    args: SubAgentTaskArgs,
    baseConfig: LoopConfig,
    baseMcpManager: MCPClientManager,
    parentCallbacks?: LoopEventCallbacks,
    currentDepth: number = 0
  ): Promise<{ answer: string; iterations: number; success: boolean }> {
    // 🛡️ Guardrail 1: Strictly forbid recursive sub-agents (depth capped at 1)
    if (currentDepth >= 1) {
      return {
        answer: "[Guardrail Error]: Sub-agents cannot recursively spawn further sub-agents (maximum depth reached).",
        iterations: 0,
        success: false,
      };
    }

    const role = args.role || "general";
    const rolePrompt = ROLE_SYSTEM_PROMPTS[role] || ROLE_SYSTEM_PROMPTS.general;
    const maxIterations = args.maxIterations || (role === "coder" ? 12 : role === "researcher" ? 8 : 6);

    // Notify caller that a subagent started
    parentCallbacks?.onSubAgentEvent?.({
      type: "subagent_start",
      role,
      instruction: args.taskInstruction,
      timestamp: Date.now(),
    });

    // Create a specialized LoopConfig for the sub-agent
    const subConfig: LoopConfig = {
      ...baseConfig,
      maxLoopIterations: maxIterations,
      prompts: {
        ...baseConfig.prompts,
        systemPrompt: rolePrompt,
        // Omit supervisor multi-agent instructions to avoid confusion in sub-agent
        skillsPrompt: baseConfig.prompts.skillsPrompt || "",
      },
    };

    // Construct a scoped MCP manager proxy that filters tools
    const allowedToolNames = ROLE_TOOL_WHITELISTS[role];
    const scopedMcpManager = this.createScopedMcpProxy(baseMcpManager, allowedToolNames);

    const subOrchestrator = new LoopOrchestrator(subConfig, scopedMcpManager);

    const subCallbacks: LoopEventCallbacks = {
      onStepStart: (iter) => {
        parentCallbacks?.onSubAgentEvent?.({
          type: "subagent_step",
          role,
          iteration: iter,
          timestamp: Date.now(),
        });
      },
      onToolCall: (toolName, toolArgs, serverName) => {
        parentCallbacks?.onSubAgentEvent?.({
          type: "subagent_tool_call",
          role,
          toolName,
          args: toolArgs,
          serverName,
          timestamp: Date.now(),
        });
      },
      onToolResult: (toolName, result, serverName) => {
        parentCallbacks?.onSubAgentEvent?.({
          type: "subagent_tool_result",
          role,
          toolName,
          result,
          serverName,
          timestamp: Date.now(),
        });
      },
      onComplete: (answer, iterations) => {
        parentCallbacks?.onSubAgentEvent?.({
          type: "subagent_complete",
          role,
          answer,
          iterations,
          timestamp: Date.now(),
        });
      },
      onError: (err) => {
        parentCallbacks?.onSubAgentEvent?.({
          type: "subagent_error",
          role,
          error: err.message,
          timestamp: Date.now(),
        });
      },
    };

    try {
      // Execute the sub-agent with completely fresh, isolated message history
      const result = await subOrchestrator.run(
        args.taskInstruction,
        subCallbacks,
        [], // clean history: NO parent context pollution
        args.contextSnippet,
        true, // enableThinking
        args.workspace || "default",
        args.userNumber || "00000",
        maxIterations,
        currentDepth + 1 // increment depth
      );

      return {
        answer: result.answer,
        iterations: result.iterations,
        success: true,
      };
    } catch (err: any) {
      return {
        answer: `[Sub-Agent Error in ${role}]: ${err.message}`,
        iterations: 0,
        success: false,
      };
    }
  }

  /**
   * Creates a transparent proxy around MCPClientManager to filter available tools
   */
  private static createScopedMcpProxy(
    baseManager: MCPClientManager,
    allowedTools?: string[]
  ): MCPClientManager {
    return new Proxy(baseManager, {
      get(target: any, prop: string | symbol) {
        if (prop === "getOpenAITools") {
          return () => {
            const allTools = target.getOpenAITools() as OpenAIToolDefinition[];
            // Never expose delegate_task to sub-agents
            const filtered = allTools.filter((t) => t.function.name !== "delegate_task");
            if (!allowedTools || allowedTools.length === 0) {
              return filtered;
            }
            return filtered.filter((t) => allowedTools.includes(t.function.name));
          };
        }
        if (typeof target[prop] === "function") {
          return target[prop].bind(target);
        }
        return target[prop];
      },
    });
  }
}
