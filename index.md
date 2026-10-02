# loop-engg — 索引

> 簡介: **MiniBot** — 企業級自主聊天機器人,內建 **Model Context Protocol (MCP)** 支援與 **Tauri v2** 桌面應用,提供 OpenAI 相容 LLM(MiniMax、DeepSeek、OpenAI、Ollama、vLLM)的 ReAct 推理迴圈、工具執行、stateful 多輪記憶與文件分析能力。

## 目錄結構

| 名稱 | 類型 | 說明 |
| --- | --- | --- |
| `frontend/` | React 19 + Vite 8 SPA | 前端 chat UI、session browser、AlertModal、Markdown renderer |
| `src/` | Node.js + Express 後端 | ReAct orchestrator、MCP client manager、session persistence、CLI REPL |
| `src-tauri/` | Tauri v2 桌面應用核心 | Rust 入口與 IPC commands、Cargo.toml、tauri.conf.json |
| `tech-docs/` | 技術文件目錄 | 00~18 系列架構設計文件 (另含 README) |
| `config/` | 設定目錄 | 組態檔存放處 |
| `agent/` | Agent 實作目錄 | 自主代理程式碼 |
| `storage/` | 儲存目錄 | 對話紀錄與附件 |
| `workspace/` | Workspace 目錄 | 子對話樹資料夾層 |
| `logs/` | 對話記錄 | 自動儲存的 Markdown 對話 sessions (`YYYY-MM-DD_HH-mm-ss.md`) |
| `tools/` | 工具腳本目錄 | MCP 工具腳本 |
| `test/` | 測試目錄 | 測試程式碼 |
| `.planning/` | GSD 規劃目錄 | GSD roadmap / phase context |
| `.agents/` | Agent 設定目錄 | Agent skills 設定 |
| `.claude/` | Claude Code 設定 | 內含 skills (Vercel / React / Web design / Writing 等) |
| `.minibot/` | MiniBot 設定目錄 | mini-bot 自身的狀態目錄 |
| `dist/` | 編譯輸出 | frontend 編譯後資產 |
| `node_modules/` | 套件目錄 | npm 相依套件 (略) |

## 主要檔案

- `README.md` — 完整的 MiniBot 介紹、Quick Start、Tech Stack、專案結構、Technical Documentation Hub
- `package.json` — npm 相依與 scripts (`npm run dev`、`tauri:dev`、`tauri:build`、`cli`、`test`)
- `loop.config.json` — 模型設定、prompt 設定、active MCP servers
- `minibot.config.json` — MiniBot 主設定檔
- `AGENTS.md` — Agent 行為指引
- `startup.bat` / `startup.sh` — Windows / Unix 一鍵啟動腳本(Port 7009)
- `stop.bat` / `stop.ps1` — 停止腳本
- `build-tauri.bat` — Tauri 桌面建置腳本
- `skills-lock.json` — 鎖定的技能清單
- `patch_sls_subgraph.mjs` — SLS subgraph patch 腳本
- `test-bigfix.ts` — BigFix MCP 測試腳本
- `image_001.jpg` — README/doc 附圖
- `.env.example` — 環境變數範本 (`LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`、`PORT=7009`)

## 備註

- **Unified Port 7009** — 一鍵啟動對外統一 Port。
- **macOS 注意**:Port 7000 被 Apple AirPlay Receiver 佔用,可用 `PORT=7001 ./startup.sh` 切換。
- **ReAct loop**:`Thought ➜ Tool Call ➜ Observation ➜ Reflection`,有 `maxLoopIterations` 與 stream guard 保護。
- **MCP 內建伺服器**:DuckDuckGo web search + MiniMax multimodal (image、TTS、search)。
- **Tauri v2**:可打包成單檔 `.exe`、`.msi` 安裝檔,輸出在 `src-tauri/target/release/`。
- 本倉庫另發現 `.claude/skills/` 包含 `deploy-to-vercel`、`vercel-*`、`web-design-guidelines`、`writing-guidelines` 等本地技能(僅於此專案作用)。
- 為 clone-style 大型專案,有 18 篇詳細技術文件 (`tech-docs/`)。
