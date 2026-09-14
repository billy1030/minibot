# Phase 5 Plan: Dynamic Agentic Tool & Skill Hub (Self-Equipping Agent)

## Goal
Enable MiniBot to autonomously discover, download, install, and execute tools (MCP servers) and skills (markdown instruction recipes) from the internet and use them dynamically within the active conversation loop without requiring backend restarts.

---

## Architecture Overview

```
                          ┌───────────────────────────┐
                          │   MiniBot User Request    │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │     LoopOrchestrator      │
                          └──────┬─────────────▲──────┘
                                 │             │
                    Need tool or skill?        │ Returns result &
                                 │             │ updates active tools
                                 ▼             │
             ┌──────────────────────────────────────────────────┐
             │       MiniBot Agentic Meta-Tool Layer            │
             ├─────────────────────────┬────────────────────────┤
             │  Dynamic MCP Installer  │  Skill Registry Engine │
             │  - install_mcp_package  │  - install_skill       │
             │  - search_mcp_registry  │  - match_skills_rag    │
             │  - test_mcp_connection  │  - load_skill_markdown │
             └─────────────┬───────────┴───────────▲────────────┘
                           │                       │
                           ▼                       ▼
            ┌────────────────────────────┐ ┌────────────────────┐
            │ Dynamic Config & Sandboxing│ │ Local Skill Store  │
            │  `config/dynamic-mcp.json` │ │ `.minibot/skills/` │
            └────────────────────────────┘ └────────────────────┘
```

---

## Detailed Task Breakdown

### Task 1: MCP Client Manager Dynamic Hot-Reloading
- **Files**: `src/mcp/client-manager.ts`
- **Key Deliverables**:
  - Implement `registerServerDynamically(name: string, config: MCPServerConfig): Promise<{ success: boolean; toolsAdded: string[] }>`
  - Implement `unregisterServer(name: string): Promise<boolean>`
  - Implement `reloadServer(name: string): Promise<boolean>`
  - Dynamic tool schema cache invalidation: ensure `getOpenAITools()` updates immediately so the active LLM turn can call newly mounted tools without restarting.
  - Safe persistence: Write dynamically added tools to `config/dynamic-mcp.json` so they persist across server restarts.

### Task 2: Self-Equipping Meta-Tools (`inprocess-tools.ts`)
- **Files**: `src/mcp/inprocess-tools.ts`, `src/engine/loop-orchestrator.ts`
- **Key Deliverables**:
  - Expose in-process tools to the LLM:
    1. `search_available_tools(query: string)`: Searches registry / curated list of popular MCP servers (e.g. filesystem, sqlite, github, puppeteer, weather, memory, postgres).
    2. `install_mcp_package(serverName: string, packageOrCommand: string, args: string[], env?: Record<string, string>)`:
       - Executes installation or directly configures `npx -y <package>`.
       - Registers with `MCPClientManager`.
       - Returns the newly available tools directly to the agent.
    3. `list_active_tools()`: Returns all currently mounted MCP tools and their descriptions.
    4. `install_skill(skillName: string, content: string)`: Saves a new workflow recipe into the skill library.
  - Test immediate chaining: LLM receives a prompt requiring a tool it does not have -> LLM invokes `install_mcp_package` -> tool is mounted -> next iteration invokes the newly mounted tool!

### Task 3: Dynamic Skill Store & Semantic Injector
- **Files**: `src/skills/skill-manager.ts`, `src/server.ts`
- **Key Deliverables**:
  - Directory `.minibot/skills/` (and scanning `.agents/skills/`).
  - Read standard `SKILL.md` files (frontmatter + trigger description + prompt instructions).
  - Inject skills on-demand into `LoopOrchestrator` system prompt instead of bloating system prompt with all skills at once.

### Task 4: REST API Endpoints & Server Events
- **Files**: `src/server.ts`
- **Key Deliverables**:
  - `GET /api/tools`: List all active tools grouped by server (with dynamic indicator).
  - `POST /api/tools/install`: Endpoint to install/test an MCP server or skill.
  - `DELETE /api/tools/:serverName`: Remove an installed server.
  - Server-Sent Events (SSE) notification when a tool is dynamically installed mid-loop so the frontend updates in real time.

### Task 5: Frontend Tool & Skill Hub Drawer
- **Files**: `frontend/src/components/ToolHubModal.tsx`, `frontend/src/App.tsx`
- **Key Deliverables**:
  - Floating/Header button: "Tools & Skills Hub" (with active tool count badge).
  - Modal/Drawer showing:
    - **Active MCP Servers**: Green status indicator, list of functions, reload/remove button.
    - **Skill Library**: View/preview skill recipes, toggle on/off.
    - **One-Click Install / Add Custom Server**: Input for package name (e.g., `@modelcontextprotocol/server-sqlite`) with live test button.

### Task 6: Safety, Validation & HITL (Human-in-the-Loop)
- **Key Deliverables**:
  - Safe command execution: Whitelist / validation on binary commands (npx, uvx, bunx, node, python).
  - Optional user-consent prompt/flag in `minibot.config.json` (`autoApproveToolInstall: true/false`).
  - Graceful fallback: If an install fails (e.g. network timeout or invalid package), return descriptive error to LLM so it can recover or inform the user.

---

## Verification Plan

### 1. Programmatic Integration Tests
- Verify `registerServerDynamically` with a lightweight stdio server (e.g. SQLite or Memory MCP).
- Confirm tool count increases and `getOpenAITools()` includes new schemas.
- Unregister and verify tools are cleanly removed.

### 2. Autonomous End-to-End ReAct Test
- Prompt MiniBot with a goal it cannot accomplish with default tools (e.g. "Create and query a local sqlite database file test.db to store users").
- Observe the autonomous loop:
  1. Iteration 1: MiniBot calls `install_mcp_package` for `@modelcontextprotocol/server-sqlite`.
  2. Iteration 2: Tool is registered, MiniBot calls `query` or `execute` from sqlite.
  3. Iteration 3: MiniBot returns the completed result.

### 3. UI Manual Verification
- Open [http://localhost:7009](http://localhost:7009), click Tool Hub, verify all 21 tools and active servers are visible.
- Add an MCP server through the UI form and observe live registration.
