import fs from "node:fs";
import path from "node:path";
import { MCPClientManager, DiscoveredTool } from "./client-manager.js";

export interface MCPRegistryEntry {
  id: string;
  name: string;
  description: string;
  category: "database" | "developer" | "web" | "filesystem" | "productivity" | "ai";
  package: string;
  command: string;
  args: string[];
  sampleTools: string[];
}

/**
 * Curated registry of high-quality Model Context Protocol (MCP) servers
 */
export const POPULAR_MCP_REGISTRY: MCPRegistryEntry[] = [
  {
    id: "sqlite",
    name: "SQLite Database MCP",
    description: "Read, query, analyze, and write to local SQLite databases (.db, .sqlite).",
    category: "database",
    package: "@modelcontextprotocol/server-sqlite",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sqlite"],
    sampleTools: ["read_query", "write_query", "create_table", "list_tables", "describe_table"],
  },
  {
    id: "memory",
    name: "Knowledge Graph Memory MCP",
    description: "Graph-based long-term persistent memory for entities, relationships, and facts.",
    category: "ai",
    package: "@modelcontextprotocol/server-memory",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    sampleTools: ["create_entities", "create_relations", "read_graph", "search_nodes", "open_nodes"],
  },
  {
    id: "filesystem",
    name: "Local Filesystem MCP",
    description: "Secure local filesystem operations: read files, write files, search directories, and view directory trees.",
    category: "filesystem",
    package: "@modelcontextprotocol/server-filesystem",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "storage"],
    sampleTools: ["read_file", "write_file", "list_directory", "directory_tree", "search_files"],
  },
  {
    id: "github",
    name: "GitHub API MCP",
    description: "Interact with GitHub repositories, search code, read pull requests, and query issues.",
    category: "developer",
    package: "@modelcontextprotocol/server-github",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    sampleTools: ["search_repositories", "get_file_contents", "list_issues", "create_issue"],
  },
  {
    id: "puppeteer",
    name: "Puppeteer Web Browser Scraper",
    description: "Headless browser automation to scrape JavaScript-rendered single-page apps (SPAs), take screenshots, and click elements.",
    category: "web",
    package: "@modelcontextprotocol/server-puppeteer",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    sampleTools: ["puppeteer_navigate", "puppeteer_screenshot", "puppeteer_click", "puppeteer_fill"],
  },
  {
    id: "postgres",
    name: "PostgreSQL Database MCP",
    description: "Query and inspect PostgreSQL relational databases and schemas.",
    category: "database",
    package: "@modelcontextprotocol/server-postgres",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres"],
    sampleTools: ["query"],
  },
  {
    id: "fetch",
    name: "Fetch & Web Content MCP",
    description: "Fetch web pages and convert HTML to clean Markdown text.",
    category: "web",
    package: "@modelcontextprotocol/server-fetch",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-fetch"],
    sampleTools: ["fetch"],
  },
];

/**
 * Searches the MCP registry and currently installed tools
 */
export function searchToolsRegistry(query: string): string {
  const q = query.toLowerCase().trim();
  const matched = POPULAR_MCP_REGISTRY.filter(
    (entry) =>
      entry.name.toLowerCase().includes(q) ||
      entry.description.toLowerCase().includes(q) ||
      entry.category.toLowerCase().includes(q) ||
      entry.sampleTools.some((t) => t.toLowerCase().includes(q))
  );

  if (matched.length === 0) {
    return `No matching pre-configured MCP packages found for "${query}". You can still install any public npm MCP package using \`install_mcp_package\` with command="npx" and args=["-y", "<package-name>"].`;
  }

  const results = matched.map((m, idx) => {
    return `${idx + 1}. **${m.name}** (\`${m.id}\`)
   • Package: \`${m.package}\`
   • Category: \`${m.category}\`
   • Description: ${m.description}
   • Tools Provided: ${m.sampleTools.map((t) => `\`${t}\``).join(", ")}
   • Ready to install with: \`install_mcp_package(serverName="${m.id}", packageOrCommand="npx", args=["-y", "${m.package}"]) \``;
  });

  return `### 🔍 Available MCP Packages Found (${matched.length}):\n\n${results.join("\n\n")}`;
}

/**
 * Lists all active tools across all mounted MCP servers
 */
export function listActiveTools(mcpManager: MCPClientManager): string {
  const tools = mcpManager.getDiscoveredTools();
  if (tools.length === 0) {
    return "No tools are currently mounted.";
  }

  // Group by server
  const grouped: Record<string, DiscoveredTool[]> = {};
  for (const t of tools) {
    const s = t.serverName || "default";
    if (!grouped[s]) grouped[s] = [];
    grouped[s].push(t);
  }

  const output: string[] = [`### 🛠️ Active Tools Currently Mounted (${tools.length} total):\n`];
  for (const [serverName, sTools] of Object.entries(grouped)) {
    output.push(`#### 📦 Server: \`${serverName}\` (${sTools.length} tools)`);
    for (const tool of sTools) {
      output.push(`- **\`${tool.name}\`**: ${tool.description || "No description"}`);
    }
    output.push("");
  }

  return output.join("\n");
}

