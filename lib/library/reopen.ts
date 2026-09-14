/**
 * Reopening a saved Document. Pure: it takes a row exactly as the database returned it and either
 * gives back the stored text and result, or throws. Nothing is repaired, dropped or shown in part.
 *
 * - A result that is not shaped like an `AnalysisResult` throws `StoredDocumentError`.
 * - A cited span that is not word for word the stored text between its offsets throws
 *   `CitationError`, naming every span that failed, the same error the analysis itself throws.
 *
 * Spans are checked by their stored offsets alone (`text.slice(start, end) === quote`), not by
 * segmenting the text again, so a Document saved before a change to the segmenter still reopens.
 */
import { CHECK_IDS, HARM_CHECKS, RISK_FLAG_CHECKS } from "../analysis/checks.ts";
import { CitationError, resolveSpan } from "../analysis/citation.ts";
import type { CitedFindingType, FailedCitation } from "../analysis/citation.ts";
import type { SentenceUnit } from "../analysis/segment.ts";
import { NICE_TO_HAVE_KINDS, PROTECTION_KINDS, SEVERITY_BANDS } from "../analysis/types.ts";
import type { AnalysisResult, SourceSentence } from "../analysis/types.ts";

export { CitationError } from "../analysis/citation.ts";

/** The stored row or its result is not the shape Redline saved. Nothing of it is shown. */
export class StoredDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoredDocumentError";
  }
}

export interface ReopenedDocument {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly createdAt: string;
  readonly result: AnalysisResult;
}

type Json = Record<string, unknown>;

function malformed(path: string, problem: string): never {
  throw new StoredDocumentError(`The saved result is malformed: ${path} ${problem}.`);
}

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown, path: string): Json {
  if (!isRecord(value)) malformed(path, "is not an object");
  return value;
}

function list(value: unknown, path: string, { nonEmpty = false } = {}): unknown[] {
  if (!Array.isArray(value)) malformed(path, "is not a list");
  if (nonEmpty && value.length === 0) malformed(path, "is empty");
  return value;
}

function text(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") malformed(path, "is not a non-blank string");
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    malformed(path, `is not one of ${allowed.join(", ")}`);
  }
  return value as T;
}

function exactly(value: unknown, expected: string, path: string): void {
  if (value !== expected) malformed(path, `is not "${expected}"`);
}

function positiveInteger(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) malformed(path, "is not a positive integer");
  return value;
}

function span(value: unknown, path: string): SourceSentence {
  const entry = record(value, path);
  const { start, end } = entry;
  if (typeof start !== "number" || !Number.isInteger(start) || start < 0) malformed(`${path}.start`, "is not an offset");
  if (typeof end !== "number" || !Number.isInteger(end) || end <= start) malformed(`${path}.end`, "is not an offset after start");
  if (typeof entry.text !== "string") malformed(`${path}.text`, "is not a string");
  return { start, end, text: entry.text };
}

function claims(value: unknown, path: string, tiers: readonly string[], nonEmpty: boolean): void {
  list(value, path, { nonEmpty }).forEach((claim, index) => {
    const entry = record(claim, `${path}[${index}]`);
    oneOf(entry.tier, tiers, `${path}[${index}].tier`);
    text(entry.text, `${path}[${index}].text`);
  });
}

function redLines(value: unknown, path: string): void {
  list(value, path).forEach((line, index) => {
    const entry = record(line, `${path}[${index}]`);
    text(entry.id, `${path}[${index}].id`);
    text(entry.text, `${path}[${index}].text`);
  });
}

function absence(value: unknown, path: string, kinds: readonly string[], kind: string): void {
  const entry = record(value, path);
  exactly(entry.kind, kind, `${path}.kind`);
  text(entry.id, `${path}.id`);
  oneOf(entry.protection, kinds, `${path}.protection`);
  text(entry.statement, `${path}.statement`);
  claims(entry.claims, `${path}.claims`, ["inference"], false);
  text(entry.proposedInsertion, `${path}.proposedInsertion`);
  if ("source" in entry || "sources" in entry) malformed(path, "cites a sentence, but an absence cites nothing");
}

