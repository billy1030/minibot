import React, { useMemo, useEffect, useRef } from "react";
import { marked } from "marked";
import { MermaidDiagram } from "./MermaidDiagram";

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
  type: 'markdown' | 'mermaid';
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

    const MERMAID_REGEX = /```mermaid\s*([\s\S]*?)```/g;
    const result: ContentSegment[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = MERMAID_REGEX.exec(clean)) !== null) {
      // Push preceding markdown segment
      if (match.index > lastIndex) {
        const md = clean.slice(lastIndex, match.index);
        if (md.trim()) {
          try {
            result.push({
              type: 'markdown',
              content: md,
              html: marked.parse(md, { async: false }) as string,
            });
          } catch {
            result.push({ type: 'markdown', content: md, html: md });
          }
        }
      }

      // Push mermaid segment
      result.push({
        type: 'mermaid',
        content: match[1].trim(),
      });

      lastIndex = match.index + match[0].length;
    }

    // Push trailing markdown segment
    if (lastIndex < clean.length) {
      const remaining = clean.slice(lastIndex);
      if (remaining.trim()) {
        try {
          result.push({
            type: 'markdown',
            content: remaining,
            html: marked.parse(remaining, { async: false }) as string,
          });
        } catch {
          result.push({ type: 'markdown', content: remaining, html: remaining });
        }
      }
    }

    // Fallback: If no segments were extracted (e.g. whitespace or no mermaid)
    if (result.length === 0 && clean) {
      try {
        result.push({
          type: 'markdown',
          content: clean,
          html: marked.parse(clean, { async: false }) as string,
        });
      } catch {
        result.push({ type: 'markdown', content: clean, html: clean });
      }
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

  // If no mermaid blocks found, render single standard container
  const hasMermaid = segments.some(s => s.type === 'mermaid');

  if (!hasMermaid) {
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
