import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Built-in Web Search & Fetch MCP Server
 * Provides standard internet search and page fetching capabilities
 */
const server = new Server(
  {
    name: "builtin-web-search-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register Tool Definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "web_search",
        description:
          "Search the internet for current news, documentation, information, or answers to queries. Returns relevant snippets and titles. When querying for recent or latest events, formulate queries using the current year/date provided in system prompt rather than outdated training dates.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query string",
            },
            maxResults: {
              type: "number",
              description: "Maximum number of search results to return (default 5)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "fetch_page",
        description: "Fetch and extract text content from a specific web URL.",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The HTTP/HTTPS URL of the webpage to fetch",
            },
          },
          required: ["url"],
        },
      },
    ],
  };
});

// Helper for web searching via DuckDuckGo HTML
async function performSearch(query: string, maxResults: number = 5): Promise<string> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!res.ok) {
      return `Search request returned status ${res.status}: ${res.statusText}`;
    }

    const html = await res.text();
    const results: Array<{ title: string; link: string; snippet: string }> = [];

    // Regex to match search result snippets in DDG HTML format
    const resultBlocks = html.split(/class="result\s+results_links/g).slice(1);

    for (const block of resultBlocks) {
      if (results.length >= maxResults) break;

      const titleMatch = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
      const snippetMatch = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i.exec(block);

      if (titleMatch) {
        let rawLink = titleMatch[1];
        // Clean uddg redirect link if present
        const uddgMatch = /uddg=([^&]+)/.exec(rawLink);
        if (uddgMatch) {
          try {
            rawLink = decodeURIComponent(uddgMatch[1]);
          } catch {}
        }

        const cleanTitle = titleMatch[2].replace(/<[^>]+>/g, "").trim();
        const cleanSnippet = snippetMatch
          ? snippetMatch[1].replace(/<[^>]+>/g, "").trim()
          : "";

        results.push({
          title: cleanTitle,
          link: rawLink,
          snippet: cleanSnippet,
        });
      }
    }

    if (results.length === 0) {
      // Fallback to mmx search if DuckDuckGo challenged/throttled
      try {
        const isWin = process.platform === "win32";
        const cmd = isWin ? "cmd.exe" : "mmx";
        const execArgs = isWin
          ? ["/c", "mmx", "search", "query", "--query", query]
          : ["search", "query", "--query", query];
        const { stdout } = await execFileAsync(cmd, execArgs);
        if (stdout && stdout.trim()) {
          return `[DuckDuckGo Rate-Limited: Automatically Switched to MiniMax Search Channel]\n\n${stdout.trim()}`;
        }
      } catch {}
      return `Search executed for "${query}". Found no results or access was challenged by the provider.`;
    }

    return results
      .map(
        (r, i) =>
          `[Result ${i + 1}]\nTitle: ${r.title}\nURL: ${r.link}\nSnippet: ${r.snippet}`
      )
      .join("\n\n");
  } catch (err: any) {
    // Fallback to mmx search on network error
    try {
      const isWin = process.platform === "win32";
      const cmd = isWin ? "cmd.exe" : "mmx";
      const execArgs = isWin
        ? ["/c", "mmx", "search", "query", "--query", query]
        : ["search", "query", "--query", query];
      const { stdout } = await execFileAsync(cmd, execArgs);
      if (stdout && stdout.trim()) {
        return `[DuckDuckGo Offline: Automatically Switched to MiniMax Search Channel]\n\n${stdout.trim()}`;
      }
    } catch {}
    return `Error performing web search for "${query}": ${err.message}`;
  }
}

// Helper for fetching page text
async function fetchPage(targetUrl: string): Promise<string> {
  let finalUrl = targetUrl;

  // Smart GitHub converter: transform github.com/.../blob/... to raw.githubusercontent.com to prevent HTTP 429
  const githubBlobMatch = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i.exec(targetUrl);
  if (githubBlobMatch) {
    const [, user, repo, branch, filePath] = githubBlobMatch;
    finalUrl = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${filePath}`;
  }

  try {
    const res = await fetch(finalUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) {
      return `Failed to fetch URL ${targetUrl}: HTTP ${res.status}`;
    }
    const html = await res.text();
    // Strip scripts, styles, and tags for clean readable text
    const textOnly = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return textOnly.slice(0, 4000); // return first 4000 chars
  } catch (err: any) {
    return `Error fetching page ${targetUrl}: ${err.message}`;
  }
}

// Handle Tool Invocations
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "web_search") {
    const query = String(args?.query || "");
    const maxResults = Number(args?.maxResults) || 5;
    const result = await performSearch(query, maxResults);
    return {
      content: [{ type: "text", text: result }],
    };
  }

  if (name === "fetch_page") {
    const url = String(args?.url || "");
    const content = await fetchPage(url);
    return {
      content: [{ type: "text", text: content }],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in Built-in Web Search MCP Server:", error);
  process.exit(1);
});
