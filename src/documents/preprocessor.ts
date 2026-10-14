import * as XLSX from "xlsx";
import mammoth from "mammoth";
import * as pdfParseModule from "pdf-parse";

export interface PreprocessResult {
  text: string;
  charCount: number;
  sheetCount?: number;
  sheetNames?: string[];
  previewSnippet: string;
}

/**
 * Convert any 2D table array into a cleanly aligned Markdown table.
 */
function toMarkdownTable(data: any[][]): string {
  if (!data || data.length === 0) return "*(Empty table)*\n";

  // Filter out completely empty rows
  const cleanRows = data.filter((row) =>
    row && row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== "")
  );

  if (cleanRows.length === 0) return "*(Empty table)*\n";

  // Determine max columns
  const maxCols = Math.max(...cleanRows.map((r) => r.length));
  if (maxCols === 0) return "*(Empty table)*\n";

  // Normalize row length
  const normalizedRows = cleanRows.map((r) => {
    const rowCopy = [...r];
    while (rowCopy.length < maxCols) rowCopy.push("");
    return rowCopy.map((cell) => {
      if (cell === null || cell === undefined) return "";
      const str = String(cell).replace(/[\r\n]+/g, " ").replace(/\|/g, "\\|").trim();
      return str;
    });
  });

  const headerRow = normalizedRows[0];
  const bodyRows = normalizedRows.slice(1);

  let md = `| ${headerRow.join(" | ")} |\n`;
  md += `| ${headerRow.map(() => "---").join(" | ")} |\n`;

  for (const row of bodyRows) {
    md += `| ${row.join(" | ")} |\n`;
  }

  return md + "\n";
}

/**
 * Preprocess Excel files (.xlsx, .xls, .csv) with multi-tab Markdown tables
 */
export function preprocessExcel(buffer: Buffer, fileName: string): PreprocessResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, cellNF: true, raw: false });
  const sheetNames = workbook.SheetNames || [];

  const parts: string[] = [
    `================================================================================`,
    `📊 [Attached Excel Workbook]: ${fileName}`,
    `📑 [Total Sheets]: ${sheetNames.length} (${sheetNames.join(", ")})`,
    `⏰ [Processed At]: ${new Date().toISOString()}`,
    `================================================================================\n`,
  ];

  for (let i = 0; i < sheetNames.length; i++) {
    const sheetName = sheetNames[i];
    const sheet = workbook.Sheets[sheetName];
    parts.push(`## 📑 Sheet ${i + 1}/${sheetNames.length}: [${sheetName}]\n`);

    if (!sheet || !sheet["!ref"]) {
      parts.push("*(This sheet is empty)*\n\n---\n");
      continue;
    }

    // Convert sheet to array of arrays
    const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });

    const mdTable = toMarkdownTable(rawData);
    parts.push(mdTable);
    parts.push("\n---\n");
  }

  const fullText = parts.join("\n");
  return {
    text: fullText,
    charCount: fullText.length,
    sheetCount: sheetNames.length,
    sheetNames,
    previewSnippet: fullText.slice(0, 1024),
  };
}

/**
 * Preprocess PDF files (.pdf)
 */
export async function preprocessPdf(buffer: Buffer, fileName: string): Promise<PreprocessResult> {
  let extractedText = "";
  try {
    const mod: any = pdfParseModule;
    const PDFParseClass = mod.PDFParse || mod.default?.PDFParse;
    if (PDFParseClass) {
      const instance = new PDFParseClass({ data: buffer });
      const res = await instance.getText();
      extractedText = (res?.text || (typeof res === "string" ? res : "")).trim();
      if (instance.destroy) await instance.destroy();
    } else {
      const parserFn = typeof mod === "function" ? mod : mod.default;
      if (typeof parserFn === "function") {
        const data = await parserFn(buffer);
        extractedText = (data.text || "").trim();
      } else {
        extractedText = "[PDF Note]: PDF parser module loaded without text extractor.";
      }
    }
  } catch (err: any) {
    extractedText = `[PDF Extraction Note]: ${err.message}`;
  }

  const header = `================================================================================\n📄 [Attached PDF Document]: ${fileName}\n⏰ [Processed At]: ${new Date().toISOString()}\n================================================================================\n\n`;
  const fullText = header + extractedText;

  return {
    text: fullText,
    charCount: fullText.length,
    previewSnippet: fullText.slice(0, 1024),
  };
}

/**
 * Preprocess Word files (.docx)
 */
export async function preprocessWord(buffer: Buffer, fileName: string): Promise<PreprocessResult> {
  let extractedText = "";
  try {
    const result = await mammoth.extractRawText({ buffer });
    extractedText = (result.value || "").trim();
  } catch (err: any) {
    extractedText = `[Word Extraction Note]: ${err.message}`;
  }

  const header = `================================================================================\n📝 [Attached Word Document]: ${fileName}\n⏰ [Processed At]: ${new Date().toISOString()}\n================================================================================\n\n`;
  const fullText = header + extractedText;

  return {
    text: fullText,
    charCount: fullText.length,
    previewSnippet: fullText.slice(0, 1024),
  };
}

/**
 * Preprocess Plaintext / Markdown / Code / HTML
 */
export function preprocessText(buffer: Buffer, fileName: string): PreprocessResult {
  let rawText = "";
  try {
    rawText = buffer.toString("utf-8");
  } catch {
    rawText = buffer.toString("binary");
  }

  // Strip simple HTML tags if html file
  if (fileName.endsWith(".html") || fileName.endsWith(".htm")) {
    rawText = rawText.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    rawText = rawText.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
    rawText = rawText.replace(/<[^>]+>/g, " ");
    rawText = rawText.replace(/&nbsp;/g, " ");
  }

  const header = `================================================================================\n📋 [Attached Text/Code Document]: ${fileName}\n⏰ [Processed At]: ${new Date().toISOString()}\n================================================================================\n\n`;
  const fullText = header + rawText.trim();

  return {
    text: fullText,
    charCount: fullText.length,
    previewSnippet: fullText.slice(0, 1024),
  };
}

/**
 * Preprocess Image attachments (.png, .jpg, .jpeg, .webp, .gif)
 */
export function preprocessImage(buffer: Buffer, fileName: string): PreprocessResult {
  const sizeKb = (buffer.length / 1024).toFixed(1);
  const header = `================================================================================\n🖼️ [Attached Image File]: ${fileName}\n⏰ [Processed At]: ${new Date().toISOString()}\n================================================================================\n\n`;
  const info = `[Visual Image: ${fileName} (${sizeKb} KB)]\nThis image has been ingested and forwarded directly to the multimodal vision LLM pipeline for high-fidelity visual recognition and analysis.\n`;
  const fullText = header + info;

  return {
    text: fullText,
    charCount: fullText.length,
    previewSnippet: `[Attached Image: ${fileName} (${sizeKb} KB) - Multimodal Vision Enabled]`,
  };
}

/**
 * Master dispatcher for document conversion
 */
export async function preprocessDocument(buffer: Buffer, fileName: string): Promise<PreprocessResult> {
  const lowerName = fileName.toLowerCase();

  if (
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".webp") ||
    lowerName.endsWith(".gif")
  ) {
    return preprocessImage(buffer, fileName);
  }
  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".csv")) {
    return preprocessExcel(buffer, fileName);
  }
  if (lowerName.endsWith(".pdf")) {
    return await preprocessPdf(buffer, fileName);
  }
  if (lowerName.endsWith(".docx")) {
    return await preprocessWord(buffer, fileName);
  }
  return preprocessText(buffer, fileName);
}
