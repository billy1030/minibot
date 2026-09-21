---
name: archify
description: Create polished, validated architecture, workflow, sequence, data-flow, and lifecycle/state diagrams as explorable standalone HTML with inline SVG, dark/light themes, optional trace motion, and PNG/JPEG/WebP/SVG/WebM export. Accept plain-language requirements or pasted Mermaid flowchart, sequenceDiagram, and stateDiagram input; inspect repository evidence when the diagram must reflect real code. Use when the user asks to visualize system architecture, infrastructure, cloud/security/network topology, technical workflows, API call sequences, request lifecycles, data pipelines, ETL/ELT, data lineage, state machines, or to convert/beautify Mermaid.
license: MIT
metadata:
  version: "2.17"
  author: tt-a1i
  based_on: Cocoon-AI/architecture-diagram-generator (MIT, v1.0)
triggers:
  - archify
  - architecture diagram
  - cloud architecture
  - workflow diagram
  - sequence diagram
  - dataflow pipeline
  - lifecycle state diagram
  - convert mermaid
---

# Archify

Create a self-contained, interactive HTML diagram from a small typed JSON specification. Static output is the default; enable motion only when the user asks for a demo or presentation.

## Fast Authoring Path
Use this bounded path for ordinary generation:
1. **Choose Diagram Type:**
   - `architecture`: Systems, microservices, cloud infrastructure, trust boundaries.
   - `workflow`: Step-by-step processes, CI/CD pipelines, approval gates.
   - `sequence`: Request-response flows, API call chains, async message passing.
   - `dataflow`: Pipelines, ETL/ELT, source-transform-sink lineage.
   - `lifecycle`: State machines, transitions, error retries, terminal states.

2. **JSON Intermediate Representation (IR):**
   - Author a clean, typed JSON specification defining nodes, edges, grouping, and labels.
   - Set `meta.quality_profile` to `"showcase"`.
   - Keep one clear main path, short side branches, sparse labels, and <= 12 primary nodes.

3. **Validation & Quality Checks:**
   - Deterministic geometry checks: prevent line-node collisions, unmasked label cuts, and overlapping edges.
   - Ensure clear directional flow and distinct hierarchy.

4. **Standalone Delivery:**
   - Render into a self-contained HTML/SVG bundle with embedded dark/light styling, interactive semantic camera, relationship reach tracing, and export options (PNG, SVG).
