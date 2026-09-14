import { ExtractionError } from "./errors.ts";
import type { Extraction } from "./errors.ts";

/** The part of a pdfjs text item that extraction reads. */
export type PdfTextItem = { str: string; hasEOL: boolean };

/** The part of the pdfjs module that extraction uses: the legacy and browser builds both fit. */
export type PdfjsModule = {
  getDocument(source: {
    data: Uint8Array;
    stopAtErrors: boolean;
    isEvalSupported: boolean;
    verbosity: number;
  }): {
    promise: Promise<{
      numPages: number;
      getPage(pageNumber: number): Promise<{
        getTextContent(params: { disableNormalization: boolean }): Promise<{ items: readonly object[] }>;
      }>;
    }>;
    destroy(): Promise<void>;
  };
};

/**
 * The join rule: what "the PDF's own text" means in Redline. Source sentence offsets point into the
 * string this function returns, so it is the only place PDF text items are put together.
 *
 * - Pages in page order.
 * - Within a page, text items in the order pdfjs returns them (content-stream order).
 * - Each item's `str` is appended exactly as pdfjs gives it, read with `disableNormalization: true`.
 * - `"\n"` is appended after every item whose `hasEOL` is true.
 * - Pages are separated by a single `"\n"`; nothing goes before the first page or after the last.
 *
 * Nothing else happens: no whitespace collapsing, no trimming, no de-hyphenation, no paragraph
 * reflow. One property of pdfjs itself belongs here too: it reads whitespace glyphs as spacing, not
 * as characters, so a run of spaces inside a PDF string reaches this function as at most one `" "`
 * and a space at the end of a line not at all. That happens before the items exist, so the rule
 * cannot and does not change it.
 */
export function joinPdfPages(pages: readonly (readonly PdfTextItem[])[]): string {
  return pages
    .map((items) => items.map((item) => (item.hasEOL ? `${item.str}\n` : item.str)).join(""))
    .join("\n");
}

/**
 * Reads a PDF's text under the join rule. A PDF in which any page carries no text other than
 * whitespace is treated as a scan and yields `no-text` as a whole: checking only the pages that
 * have text would analyse part of the Document without saying so. Bytes pdfjs cannot parse throw an
 * `ExtractionError` with code `invalid-pdf`; no partial text is ever returned.
 */
export async function extractPdfText(data: Uint8Array, pdfjs: PdfjsModule): Promise<Extraction> {
  // stopAtErrors: a damaged file fails outright instead of pdfjs skipping what it cannot parse.
  const task = pdfjs.getDocument({ data, stopAtErrors: true, isEvalSupported: false, verbosity: 0 });
  try {
    let pages: PdfTextItem[][];
    try {
      const document = await task.promise;
      pages = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent({ disableNormalization: true });
        // Marked-content entries carry no `str`; only text items are part of the text.
        pages.push(content.items.filter(isTextItem));
      }
    } catch (cause) {
      throw new ExtractionError("invalid-pdf", { cause });
    }

    const everyPageHasText =
      pages.length > 0 && pages.every((items) => items.some((item) => item.str.trim() !== ""));
    if (!everyPageHasText) return { kind: "no-text" };
    return { kind: "text", text: joinPdfPages(pages) };
  } finally {
    await task.destroy();
  }
}

function isTextItem(item: object): item is PdfTextItem {
  return "str" in item && typeof item.str === "string" && "hasEOL" in item;
}
