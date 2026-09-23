import fs from "node:fs";
import path from "node:path";
import { MCPServerDef } from "../config/schema.js";
import { MCPClientManager, DiscoveredTool, OpenAIToolDefinition } from "./client-manager.js";
import { getUserLogsRoot, getWorkspaceDir } from "../logger/conversation-logger.js";

export type MCPScope = "system" | "user" | "workspace";

export interface ScopedMCPServerDef extends MCPServerDef {
  scope?: MCPScope;
  workspace?: string;
  userNumber?: string;
}

export interface ScopedDiscoveredTool extends DiscoveredTool {
  scope: MCPScope;
  workspace?: string;
  userNumber?: string;
}

export class ScopedMCPManager {
  private systemManager: MCPClientManager;
  // Keyed by userNumber: e.g. "00000"
  private userManagers = new Map<string, MCPClientManager>();
  // Keyed by userNumber:workspace: e.g. "00000:default"
  private workspaceManagers = new Map<string, MCPClientManager>();

  constructor(systemManager?: MCPClientManager) {
    this.systemManager = systemManager || new MCPClientManager();
  }

  public getSystemManager(): MCPClientManager {
    return this.systemManager;
  }

  /**
   * Path to user global MCP configuration: config/users/{userNumber}/mcp.json
   */
  public getUserConfigPath(userNumber: string = "00000"): string {
    const safeNumber = String(userNumber).padStart(5, "0").replace(/[^\d]/g, "").slice(0, 5) || "00000";
    return path.resolve(process.cwd(), "config", "users", safeNumber, "mcp.json");
  }

  /**
   * Path to workspace local MCP configuration: logs/{userNumber}/{workspace}/.mcp/mcp.json
   */
  public getWorkspaceConfigPath(workspace: string = "default", userNumber: string = "00000"): string {
    const wsDir = getWorkspaceDir(workspace, "logs", userNumber);
    return path.resolve(wsDir, ".mcp", "mcp.json");
  }

