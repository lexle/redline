import { strToU8, zipSync } from "fflate";

/**
 * Writes small DOCX files as bytes so extraction tests control the document XML exactly. No DOCX
 * library is involved: the zip holds `[Content_Types].xml`, the package relationships and
 * `word/document.xml`, whose `<w:body>` content the test writes by hand.
 */

export const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
  `</Types>`;

const PACKAGE_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
  `</Relationships>`;

export const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Wraps body content in a complete `word/document.xml`. */
export function documentXml(bodyContent: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="${W_NS}"` +
    ` xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"` +
    ` xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"` +
    ` xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"` +
    ` xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"` +
    ` xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<w:body>${bodyContent}<w:sectPr/></w:body></w:document>`
  );
}

/** A DOCX whose `word/document.xml` is exactly `xml`, or which has none when `xml` is null. */
export function buildDocxWithDocumentXml(xml: string | null): Uint8Array<ArrayBuffer> {
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(CONTENT_TYPES),
    "_rels/.rels": strToU8(PACKAGE_RELS),
  };
  if (xml !== null) files["word/document.xml"] = strToU8(xml);
  const zipped = zipSync(files);
  const bytes = new Uint8Array(new ArrayBuffer(zipped.length));
  bytes.set(zipped);
  return bytes;
}

/** A DOCX whose body holds `bodyContent`. */
export function buildDocx(bodyContent: string): Uint8Array<ArrayBuffer> {
  return buildDocxWithDocumentXml(documentXml(bodyContent));
}

/** An inline picture inside a run, the way Word stores a pasted image. */
export const INLINE_PICTURE =
  `<w:r><w:drawing><wp:inline><wp:extent cx="5000000" cy="7000000"/><wp:docPr id="1" name="Picture 1"/>` +
  `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
  `<pic:pic><pic:blipFill><a:blip r:embed="rId5"/></pic:blipFill></pic:pic>` +
  `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
