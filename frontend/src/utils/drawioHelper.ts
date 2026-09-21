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

  // 2. Fix double-escaped HTML inside value="..." (e.g. &lt;b style=&quot;...&gt;)
  // If a value contains escaped HTML tags like &lt;b or &lt;span, unescape them so Draw.io renders them formatted
  trimmed = trimmed.replace(/value="([^"]*)"/g, (match, val) => {
    if (val.includes('&lt;') && (val.includes('&lt;b') || val.includes('&lt;span') || val.includes('&lt;div') || val.includes('&lt;font'))) {
      const unescapedVal = val
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, "'");
      return `value="${unescapedVal}"`;
    }
    return match;
  });

  return trimmed;
}

/**
 * Encodes Draw.io XML for embedding or URL hash passing into diagrams.net editor.
 */
export function createDiagramsNetEditUrl(xml: string): string {
  const encoded = encodeURIComponent(xml.trim());
  return `https://app.diagrams.net/#R${encoded}`;
}
