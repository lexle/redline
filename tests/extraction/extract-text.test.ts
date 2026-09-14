import { describe, expect, it } from "vitest";
import { ExtractionError, extractText } from "../../lib/extraction/extract-text.ts";
import { buildPdf, pdfString } from "../support/minimal-pdf.ts";

/*
 * The join rule these tests hold extraction to (defined once, in lib/extraction/pdf.ts):
 * pages in page order; within a page, pdfjs text items in the order pdfjs returns them; each
 * item's `str` appended exactly as given; "\n" after every item whose `hasEOL` is true; pages
 * separated by a single "\n". No whitespace collapsing, no trimming, no de-hyphenation, no reflow.
 *
 * pdfjs reads whitespace glyphs as spacing: a run of spaces inside one PDF string becomes one " ",
 * a space at the end of a line disappears, and a horizontal gap between strings (a TJ kerning jump
 * or a Td move) becomes a " " item. That is the PDF's text content as pdfjs defines it, before
 * the join rule runs, so the expected strings below are written against it.
 */

const LEADING = "BT /F1 12 Tf 72 720 Td 14 TL\n";

function textPage(lines: readonly string[]): string {
  return LEADING + lines.map((line, index) => `${index ? "T* " : ""}${pdfString(line)} Tj\n`).join("") + "ET";
}

function pdfFile(bytes: Uint8Array<ArrayBuffer>,name: string, type = "application/pdf"): File {
  return new File([bytes], name, { type });
}

describe("extractText on a PDF", () => {
  it("returns the text exactly under the join rule, keeping line breaks, the hyphen and the gaps", async () => {
    const content =
      LEADING +
      `${pdfString("The Contractor shall pay  all costs. ")} Tj\n` +
      `T* ${pdfString("This con-")} Tj\n` +
      `T* ${pdfString("tract ends when the Client")} Tj\n` +
      `T* ${pdfString("says so, and the Client may")} Tj\n` +
      `T* [${pdfString("keep")} -3000 ${pdfString("every")}] TJ 150 0 Td ${pdfString("deliverable.")} Tj\n` +
      "ET";
    const file = pdfFile(buildPdf([{ content }]), "agreement.pdf");

    const extraction = await extractText(file);

    expect(extraction).toEqual({
      kind: "text",
      text:
        "The Contractor shall pay all costs.\n" +
        "This con-\n" +
        "tract ends when the Client\n" +
        "says so, and the Client may\n" +
        "keep every deliverable.",
    });
  });

  it("joins the pages of a two-page PDF with a single line break", async () => {
    const bytes = buildPdf([
      { content: textPage(["1. Fees are due on signing.", "2. Work starts on payment."]) },
      { content: textPage(["3. Either party may end this", "agreement in writing."]) },
    ]);

    const extraction = await extractText(pdfFile(bytes, "two-pages.pdf"));

    expect(extraction).toEqual({
      kind: "text",
      text: "1. Fees are due on signing.\n2. Work starts on payment.\n3. Either party may end this\nagreement in writing.",
    });
  });

  it("reports no text for a scan: a page that only draws an image", async () => {
    const bytes = buildPdf([{ content: "q 500 0 0 700 56 46 cm /Im1 Do Q", withImage: true }]);

    await expect(extractText(pdfFile(bytes, "scan.pdf"))).resolves.toEqual({ kind: "no-text" });
  });

  it("reports no text, never part of the text, when one page of several is a scan", async () => {
    const bytes = buildPdf([
      { content: textPage(["1. Fees are due on signing."]) },
      { content: "q 500 0 0 700 56 46 cm /Im1 Do Q", withImage: true },
    ]);

    await expect(extractText(pdfFile(bytes, "half-scanned.pdf"))).resolves.toEqual({ kind: "no-text" });
  });

  it("reports no text for a page whose text is only spaces", async () => {
    const bytes = buildPdf([{ content: `BT /F1 12 Tf 72 720 Td ${pdfString("     ")} Tj ET` }]);

    await expect(extractText(pdfFile(bytes, "blank.pdf"))).resolves.toEqual({ kind: "no-text" });
  });

  it("rejects bytes that are not a PDF with a clear error", async () => {
    const bytes = new TextEncoder().encode("This is a plain note saved with a .pdf name.");

    const failure = await extractText(pdfFile(bytes, "note.pdf")).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ExtractionError);
    expect((failure as ExtractionError).code).toBe("invalid-pdf");
    expect((failure as ExtractionError).message).toBe(
      "This file isn't a PDF Redline can open. It may be damaged or password protected.",
    );
  });

  it("rejects a PDF cut off partway instead of returning what it could read", async () => {
    const whole = buildPdf([
      { content: textPage(["1. Fees are due on signing."]) },
      { content: textPage(["2. Work starts on payment."]) },
    ]);
    const truncated = whole.slice(0, Math.floor(whole.length * 0.6));

    const failure = await extractText(pdfFile(truncated, "cut-off.pdf")).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ExtractionError);
    expect((failure as ExtractionError).code).toBe("invalid-pdf");
  });

  it("reads a PDF chosen without a .pdf name when the browser reports its type", async () => {
    const bytes = buildPdf([{ content: textPage(["Fees are due on signing."]) }]);

    await expect(extractText(pdfFile(bytes, "download"))).resolves.toEqual({
      kind: "text",
      text: "Fees are due on signing.",
    });
  });
});

describe("extractText on a .txt file", () => {
  it("returns the text byte for byte, CRLF line endings and all", async () => {
    const text = "Clause 1.  The Contractor shall pay\r\nall costs. \r\n\r\n\tClause 2. Fees are due on signing.\r\n";

    await expect(extractText(new File([text], "lease.TXT"))).resolves.toEqual({ kind: "text", text });
  });
});

describe("extractText on other files", () => {
  it("rejects a file type Redline does not read", async () => {
    const file = new File(["<html></html>"], "terms.html", { type: "text/html" });

    const failure = await extractText(file).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ExtractionError);
    expect((failure as ExtractionError).code).toBe("unsupported-type");
  });
});
