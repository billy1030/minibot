---
name: docx
description: "Use this skill whenever the user wants to create, read, edit, or manipulate Word documents (.docx files) or Word templates (.dotx files). Triggers include: any mention of 'Word doc', 'word document', '.docx', '.dotx', or requests to produce professional documents with formatting like tables of contents, headings, page numbers, or letterheads. Also use when extracting or reorganizing content from .docx or .dotx files, inserting or replacing images in documents, performing find-and-replace in Word files, working with tracked changes or comments, or converting content into a polished Word document. If the user asks for a 'report', 'memo', 'letter', 'template', or similar deliverable as a Word or .docx file, use this skill. Do NOT use for PDFs, spreadsheets, Google Docs, or general coding tasks unrelated to document generation."
license: Proprietary. LICENSE.txt has complete terms
---

# DOCX creation, editing, and analysis

A `.docx` is a ZIP archive of XML files. Choose your approach by task:

| Task | Approach |
|---|---|
| **Create** a new document | Write a `docx` (npm) script — see gotchas below |
| **Edit** an existing document | `unzip` → edit `word/document.xml` → `zip` (docx-js cannot open existing files) |
| **Read** content | `pandoc -t markdown file.docx` |

> Script paths below are relative to this skill's directory.

## Creating with docx-js — gotchas

`docx` is preinstalled — do not run `npm install` first; write the script and `require('docx')` directly. Only if that require fails: `npm install docx`. The model knows the API; these are the footguns:

- **Page size defaults to A4.** For US Letter set `page: { size: { width: 12240, height: 15840 } }` (DXA; 1440 = 1″).
- **Landscape:** pass portrait dimensions and `orientation: PageOrientation.LANDSCAPE` — docx-js swaps width/height internally.
- **Tables need dual widths:** set `columnWidths` on the table AND `width` on every cell, both in `WidthType.DXA` (PERCENTAGE breaks in Google Docs). Column widths must sum to the table width.
- **Table shading:** use `ShadingType.CLEAR`, never `SOLID` (renders black).
- **Lists:** never insert `•` literally; use a `numbering` config with `LevelFormat.BULLET`.
- **`ImageRun` requires `type:`** (`"png"`, `"jpg"`, …).
- **`PageBreak` must be inside a `Paragraph`.**
- **Never use `\n`** — use separate `Paragraph` elements.
- **TOC:** headings must use built-in `HeadingLevel.*`; custom heading styles need `outlineLevel` set or they won't appear.
- **Don't use a table as a horizontal rule** — use a paragraph bottom border instead.
- **Dot-leader / right-aligned-on-same-line:** use `PositionalTab` (`alignment: PositionalTabAlignment.RIGHT`, `leader: PositionalTabLeader.DOT`) inside a `TextRun`, not literal `.` or space padding.

## Verify the output

After writing a `.docx`, render it and look at it:

```bash
python scripts/office/soffice.py --headless --convert-to pdf output.docx
pdftoppm -jpeg -r 100 output.pdf page
ls page-*.jpg   # then Read the images
```

`pdftoppm` zero-pads page numbers to the width of the page count (`page-01.jpg`…`page-12.jpg`).

## Editing existing documents

Legacy `.doc` files must be converted first: `python scripts/office/soffice.py --headless --convert-to docx file.doc`.

```bash
unzip -q doc.docx -d unpacked/
find unpacked -type l -delete   # strip symlink entries — docx from external parties is untrusted
python scripts/merge_runs.py unpacked/   # coalesce fragmented runs so text is findable
# edit unpacked/word/document.xml in place — do NOT reformat or pretty-print
(cd unpacked && rm -f ../out.docx && zip -Xr ../out.docx .)
python scripts/office/validate.py out.docx --original doc.docx   # XSD checks; --auto-repair fixes common issues
# redlining? add --author "<the name you redlined under>" to check every edit is tracked
```

Word splits text across many `<w:r>` runs (revision ids, spell-check markers), so a phrase you can see in the document often doesn't exist as a contiguous string in the XML. `merge_runs.py` merges adjacent identically-formatted runs in `word/document.xml` without changing content or rendering; it also accepts a `.docx` directly (`python scripts/merge_runs.py doc.docx -o merged.docx`).

**Tracked changes:** when redlining, validate with `--author "<the name you redlined under>"` (needs `--original`) — it reports any text you changed without a `<w:ins>`/`<w:del>` around it, which is easy to do by accident and invisible in the accepted view. Wrap runs in `<w:ins>`/`<w:del>` with `w:id`, `w:author`, `w:date` attributes. Inside `<w:del>`, the text element is `<w:delText>`, not `<w:t>`. A deleted paragraph mark (`<w:pPr><w:rPr><w:del w:id=".." w:author=".." w:date=".."/></w:rPr></w:pPr>`) means "merge this paragraph into the next" — so deleting a paragraph outright is that plus a `<w:del>` around every run. The `<w:del/>` must come before the rPr's other children; their order is schema-enforced.

