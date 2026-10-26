import { execFile } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { MCPServerDef } from "../config/schema.js";
import { BigFixStreamableHttpClient } from "./bigfix-client.js";
import { BUILTIN_INPROCESS_TOOLS, executeInProcessTool } from "./inprocess-tools.js";

/**
 * Forcefully terminates a stdio transport process tree to prevent zombie processes on Windows/Unix
 */
function killTransportProcessTree(transport: StdioClientTransport): void {
  try {
    const proc = (transport as any)._process;
    if (proc && proc.pid) {
      if (process.platform === "win32") {
        execFile("taskkill", ["/PID", String(proc.pid), "/T", "/F"], () => {});
      } else {
        // macOS & Linux: terminate child processes first via pkill -P, then kill the process
        execFile("pkill", ["-P", String(proc.pid)], () => {
          try {
            proc.kill("SIGKILL");
          } catch {}
        });
        try {
          proc.kill("SIGKILL");
        } catch {}
      }
    }
  } catch {}
}

export interface DiscoveredTool {
  serverName: string;
  name: string;
  description?: string;
  inputSchema: any;
}

export interface OpenAIToolDefinition {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: any;
  };
}

export class MCPClientManager {
  private stdioClients = new Map<string, { client: Client; transport: StdioClientTransport }>();
  private httpClients = new Map<string, BigFixStreamableHttpClient>();
  private tools = new Map<string, DiscoveredTool>();
  private includeBuiltins: boolean;

  constructor(options?: { includeBuiltins?: boolean }) {
    this.includeBuiltins = options?.includeBuiltins ?? true;
  }

  /**
   * Initializes and connects to all configured MCP servers
   */
  async initialize(serversConfig: Record<string, MCPServerDef>): Promise<void> {
    // 🛡️ Always close previous connections first to prevent duplicate orphan processes
    await this.closeAll();

    for (const [serverName, def] of Object.entries(serversConfig)) {
      if (!def.enabled) continue;

      try {
        const isHttp = def.type === "http" || def.type === "streamable-http" || def.transport === "streamable-http" || (def.url && !def.command);

        if (isHttp && def.url) {
          // Resolve environment variables in headers or URL
          const resolvedHeaders: Record<string, string> = {};
          if (def.headers) {
            for (const [hk, hv] of Object.entries(def.headers)) {
              let val = hv;
              for (const [envK, envV] of Object.entries(process.env)) {
                if (envV !== undefined) {
                  val = val.replace(`\${${envK}}`, envV);
                }
              }
              resolvedHeaders[hk] = val;
            }
          }

          // Extract token from Authorization header or specific env
          let token = process.env.BIGFIX_BEARER_TOKEN || "9qdVuQuIkXazX7eRa9s98LRB10VlXsze5uuYTQAAAAI";
          if (resolvedHeaders["Authorization"]) {
            token = resolvedHeaders["Authorization"].replace(/^Bearer\s+/i, "");
          }

          const httpClient = new BigFixStreamableHttpClient({
            url: def.url,
            token,
            readOnly: resolvedHeaders["X-Bes-Mcp-Read-Only"] !== "false",
            disableHitl: resolvedHeaders["X-Bes-Mcp-Disable-Hitl"] === "true",
          });

          await httpClient.connect();
          this.httpClients.set(serverName, httpClient);

          const toolsList = await httpClient.listTools();
          for (const tool of toolsList) {
            this.tools.set(tool.name, {
              serverName,
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema,
            });
          }
          console.log(`[MCP] Connected to remote HTTP server "${serverName}" (${toolsList.length} tools registered)`);
        } else if (def.command) {
          const envRecord: Record<string, string> = {};
          for (const [k, v] of Object.entries(process.env)) {
            if (v !== undefined) envRecord[k] = v;
          }
          if (def.env) {
            for (const [k, v] of Object.entries(def.env)) {
              if (v !== undefined) envRecord[k] = String(v);
            }
          }

          const transport = new StdioClientTransport({
            command: def.command,
            args: def.args,
            env: envRecord,
          });

          const client = new Client(
            {
              name: `loop-client-${serverName}`,
              version: "1.0.0",
            },
            {
              capabilities: {},
            }
          );

          await client.connect(transport);
          this.stdioClients.set(serverName, { client, transport });

          // Query server tools
          const toolsResult = await client.listTools();
          for (const tool of toolsResult.tools) {
            this.tools.set(tool.name, {
              serverName,
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema,
            });
          }
          console.log(`[MCP] Connected to stdio server "${serverName}" (${toolsResult.tools.length} tools registered)`);
        }
      } catch (err: any) {
        console.warn(`[MCP] Note: stdio connection for "${serverName}" skipped or failed (${err.message}). Checking built-in in-process tools...`);
        // Fallback: Check if there are built-in tools for this server
        const builtins = BUILTIN_INPROCESS_TOOLS.filter((t) => t.serverName === serverName);
        if (builtins.length > 0) {
          for (const tool of builtins) {
            this.tools.set(tool.name, tool);
          }
          console.log(`[MCP] Registered ${builtins.length} built-in in-process tools for "${serverName}"`);
        }
      }
    }

    // Only register core built-in in-process tools on the system manager (not subordinate user/workspace tiers)
    if (this.includeBuiltins) {
      for (const tool of BUILTIN_INPROCESS_TOOLS) {
        if (!this.tools.has(tool.name)) {
          this.tools.set(tool.name, tool);
        }
      }
    }
  }

