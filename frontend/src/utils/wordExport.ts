import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  BorderStyle,
  WidthType,
  AlignmentType,
  ExternalHyperlink,
  ImageRun,
  UnderlineType,
} from 'docx';
import { marked, type Tokens } from 'marked';
import mermaid from 'mermaid';
import { sanitizeMermaidCode } from './mermaidGuardrail';

/**
 * Utility: HTML Entities Decoder
 */
function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Utility: Convert SVG string to PNG Uint8Array using browser Canvas constrained to standard A4 width
 */
export async function svgToPngData(
  svgString: string,
  maxWidth = 560
): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  if (typeof window === 'undefined') return null;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) return null;

    let width = parseFloat(svgEl.getAttribute('width') || '0');
    let height = parseFloat(svgEl.getAttribute('height') || '0');

    if (!width || !height) {
      const viewBox = svgEl.getAttribute('viewBox');
      if (viewBox) {
        const parts = viewBox.trim().split(/[\s,]+/).map(parseFloat);
        if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
          width = parts[2];
          height = parts[3];
        }
      }
    }

    if (!width || isNaN(width)) width = 600;
    if (!height || isNaN(height)) height = 400;

    let renderWidth = width;
    let renderHeight = height;
    if (renderWidth > maxWidth) {
      const ratio = maxWidth / renderWidth;
      renderWidth = maxWidth;
      renderHeight = Math.round(renderHeight * ratio);
    }

    svgEl.setAttribute('width', String(renderWidth));
    svgEl.setAttribute('height', String(renderHeight));
    if (!svgEl.getAttribute('xmlns')) {
      svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }

    const cleanSvgString = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([cleanSvgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const dpr = 2; // Crisp retina rendering for Word document
          canvas.width = renderWidth * dpr;
          canvas.height = renderHeight * dpr;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(url);
            resolve(null);
            return;
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);

          canvas.toBlob((blob) => {
            if (!blob) {
              resolve(null);
              return;
            }
            blob.arrayBuffer().then((buf) => {
              resolve({
                data: new Uint8Array(buf),
                width: renderWidth,
                height: renderHeight,
              });
            }).catch(() => resolve(null));
          }, 'image/png');
        } catch {
          URL.revokeObjectURL(url);
          resolve(null);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch (err) {
    console.warn('SVG conversion failed in docx exporter:', err);
    return null;
  }
}

/**
 * Utility: Render Mermaid code to PNG image
 */
let mermaidInit = false;
async function renderMermaidToPng(code: string, id: number): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  if (typeof window === 'undefined') return null;
  try {
    if (!mermaidInit) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      });
      mermaidInit = true;
    }
    const cleanCode = sanitizeMermaidCode(code);
    const containerId = `docx-mermaid-${id}-${Date.now()}`;
    const { svg } = await mermaid.render(containerId, cleanCode);
    return await svgToPngData(svg);
  } catch (err) {
    console.warn('Mermaid render for docx failed:', err);
    return null;
  }
}

/**
 * Utility: Fetch external or base64 image data to Uint8Array while preserving natural aspect ratio
 */
export async function fetchImageToBytes(
  src: string,
  maxWidth = 560,
  maxHeight = 500
): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  try {
    let rawBytes: Uint8Array | null = null;

    if (src.startsWith('data:image/')) {
      const commaIdx = src.indexOf(',');
      if (commaIdx !== -1) {
        const base64 = src.slice(commaIdx + 1);
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        rawBytes = bytes;
      }
    } else if (src.startsWith('http://') || src.startsWith('https://')) {
      const resp = await fetch(src);
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        rawBytes = new Uint8Array(buf);
      }
    }

    if (!rawBytes) return null;

    // Detect actual natural dimensions via Image element to preserve strict aspect ratio
    if (typeof window !== 'undefined') {
      const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
        const img = new Image();
        img.onload = () => {
          resolve({
            width: img.naturalWidth || 450,
            height: img.naturalHeight || 280,
          });
        };
        img.onerror = () => {
          resolve({ width: 450, height: 280 });
        };
        img.src = src;
      });

      let renderWidth = dimensions.width;
      let renderHeight = dimensions.height;

      // Scale proportionally if exceeding maxWidth
      if (renderWidth > maxWidth) {
        const ratio = maxWidth / renderWidth;
        renderWidth = maxWidth;
        renderHeight = Math.round(renderHeight * ratio);
      }

      // Scale proportionally if still exceeding maxHeight
      if (renderHeight > maxHeight) {
        const ratio = maxHeight / renderHeight;
        renderHeight = maxHeight;
        renderWidth = Math.round(renderWidth * ratio);
      }

      return { data: rawBytes, width: renderWidth, height: renderHeight };
    }

    return { data: rawBytes, width: 450, height: 280 };
  } catch (err) {
    console.warn('Failed to fetch image for docx:', err);
  }
  return null;
}

