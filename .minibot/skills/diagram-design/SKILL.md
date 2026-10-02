---
name: diagram-design
description: Create branded architecture, IT current-state, flowchart, sequence, state machine, ER/data model, timeline, swimlane, quadrant, radar/spider, polar chart (polar/radial lollipop), loop/flywheel, nested, tree, org chart, layer stack, Venn, pyramid/funnel, treemap, heatmap, bar, waterfall, line, Gantt and scatter charts, high-level, process, medallion, data flow, DP integration, DP security matrix, Sankey, fishbone, Wardley map, kanban, user journey, deployment, dependency graph, UML class, story map, or database schema diagrams as HTML/SVG/PNG, with .drawio and .excalidraw import support, plus lifecycle phase maps and onboarding guidance.
triggers:
  - diagram
  - architecture diagram
  - flowchart
  - sequence diagram
  - drawio
  - excalidraw
  - svg diagram
license: MIT
metadata:
  version: "2.6"
---

# Diagram Design

Create diagrams as self-contained HTML files with inline SVG and an editorial design system.

Forty-one visual types. Semantic patterns describe behavior; type references describe layout.

---

## 0. First-time setup — style guide gate

**Before generating your first diagram in a new project, verify the style guide has been customized.**

Do not silently ship default-skinned diagrams into a branded project.

First resolve any project `.diagram-design` marker per [`references/profiles.md`](references/profiles.md); a successfully resolved marker selects its profile and bypasses this gate. That reference owns failures, the protected default, and save behavior.

Open [`references/style-guide.md`](references/style-guide.md) and check the default tokens. If they are still the shipped defaults (paper `#f5f5f5`, ink `#2d3142`, accent `#eb6c36`), **pause and ask the user**:

> *"This is your first diagram in this project and the style guide is still default. Customize now? Options: (a) website URL, (b) installed skill, (c) local folder/design-system, (d) paste tokens, (e) keep default, (f) load saved profile."*

Then branch per the matching section of [`references/onboarding.md`](references/onboarding.md); for **(f)** follow [`references/profiles.md`](references/profiles.md).

**Once the style guide has been customized** (or the user explicitly chose default), skip this gate on later runs. A leading profile header names the copied-in active profile. Without a header, any semantic-role value or typography family differing from shipped defaults means **custom-unsaved**: skip the gate and offer to save it as a profile. All-default tokens with no marker/header trigger the gate.

After onboarding, offer to save as a named client profile per `references/profiles.md`.

---

## 1. Philosophy

**The highest-quality move is usually deletion.** Applied to schematics:
- Every node represents a distinct idea. Two nodes that always travel together are one node.
- Every connection carries information. If the relationship is obvious from layout, remove the line.
- Coral is **editorial, not a flag.** 1–2 focal nodes per diagram. Using it on 5 nodes erases the signal.
- The schematic isn't done when everything is added. It's done when nothing can be removed.

**Target density: 4/10.** Enough to be technically complete. Not so dense it needs a guide. Above 9 nodes, it's probably two diagrams.

---

## 2. When to Use

Use for any of the 41 visual types (§3) when a reader will learn more from a visual than from prose, a table, or a bulleted list.

**Don't use for:**
- Quick unicode diagrams → use **wiretext**.
- Lists of things → table or bullets.
- Simple before/after → table.
- One-shape "diagrams" → just write the sentence.

Before drawing, ask: *Would the reader learn more from this than from a well-written paragraph?* If no, don't draw.

---

## 3. Selection: semantic pattern, then visual type

When behavior, state, enforcement, or risk carries the meaning, first load [`references/semantic-patterns.md`](references/semantic-patterns.md) and choose one primary pattern. Then choose the nearest visual type for layout. If no pattern matches, choose the type directly.