interface CitedFinding {
  readonly findingType: CitedFindingType;
  readonly index: number;
  readonly spans: readonly SourceSentence[];
  /** Summary sentences carry several spans, so each failure names which one. */
  readonly multiSpan: boolean;
}

/** Checks the shape of every part of the result and collects every cited finding in it. */
function readResult(value: unknown): { result: AnalysisResult; cited: CitedFinding[] } {
  const result = record(value, "result");
  const cited: CitedFinding[] = [];

  list(result.summary, "result.summary", { nonEmpty: true }).forEach((item, index) => {
    const path = `result.summary[${index}]`;
    const entry = record(item, path);
    exactly(entry.kind, "summary-sentence", `${path}.kind`);
    oneOf(entry.tier, ["read-off", "inference"], `${path}.tier`);
    text(entry.text, `${path}.text`);
    const spans = list(entry.sources, `${path}.sources`, { nonEmpty: true }).map((source, spanIndex) =>
      span(source, `${path}.sources[${spanIndex}]`),
    );
    cited.push({ findingType: "summary-sentence", index, spans, multiSpan: true });
  });

  const riskFlags = list(result.riskFlags, "result.riskFlags");
  riskFlags.forEach((item, index) => {
    const path = `result.riskFlags[${index}]`;
    const entry = record(item, path);
    exactly(entry.kind, "risk-flag", `${path}.kind`);
    positiveInteger(entry.rank, `${path}.rank`);
    oneOf(entry.severityBand, SEVERITY_BANDS, `${path}.severityBand`);
    text(entry.title, `${path}.title`);
    oneOf(entry.check, RISK_FLAG_CHECKS, `${path}.check`);
    claims(entry.claims, `${path}.claims`, ["read-off", "inference"], true);
    text(entry.counterOffer, `${path}.counterOffer`);
    redLines(entry.redLines, `${path}.redLines`);
    cited.push({ findingType: "risk-flag", index, spans: [span(entry.source, `${path}.source`)], multiSpan: false });
  });

  if (typeof result.nothingFound !== "boolean") malformed("result.nothingFound", "is not true or false");
  if (result.nothingFound !== (riskFlags.length === 0)) malformed("result.nothingFound", "disagrees with the Risk flags");

  list(result.worthALook, "result.worthALook").forEach((item, index) => {
    const path = `result.worthALook[${index}]`;
    const entry = record(item, path);
    exactly(entry.kind, "worth-a-look", `${path}.kind`);
    text(entry.title, `${path}.title`);
    claims(entry.claims, `${path}.claims`, ["read-off", "inference"], true);
    cited.push({ findingType: "worth-a-look", index, spans: [span(entry.source, `${path}.source`)], multiSpan: false });
  });

  list(result.multiplierNotes, "result.multiplierNotes").forEach((item, index) => {
    const path = `result.multiplierNotes[${index}]`;
    const entry = record(item, path);
    exactly(entry.kind, "multiplier-note", `${path}.kind`);
    text(entry.title, `${path}.title`);
    claims(entry.claims, `${path}.claims`, ["read-off", "inference"], true);
    redLines(entry.redLines, `${path}.redLines`);
    cited.push({ findingType: "multiplier-note", index, spans: [span(entry.source, `${path}.source`)], multiSpan: false });
  });

  list(result.missingProtections, "result.missingProtections").forEach((item, index) =>
    absence(item, `result.missingProtections[${index}]`, PROTECTION_KINDS, "missing-protection"),
  );
  list(result.niceToHave, "result.niceToHave").forEach((item, index) =>
    absence(item, `result.niceToHave[${index}]`, NICE_TO_HAVE_KINDS, "nice-to-have"),
  );

  list(result.checklist, "result.checklist", { nonEmpty: true }).forEach((item, index) => {
    const path = `result.checklist[${index}]`;
    const entry = record(item, path);
    exactly(entry.kind, "checklist-item", `${path}.kind`);
    const check = oneOf(entry.check, CHECK_IDS, `${path}.check`);
    const harm = (HARM_CHECKS as readonly string[]).includes(check);
    const outcome = oneOf(
      entry.outcome,
      harm ? (["not-found", "bounded", "flagged"] as const) : (["present", "missing"] as const),
      `${path}.outcome`,
    );
    if (outcome === "bounded" || outcome === "present") {
      text(entry.detail, `${path}.detail`);
      cited.push({ findingType: "checklist-item", index, spans: [span(entry.source, `${path}.source`)], multiSpan: false });
    } else if ("source" in entry) {
      malformed(`${path}.source`, `is present on a ${outcome} outcome, which cites nothing`);
    }
    if (outcome === "flagged") {
      list(entry.riskFlagRanks, `${path}.riskFlagRanks`, { nonEmpty: true }).forEach((rank, rankIndex) =>
        positiveInteger(rank, `${path}.riskFlagRanks[${rankIndex}]`),
      );
    }
    if (outcome === "missing") {
      const reference = record(entry.absence, `${path}.absence`);
      oneOf(reference.kind, ["missing-protection", "nice-to-have"], `${path}.absence.kind`);
      text(reference.id, `${path}.absence.id`);
    }
  });

  // Every citation anywhere in the result must belong to a finding checked above. One that sits
  // somewhere else would never be validated, so the result is refused rather than trusted.
  const citationCount = countCitations(result);
  const checkedCount = cited.length;
  if (citationCount !== checkedCount) malformed("result", "carries a citation outside any cited finding");

  return { result: result as unknown as AnalysisResult, cited };
}

