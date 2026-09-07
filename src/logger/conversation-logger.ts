import fs from "node:fs";
import path from "node:path";

interface ToolExecutionLog {
  toolName: string;
  serverName?: string;
  args: any;
  result?: string;
  timestamp: number;
}

interface ConversationSession {
  sessionFile?: string; // If provided, append to this session file instead of creating a new one
  workspace?: string;    // Target workspace folder (defaults to "default")
  userNumber?: string;   // User number for folder isolation (e.g. "00000")
  userPrompt: string;
  model: string;
  iterations: number;
  toolCalls: ToolExecutionLog[];
  finalAnswer: string;
  startTime: Date;
  endTime: Date;
  attachedDocHashes?: string[];
}

/**
 * Format a Date object into YYYY-MM-DD_HH-mm-ss
 */
function formatDateForFilename(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

/**
 * Get root logs directory for a user, e.g. logs/00000/
 */
export function getUserLogsRoot(userNumber: string = "00000", baseDir: string = "logs"): string {
  const safeNumber = String(userNumber).padStart(5, "0").replace(/[^\d]/g, "").slice(0, 5) || "00000";
  const userRoot = path.resolve(process.cwd(), baseDir, safeNumber);
  if (!fs.existsSync(userRoot)) {
    fs.mkdirSync(userRoot, { recursive: true });
  }
  return userRoot;
}

/**
 * Clean and resolve workspace directory safely for a specific user
 */
export function getWorkspaceDir(workspace: string = "default", baseDir: string = "logs", userNumber: string = "00000"): string {
  const safeName = (workspace || "default").replace(/[^\w\d\-_ ]/g, "").trim() || "default";
  const parentDir = getUserLogsRoot(userNumber, baseDir);
  const targetDir = path.resolve(parentDir, safeName);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  return targetDir;
}

export interface WorkspaceSummary {
  name: string;
  sessionCount: number;
  lastUpdated?: string;
}

const migratedUsers = new Set<string>();

/**
 * Ensures existing legacy session files in logs/ root or logs/default are migrated into logs/00000/default/
 */
export function ensureWorkspaceMigration(baseDir: string = "logs", userNumber: string = "00000") {
  const cacheKey = `${baseDir}:${userNumber}`;
  if (migratedUsers.has(cacheKey)) {
    return;
  }
  migratedUsers.add(cacheKey);

  const logsRoot = path.resolve(process.cwd(), baseDir);
  if (!fs.existsSync(logsRoot)) {
    fs.mkdirSync(logsRoot, { recursive: true });
  }

  const userRoot = getUserLogsRoot(userNumber, baseDir);
  const userDefaultDir = path.join(userRoot, "default");
  if (!fs.existsSync(userDefaultDir)) {
    fs.mkdirSync(userDefaultDir, { recursive: true });
  }

  // 1. If admin (00000), check if legacy direct logs/default/ exists and move it
  if (userNumber === "00000") {
    const legacyDefaultDir = path.join(logsRoot, "default");
    if (fs.existsSync(legacyDefaultDir) && legacyDefaultDir !== userDefaultDir) {
      const items = fs.readdirSync(legacyDefaultDir, { withFileTypes: true });
      for (const item of items) {
        if (item.isFile() && item.name.endsWith(".md") && item.name !== "README.md") {
          const oldPath = path.join(legacyDefaultDir, item.name);
          const newPath = path.join(userDefaultDir, item.name);
          if (!fs.existsSync(newPath)) {
            try {
              fs.renameSync(oldPath, newPath);
            } catch (e) {}
          }
        }
      }
    }

    // Check if there are root .md files
    const rootItems = fs.readdirSync(logsRoot, { withFileTypes: true });
    for (const item of rootItems) {
      if (item.isFile() && item.name.endsWith(".md") && item.name !== "README.md") {
        const oldPath = path.join(logsRoot, item.name);
        const newPath = path.join(userDefaultDir, item.name);
        if (!fs.existsSync(newPath)) {
          try {
            fs.renameSync(oldPath, newPath);
          } catch (e) {}
        }
      }
    }
  }
}

/**
 * List all available workspace folders for a specific user
 */
export function listWorkspaces(baseDir: string = "logs", userNumber: string = "00000"): WorkspaceSummary[] {
  ensureWorkspaceMigration(baseDir, userNumber);
  const userRoot = getUserLogsRoot(userNumber, baseDir);
  const entries = fs.readdirSync(userRoot, { withFileTypes: true });

  const workspaces: WorkspaceSummary[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const wsDir = path.join(userRoot, entry.name);
      const files = fs.readdirSync(wsDir).filter((f) => f.endsWith(".md") && f !== "README.md");
      workspaces.push({
        name: entry.name,
        sessionCount: files.length,
      });
    }
  }

  // Ensure "default" is always present and first
  if (!workspaces.some((w) => w.name === "default")) {
    workspaces.unshift({ name: "default", sessionCount: 0 });
  } else {
    workspaces.sort((a, b) => {
      if (a.name === "default") return -1;
      if (b.name === "default") return 1;
      return a.name.localeCompare(b.name);
    });
  }

  return workspaces;
}

