import { z } from "zod";

export const LLMConfigSchema = z.object({
  baseUrl: z.string().default("https://api.openai.com/v1"),
  apiKey: z.string().default(""),
  model: z.string().default("gpt-4o"),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().positive().optional().default(4096),
});

export const VoiceConfigSchema = z.object({
  baseUrl: z.string().default("https://api.minimaxi.com/v1"),
  apiKey: z.string().default(""),
  model: z.string().default("speech-01-turbo"),
  voiceId: z.string().default("English_expressive_narrator"),
  speed: z.number().min(0.5).max(2.0).default(1.0),
  enabled: z.boolean().default(true),
});

export const PromptsConfigSchema = z.object({
  systemPrompt: z.string().default(
    "You are an expert Mini Chat Bot Assistant. You have access to external tools via the Model Context Protocol (MCP). " +
    "When a user asks a question requiring external or up-to-date data, invoke the appropriate tool, inspect the result, " +
    "and reason through the next steps until you have a comprehensive answer."
  ),
  skillsPrompt: z.string().default(
    "## AI Skills & Protocols:\n" +
    "- Internet Search & Web Ingestion: Use MCP search/fetch tools to gather facts before answering questions on dynamic topics.\n" +
    "- High-Priority Visuals (Draw.io over SVG & Mermaid): When asked to generate diagrams, architecture, flowcharts, or system designs, DO NOT call `minimax_generate_image`. PRIORITIZE complete, standard Draw.io diagrams (`<mxfile>` XML format) inside ```drawio or ```xml code blocks so users can interact, edit, and export them directly. Fall back to standalone Editorial SVG or Mermaid only if explicitly requested.\n" +
    "- Draw.io XML Guidelines: Output clean, standard Draw.io XML containing `<mxfile><diagram><mxGraphModel>...`. Use proper orthogonal routing, hierarchical zones, distinct fill colors for components, and ensure XML attribute values are properly XML-escaped (e.g. `value=\"&lt;b&gt;Text&lt;/b&gt;\"`).\n" +
    "- Technical Poster & Dashboard Layout: For protocol state machines, complex pipelines, or multi-component architectures, adopt the Technical Poster Archetype: Top Hero Header with pill tags, main stage progression pipeline (1..N), comparison/packet matrix, and a dedicated right-side KPI/reference dark slate sidebar (`#0f172a`) for commands and facts.\n" +
    "- Skills Installation & Management: When a user asks to install, create, or import a skill (such as from GitHub, markdown, or custom instructions), DO NOT use `install_mcp_package` (which is only for long-lived MCP servers). Use fetch/search tools if needed to read the skill content, and then call `install_skill(skillName, content, scope)` to install the skill with valid YAML frontmatter (name, description, triggers) and markdown instructions directly into MiniBot.\n" +
    "- Image Generation: Only invoke `minimax_generate_image` when the user explicitly requests an artistic photo, illustration, drawing, or painting.\n" +
    "- Verification: Cross-check information from multiple snippets.\n" +
    "- Tool Transparency: Always clearly state what action you are taking."
  ),
  svgPrompt: z.string().optional().default(
    "### Diagram Generation Guidelines (Draw.io Priority):\n" +
    "1. Default Diagram Format: Draw.io XML inside ```drawio or ```xml blocks (`<mxfile host=\"Electron\" ...><diagram>...<mxGraphModel>...</mxGraphModel></diagram></mxfile>`).\n" +
    "2. Quality Protocols:\n" +
    "   - Always escape XML entities in text/attribute nodes (e.g. `&amp;`, `&lt;`, `&gt;`).\n" +
    "   - Provide clean grid alignment and distinct node colors for tiers.\n" +
    "   - If SVG is explicitly requested, output clean SVG in ```xml or ```svg code blocks with responsive viewBox."
  ),
});

export const LLMProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string().default("custom"),
  baseUrl: z.string().default("https://api.openai.com/v1"),
  apiKey: z.string().default(""),
  model: z.string().default("gpt-4o"),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().positive().optional().default(4096),
  description: z.string().optional(),
});

export const MCPServerDefSchema = z.object({
  type: z.enum(["stdio", "http", "streamable-http"]).default("stdio"),
  command: z.string().optional(),
  args: z.array(z.string()).default([]),
  url: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  strictSSL: z.boolean().default(false),
  transport: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().default(true),
  description: z.string().optional(),
});

export const LoopConfigSchema = z.object({
  llm: LLMConfigSchema,
  models: z.array(LLMProfileSchema).default([]),
  activeModelId: z.string().optional(),
  voice: VoiceConfigSchema.optional(),
  prompts: PromptsConfigSchema,
  mcpServers: z.record(z.string(), MCPServerDefSchema),
  maxLoopIterations: z.number().min(1).max(100).default(50),
});

export type LLMConfig = z.infer<typeof LLMConfigSchema>;
export type LLMProfile = z.infer<typeof LLMProfileSchema>;
export type VoiceConfig = z.infer<typeof VoiceConfigSchema>;
export type PromptsConfig = z.infer<typeof PromptsConfigSchema>;
export type MCPServerDef = z.infer<typeof MCPServerDefSchema>;
export type LoopConfig = z.infer<typeof LoopConfigSchema>;