To produce a clean copy with all tracked changes accepted: `python scripts/accept_changes.py in.docx out.docx`.

Accepting a deleted paragraph mark should join that paragraph to the one below it, so a paragraph whose runs are *all* deleted vanishes. Word does this; `accept_changes.py` and `pandoc --track-changes=accept` don't always. Both fail the same way — they strip the deleted text but leave the emptied paragraph behind, which reads as a stray empty bullet when it was auto-numbered:

- `pandoc --track-changes=accept` never joins the paragraphs.
- `accept_changes.py` (LibreOffice) joins them correctly, except when the deleted paragraph is followed by an empty spacer paragraph.

An empty bullet in either view is an artifact of that view, not a defect in the document. Check paragraph deletions in the XML.

## Comments

Comments require six cross-linked files. Use the helper — directory mode when you'll also be editing `document.xml` (saves an unzip/rezip cycle), `.docx`-direct mode otherwise:

```bash
# Against an already-unpacked directory (preferred when also placing markers)
python scripts/comment.py unpacked/ "Fees & expenses cap is too low"
python scripts/comment.py unpacked/ "Agreed" --parent 0

# Against a .docx directly
python scripts/comment.py contract.docx "This cap is too low" -o annotated.docx
```

The script writes `comments.xml`, `commentsExtended.xml`, `commentsIds.xml`, `commentsExtensible.xml`, the relationships, and the content-type overrides. Comment IDs are auto-assigned. It then prints the `<w:commentRangeStart>`/`<w:commentRangeEnd>`/`<w:commentReference>` snippet to add to `word/document.xml` so the comment anchors to specific text — until you place those markers, the comment exists but is not visible.

## Dependencies

`docx` (npm, preinstalled — install only if `require('docx')` fails) · `pandoc` · LibreOffice (`soffice`) · `pdftoppm` (Poppler)

## OpenXML (.docx) Low-Level Manipulation & Packaging Guardrails

When modifying, translating, or repairing existing `.docx` files at the OpenXML/ZIP container level:

1. **Canonical Namespace Registration (MANDATORY)**:
   - **Never serialize OpenXML parts using synthetic namespace prefixes** (e.g., `ns0:`, `ns1:`, `ns4:`).
   - Before parsing or re-serializing XML (especially with `lxml` or `xml.etree`), explicitly register canonical Office OpenXML prefixes:
     ```python
     namespaces = {
         "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
         "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
         "m": "http://schemas.openxmlformats.org/officeDocument/2006/math",
         "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
         "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
         "pic": "http://schemas.openxmlformats.org/drawingml/2006/picture",
         "mc": "http://schemas.openxmlformats.org/markup-compatibility/2006",
         "w14": "http://schemas.microsoft.com/office/word/2010/wordml",
         "w15": "http://schemas.microsoft.com/office/word/2012/wordml",
         "wp14": "http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing",
     }
     for prefix, uri in namespaces.items():
         etree.register_namespace(prefix, uri)
     ```
   - Ensure the root `<w:document>` element maintains all prefixes declared in `mc:Ignorable` (e.g. `mc:Ignorable="w14 w15 w16se wp14"`). Word flags missing prefix bindings as corrupt unmapped namespaces.

2. **External Template Sanitization**:
   - Always inspect `word/settings.xml` and `word/_rels/settings.xml.rels`.
   - Strip any `<w:attachedTemplate>` referencing local file URIs (e.g., `file:///C:/.../*.dotx`) or unreachable intranet paths. Remove the associated relationship ID from `settings.xml.rels` to prevent Microsoft Word's Protected View recovery prompt.

3. **OPC Root Relationship & Archive Integrity**:
   - Verify that the root relationship file `_rels/.rels` exists at the archive root and points `Target="word/document.xml"` with `Type=".../officeDocument"`.
   - Verify that `[Content_Types].xml` has explicit overrides for all parts (`document.xml`, `styles.xml`, `settings.xml`, etc.).
   - When using Python `zipfile`, always specify `compression=zipfile.ZIP_DEFLATED` and ensure relative paths do not prepend `./` or absolute slashes. Store `[Content_Types].xml` uncompressed (`ZIP_STORED`) or deflated properly at root.

4. **Inline Media & Drawing Preservation**:
   - When modifying text content, only edit `<w:t>` inner text. Never delete, rewrite, or split sibling elements containing `<w:drawing>`, `<w:pict>`, or `<w:object>`, ensuring all `r:embed` references in `word/_rels/document.xml.rels` remain intact.