/**
 * Create a new workspace directory for a user
 */
export function createWorkspace(name: string, baseDir: string = "logs", userNumber: string = "00000"): string {
  const safeName = name.replace(/[^\w\d\-_ ]/g, "").trim();
  if (!safeName) {
    throw new Error("Invalid workspace name");
  }
  const userRoot = getUserLogsRoot(userNumber, baseDir);
  const wsDir = path.resolve(userRoot, safeName);
  if (!fs.existsSync(wsDir)) {
    fs.mkdirSync(wsDir, { recursive: true });
    console.log(`[Workspace] 📁 Created workspace folder for ${userNumber}: logs/${userNumber}/${safeName}`);
  }
  return safeName;
}

/**
 * Delete a workspace directory (safeguarded against deleting "default")
 */
export function deleteWorkspace(name: string, baseDir: string = "logs", userNumber: string = "00000"): boolean {
  const safeName = (name || "").replace(/[^\w\d\-_ ]/g, "").trim();
  if (!safeName || safeName === "default") {
    throw new Error("Cannot delete default workspace");
  }
  const userRoot = getUserLogsRoot(userNumber, baseDir);
  const wsDir = path.resolve(userRoot, safeName);
  if (fs.existsSync(wsDir)) {
    fs.rmSync(wsDir, { recursive: true, force: true });
    console.log(`[Workspace] 🗑️ Deleted workspace folder: logs/${userNumber}/${safeName}`);
    return true;
  }
  return false;
}

/**
 * Rename a workspace directory
 */
export function renameWorkspace(oldName: string, newName: string, baseDir: string = "logs", userNumber: string = "00000"): string {
  const safeOld = (oldName || "").replace(/[^\w\d\-_ ]/g, "").trim();
  const safeNew = (newName || "").replace(/[^\w\d\-_ ]/g, "").trim();
  if (!safeOld || !safeNew) {
    throw new Error("Invalid workspace name");
  }
  if (safeOld === "default") {
    throw new Error("Cannot rename default workspace");
  }
  if (safeOld === safeNew) {
    return safeNew;
  }
  const userRoot = getUserLogsRoot(userNumber, baseDir);
  const oldDir = path.resolve(userRoot, safeOld);
  const newDir = path.resolve(userRoot, safeNew);
  if (!fs.existsSync(oldDir)) {
    throw new Error(`Workspace "${safeOld}" does not exist`);
  }
  if (fs.existsSync(newDir)) {
    throw new Error(`Workspace "${safeNew}" already exists`);
  }
  fs.renameSync(oldDir, newDir);
  console.log(`[Workspace] 🏷️ Renamed workspace folder: logs/${userNumber}/${safeOld} -> logs/${userNumber}/${safeNew}`);
  return safeNew;
}

/**
 * Saves or appends a completed conversation turn into a session markdown log file within a workspace
 */