function countCitations(value: unknown): number {
  if (Array.isArray(value)) return value.reduce<number>((sum, item) => sum + countCitations(item), 0);
  if (!isRecord(value)) return 0;
  const own = "source" in value || "sources" in value ? 1 : 0;
  return Object.values(value).reduce<number>((sum, item) => sum + countCitations(item), own);
}

/**
 * The stored result for `documentText`, once its shape is right and every cited span is word for
 * word the stored text at its offsets. Throws `StoredDocumentError` or `CitationError` otherwise.
 */
export function validateStoredResult(documentText: string, value: unknown): AnalysisResult {
  if (typeof documentText !== "string" || documentText.trim() === "") malformed("text", "is not a non-blank string");
  const { result, cited } = readResult(value);

  const failures: FailedCitation[] = [];
  for (const finding of cited) {
    finding.spans.forEach((source, spanIndex) => {
      // The existing verbatim check, given the span's own offsets as its only unit.
      const unitId = `${source.start}-${source.end}`;
      const unit: SentenceUnit = { id: unitId, start: source.start, end: source.end, text: source.text };
      const resolved = resolveSpan(documentText, new Map([[unitId, unit]]), unitId, source.text);
      if ("reason" in resolved) {
        failures.push({
          index: finding.index,
          findingType: finding.findingType,
          ...(finding.multiSpan ? { spanIndex } : {}),
          unitId,
          quote: source.text,
          reason: resolved.reason,
        });
      }
    });
  }
  if (failures.length > 0) throw new CitationError(failures, cited.length);
  return result;
}

/**
 * Reopens a row from the `documents` table: its id, title, text, date and result. The Risk flag
 * count stored beside the result must match the result, because the library shows that count
 * before the Document is opened.
 */
export function reopenSavedDocument(row: unknown): ReopenedDocument {
  const stored = record(row, "row");
  const id = text(stored.id, "row.id");
  const title = text(stored.title, "row.title");
  if (typeof stored.text !== "string") malformed("row.text", "is not a string");
  const createdAt = text(stored.created_at, "row.created_at");
  if (Number.isNaN(Date.parse(createdAt))) malformed("row.created_at", "is not a date");
  const result = validateStoredResult(stored.text, stored.result);
  if (stored.risk_flag_count !== result.riskFlags.length) {
    malformed("row.risk_flag_count", "does not match the Risk flags in the result");
  }
  return { id, title, text: stored.text, createdAt, result };
}