  /**
   * Returns all discovered tools in OpenAI Function Calling format
   */
  getOpenAITools(): OpenAIToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  /**
   * Returns all discovered tools with their owning serverName and inputSchema
   */
  getDiscoveredTools(): DiscoveredTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Returns the serverName owning the specified tool
   */
  getToolServerName(name: string): string | undefined {
    return this.tools.get(name)?.serverName;
  }

  /**
   * Calls a tool by name on the corresponding MCP server
   */
  async executeTool(name: string, args: Record<string, any>, context?: { workspace?: string; userNumber?: string; [key: string]: any }): Promise<string> {
    const toolDef = this.tools.get(name);
    if (!toolDef) {
      throw new Error(`Tool "${name}" is not registered on any active MCP server.`);
    }

    // 1. Check if tool is handled by in-process builtins first
    const inProcessResult = await executeInProcessTool(name, args, this, context);
    if (inProcessResult !== null) {
      return inProcessResult;
    }

    // Timeout Protection for external tool calls (default: 60s, prevents hanging indefinitely)
    const timeoutMs = (typeof context?.toolTimeoutMs === "number" && context.toolTimeoutMs > 0)
      ? context.toolTimeoutMs
      : 60000;

    // 2. Check HTTP clients (e.g. BigFix)
    const httpClient = this.httpClients.get(toolDef.serverName);
    if (httpClient) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`[Tool Execution Timeout]: Tool "${name}" on HTTP server "${toolDef.serverName}" timed out after ${timeoutMs / 1000}s.`));
        }, timeoutMs);
        if (timer.unref) timer.unref();
      });

      const response = await Promise.race([
        httpClient.callTool(name, args),
        timeoutPromise,
      ]);

      if (response && response.content && Array.isArray(response.content)) {
        return response.content
          .map((item: any) => {
            if (item.type === "text") return item.text;
            return JSON.stringify(item);
          })
          .join("\n");
      }
      return JSON.stringify(response);
    }

    // 3. Check Stdio clients
    const target = this.stdioClients.get(toolDef.serverName);
    if (!target) {
      throw new Error(`Server "${toolDef.serverName}" for tool "${name}" is not connected.`);
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`[Tool Execution Timeout]: Tool "${name}" on stdio server "${toolDef.serverName}" timed out after ${timeoutMs / 1000}s. The service process may be deadlocked or unresponsive.`));
      }, timeoutMs);
      if (timer.unref) timer.unref();
    });

    const response = await Promise.race([
      target.client.callTool({
        name,
        arguments: args,
      }),
      timeoutPromise,
    ]);

    // Parse content blocks
    if (response.content && Array.isArray(response.content)) {
      return response.content
        .map((item: any) => {
          if (item.type === "text") return item.text;
          return JSON.stringify(item);
        })
        .join("\n");
    }

    return JSON.stringify(response);
  }

  /**
   * Register or replace a single MCP server dynamically at runtime without restarting
   */
  async registerServerDynamically(serverName: string, def: MCPServerDef): Promise<{ success: boolean; toolsAdded: string[]; error?: string }> {
    try {
      // 1. If server already exists, unregister it first
      await this.unregisterServer(serverName);

      if (!def.enabled) {
        return { success: true, toolsAdded: [] };
      }

      const isHttp = def.type === "http" || def.type === "streamable-http" || def.transport === "streamable-http" || (def.url && !def.command);
      const toolsAdded: string[] = [];

      if (isHttp && def.url) {
        const resolvedHeaders: Record<string, string> = {};
        if (def.headers) {
          for (const [hk, hv] of Object.entries(def.headers)) {
            let val = hv;
            for (const [envK, envV] of Object.entries(process.env)) {
              if (envV !== undefined) {
                val = val.replace(`\${${envK}}`, envV);
              }
            }
            resolvedHeaders[hk] = val;
          }
        }

        let token = process.env.BIGFIX_BEARER_TOKEN || "9qdVuQuIkXazX7eRa9s98LRB10VlXsze5uuYTQAAAAI";
        if (resolvedHeaders["Authorization"]) {
          token = resolvedHeaders["Authorization"].replace(/^Bearer\s+/i, "");
        }

        const httpClient = new BigFixStreamableHttpClient({
          url: def.url,
          token,
          readOnly: resolvedHeaders["X-Bes-Mcp-Read-Only"] !== "false",
          disableHitl: resolvedHeaders["X-Bes-Mcp-Disable-Hitl"] === "true",
        });

        await httpClient.connect();
        this.httpClients.set(serverName, httpClient);

        const toolsList = await httpClient.listTools();
        for (const tool of toolsList) {
          this.tools.set(tool.name, {
            serverName,
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          });
          toolsAdded.push(tool.name);
        }
        console.log(`[MCP Dynamic] Registered remote HTTP server "${serverName}" (${toolsAdded.length} tools)`);
        return { success: true, toolsAdded };
      } else if (def.command) {
        const envRecord: Record<string, string> = {};
        for (const [k, v] of Object.entries(process.env)) {
          if (v !== undefined) envRecord[k] = v;
        }
        if (def.env) {
          for (const [k, v] of Object.entries(def.env)) {
            if (v !== undefined) envRecord[k] = String(v);
          }
        }

        const transport = new StdioClientTransport({
          command: def.command,
          args: def.args,
          env: envRecord,
        });

        const client = new Client(
          {
            name: `loop-client-${serverName}`,
            version: "1.0.0",
          },
          {
            capabilities: {},
          }
        );

        await client.connect(transport);
        this.stdioClients.set(serverName, { client, transport });

        const toolsResult = await client.listTools();
        for (const tool of toolsResult.tools) {
          this.tools.set(tool.name, {
            serverName,
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          });
          toolsAdded.push(tool.name);
        }
        console.log(`[MCP Dynamic] Registered stdio server "${serverName}" (${toolsAdded.length} tools)`);
        // Also attach in-process meta-tools for web-search/minimax if applicable
        const builtins = BUILTIN_INPROCESS_TOOLS.filter((t) => t.serverName === serverName);
        for (const tool of builtins) {
          if (!this.tools.has(tool.name)) {
            this.tools.set(tool.name, tool);
            toolsAdded.push(tool.name);
          }
        }
        return { success: true, toolsAdded };
      } else {
        // In-process fallback or virtual server
        const builtins = BUILTIN_INPROCESS_TOOLS.filter((t) => t.serverName === serverName);
        for (const tool of builtins) {
          this.tools.set(tool.name, tool);
          toolsAdded.push(tool.name);
        }
        return { success: true, toolsAdded };
      }
    } catch (err: any) {
      console.error(`[MCP Dynamic Error] Failed to register server "${serverName}":`, err.message);
      return { success: false, toolsAdded: [], error: err.message };
    }
  }

  /**
   * Dynamically unregisters and closes a single MCP server
   */
  async unregisterServer(serverName: string): Promise<boolean> {
    // 1. Close stdio if exists
    const stdioEntry = this.stdioClients.get(serverName);
    if (stdioEntry) {
      try {
        await stdioEntry.client.close();
        await stdioEntry.transport.close();
      } catch {}
      killTransportProcessTree(stdioEntry.transport);
      this.stdioClients.delete(serverName);
    }

    // 2. Disconnect HTTP if exists
    const httpEntry = this.httpClients.get(serverName);
    if (httpEntry) {
      this.httpClients.delete(serverName);
    }

    // 3. Remove all tools associated with this server
    for (const [toolName, tool] of this.tools.entries()) {
      if (tool.serverName === serverName) {
        this.tools.delete(toolName);
      }
    }

    console.log(`[MCP Dynamic] Unregistered server "${serverName}"`);
    return true;
  }

  /**
   * Dynamically register an in-process tool directly
   */
  registerInProcessTool(tool: DiscoveredTool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Dynamically reloads and switches MCP servers at runtime
   */
  async reloadServers(serversConfig: Record<string, MCPServerDef>): Promise<void> {
    await this.closeAll();
    await this.initialize(serversConfig);
  }

  /**
   * Gracefully close all MCP client connections and clean up child process trees
   */
  async closeAll(): Promise<void> {
    for (const [serverName, { client, transport }] of this.stdioClients.entries()) {
      try {
        await client.close();
        await transport.close();
      } catch (err) {
        // Ignore closing errors
      }
      killTransportProcessTree(transport);
    }
    this.stdioClients.clear();
    this.httpClients.clear();
    this.tools.clear();
  }
}