export function saveConversationLog(session: ConversationSession, baseDir: string = "logs", userNumber: string = "00000"): string {
  const finalUserNum = session.userNumber || userNumber || "00000";
  ensureWorkspaceMigration(baseDir, finalUserNum);
  const workspaceName = session.workspace || "default";
  const logsDir = getWorkspaceDir(workspaceName, baseDir, finalUserNum);

  const filename = session.sessionFile && session.sessionFile.endsWith(".md")
    ? path.basename(session.sessionFile)
    : `${formatDateForFilename(session.startTime)}.md`;
  const filePath = path.join(logsDir, filename);

  const durationMs = session.endTime.getTime() - session.startTime.getTime();
  const durationSec = (durationMs / 1000).toFixed(2);

  const isExisting = fs.existsSync(filePath);

  if (!isExisting) {
    // Brand new session: write header metadata + Turn 1
    const mdContent: string[] = [
      `# Conversation Log: ${filename.replace(".md", "")}`,
      "",
      "## Metadata",
      `- **User**: \`${finalUserNum}\``,
      `- **Workspace**: \`${workspaceName}\``,
      `- **Date / Time**: ${session.startTime.toISOString()} (Local: ${session.startTime.toLocaleString()})`,
      `- **Model**: \`${session.model}\``,
      `- **Iterations**: ${session.iterations}`,
      `- **Duration**: ${durationSec}s`,
      `- **Total Tool Calls**: ${session.toolCalls.length}`,
      `- **Attached Document Hashes**: \`${JSON.stringify(session.attachedDocHashes || [])}\``,
      "",
      "---",
      "",
      "## Turn 1: User Prompt",
      session.userPrompt,
      "",
      "---",
      "",
      "## Autonomous Loop Tool Calls & Observations",
    ];

    if (session.toolCalls.length === 0) {
      mdContent.push("*No external tools were invoked during this turn.*");
    } else {
      session.toolCalls.forEach((call, index) => {
        mdContent.push(`### [Step ${index + 1}] Tool: \`${call.toolName}\``);
        mdContent.push(`- **Owning MCP Server**: \`${call.serverName || "unknown"}\``);
        mdContent.push(`- **Timestamp**: ${new Date(call.timestamp).toISOString()}`);
        mdContent.push("");
        mdContent.push("#### Parameters");
        mdContent.push("```json");
        mdContent.push(JSON.stringify(call.args, null, 2));
        mdContent.push("```");
        mdContent.push("");
        mdContent.push("#### Observation (Result)");
        mdContent.push("```text");
        mdContent.push(call.result ? call.result.trim() : "*Awaiting result or terminated*");
        mdContent.push("```");
        mdContent.push("");
      });
    }

    mdContent.push("---");
    mdContent.push("");
    mdContent.push("## Turn 1: Synthesized Answer");
    mdContent.push("");
    mdContent.push(session.finalAnswer || "*No final response generated.*");
    mdContent.push("");

    fs.writeFileSync(filePath, mdContent.join("\n"), "utf-8");
    console.log(`[Conversation Logger] 📁 Created new conversation session: logs/${finalUserNum}/${workspaceName}/${filename}`);
  } else {
    // Existing session: append Turn N to the same file
    let existingContent = fs.readFileSync(filePath, "utf-8");

    if (session.attachedDocHashes && session.attachedDocHashes.length > 0) {
      if (/- \*\*Attached Document Hashes\*\*: `[^`]+`/.test(existingContent)) {
        existingContent = existingContent.replace(
          /- \*\*Attached Document Hashes\*\*: `[^`]+`/,
          `- **Attached Document Hashes**: \`${JSON.stringify(session.attachedDocHashes)}\``
        );
      }
    }

    const turnMatches = existingContent.match(/## (?:Turn \d+: )?User Prompt/g) || [];
    const turnNumber = turnMatches.length + 1;

    const appendParts: string[] = [
      "",
      "---",
      "",
      `## Turn ${turnNumber}: User Prompt`,
      session.userPrompt,
      "",
      "---",
      "",
      `## Autonomous Loop Tool Calls & Observations (Turn ${turnNumber})`,
    ];

    if (session.toolCalls.length === 0) {
      appendParts.push("*No external tools were invoked during this turn.*");
    } else {
      session.toolCalls.forEach((call, index) => {
        appendParts.push(`### [Step ${index + 1}] Tool: \`${call.toolName}\``);
        appendParts.push(`- **Owning MCP Server**: \`${call.serverName || "unknown"}\``);
        appendParts.push(`- **Timestamp**: ${new Date(call.timestamp).toISOString()}`);
        appendParts.push("");
        appendParts.push("#### Parameters");
        appendParts.push("```json");
        appendParts.push(JSON.stringify(call.args, null, 2));
        appendParts.push("```");
        appendParts.push("");
        appendParts.push("#### Observation (Result)");
        appendParts.push("```text");
        appendParts.push(call.result ? call.result.trim() : "*Awaiting result or terminated*");
        appendParts.push("```");
        appendParts.push("");
      });
    }

    appendParts.push("---");
    appendParts.push("");
    appendParts.push(`## Turn ${turnNumber}: Synthesized Answer`);
    appendParts.push("");
    appendParts.push(session.finalAnswer || "*No final response generated.*");
    appendParts.push("");

    fs.writeFileSync(filePath, existingContent + appendParts.join("\n"), "utf-8");
    console.log(`[Conversation Logger] ➕ Appended Turn ${turnNumber} to: logs/${finalUserNum}/${workspaceName}/${filename}`);
  }

  return filename;
}

export interface ConversationSummary {
  filename: string;
  workspace: string;
  timestamp: string;
  model: string;
  iterations: number;
  toolCount: number;
  preview: string;
  customTitle?: string;
  attachedDocCount?: number;
  forkLevel?: number;
  clonedFrom?: {
    parentFilename: string;
    parentWorkspace?: string;
    turnIndex?: number;
    mode?: string;
  };
}