/**
 * Autonomously installs and hot-registers a new MCP server package
 */
export async function installMcpPackage(
  mcpManager: MCPClientManager,
  serverName: string,
  packageOrCommand: string,
  args: string[] = [],
  env?: Record<string, string>
): Promise<string> {
  const cleanName = serverName.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!cleanName) {
    return "Failed: serverName must be a valid alphanumeric identifier.";
  }

  // Check if serverName matches a known registry preset
  const preset = POPULAR_MCP_REGISTRY.find(
    (p) => p.id === cleanName.toLowerCase() || p.package.toLowerCase() === packageOrCommand.toLowerCase()
  );

  let finalCommand = packageOrCommand.trim();
  let finalArgs = [...args];

  // If user or LLM passed an npm package name directly as command (e.g. "@modelcontextprotocol/server-sqlite")
  if (finalCommand.startsWith("@") || finalCommand.includes("/")) {
    finalArgs = ["-y", finalCommand, ...finalArgs];
    finalCommand = "npx";
  } else if (preset && finalArgs.length === 0) {
    finalCommand = preset.command;
    finalArgs = preset.args;
  }

  // Security whitelist check for command
  const allowedCommands = ["npx", "node", "uvx", "python", "bun", "bunx"];
  const baseCmd = path.basename(finalCommand).toLowerCase().replace(/\.exe$/, "").replace(/\.cmd$/, "");
  if (!allowedCommands.includes(baseCmd)) {
    return `Security Violation: Executable command "${finalCommand}" is not in the allowed list: ${allowedCommands.join(", ")}. Use "npx" with public npm packages.`;
  }

  try {
    console.log(`[Self-Equip Agent] Installing MCP Server "${cleanName}": ${finalCommand} ${finalArgs.join(" ")}`);
    const result = await mcpManager.registerServerDynamically(cleanName, {
      type: "stdio",
      command: finalCommand,
      args: finalArgs,
      env: env || undefined,
      enabled: true,
      strictSSL: false,
      description: `Autonomously installed tool: ${cleanName}`,
    });

    if (!result.success) {
      return `❌ Failed to install MCP server "${cleanName}": ${result.error || "Unknown error"}. Check package name and network connectivity.`;
    }

    // Persist to config/dynamic-mcp.json so it is remembered across server restarts
    try {
      const dynamicConfigDir = path.resolve(process.cwd(), "config");
      if (!fs.existsSync(dynamicConfigDir)) fs.mkdirSync(dynamicConfigDir, { recursive: true });
      const dynamicConfigFile = path.join(dynamicConfigDir, "dynamic-mcp.json");

      let currentDynamic: Record<string, any> = {};
      if (fs.existsSync(dynamicConfigFile)) {
        currentDynamic = JSON.parse(fs.readFileSync(dynamicConfigFile, "utf-8"));
      }
      currentDynamic[cleanName] = {
        type: "stdio",
        command: finalCommand,
        args: finalArgs,
        env: env || undefined,
        enabled: true,
        installedAt: new Date().toISOString(),
      };
      fs.writeFileSync(dynamicConfigFile, JSON.stringify(currentDynamic, null, 2), "utf-8");
    } catch {}

    const toolNames = result.toolsAdded.map((t) => `\`${t}\``).join(", ");
    return `🎉 Successfully installed and mounted MCP server "${cleanName}"!
• Tools now available for immediate use (${result.toolsAdded.length}): ${toolNames}
• You can now invoke any of these tools directly in your next step!`;
  } catch (err: any) {
    return `Error during tool installation: ${err.message}`;
  }
}

/**
 * Autonomously save or update an agent skill recipe into Global or Workspace scope
 */
export async function installSkillTool(
  skillName: string,
  content: string,
  scope: "global" | "workspace" = "global",
  workspace: string = "default"
): Promise<string> {
  const { globalSkillManager } = await import("../skills/skill-manager.js");
  const res = globalSkillManager.saveSkill(skillName, content, scope, workspace);
  if (!res.success) {
    return `❌ Failed to save skill: ${res.error}`;
  }
  return `✨ Skill "${skillName}" successfully saved to ${scope.toUpperCase()} scope at \`${res.filePath}\`! It will be automatically injected whenever relevant tasks are run.`;
}

/**
 * List all skills available in the environment
 */
export async function listSkillsTool(workspace: string = "default"): Promise<string> {
  const { globalSkillManager } = await import("../skills/skill-manager.js");
  const skills = globalSkillManager.listAvailableSkills(workspace);
  if (skills.length === 0) return "No skills are currently registered.";

  const lines = skills.map(
    (s) => `• **${s.name}** [${s.scope.toUpperCase()}${s.workspace ? ` / ${s.workspace}` : ""}]: ${s.description || "No description"}`
  );
  return `### 📚 Available Skills (${skills.length}):\n${lines.join("\n")}`;
}

