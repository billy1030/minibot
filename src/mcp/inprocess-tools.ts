import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as XLSX from "xlsx";
import { DiscoveredTool } from "./client-manager.js";
import { preprocessDocument } from "../documents/preprocessor.js";

const execFileAsync = promisify(execFile);

// ==========================================
// 1. Built-in Web Search & Fetch Implementation
// ==========================================

async function performDuckDuckGoSearch(query: string, maxResults = 5): Promise<string> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) {
    throw new Error(`DuckDuckGo search failed with HTTP ${res.status}`);
  }
  const html = await res.text();
  const results: Array<{ title: string; snippet: string; url: string }> = [];

  const resultRegex = /<a[^>]+class="result__snippet"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gis;
  const titleRegex = /<a[^>]+class="result__url"[^>]*>(.*?)<\/a>/gis;

  const matches = [...html.matchAll(/<div[^>]+class="result__body"[^>]*>(.*?)<\/div>/gis)];
  for (const m of matches.slice(0, maxResults)) {
    const body = m[1];
    const snippetMatch = body.match(/class="result__snippet"[^>]*>(.*?)<\/a>/is);
    const titleMatch = body.match(/class="result__title"[^>]*>.*?<a[^>]*>(.*?)<\/a>/is);
    const urlMatch = body.match(/class="result__url"[^>]*href="([^"]+)"/is);

    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "Untitled";
    const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, "").trim() : "";
    const link = urlMatch ? urlMatch[1].trim() : "";

    if (snippet || title !== "Untitled") {
      results.push({ title, snippet, url: link });
    }
  }

  if (results.length === 0) {
    return `No search results found for query: "${query}"`;
  }

  return results
    .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.snippet}\n   URL: ${r.url}`)
    .join("\n\n");
}

// Helper to reliably execute mmx on Windows (via cmd.exe /c mmx) and Unix
async function execMmxAsync(args: string[], timeout = 30000): Promise<string> {
  const isWin = process.platform === "win32";
  const cmd = isWin ? "cmd.exe" : "mmx";
  const execArgs = isWin ? ["/c", "mmx", ...args] : args;
  const { stdout } = await execFileAsync(cmd, execArgs, { timeout });
  return stdout.trim();
}

async function performMiniMaxSearch(query: string): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error("No MiniMax API key available for fallback search.");
  }
  return await execMmxAsync(["search", query, "--api-key", apiKey], 15000);
}

async function performSearch(query: string, maxResults = 5): Promise<string> {
  try {
    return await performDuckDuckGoSearch(query, maxResults);
  } catch (err: any) {
    try {
      return await performMiniMaxSearch(query);
    } catch {
      return `Search failed: ${err.message}`;
    }
  }
}

function isPrivateOrReservedHost(hostname: string): boolean {
  const cleanHost = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  
  // Localhost and loopback
  if (cleanHost === "localhost" || cleanHost === "127.0.0.1" || cleanHost === "::1" || cleanHost === "0.0.0.0") {
    return true;
  }
  // Cloud metadata endpoint (AWS/GCP/Azure)
  if (cleanHost === "169.254.169.254") {
    return true;
  }
  // IPv4 Private subnets
  const ipMatch = cleanHost.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipMatch) {
    const b0 = parseInt(ipMatch[1], 10);
    const b1 = parseInt(ipMatch[2], 10);
    // 10.0.0.0/8
    if (b0 === 10) return true;
    // 172.16.0.0/12
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
    // 192.168.0.0/16
    if (b0 === 192 && b1 === 168) return true;
    // 127.0.0.0/8
    if (b0 === 127) return true;
    // 169.254.0.0/16 (Link Local)
    if (b0 === 169 && b1 === 254) return true;
    // 0.0.0.0/8
    if (b0 === 0) return true;
  }
  return false;
}

async function fetchPage(targetUrl: string): Promise<string> {
  let finalUrl = targetUrl;
  if (targetUrl.includes("github.com") && targetUrl.includes("/blob/")) {
    finalUrl = targetUrl
      .replace("github.com", "raw.githubusercontent.com")
      .replace("/blob/", "/");
  }

  try {
    const parsed = new URL(finalUrl);
    // Only allow http and https protocols
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return `Failed to fetch URL: Protocol "${parsed.protocol}" is not supported or prohibited for security.`;
    }

    // SSRF Guard: block access to private, loopback, and metadata IPs
    if (isPrivateOrReservedHost(parsed.hostname)) {
      return `Access to local, private, or metadata network addresses (${parsed.hostname}) is restricted for security.`;
    }

    const res = await fetch(finalUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10000), // 🛡️ Prevent lingering sockets or timeout exhaustion
    });
    if (!res.ok) {
      return `Failed to fetch URL ${targetUrl}: HTTP ${res.status}`;
    }
    const html = await res.text();
    const textOnly = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return textOnly.slice(0, 4000);
  } catch (err: any) {
    return `Error fetching page ${targetUrl}: ${err.message}`;
  }
}

// ==========================================
// 2. Built-in MiniMax Multimodal Implementation
// ==========================================

async function minimaxSearch(query: string): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY || process.env.LLM_API_KEY;
  const args = ["search", query];
  if (apiKey) args.push("--api-key", apiKey);
  return await execMmxAsync(args, 15000);
}

async function minimaxGenerateImage(prompt: string, aspectRatio = "1:1"): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY || process.env.LLM_API_KEY;
  const args = ["image", prompt, "--aspect-ratio", aspectRatio];
  if (apiKey) args.push("--api-key", apiKey);
  return await execMmxAsync(args, 30000);
}

async function minimaxTextToSpeech(text: string, voice?: string): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY || process.env.LLM_API_KEY;
  const args = ["speech", text];
  if (voice) args.push("--voice", voice);
  if (apiKey) args.push("--api-key", apiKey);
  return await execMmxAsync(args, 30000);
}

async function minimaxGenerateMusic(prompt: string): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY || process.env.LLM_API_KEY;
  const args = ["music", prompt];
  if (apiKey) args.push("--api-key", apiKey);
  return await execMmxAsync(args, 60000);
}

// ==========================================
// 3. Document Download & Office File Parsers (Word, Excel, PDF)
// ==========================================

async function downloadRemoteFile(url: string, customFileName?: string): Promise<string> {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return `Failed to download: Protocol "${parsed.protocol}" is not supported.`;
    }
    if (isPrivateOrReservedHost(parsed.hostname)) {
      return `Access to local, private, or metadata network addresses (${parsed.hostname}) is restricted for security.`;
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(30000), // 30s timeout for downloads
    });

    if (!res.ok) {
      return `Failed to download file from ${url}: HTTP ${res.status} ${res.statusText}`;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine filename
    let fileName = customFileName?.trim();
    if (!fileName) {
      const pathname = parsed.pathname;
      fileName = path.basename(pathname) || `downloaded_${Date.now()}`;
    }

    // Save to storage/downloads/
    const downloadDir = path.resolve(process.cwd(), "storage/downloads");
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    const filePath = path.join(downloadDir, fileName);
    fs.writeFileSync(filePath, buffer);

    // Auto-parse preview if it's an office doc (pdf, docx, xlsx, etc.)
    let parsedSummary = "";
    try {
      const preprocessed = await preprocessDocument(buffer, fileName);
      parsedSummary = `\n\n📄 **Document Preview & Summary:**\n${preprocessed.previewSnippet.slice(0, 2000)}`;
    } catch {}

    return `✅ Successfully downloaded file "${fileName}" (${(buffer.length / 1024).toFixed(1)} KB) to \`${filePath}\`.${parsedSummary}`;
  } catch (err: any) {
    return `Error downloading file from ${url}: ${err.message}`;
  }
}