interface RunStyle {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  color?: string;
  size?: number;
  font?: string;
  underline?: { type: (typeof UnderlineType)[keyof typeof UnderlineType] };
  shading?: { fill: string };
}

/**
 * Recursively converts marked inline tokens into docx TextRun or ExternalHyperlink
 */
function buildRunsFromTokens(
  tokens?: Tokens.Generic[],
  inheritedStyle: RunStyle = {}
): (TextRun | ExternalHyperlink)[] {
  if (!tokens || tokens.length === 0) return [];
  const runs: (TextRun | ExternalHyperlink)[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'text': {
        const textToken = token as Tokens.Text;
        if (textToken.tokens && textToken.tokens.length > 0) {
          runs.push(...buildRunsFromTokens(textToken.tokens, inheritedStyle));
        } else {
          runs.push(
            new TextRun({
              text: decodeHtmlEntities(textToken.text),
              ...inheritedStyle,
            })
          );
        }
        break;
      }
      case 'strong': {
        const strongToken = token as Tokens.Strong;
        runs.push(
          ...buildRunsFromTokens(strongToken.tokens, {
            ...inheritedStyle,
            bold: true,
          })
        );
        break;
      }
      case 'em': {
        const emToken = token as Tokens.Em;
        runs.push(
          ...buildRunsFromTokens(emToken.tokens, {
            ...inheritedStyle,
            italics: true,
          })
        );
        break;
      }
      case 'del': {
        const delToken = token as Tokens.Del;
        runs.push(
          ...buildRunsFromTokens(delToken.tokens, {
            ...inheritedStyle,
            strike: true,
          })
        );
        break;
      }
      case 'codespan': {
        const codeToken = token as Tokens.Codespan;
        runs.push(
          new TextRun({
            text: ` ${decodeHtmlEntities(codeToken.text)} `,
            font: 'Consolas',
            size: 20, // 10pt
            color: '0f172a',
            shading: { fill: 'f1f5f9' },
          })
        );
        break;
      }
      case 'br': {
        runs.push(new TextRun({ break: 1 }));
        break;
      }
      case 'link': {
        const linkToken = token as Tokens.Link;
        const linkRuns = buildRunsFromTokens(linkToken.tokens || [{ type: 'text', text: linkToken.text }], {
          ...inheritedStyle,
          color: '0284c7',
          underline: { type: UnderlineType.SINGLE },
        });
        runs.push(
          new ExternalHyperlink({
            children: linkRuns,
            link: linkToken.href,
          })
        );
        break;
      }
      case 'html': {
        // Strip tags or process basic bold/italic tags
        const raw = (token as Tokens.HTML).text;
        const stripped = raw.replace(/<[^>]*>/g, '');
        if (stripped) {
          runs.push(
            new TextRun({
              text: decodeHtmlEntities(stripped),
              ...inheritedStyle,
            })
          );
        }
        break;
      }
      default: {
        if ('text' in token && typeof token.text === 'string') {
          runs.push(
            new TextRun({
              text: decodeHtmlEntities(token.text),
              ...inheritedStyle,
            })
          );
        }
        break;
      }
    }
  }

  return runs;
}

/**
 * Creates a beautifully styled code block table in Word
 */
function createCodeBlockElement(code: string, lang?: string): Table {
  const codeLines = code.split('\n');
  const paragraphs: Paragraph[] = [];

  // Language header badge
  if (lang) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: lang.toUpperCase(),
            font: 'Consolas',
            bold: true,
            size: 16, // 8pt
            color: '64748b',
          }),
        ],
        spacing: { after: 60 },
      })
    );
  }

  // Code lines with monospace font and line numbers/formatting
  for (const line of codeLines) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: line || ' ',
            font: 'Consolas',
            size: 19, // 9.5pt
            color: '0f172a',
          }),
        ],
        spacing: { line: 280, before: 0, after: 0 },
      })
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: paragraphs,
            shading: { fill: 'f8fafc' },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: 'e2e8f0' },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: 'e2e8f0' },
              left: { style: BorderStyle.SINGLE, size: 16, color: '0284c7' }, // Accent border
              right: { style: BorderStyle.SINGLE, size: 4, color: 'e2e8f0' },
            },
            margins: { top: 120, bottom: 120, left: 180, right: 180 },
          }),
        ],
      }),
    ],
  });
}

