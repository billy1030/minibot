# Project State

## Current Position
- **Project**: Loop Engineering Chatbot Protocol (with MCP Integration)
- **Status**: Phase 2 Completed (Stateful Memory & Context Window Management Live)
- **Active Milestone**: v1.0.0 (Prototype)

## Completed Phases
- **Phase 1: Core Loop Protocol Engine & MCP Client Setup** [COMPLETED]
  - Config Schema (`loop.config.json`, `.env`, zod validation)
  - MCP Client Manager (`@modelcontextprotocol/sdk` stdio integration)
  - Built-in Web Search & Fetch MCP Server (`web_search`, `fetch_page`)
  - OpenAI-compatible adapter (`/v1/chat/completions` function calling)
  - ReAct Loop Orchestrator (`loop-orchestrator.ts`)
  - Interactive CLI runner & REPL (`npm run cli`)

- **Phase 2: Stateful Memory for LLM & Context Windows Management** [COMPLETED]
  - Multi-turn conversation history injection (`LoopOrchestrator.run(prompt, callbacks, history)`)
  - Session Persistence via Markdown logs (`logs/YYYY-MM-DD_HH-mm-ss.md`)
  - History session list & parser APIs (`GET /api/logs`, `GET /api/logs/:filename`)
  - Frontend Web UI "+ New Chat" button and "Past Sessions" browser
  - Token and character count estimation metrics in chat bubble footers

## Next Phase
- **Phase 5: Dynamic Agentic Tool & Skill Hub (Self-Equipping Agent)** [COMPLETED - Tasks 1-5 Implemented & Verified]
  - Task 1: Hot-reloadable MCP client manager (`registerServerDynamically`, `unregisterServer`).
  - Task 2: Self-equipping meta-tools (`search_available_tools`, `install_mcp_package`, `list_active_tools`, `download_remote_file`, `read_office_document`, `create_excel_spreadsheet`).
  - Task 3: Dual-scope Skill Store (`global` and per-`workspace` in `.minibot/skills` & `logs/[user]/[workspace]/.skills/`) with dynamic frontmatter parsing and prompt injection.
  - Task 4: REST APIs & Server Events (`GET/POST /api/tools/install`, `DELETE /api/tools/:name`, `GET/POST/DELETE /api/skills`, real-time SSE dynamic tool/skill broadcast).
  - Task 5: Tools & Skills Hub modal with GUI Form vs Raw JSON Paste mode switch, skill deletion, 82vw wide layout, and removal of duplicate MCP configuration in AI settings.

