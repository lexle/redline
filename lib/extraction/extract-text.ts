import { ExtractionError } from "./errors.ts";
import type { Extraction } from "./errors.ts";
import { extractPdfText } from "./pdf.ts";
import { loadPdfjs } from "./pdfjs.ts";

export { ExtractionError } from "./errors.ts";
export type { Extraction, ExtractionErrorCode } from "./errors.ts";
export { joinPdfPages } from "./pdf.ts";

type Reader = {
  extensions: readonly string[];
  mimeTypes: readonly string[];
  read(file: File): Promise<Extraction>;
};

/**
 * Every file type Redline reads. A new type is one more entry here. The extension decides first;
 * the MIME type only when no extension matches, because browsers report it inconsistently.
 */
const READERS: readonly Reader[] = [
  { extensions: [".txt"], mimeTypes: ["text/plain"], read: readTxt },
  { extensions: [".pdf"], mimeTypes: ["application/pdf"], read: readPdf },
];

/**
 * Seam 2. Runs in the browser: the file never leaves it, only the text this returns does.
 * Resolves to the Document's text exactly as the file holds it, or to `no-text` when the file has
 * no text to read (a scan). Rejects with an `ExtractionError` when the file cannot be read at all.
 * OCR is never attempted.
 */
export async function extractText(file: File): Promise<Extraction> {
  const name = file.name.toLowerCase();
  const reader =
    READERS.find((candidate) => candidate.extensions.some((extension) => name.endsWith(extension))) ??
    READERS.find((candidate) => candidate.mimeTypes.includes(file.type));
  if (!reader) throw new ExtractionError("unsupported-type");
  return reader.read(file);
}

async function readTxt(file: File): Promise<Extraction> {
  let text: string;
  try {
    text = await file.text();
  } catch (cause) {
    throw new ExtractionError("unreadable-file", { cause });
  }
  return { kind: "text", text };
}

async function readPdf(file: File): Promise<Extraction> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch (cause) {
    throw new ExtractionError("unreadable-file", { cause });
  }
  return extractPdfText(bytes, await loadPdfjs());
}