/**
 * Pre-processes markdown text: extracts raw SVG and Drawio diagrams
 */
function extractSpecialBlocks(markdown: string) {
  let clean = markdown;
  if (clean.startsWith('```markdown') && clean.endsWith('```')) {
    clean = clean.slice(11, -3).trim();
  }

  const svgBlocks: string[] = [];
  clean = clean.replace(/(?:^|\n)(`{3,}|~{3,})(?:xml|html|svg)?[^\n]*\r?\n\s*(<svg[\s\S]*?<\/svg>)\s*\r?\n\1/gi, (_m, _f, svg) => {
    const token = `__DOCX_SVG_BLOCK_${svgBlocks.length}__`;
    svgBlocks.push(svg.trim());
    return `\n\n${token}\n\n`;
  });
  clean = clean.replace(/(<div[\s\S]*?<svg[\s\S]*?<\/svg>[\s\S]*?<\/div>|<svg[\s\S]*?<\/svg>)/gi, (m) => {
    const token = `__DOCX_SVG_BLOCK_${svgBlocks.length}__`;
    svgBlocks.push(m.trim());
    return `\n\n${token}\n\n`;
  });

  return { cleanText: clean, svgBlocks };
}

/**
 * Main Generator: Converts Markdown to a styled docx Document object
 */
export async function generateDocxDocument(markdownContent: string, title: string = 'MDEdit Document'): Promise<Document> {
  const { cleanText, svgBlocks } = extractSpecialBlocks(markdownContent);
  const tokens = marked.lexer(cleanText);
  const elements: (Paragraph | Table)[] = [];

  let mermaidCount = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    switch (token.type) {
      case 'space':
        break;

      case 'heading': {
        const headingToken = token as Tokens.Heading;
        const depth = Math.min(Math.max(headingToken.depth, 1), 6);
        const headingLevels = [
          HeadingLevel.HEADING_1,
          HeadingLevel.HEADING_2,
          HeadingLevel.HEADING_3,
          HeadingLevel.HEADING_4,
          HeadingLevel.HEADING_5,
          HeadingLevel.HEADING_6,
        ];
        const headingSizes = [36, 28, 24, 22, 20, 18]; // half-points: 18pt, 14pt, 12pt, 11pt, 10pt, 9pt
        const headingColors = ['0f172a', '0284c7', '1e293b', '334155', '475569', '64748b'];

        const runs = buildRunsFromTokens(headingToken.tokens, {
          bold: true,
          size: headingSizes[depth - 1],
          color: headingColors[depth - 1],
        });

        elements.push(
          new Paragraph({
            heading: headingLevels[depth - 1],
            children: runs,
            spacing: {
              before: depth === 1 ? 360 : 260,
              after: depth === 1 ? 140 : 100,
            },
            border: depth === 1 ? {
              bottom: { style: BorderStyle.SINGLE, size: 8, color: '0284c7' },
            } : undefined,
          })
        );
        break;
      }

      case 'paragraph': {
        const paraToken = token as Tokens.Paragraph;
        const rawText = paraToken.raw.trim();

        // Check if paragraph is an SVG token placeholder
        const svgMatch = rawText.match(/^__DOCX_SVG_BLOCK_(\d+)__$/);
        if (svgMatch) {
          const idx = parseInt(svgMatch[1], 10);
          const svgContent = svgBlocks[idx];
          if (svgContent) {
            const pngResult = await svgToPngData(svgContent);
            if (pngResult) {
              elements.push(
                new Paragraph({
                  children: [
                    new ImageRun({
                      type: 'png',
                      data: pngResult.data,
                      transformation: {
                        width: pngResult.width,
                        height: pngResult.height,
                      },
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 180, after: 180 },
                })
              );
              break;
            }
          }
        }

        // Check if paragraph contains markdown images (e.g. ![alt](data:image/...) or ![alt](url))
        let hasRenderedImage = false;
        if (paraToken.tokens && paraToken.tokens.length > 0) {
          for (const inlineToken of paraToken.tokens) {
            if (inlineToken.type === 'image') {
              const imgToken = inlineToken as Tokens.Image;
              const imgData = await fetchImageToBytes(imgToken.href);
              if (imgData) {
                elements.push(
                  new Paragraph({
                    children: [
                      new ImageRun({
                        type: 'png',
                        data: imgData.data,
                        transformation: {
                          width: imgData.width,
                          height: imgData.height,
                        },
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 180, after: 180 },
                  })
                );
                if (imgToken.text) {
                  elements.push(
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: decodeHtmlEntities(imgToken.text),
                          italics: true,
                          size: 18, // 9pt
                          color: '64748b',
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 40, after: 120 },
                    })
                  );
                }
                hasRenderedImage = true;
              }
            }
          }
        }

        if (hasRenderedImage) {
          break;
        }

        // Standard paragraph
        const runs = buildRunsFromTokens(paraToken.tokens);
        if (runs.length > 0) {
          elements.push(
            new Paragraph({
              children: runs,
              spacing: { line: 320, after: 120 },
            })
          );
        }
        break;
      }

      case 'code': {
        const codeToken = token as Tokens.Code;
        const lang = (codeToken.lang || '').trim().toLowerCase();

        // 1. Mermaid diagram handling: Attempt to render to PNG image
        if (lang === 'mermaid') {
          mermaidCount++;
          const pngResult = await renderMermaidToPng(codeToken.text, mermaidCount);
          if (pngResult) {
            elements.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    type: 'png',
                    data: pngResult.data,
                    transformation: {
                      width: pngResult.width,
                      height: pngResult.height,
                    },
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 200 },
              })
            );
            break;
          }
        }

        // 2. Standard Code Block (or Mermaid fallback)
        elements.push(createCodeBlockElement(codeToken.text, codeToken.lang));
        break;
      }

      case 'blockquote': {
        const bqToken = token as Tokens.Blockquote;
        const bqParagraphs: (Paragraph | Table)[] = [];

        for (const subToken of bqToken.tokens) {
          if (subToken.type === 'paragraph') {
            const subRuns = buildRunsFromTokens((subToken as Tokens.Paragraph).tokens, {
              italics: true,
              color: '334155',
            });
            bqParagraphs.push(
              new Paragraph({
                children: subRuns,
                spacing: { line: 320, before: 60, after: 60 },
              })
            );
          }
        }

        elements.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: bqParagraphs.length > 0 ? bqParagraphs : [new Paragraph({ text: '' })],
                    shading: { fill: 'f8fafc' },
                    borders: {
                      left: { style: BorderStyle.SINGLE, size: 24, color: '0284c7' }, // thick blue accent bar
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    margins: { top: 100, bottom: 100, left: 180, right: 120 },
                  }),
                ],
              }),
            ],
          })
        );
        break;
      }

      case 'list': {
        const listToken = token as Tokens.List;
        const isOrdered = listToken.ordered;

        listToken.items.forEach((item, index) => {
          const itemRuns: (TextRun | ExternalHyperlink)[] = [];

          // Handle task list checkboxes
          if (item.task) {
            itemRuns.push(
              new TextRun({
                text: item.checked ? '☑ ' : '☐ ',
                bold: true,
                color: item.checked ? '0284c7' : '64748b',
                font: 'Segoe UI Symbol',
              })
            );
          }

          // Build content runs
          for (const itToken of item.tokens) {
            if (itToken.type === 'text') {
              const textIt = itToken as Tokens.Text;
              if (textIt.tokens && textIt.tokens.length > 0) {
                itemRuns.push(...buildRunsFromTokens(textIt.tokens));
              } else {
                itemRuns.push(new TextRun({ text: decodeHtmlEntities(textIt.text) }));
              }
            } else if (itToken.type === 'paragraph') {
              itemRuns.push(...buildRunsFromTokens((itToken as Tokens.Paragraph).tokens));
            }
          }

          if (isOrdered) {
            elements.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${index + 1}. `,
                    bold: true,
                    color: '0284c7',
                  }),
                  ...itemRuns,
                ],
                indent: { left: 400 },
                spacing: { line: 300, after: 60 },
              })
            );
          } else {
            elements.push(
              new Paragraph({
                children: itemRuns,
                bullet: { level: 0 },
                spacing: { line: 300, after: 60 },
              })
            );
          }
        });
        break;
      }

      case 'table': {
        const tableToken = token as Tokens.Table;
        const rows: TableRow[] = [];

        // Header Row
        const headerCells = tableToken.header.map((headCell, colIdx) => {
          const align = tableToken.align[colIdx];
          const alignment =
            align === 'center'
              ? AlignmentType.CENTER
              : align === 'right'
              ? AlignmentType.RIGHT
              : AlignmentType.LEFT;

          return new TableCell({
            children: [
              new Paragraph({
                children: buildRunsFromTokens(headCell.tokens, {
                  bold: true,
                  color: '0f172a',
                  size: 20, // 10pt
                }),
                alignment,
                spacing: { before: 60, after: 60 },
              }),
            ],
            shading: { fill: 'f1f5f9' },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: 'cbd5e1' },
              bottom: { style: BorderStyle.SINGLE, size: 12, color: '94a3b8' },
              left: { style: BorderStyle.SINGLE, size: 4, color: 'e2e8f0' },
              right: { style: BorderStyle.SINGLE, size: 4, color: 'e2e8f0' },
            },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
          });
        });

        rows.push(new TableRow({ children: headerCells, tableHeader: true }));

        // Body Rows
        tableToken.rows.forEach((row, rowIdx) => {
          const isEven = rowIdx % 2 === 0;
          const bodyCells = row.map((cell, colIdx) => {
            const align = tableToken.align[colIdx];
            const alignment =
              align === 'center'
                ? AlignmentType.CENTER
                : align === 'right'
                ? AlignmentType.RIGHT
                : AlignmentType.LEFT;

            return new TableCell({
              children: [
                new Paragraph({
                  children: buildRunsFromTokens(cell.tokens, {
                    size: 20, // 10pt
                  }),
                  alignment,
                  spacing: { before: 40, after: 40 },
                }),
              ],
              shading: { fill: isEven ? 'ffffff' : 'f8fafc' },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: 'e2e8f0' },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: 'e2e8f0' },
                left: { style: BorderStyle.SINGLE, size: 4, color: 'e2e8f0' },
                right: { style: BorderStyle.SINGLE, size: 4, color: 'e2e8f0' },
              },
              margins: { top: 80, bottom: 80, left: 140, right: 140 },
            });
          });

          rows.push(new TableRow({ children: bodyCells }));
        });

        elements.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows,
          })
        );
        break;
      }

      case 'hr': {
        elements.push(
          new Paragraph({
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 8, color: 'cbd5e1' },
            },
            spacing: { before: 200, after: 200 },
          })
        );
        break;
      }

      default:
        break;
    }
  }

  // Construct Document with global typography and styles
  const doc = new Document({
    creator: 'MDEdit',
    title: title,
    description: 'Exported from MDEdit Markdown Editor',
    styles: {
      default: {
        document: {
          run: {
            font: 'Segoe UI',
            size: 21, // ~10.5pt
            color: '1e293b',
          },
          paragraph: {
            spacing: { line: 320, after: 120 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906, // Standard A4 width in dxa (210mm)
              height: 16838, // Standard A4 height in dxa (297mm)
            },
            margin: {
              top: 1134, // 20mm in dxa
              right: 1134, // 20mm in dxa
              bottom: 1134, // 20mm in dxa
              left: 1134, // 20mm in dxa
            },
          },
        },
        children: elements.length > 0 ? elements : [new Paragraph({ text: ' ' })],
      },
    ],
  });

  return doc;
}