async function readOfficeDocument(filePath: string): Promise<string> {
  try {
    const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(resolvedPath)) {
      // Check in storage/downloads as fallback
      const inDownloads = path.resolve(process.cwd(), "storage/downloads", path.basename(filePath));
      if (!fs.existsSync(inDownloads)) {
        return `File not found at path: ${filePath}`;
      }
      return await readOfficeDocument(inDownloads);
    }

    const buffer = fs.readFileSync(resolvedPath);
    const fileName = path.basename(resolvedPath);
    const result = await preprocessDocument(buffer, fileName);

    return result.text;
  } catch (err: any) {
    return `Failed to read document "${filePath}": ${err.message}`;
  }
}

async function createExcelSpreadsheet(fileName: string, sheets: Array<{ sheetName: string; rows: any[][] }>): Promise<string> {
  try {
    let safeName = fileName.trim();
    if (!safeName.endsWith(".xlsx")) safeName += ".xlsx";

    const exportDir = path.resolve(process.cwd(), "storage/exports");
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filePath = path.join(exportDir, safeName);
    const workbook = XLSX.utils.book_new();

    for (const s of sheets) {
      const ws = XLSX.utils.aoa_to_sheet(s.rows || []);
      XLSX.utils.book_append_sheet(workbook, ws, s.sheetName || "Sheet1");
    }

    XLSX.writeFile(workbook, filePath);
    return `✅ Excel spreadsheet successfully created at: \`${filePath}\` (Sheets: ${sheets.map((s) => s.sheetName).join(", ")})`;
  } catch (err: any) {
    return `Failed to create Excel spreadsheet: ${err.message}`;
  }
}

