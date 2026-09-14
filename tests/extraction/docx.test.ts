// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { ExtractionError, extractText } from "../../lib/extraction/extract-text.ts";
import {
  DOCX_TYPE,
  INLINE_PICTURE,
  buildDocx,
  buildDocxWithDocumentXml,
  documentXml,
} from "../support/minimal-docx.ts";

/*
 * The DOCX text rule these tests hold extraction to (defined once, in lib/extraction/docx.ts):
 * - Only word/document.xml is read: the body in document order, tables and text boxes included;
 *   footnotes, endnotes, comments, headers and footers are not.
 * - w:t text exactly as stored, whitespace literal. Runs add nothing between them.
 * - w:tab → "\t"; w:br and w:cr → "\n"; w:noBreakHyphen → "-"; w:softHyphen → nothing.
 * - Inserted text (w:ins) is kept, deleted text (w:del/w:delText) is not. Hidden runs (w:vanish)
 *   and field codes (w:instrText) are not read. Of mc:Choice and mc:Fallback, only mc:Choice.
 * - Each paragraph is a block; each table row is a block whose cells are separated by "\t", and a
 *   cell's own paragraphs are joined by "\n". Text box paragraphs follow their anchor paragraph.
 * - Blocks are joined by a single "\n", none before the first or after the last. An empty
 *   paragraph is still a block, so a body ending in one ends in "\n".
 * No whitespace collapsing, no trimming, no de-hyphenation, no reflow.
 */

function docxFile(bytes: Uint8Array<ArrayBuffer>, name: string, type = DOCX_TYPE): File {
  return new File([bytes], name, { type });
}

const p = (runs: string) => `<w:p>${runs}</w:p>`;
const cell = (paragraphs: string) => `<w:tc><w:tcPr><w:tcW w:w="2000" w:type="dxa"/></w:tcPr>${paragraphs}</w:tc>`;
const plain = (text: string) => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;

describe("extractText on a DOCX", () => {
  it("returns the text exactly under the DOCX text rule: split runs, spacing, tabs, breaks and a table", async () => {
    const body =
      p(
        `<w:r><w:t xml:space="preserve">The Contractor shall  pay </w:t></w:r>` +
          `<w:r><w:rPr><w:b/></w:rPr><w:t>all</w:t></w:r>` +
          `<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve"> costs,  </w:t></w:r>` +
          `<w:r><w:rPr><w:u w:val="single"/><w:color w:val="FF0000"/></w:rPr><w:t>including fees.</w:t></w:r>`,
      ) +
      p(
        `<w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr>` +
          `<w:r><w:t>1.</w:t><w:tab/><w:t>Fees are due</w:t><w:br/><w:t xml:space="preserve">  on signing.</w:t>` +
          `<w:cr/><w:t>Non</w:t><w:noBreakHyphen/><w:t>refund</w:t><w:softHyphen/><w:t>able.</w:t></w:r>`,
      ) +
      `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>` +
      `<w:tr>${cell(p(plain("Party")))}${cell(p(plain("Client")))}</w:tr>` +
      `<w:tr>${cell(p(plain("Pays")) + p(plain("within  30 days")))}${cell(p(plain("On invoice")))}</w:tr>` +
      `</w:tbl>` +
      p(plain("Signed.")) +
      `<w:p/>`;

    const extraction = await extractText(docxFile(buildDocx(body), "agreement.docx"));

    expect(extraction).toEqual({
      kind: "text",
      text:
        "The Contractor shall  pay all costs,  including fees.\n" +
        "1.\tFees are due\n  on signing.\nNon-refundable.\n" +
        "Party\tClient\n" +
        "Pays\nwithin  30 days\tOn invoice\n" +
        "Signed.\n",
    });
  });

  it("keeps inserted text and leaves out deleted text", async () => {
    const body = p(
      plain("Payment is due within ") +
        `<w:del w:id="1" w:author="Client" w:date="2026-09-01T00:00:00Z"><w:r><w:delText>60</w:delText></w:r></w:del>` +
        `<w:ins w:id="2" w:author="Client" w:date="2026-09-01T00:00:00Z"><w:r><w:t>30</w:t></w:r></w:ins>` +
        plain(" days."),
    );

    const extraction = await extractText(docxFile(buildDocx(body), "tracked.docx"));

    expect(extraction).toEqual({ kind: "text", text: "Payment is due within 30 days." });
  });

  it("reads a text box once, after its anchor paragraph, and skips hidden text and field codes", async () => {
    const textBox = `<w:txbxContent>${p(plain("Late fees: 2% a month."))}</w:txbxContent>`;
    const body =
      p(
        plain("See the box.") +
          `<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing>${textBox}</w:drawing></mc:Choice>` +
          `<mc:Fallback><w:pict>${textBox}</w:pict></mc:Fallback></mc:AlternateContent></w:r>` +
          `<w:r><w:rPr><w:vanish/></w:rPr><w:t>Hidden note.</w:t></w:r>`,
      ) +
      p(
        `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>` +
          `<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>Page 1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`,
      );

    const extraction = await extractText(docxFile(buildDocx(body), "boxed.docx"));

    expect(extraction).toEqual({ kind: "text", text: "See the box.\nLate fees: 2% a month.\nPage 1" });
  });

  it("reports no text for a body holding only a picture of a page", async () => {
    const body = p(INLINE_PICTURE) + `<w:p/>`;

    await expect(extractText(docxFile(buildDocx(body), "photo-of-lease.docx"))).resolves.toEqual({ kind: "no-text" });
  });

  it("reads a DOCX chosen without a .docx name when the browser reports its type", async () => {
    await expect(extractText(docxFile(buildDocx(p(plain("Fees are due on signing."))), "download"))).resolves.toEqual({
      kind: "text",
      text: "Fees are due on signing.",
    });
  });

  describe("rejects a file that is not a readable DOCX with a clear error", () => {
    async function failureFor(bytes: Uint8Array<ArrayBuffer>): Promise<ExtractionError> {
      const failure = await extractText(docxFile(bytes, "contract.docx")).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(ExtractionError);
      return failure as ExtractionError;
    }

    it("bytes that are not a zip", async () => {
      const failure = await failureFor(new TextEncoder().encode("A plain note saved with a .docx name."));

      expect(failure.code).toBe("invalid-docx");
      expect(failure.message).toBe(
        "This file isn't a Word document Redline can open. It may be damaged or password protected.",
      );
    });

    it("a zip with no word/document.xml", async () => {
      expect((await failureFor(buildDocxWithDocumentXml(null))).code).toBe("invalid-docx");
    });

    it("a document.xml that is not well-formed XML", async () => {
      const broken = documentXml(p(plain("Fees are due on signing."))).replace("</w:body>", "");

      expect((await failureFor(buildDocxWithDocumentXml(broken))).code).toBe("invalid-docx");
    });

    it("a zip whose document.xml is not a Word document", async () => {
      const zipped = zipSync({ "word/document.xml": strToU8(`<?xml version="1.0"?><html><body>Hi</body></html>`) });
      const bytes = new Uint8Array(new ArrayBuffer(zipped.length));
      bytes.set(zipped);

      expect((await failureFor(bytes)).code).toBe("invalid-docx");
    });

    it("a DOCX cut off partway, instead of returning what it could read", async () => {
      const whole = buildDocx(p(plain("Fees are due on signing.")).repeat(50));

      expect((await failureFor(whole.slice(0, Math.floor(whole.length * 0.6)))).code).toBe("invalid-docx");
    });
  });
});
