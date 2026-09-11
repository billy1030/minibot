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
 * MiniMax Multimodal MCP Server
 * Wraps mmx-cli commands into native MCP tools for the Loop Chatbot
 */
const server = new Server(
  {
    name: "minimax-multimodal-server",
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
        name: "minimax_search",
        description:
          "Perform a web search using MiniMax's official real-time search engine. Returns recent web results, news, and links.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query string",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "minimax_generate_image",
        description:
          "Generate an artistic or photographic visual image using MiniMax's image-01 model. Returns generated image URLs or file details. DO NOT use this tool for software diagrams, architecture, charts, or flowcharts — output SVG, HTML, or Mermaid directly instead.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Detailed description of the image to generate",
            },
            aspectRatio: {
              type: "string",
              description: "Aspect ratio, e.g. 16:9, 1:1, 4:3 (default: 1:1)",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "minimax_synthesize_speech",
        description:
          "Synthesize text to realistic speech audio using MiniMax's speech model. Returns path to the generated audio file.",
        inputSchema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "Text content to speak",
            },
            voice: {
              type: "string",
              description: "Optional voice ID (e.g. English_expressive_narrator)",
            },
          },
          required: ["text"],
        },
      },
      {
        name: "minimax_generate_music",
        description:
          "Generate music audio using MiniMax's music-2.5 model. Returns path or details of generated music.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Style, mood, genre, or instruments description",
            },
            lyrics: {
              type: "string",
              description: "Lyrics text or structure. Use [instrumental] for no vocals",
            },
          },
          required: ["prompt"],
        },
      },
    ],
  };
});

// Execute mmx command helper
async function runMmx(args: string[]): Promise<string> {
  try {
    const isWin = process.platform === "win32";
    const fullArgs = [...args, "--non-interactive", "--output", "json", "--quiet"];
    
    // On Windows, use cmd /c mmx to ensure batch/cmd shims execute reliably
    const cmd = isWin ? "cmd.exe" : "mmx";
    const execArgs = isWin ? ["/c", "mmx", ...fullArgs] : fullArgs;

    const { stdout, stderr } = await execFileAsync(cmd, execArgs);
    if (stdout.trim()) {
      return stdout.trim();
    }
    if (stderr.trim()) {
      return `Stderr: ${stderr.trim()}`;
    }
    return "Command completed with no output.";
  } catch (err: any) {
    return `Error executing mmx CLI: ${err.message} ${err.stderr || ""}`;
  }
}

// Handle Tool Invocations
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "minimax_search") {
    const query = String(args?.query || "");
    const output = await runMmx(["search", "query", "--query", query]);
    return { content: [{ type: "text", text: output }] };
  }

  if (name === "minimax_generate_image") {
    const prompt = String(args?.prompt || "");
    const aspectRatio = String(args?.aspectRatio || "1:1");
    const output = await runMmx([
      "image",
      "generate",
      "--prompt",
      prompt,
      "--aspect-ratio",
      aspectRatio,
    ]);
    return { content: [{ type: "text", text: output }] };
  }

  if (name === "minimax_synthesize_speech") {
    const text = String(args?.text || "");
    const voice = args?.voice ? String(args.voice) : "English_expressive_narrator";
    const outFile = `output-speech-${Date.now()}.mp3`;
    const output = await runMmx([
      "speech",
      "synthesize",
      "--text",
      text,
      "--voice",
      voice,
      "--out",
      outFile,
    ]);
    return {
      content: [{ type: "text", text: `Audio generated: ${outFile}\nOutput: ${output}` }],
    };
  }

  if (name === "minimax_generate_music") {
    const prompt = String(args?.prompt || "");
    const outFile = `output-music-${Date.now()}.mp3`;
    const cmdArgs = ["music", "generate", "--prompt", prompt, "--out", outFile];
    if (args?.lyrics) {
      cmdArgs.push("--lyrics", String(args.lyrics));
    } else {
      cmdArgs.push("--instrumental");
    }
    const output = await runMmx(cmdArgs);
    return {
      content: [{ type: "text", text: `Music generated: ${outFile}\nOutput: ${output}` }],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in MiniMax Multimodal MCP Server:", error);
  process.exit(1);
});
