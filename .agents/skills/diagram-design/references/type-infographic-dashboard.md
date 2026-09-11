# Infographic Dashboard & Lifecycle Poster (Executive Overview)

**Best for:** Comprehensive multi-stage journeys, full lifecycle architectural overviews, technical posters, historical corpus, complex DevOps pipelines, incident response chains, or domain taxonomy maps where the reader needs to grasp:
1. Chronological/Stage Progression (left/center flow with numbered badges `1`..`N`).
2. Rich Micro-Component Anatomy per stage (route/corridor strip, key bullet points, deliverable inset cards with tags).
3. Thematic Foundation / Core Matrix (anchoring the bottom).
4. Master Reference Taxonomy & High-Impact Metric KPI Cards (anchoring the right sidebar).

---

## 1. Canvas Layout & Four-Zone Geometry

```
+---------------------------------------------------------------------------------------------------------+
| ZONE A: HERO HEADER & PILL LEGEND                                                                       |
| [CATEGORY CHIP]  Title (H1) & Subtitle (H2)                       [● Stage 1] [● Stage 2] [● Stage 3]...|
+--------------------------------------------------------------------+------------------------------------+
| ZONE B: MAIN PROGRESSION STAGES (Left & Center, ~70% width)        | ZONE C: MASTER REFERENCE & KPIS    |
| +-----------------+  Transition  +-----------------+               | +--------------------------------+ |
| | (1) Stage Card  | ------------>| (2) Stage Card  |               | | REFERENCE TAXONOMY MANUAL      | |
| |  * Route Strip  |              |  * Route Strip  |               | |  - Categorized Sections        | |
| |  * Bullet Lists |              |  * Bullet Lists |               | +--------------------------------+ |
| |  * Inset Output |              |  * Inset Output |               | | KEY METRIC KPI TILES (2x2)     | |
| +-----------------+              +-----------------+               | | [16,000+ KM]   [13 CORPUS]     | |
|         |                                                          | | [7+ DOMAINS]   [~35 YEARS]     | |
|         v (Transition with Condition Badge)                        | +--------------------------------+ |
| +-----------------+              +-----------------+               | | EDITORIAL NOTE / FOOTNOTE BOX  | |
| | (4) Stage Card  |              | ZONE D: MATRIX  |               | |  * Important callout alerts    | |
| +-----------------+              | (4-Tier / 2x2)  |               | +--------------------------------+ |
+----------------------------------+-----------------+---------------+------------------------------------+
```

---

## 2. Token & Thematic Palette (Dark Executive Theme)

| Token Role | Color Hex | Purpose |
|---|---|---|
| `canvas-bg` | `#0b0f19` or `#0d1117` | Overall SVG canvas background |
| `card-bg` | `#111827` or `#151e2e` | Primary stage & sidebar card background |
| `card-border` | `#1f293d` or `#243048` | Subtle card borders (1px hairline) |
| `text-primary` | `#f8fafc` | Main titles, card headings, KPI big numbers |
| `text-secondary`| `#94a3b8` | Subtitles, body descriptions, bullet points |
| `text-muted` | `#64748b` | Eyebrow labels, dates, small metric titles |
| **Stage 1 (Blue)** | `#2563eb` (badge), `#38bdf8` (highlight), `rgba(56,189,248,0.2)` (border) |
| **Stage 2 (Green)**| `#059669` (badge), `#34d399` (highlight), `rgba(52,211,153,0.2)` (border) |
| **Stage 3 (Purple)**|`#7c3aed` (badge), `#c084fc` (highlight), `rgba(192,132,252,0.2)` (border) |
| **Stage 4 (Amber)**| `#d97706` (badge), `#fbbf24` (highlight), `rgba(251,191,36,0.2)` (border) |
| **Stage 5 (Rose)** | `#e11d48` (badge), `#f87171` (highlight), `rgba(248,113,113,0.2)` (border) |

---

## 3. Micro-Component SVG Construction

