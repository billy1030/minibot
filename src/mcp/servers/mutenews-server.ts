import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Interface representing a raw MuteNews item
 */
interface MuteNewsItem {
  id: string;
  uid: string;
  md5id: string;
  content: string;
  importance: string; // "0" to "3"
  createdAt: string;  // UNIX timestamp in seconds
  updatedAt: string;
  pid: string;
}

interface ParsedFlashNews {
  id: string;
  timestamp: number;
  timeFormatted: string; // "HH:mm"
  dateFormatted: string; // "YYYY-MM-DD"
  importance: number;    // 3 = breaking/red alert, 0 = normal
  isAlert: boolean;      // true if importance >= 2
  category: string;      // extracted tag from 【...】 or "市場動態"
  content: string;
}

const MUTENEWS_ENDPOINT = "https://mutemute.com/mutenews/ajax/app-news.php";

/**
 * Format UNIX timestamp to HKT (UTC+8) readable time
 */
function formatTimestamp(unixSec: number): { timeStr: string; dateStr: string } {
  const date = new Date(unixSec * 1000);
  // Format in Asia/Hong_Kong timezone
  const optionsDate: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  const optionsTime: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };

  const dateParts = new Intl.DateTimeFormat("en-CA", optionsDate).format(date); // YYYY-MM-DD
  const timeParts = new Intl.DateTimeFormat("en-GB", optionsTime).format(date); // HH:mm
  return { dateStr: dateParts, timeStr: timeParts };
}

/**
 * Parse raw item into structured news
 */
function parseNewsItem(item: MuteNewsItem): ParsedFlashNews {
  const ts = parseInt(item.createdAt, 10) || Math.floor(Date.now() / 1000);
  const { dateStr, timeStr } = formatTimestamp(ts);
  const importance = parseInt(item.importance, 10) || 0;

  // Extract category if enclosed in 【...】
  const match = item.content.match(/^【(.*?)】/);
  const category = match ? match[1] : "市場動態";

  return {
    id: item.id,
    timestamp: ts,
    timeFormatted: timeStr,
    dateFormatted: dateStr,
    importance,
    isAlert: importance >= 2,
    category,
    content: item.content,
  };
}

/**
 * Fetch raw items from MuteNews endpoint with pagination support
 */
async function fetchMutenewsFeed(lastId?: string, lastCreate?: string): Promise<ParsedFlashNews[]> {
  let url = MUTENEWS_ENDPOINT;
  if (lastId && lastCreate) {
    url += `?lastid=${encodeURIComponent(lastId)}&lastCreate=${encodeURIComponent(lastCreate)}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch mutenews: HTTP ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { content?: MuteNewsItem[] };
  if (!data.content || !Array.isArray(data.content)) {
    return [];
  }

  return data.content.map(parseNewsItem);
}

/**
 * Built-in MuteNews Flash Feed MCP Server
 * Exposes live financial flash news along the time axis
 */
const server = new Server(
  {
    name: "mutenews-flash-server",
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
        name: "get_latest_financial_flash",
        description:
          "Fetch real-time financial flash news (7x24 live stream) with timestamps, categories, and importance alerts (e.g. Hong Kong stocks, A-shares, US premarket, FX fixes, commodities).",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Number of news items to return (default: 20, max: 50)",
            },
            alertsOnly: {
              type: "boolean",
              description: "If true, only returns high-importance breaking news / red alert flashes (importance >= 2)",
            },
            filterKeyword: {
              type: "string",
              description: "Optional keyword to filter headlines (e.g. '恒指', '人民幣', '原油', '美股')",
            },
          },
        },
      },
      {
        name: "search_flash_by_time_window",
        description:
          "Search financial flash news items within a specific time window or pagination cursor to analyze news surrounding market events.",
        inputSchema: {
          type: "object",
          properties: {
            keyword: {
              type: "string",
              description: "Keyword or ticker to match in flash news text",
            },
            timeWindowMinutes: {
              type: "number",
              description: "Filter to news published within the last N minutes (e.g. 60 for past hour)",
            },
            minImportance: {
              type: "number",
              description: "Minimum importance score (0 for all, 2 for major events only)",
            },
          },
        },
      },
    ],
  };
});

// Handle Tool Execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_latest_financial_flash") {
      const limit = Math.min(Math.max(Number(args?.limit) || 20, 1), 50);
      const alertsOnly = Boolean(args?.alertsOnly);
      const filterKeyword = args?.filterKeyword ? String(args.filterKeyword).trim() : null;

      const items = await fetchMutenewsFeed();

      let filtered = items;
      if (alertsOnly) {
        filtered = filtered.filter((item) => item.isAlert);
      }
      if (filterKeyword) {
        const kwLower = filterKeyword.toLowerCase();
        filtered = filtered.filter((item) =>
          item.content.toLowerCase().includes(kwLower) || item.category.toLowerCase().includes(kwLower)
        );
      }

      const results = filtered.slice(0, limit);

      const formattedOutput = results
        .map((item) => {
          const alertBadge = item.isAlert ? "🔴 [急報 ALERT]" : "⚪ [一般]";
          return `${alertBadge} ${item.timeFormatted} (${item.dateFormatted}) | 【${item.category}】\n${item.content}\n[ID: ${item.id} | Timestamp: ${item.timestamp}]`;
        })
        .join("\n\n----------------------------------------\n\n");

      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} live financial flash items:\n\n${formattedOutput}`,
          },
        ],
      };
    }

    if (name === "search_flash_by_time_window") {
      const keyword = args?.keyword ? String(args.keyword).trim().toLowerCase() : "";
      const timeWindowMinutes = Number(args?.timeWindowMinutes) || 0;
      const minImportance = Number(args?.minImportance) || 0;

      const items = await fetchMutenewsFeed();
      const nowTs = Math.floor(Date.now() / 1000);

      const filtered = items.filter((item) => {
        if (minImportance > 0 && item.importance < minImportance) {
          return false;
        }
        if (timeWindowMinutes > 0) {
          const diffMinutes = (nowTs - item.timestamp) / 60;
          if (diffMinutes > timeWindowMinutes) {
            return false;
          }
        }
        if (keyword && !item.content.toLowerCase().includes(keyword) && !item.category.toLowerCase().includes(keyword)) {
          return false;
        }
        return true;
      });

      const formatted = filtered.map((item) => ({
        id: item.id,
        time: item.timeFormatted,
        date: item.dateFormatted,
        timestamp: item.timestamp,
        importance: item.importance,
        isAlert: item.isAlert,
        category: item.category,
        content: item.content,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                query: { keyword, timeWindowMinutes, minImportance },
                count: formatted.length,
                items: formatted,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error executing ${name}: ${error?.message || String(error)}`,
        },
      ],
    };
  }
});

// Start STDIO Transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in mutenews-server:", error);
  process.exit(1);
});
