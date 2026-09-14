import { unzipSync } from "fflate";
import { ExtractionError } from "./errors.ts";
import type { Extraction } from "./errors.ts";

const DOCUMENT_PART = "word/document.xml";

/** WordprocessingML, in its transitional (what Word writes) and strict namespaces. */
const W_NAMESPACES = new Set([
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  "http://purl.oclc.org/ooxml/wordprocessingml/main",
]);
const MC_NAMESPACE = "http://schemas.openxmlformats.org/markup-compatibility/2006";

/**
 * The DOCX text rule: what "the Word file's own text" means in Redline. Source sentence offsets
 * point into the string `joinDocxBlocks` returns, and every character in it comes from the choices
 * written here. Nothing else puts DOCX text together.
 *
 * Which parts are read:
 * - `word/document.xml` only: the body, walked in document order, including tables, content
 *   controls and text boxes. Footnotes, endnotes, comments, headers and footers are not read,
 *   because a Source sentence has to be findable in the body the Signer reads as the Document.
 * - Text boxes (`w:txbxContent`) are read. Their paragraphs come straight after the paragraph that
 *   anchors them. Word stores a text box twice (`mc:Choice` and the older `mc:Fallback`); only
 *   `mc:Choice` is read, so its text appears once.
 * - Fields: the displayed result is read; the field code (`w:instrText`) is not.
 *
 * Characters, inside a paragraph:
 * - `w:t`: its text exactly as stored. Whitespace in `w:t` is literal: nothing is trimmed or
 *   collapsed. A sentence split across formatting runs comes out contiguous, since runs add nothing
 *   between them.
 * - `w:tab` and `w:ptab` → `"\t"`.
 * - `w:br` (any type, page breaks included) and `w:cr` → `"\n"`.
 * - `w:noBreakHyphen` → `"-"`.
 * - `w:softHyphen` → nothing. It is a hyphenation hint Word shows only when a line wraps there.
 * - `w:sym` → nothing. It names a glyph in a symbol font, not a character.
 * - Tracked changes: inserted text (`w:ins`, `w:moveTo`) is included, deleted text (`w:del`,
 *   `w:delText`, `w:moveFrom`) is not. The Document is read as if every change were accepted.
 *   Table rows marked deleted are left out too.
 * - Hidden text (a run with `w:vanish`) is left out, because the Signer never sees it.
 *
 * Blocks:
 * - Each paragraph is one block. Each table row is one block: its cells in order, separated by
 *   `"\t"`; a cell holding several paragraphs (or a nested table) joins its own blocks with `"\n"`.
 * - Blocks are separated by a single `"\n"`. Nothing goes before the first block or after the last.
 *   An empty paragraph is still a block, so a body whose last paragraph is empty (Word's usual
 *   paragraph after a final table) ends in `"\n"`.
 *
 * No whitespace collapsing, no trimming, no de-hyphenation, no paragraph reflow.
 */
export function joinDocxBlocks(blocks: readonly string[]): string {
  return blocks.join("\n");
}

/**
 * Reads a DOCX's text under the DOCX text rule. A body with no text other than whitespace (for
 * example a page pasted in as a picture) yields `no-text`. Anything that is not a readable DOCX (not
 * a zip, no `word/document.xml`, XML that does not parse, no `w:body`) throws an `ExtractionError`
 * with code `invalid-docx`; no partial text is ever returned.
 */
export function extractDocxText(data: Uint8Array): Extraction {
  const body = readBody(data);
  const text = joinDocxBlocks(blocksOf(body));
  if (text.trim() === "") return { kind: "no-text" };
  return { kind: "text", text };
}

function readBody(data: Uint8Array): Element {
  let xml: string;
  try {
    const entries = unzipSync(data, { filter: (entry) => entry.name === DOCUMENT_PART });
    const part = entries[DOCUMENT_PART];
    if (!part) throw new Error(`The file has no ${DOCUMENT_PART}.`);
    xml = new TextDecoder("utf-8", { fatal: true }).decode(part);
  } catch (cause) {
    throw new ExtractionError("invalid-docx", { cause });
  }

  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.getElementsByTagNameNS("*", "parsererror").length > 0) {
    throw new ExtractionError("invalid-docx", { cause: new Error(`${DOCUMENT_PART} is not well-formed XML.`) });
  }
  const root = document.documentElement;
  const body = root && isW(root, "document") ? childElements(root).find((child) => isW(child, "body")) : undefined;
  if (!body) {
    throw new ExtractionError("invalid-docx", { cause: new Error(`${DOCUMENT_PART} has no w:document/w:body.`) });
  }
  return body;
}

