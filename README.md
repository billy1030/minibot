# MiniBot - Autonomous Chatbot with Model Context Protocol (MCP) & Tauri Desktop

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node](https://img.shields.io/badge/Node.js-20%2B%20%7C%2026%20ESM-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19.2-cyan.svg)](https://react.dev)
[![Port](https://img.shields.io/badge/Unified%20Port-7009-orange.svg)](http://localhost:7009)
[![Desktop](https://img.shields.io/badge/Desktop-Tauri%20v2-24C8D8.svg)](https://tauri.app)
[![Protocol](https://img.shields.io/badge/Protocol-Model%20Context%20Protocol%20(MCP)-blueviolet.svg)](https://modelcontextprotocol.io)

**MiniBot** is an enterprise-grade, iterative autonomous chatbot that equips OpenAI-compatible Large Language Models (MiniMax, DeepSeek, OpenAI, Ollama, vLLM) with autonomous reasoning, tool execution, stateful multi-turn memory, and document analysis via the **Model Context Protocol (MCP)**. It runs both as a **unified local web application** and as a **lightweight standalone desktop application powered by Tauri v2**.

When a standard LLM lacks real-time facts or external abilities, it enters an autonomous **ReAct cycle** (`Thought ➜ Tool Call ➜ Observation ➜ Reflection`), recursively looping until the task is complete.

---

## 🌟 Key Features

- **Cross-Platform One-Click Launchers (`startup.bat` & `startup.sh`)**:
  - Windows: Automated batch launcher with PowerShell port management and browser launching.
  - macOS / Linux: Executable Bash launcher (`./startup.sh`) with auto-dependency check, frontend compilation, and AirPlay Receiver port detection.
- **Stateful Multi-Turn Memory & Context Continuity**:
  - Automatically carries full conversational context across turns so the assistant remembers constraints, figures, and past conclusions.
  - Zero-latency runtime memory in React 19 + Node.js with asynchronous persistence.
- **Automatic Markdown Session Logging (`logs/*.md`)**:
  - Automatically saves every complete conversation as `YYYY-MM-DD_HH-mm-ss.md`.
  - Captures full metadata, iteration counts, parameters, and MCP tool observations.
- **Interactive Web UI & Session Browser**:
  - Clean day-themed modern UI built with React 19, TypeScript, and Vite 8.
  - **`+ New Chat`** button to reset conversational memory at any time.
  - **`PAST SESSIONS`** sidebar drawer to reload, resume, and delete past conversations.
  - **SLS-Style Alert Prompt & Confirmation System**: Replaced intrusive browser native `alert()`/`confirm()` with frosted dark backdrop modals (`AlertModal.tsx`) featuring customized status headers (Success, Warning, Error, Info) and structured confirmation dialogs.
  - **Live Editable MCP Servers Registry JSON**: Config modal features a responsive JSON editor with live syntax checking and instant hot-reloading.
  - **Collapsible Bottom Active Model Accordion**: Compact 38px footer showing the active model and tool count, expanding to reveal tool schemas on demand.
  - Live collapsible tool execution cards with real-time SSE event streaming.
- **Dynamic Model Context Protocol (MCP) Host Client**:
  - Discovers tools from local or remote servers via stdio / JSON-RPC 2.0 and streamable-HTTP.
  - Translates MCP schemas into OpenAI tool specifications dynamically.
  - Resilient connection lifecycle with connection timeout (5000ms) to prevent server hangs.
- **Built-in Resilient Search MCP Server**:
  - Zero-API-key DuckDuckGo search (`web_search`) with automatic **MiniMax API fallback**.
  - Web page scraper (`fetch_page`) with **GitHub blob-to-raw URL rewriting** to bypass HTTP 429 rate limits.
- **MiniMax Multimodal MCP Server**:
  - Seamless bridge to `mmx-cli` for image generation, speech synthesis, and search.
- **Safety Guardrails**:
  - Configurable iteration limits (`maxLoopIterations`), socket timeouts, stream guards (`!res.writableEnded`), and token estimation metrics.

---

## 🚀 Quick Start

### 1. Launch via Script (Recommended)

#### On macOS / Linux:
```bash
./startup.sh
```
> [!NOTE]
> On macOS, port `7000` is reserved by Apple **AirPlay Receiver (`ControlCenter`)**.
> You can toggle AirPlay Receiver off in **System Settings ➔ General ➔ AirDrop & AirPlay**, or easily run on an alternate port:
> ```bash
> PORT=7001 ./startup.sh
> ```

#### On Windows:
Double-click `startup.bat` or run in CMD:
```cmd
startup.bat
```

---

### 2. Manual Startup

#### Install Dependencies & Build Frontend
```bash
npm install
cd frontend && npm install && npm run build && cd ..
```

#### Configure Environment & Model
Create `.env` (or let the app resolve `MINIMAX_API_KEY` directly from your shell environment):
```ini
LLM_BASE_URL=https://api.minimaxi.com/v1
LLM_API_KEY=your-api-key-here
LLM_MODEL=MiniMax-M3
PORT=7009
```

#### Launch Web Server
```bash
PORT=7009 npx tsx src/server.ts
```
Then open your browser to **[http://localhost:7009](http://localhost:7009)**.

---

### 3. Run or Build Desktop App (Tauri v2)

#### Run in Desktop Mode:
```bash
npm run tauri:dev
```

#### Build Standalone Desktop Executable:
```bash
npm run tauri:build
```
The standalone `.exe` and `.msi` installers will be generated under `src-tauri/target/release/`.

---

### 3. Interactive Terminal CLI
You can also interact directly from your terminal:
```bash
npm run cli
```
Or execute a one-shot query:
```bash
npx tsx src/cli/index.ts --query "Search for 2026 enterprise PKI migration best practices"
```

---

## 📚 Technical Documentation (`tech-docs/`)

Comprehensive architecture specifications, engineering post-mortems, and protocols are documented in the [`tech-docs/`](./tech-docs/) directory:

| Document | Description |
| :--- | :--- |
| **[01. Architecture & Loop Protocol](./tech-docs/01-architecture-and-protocol.md)** | ReAct state machine, Mermaid diagrams, SSE streaming event specifications. |
| **[02. MCP Integration & Schema Translation](./tech-docs/02-mcp-integration-guide.md)** | `@modelcontextprotocol/sdk` mechanics, tool translation, stdio IPC transport. |
| **[03. Technical Challenges & Solutions](./tech-docs/03-technical-challenges-and-solutions.md)** | Infinite loop guardrails, observation bloat, port conflicts, and stream resilience. |
| **[04. AI Skills & Prompts Setup](./tech-docs/04-ai-skills-and-prompts-setup.md)** | System prompts and AI skill ingestion for runtime capability expansion. |
| **[05. Agentic Looping & Self-Correction Case Study](./tech-docs/discussion.md)** | Real-world autopsy of tool failure, autonomous query refinement, and multi-MCP failover. |
| **[06. Technology Stack Specification](./tech-docs/06-technology-stack.md)** | Detailed breakdown of Node 26, React 19, Vite 8, Express 5, and MCP dependencies. |
| **[07. Conversation Memory & State Continuity](./tech-docs/07-conversation-memory-and-state.md)** | In-Memory vs. File persistence trade-offs, multi-turn state continuity, and token management. |
| **[08. UI/UX & Session Management Specification](./tech-docs/08-ui-ux-and-session-management.md)** | Web UI layout, collapsible sidebar, SLS-style alert modals, and token estimation badges. |
| **[09. Multi-MCP Extensibility & Skills Prompt Patterns](./tech-docs/09-multi-mcp-and-skills-prompt-patterns.md)** | Multi-server MCP architectures, dynamic registry, and safety protocols. |
| **[10. BigFix Enterprise MCP Integration](./tech-docs/10-bigfix-enterprise-mcp-integration.md)** | Streamable-HTTP remote MCP server integration with timeout resilience. |
| **[11. Standalone HTML Export Engine](./tech-docs/11-html-export-engine.md)** | Client-side standalone offline HTML report generator with Mermaid rendering. |
| **[12. Workspace & Sub-Conversation Tree Architecture](./tech-docs/12-workspace-and-conversation-tree-architecture.md)** | Zero-database disk hierarchy, folder-based workspaces, recursive multi-tier fork tree. |
| **[13. Multi-User System, Folder Isolation & 2FA](./tech-docs/13-multi-user-system-and-2fa-architecture.md)** | Enterprise multi-tenant isolation, Scrypt hashing, RFC 6238 TOTP 2FA, emergency recovery codes. |
| **[14. Outlook Interface Design Architecture](./tech-docs/14-outlook-interface-design-architecture.md)** | Native Segoe UI design tokens, layout hierarchy, and inline editing data grids. |
| **[15. Cross-Platform Session Deletion & Performance](./tech-docs/15-cross-platform-session-deletion-and-performance.md)** | WebKit vs. Chromium DOM teardown, Happy Eyeballs fallback, dual-stack IPv4/IPv6, parallel sync. |
| **[16. Security Hardening, SSRF Defense & HSTS](./tech-docs/16-security-hardening-and-ssrf-defense.md)** | HTTP security headers, HSTS, dynamic CORS origin verification, SSRF defense, and route auth. |
| **[17. Voice Recognition & Copy-Paste Ergonomics](./tech-docs/17-voice-recognition-and-copy-paste-ergonomics.md)** | Web Speech API STT (Cantonese/Mandarin/English), floating status pill, copy output/code/thought buttons. |

---

## 📂 Project Structure

```text
minibot/
├── .planning/                  # GSD roadmap, phase context, and execution plans
├── frontend/                   # React 19 + TypeScript + Vite 8 SPA (Day Theme)
│   ├── src/
│   │   ├── components/         # AlertModal, Markdown renderer, modal inspectors
│   │   ├── App.tsx             # Main chat UI, sidebar, editable MCP registry, model panel
│   │   └── index.css           # Vanilla CSS design tokens (Outlook/Day Theme) + animations
├── logs/                       # Auto-saved Markdown conversation sessions (YYYY-MM-DD_HH-mm-ss.md)
├── src-tauri/                  # Tauri v2 Rust Desktop App Core
│   ├── src/                    # Rust entrypoint and IPC commands
│   ├── Cargo.toml              # Tauri v2 Rust dependencies
│   └── tauri.conf.json         # Desktop window, security & build configuration
├── src/
│   ├── cli/                    # Interactive terminal REPL
│   ├── config/                 # Zod configuration schemas & loader
│   ├── engine/                 # ReAct Loop Orchestrator with multi-turn history injection
│   ├── logger/                 # Markdown conversation persistence & session parser
│   ├── mcp/                    # MCP Client Manager, BigFix client & Tool registry
│   │   └── servers/            # Built-in WebSearch and MiniMax MCP servers
│   └── server.ts               # Express 5 backend with SSE streaming on Port 7009
├── tech-docs/                  # In-depth technical architecture documentation
├── loop.config.json            # Model settings, prompt configs, and active MCP servers
├── startup.bat                 # Windows one-click launcher (Port 7009)
├── startup.sh                  # macOS / Linux one-click launcher (Port 7009)
└── package.json
```

---

## 🧪 Running Tests
```bash
npm test
```