// ==========================================
// 4. Exported In-Process Tool Definitions & Dispatcher
// ==========================================

export const BUILTIN_INPROCESS_TOOLS: DiscoveredTool[] = [
  {
    serverName: "web-search",
    name: "web_search",
    description: "Search the internet for current news, documentation, information, or answers to queries.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query string" },
        maxResults: { type: "number", description: "Maximum number of search results to return (default 5)" },
      },
      required: ["query"],
    },
  },
  {
    serverName: "web-search",
    name: "fetch_page",
    description: "Fetch and extract text content from a specific web URL.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The HTTP/HTTPS URL of the webpage to fetch" },
      },
      required: ["url"],
    },
  },
  {
    serverName: "minimax-multimodal",
    name: "minimax_search",
    description: "Perform a web search using MiniMax's official real-time search engine.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query string" },
      },
      required: ["query"],
    },
  },
  {
    serverName: "minimax-multimodal",
    name: "minimax_generate_image",
    description: "Generate an artistic, photographic, or realistic visual image using MiniMax's image model (e.g. photos, artwork, scenery). DO NOT use this tool for technical diagrams, architecture diagrams, flowcharts, or charts — for those, generate native SVG, HTML, or Mermaid code directly in text.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Detailed description of the image to generate" },
        aspectRatio: { type: "string", description: "Aspect ratio (default: 1:1)" },
      },
      required: ["prompt"],
    },
  },
  {
    serverName: "minimax-multimodal",
    name: "minimax_text_to_speech",
    description: "Synthesize spoken audio from text using MiniMax's Speech model.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The text content to speak" },
        voice: { type: "string", description: "Optional voice identifier" },
      },
      required: ["text"],
    },
  },
  {
    serverName: "minimax-multimodal",
    name: "minimax_generate_music",
    description: "Generate songs or musical audio using MiniMax's Music generation model.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Detailed description or lyrics of the song to generate" },
      },
      required: ["prompt"],
    },
  },
  // 📥 Autonomous Document Tools (Download, Parse Word/PDF/Excel, Export Excel)
  {
    serverName: "web-search",
    name: "download_remote_file",
    description: "Download any remote file (Word .docx, PDF .pdf, Excel .xlsx/.csv, text) from a public URL to local storage and return its path and content summary.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The direct public HTTP/HTTPS URL of the file to download" },
        customFileName: { type: "string", description: "Optional desired local file name (e.g. quarterly_report.xlsx)" },
      },
      required: ["url"],
    },
  },
  {
    serverName: "web-search",
    name: "read_office_document",
    description: "Extract and convert any local Word document (.docx), PDF (.pdf), or Excel spreadsheet (.xlsx, .xls, .csv) into clean structured Markdown text and tables.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Local file path or filename to read and parse" },
      },
      required: ["filePath"],
    },
  },
  {
    serverName: "web-search",
    name: "create_excel_spreadsheet",
    description: "Generate a formatted Excel workbook (.xlsx) with one or more sheets from structured 2D row/column data arrays.",
    inputSchema: {
      type: "object",
      properties: {
        fileName: { type: "string", description: "Name of the Excel file to generate (e.g. sales_summary.xlsx)" },
        sheets: {
          type: "array",
          description: "List of sheets to create with 2D array of row cells",
          items: {
            type: "object",
            properties: {
              sheetName: { type: "string", description: "Title of the sheet" },
              rows: {
                type: "array",
                description: "2D array of cells (rows of columns)",
                items: { type: "array", items: {} },
              },
            },
            required: ["sheetName", "rows"],
          },
        },
      },
      required: ["fileName", "sheets"],
    },
  },
  // 🤖 Self-Equipping Meta-Tools
  {
    serverName: "web-search",
    name: "search_available_tools",
    description: "Search the catalog and registry of available MCP tools & servers (e.g. sqlite, memory, github, filesystem, postgres, puppeteer) that can be installed on demand.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query or keyword (e.g. database, github, browser, memory, sqlite)" },
      },
      required: ["query"],
    },
  },
  {
    serverName: "web-search",
    name: "install_mcp_package",
    description: "Autonomously download, configure, and mount a new MCP tool package into MiniBot at runtime. Newly installed tools become immediately usable in your next reasoning iteration!",
    inputSchema: {
      type: "object",
      properties: {
        serverName: { type: "string", description: "Alphanumeric identifier for the server (e.g. sqlite, github, memory)" },
        packageOrCommand: { type: "string", description: "Command or npm package name (e.g. 'npx' or '@modelcontextprotocol/server-sqlite')" },
        args: {
          type: "array",
          items: { type: "string" },
          description: "Command line arguments (e.g. ['-y', '@modelcontextprotocol/server-sqlite', '--db-path', 'data.db'])",
        },
        env: {
          type: "object",
          description: "Optional environment variables for the tool (e.g. { GITHUB_PERSONAL_ACCESS_TOKEN: '...' })",
        },
      },
      required: ["serverName"],
    },
  },
  {
    serverName: "web-search",
    name: "list_active_tools",
    description: "List all currently mounted MCP tools, servers, and capabilities currently available in MiniBot.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    serverName: "web-search",
    name: "install_skill",
    description: "Save or create a reusable agent workflow skill recipe into Global or Workspace scope. The skill will be automatically activated when relevant tasks or triggers are encountered.",
    inputSchema: {
      type: "object",
      properties: {
        skillName: { type: "string", description: "Identifier name for the skill (e.g. data-analyst, bigfix-patching-sop)" },
        content: { type: "string", description: "Full Markdown instruction content for the skill (can include frontmatter with name, description, triggers)" },
        scope: { type: "string", enum: ["global", "workspace"], description: "Storage scope ('global' available everywhere, or 'workspace' for the current workspace only)" },
      },
      required: ["skillName", "content"],
    },
  },
  {
    serverName: "web-search",
    name: "list_skills",
    description: "List all available skills (Global and Workspace-scoped) registered in MiniBot.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

export async function executeInProcessTool(name: string, args: Record<string, any>, mcpManager?: any): Promise<string | null> {
  switch (name) {
    case "web_search":
      return await performSearch(String(args?.query || ""), Number(args?.maxResults) || 5);
    case "fetch_page":
      return await fetchPage(String(args?.url || ""));
    case "download_remote_file":
      return await downloadRemoteFile(String(args?.url || ""), args?.customFileName);
    case "read_office_document":
      return await readOfficeDocument(String(args?.filePath || ""));
    case "create_excel_spreadsheet":
      return await createExcelSpreadsheet(String(args?.fileName || ""), args?.sheets || []);
    case "search_available_tools": {
      const { searchToolsRegistry } = await import("./meta-tools.js");
      return searchToolsRegistry(String(args?.query || ""));
    }
    case "list_active_tools": {
      if (!mcpManager) return "MCP manager instance not provided.";
      const { listActiveTools } = await import("./meta-tools.js");
      return listActiveTools(mcpManager);
    }
    case "install_mcp_package": {
      if (!mcpManager) return "MCP manager instance not provided.";
      const { installMcpPackage } = await import("./meta-tools.js");
      return await installMcpPackage(
        mcpManager,
        String(args?.serverName || ""),
        String(args?.packageOrCommand || "npx"),
        Array.isArray(args?.args) ? args.args : [],
        args?.env
      );
    }
    case "install_skill": {
      const { installSkillTool } = await import("./meta-tools.js");
      return await installSkillTool(
        String(args?.skillName || ""),
        String(args?.content || ""),
        (args?.scope as any) || "global",
        args?.workspace || "default"
      );
    }
    case "list_skills": {
      const { listSkillsTool } = await import("./meta-tools.js");
      return await listSkillsTool(args?.workspace || "default");
    }
    case "minimax_search":
      return await minimaxSearch(String(args?.query || ""));
    case "minimax_generate_image":
      return await minimaxGenerateImage(String(args?.prompt || ""), args?.aspectRatio);
    case "minimax_text_to_speech":
      return await minimaxTextToSpeech(String(args?.text || ""), args?.voice);
    case "minimax_generate_music":
      return await minimaxGenerateMusic(String(args?.prompt || ""));
    default:
      return null;
  }
}