/**
 * List all saved conversation markdown files in a workspace ordered by newest first
 */
export function listConversationLogs(workspace: string = "default", baseDir: string = "logs", userNumber: string = "00000"): ConversationSummary[] {
  ensureWorkspaceMigration(baseDir, userNumber);
  const logsDir = getWorkspaceDir(workspace, baseDir, userNumber);

  const files = fs
    .readdirSync(logsDir)
    .filter((f) => f.endsWith(".md") && f !== "README.md");

  const results: ConversationSummary[] = [];

  for (const filename of files) {
    try {
      const fullPath = path.join(logsDir, filename);
      const content = fs.readFileSync(fullPath, "utf-8");

      const titleMatch = content.match(/- \*\*Title\*\*: `([^`]+)`/);
      const userMatch = content.match(/- \*\*User\*\*: `([^`]+)`/);
      // If user tag is specified and doesn't match current user (and not root 00000), skip
      if (userMatch && userMatch[1].trim() !== userNumber && userNumber !== "00000") {
        continue;
      }

      const modelMatch = content.match(/- \*\*Model\*\*: `([^`]+)`/);
      const iterMatch = content.match(/- \*\*Iterations\*\*: (\d+)/);
      const toolMatch = content.match(/- \*\*Total Tool Calls\*\*: (\d+)/);
      const timeMatch = content.match(/- \*\*Date \/ Time\*\*: ([^\n\r]+)/);

      // Extract attached documents count
      let attachedDocCount = 0;
      const docMatch = content.match(/- \*\*Attached Document Hashes\*\*: `([^`]+)`/);
      if (docMatch) {
        try {
          const hashes = JSON.parse(docMatch[1]);
          if (Array.isArray(hashes)) {
            attachedDocCount = hashes.length;
          }
        } catch {}
      }

      // Extract Cloned From metadata if session was branched
      let clonedFrom: ConversationSummary["clonedFrom"] = undefined;
      const cloneMatch = content.match(/- \*\*Cloned From\*\*: `([^`]+)`(?:\s*\((.*?)\))?/);
      if (cloneMatch) {
        const parentFilename = cloneMatch[1];
        const extraInfo = cloneMatch[2] || "";
        const wsMatch = extraInfo.match(/Workspace:\s*([^,)]+)/);
        const turnMatch = extraInfo.match(/Turn\s*(\d+)/);
        const modeMatch = extraInfo.match(/Mode:\s*([^,)]+)/);

        clonedFrom = {
          parentFilename,
          parentWorkspace: wsMatch ? wsMatch[1].trim() : workspace,
          turnIndex: turnMatch ? parseInt(turnMatch[1], 10) : undefined,
          mode: modeMatch ? modeMatch[1].trim() : undefined,
        };
      }

      const promptMatch = content.match(/## (?:Turn 1: )?User Prompt\r?\n([\s\S]*?)\r?\n---/);
      const prompt = promptMatch ? promptMatch[1].trim() : "No prompt recorded";

      results.push({
        filename,
        workspace,
        timestamp: timeMatch ? timeMatch[1].split(" (")[0] : filename.replace(".md", ""),
        model: modelMatch ? modelMatch[1] : "Unknown",
        iterations: iterMatch ? parseInt(iterMatch[1], 10) : 1,
        toolCount: toolMatch ? parseInt(toolMatch[1], 10) : 0,
        preview: prompt.length > 80 ? prompt.slice(0, 80) + "..." : prompt,
        customTitle: titleMatch ? titleMatch[1] : undefined,
        attachedDocCount,
        clonedFrom,
      });
    } catch (err) {
      console.warn(`[Conversation Logger] Failed to parse summary for ${filename}`);
    }
  }

  // Precompute fork levels for efficient tree presentation (iterative with safety cap)
  const filenameToSummary = new Map<string, ConversationSummary>();
  results.forEach((r) => filenameToSummary.set(r.filename, r));

  const computeDepth = (startSummary: ConversationSummary): number => {
    let depth = 0;
    let current: ConversationSummary | undefined = startSummary;
    const visited = new Set<string>();

    while (current && current.clonedFrom?.parentFilename && depth < 50) {
      if (visited.has(current.filename)) break;
      visited.add(current.filename);

      const parent = filenameToSummary.get(current.clonedFrom.parentFilename);
      if (!parent) {
        depth += 1;
        break;
      }
      depth += 1;
      current = parent;
    }
    return depth;
  };

  results.forEach((r) => {
    r.forkLevel = computeDepth(r);
  });

  // Load custom session order from session-order.json if present
  const orderFilePath = path.join(logsDir, "session-order.json");
  if (fs.existsSync(orderFilePath)) {
    try {
      const orderList = JSON.parse(fs.readFileSync(orderFilePath, "utf-8"));
      if (Array.isArray(orderList) && orderList.length > 0) {
        const orderMap = new Map<string, number>();
        orderList.forEach((fname: string, index: number) => {
          orderMap.set(fname, index);
        });

        return results.sort((a, b) => {
          const aOrder = orderMap.has(a.filename) ? orderMap.get(a.filename)! : 9999;
          const bOrder = orderMap.has(b.filename) ? orderMap.get(b.filename)! : 9999;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return b.filename.localeCompare(a.filename);
        });
      }
    } catch (e) {
      console.warn(`[Conversation Logger] Failed to read session-order.json in ${logsDir}`);
    }
  }

  return results.sort((a, b) => b.filename.localeCompare(a.filename));
}

/**
 * Saves custom conversation ordering list into session-order.json in the workspace directory
 */
export function saveConversationOrder(
  orderedFilenames: string[],
  workspace: string = "default",
  baseDir: string = "logs",
  userNumber: string = "00000"
): boolean {
  ensureWorkspaceMigration(baseDir, userNumber);
  const dir = getWorkspaceDir(workspace, baseDir, userNumber);
  if (!fs.existsSync(dir)) return false;

  const orderFilePath = path.join(dir, "session-order.json");
  fs.writeFileSync(orderFilePath, JSON.stringify(orderedFilenames, null, 2), "utf-8");
  console.log(`[Conversation Logger] 🔀 Saved custom session order (${orderedFilenames.length} items) to logs/${userNumber}/${workspace}/session-order.json`);
  return true;
}

/**
 * Parses a saved conversation markdown file back into structured multi-turn messages & tool calls
 */
export function parseConversationLog(filename: string, workspace: string = "default", baseDir: string = "logs", userNumber: string = "00000") {
  ensureWorkspaceMigration(baseDir, userNumber);
  const safeFilename = path.basename(filename);
  const fullPath = path.join(getWorkspaceDir(workspace, baseDir, userNumber), safeFilename);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Log file "${safeFilename}" does not exist in workspace "${workspace}".`);
  }

  const content = fs.readFileSync(fullPath, "utf-8");

  // Strict User Verification: Check if log has User tag in Metadata and enforce ownership
  const userMatch = content.match(/- \*\*User\*\*: `([^`]+)`/);
  if (userMatch) {
    const fileUserNumber = userMatch[1].trim();
    if (fileUserNumber !== userNumber && userNumber !== "00000") {
      throw new Error(`Unauthorized access: Log file "${safeFilename}" belongs to user ${fileUserNumber}.`);
    }
  }

  // Extract Title and Attached Document Hashes
  const titleMatch = content.match(/- \*\*Title\*\*: `([^`]+)`/);
  const customTitle = titleMatch ? titleMatch[1] : undefined;

  let attachedDocHashes: string[] = [];
  const hashMatch = content.match(/- \*\*Attached Document Hashes\*\*: `([^`]+)`/);
  if (hashMatch) {
    try {
      attachedDocHashes = JSON.parse(hashMatch[1]);
    } catch {}
  }

  // Parse Multi-Turn Messages
  const messages: any[] = [];

  let normalizedContent = content;
  if (/## User Prompt\r?\n/.test(normalizedContent) && !/## Turn 1: User Prompt/.test(normalizedContent)) {
    normalizedContent = normalizedContent.replace(/## User Prompt\r?\n/, "## Turn 1: User Prompt\n");
    normalizedContent = normalizedContent.replace(/## (?:Final Synthesized Answer|Synthesized Answer)\r?\n/, "## Turn 1: Synthesized Answer\n");
  }

  const splitPattern = /(?:^|\r?\n)(?=## Turn \d+: User Prompt)/g;
  const rawTurnSections = normalizedContent.split(splitPattern).filter((s) => s.includes("## Turn "));

  for (const turnBlock of rawTurnSections) {
    const turnHeaderMatch = turnBlock.match(/## Turn (\d+): User Prompt\r?\n([\s\S]*?)(?=\r?\n---)/);
    if (!turnHeaderMatch) continue;

    const turnNum = parseInt(turnHeaderMatch[1], 10);
    const userPrompt = turnHeaderMatch[2].trim();

    const answerMatch = turnBlock.match(/## (?:Turn \d+: )?(?:Final )?Synthesized Answer\r?\n\r?\n([\s\S]*?)$/);
    let answer = answerMatch ? answerMatch[1].trim() : "";
    answer = answer.replace(/\r?\n---\s*$/, "").trim();

    const toolCalls: any[] = [];
    const toolSections = turnBlock.split(/### \[Step \d+\] Tool: `([^`]+)`/g);
    for (let i = 1; i < toolSections.length; i += 2) {
      const toolName = toolSections[i];
      const body = toolSections[i + 1] || "";
      const serverMatch = body.match(/- \*\*Owning MCP Server\*\*: `([^`]+)`/);
      const serverName = serverMatch ? serverMatch[1] : undefined;
      const timeMatch = body.match(/- \*\*Timestamp\*\*: ([^\n\r]+)/);
      const timestamp = timeMatch ? new Date(timeMatch[1]).getTime() : Date.now();
      const argsMatch = body.match(/#### Parameters\r?\n```json\r?\n([\s\S]*?)\r?\n```/);
      let args = {};
      if (argsMatch) {
        try { args = JSON.parse(argsMatch[1]); } catch {}
      }
      const obsMatch = body.match(/#### Observation \(Result\)\r?\n```text\r?\n([\s\S]*?)\r?\n```/);
      const result = obsMatch ? obsMatch[1].trim() : undefined;

      toolCalls.push({
        id: `tool-${timestamp}-${turnNum}-${i}`,
        toolName,
        serverName,
        args,
        result,
        timestamp,
      });
    }

    if (userPrompt) {
      messages.push({
        id: `user-turn-${turnNum}`,
        role: "user",
        content: userPrompt,
        turnIndex: turnNum,
      });
    }

    if (answer || toolCalls.length > 0) {
      messages.push({
        id: `assistant-turn-${turnNum}`,
        role: "assistant",
        content: answer,
        toolCalls,
        turnIndex: turnNum,
        isStreaming: false,
      });
    }
  }

  // Extract Cloned From metadata if session was branched
  let clonedFrom: any = undefined;
  const cloneMatch = content.match(/- \*\*Cloned From\*\*: `([^`]+)`(?:\s*\((.*?)\))?/);
  if (cloneMatch) {
    const parentFilename = cloneMatch[1];
    const extraInfo = cloneMatch[2] || "";
    const wsMatch = extraInfo.match(/Workspace:\s*([^,)]+)/);
    const turnMatch = extraInfo.match(/Turn\s*(\d+)/);
    const modeMatch = extraInfo.match(/Mode:\s*([^,)]+)/);

    clonedFrom = {
      parentFilename,
      parentWorkspace: wsMatch ? wsMatch[1].trim() : workspace,
      turnIndex: turnMatch ? parseInt(turnMatch[1], 10) : undefined,
      mode: modeMatch ? modeMatch[1].trim() : undefined,
    };
  }

  const forkLevel = clonedFrom ? getConversationForkLevel(filename, workspace, baseDir, userNumber) : 0;

  return {
    filename: safeFilename,
    workspace,
    title: customTitle || safeFilename,
    messages,
    attachedDocHashes,
    clonedFrom,
    forkLevel,
  };
}

