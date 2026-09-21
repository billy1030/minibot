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
    "- High-Priority Visuals (Editorial SVG over Mermaid): When asked to generate diagrams, architecture, flowcharts, or system designs, DO NOT call `minimax_generate_image`. PRIORITIZE standalone editorial SVG diagrams following the `diagram-design` skill over standard Mermaid charts. Provide clean Mermaid diagrams only if specifically requested.\n" +
    "- Technical Poster & Dashboard Layout: For protocol state machines, complex pipelines, or multi-component architectures, adopt the Technical Poster Archetype: Top Hero Header with pill tags, main stage progression pipeline (1..N), comparison/packet matrix, and a dedicated right-side KPI/reference dark slate sidebar (`#0f172a`) for commands and facts.\n" +
    "- Strict Arrow Positioning & Corridor Routing: For horizontal connectors, anchor points MUST be at the exact vertical midpoint (`y = card_y + height/2`). For multi-row wrapping (e.g. Stage 3 -> Stage 4), NEVER cut diagonally across middle cards; use an external right-side corridor or S-curve snake layout with >= 24px clearance from any intermediate card edges. All non-straight arrows MUST use rounded 90-degree orthogonal elbows (`r=8`). Labels MUST have opaque `<rect>` background badges with 4px padding.\n" +
    "- Canvas Bottom Safety Margin: ALWAYS add at least 60-80px vertical padding to viewBox height so footer notes and bottom alerts are never cut off by the canvas edge.\n" +
    "- Zero-Collision Zone Layout: When stacking vertical stages or cards (e.g. L1..L9) above a lower section (e.g. Zone D Matrix/Foundation), the lower section Y MUST be strictly calculated from the cumulative bottom of the upper stack: `lower_y >= stack_start_y + (num_cards * (card_height + gap)) + 40px`. NEVER hardcode an overlapping Y position that collides with the final card of the upper stack.\n" +
    "- SVG Diagram Geometry Quality: Apply dynamic canvas geometry: calculate viewBox height dynamically based on tier count (`140 + (tiers * 180) + 120`), or adaptively place the Legend in the header (`x=800..1300, y=35`) or as a right sidebar (`x=1120, width=240`) so it never collides with components. Strictly follow §6 connector rules: NEVER draw connector lines striking through text labels; always mask labels with an opaque `<rect>` matching the canvas background.\n" +
    "- Skills Installation & Management: When a user asks to install, create, or import a skill (such as from GitHub, markdown, or custom instructions), DO NOT use `install_mcp_package` (which is only for long-lived MCP servers). Use fetch/search tools if needed to read the skill content, and then call `install_skill(skillName, content, scope)` to install the skill with valid YAML frontmatter (name, description, triggers) and markdown instructions directly into MiniBot.\n" +
    "- Image Generation: Only invoke `minimax_generate_image` when the user explicitly requests an artistic photo, illustration, drawing, or painting.\n" +
    "- Verification: Cross-check information from multiple snippets.\n" +
    "- Tool Transparency: Always clearly state what action you are taking."
  ),
  svgPrompt: z.string().optional().default(
    "### Standalone Editorial SVG Generation & Color System Guidelines:\n" +
    "1. Palette & Theming (Default: Clean Light Minimalist):\n" +
    "   - Canvas Background: Pure White `#ffffff` or Soft Slate `#f8fafc` with crisp border `stroke=\"#e2e8f0\"`\n" +
    "   - Primary Accents: Ocean Blue `#2563eb`, Forest Emerald `#059669`, Royal Violet `#7c3aed`, Warm Amber `#d97706`, Crimson Red `#e11d48`\n" +
    "   - Neutral Card Containers: `#f8fafc` (cards), `#f1f5f9` (active highlights), `#ffffff` (sub-cards), `#e2e8f0` (border lines)\n" +
    "   - Typography: Title `#0f172a`, Body `#334155`, Subtitle/Labels `#64748b`, Muted Badges `#94a3b8`\n" +
    "2. Quality Protocols:\n" +
    "   - Always escape XML entities in text nodes: use `&amp;` instead of `&` (e.g., `lasers &amp; fiber`).\n" +
    "   - Explicit `viewBox` with ample height padding (+60px to 80px) to prevent bottom cutoff.\n" +
    "   - Output format: Wrap raw SVG in ```xml or ```svg code blocks without markdown wrapping."
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
