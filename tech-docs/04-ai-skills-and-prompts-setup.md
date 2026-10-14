# AI Skills Setup & Dynamic Injection Specification

## 1. Concept of "AI Skills"
In this architecture, an **AI Skill** is a structured markdown declaration that teaches the LLM:
1. When to invoke specific MCP tools.
2. How to validate inputs and format arguments.
3. What verification steps to take before declaring an answer final.
4. Error recovery workflows when external tools return failures (e.g., HTTP 403 / 401).

Unlike hardcoded programmatic logic, AI Skills allow prompt engineers to adjust agent behavior without restarting or recompiling the host application.

---

## 2. Ingestion Format & Configuration
Configured in `loop.config.json` or `.env`:
```json
{
  "prompts": {
    "systemPrompt": "You are an expert Loop Engineering Assistant...",
    "skillsPrompt": "## AI Skills & Protocols:\n- Web Search & Retrieval: When looking up current events, documentation, or technical information, use the `web_search` or `fetch_page` MCP tools.\n- Iterative Loop: Do not guess or hallucinate. Use tool calls to verify facts.\n- Summarization: Synthesize findings cleanly with markdown formatting."
  }
}
```

### Dynamic Injection Mechanism
In `src/engine/loop-orchestrator.ts`:
```typescript
const fullSystemPrompt = [
  this.config.prompts.systemPrompt,
  "\n--- Active AI Skills & Instructions ---\n",
  this.config.prompts.skillsPrompt,
].join("\n");

const messages = [
  { role: "system", content: fullSystemPrompt },
  { role: "user", content: userPrompt }
];
```

---

## 3. Integrating the MiniMax Multimodal Toolkit (`mmx-cli`)
We installed the official `minimax-multimodal-toolkit` skill located at:
`C:\Users\billy.kp.lam\.gemini\config\skills\minimax-multimodal-toolkit\SKILL.md`

### Command Mapping for Future MCP Extension
| Modality | CLI Command | Target MCP Tool Spec |
|---|---|---|
| **Web Search** | `mmx search query --query <str>` | `minimax_search(query)` |
| **Image Gen** | `mmx image generate --prompt <str>` | `generate_image(prompt, aspect_ratio)` |
| **Video Gen** | `mmx video generate --prompt <str>` | `generate_video(prompt, model)` |
| **Speech TTS** | `mmx speech synthesize --text <str>` | `synthesize_speech(text, voice)` |
| **Music Gen** | `mmx music generate --prompt <str>` | `generate_music(prompt, genre)` |

To enable these as MCP tools, an MCP wrapper server can execute `mmx` via child processes and return generated media URLs/paths back to the loop orchestrator.

---

## 4. Skills Configuration & Governance Matrix

MiniBot manages AI skills across multiple tiers ranging from runtime UI dialogs to project-level lockfiles and source schemas. The following matrix specifies each file's format, configuration method, and runtime behavior:

| Configuration File / Element | Format | Configurable Via | Live Runtime Edit? | Purpose & Configurable Attributes |
| :--- | :--- | :--- | :---: | :--- |
| **`minibot.config.json`** | **JSON** | • **JSON File** (direct edit)<br>• **On-Screen Web GUI** (Settings / Prompts Modal) | **Yes** (Immediate) | • `prompts.skillsPrompt`: Global behavioral rules, delegation triggers, OpenXML rules, and SVG geometry constraints.<br>• `prompts.systemPrompt`: Supervisor core identity.<br>• `mcpServers`: Enabled MCP backends. |
| **`AGENTS.md`** | **Markdown** | • **Markdown File** (workspace root)<br>• **On-Screen Web GUI** (Settings $\rightarrow$ Multi-Agent Rules tab) | **Yes** (Immediate via REST API) | • Mandatory delegation directives for supervisor.<br>• Sub-agent personas & toolkits (`coder`, `researcher`, `designer`, `reviewer`).<br>• Session sub-directory isolation & iteration budgets. |
| **`SKILL.md` (in `.agents/skills/*/`)** | **YAML + Markdown** | • **YAML Frontmatter + Markdown** (file edit)<br>• **On-Screen Web GUI** (Tools & Skills Hub $\rightarrow$ Inspect/Edit)<br>• **AI Meta-Tool** (`install_skill`) | **Yes** (On Demand) | • **YAML Frontmatter**: `name`, `description`, trigger keywords (`triggers`).<br>• **Markdown Body**: Step-by-step instructions, CLI workflows, design rules, and tool recipes. |
| **`skills-lock.json`** | **JSON** | • **JSON File** (system-managed or manual)<br>• **CLI / Tool** (`install_skill`) | **Yes** (Auto-updated) | • Tracks installed skills, their remote Git repository sources, skill file paths, and SHA-256 integrity hashes. |
| **`config/preset-prompts.json`** | **JSON** | • **JSON File** (direct edit)<br>• **On-Screen Web GUI** (Bottom Dock Bookmark 🔖 button $\rightarrow$ "Add New" / "Delete") | **Yes** (Saved directly from UI) | • Pre-configured quick prompt presets and skill invocations saved to local disk for one-click insertion. |
| **`src/config/schema.ts`** | **TypeScript** | • **Source Code File** (Compile-time) | **No** (Requires restart / build) | • Default fallback string for `skillsPrompt` if JSON config is missing.<br>• Zod schema validation rules and scope definitions (`workspace`, `user`, `global`). |
| **`frontend/src/components/ToolHubModal.tsx`** | **TSX (React)** | • **On-Screen Web GUI** (Click 🛠️ Tools & Skills Hub button in top bar) | **Yes** (Interactive UI) | • Interactive dashboard to view active skills, install new skills, inspect instructions, and toggle MCP tools. |
| **`frontend/src/App.tsx` (Slash Command Menu)** | **Interactive UI** | • **On-Screen Input** (Type `/` in chat input box) | **Yes** (Interactive Autocomplete) | • Selects and attaches a skill badge (e.g. `/docx`, `/diagram-design`) directly to the prompt turn. |

---

## 5. Skills Scoping & Resolution Order

Skills in MiniBot resolve hierarchically through three distinct scopes:
1. **`workspace` (`.agents/skills/`)**: Isolated strictly to the active workspace project.
2. **`user` (`config/users/<user_id>/skills/`)**: Available across all workspaces belonging to the authenticated user.
3. **`global` (`C:\Users\<user>\.gemini\config\skills/`)**: System-wide fallback available across all users and workspaces.

