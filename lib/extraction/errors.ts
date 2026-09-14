/** What extraction gives back: the Document's text, or the finding that it holds no text to read. */
export type Extraction = { kind: "text"; text: string } | { kind: "no-text" };

/**
 * Why a file could not be read at all.
 * - `unsupported-type`: not a file type Redline reads.
 * - `invalid-pdf`: named or typed as a PDF, but pdfjs cannot parse it (damaged, not a PDF, locked).
 * - `invalid-docx`: named or typed as a Word file, but not a readable DOCX (not a zip, no document
 *   part, broken XML, or password protected, which Word stores in a different container).
 * - `unreadable-file`: the browser could not read the file's contents.
 */
export type ExtractionErrorCode = "unsupported-type" | "invalid-pdf" | "invalid-docx" | "unreadable-file";

const MESSAGES: Record<ExtractionErrorCode, string> = {
  "unsupported-type": "Redline reads .txt, PDF and Word (.docx) files.",
  "invalid-pdf": "This file isn't a PDF Redline can open. It may be damaged or password protected.",
  "invalid-docx": "This file isn't a Word document Redline can open. It may be damaged or password protected.",
  "unreadable-file": "Your browser couldn't read that file.",
};

export class ExtractionError extends Error {
  readonly code: ExtractionErrorCode;

  constructor(code: ExtractionErrorCode, options?: { cause?: unknown }) {
    super(MESSAGES[code], options);
    this.name = "ExtractionError";
    this.code = code;
  }
}
