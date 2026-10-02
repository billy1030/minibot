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
    "- High-Priority Visuals (Editorial SVG over Mermaid): When asked to generate diagrams, architecture, flowcharts, or system designs, DO NOT call `minimax_generate_image`. PRIORITIZE standalone editorial SVG diagrams following the `diagram-design` skill over standard Mermaid charts. Provide clean Draw.io (<mxfile>) or Mermaid diagrams only if specifically requested.\n" +
    "- Technical Poster & Dashboard Layout: For protocol state machines, complex pipelines, or multi-component architectures, adopt the Technical Poster Archetype: Top Hero Header with pill tags, main stage progression pipeline (1..N), comparison/packet matrix, and a dedicated right-side KPI/reference dark slate sidebar (`#0f172a`) for commands and facts.\n" +
    "- Strict Arrow Positioning & Corridor Routing: For horizontal connectors, anchor points MUST be at the exact vertical midpoint (`y = card_y + height/2`). For multi-row wrapping (e.g. Stage 3 -> Stage 4), NEVER cut diagonally across middle cards; use an external right-side corridor or S-curve snake layout with >= 24px clearance from any intermediate card edges. All non-straight arrows MUST use rounded 90-degree orthogonal elbows (`r=8`). Labels MUST have opaque `<rect>` background badges with 4px padding.\n" +
    "- Canvas Bottom Safety Margin: ALWAYS add at least 60-80px vertical padding to viewBox height so footer notes and bottom alerts are never cut off by the canvas edge.\n" +
    "- Zero-Collision Zone Layout: When stacking vertical stages or cards (e.g. L1..L9) above a lower section (e.g. Zone D Matrix/Foundation), the lower section Y MUST be strictly calculated from the cumulative bottom of the upper stack: `lower_y >= stack_start_y + (num_cards * (card_height + gap)) + 40px`. NEVER hardcode an overlapping Y position that collides with the final card of the upper stack.\n" +
    "- SVG Diagram Geometry Quality: Apply dynamic canvas geometry: calculate viewBox height dynamically based on tier count (`140 + (tiers * 180) + 120`), or adaptively place the Legend in the header (`x=800..1300, y=35`) or as a right sidebar (`x=1120, width=240`) so it never collides with components. Strictly follow §6 connector rules: NEVER draw connector lines striking through text labels; always mask labels with an opaque `<rect>` matching the canvas background.\n" +
    "- Skills Scope Selection & Management: Skills in MiniBot have three distinct scopes:\n" +
    "  1. 'workspace': Isolated strictly to the current workspace.\n" +
    "  2. 'user': Available across all workspaces belonging to the current user.\n" +
    "  3. 'global': Available system-wide to all users and workspaces.\n" +
    "  MANDATORY RULE FOR ADDING SKILLS: When a user asks to install, create, or import a skill, DO NOT blindly default to 'global' or 'workspace'. If the user has not explicitly specified which scope they want ('workspace', 'user', or 'global'), YOU MUST ASK THE USER to choose their preferred scope first, briefly explaining the 3 options. Once confirmed (or if explicitly specified in the query), call `install_skill(skillName, content, scope)` with valid YAML frontmatter (name, description, triggers) and markdown instructions.\n" +
    "  REVERTING / MOVING SKILLS: If the user asks to change, move, or revert an existing skill's scope (e.g. 'move this skill to workspace' or 'revert skill X to global'), call `change_skill_scope(skillName, targetScope)` to update it immediately.\n" +
    "- Image Generation: Only invoke `minimax_generate_image` when the user explicitly requests an artistic photo, illustration, drawing, or painting.\n" +
    "- Verification: Cross-check information from multiple snippets.\n" +
    "- Tool Transparency: Always clearly state what action you are taking."
  ),
  svgPrompt: z.string().optional().default(
    "### Standalone Editorial SVG Generation & Typography Collision-Free Guidelines:\n" +
    "1. Palette & Theming (Default: Clean Light Minimalist):\n" +
    "   - Canvas Background: Pure White `#ffffff` or Soft Slate `#f8fafc` with crisp border `stroke=\"#e2e8f0\"`\n" +
    "   - Primary Accents: Ocean Blue `#2563eb`, Forest Emerald `#059669`, Royal Violet `#7c3aed`, Warm Amber `#d97706`, Crimson Red `#e11d48`\n" +
    "   - Neutral Card Containers: `#f8fafc` (cards), `#f1f5f9` (active highlights), `#ffffff` (sub-cards), `#e2e8f0` (border lines)\n" +
    "   - Typography: Title `#0f172a`, Body `#334155`, Subtitle/Labels `#64748b`, Muted Badges `#94a3b8`\n" +
    "2. Inline Key-Value & Bullet Lists (NO SPLIT X COORDINATES - CRITICAL):\n" +
    "   - In single-line bullet points or key-value entries (e.g. \"• Hardware Footprint: Runs on existing silicon\"): NEVER split label and value into separate `<text>` tags with guessed X offsets.\n" +
    "   - Always use a SINGLE `<text>` element with inline `<tspan font-weight=\"600\">Hardware Footprint:</tspan> Runs on existing silicon...` so the browser's layout engine automatically flows text without crashing words together.\n" +
    "   - If creating a formal two-column table, Column 2 MUST start at `x2 >= x1 + max_label_width + 16px` (allow at least 160px for technical labels).\n" +
    "3. XML Entity Safety & Bullets (NEVER USE &bull;):\n" +
    "   - Standard XML does NOT support HTML named entities. NEVER use `&bull;`, `&nbsp;`, `&copy;`, or `&mdash;` in SVG.\n" +
    "   - For bullets, use literal UTF-8 bullet `•` or numeric entity `&#8226;`.\n" +
    "   - For middle separators, use literal `·` or `&#183;`.\n" +
    "   - For standard escaping, ONLY use: `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`.\n" +
    "4. Inter-Zone Breathing Room & Vertical Clearance (NEVER TOO CLOSE):\n" +
    "   - When stacking major zones (e.g. Zone 01 -> Defense Pillars -> Zone 02), the vertical gap between adjacent zone borders MUST be at least 48px to 64px (NEVER <= 30px).\n" +
    "   - Inter-zone flow connectors require a minimum length of 40px so connector label badges (`height=20px`) have at least 10px clear stroke visible both above and below the badge.\n" +
    "   - Connector labels MUST NOT touch or graze the top border of the receiving zone or pillar (maintain >= 14px clearance).\n" +
    "5. Container Inset Padding & Card Grid Spacing:\n" +
    "   - In multi-component containers (e.g. Pillar A / Pillar B), inner component cards MUST start at `y_container + 48px` (24px for Zone title + 24px buffer).\n" +
    "   - Leave at least 20px horizontal padding between container borders and inner cards.\n" +
    "   - Component Grid Gap: Keep at least 16px horizontal and 16px vertical gap between component cards.\n" +
    "6. Card Height & Vertical Rhythm:\n" +
    "   - Do NOT use cramped fixed heights (< 65px) for cards containing title + badge + description:\n" +
    "     * Single-line title card: `min-height = 56px`.\n" +
    "     * Title + Subtitle card: `min-height = 76px`.\n" +
    "     * Title + 2-line Subtitle / Spec card: `min-height = 92px`.\n" +
    "   - Internal card padding MUST be at least 14px on all sides. Tag badge to title horizontal/vertical clearance MUST be >= 10px.\n" +
    "7. Strict Text Hierarchy & Collision-Free Stacking:\n" +
    "   - Inside any container or card, calculate explicit Y coordinates for each tier: Tag Badge `y = top + 20` -> Title `y = tag_y + 24` -> Subtitle `y = title_bottom + 18` -> Description `y = subtitle_bottom + 16`. Each line MUST have at least `fontSize + 6px` clearance. NEVER reuse identical or overlapping Y coordinates.\n" +
    "   - No Dual-Anchor Overlap: Never render an overarching container title and a child phase title at the same horizontal coordinate range. Container headers belong at `y=22..28`; column contents start below at `y >= 54`.\n" +
    "8. Horizontal Multi-Column Banners & Roadmaps:\n" +
    "   - Divide available width into strict disjoint column slots: `x_col(i) = x0 + i * (col_width + col_gap)`.\n" +
    "   - Column text MUST NEVER exceed `col_width - 16px`. Truncate or wrap multi-line text into explicit `<tspan dy=\"16\">` tags.\n" +
    "9. Central Bridge Cards & Connector Stride:\n" +
    "   - Every connector exiting a component MUST run straight for at least 16px before turning or hosting a label badge.\n" +
    "   - Branch connector labels (e.g. \"Math Defense\", \"Physics Defense\") MUST sit outside the card bounds on horizontal connector runs, with an opaque background badge `<rect fill=\"#ffffff\" rx=\"3\"/>`.\n" +
    "   - Never let labels overlap card borders or connector corners.\n" +
    "10. XML & Tag Integrity:\n" +
    "   - Every `<g>` MUST have an exact closing `</g>`. Keep tag depth strictly balanced.\n" +
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
