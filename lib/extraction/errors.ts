/** What extraction gives back: the Document's text, or the finding that it holds no text to read. */
export type Extraction = { kind: "text"; text: string } | { kind: "no-text" };

/**
 * Why a file could not be read at all.
 * - `unsupported-type`: not a file type Redline reads.
 * - `invalid-pdf`: named or typed as a PDF, but pdfjs cannot parse it (damaged, not a PDF, locked).
 * - `unreadable-file`: the browser could not read the file's contents.
 */
export type ExtractionErrorCode = "unsupported-type" | "invalid-pdf" | "unreadable-file";

const MESSAGES: Record<ExtractionErrorCode, string> = {
  "unsupported-type": "Redline reads .txt and PDF files.",
  "invalid-pdf": "This file isn't a PDF Redline can open. It may be damaged or password protected.",
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
