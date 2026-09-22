# 21. Multi-Agent Orchestration & Sub-Agent Execution Architecture

## 1. Executive Summary & Problem Statement

MiniBot was originally designed around an autonomous **Single-Loop ReAct Engine** (`LoopOrchestrator`), where an LLM repeatedly performs:
$$\text{Thought} \rightarrow \text{Tool Action} \rightarrow \text{Observation} \rightarrow \text{Next Step / Final Answer}$$

While this single-loop architecture is simple, powerful, and robust for focused operations, it introduces severe bottlenecks when tackling complex, cross-domain engineering tasks:

1. **Context Bloat & Token Degradation (Observation Bloat)**:
   - When fetching multi-page search results, parsing 500-row spreadsheets, or querying BigFix endpoint inventories, raw observations fill the linear `messages[]` history.
   - Large context degrades LLM attention, causing the agent to lose sight of the original system prompt, guidelines, and user constraints ("Lost-in-the-Middle" phenomenon).
2. **System Prompt & Role Congestion (Instruction Drift)**:
   - Packing SVG geometry directives, BigFix operational commands, Python UV sandbox rules, and doc parsers into a single system prompt causes competing behavioral directives.
3. **Tool Hallucination & Latency**:
   - Presenting 20+ tools across different domains simultaneously increases the probability of selecting inappropriate tools and introduces latency on each LLM completion round.
4. **Lack of Parallel Execution**:
   - A single ReAct loop executes actions sequentially, preventing concurrent research and code execution.

To solve these architectural bottlenecks without breaking existing MCP integration, MiniBot adopts the **Agent-as-a-Tool (Supervisor-Worker) Multi-Agent Architecture**.

---

## 2. Architectural Design: Agent-as-a-Tool

The chosen multi-agent paradigm encapsulates specialized sub-agents into callable tool primitives: `delegate_task(role, taskInstruction, contextSnippet, toolsWhitelist)`.

```
                            +-----------------------------+
                            |       User Interaction      |
                            |   (Web UI / SSE / Terminal) |
                            +-----------------------------+
                                           |
                                           v
             +------------------------------------------------------------+
             |                 Supervisor / Main Agent                    |
             |  - Manages full user session & high-level conversation     |
             |  - Synthesizes user requirements & orchestrates sub-tasks   |
             |  - Tools: delegate_task, ask_user, fallback general tools  |
             +------------------------------------------------------------+
                                           |
                              (Invokes delegate_task)
                                           |
                +--------------------------+--------------------------+
                |                                                     |
                v                                                     v
+-------------------------------+             +-------------------------------+
|  Sub-Agent: Researcher        |             |  Sub-Agent: Coder / Engineer  |
|  - Role: Information Retrieval|             |  - Role: Code Execution & Ops |
|  - Dedicated System Prompt    |             |  - Dedicated System Prompt    |
|  - Tools: web_search, fetch   |             |  - Tools: run_python_code,    |
|  - Isolated Message History   |             |           bigfix, fs tools    |
|  - Bounded Iterations (max: 8)|             |  - Bounded Iterations (max: 12)|
+-------------------------------+             +-------------------------------+
                |                                                     |
                +--------------------------+--------------------------+
                                           |
                               (Returns Clean Summary)
                                           v
             +------------------------------------------------------------+
             |             Main Agent History (Context Preserved)         |
             |  Role: tool                                                |
             |  Content: [Researcher Sub-Agent Output]:                   |
             |           Key findings summarized in 3 bullet points...    |
             +------------------------------------------------------------+
```

---

## 3. Sub-Agent Lifecycle & Execution Protocol

### 3.1 Sub-Agent Roles & Specialized Personas