### A. Stage Card with Numbered Badge & Inset Container
```xml
<!-- Outer Stage Card -->
<rect x="50" y="120" width="310" height="380" rx="12" fill="#111827" stroke="#1f293d" stroke-width="1.5"/>

<!-- Numbered Circular Stage Badge (r=12) -->
<circle cx="75" cy="145" r="12" fill="#2563eb"/>
<text x="75" y="149" fill="#ffffff" font-size="12" font-weight="700" text-anchor="middle">1</text>
<text x="95" y="150" fill="#38bdf8" font-size="14" font-weight="700">第一階段：啟動與探索</text>
<text x="340" y="150" fill="#64748b" font-size="10" text-anchor="end">西元 46–49 年</text>

<!-- Route / Corridor Sequence Strip -->
<rect x="66" y="170" width="278" height="60" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
<text x="76" y="190" fill="#94a3b8" font-size="11">路線：安提阿 ➔ 塞浦路斯 ➔ 別加</text>
<text x="76" y="210" fill="#94a3b8" font-size="11">➔ 彼西底的安提阿 ➔ 回程</text>

<!-- Bullet Points -->
<circle cx="72" cy="250" r="3" fill="#38bdf8"/>
<text x="82" y="253" fill="#e2e8f0" font-size="11">開啟外邦宣教大門，建立多座教會</text>
<circle cx="72" cy="272" r="3" fill="#38bdf8"/>
<text x="82" y="275" fill="#e2e8f0" font-size="11">引發初代教會使徒會議討論</text>

<!-- Inset Deliverable Sub-Card -->
<rect x="66" y="310" width="278" height="90" rx="8" fill="rgba(37,99,235,0.06)" stroke="#2563eb" stroke-width="1.2"/>
<text x="78" y="332" fill="#93c5fd" font-size="12" font-weight="700">誕生著作：《加拉太書》 (Galatians)</text>
<text x="78" y="352" fill="#cbd5e1" font-size="10">核心宗旨：因信稱義，確立基督裡的自由</text>
<text x="78" y="375" fill="#38bdf8" font-size="10" font-family="monospace">#Christian_Liberty #Justification</text>
```

### B. Transition Arrow with Event Milestone Badge
```xml
<!-- Arrow with 90° smooth elbow and text badge -->
<path d="M 360 310 H 420" fill="none" stroke="#fbbf24" stroke-width="2" marker-end="url(#arrow-amber)"/>
<rect x="372" y="298" width="40" height="20" rx="4" fill="#0b0f19" stroke="#fbbf24" stroke-width="1"/>
<text x="392" y="312" fill="#fbbf24" font-size="9" text-anchor="middle">會議後</text>
```

### C. Right Master KPI Grid & Taxonomy Manual
```xml
<!-- Reference Manual Container -->
<rect x="1050" y="120" width="310" height="740" rx="14" fill="#111827" stroke="#1f293d" stroke-width="1.5"/>
<text x="1070" y="150" fill="#38bdf8" font-size="10" font-weight="700" letter-spacing="1">REFERENCE MANUAL</text>
<text x="1070" y="175" fill="#f8fafc" font-size="16" font-weight="700">體系分類全典</text>

<!-- 2x2 Metric KPI Tiles -->
<g transform="translate(1070, 540)">
  <!-- Tile 1 -->
  <rect x="0" y="0" width="130" height="60" rx="8" fill="#1e293b" stroke="#334155"/>
  <text x="12" y="20" fill="#64748b" font-size="9" font-weight="600">總宣教里程 (概算)</text>
  <text x="12" y="45" fill="#38bdf8" font-size="18" font-weight="800">16,000+ <tspan font-size="10">KM</tspan></text>

  <!-- Tile 2 -->
  <rect x="140" y="0" width="130" height="60" rx="8" fill="#1e293b" stroke="#334155"/>
  <text x="152" y="20" fill="#64748b" font-size="9" font-weight="600">正典書信卷數</text>
  <text x="152" y="45" fill="#fbbf24" font-size="18" font-weight="800">13 <tspan font-size="10">EPISTLES</tspan></text>
</g>
```
