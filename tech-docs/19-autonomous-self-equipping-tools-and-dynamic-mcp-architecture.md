# 19. Autonomous Self-Equipping Tools, Dynamic MCP Hot-Reloading & Document Processing Architecture

## 1. Executive Summary

Traditional AI chat interfaces are bound to a static, compile-time set of tools. If a user asks to query a local SQLite database, scrape a client-rendered SPA, or extract data from a remote Excel workbook, the LLM must fail or ask the developer to install software and restart the backend.

**MiniBot Phase 5** breaks this limitation by introducing a **Self-Equipping Autonomous Architecture**:
1. **Live MCP Hot-Reloading**: Mount and unmount stdio (`npx`, `python`, `node`) and remote SSE servers without restarting the Node.js server.
2. **Autonomous Meta-Tools**: Gives the LLM first-class meta-tools (`search_available_tools`, `install_mcp_package`, `list_active_tools`) to discover and equip itself with new tools mid-conversation.
3. **Autonomous Document Handling**: Built-in in-process tools to download remote documents (`download_remote_file`), parse Word/PDF/Excel files (`read_office_document`), and generate spreadsheets (`create_excel_spreadsheet`).
4. **Agentic Tools & Skills Hub UI**: A desktop drawer allowing users to visually inspect active tools, monitor server connections, and manually hot-register new MCP packages.

---

## 2. Architecture & Execution Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                          User Query / Request                          │
│        "Download the sales report from https://... and parse it"       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        LoopOrchestrator Protocol                       │
│    (Evaluates `mcpManager.getOpenAITools()` freshly on every turn)     │
└───────────────┬────────────────────────────────────────┬───────────────┘
                │ Missing Tool?                          │ Has Tool?
                ▼                                        ▼
┌───────────────────────────────┐        ┌───────────────────────────────┐
│     Meta-Tool Invocation      │        │      Tool Execution Step      │
│  - `search_available_tools`   │        │  - `download_remote_file`     │
│  - `install_mcp_package`      │        │  - `read_office_document`     │
│  - `list_active_tools`        │        │  - `create_excel_spreadsheet` │
└───────────────┬───────────────┘        └───────────────┬───────────────┘
                │                                        │
                ▼                                        ▼
┌───────────────────────────────┐        ┌───────────────────────────────┐
│    Dynamic Hot-Registration   │        │     Structured Observation    │
│  - Stdio / Remote Transport   │        │   - Clean Markdown Tables     │
│  - Tool Cache Invalidation    │        │   - Saved Filepath            │
│  - Persist `dynamic-mcp.json` │        └───────────────┬───────────────┘
└───────────────┬───────────────┘                        │
                │                                        │
                └──────────► Next Turn Iteration ◄───────┘
                     (Newly installed tool is now
                     in OpenAI function definition)