/**
 * Generates docx Blob
 */
export async function generateDocxBlob(markdownContent: string, title?: string): Promise<Blob> {
  const doc = await generateDocxDocument(markdownContent, title);
  return await Packer.toBlob(doc);
}

/**
 * Downloads or saves the Word Document (.docx)
 * Automatically utilizes Tauri native file dialog if available, or falls back to Web Blob download.
 */
export async function exportToWord(
  markdownContent: string,
  filename: string = 'document.docx',
  title?: string
): Promise<string | null> {
  const blob = await generateDocxBlob(markdownContent, title || filename.replace(/\.[^/.]+$/, ''));

  // 1. Check if running inside Tauri Desktop
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const dialogModuleName = '@tauri-apps/plugin-dialog';
      const fsModuleName = '@tauri-apps/plugin-fs';
      const coreModuleName = '@tauri-apps/api/core';

      const { save } = await import(/* @vite-ignore */ dialogModuleName);
      const { writeFile } = await import(/* @vite-ignore */ fsModuleName);
      const filePath = await save({
        filters: [{ name: 'Word Document (*.docx)', extensions: ['docx'] }],
        title: 'Export to MS Word Document',
        defaultPath: filename,
      });

      if (filePath) {
        const arrayBuf = await blob.arrayBuffer();
        try {
          const { invoke } = await import(/* @vite-ignore */ coreModuleName);
          await invoke('write_binary_file', { path: filePath, data: Array.from(new Uint8Array(arrayBuf)) });
        } catch {
          await writeFile(filePath, new Uint8Array(arrayBuf));
        }
        return filePath;
      }
      return null;
    } catch (err) {
      console.warn('Tauri native save encountered error, falling back to browser download:', err);
    }
  }

  // 2. Web Browser standard download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return filename;
}
