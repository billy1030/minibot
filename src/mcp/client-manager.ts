import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { MCPServerDef } from "../config/schema.js";
import { BigFixStreamableHttpClient } from "./bigfix-client.js";
import { BUILTIN_INPROCESS_TOOLS, executeInProcessTool } from "./inprocess-tools.js";

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

  /**
   * Initializes and connects to all configured MCP servers
   */
  async initialize(serversConfig: Record<string, MCPServerDef>): Promise<void> {
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

    // Always register all core built-in in-process tools (e.g. run_python_code, install_skill, download_remote_file, etc.)
    for (const tool of BUILTIN_INPROCESS_TOOLS) {
      if (!this.tools.has(tool.name)) {
        this.tools.set(tool.name, tool);
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
  async executeTool(name: string, args: Record<string, any>, context?: { workspace?: string; userNumber?: string }): Promise<string> {
    const toolDef = this.tools.get(name);
    if (!toolDef) {
      throw new Error(`Tool "${name}" is not registered on any active MCP server.`);
    }

    // 1. Check if tool is handled by in-process builtins first
    const inProcessResult = await executeInProcessTool(name, args, this, context);
    if (inProcessResult !== null) {
      return inProcessResult;
    }

    // 2. Check HTTP clients (e.g. BigFix)
    const httpClient = this.httpClients.get(toolDef.serverName);
    if (httpClient) {
      const response = await httpClient.callTool(name, args);
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

    const response = await target.client.callTool({
      name,
      arguments: args,
    });

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
   * Gracefully close all MCP client connections
   */
  async closeAll(): Promise<void> {
    for (const [serverName, { client, transport }] of this.stdioClients.entries()) {
      try {
        await client.close();
        await transport.close();
      } catch (err) {
        // Ignore closing errors
      }
    }
    this.stdioClients.clear();
    this.httpClients.clear();
    this.tools.clear();
  }
}

