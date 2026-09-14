/**
 * Writes small, valid PDF files byte by byte so extraction tests control exactly which text items
 * a page holds. No PDF library is involved: each page is a content stream the test writes by hand
 * (`BT ... Tj ... ET` for text, `/Im1 Do` for an image), and the writer emits the objects, a
 * correct cross-reference table and the trailer.
 *
 * Content streams must be ASCII, so every byte offset equals its character offset.
 */

export type MinimalPdfPage = {
  /** The page's content stream, exactly as it goes into the file. */
  content: string;
  /** Gives the page a 1x1 grey image XObject named /Im1, for scan-like pages. */
  withImage?: boolean;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

export function buildPdf(pages: readonly MinimalPdfPage[]): Uint8Array<ArrayBuffer> {
  // Objects are numbered from 1 in the order they are pushed.
  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalog = add("");
  const pageTree = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");

  const pageIds: number[] = [];
  for (const page of pages) {
    assertAscii(page.content);
    const contentId = add(stream("", page.content));
    let xObjects = "";
    if (page.withImage) {
      const image = add(
        stream("/Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8", "\x80"),
      );
      xObjects = ` /XObject << /Im1 ${image} 0 R >>`;
    }
    pageIds.push(
      add(
        `<< /Type /Page /Parent ${pageTree} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]` +
          ` /Resources << /Font << /F1 ${font} 0 R >>${xObjects} >> /Contents ${contentId} 0 R >>`,
      ),
    );
  }

  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pageTree} 0 R >>`;
  objects[pageTree - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let file = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(file.length);
    file += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = file.length;
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) file += `${String(offset).padStart(10, "0")} 00000 n \n`;
  file += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const bytes = new Uint8Array(new ArrayBuffer(file.length));
  for (let index = 0; index < file.length; index++) bytes[index] = file.charCodeAt(index);
  return bytes;
}

function stream(dictionary: string, data: string): string {
  return `<< ${dictionary}${dictionary ? " " : ""}/Length ${data.length} >>\nstream\n${data}\nendstream`;
}

function assertAscii(text: string) {
  if (/[^\x00-\x7f]/.test(text)) throw new Error("Minimal PDF content streams must be ASCII.");
}

/**
 * Escapes a string for a PDF literal string operand: backslash and both parentheses.
 */
export function pdfString(text: string): string {
  return `(${text.replace(/[\\()]/g, (char) => `\\${char}`)})`;
}