| Sub-Agent Role | Primary Responsibility | Dedicated Tool White-list | Guardrail (Max Iterations) |
|---|---|---|---|
| `researcher` | Fact-checking, deep web browsing, document reading, summarization | `web_search`, `fetch_page`, `download_remote_file`, `read_office_document` | 8 |
| `coder` | Data calculation, script execution, file manipulation, unit testing | `run_python_code`, `create_excel_spreadsheet`, `read_office_document` | 12 |
| `designer` | Technical architecture posters, SVG vector layout, diagrammatic state machines | Pure generation, no execution tools needed | 4 |
| `reviewer` | Quality assurance, code review, verification against prompt requirements | Document/file reading tools, web_search | 5 |
| `general` | General sub-tasks with non-delegation toolset | All MCP tools (except `delegate_task`) | 8 |

### 3.2 Context Isolation & Observation Hygiene
When a sub-agent executes:
1. It is assigned a **brand-new `messages[]` array** seeded only with:
   - Specialized System Prompt for its target role.
   - Optional `contextSnippet` passed explicitly by the Supervisor.
   - User query/instruction for this specific sub-task.
2. During its private ReAct loop, it can trigger multiple tool calls and consume tens of thousands of tokens of raw observation logs.
3. Upon completion, only its **final synthesized response** is stringified and returned to the Supervisor as the `tool_result`.
4. **Outcome**: The Supervisor's context window remains compact, noise-free, and laser-focused on high-level orchestration.

---

## 4. Multi-Agent Communication Models in MCP

While the MCP protocol is inherently client-server, MiniBot supports sub-agent communication through two complementary patterns:

### Pattern A: Hierarchical Routing (Synchronous Delegation via Supervisor)
- **Mechanism**: Sub-Agent A returns its output to the Supervisor. The Supervisor then supplies that output as `contextSnippet` to Sub-Agent B.
- **Advantage**: Zero extra infrastructure required; full traceability; Supervisor maintains guardrails and prevents conversational deadlocks.

### Pattern B: Shared Blackboard / Workspace File Bus (Asynchronous State Sharing)
- **Mechanism**: All sub-agents share access to the conversation workspace directory (`workspace/<user>/<conversation>/`).
- **Data Flow**:
  - `researcher` downloads or generates raw data into `workspace/data_input.json`.
  - `coder` reads `workspace/data_input.json`, executes Python data analysis via UV, and emits `workspace/chart.png` and `workspace/result.xlsx`.
  - `designer` inspects numerical outputs and generates vector SVG infographics.
- **Advantage**: Eliminates passing huge binary or tabular data through LLM token context windows.

---

## 5. Event Streaming & Telemetry (SSE Multi-Agent Hierarchy)

To provide complete transparency in the Web UI, Server-Sent Events (SSE) are augmented with sub-agent provenance metadata:

```json
// Event: subagent_start
{
  "event": "subagent_start",
  "data": {
    "agentId": "subagent-coder-9842",
    "role": "coder",
    "parentStep": 2,
    "instruction": "Execute Python script to aggregate BigFix patch compliance statistics"
  }
}

// Event: subagent_tool_call
{
  "event": "subagent_tool_call",
  "data": {
    "agentId": "subagent-coder-9842",
    "role": "coder",
    "toolName": "run_python_code",
    "args": { "dependencies": ["pandas", "matplotlib"] }
  }
}

// Event: subagent_complete
{
  "event": "subagent_complete",
  "data": {
    "agentId": "subagent-coder-9842",
    "role": "coder",
    "iterations": 3,
    "summary": "Compliance aggregated successfully. Output saved to workspace/compliance.xlsx"
  }
}
```

---

## 6. Safety Guardrails & Recursion Prevention

To prevent catastrophic token runaway or recursive agent spawning:
1. **Depth Restriction**: Maximum recursion depth is strictly capped at `depth = 1`. Sub-agents **cannot** invoke `delegate_task`.
2. **Per-Agent Iteration Budgets**: Each sub-agent is constrained by strict role-based iteration ceilings (4 to 12 iterations).
3. **Execution Timeout**: Each sub-agent run has a hard abort timeout (default: 60 seconds).
4. **Graceful Fallback**: If a sub-agent hits its iteration ceiling or encounters an error, its partial output is preserved and surfaced to the Supervisor with a `[Sub-Agent Warning]` prefix.
