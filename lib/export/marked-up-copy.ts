/**
 * The marked-up copy (ADR-0005, spec stories 22-23): the stored Document text in order, with each
 * Risk flag's clause marked and its Counter-offer after it, and every Proposed insertion in a section
 * at the end. It is a new artefact built in memory. The stored text and the result are only read.
 *
 * Marker rule. Everything Redline adds sits inside a block that opens with `[` followed by k plus
 * signs and closes with k plus signs followed by `]`, e.g. `[+++ ... +++]`. k starts at 3 and grows
 * until neither the opening nor the closing marker occurs anywhere in the Document text, the
 * Document name, or any text Redline puts inside a block (titles, Counter-offers, statements,
 * Proposed insertions). The export always starts with its header block, so its first marker gives k.
 * Neither marker has a prefix that is also its suffix, so text next to a marker can never combine
 * with it into an earlier false match. Removing every block, opening marker to closing marker
 * inclusive, gives back the stored Document text byte for byte (`stripMarkedUpCopy`).
 *
 * Line endings. The Document's own text is copied untouched. Text Redline adds uses the Document's
 * line ending: CRLF when the Document contains "\r\n", otherwise "\n".
 */
import type { AnalysisResult, RiskFlag } from "../analysis/types.ts";
import { segmentDocument } from "../document/segments.ts";

const MIN_FENCE = 3;

/** Thrown when a Risk flag's offsets do not point at its Source sentence in this text. */
export class ExportCitationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportCitationError";
  }
}

/** Thrown by `stripMarkedUpCopy` for text that is not a well-formed marked-up copy. */
export class MarkedUpCopyFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarkedUpCopyFormatError";
  }
}

export interface MarkedUpCopyMarkers {
  readonly open: string;
  readonly close: string;
}

function markersFor(fence: number): MarkedUpCopyMarkers {
  const plus = "+".repeat(fence);
  return { open: `[${plus}`, close: `${plus}]` };
}

/** The shortest markers that occur in none of `texts`. */
export function chooseMarkers(texts: readonly string[]): MarkedUpCopyMarkers {
  for (let fence = MIN_FENCE; ; fence += 1) {
    const markers = markersFor(fence);
    if (texts.every((text) => !text.includes(markers.open) && !text.includes(markers.close))) return markers;
  }
}

function lineEndingOf(documentText: string): string {
  return documentText.includes("\r\n") ? "\r\n" : "\n";
}

/** Redline's own text, with any line breaks in it written as the Document's line ending. */
function withLineEnding(text: string, eol: string): string {
  return text.replace(/\r\n|\r|\n/g, eol);
}

function checkFlags(documentText: string, flags: readonly RiskFlag[]): void {
  const failed = flags.filter(
    (flag) =>
      !Number.isInteger(flag.source.start) ||
      !Number.isInteger(flag.source.end) ||
      flag.source.start >= flag.source.end ||
      documentText.slice(flag.source.start, flag.source.end) !== flag.source.text,
  );
  if (failed.length > 0) {
    const listed = failed.map((flag) => `Risk flag ${flag.rank} [${flag.source.start}, ${flag.source.end})`).join(", ");
    throw new ExportCitationError(`These Risk flags do not point at their Source sentence in the stored text: ${listed}.`);
  }
}

function blankFileName(fileName: string): boolean {
  return fileName.trim().length === 0;
}

/**
 * Builds the plain-text marked-up copy. Each Risk flag's clause is found by its validated offsets,
 * never by searching, so a sentence that appears twice is marked only where the flag points.
 * Overlapping clauses are split at every offset: each character of the Document appears once.
 */