/** Blocks of a container that holds paragraphs and tables: the body, a cell, a text box. */
function blocksOf(container: Element): string[] {
  const blocks: string[] = [];
  for (const child of childElements(container)) {
    if (isW(child, "p")) {
      const textBoxBlocks: string[] = [];
      blocks.push(inlineText(child, textBoxBlocks));
      blocks.push(...textBoxBlocks);
    } else if (isW(child, "tbl")) {
      for (const row of rowsOf(child)) {
        blocks.push(cellsOf(row).map((cell) => joinDocxBlocks(blocksOf(cell))).join("\t"));
      }
    } else if (isWrapper(child)) {
      blocks.push(...blocksOf(child));
    }
  }
  return blocks;
}

function rowsOf(table: Element): Element[] {
  return collect(table, "tr").filter((row) => !rowIsDeleted(row));
}

function cellsOf(row: Element): Element[] {
  return collect(row, "tc");
}

/** Direct children named `name`, looking through content controls and revision wrappers. */
function collect(parent: Element, name: string): Element[] {
  const found: Element[] = [];
  for (const child of childElements(parent)) {
    if (isW(child, name)) found.push(child);
    else if (isWrapper(child)) found.push(...collect(child, name));
  }
  return found;
}

function rowIsDeleted(row: Element): boolean {
  const properties = childElements(row).find((child) => isW(child, "trPr"));
  return properties !== undefined && childElements(properties).some((child) => isW(child, "del"));
}

/** Elements that only wrap block content: content controls, custom XML, inserted content. */
function isWrapper(element: Element): boolean {
  return ["sdt", "sdtContent", "customXml", "ins", "moveTo"].some((name) => isW(element, name));
}

/** Skipped with everything inside them. */
const SKIPPED = new Set(["pPr", "rPr", "trPr", "tcPr", "tblPr", "sdtPr", "del", "delText", "moveFrom", "instrText", "delInstrText", "sym"]);

function inlineText(element: Element, textBoxBlocks: string[]): string {
  let text = "";
  for (const child of childElements(element)) {
    if (child.namespaceURI === MC_NAMESPACE && child.localName === "Fallback") continue;
    if (!W_NAMESPACES.has(child.namespaceURI ?? "")) {
      text += inlineText(child, textBoxBlocks);
      continue;
    }
    switch (child.localName) {
      case "t":
        text += child.textContent ?? "";
        break;
      case "tab":
      case "ptab":
        text += "\t";
        break;
      case "br":
      case "cr":
        text += "\n";
        break;
      case "noBreakHyphen":
        text += "-";
        break;
      case "softHyphen":
        break;
      case "txbxContent":
        textBoxBlocks.push(...blocksOf(child));
        break;
      case "r":
        if (!runIsHidden(child)) text += inlineText(child, textBoxBlocks);
        break;
      default:
        if (!SKIPPED.has(child.localName)) text += inlineText(child, textBoxBlocks);
    }
  }
  return text;
}

function runIsHidden(run: Element): boolean {
  const properties = childElements(run).find((child) => isW(child, "rPr"));
  if (!properties) return false;
  const vanish = childElements(properties).find((child) => isW(child, "vanish"));
  if (!vanish) return false;
  // <w:vanish w:val="false"/> (or "0", "off") turns hiding off.
  const value = attributeW(vanish, "val");
  return value === null || !["false", "0", "off"].includes(value);
}

function attributeW(element: Element, name: string): string | null {
  for (const namespace of W_NAMESPACES) {
    const value = element.getAttributeNS(namespace, name);
    if (value !== null && value !== "") return value;
  }
  return null;
}

function isW(element: Element, localName: string): boolean {
  return element.localName === localName && W_NAMESPACES.has(element.namespaceURI ?? "");
}

function childElements(element: Element): Element[] {
  return Array.from(element.children);
}
