#!/usr/bin/env tsx
/**
 * drawio-to-svg.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts every draw.io XML block found in an HTML file to inline SVG
 * using the configured LLM.
 *
 * Usage:
 *   tsx tools/drawio-to-svg.ts <input.html> [output.html]
 *
 * If output.html is omitted the result is written next to the input file
 * with a "-svg" suffix, e.g. report-svg.html
 *
 * Looks for draw.io content in:
 *   - Fenced code blocks  ```drawio ... ```  or  ```draw.io ... ```
 *   - Raw <mxfile ...>...</mxfile>  blocks
 *   - Raw <mxGraphModel ...>...</mxGraphModel>  blocks
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// ── Config ─────────────────────────────────────────────────────────────────

function loadConfig() {
  const cfgPath = path.resolve(process.cwd(), "minibot.config.json");
  if (fs.existsSync(cfgPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
      const llm = raw?.llm;
      if (llm?.baseUrl && llm?.model) {
        return {
          baseURL: llm.baseUrl as string,
          apiKey: (llm.apiKey as string) || "dummy",
          model: llm.model as string,
        };
      }
    } catch { /* fall through */ }
  }
  return {
    baseURL: process.env.LLM_BASE_URL ?? "http://127.0.0.1:8045/v1",
    apiKey: process.env.LLM_API_KEY ?? "dummy",
    model: process.env.LLM_MODEL ?? "gpt-4o",
  };
}

// ── LLM call ───────────────────────────────────────────────────────────────

const cfg = loadConfig();
const openai = new OpenAI({ baseURL: cfg.baseURL, apiKey: cfg.apiKey });

const SYSTEM_PROMPT = `You are an expert SVG generator.
Given draw.io XML (mxGraphModel / mxfile format), produce a clean, self-contained SVG that faithfully
represents the diagram — nodes, labels, arrows, and colours.

Rules:
- Output ONLY the SVG markup. No prose, no markdown fences, no explanation.
- Start with <svg xmlns="http://www.w3.org/2000/svg" ...> and end with </svg>.
- Use a viewBox that fits all content with 20px padding on every side.
- Use readable fonts: font-family="Arial, sans-serif".
- Prefer filled rectangles with rounded corners (rx="8") for nodes.
- Use <marker id="arrow"> for arrow heads on connecting lines.
- Render node labels centred inside their shapes.
- Use a white or very light background rect covering the full viewBox.
- Do NOT include any <script> tags or event handlers.`;

async function drawioToSvg(xmlContent: string, index: number): Promise<string> {
  console.log(`  [LLM] Converting diagram #${index + 1} (${xmlContent.length} chars)...`);

  const completion = await openai.chat.completions.create({
    model: cfg.model,
    temperature: 0.1,
    max_tokens: 8192,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Convert this draw.io XML to SVG:\n\n${xmlContent}` },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";
  const fenceMatch = raw.match(/```(?:svg|xml)?\s*([\s\S]*?)```/i);
  const svg = fenceMatch ? fenceMatch[1].trim() : raw;

  if (!svg.startsWith("<svg")) {
    console.warn(`  [WARN] Diagram #${index + 1}: LLM output does not look like SVG — keeping raw XML`);
    return `<!-- draw.io diagram #${index + 1} (LLM conversion failed) -->\n<pre style="overflow:auto;background:#f1f5f9;padding:12px;border-radius:8px;font-size:11px;">${escapeHtml(xmlContent)}</pre>`;
  }

  return `<div class="drawio-svg-block" style="overflow:auto;border:1px solid #e2e8f0;border-radius:10px;margin:12px 0;">\n${svg}\n</div>`;
}

// ── HTML extraction & replacement ──────────────────────────────────────────

interface DrawioBlock {
  fullMatch: string;
  xmlContent: string;
}

function extractDrawioBlocks(html: string): DrawioBlock[] {
  const blocks: DrawioBlock[] = [];

  // 1. Fenced code blocks: ```drawio\n...\n```
  const fenceRe = /```(?:drawio|draw\.io)\s*\n([\s\S]*?)```/gi;
  for (const m of html.matchAll(fenceRe)) {
    blocks.push({ fullMatch: m[0], xmlContent: m[1].trim() });
  }

  // 2. Raw <mxfile>...</mxfile>
  const mxfileRe = /<mxfile[\s\S]*?<\/mxfile>/gi;
  for (const m of html.matchAll(mxfileRe)) {
    if (!blocks.some((b) => b.xmlContent.includes(m[0].substring(0, 40)))) {
      blocks.push({ fullMatch: m[0], xmlContent: m[0] });
    }
  }

  // 3. Raw <mxGraphModel>...</mxGraphModel> not already in mxfile
  const mxModelRe = /<mxGraphModel[\s\S]*?<\/mxGraphModel>/gi;
  for (const m of html.matchAll(mxModelRe)) {
    if (!blocks.some((b) => b.xmlContent.includes(m[0].substring(0, 40)))) {
      blocks.push({ fullMatch: m[0], xmlContent: m[0] });
    }
  }

  return blocks;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const [, , inputArg, outputArg] = process.argv;

  if (!inputArg) {
    console.error("Usage: tsx tools/drawio-to-svg.ts <input.html> [output.html]");
    process.exit(1);
  }

  const inputPath = path.resolve(inputArg);
  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const ext = path.extname(inputPath);
  const base = path.basename(inputPath, ext);
  const dir = path.dirname(inputPath);
  const outputPath = outputArg
    ? path.resolve(outputArg)
    : path.join(dir, `${base}-svg${ext}`);

  console.log(`\nInput  : ${inputPath}`);
  console.log(`Output : ${outputPath}`);
  console.log(`Model  : ${cfg.model}  (${cfg.baseURL})\n`);

  let html = fs.readFileSync(inputPath, "utf-8");
  const blocks = extractDrawioBlocks(html);

  if (blocks.length === 0) {
    console.log("No draw.io blocks found. Output is a copy of the input.");
    fs.copyFileSync(inputPath, outputPath);
    return;
  }

  console.log(`Found ${blocks.length} draw.io block(s). Converting...\n`);

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    try {
      const svgHtml = await drawioToSvg(block.xmlContent, i);
      html = html.replace(block.fullMatch, svgHtml);
      console.log(`  OK Diagram #${i + 1} replaced (${svgHtml.length} chars)`);
    } catch (err) {
      console.error(`  FAIL Diagram #${i + 1}: ${(err as Error).message}`);
    }
  }

  // Inject responsive SVG style
  const styleTag = `<style>
.drawio-svg-block svg { max-width: 100%; height: auto; display: block; }
</style>`;
  if (!html.includes(".drawio-svg-block svg")) {
    html = html.includes("</head>")
      ? html.replace("</head>", `${styleTag}\n</head>`)
      : styleTag + "\n" + html;
  }

  fs.writeFileSync(outputPath, html, "utf-8");
  console.log(`\nDone! Saved to: ${outputPath}\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