export function buildMarkedUpCopy(documentText: string, result: AnalysisResult, fileName = "the document"): string {
  const flags = [...result.riskFlags].sort((a, b) => a.rank - b.rank || a.source.start - b.source.start);
  checkFlags(documentText, flags);

  const name = blankFileName(fileName) ? "the document" : fileName;
  const absences = [...result.missingProtections, ...result.niceToHave];
  const { open, close } = chooseMarkers([
    documentText,
    name,
    ...flags.flatMap((flag) => [flag.title, flag.counterOffer]),
    ...absences.flatMap((entry) => [entry.id, entry.statement, entry.proposedInsertion]),
  ]);
  const eol = lineEndingOf(documentText);
  const block = (lines: readonly string[]) => `${open} ${withLineEnding(lines.join("\n"), eol)} ${close}`;

  const insertionCount = absences.length;
  const parts: string[] = [
    block([
      `Marked-up copy of ${name}, from Redline.`,
      "Everything between a pair of markers like the ones around this note was added by Redline and is not in the original document.",
      "Take out every marked part and what's left is the document text exactly as Redline checked it.",
      `It marks ${flags.length} ${flags.length === 1 ? "risk flag" : "risk flags"}, each with a proposed replacement, and lists ${insertionCount} proposed ${insertionCount === 1 ? "insertion" : "insertions"} at the end.`,
    ]),
    eol,
    eol,
  ];

  const ids = new Map(flags.map((flag, index) => [flag, `flag-${index}`]));
  const segments = segmentDocument(
    documentText,
    flags.map((flag) => ({ id: ids.get(flag)!, start: flag.source.start, end: flag.source.end })),
  );

  const opening = (flag: RiskFlag) => block([`Risk flag ${flag.rank} (${flag.severityBand}): ${flag.title.replace(/[.\s]+$/, "")}. Original clause starts:`]);
  const closing = (flag: RiskFlag) =>
    block([
      `Original clause for risk flag ${flag.rank} ends.`,
      "Proposed replacement, not in the original document:",
      flag.counterOffer,
      `End of proposed replacement for risk flag ${flag.rank}.`,
    ]);

  for (const segment of segments) {
    // Ends first, latest-opened first, so identical or nested clauses close in reverse of opening.
    const ending = flags.filter((flag) => flag.source.end === segment.start).reverse();
    for (const flag of ending) parts.push(closing(flag));
    for (const flag of flags.filter((candidate) => candidate.source.start === segment.start)) parts.push(opening(flag));
    parts.push(segment.text);
  }
  for (const flag of flags.filter((candidate) => candidate.source.end === documentText.length).reverse()) {
    parts.push(closing(flag));
  }

  const insertionLines: string[] =
    insertionCount === 0
      ? ["", "", "Proposed insertions: none."]
      : [
          "",
          "",
          "Proposed insertions. None of this text is in the original document. Each one covers something the document doesn't mention, so none of them points to a clause or a place in the document.",
        ];
  for (const entry of result.missingProtections) {
    insertionLines.push("", `Missing protection ${entry.id}: ${entry.statement}`, "Proposed insertion, not in the original document:", entry.proposedInsertion);
  }
  for (const entry of result.niceToHave) {
    insertionLines.push("", `Nice to have ${entry.id}: ${entry.statement}`, "Proposed insertion, not in the original document:", entry.proposedInsertion);
  }
  insertionLines.push("");
  parts.push(block(insertionLines));

  return parts.join("");
}

/**
 * The inverse of `buildMarkedUpCopy`, and the proof that the export keeps the original: removes the
 * header block, the two line endings after it, and every other block, returning the stored text.
 */
export function stripMarkedUpCopy(exported: string): string {
  const fence = /^\[(\+{3,}) /.exec(exported);
  if (!fence) throw new MarkedUpCopyFormatError("The text does not start with a marked-up copy header.");
  const { open, close } = markersFor(fence[1].length);

  const pieces: string[] = [];
  let position = 0;
  let blocks = 0;
  while (position <= exported.length) {
    const start = exported.indexOf(open, position);
    if (start === -1) {
      pieces.push(exported.slice(position));
      break;
    }
    pieces.push(exported.slice(position, start));
    const end = exported.indexOf(close, start + open.length);
    if (end === -1) throw new MarkedUpCopyFormatError(`A marker opened at ${start} is never closed.`);
    position = end + close.length;
    blocks += 1;
    if (blocks === 1) {
      const eol = exported.startsWith("\r\n\r\n", position) ? "\r\n\r\n" : exported.startsWith("\n\n", position) ? "\n\n" : null;
      if (eol === null) throw new MarkedUpCopyFormatError("The header is not followed by a blank line.");
      position += eol.length;
    }
  }
  return pieces.join("");
}

/** A download name from the Document name: `lease.pdf` becomes `lease-marked-up.txt`. */
export function markedUpCopyFileName(fileName: string): string {
  const base = fileName.replace(/\.[A-Za-z0-9]{1,5}$/, "");
  const safe = base
    .replace(/[\\/:*?"<>| -]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return `${safe || "document"}-marked-up.txt`;
}
