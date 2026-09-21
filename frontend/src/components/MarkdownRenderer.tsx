import React, { useMemo, useEffect, useRef } from "react";
import { marked } from "marked";
import { MermaidDiagram } from "./MermaidDiagram";
import { SvgDiagramViewer } from "./SvgDiagramViewer";
import { DrawioViewer } from "./DrawioViewer";
import { isDrawioXml } from "../utils/drawioHelper";

// Configure marked options for clean GitHub-flavored markdown
marked.setOptions({
  gfm: true,
  breaks: true,
});

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

interface ContentSegment {
  type: 'markdown' | 'mermaid' | 'svg' | 'drawio';
  content: string;
  html?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = "" }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const segments = useMemo<ContentSegment[]>(() => {
    if (!content) return [];

    let clean = content;
    // Clean outer markdown fence wrapper if message wrapped completely
    if (clean.startsWith("```markdown") && clean.endsWith("```")) {
      clean = clean.slice(11, -3).trim();
    }

    // Isolate Draw.io diagram blocks (````drawio, ````draw.io, ````xml with mxfile, or standalone <mxfile> tags)
    const drawioBlocks: string[] = [];

    // 1. Capture fenced drawio/draw.io blocks or xml blocks containing mxfile/mxGraphModel
    clean = clean.replace(/`{3,}(?:drawio|draw\.io|xml)?\s*([\s\S]*?`{3,}|$)/gi, (match, innerContent) => {
      const trimmedInner = innerContent.replace(/`{3,}$/, '').trim();
      if (isDrawioXml(trimmedInner)) {
        const token = `MINIBOTDRAWIOBLOCKTOKEN${drawioBlocks.length}ENDTOKEN`;
        drawioBlocks.push(trimmedInner);
        return `\n\n${token}\n\n`;
      }
      return match;
    });

    // 2. Capture standalone <mxfile>...</mxfile> blocks
    clean = clean.replace(/(<mxfile[\s\S]*?<\/mxfile>)/gi, (match) => {
      const token = `MINIBOTDRAWIOBLOCKTOKEN${drawioBlocks.length}ENDTOKEN`;
      drawioBlocks.push(match.trim());
      return `\n\n${token}\n\n`;
    });

    // Isolate SVG blocks (both inside ```svg/xml/html fences and standalone <svg>...</svg>)
    const svgBlocks: string[] = [];

    // Sanitize and auto-repair raw SVG (including truncated SVG streams from model limits)
    const sanitizeSvgXML = (svg: string): string => {
      const startIdx = svg.indexOf('<svg');
      if (startIdx === -1) return svg;
      let cleanSvgStr = svg.slice(startIdx);
      const endIdx = cleanSvgStr.lastIndexOf('</svg>');
      if (endIdx !== -1) {
        cleanSvgStr = cleanSvgStr.slice(0, endIdx + 6);
      } else {
        // SVG was truncated mid-generation: close open tags and add </svg> so it can render safely
        cleanSvgStr = cleanSvgStr.trim();
        // Remove trailing incomplete tag if cut off mid-attribute e.g. <text font-size="
        cleanSvgStr = cleanSvgStr.replace(/<[^>]*$/, '');
        cleanSvgStr += '\n</g>\n</svg>';
      }
      // Replace bare & not followed by standard xml entity (amp, lt, gt, quot, apos, #123, #x123)
      return cleanSvgStr.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#[xX][0-9a-fA-F]+);)/g, '&amp;');
    };

    // First capture fenced SVG blocks (both completed and unclosed/truncated fences)
    clean = clean.replace(/`{3,}(?:xml|html|svg)?\s*([\s\S]*?<svg[\s\S]*?)(?:<\/svg>\s*`{3,}|`{3,}|$)/gi, (match, svgContent) => {
      // Only treat as SVG if it has <svg tag
      if (!svgContent.includes('<svg')) return match;
      const token = `MINIBOTSVGBLOCKTOKEN${svgBlocks.length}ENDTOKEN`;
      svgBlocks.push(sanitizeSvgXML(svgContent.trim()));
      return `\n\n${token}\n\n`;
    });

    // Then capture standalone or div-wrapped SVG blocks
    clean = clean.replace(/(<div[\s\S]*?<svg[\s\S]*?<\/svg>[\s\S]*?<\/div>|<svg[\s\S]*?<\/svg>)/gi, (match) => {
      const token = `MINIBOTSVGBLOCKTOKEN${svgBlocks.length}ENDTOKEN`;
      svgBlocks.push(sanitizeSvgXML(match.trim()));
      return `\n\n${token}\n\n`;
    });

    // Helper: split a text into markdown, svg, and drawio segments based on tokens
    const splitTokensAndMarkdown = (text: string): ContentSegment[] => {
      const subSegments: ContentSegment[] = [];
      const TOKEN_REGEX = /MINIBOT(SVG|DRAWIO)BLOCKTOKEN(\d+)ENDTOKEN/g;
      let lastIdx = 0;
      let m: RegExpExecArray | null;

      while ((m = TOKEN_REGEX.exec(text)) !== null) {
        if (m.index > lastIdx) {
          const mdPiece = text.slice(lastIdx, m.index);
          if (mdPiece.trim()) {
            try {
              const rawParsed = marked.parse(mdPiece, { async: false }) as string;
              subSegments.push({ type: 'markdown', content: mdPiece, html: rawParsed });
            } catch {
              subSegments.push({ type: 'markdown', content: mdPiece, html: mdPiece });
            }
          }
        }

        const tokenType = m[1]; // 'SVG' or 'DRAWIO'
        const blockIdx = parseInt(m[2], 10);

        if (tokenType === 'SVG' && svgBlocks[blockIdx] !== undefined) {
          subSegments.push({
            type: 'svg',
            content: svgBlocks[blockIdx],
          });
        } else if (tokenType === 'DRAWIO' && drawioBlocks[blockIdx] !== undefined) {
          subSegments.push({
            type: 'drawio',
            content: drawioBlocks[blockIdx],
          });
        }

        lastIdx = m.index + m[0].length;
      }

      if (lastIdx < text.length) {
        const remainingPiece = text.slice(lastIdx);
        if (remainingPiece.trim()) {
          try {
            const rawParsed = marked.parse(remainingPiece, { async: false }) as string;
            subSegments.push({ type: 'markdown', content: remainingPiece, html: rawParsed });
          } catch {
            subSegments.push({ type: 'markdown', content: remainingPiece, html: remainingPiece });
          }
        }
      }

      return subSegments;
    };

    const MERMAID_REGEX = /```mermaid\s*([\s\S]*?)```/g;
    const result: ContentSegment[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = MERMAID_REGEX.exec(clean)) !== null) {
      // Process preceding text
      if (match.index > lastIndex) {
        const textBefore = clean.slice(lastIndex, match.index);
        result.push(...splitTokensAndMarkdown(textBefore));
      }

      // Push mermaid segment
      result.push({
        type: 'mermaid',
        content: match[1].trim(),
      });

      lastIndex = match.index + match[0].length;
    }

    // Process trailing text
    if (lastIndex < clean.length) {
      const textAfter = clean.slice(lastIndex);
      result.push(...splitTokensAndMarkdown(textAfter));
    }

    // Fallback if no segments produced but clean text exists
    if (result.length === 0 && clean) {
      result.push(...splitTokensAndMarkdown(clean));
    }

    return result;
  }, [content]);

  // Inject sleek copy buttons on code blocks inside markdown-body elements
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const pres = root.querySelectorAll<HTMLPreElement>('pre');
    pres.forEach((pre) => {
      // Avoid duplicate copy buttons
      if (pre.querySelector('.code-copy-btn')) return;

      const codeEl = pre.querySelector('code');
      const textToCopy = codeEl ? codeEl.innerText : pre.innerText;
      if (!textToCopy.trim()) return;

      const btn = document.createElement('button');
      btn.className = 'code-copy-btn';
      btn.type = 'button';
      btn.title = 'Copy code snippet';
      btn.setAttribute('aria-label', 'Copy code snippet');
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Copy</span>`;

      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(textToCopy);
          btn.classList.add('copied');
          btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span style="color:#10b981;">Copied!</span>`;
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Copy</span>`;
          }, 2000);
        } catch (err) {
          console.error('Failed to copy code snippet:', err);
        }
      });

      pre.appendChild(btn);
    });
  }, [segments]);

  // If no interactive blocks (mermaid, svg, or drawio) found, render single standard container
  const hasInteractiveBlocks = segments.some(s => s.type === 'mermaid' || s.type === 'svg' || s.type === 'drawio');

  if (!hasInteractiveBlocks) {
    const singleHtml = segments.map(s => s.html || s.content).join('');
    return (
      <div
        ref={containerRef}
        className={`markdown-body ${className}`}
        dangerouslySetInnerHTML={{ __html: singleHtml }}
      />
    );
  }

  return (
    <div ref={containerRef} className={`markdown-container flex flex-col ${className}`}>
      {segments.map((seg, idx) => {
        if (seg.type === 'mermaid') {
          return (
            <MermaidDiagram
              key={`mermaid-${idx}`}
              code={seg.content}
              index={idx}
            />
          );
        }
        if (seg.type === 'svg') {
          return (
            <SvgDiagramViewer
              key={`svg-${idx}`}
              svgContent={seg.content}
              index={idx}
            />
          );
        }
        if (seg.type === 'drawio') {
          return (
            <DrawioViewer
              key={`drawio-${idx}`}
              xml={seg.content}
              index={idx}
            />
          );
        }
        return (
          <div
            key={`md-${idx}`}
            className="markdown-body"
            dangerouslySetInnerHTML={{ __html: seg.html || '' }}
          />
        );
      })}
    </div>
  );
};