/**
 * Renames / sets a custom title for a conversation log file
 */
export function renameConversationLog(
  filename: string,
  newTitle: string,
  workspace: string = "default",
  baseDir: string = "logs",
  userNumber: string = "00000"
): boolean {
  ensureWorkspaceMigration(baseDir, userNumber);
  const safeFilename = path.basename(filename);
  const fullPath = path.join(getWorkspaceDir(workspace, baseDir, userNumber), safeFilename);
  if (!fs.existsSync(fullPath)) return false;

  const content = fs.readFileSync(fullPath, "utf-8");
  const sanitizedTitle = newTitle.replace(/[\r\n`]/g, "").trim();

  let updatedContent = content;
  if (/- \*\*Title\*\*: `[^`]+`/.test(content)) {
    updatedContent = content.replace(/- \*\*Title\*\*: `[^`]+`/, `- **Title**: \`${sanitizedTitle}\``);
  } else {
    updatedContent = content.replace(/## Metadata\r?\n/, `## Metadata\n- **Title**: \`${sanitizedTitle}\`\n`);
  }

  fs.writeFileSync(fullPath, updatedContent, "utf-8");
  console.log(`[Conversation Logger] 🏷️ Updated session title to: "${sanitizedTitle}" for logs/${userNumber}/${workspace}/${safeFilename}`);
  return true;
}

/**
 * Reads only the Cloned From metadata from a conversation markdown file without parsing the whole log.
 */
function readClonedFromMetadata(
  filename: string,
  workspace: string = "default",
  baseDir: string = "logs",
  userNumber: string = "00000"
): { parentFilename: string; parentWorkspace: string } | null {
  try {
    const safeFilename = path.basename(filename);
    const fullPath = path.join(getWorkspaceDir(workspace, baseDir, userNumber), safeFilename);
    if (!fs.existsSync(fullPath)) return null;

    // Read only the first 2KB of the file (metadata is always located in the header)
    const fd = fs.openSync(fullPath, "r");
    const buffer = Buffer.alloc(2048);
    const bytesRead = fs.readSync(fd, buffer, 0, 2048, 0);
    fs.closeSync(fd);

    const headerText = buffer.toString("utf-8", 0, bytesRead);
    const cloneMatch = headerText.match(/- \*\*Cloned From\*\*: `([^`]+)`(?:\s*\((.*?)\))?/);
    if (!cloneMatch) return null;

    const parentFilename = cloneMatch[1].trim();
    const extraInfo = cloneMatch[2] || "";
    const wsMatch = extraInfo.match(/Workspace:\s*([^,)]+)/);
    const parentWorkspace = wsMatch ? wsMatch[1].trim() : workspace;

    return { parentFilename, parentWorkspace };
  } catch {
    return null;
  }
}

/**
 * Computes the fork/nesting depth of a conversation session log (0 for root, 1 for 1st fork, etc.)
 * Iterative, non-recursive, and completely immune to infinite mutual loops or stack overflow.
 */
export function getConversationForkLevel(
  filename: string,
  workspace: string = "default",
  baseDir: string = "logs",
  userNumber: string = "00000"
): number {
  let depth = 0;
  let currentFile = filename;
  let currentWs = workspace;
  const visited = new Set<string>();

  while (currentFile && !visited.has(currentFile) && depth < 20) {
    visited.add(currentFile);
    const meta = readClonedFromMetadata(currentFile, currentWs, baseDir, userNumber);
    if (!meta || !meta.parentFilename) {
      break;
    }
    depth += 1;
    currentFile = meta.parentFilename;
    currentWs = meta.parentWorkspace || currentWs;
  }

  return depth;
}

/**
 * Clones / forks a specific turn into a new independent session log file.
 * Max fork level is strictly limited to 5.
 */
export function cloneConversationTurn(
  filename: string,
  turnIndex: number,
  mode: "single" | "up_to" = "up_to",
  workspace: string = "default",
  targetWorkspace?: string,
  customDocHashes?: string[],
  baseDir: string = "logs",
  userNumber: string = "00000"
): { newFilename: string; title: string; workspace: string; attachedDocHashes: string[]; forkLevel: number } {
  ensureWorkspaceMigration(baseDir, userNumber);
  const parsed = parseConversationLog(filename, workspace, baseDir, userNumber);

  // Check and enforce maximum fork level of 5
  const currentForkLevel = getConversationForkLevel(filename, workspace, baseDir, userNumber);
  const nextForkLevel = currentForkLevel + 1;
  const MAX_FORK_LEVEL = 5;

  if (nextForkLevel > MAX_FORK_LEVEL) {
    throw new Error(`Maximum fork level limit reached (${MAX_FORK_LEVEL}). Cannot fork deeper sub-conversations.`);
  }

  const now = new Date();
  const newFilename = `${formatDateForFilename(now)}.md`;
  const destWorkspace = targetWorkspace || workspace || "default";
  const fullPath = path.join(getWorkspaceDir(destWorkspace, baseDir, userNumber), newFilename);

  let targetMessages = parsed.messages;
  if (mode === "single") {
    targetMessages = parsed.messages.filter((m) => m.turnIndex === turnIndex);
  } else {
    targetMessages = parsed.messages.filter((m) => (m.turnIndex || 1) <= turnIndex);
  }

  if (targetMessages.length === 0) {
    throw new Error(`No messages found for turn index ${turnIndex}`);
  }

  const firstUserMsg = targetMessages.find((m) => m.role === "user");
  const rawTitle = firstUserMsg ? firstUserMsg.content : "Cloned Conversation";
  const cleanTitle = rawTitle.replace(/[`\r\n]+/g, " ").trim().slice(0, 40) || "Conversation";
  const newTitle = `[Fork L#${nextForkLevel} T#${turnIndex}] ${cleanTitle}`;

  const finalDocHashes = Array.isArray(customDocHashes) ? customDocHashes : (parsed.attachedDocHashes || []);

  const mdParts: string[] = [
    `# Conversation Log: ${newFilename.replace(".md", "")}`,
    "",
    "## Metadata",
    `- **User**: \`${userNumber}\``,
    `- **Workspace**: \`${destWorkspace}\``,
    `- **Title**: \`${newTitle}\``,
    `- **Date / Time**: ${now.toISOString()} (Local: ${now.toLocaleString()})`,
    `- **Model**: \`Cloned Session\``,
    `- **Iterations**: 1`,
    `- **Duration**: 0.00s`,
    `- **Total Tool Calls**: 0`,
    `- **Attached Document Hashes**: \`${JSON.stringify(finalDocHashes)}\``,
    `- **Cloned From**: \`${filename}\` (Workspace: ${workspace}, Turn ${turnIndex}, Mode: ${mode})`,
    "",
  ];

  const turns: Array<{ user?: any; assistant?: any; turnNum: number }> = [];
  targetMessages.forEach((m) => {
    const tNum = m.turnIndex || 1;
    let t = turns.find((item) => item.turnNum === tNum);
    if (!t) {
      t = { turnNum: tNum };
      turns.push(t);
    }
    if (m.role === "user") t.user = m;
    else if (m.role === "assistant") t.assistant = m;
  });

  turns.forEach((t, idx) => {
    const seqNum = idx + 1;
    mdParts.push("---");
    mdParts.push("");
    mdParts.push(`## Turn ${seqNum}: User Prompt`);
    mdParts.push(t.user?.content || "");
    mdParts.push("");
    mdParts.push("---");
    mdParts.push("");
    mdParts.push(`## Autonomous Loop Tool Calls & Observations (Turn ${seqNum})`);

    if (t.assistant?.toolCalls && t.assistant.toolCalls.length > 0) {
      t.assistant.toolCalls.forEach((call: any, cIdx: number) => {
        mdParts.push(`### [Step ${cIdx + 1}] Tool: \`${call.toolName}\``);
        mdParts.push(`- **Owning MCP Server**: \`${call.serverName || "unknown"}\``);
        mdParts.push(`- **Timestamp**: ${new Date(call.timestamp || Date.now()).toISOString()}`);
        mdParts.push("");
        mdParts.push("#### Parameters");
        mdParts.push("```json");
        mdParts.push(JSON.stringify(call.args || {}, null, 2));
        mdParts.push("```");
        mdParts.push("");
        mdParts.push("#### Observation (Result)");
        mdParts.push("```text");
        mdParts.push(call.result ? call.result.trim() : "*Observation*");
        mdParts.push("```");
        mdParts.push("");
      });
    } else {
      mdParts.push("*No external tools were invoked during this turn.*");
    }

    mdParts.push("---");
    mdParts.push("");
    mdParts.push(`## Turn ${seqNum}: Synthesized Answer`);
    mdParts.push("");
    mdParts.push(t.assistant?.content || "");
    mdParts.push("");
  });

  fs.writeFileSync(fullPath, mdParts.join("\n"), "utf-8");
  console.log(`[Conversation Logger] 🌿 Cloned Turn ${turnIndex} from "${filename}" to logs/${userNumber}/${destWorkspace}/${newFilename}`);

  return { newFilename, title: newTitle, workspace: destWorkspace, attachedDocHashes: finalDocHashes, forkLevel: nextForkLevel };
}

/**
 * Delete a saved conversation log file safely
 */
export function deleteConversationLog(filename: string, workspace: string = "default", baseDir: string = "logs", userNumber: string = "00000"): boolean {
  ensureWorkspaceMigration(baseDir, userNumber);
  const safeFilename = path.basename(filename);
  if (!safeFilename.endsWith(".md") || safeFilename === "README.md") {
    throw new Error("Invalid log file specified.");
  }

  const fullPath = path.join(getWorkspaceDir(workspace, baseDir, userNumber), safeFilename);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    console.log(`[Conversation Logger] 🗑️ Deleted conversation log: logs/${userNumber}/${workspace}/${safeFilename}`);

    // Clean up session-order.json if present
    const orderFilePath = path.join(getWorkspaceDir(workspace, baseDir, userNumber), "session-order.json");
    if (fs.existsSync(orderFilePath)) {
      try {
        const orderList = JSON.parse(fs.readFileSync(orderFilePath, "utf-8"));
        if (Array.isArray(orderList)) {
          const filtered = orderList.filter((f) => f !== safeFilename);
          fs.writeFileSync(orderFilePath, JSON.stringify(filtered, null, 2), "utf-8");
        }
      } catch (e) {}
    }

    return true;
  }
  return false;
}