  /**
   * Read MCP servers configured for a specific user (User Global)
   */
  public readUserServers(userNumber: string = "00000"): Record<string, MCPServerDef> {
    const configPath = this.getUserConfigPath(userNumber);
    if (!fs.existsSync(configPath)) return {};
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      return parsed.mcpServers || parsed || {};
    } catch (err) {
      console.warn(`[ScopedMCP] Failed to read user MCP config from ${configPath}:`, err);
      return {};
    }
  }

  /**
   * Save MCP servers configured for a specific user (User Global)
   */
  public saveUserServers(servers: Record<string, MCPServerDef>, userNumber: string = "00000"): void {
    const configPath = this.getUserConfigPath(userNumber);
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify({ mcpServers: servers }, null, 2), "utf-8");
  }

  /**
   * Read MCP servers configured for a specific workspace (User Workspace Local)
   */
  public readWorkspaceServers(workspace: string = "default", userNumber: string = "00000"): Record<string, MCPServerDef> {
    const configPath = this.getWorkspaceConfigPath(workspace, userNumber);
    if (!fs.existsSync(configPath)) return {};
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      return parsed.mcpServers || parsed || {};
    } catch (err) {
      console.warn(`[ScopedMCP] Failed to read workspace MCP config from ${configPath}:`, err);
      return {};
    }
  }

  /**
   * Save MCP servers configured for a specific workspace (User Workspace Local)
   */
  public saveWorkspaceServers(servers: Record<string, MCPServerDef>, workspace: string = "default", userNumber: string = "00000"): void {
    const configPath = this.getWorkspaceConfigPath(workspace, userNumber);
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify({ mcpServers: servers }, null, 2), "utf-8");
  }

  /**
   * Initialize or return the user-level MCPClientManager
   */
  public async getUserManager(userNumber: string = "00000"): Promise<MCPClientManager> {
    const safeNumber = String(userNumber).padStart(5, "0").replace(/[^\d]/g, "").slice(0, 5) || "00000";
    let manager = this.userManagers.get(safeNumber);
    if (!manager) {
      manager = new MCPClientManager();
      const userServers = this.readUserServers(safeNumber);
      if (Object.keys(userServers).length > 0) {
        await manager.initialize(userServers);
      }
      this.userManagers.set(safeNumber, manager);
    }
    return manager;
  }

  /**
   * Initialize or return the workspace-level MCPClientManager
   */
  public async getWorkspaceManager(workspace: string = "default", userNumber: string = "00000"): Promise<MCPClientManager> {
    const safeNumber = String(userNumber).padStart(5, "0").replace(/[^\d]/g, "").slice(0, 5) || "00000";
    const key = `${safeNumber}:${workspace || "default"}`;
    let manager = this.workspaceManagers.get(key);
    if (!manager) {
      manager = new MCPClientManager();
      const wsServers = this.readWorkspaceServers(workspace, safeNumber);
      if (Object.keys(wsServers).length > 0) {
        await manager.initialize(wsServers);
      }
      this.workspaceManagers.set(key, manager);
    }
    return manager;
  }

  /**
   * Get all active tools across System, User, and Workspace tiers in OpenAI Function format.
   * Priority: Workspace Local > User Global > System Global
   */
  public async getOpenAIToolsForContext(
    workspace: string = "default",
    userNumber: string = "00000"
  ): Promise<OpenAIToolDefinition[]> {
    const discovered = await this.getDiscoveredToolsForContext(workspace, userNumber);
    return discovered.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  /**
   * Get all discovered tools with scope metadata
   */
  public async getDiscoveredToolsForContext(
    workspace: string = "default",
    userNumber: string = "00000"
  ): Promise<ScopedDiscoveredTool[]> {
    const toolMap = new Map<string, ScopedDiscoveredTool>();

    // 1. Tier 1: System Global Tools
    const systemTools = this.systemManager.getDiscoveredTools();
    for (const tool of systemTools) {
      toolMap.set(tool.name, {
        ...tool,
        scope: "system",
      });
    }

    // 2. Tier 2: User Global Tools
    const userMgr = await this.getUserManager(userNumber);
    const userTools = userMgr.getDiscoveredTools();
    for (const tool of userTools) {
      toolMap.set(tool.name, {
        ...tool,
        scope: "user",
        userNumber,
      });
    }

    // 3. Tier 3: Workspace Local Tools (Overrides earlier tiers if same tool name)
    const wsMgr = await this.getWorkspaceManager(workspace, userNumber);
    const wsTools = wsMgr.getDiscoveredTools();
    for (const tool of wsTools) {
      toolMap.set(tool.name, {
        ...tool,
        scope: "workspace",
        workspace,
        userNumber,
      });
    }

    return Array.from(toolMap.values());
  }

  /**
   * Execute a tool by delegating to the appropriate tier manager
   */
  public async executeTool(
    name: string,
    args: Record<string, any>,
    context?: { workspace?: string; userNumber?: string; [key: string]: any }
  ): Promise<string> {
    const workspace = context?.workspace || "default";
    const userNumber = context?.userNumber || "00000";

    // 1. Check Workspace Manager first
    const wsMgr = await this.getWorkspaceManager(workspace, userNumber);
    if (wsMgr.getToolServerName(name)) {
      return await wsMgr.executeTool(name, args, context);
    }

    // 2. Check User Manager
    const userMgr = await this.getUserManager(userNumber);
    if (userMgr.getToolServerName(name)) {
      return await userMgr.executeTool(name, args, context);
    }

    // 3. Fallback to System Manager
    return await this.systemManager.executeTool(name, args, context);
  }

  /**
   * Find which scope and server owns a tool
   */
  public async getToolOrigin(
    name: string,
    workspace: string = "default",
    userNumber: string = "00000"
  ): Promise<{ scope: MCPScope; serverName: string } | null> {
    const wsMgr = await this.getWorkspaceManager(workspace, userNumber);
    const wsServer = wsMgr.getToolServerName(name);
    if (wsServer) return { scope: "workspace", serverName: wsServer };

    const userMgr = await this.getUserManager(userNumber);
    const userServer = userMgr.getToolServerName(name);
    if (userServer) return { scope: "user", serverName: userServer };

    const sysServer = this.systemManager.getToolServerName(name);
    if (sysServer) return { scope: "system", serverName: sysServer };

    return null;
  }

  /**
   * Reload a specific tier when modified
   */
  public async reloadScope(scope: MCPScope, workspace: string = "default", userNumber: string = "00000"): Promise<void> {
    if (scope === "user") {
      const safeNumber = String(userNumber).padStart(5, "0").replace(/[^\d]/g, "").slice(0, 5) || "00000";
      const existing = this.userManagers.get(safeNumber);
      if (existing) {
        await existing.closeAll();
        this.userManagers.delete(safeNumber);
      }
      await this.getUserManager(safeNumber);
    } else if (scope === "workspace") {
      const safeNumber = String(userNumber).padStart(5, "0").replace(/[^\d]/g, "").slice(0, 5) || "00000";
      const key = `${safeNumber}:${workspace || "default"}`;
      const existing = this.workspaceManagers.get(key);
      if (existing) {
        await existing.closeAll();
        this.workspaceManagers.delete(key);
      }
      await this.getWorkspaceManager(workspace, safeNumber);
    }
  }

  /**
   * Close all active client connections across all tiers
   */
  public async closeAll(): Promise<void> {
    await this.systemManager.closeAll();
    for (const userMgr of this.userManagers.values()) {
      await userMgr.closeAll();
    }
    this.userManagers.clear();
    for (const wsMgr of this.workspaceManagers.values()) {
      await wsMgr.closeAll();
    }
    this.workspaceManagers.clear();
  }
}
