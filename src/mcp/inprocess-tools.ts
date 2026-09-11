import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DiscoveredTool } from "./client-manager.js";

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
// 3. Exported In-Process Tool Definitions & Dispatcher
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
];

export async function executeInProcessTool(name: string, args: Record<string, any>): Promise<string | null> {
  switch (name) {
    case "web_search":
      return await performSearch(String(args?.query || ""), Number(args?.maxResults) || 5);
    case "fetch_page":
      return await fetchPage(String(args?.url || ""));
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