| Behavioral trigger | Semantic pattern → nearest type |
|---|---|
| Fan-in, queue depth, backpressure, batching, push-back | **Chokepoint / Bottleneck** → [type-flowchart.md](references/type-flowchart.md), [type-high-level.md](references/type-high-level.md), or [type-swimlane.md](references/type-swimlane.md) |
| Auth, policy check, audit trap, admission control, firewall | **Gatekeeper / Boundary** → [type-flowchart.md](references/type-flowchart.md), [type-process.md](references/type-process.md), or [type-dp-security-matrix.md](references/type-dp-security-matrix.md) |
| Distributed race, circuit breaker, failover, quorum, split-brain | **Race & Partition** → [type-sequence.md](references/type-sequence.md) or [type-state-machine.md](references/type-state-machine.md) |
| Data-loss edge, rollback, dead-letter queue, poison pill | **Trapdoor & Escalation** → [type-flowchart.md](references/type-flowchart.md) or [type-state-machine.md](references/type-state-machine.md) |
| Cache invalidation, out-of-order delivery, drift, read-your-writes | **Drift & Invalidation** → [type-timeline.md](references/type-timeline.md) or [type-data-flow.md](references/type-data-flow.md) |
| Multi-hop latency, serial dependency, head-of-line blocking | **Critical Path** → [type-sequence.md](references/type-sequence.md) or [type-gantt.md](references/type-gantt.md) |
| Blast radius, cascade failure, shared dependency | **Blast Radius & Topology** → [type-dependency-graph.md](references/type-dependency-graph.md), [type-deployment.md](references/type-deployment.md), or [type-fishbone.md](references/type-fishbone.md) |

### Visual-type guide (41)

| What you want to show | Nearest type | Reference |
|---|---|---|
| Software, cloud, or system topology | **Architecture** | [type-architecture.md](references/type-architecture.md) |
| As-is enterprise / IT landscape | **IT current-state** | [type-it-current-state.md](references/type-it-current-state.md) |
| Decision tree or step-by-step logic | **Flowchart** | [type-flowchart.md](references/type-flowchart.md) |
| Time-ordered messages between systems | **Sequence** | [type-sequence.md](references/type-sequence.md) |
| States, transitions, and lifecycle events | **State machine** | [type-state-machine.md](references/type-state-machine.md) |
| Data models, tables, and relationships | **ER / data model** | [type-er-diagram.md](references/type-er-diagram.md) |
| Chronology, milestones, or roadmaps | **Timeline** | [type-timeline.md](references/type-timeline.md) |
| Cross-functional or team hand-offs | **Swimlane** | [type-swimlane.md](references/type-swimlane.md) |
| Two-axis trade-offs or categorization | **Quadrant** | [type-quadrant.md](references/type-quadrant.md) |
| Multi-variable profile comparison | **Radar / spider** | [type-radar.md](references/type-radar.md) |
| Cyclic comparisons, directional profiles, or cyclical time | **Polar chart (polar/radial lollipop)** | [type-polar-chart.md](references/type-polar-chart.md) |
| Reinforcing feedback or virtuous cycles | **Loop / flywheel** | [type-loop.md](references/type-loop.md) |
| Containment, scopes, or boundary groupings | **Nested** | [type-nested.md](references/type-nested.md) |
| Hierarchies, taxonomies, or drill-downs | **Tree** | [type-tree.md](references/type-tree.md) |
| Reporting lines or team structure | **Org chart** | [type-org-chart.md](references/type-org-chart.md) |
| Abstraction tiers or architectural tiers | **Layer stack** | [type-layer-stack.md](references/type-layer-stack.md) |
| Overlapping sets or intersections | **Venn** | [type-venn.md](references/type-venn.md) |
| Ranked hierarchy or conversion drop-off | **Pyramid / funnel** | [type-pyramid.md](references/type-pyramid.md) |
| Proportional part-to-whole hierarchies | **Treemap** | [type-treemap.md](references/type-treemap.md) |
| Dense two-dimensional intensity grids | **Heatmap** | [type-heatmap.md](references/type-heatmap.md) |
| Discrete quantity comparisons across categories | **Bar chart** | [type-bar-chart.md](references/type-bar-chart.md) |
| Sequential positive and negative step totals | **Waterfall** | [type-waterfall.md](references/type-waterfall.md) |
| Trends, trajectories, or continuous metric changes | **Line chart** | [type-line-chart.md](references/type-line-chart.md) |
| Schedules, dependencies, and phase tracking | **Gantt chart** | [type-gantt.md](references/type-gantt.md) |
| Correlation, clustering, or outlier distribution | **Scatter plot** | [type-scatter-plot.md](references/type-scatter-plot.md) |
| Executive summary or single-frame system overview | **High-level** | [type-high-level.md](references/type-high-level.md) |
| End-to-end operational flow or value stream | **Process** | [type-process.md](references/type-process.md) |
| Multi-stage lakehouse or data-readiness pipeline | **Medallion** | [type-medallion.md](references/type-medallion.md) |
| Movement, transformation, and storage of data | **Data flow** | [type-data-flow.md](references/type-data-flow.md) |
| Deep multi-system integration or data-platform pipes | **DP integration** | [type-dp-integration.md](references/type-dp-integration.md) |
| Cross-plane controls, RBAC, and policy matrix | **DP security matrix** | [type-dp-security-matrix.md](references/type-dp-security-matrix.md) |
| Volume transfers, cost allocations, or energy flows | **Sankey** | [type-sankey.md](references/type-sankey.md) |
| Root-cause analysis across categorized categories | **Fishbone** | [type-fishbone.md](references/type-fishbone.md) |
| Strategic positioning against evolution and visibility | **Wardley map** | [type-wardley-map.md](references/type-wardley-map.md) |
| Work-in-progress state tracking and stage limits | **Kanban** | [type-kanban.md](references/type-kanban.md) |
| Persona touchpoints, phases, emotions, and pain points | **User journey** | [type-user-journey.md](references/type-user-journey.md) |
| Physical, virtual, container, or cloud infra mapping | **Deployment** | [type-deployment.md](references/type-deployment.md) |
| Module, package, or build order directed graph | **Dependency graph** | [type-dependency-graph.md](references/type-dependency-graph.md) |
| Object-oriented class relationships and contracts | **UML class** | [type-uml-class.md](references/type-uml-class.md) |
| Backlog organization across goals, journeys, and sprints | **Story map** | [type-story-map.md](references/type-story-map.md) |
| Physical table structures, columns, and foreign keys | **Database schema** | [type-database-schema.md](references/type-database-schema.md) |

