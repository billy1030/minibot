/**
 * Generates a standalone, beautiful, self-contained HTML document
 * with robust, deterministic SVG/Mermaid rendering architecture:
 *
 * Architecture principles:
 * 1. SVG renders directly in the DOM (isolated from Markdown parsing flaws).
 * 2. Standalone SVG diagrams render 100% offline without Mermaid or external CDNs.
 * 3. Mermaid failure does not break the document or SVG diagrams (non-fatal, visible error card + source).
 * 4. Preserves SVG viewBox, aspect ratio, <defs>, <symbol>, <use>, gradients, and filters.
 * 5. Automatic safe ID namespacing for multiple SVGs to prevent ID collision.
 * 6. Avoids getBBox() as a rendering dependency (safe fallback).
 * 7. Sizing controlled predictably by viewBox and responsive flex container.
 * 8. Comprehensive post-render SVG validation layer with diagnostic logging.
 * 9. Retains Dark/Light mode, Print/PDF, zoom/pan controls, and smart text wrapping.
 */
export function generateStandaloneExportHtml(markdownContent: string, title: string = "Mini Chat Bot Export"): string {
  const encoded = encodeURIComponent(markdownContent);

  return `<!DOCTYPE html>
<html lang="zh-HK" class="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Noto+Sans+TC:wght@300;400;500;700;900&family=Roboto:wght@400;500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/marked@12.0.0/marked.min.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"><\/script>
  <style>
    :root {
      --bg: #f8fafc;
      --card: #ffffff;
      --text: #0f172a;
      --muted: #64748b;
      --border: #e2e8f0;
      --accent: #0284c7;
      --accent2: #4f46e5;
      --accent-glow: rgba(2, 132, 199, 0.12);
      --code-bg: #0f172a;
      --code-fg: #f8fafc;
    }
    html.dark {
      --bg: #020617;
      --card: #0f172a;
      --text: #f8fafc;
      --muted: #94a3b8;
      --border: #334155;
      --accent: #38bdf8;
      --accent2: #818cf8;
      --accent-glow: rgba(56, 189, 248, 0.15);
      --code-bg: #000000;
      --code-fg: #e2e8f0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Roboto', 'Noto Sans TC', system-ui, -apple-system, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.75;
      padding-bottom: 5rem;
      transition: background-color 0.2s, color 0.2s;
    }
    .header-banner {
      background: var(--card);
      border-bottom: 1px solid var(--border);
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 50;
      backdrop-filter: blur(12px);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-size: 1.1rem;
      color: var(--accent);
    }
    .main {
      max-width: 980px;
      margin: 0 auto;
      padding: 2.5rem 2rem;
      background: var(--card);
      margin-top: 2rem;
      border-radius: 16px;
      border: 1px solid var(--border);
      box-shadow: 0 4px 20px rgba(0,0,0,0.04);
    }
    .markdown-body h1 {
      font-size: 1.85rem;
      font-weight: 800;
      margin: 1.8rem 0 0.9rem;
      border-bottom: 2px solid var(--border);
      padding-bottom: 0.5rem;
      color: var(--text);
    }
    .markdown-body h2 {
      font-size: 1.4rem;
      font-weight: 700;
      margin: 1.8rem 0 0.8rem;
      color: var(--accent);
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.3rem;
    }
    .markdown-body h3 {
      font-size: 1.15rem;
      font-weight: 600;
      margin: 1.4rem 0 0.6rem;
    }
    .markdown-body p { margin-bottom: 1rem; }
    .markdown-body ul, .markdown-body ol {
      padding-left: 1.5rem;
      margin-bottom: 1rem;
    }
    .markdown-body li { margin-bottom: 0.35rem; }
    .markdown-body blockquote {
      border-left: 4px solid var(--accent);
      padding: 0.8rem 1.2rem;
      background: var(--accent-glow);
      border-radius: 0 8px 8px 0;
      margin: 1.2rem 0;
      color: var(--text);
    }
    .markdown-body code {
      font-family: 'Fira Code', monospace;
      font-size: 0.87em;
      background: var(--accent-glow);
      color: var(--accent);
      padding: 0.15em 0.4em;
      border-radius: 4px;
    }
    .markdown-body pre {
      background: var(--code-bg);
      color: var(--code-fg);
      padding: 1.2rem;
      border-radius: 10px;
      margin: 1.5rem 0;
      overflow-x: auto;
    }
    .markdown-body pre code {
      background: none;
      color: inherit;
      padding: 0;
      font-size: 0.88rem;
      line-height: 1.6;
    }
    .markdown-body table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
      font-size: 0.9rem;
    }
    .markdown-body th, .markdown-body td {
      border: 1px solid var(--border);
      padding: 0.65rem 1rem;
      text-align: left;
    }
    .markdown-body th {
      background: var(--bg);
      font-weight: 700;
    }
    .markdown-body tr:nth-child(even) {
      background: var(--accent-glow);
    }
    .markdown-body details.think-block {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin: 1.2rem 0;
      padding: 0.6rem 1rem;
      font-size: 0.88rem;
    }
    .markdown-body details.think-block summary {
      cursor: pointer;
      font-weight: 600;
      color: var(--muted);
      user-select: none;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .markdown-body details.think-block summary:hover {
      color: var(--accent);
    }
    .markdown-body details.think-block .think-content {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px dashed var(--border);
      color: var(--muted);
      font-style: italic;
      line-height: 1.6;
    }

    /* ==================== Diagram Containers (SVG & Mermaid) ==================== */
    .svg-diagram-wrapper,
    .mermaid-wrapper {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      margin: 1.8rem 0;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.04);
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    html.dark .svg-diagram-wrapper,
    html.dark .mermaid-wrapper {
      background: #0f172a;
      border-color: #334155;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
    }

    .diagram-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0.75rem;
      background: #f8fafc;
      border-bottom: 1px solid var(--border);
      font-size: 0.75rem;
    }
    html.dark .diagram-topbar {
      background: #0f172a;
      border-bottom-color: #334155;
    }
    .diagram-topbar-title {
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--accent);
    }
    .diagram-tools-group {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .diag-btn {
      background: var(--card);
      border: 1px solid var(--border);
      padding: 0.25rem 0.55rem;
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 700;
      cursor: pointer;
      color: var(--text);
      transition: all 0.15s;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-family: inherit;
    }
    .diag-btn:hover {
      background: rgba(2,132,199,0.1);
      color: var(--accent);
      border-color: var(--accent);
    }
    .diag-btn.active {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }

    .diagram-code-panel {
      display: none;
      padding: 0.85rem;
      background: #0f172a;
      color: #e2e8f0;
      border-bottom: 1px solid #1e293b;
      font-family: 'Fira Code', monospace;
      font-size: 0.78rem;
      max-height: 250px;
      overflow-y: auto;
    }
    .diagram-code-panel.visible { display: block; }

    /* Natural, predictable viewport model */
    .diagram-viewport {
      width: 100%;
      overflow: auto;
      padding: 16px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: grab;
      user-select: none;
      box-sizing: border-box;
      background: var(--card);
      min-height: 120px;
    }
    html.dark .diagram-viewport {
      background: #0f172a;
    }
    .diagram-viewport:active { cursor: grabbing; }

    /* SVG natural sizing: governed by intrinsic geometry and viewBox */
    .diagram-viewport svg {
      display: block;
      width: 100%;
      height: auto;
      max-width: 100%;
      transition: transform 0.12s ease-out;
      transform-origin: center center;
    }
    .diagram-viewport svg.tall-diagram {
      max-height: 520px;
      width: auto;
      margin: 0 auto;
    }

    /* foreignObject safety */
    .diagram-viewport svg foreignObject {
      overflow: visible !important;
    }
    .diagram-viewport svg .node foreignObject>div,
    .diagram-viewport svg .nodeLabel,
    .diagram-viewport svg .label {
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
      line-height: 1.2 !important;
      font-size: 13.5px !important;
      font-weight: 500 !important;
      letter-spacing: 0.025em !important;
      white-space: normal !important;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
      max-width: 260px !important;
      padding: 0 !important;
      margin: 0 !important;
      height: 100% !important;
      box-sizing: border-box !important;
    }
    .diagram-viewport svg .node foreignObject p,
    .diagram-viewport svg .node foreignObject span {
      margin: 0 !important;
      padding: 0 !important;
      line-height: 1.2 !important;
      font-size: 13.5px !important;
      letter-spacing: 0.025em !important;
    }
    .diagram-viewport svg .node rect {
      rx: 8px !important;
      ry: 8px !important;
    }
    .diagram-viewport svg text {
      font-weight: 500 !important;
      font-family: 'Roboto', 'Noto Sans TC', system-ui, sans-serif !important;
      letter-spacing: 0.025em !important;
    }
    .diagram-viewport svg .cluster rect {
      fill: #f8fafc !important;
      stroke: #93c5fd !important;
      stroke-width: 1.5px !important;
      rx: 10px !important;
      ry: 10px !important;
    }
    html.dark .diagram-viewport svg .cluster rect {
      fill: #0f172a !important;
      stroke: #38bdf8 !important;
    }

    /* Error card */
    .diagram-error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
      padding: 1rem 1.2rem;
      border-radius: 8px;
      font-size: 0.88rem;
      width: 100%;
      margin: 0.5rem 0;
    }
    html.dark .diagram-error {
      background: #450a0a;
      border-color: #7f1d1d;
      color: #fecaca;
    }
    .diagram-error details {
      margin-top: 0.6rem;
    }
    .diagram-error pre {
      margin-top: 0.4rem;
      padding: 0.6rem;
      background: #1e293b;
      color: #f8fafc;
      border-radius: 6px;
      font-family: 'Fira Code', monospace;
      font-size: 0.78rem;
      max-height: 200px;
      overflow: auto;
    }

    /* Fixed Bottom Toolbar */
    .toolbar {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      display: flex;
      gap: 0.5rem;
      background: var(--card);
      padding: 0.45rem 0.75rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      box-shadow: 0 8px 30px rgba(0,0,0,0.12);
      z-index: 100;
    }
    .btn {
      background: none;
      border: none;
      padding: 0.45rem 0.85rem;
      border-radius: 999px;
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      color: var(--text);
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: inherit;
    }
    .btn:hover {
      background: var(--accent-glow);
      color: var(--accent);
    }
    .btn.primary {
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      color: #fff;
    }
    .btn.primary:hover { opacity: 0.92; }

    /* Print & PDF Rules */
    @page { size: A4; margin: 15mm 15mm; }
    @media print {
      body { background: #fff !important; color: #000 !important; font-size: 12pt; line-height: 1.5; }
      .toolbar, .header-banner, .diagram-code-panel { display: none !important; }
      .diagram-topbar { display: flex !important; background: #f8fafc !important; border-bottom: 1px solid #cbd5e1 !important; padding: 4px 10px !important; }
      .diagram-topbar-title { display: flex !important; color: #0284c7 !important; font-weight: 700 !important; font-size: 0.82rem !important; }
      .diagram-tools-group, .diag-btn { display: none !important; }
      .main { border: none; box-shadow: none; margin: 0; padding: 0; max-width: 100%; }
      .svg-diagram-wrapper, .mermaid-wrapper {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        border: 1px solid #cbd5e1;
        box-shadow: none;
        margin: 1.5rem 0;
        background: #fff !important;
      }
      .diagram-viewport { padding: 0.5rem; background: #fff !important; }
      .diagram-viewport svg { max-width: 100% !important; height: auto !important; }
      pre, table, blockquote { page-break-inside: avoid; break-inside: avoid; border: 1px solid #e2e8f0; }
    }
  </style>
</head>
<body>

<header class="header-banner">
  <div class="brand">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
    <span>MiniBot · Export Report</span>
  </div>
  <div style="font-size: 0.82rem; color: var(--muted);">
    Generated: ${new Date().toLocaleString()}
  </div>
</header>

<div class="toolbar">
  <button class="btn" onclick="toggleTheme()" title="Toggle Light / Dark Mode">🌓 Theme</button>
  <button class="btn primary" onclick="window.print()" title="Print / Save PDF">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
    <span>Print / PDF</span>
  </button>
</div>

<div class="main">
  <div class="markdown-body" id="md-content" data-markdown="${encoded}"></div>
</div>

<script>
(function() {
  var isDark = false;
  window.toggleTheme = function() {
    isDark = !isDark;
    document.documentElement.classList.toggle('dark', isDark);
    if (window.mermaid) {
      applyMermaidConfig();
      renderAllMermaids();
    }
  };

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g, '\\\\$&');
  }

  // 🔤 Smart text wrap for diagram node labels
  function smartWrapNodeText(text) {
    if (!text || text.includes('<br') || text.includes('\\n')) return text;
    var plainText = text.trim();
    if (plainText.length <= 14) return text;

    function splitLine(str) {
      if (str.length <= 16) return [str];
      var colonIdx = str.search(/[：]/);
      if (colonIdx >= 3 && colonIdx <= 14) {
        return [str.slice(0, colonIdx + 1)].concat(splitLine(str.slice(colonIdx + 1).trim()));
      }
      var halfColonIdx = str.search(/:\\s/);
      if (halfColonIdx >= 3 && halfColonIdx <= 14) {
        return [str.slice(0, halfColonIdx + 1)].concat(splitLine(str.slice(halfColonIdx + 1).trim()));
      }
      var puncIdx = -1;
      for (var i = 8; i <= Math.min(16, str.length - 4); i++) {
        if ('，、；;,'.indexOf(str[i]) !== -1) { puncIdx = i; break; }
      }
      if (puncIdx !== -1) {
        return [str.slice(0, puncIdx + 1)].concat(splitLine(str.slice(puncIdx + 1).trim()));
      }
      var breakIdx = -1;
      for (var j = 9; j <= Math.min(15, str.length - 4); j++) {
        if ('和與或同及'.indexOf(str[j]) !== -1) { breakIdx = j; break; }
      }
      if (breakIdx !== -1) {
        return [str.slice(0, breakIdx)].concat(splitLine(str.slice(breakIdx).trim()));
      }
      var spaceIdx = -1;
      for (var k = Math.min(16, str.length - 3); k >= 8; k--) {
        if (str[k] === ' ') { spaceIdx = k; break; }
      }
      if (spaceIdx !== -1) {
        return [str.slice(0, spaceIdx)].concat(splitLine(str.slice(spaceIdx + 1).trim()));
      }
      if (str.length > 18) {
        return [str.slice(0, 13)].concat(splitLine(str.slice(13)));
      }
      return [str];
    }

    var chunks = splitLine(plainText);
    return chunks.filter(function(c) { return c.trim().length > 0; }).join('<br/>');
  }

  // 🛡️ Mermaid Guardrail & Auto-Sanitizer
  function sanitizeMermaid(code) {
    if (!code) return '';
    var lines = code.split('\\n');
    var fixed = lines.map(function(line) {
      var l = line;
      if (/^\\s*(flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|gitGraph|mindmap|timeline)/i.test(l.trim())) {
        return l;
      }
      if (/^\\s*subgraph\\b/i.test(l)) {
        if (/^\\s*subgraph\\s+[A-Za-z0-9_\\-]+\\s+\\["[^"\\]\\n]+"\\]\\s*$/i.test(l.trim())) return l;
        l = l.replace(/^(\\s*subgraph\\s+)([A-Za-z0-9_\\-]+)\\s*\\((?:\\'|\\")?([^\\)\\n]+?)(?:\\'|\\")?\\)\\s*$/i, function(m, p, name, t) {
          var safeId = 'sub_' + Math.random().toString(36).substring(2, 7);
          return p + safeId + ' ["' + name + ' (' + t.trim() + ')"]';
        });
        return l;
      }
      l = l.replace(/(\\b[A-Za-z0-9_\\u4e00-\\u9fa5]+)\\[([^"\\]\\n]*[\\(\\)\\?\\:\\/\\-\\s\\uff08\\uff09\\u3001\\uff0c\\+\\=\\#][^"\\]\\n]*)\\]/g, '$1["$2"]');
      l = l.replace(/(\\b[A-Za-z0-9_\\u4e00-\\u9fa5]+)\\{([^"\\}\\n]*[\\(\\)\\?\\:\\/\\-\\s\\uff08\\uff09\\u3001\\uff0c\\+\\=\\#][^"\\}\\n]*)\\}/g, '$1{"$2"}');
      l = l.replace(/(\\b[A-Za-z0-9_\\u4e00-\\u9fa5]+\\s*\\[")([^"\\n]+)("\\s*\\])/g, function(m, p, text, s) {
        return p + smartWrapNodeText(text) + s;
      });
      l = l.replace(/(\\b[A-Za-z0-9_\\u4e00-\\u9fa5]+\\s*\\{")([^"\\n]+)("\\s*\\})/g, function(m, p, text, s) {
        return p + smartWrapNodeText(text) + s;
      });
      l = l.replace(/--\\s+([^"\\n\\-]+?[\\(\\)\\?\\:\\/\\s\\uff08\\uff09][^"\\n\\-]+?)\\s+-->/g, '-- "$1" -->');
      l = l.replace(/-->\\|([^"\\|\\n]+?[\\(\\)\\?\\:\\/\\s\\uff08\\uff09][^"\\|\\n]+?)\\|/g, '-->|"$1"|');
      l = l.replace(/(\\[[^\\]]*?)\\s*->\\s*([^\\s\\]]*.*?\\])/g, function(m, before, after) { return before.replace(/\\s+$/, '') + ' to ' + after.replace(/^\\s+/, ''); });
      l = l.replace(/(\\{[^\\}]*?)\\s*->\\s*([^\\s\\}]*.*?\\})/g, function(m, before, after) { return before.replace(/\\s+$/, '') + ' to ' + after.replace(/^\\s+/, ''); });
      return l;
    });
    return fixed.join('\\n');
  }

  function applyMermaidConfig() {
    if (!window.mermaid) return;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      suppressErrorRendering: true,
      theme: 'base',
      themeVariables: isDark ? {
        darkMode: true,
        background: "#020617",
        mainBkg: "#0f172a",
        primaryColor: "#1e1b4b",
        primaryTextColor: "#f8fafc",
        primaryBorderColor: "#38bdf8",
        secondaryColor: "#172554",
        secondaryTextColor: "#f1f5f9",
        secondaryBorderColor: "#60a5fa",
        tertiaryColor: "#1e1b4b",
        tertiaryTextColor: "#f1f5f9",
        tertiaryBorderColor: "#93c5fd",
        lineColor: "#38bdf8",
        textColor: "#f8fafc",
        clusterBkg: "#0f172a",
        clusterBorder: "#38bdf8",
        nodeBorder: "#38bdf8",
        defaultLinkColor: "#38bdf8",
        titleColor: "#7dd3fc",
        edgeLabelBackground: "#1e293b",
        nodeTextColor: "#f8fafc",
        fontFamily: '"Roboto", "Noto Sans TC", system-ui, sans-serif'
      } : {
        darkMode: false,
        background: "#ffffff",
        mainBkg: "#f8fafc",
        primaryColor: "#f0f9ff",
        primaryTextColor: "#0f172a",
        primaryBorderColor: "#38bdf8",
        secondaryColor: "#f8fafc",
        secondaryTextColor: "#1e293b",
        secondaryBorderColor: "#cbd5e1",
        tertiaryColor: "#f1f5f9",
        tertiaryTextColor: "#1e293b",
        tertiaryBorderColor: "#94a3b8",
        lineColor: "#2563eb",
        textColor: "#0f172a",
        clusterBkg: "#f8fafc",
        clusterBorder: "#93c5fd",
        nodeBorder: "#0284c7",
        defaultLinkColor: "#2563eb",
        titleColor: "#0369a1",
        edgeLabelBackground: "#ffffff",
        nodeTextColor: "#0f172a",
        fontFamily: '"Roboto", "Noto Sans TC", system-ui, sans-serif'
      },
      fontSize: 13.5,
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis',
        nodeSpacing: 45,
        rankSpacing: 48,
        padding: 12,
        wrappingWidth: 240
      },
      sequence: {
        diagramMarginX: 50,
        diagramMarginY: 30,
        actorFontSize: 14,
        messageFontSize: 13.5,
        noteFontSize: 13,
        width: 180,
        height: 50
      }
    });
  }

  // -------------------------------------------------------------
  // SVG Namespace / ID Collision Prevention
  // -------------------------------------------------------------
  function namespaceSVG(svgElement, prefix) {
    if (!svgElement) return;
    if (!svgElement.getAttribute('xmlns')) {
      svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    if (!svgElement.getAttribute('xmlns:xlink')) {
      svgElement.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    }
    if (!svgElement.getAttribute('preserveAspectRatio')) {
      svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }

    var elementsWithId = svgElement.querySelectorAll('[id]');
    if (elementsWithId.length === 0) return;

    var idMap = {};
    elementsWithId.forEach(function(el) {
      var oldId = el.getAttribute('id');
      if (oldId && !oldId.startsWith(prefix + '_')) {
        var newId = prefix + '_' + oldId;
        idMap[oldId] = newId;
        el.setAttribute('id', newId);
      }
    });

    var keys = Object.keys(idMap);
    if (keys.length === 0) return;

    var allEls = svgElement.querySelectorAll('*');
    allEls.forEach(function(el) {
      for (var a = 0; a < el.attributes.length; a++) {
        var attr = el.attributes[a];
        var val = attr.value;
        var changed = false;

        keys.forEach(function(oldId) {
          var newId = idMap[oldId];
          // Replace url(#oldId)
          if (val.indexOf('url(#' + oldId + ')') !== -1) {
            val = val.split('url(#' + oldId + ')').join('url(#' + newId + ')');
            changed = true;
          }
          if (val.indexOf("url('#" + oldId + "')") !== -1) {
            val = val.split("url('#" + oldId + "')").join("url('#" + newId + "')");
            changed = true;
          }
          // Replace href="#oldId" or xlink:href="#oldId"
          if (attr.name === 'href' || attr.name === 'xlink:href') {
            if (val === '#' + oldId) {
              val = '#' + newId;
              changed = true;
            }
          }
        });

        if (changed) {
          el.setAttribute(attr.name, val);
        }
      }
    });
  }

  // -------------------------------------------------------------
  // Post-Render SVG Validation Layer
  // -------------------------------------------------------------
  function validateRenderedSVG(svgElement, label) {
    var issues = [];
    if (!svgElement) {
      return { valid: false, issues: ['SVG DOM node not found'] };
    }
    if (!svgElement.hasAttribute('viewBox')) {
      issues.push('Missing viewBox attribute (responsive scaling may be affected)');
    }
    var visualCount = svgElement.querySelectorAll('rect, path, circle, ellipse, line, polyline, polygon, text, image, use, foreignObject').length;
    if (visualCount === 0) {
      issues.push('SVG contains no visual graphic elements');
    }

    var uses = svgElement.querySelectorAll('use');
    uses.forEach(function(u) {
      var href = u.getAttribute('href') || u.getAttribute('xlink:href');
      if (href && href.startsWith('#')) {
        var refId = href.substring(1);
        try {
          if (!svgElement.querySelector('#' + CSS.escape(refId))) {
            issues.push('<use> references missing element: #' + refId);
          }
        } catch(e) {}
      }
    });

    if (issues.length > 0) {
      console.warn('[Diagram Validation] ' + (label || 'SVG') + ' warnings/issues:', issues);
    } else {
      console.log('[Diagram Validation] ' + (label || 'SVG') + ' validated successfully: ' + visualCount + ' visual elements.');
    }
    return { valid: issues.length === 0, issues: issues };
  }

  // -------------------------------------------------------------
  // Diagram Interactivity & Controls (Zoom / Pan / Reset / Source)
  // -------------------------------------------------------------
  function setupDiagramControls(wrapper, viewport, svgEl, rawCode) {
    if (!svgEl || !viewport) return;

    var currentScale = 1.0;
    var panX = 0; var panY = 0;
    var isDragging = false;
    var startX = 0; var startY = 0;

    var codePanel = wrapper.querySelector('.diagram-code-panel');
    var copyBtn = wrapper.querySelector('[data-action="copy"]');
    var viewBtn = wrapper.querySelector('[data-action="view"]');
    var zoomOutBtn = wrapper.querySelector('[data-action="zoom-out"]');
    var resetBtn = wrapper.querySelector('[data-action="reset"]');
    var zoomInBtn = wrapper.querySelector('[data-action="zoom-in"]');

    function applyTransform() {
      svgEl.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + currentScale + ')';
    }

    function reset() {
      currentScale = 1.0;
      panX = 0;
      panY = 0;
      if (resetBtn) resetBtn.textContent = '100%';
      applyTransform();
    }

    if (copyBtn) {
      copyBtn.onclick = function() {
        navigator.clipboard.writeText(rawCode).then(function() {
          copyBtn.textContent = '✓ Copied';
          setTimeout(function() { copyBtn.textContent = '📋 Copy'; }, 1500);
        });
      };
    }

    if (viewBtn && codePanel) {
      viewBtn.onclick = function() {
        var isVis = codePanel.classList.toggle('visible');
        viewBtn.classList.toggle('active', isVis);
      };
    }

    if (zoomInBtn) {
      zoomInBtn.onclick = function() {
        currentScale = Math.min(5.0, parseFloat((currentScale + 0.15).toFixed(2)));
        if (resetBtn) resetBtn.textContent = Math.round(currentScale * 100) + '%';
        applyTransform();
      };
    }

    if (zoomOutBtn) {
      zoomOutBtn.onclick = function() {
        currentScale = Math.max(0.2, parseFloat((currentScale - 0.15).toFixed(2)));
        if (resetBtn) resetBtn.textContent = Math.round(currentScale * 100) + '%';
        applyTransform();
      };
    }

    if (resetBtn) {
      resetBtn.onclick = reset;
    }

    viewport.ondblclick = reset;

    // Drag-to-pan
    viewport.onmousedown = function(e) {
      if (e.button !== 0) return;
      isDragging = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
    };
    window.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      applyTransform();
    });
    window.addEventListener('mouseup', function() { isDragging = false; });

    // Ctrl + Wheel Zoom
    viewport.addEventListener('wheel', function(e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      var factor = e.deltaY < 0 ? 1.1 : 0.9;
      currentScale = Math.max(0.2, Math.min(5.0, parseFloat((currentScale * factor).toFixed(2))));
      if (resetBtn) resetBtn.textContent = Math.round(currentScale * 100) + '%';
      applyTransform();
    }, { passive: false });
  }

  // -------------------------------------------------------------
  // Rendering Pipeline
  // -------------------------------------------------------------
  var rawMermaidMap = {};
  var mCount = 0;
  var svgCount = 0;

  function renderDocument() {
    var el = document.getElementById('md-content');
    if (!el) return;
    var raw = decodeURIComponent(el.getAttribute('data-markdown') || '');
    if (!raw) return;

    var clean = raw;

    // Clean outer markdown fence wrapper if message wrapped completely
    var mdFence = String.fromCharCode(96, 96, 96);
    if (clean.indexOf(mdFence + 'markdown') === 0 && clean.lastIndexOf(mdFence) === clean.length - 3) {
      clean = clean.slice(11, -3).trim();
    }

    // Convert <think>...</think> blocks into sleek collapsible blocks
    clean = clean.replace(new RegExp('<think>([\\\\s\\\\S]*?)<\\\\/think>', 'gi'), function(_, thought) {
      return '\\n\\n<details class="think-block"><summary>💭 Thought Process</summary><div class="think-content">' + thought.trim() + '</div></details>\\n\\n';
    });

    var extractedDiagrams = [];

    // 1. Isolate code-fenced blocks (\`\`\`mermaid, \`\`\`svg, \`\`\`xml, \`\`\`html)
    var fence = String.fromCharCode(96) + '{3,}';
    var fencedPattern = new RegExp(fence + '(mermaid|svg|xml|html)?\\\\s*\\\\n([\\\\s\\\\S]*?)\\\\n\\\\s*' + fence, 'gi');
    clean = clean.replace(fencedPattern, function(match, lang, content) {
      var l = (lang || '').toLowerCase();
      var c = content.trim();
      if (l === 'mermaid') {
        var token = 'DIAGRAMPLACEHOLDER' + extractedDiagrams.length + 'ENDTOKEN';
        extractedDiagrams.push({ kind: 'mermaid', source: c });
        return '\\n\\n' + token + '\\n\\n';
      }
      if (l === 'svg' || l === 'xml' || l === 'html' || !l) {
        if (c.indexOf('<svg') !== -1 && c.indexOf('</svg>') !== -1) {
          var token = 'DIAGRAMPLACEHOLDER' + extractedDiagrams.length + 'ENDTOKEN';
          extractedDiagrams.push({ kind: 'svg', source: c });
          return '\\n\\n' + token + '\\n\\n';
        }
      }
      return match;
    });

    // 2. Isolate raw <svg>...</svg> blocks
    var rawSvgPattern = new RegExp('(<svg[\\\\s\\\\S]*?<\\\\/svg>)', 'gi');
    clean = clean.replace(rawSvgPattern, function(match) {
      var token = 'DIAGRAMPLACEHOLDER' + extractedDiagrams.length + 'ENDTOKEN';
      extractedDiagrams.push({ kind: 'svg', source: match.trim() });
      return '\\n\\n' + token + '\\n\\n';
    });

    // Render ordinary Markdown
    var renderedHtml = '';
    if (window.marked && typeof marked.parse === 'function') {
      renderedHtml = marked.parse(clean);
    } else {
      // Local fallback if marked CDN fails
      renderedHtml = '<pre style="white-space:pre-wrap;">' + escapeHtml(clean) + '</pre>';
    }

    var tempContainer = document.createElement('div');
    tempContainer.innerHTML = renderedHtml;

    // Replace placeholders with real Diagram DOM
    var walker = document.createTreeWalker(tempContainer, NodeFilter.SHOW_TEXT);
    var textNodes = [];
    var currentNode;
    while (currentNode = walker.nextNode()) {
      textNodes.push(currentNode);
    }

    for (var i = 0; i < textNodes.length; i++) {
      var textNode = textNodes[i];
      var val = textNode.nodeValue || '';
      for (var d = 0; d < extractedDiagrams.length; d++) {
        var token = 'DIAGRAMPLACEHOLDER' + d + 'ENDTOKEN';
        if (val.indexOf(token) !== -1) {
          var diag = extractedDiagrams[d];
          var wrapper = createDiagramDOM(diag, d);

          // If parent is a <p> container that only holds this placeholder, replace the entire <p>
          var parent = textNode.parentElement;
          if (parent && parent.tagName === 'P' && parent.textContent.trim() === token) {
            parent.parentNode.replaceChild(wrapper, parent);
          } else {
            // Split and replace node
            var parts = val.split(token);
            var frag = document.createDocumentFragment();
            if (parts[0]) frag.appendChild(document.createTextNode(parts[0]));
            frag.appendChild(wrapper);
            if (parts[1]) frag.appendChild(document.createTextNode(parts[1]));
            textNode.parentNode.replaceChild(frag, textNode);
          }
          break;
        }
      }
    }

    el.innerHTML = '';
    while (tempContainer.firstChild) {
      el.appendChild(tempContainer.firstChild);
    }

    // Initialize standalone SVGs immediately
    initializeStandaloneSVGs(el);
  }

  function createDiagramDOM(diag, index) {
    var isSvg = diag.kind === 'svg';
    var wrapper = document.createElement('section');
    wrapper.className = isSvg ? 'svg-diagram-wrapper' : 'mermaid-wrapper';
    wrapper.dataset.diagramType = diag.kind;

    var numStr = (index + 1).toString().padStart(2, '0');
    var title = isSvg ? ('SVG Architecture Diagram (' + numStr + ')') : ('Mermaid Diagram (' + numStr + ')');

    var topbar = document.createElement('div');
    topbar.className = 'diagram-topbar';
    topbar.innerHTML = '<div class="diagram-topbar-title">'
      + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="6" rx="1.5"/><rect x="3" y="15" width="6" height="6" rx="1.5"/><rect x="15" y="15" width="6" height="6" rx="1.5"/><path d="M12 9v3M6 15v-1a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/></svg>'
      + '<span>' + title + '</span>'
      + '</div>'
      + '<div class="diagram-tools-group">'
      + '<button class="diag-btn" data-action="view"><span style="color:#4f46e5;font-weight:bold;font-family:monospace;">&lt;&gt;</span> Source</button>'
      + '<button class="diag-btn" data-action="copy"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</button>'
      + '<div style="display:inline-flex;align-items:center;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:0 6px;height:28px;gap:4px;">'
      + '<button class="diag-btn" data-action="zoom-out" style="border:none;background:transparent;padding:1px 4px;cursor:pointer;">🔍−</button>'
      + '<span data-action="reset" style="padding:0 4px;font-family:monospace;font-weight:bold;font-size:12px;cursor:pointer;" title="Reset zoom to 100%">100%</span>'
      + '<button class="diag-btn" data-action="zoom-in" style="border:none;background:transparent;padding:1px 4px;cursor:pointer;">+</button>'
      + '</div>'
      + '</div>';

    var codePanel = document.createElement('div');
    codePanel.className = 'diagram-code-panel';
    codePanel.innerHTML = '<pre><code>' + escapeHtml(diag.source) + '</code></pre>';

    var viewport = document.createElement('div');
    viewport.className = 'diagram-viewport';

    wrapper.appendChild(topbar);
    wrapper.appendChild(codePanel);
    wrapper.appendChild(viewport);

    if (isSvg) {
      // Direct SVG injection into DOM
      var tempDiv = document.createElement('div');
      tempDiv.innerHTML = diag.source;
      var svgEl = tempDiv.querySelector('svg');
      if (svgEl) {
        namespaceSVG(svgEl, 'svg_' + (++svgCount));
        viewport.appendChild(svgEl);
        validateRenderedSVG(svgEl, 'Standalone SVG #' + svgCount);
        setupDiagramControls(wrapper, viewport, svgEl, diag.source);
      } else {
        viewport.innerHTML = '<div class="diagram-error">Invalid SVG element content</div>';
      }
    } else {
      // Mermaid: setup placeholder and queue rendering
      var mId = 'mermaid-render-' + (++mCount) + '-' + Date.now();
      wrapper.id = mId;
      rawMermaidMap[mId] = diag.source;
    }

    return wrapper;
  }

  function initializeStandaloneSVGs(container) {
    // Check all standalone SVG wrappers
    var wrappers = container.querySelectorAll('.svg-diagram-wrapper');
    wrappers.forEach(function(w) {
      var svg = w.querySelector('svg');
      if (svg) {
        // Detect tall SVGs
        var vb = svg.getAttribute('viewBox');
        if (vb) {
          var parts = vb.trim().split(/[\\s,]+/);
          if (parts.length === 4) {
            var wVal = parseFloat(parts[2]);
            var hVal = parseFloat(parts[3]);
            if (wVal > 0 && hVal > 0 && (hVal / wVal > 1.3)) {
              svg.classList.add('tall-diagram');
            }
          }
        }
      }
    });
  }

  async function renderAllMermaids() {
    var ids = Object.keys(rawMermaidMap);
    if (ids.length === 0) return;

    if (!window.mermaid) {
      ids.forEach(function(id) {
        var wrapper = document.getElementById(id);
        if (!wrapper) return;
        var code = rawMermaidMap[id];
        var vp = wrapper.querySelector('.diagram-viewport');
        if (vp) {
          vp.innerHTML = '<div class="diagram-error"><strong>Mermaid library not loaded (offline mode)</strong><pre>' + escapeHtml(code) + '</pre></div>';
        }
      });
      return;
    }

    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var code = rawMermaidMap[id];
      var wrapper = document.getElementById(id);
      if (!wrapper) continue;

      var viewport = wrapper.querySelector('.diagram-viewport');
      if (!viewport) continue;

      var sanitized = sanitizeMermaid(code);
      var renderId = 'm_' + i + '_' + Math.random().toString(36).substring(2, 8);

      try {
        var res = await mermaid.render(renderId, sanitized);
        var svgStr = res.svg || '';

        var isDarkNow = document.documentElement.classList.contains('dark');
        var targetClusterBkg = isDarkNow ? '#0f172a' : '#f8fafc';
        svgStr = svgStr
          .replace(/#ffffde/gi, targetClusterBkg)
          .replace(/#ffffcc/gi, targetClusterBkg)
          .replace(/#ffffdf/gi, targetClusterBkg)
          .replace(/#fffbe8/gi, targetClusterBkg)
          .replace(/#fefae0/gi, targetClusterBkg)
          .replace(/#ffffe0/gi, targetClusterBkg);

        viewport.innerHTML = svgStr;
        var svgEl = viewport.querySelector('svg');
        if (svgEl) {
          namespaceSVG(svgEl, 'mermaid_' + (i + 1));

          // Check tall chart
          var vbMatch = svgStr.match(/viewBox=["\\']([0-9.-]+)\\s+([0-9.-]+)\\s+([0-9.-]+)\\s+([0-9.-]+)["\\']/i);
          if (vbMatch) {
            var vbW = parseFloat(vbMatch[3]);
            var vbH = parseFloat(vbMatch[4]);
            if (vbW > 0 && vbH > 0 && (vbH / vbW > 1.33)) {
              svgEl.classList.add('tall-diagram');
            }
          }

          validateRenderedSVG(svgEl, 'Mermaid Diagram #' + (i + 1));
          setupDiagramControls(wrapper, viewport, svgEl, code);
        }
      } catch (err) {
        console.error('[Mermaid Render Failed]', err);
        viewport.innerHTML = '<div class="diagram-error">'
          + '<strong>Mermaid rendering failed</strong>'
          + '<p style="margin-top:4px;">' + escapeHtml(err.message || String(err)) + '</p>'
          + '<details style="margin-top:8px;"><summary style="cursor:pointer;font-weight:600;">Show Mermaid source</summary>'
          + '<pre>' + escapeHtml(code) + '</pre></details>'
          + '</div>';
      }
    }
  }

  // Execute Boot Sequence
  applyMermaidConfig();
  renderDocument();
  renderAllMermaids();
})();
<\/script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Triggers browser download of generated HTML file
 */
export function downloadHtmlFile(content: string, filename: string = "export.html") {
  const blob = new Blob([content], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
