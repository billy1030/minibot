/**
 * Utility functions for detecting, unpacking, and handling Draw.io (diagrams.net) XML documents.
 */

/**
 * Check if the provided text looks like a Draw.io XML document.
 */
export function isDrawioXml(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  return (
    trimmed.includes('<mxfile') ||
    trimmed.includes('<mxGraphModel') ||
    (trimmed.includes('<diagram') && (trimmed.includes('mxGraphModel') || /<diagram[^>]*>[A-Za-z0-9+/=]+<\/diagram>/.test(trimmed)))
  );
}

/**
 * Decompresses Draw.io deflated payload (base64 -> url-decode -> raw xml) using standard Web APIs.
 */
export async function unpackDrawioDiagram(compressedBase64: string): Promise<string> {
  try {
    const trimmed = compressedBase64.trim();
    // 1. Decode base64 to binary byte array
    const binaryStr = atob(trimmed);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // 2. Inflate raw deflate stream (Draw.io uses raw deflate without zlib headers)
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(bytes);
        writer.close();
        const response = new Response(ds.readable);
        const arrayBuf = await response.arrayBuffer();
        const text = new TextDecoder().decode(arrayBuf);
        // Draw.io applies encodeURIComponent before deflating
        try {
          return decodeURIComponent(text);
        } catch {
          return text;
        }
      } catch {
        // Fallback to plain deflate if deflate-raw is not accepted
        const ds = new DecompressionStream('deflate');
        const writer = ds.writable.getWriter();
        writer.write(bytes);
        writer.close();
        const response = new Response(ds.readable);
        const arrayBuf = await response.arrayBuffer();
        const text = new TextDecoder().decode(arrayBuf);
        try {
          return decodeURIComponent(text);
        } catch {
          return text;
        }
      }
    }

    return trimmed;
  } catch (err) {
    console.warn('[DrawioHelper] Failed to unpack compressed diagram:', err);
    return compressedBase64;
  }
}

/**
 * Extracts and unpacks the inner XML model if it is compressed inside a <diagram> tag,
 * and fixes double-escaped HTML in node values so Draw.io formats them as rich HTML instead of printing raw <b> tags.
 */
export async function extractDrawioXml(rawContent: string): Promise<string> {
  if (!rawContent) return '';
  let trimmed = rawContent.trim();

  // 1. Check if there is a <diagram>...</diagram> tag with compressed payload
  const match = /<diagram[^>]*>([\s\S]*?)<\/diagram>/i.exec(trimmed);
  if (match && match[1]) {
    const innerContent = match[1].trim();
    if (!innerContent.startsWith('<')) {
      const decompressed = await unpackDrawioDiagram(innerContent);
      if (decompressed && decompressed.includes('<mxGraphModel')) {
        trimmed = decompressed;
      }
    }
  }

  // 2. Parse XML with DOMParser if available, to properly unescape and configure cells
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, 'application/xml');
      const cells = doc.querySelectorAll('mxCell');
      let changed = false;

      cells.forEach((cell) => {
        let val = cell.getAttribute('value');
        let style = cell.getAttribute('style') || '';

        if (val) {
          // If value has escaped tags like &lt;b or raw tags like <b
          if (val.includes('&lt;') || val.includes('<b') || val.includes('<span') || val.includes('<font') || val.includes('<div')) {
            // Unescape entities
            const unescaped = val
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&apos;/g, "'")
              .replace(/&amp;/g, '&');

            if (unescaped !== val) {
              cell.setAttribute('value', unescaped);
              changed = true;
            }

            // Ensure html=1 is in cell style so mxGraph treats it as rich formatted HTML
            if (!style.includes('html=1')) {
              style = style ? `html=1;${style}` : 'html=1;';
              cell.setAttribute('style', style);
              changed = true;
            }
          }
        }
      });

      if (changed) {
        const serializer = new XMLSerializer();
        trimmed = serializer.serializeToString(doc);
      }
    } catch (e) {
      console.warn('[DrawioHelper] DOM parsing failed, falling back to regex:', e);
    }
  }

  return trimmed;
}

/**
 * Encodes Draw.io XML for embedding or URL hash passing into diagrams.net editor.
 */
export function createDiagramsNetEditUrl(xml: string): string {
  const encoded = encodeURIComponent(xml.trim());
  return `https://app.diagrams.net/#R${encoded}`;
}