### Confirm before drawing

Before generating any diagram, state:
1. The **semantic pattern** (if applicable) and **visual type** chosen and why.
2. The **1–2 focal elements** (the "so what?").
3. What is being **deliberately excluded** to keep density at 4/10.

---

## 4. Universal Anti-patterns

- Never use pure black `#000000` or pure white `#ffffff` as fills without opacity.
- Never use default saturated primaries (e.g. standard browser `#ff0000` or `#0000ff`). Use curated tokens from the style guide.
- Never allow connectors to cross behind or through text without a background-colored shield / halo.
- Never draw lines with unrounded sharp 90-degree corners. Always apply `rx`, `ry`, or rounded elbow paths.
- Avoid centered multi-line text blocks. Left-align body copy; reserve center-alignment for single-line titles or badges.
- Avoid ambiguous arrow directions; label relationship lines when meaning isn't obvious.
- **NEVER allow inter-zone gap to be < 48px**: Major zones stacked vertically must maintain at least 48px to 64px clearance so connectors have at least 40px length and label badges have >= 14px space from receiving zone borders.
- **NEVER use cramped card heights**: Cards with title + badge + description require at least 76px to 92px height with >= 14px internal padding on all sides. Component grid gap inside containers must be >= 16px.
- **NEVER stack text with overlapping Y coordinates**: Always calculate explicit Y coordinates for each tier (Tag `y = top + 20` -> Title `y = tag_y + 24` -> Subtitle `y = title_bottom + 18` -> Body `y = subtitle_bottom + 16`). Every text line requires at least `fontSize + 6px` clearance.
- **NEVER place an overarching container header at the same horizontal coordinate as a child column title**: Top container titles belong in the header bar (`y=22..28`); columns and phase cards start below at `y >= 54`.
- **NEVER overflow horizontal multi-column cards**: In multi-step or roadmap banners, divide width into strict non-overlapping column bounds; wrap long titles with `<tspan dy="16">` or limit font sizes to prevent intrusion into adjacent columns.
- **NEVER occlude connector branch labels under floating cards**: Labels on connectors emerging from central bridge cards (e.g. "Math Defense", "Physics Defense") must sit outside card bounds with an opaque background badge.
- **NEVER leave XML tags unbalanced**: Every opened `<g>` must have an exact corresponding `</g>`.

---

## 5. Design System

Reference [`references/style-guide.md`](references/style-guide.md) for full tokens, typography hierarchies, and component styling rules. Always enforce:
- Clean SVG geometry
- Accessible contrast ratios (WCAG AA minimum for body copy)
- Scalable viewports (`viewBox` attribute with responsive CSS)
- Clear typography scale (Title > Subtitle > Label > Caption)

---

## 6. Core SVG Primitives

Use standard vector primitives:
- `<rect>` with `rx="6"` to `rx="12"` for rounded container cards.
- `<path>` with cubic bezier `C` or orthogonal arc commands for connectors.
- `<text>` elements with clean system font stacks (`system-ui, -apple-system, sans-serif`).
- High-contrast badges and pill chips for state and categorization indicators.

---

## 7. Importing & Exporting

Supports reading and converting diagrams from `.drawio`, Mermaid `.mmd`, and Excalidraw `.excalidraw` sources into polished editorial HTML/SVG/PNG outputs.
