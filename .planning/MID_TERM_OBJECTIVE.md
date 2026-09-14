# MiniBot Mid-Term Strategic Roadmap (v1.2 - v2.0)
**Theme: From ReAct Assistant to Self-Evolving Autonomous Agentic Platform**

---

## 1. Executive Summary & Vision

MiniBot started as an interactive LLM chat interface with static MCP tool integration (Web Search, BigFix, TTS).
The **Mid-Term Objective** is to graduate MiniBot into a **production-grade, autonomous, self-evolving AI engineering agent**:
1. **Self-Equipping & Dynamic**: Capable of discovering, downloading, and hot-swapping tools & skills from registries mid-conversation.
2. **Multi-Agent Orchestration & Sub-Task Delegation**: Spawning specialized subagents (researcher, coder, verifier) working in parallel.
3. **Long-Term Episodic Memory & Knowledge Graph**: Moving beyond single-session logs to cross-session associative memory and project graphs.
4. **Autonomous Sandboxed Execution & HITL Guardrails**: Running downloaded code and system commands safely with human-in-the-loop approvals.

---

## 2. Milestone Architecture (The 4 Pillars)

```
┌────────────────────────────────────────────────────────────────────────┐
│                      MiniBot 2.0 Autonomous Agent                      │
├────────────────────────────────┬───────────────────────────────────────┤
│ Pillar 1: Dynamic Hub          │ Pillar 2: Multi-Agent Hierarchy       │
│ • Hot-Reload MCP Servers       │ • Lead Orchestrator (Boss Agent)      │
│ • Self-Equipping Meta Tools    │ • Subagents (Researcher, Coder, UAT)  │
│ • Skill Library (SKILL.md)     │ • Parallel Execution & Map-Reduce     │
├────────────────────────────────┼───────────────────────────────────────┤
│ Pillar 3: Sandboxing & Safety  │ Pillar 4: Long-Term Episodic Memory   │
│ • Isolated Worker Sandbox      │ • SQLite / Vector Knowledge Base      │
│ • HITL (Human-in-the-loop) UI  │ • Dynamic Skill RAG & Context Pruning │
│ • Command & URL Whitelisting   │ • Cross-Session Learning Extraction   │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

## 3. Phased Mid-Term Milestones

### Milestone 1 (Immediate Next): Self-Equipping Dynamic Tool & Skill Hub
* **Objective**: MiniBot can dynamically extend its own capabilities on the fly without server restarts.
* **Key Deliverables**:
  - **Dynamic MCP Client Manager**: Hot registration, unregistration, and reloading of stdio & remote SSE tools.
  - **Self-Equipping Meta-Tools**: `search_available_tools`, `install_mcp_package`, `list_active_tools`, and `install_skill`.
  - **Skill Store (`.minibot/skills/`)**: Markdown-based skill instructions with frontmatter and dynamic injection.
  - **Frontend Tool & Skill Hub**: UI drawer to manage, inspect, and toggle active MCP servers and installed skills.

### Milestone 2: Sandboxing, Security & Human-in-the-Loop (HITL)
* **Objective**: Ensure self-installed tools and code executions are secure and controlled.
* **Key Deliverables**:
  - **Safe Command Runner**: Sandbox runtime for untrusted npm/python packages (isolated sub-processes, timeout guards).
  - **Interactive HITL Approval**: When an agent attempts sensitive actions (installing external packages, running bash commands, deleting files), the UI displays an interactive confirmation toast/modal with `[Approve] / [Reject]`.
  - **Permission Scopes**: Per-tool permission policies (read-only vs. execute vs. network).

### Milestone 3: Hierarchical Multi-Agent Orchestration
* **Objective**: Enable complex, long-running engineering workflows by decomposing tasks into parallel subagents.
* **Key Deliverables**:
  - **Subagent Dispatching (`spawn_subagent`)**: Primary agent delegates independent sub-tasks (e.g. background research or code analysis).
  - **Background Task Management**: Ability to run long-running background tasks with progress callbacks and reactive wake-ups.
  - **Multi-Agent UI Visualizer**: Visual graph/tree in the frontend showing active subagents, their current thought steps, and aggregated results.

### Milestone 4: Persistent Episodic Memory & Knowledge Graph
* **Objective**: MiniBot remembers past debugging sessions, user preferences, and project architecture across sessions.
* **Key Deliverables**:
  - **Episodic Memory Database**: Embedded SQLite/Vector store indexing historical decisions, errors, and solutions.
  - **Selective Skill & Doc Retrieval (Skill RAG)**: Rather than stuffing the entire system prompt with dozens of skills, dynamically retrieve only relevant skills based on user intent.
  - **Auto-Learning Extraction**: After completing a task, summarize key patterns, configurations, or lessons learned into the agent's memory bank.

---

## 4. Key Performance Indicators (KPIs) for Mid-Term Success
1. **Autonomous Tool Discovery Rate**: Agent successfully identifies a missing tool, downloads the MCP server, and solves the user prompt in a single session with zero human code intervention.
2. **System Stability**: 0 server restarts required when adding or updating tools.
3. **Safety Zero-Day**: 0 unauthorized command or network access attempts slipping through the HITL gate.
4. **Context Efficiency**: System prompt token overhead reduced by >50% via dynamic skill routing compared to static monolithic prompts.