```

---

## 3. Core Component Design

### 3.1 Dynamic MCP Client Manager (`src/mcp/client-manager.ts`)
Previously, `initialize()` connected to servers once at startup. If a server was added, the entire Node process had to be rebooted.
We added:
- **`registerServerDynamically(serverName, def)`**:
  - Automatically unregisters any existing connection under `serverName`.
  - Determines transport (`stdio` via `StdioClientTransport` or remote HTTP via `BigFixStreamableHttpClient`).
  - Connects, discovers tools, and adds them to `this.tools`.
  - Re-evaluates tool list immediately.
- **`unregisterServer(serverName)`**:
  - Closes transports cleanly.
  - Drops all associated tools from the tool lookup map.
- **Per-Iteration Tool Fetching in `LoopOrchestrator`**:
  - In `loop-orchestrator.ts`, `const tools = this.mcpManager.getOpenAITools()` is moved **inside** the `while (iteration < maxIterations)` loop.
  - This guarantees that if tool installation occurs in Iteration 1, the LLM receives the new OpenAI function schemas in Iteration 2!

### 3.2 Curated Meta-Tools & Package Registry (`src/mcp/meta-tools.ts`)
The LLM has access to a curated catalog of high-reputation MCP packages:
- `sqlite`: `@modelcontextprotocol/server-sqlite`
- `memory`: `@modelcontextprotocol/server-memory`
- `filesystem`: `@modelcontextprotocol/server-filesystem`
- `github`: `@modelcontextprotocol/server-github`
- `puppeteer`: `@modelcontextprotocol/server-puppeteer`
- `postgres`: `@modelcontextprotocol/server-postgres`
- `fetch`: `@modelcontextprotocol/server-fetch`

#### Security Whitelist Guard
To prevent arbitrary remote code execution, `installMcpPackage()` enforces strict executable whitelisting:
```typescript
const allowedCommands = ["npx", "node", "uvx", "python", "bun", "bunx"];
```
Only safe package runners are permitted. Any attempt to invoke raw shell commands or unauthorized binaries (`cmd.exe`, `powershell`, `bash`, `rm`) is rejected before execution.

---

## 4. Autonomous Document Handling Engine (`src/mcp/inprocess-tools.ts`)

To allow MiniBot to autonomously download, inspect, and generate Office documents, three new in-process tools were implemented:

| Tool | Purpose | Key Parameters | Output |
|---|---|---|---|
| `download_remote_file` | Downloads remote file to `storage/downloads/` with SSRF defense | `url`, `customFileName` | Downloaded path + automatic preview snippet |
| `read_office_document` | Extracts Word (`.docx`), PDF (`.pdf`), or Excel (`.xlsx`, `.csv`) | `filePath` | Structured Markdown tables and text |
| `create_excel_spreadsheet` | Generates multi-tab Excel workbooks | `fileName`, `sheets` (2D arrays) | Path to saved `.xlsx` file |

### Security Guardrails: SSRF & Timeout Protection
`download_remote_file` applies the exact same SSRF filter as `fetch_page`:
- Rejects protocols other than `http:` and `https:`.
- Blocks private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`, `localhost`, `0.0.0.0`).
- Imposes an explicit 30-second `AbortSignal` timeout to prevent hanging sockets.

---

## 5. Web UI: Tools & Skills Hub Modal (`frontend/src/components/ToolHubModal.tsx`)

A dedicated button in the top navigation bar with a live tool counter badge (`🛠️ 27`) provides visual control over the agent's toolbox:
- **Active Servers & Capabilities Tab**:
  - Displays all registered servers (e.g. `web-search`, `minimax-multimodal`, `bigfix`, plus any dynamic servers).
  - Lists all tool names and descriptions.
  - One-click **Remove** button to unmount dynamic servers.
- **Add / Connect MCP Server Tab**:
  - UI form supporting both `stdio` (Command + Args) and `url` (Remote SSE/HTTP).
  - One-click **Connect & Hot-Reload** with real-time feedback banner.

---

## 6. End-to-End Verification Scenarios

### Scenario A: Autonomous Document Download & Analysis
1. **User**: *"Download the sales report from `https://my-site.com/q3.xlsx` and summarize it."*
2. **Turn 1**: LLM calls `download_remote_file(url="https://my-site.com/q3.xlsx")`.
3. **Observation**: File saved to `storage/downloads/q3.xlsx` + preview snippet.
4. **Turn 2**: LLM calls `read_office_document(filePath="storage/downloads/q3.xlsx")`.
5. **Observation**: Formatted Markdown table containing APAC, EMEA, and Americas revenue.
6. **Turn 3**: LLM synthesizes findings and outputs final analysis.

### Scenario B: Dynamic Tool Discovery & Installation
1. **User**: *"Query our local sqlite database `analytics.db`."*
2. **Turn 1**: LLM detects lack of SQLite capability and calls `search_available_tools(query="sqlite")`.
3. **Observation**: Registry returns `@modelcontextprotocol/server-sqlite` with available tools (`read_query`, `write_query`).
4. **Turn 2**: LLM calls `install_mcp_package(serverName="sqlite", packageOrCommand="npx", args=["-y", "@modelcontextprotocol/server-sqlite", "--db-path", "analytics.db"])`.
5. **Observation**: Server mounted, tools `read_query`, `write_query`, `list_tables` available!
6. **Turn 3**: LLM immediately calls `read_query("SELECT * FROM events LIMIT 10")` in the next iteration.
7. **Turn 4**: LLM presents final query results to the user.
