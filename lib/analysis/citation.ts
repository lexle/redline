/**
 * How a model's citation is checked against the stored Document text, shared by every seam that
 * shows the Signer a sentence from their Document: the analysis and the question box.
 *
 * A citation is a unit id plus the quote the model echoed. It resolves only when the id is a unit of
 * the full-text segmentation and `documentText.slice(start, end) === quote` exactly. No
 * normalisation, no fuzzy match.
 */
import type { SentenceUnit } from "./segment.ts";
import type { SourceSentence } from "./types.ts";

/** The finding types that cite a Source sentence and so go through citation validation. */
export type CitedFindingType =
  | "risk-flag"
  | "worth-a-look"
  | "multiplier-note"
  | "summary-sentence"
  | "checklist-item"
  | "answer-sentence";

export interface FailedCitation {
  /** Position of the finding in the model's response, within its own finding type's list. */
  index: number;
  findingType: CitedFindingType;
  /** For a sentence that carries several spans (summary or answer): which span failed, in the model's order. */
  spanIndex?: number;
  unitId: string;
  quote: string;
  reason: "unknown-unit" | "quote-mismatch";
}

/**
 * The model cited a sentence that cannot be shown verbatim. The whole result fails: no finding is
 * returned uncited and none is dropped.
 */
export class CitationError extends Error {
  readonly failures: readonly FailedCitation[];
  /** Every cited finding in the response, across all cited finding types, summary sentences included. */
  readonly findingCount: number;

  constructor(failures: FailedCitation[], findingCount: number) {
    const failedFindings = countFailedFindings(failures);
    super(
      `${failedFindings} of ${findingCount} findings could not be matched to their source sentence: ` +
        failures
          .map((failure) => {
            const name = `${failure.findingType} #${failure.index}${failure.spanIndex === undefined ? "" : ` span ${failure.spanIndex}`}`;
            return failure.reason === "unknown-unit"
              ? `${name} cites unknown unit ${JSON.stringify(failure.unitId)}`
              : `${name} quote does not match unit ${failure.unitId} exactly`;
          })
          .join("; "),
    );
    this.name = "CitationError";
    this.failures = failures;
    this.findingCount = findingCount;
  }

  /** Findings whose every span matched. A summary sentence with two failed spans is one failed finding. */
  get passedCount(): number {
    return this.findingCount - countFailedFindings(this.failures);
  }
}

function countFailedFindings(failures: readonly FailedCitation[]): number {
  return new Set(failures.map((failure) => `${failure.findingType}#${failure.index}`)).size;
}

/** The Source sentence a resolved unit shows: its exact offsets and the stored text between them. */
export function sourceOf(documentText: string, unit: SentenceUnit): SourceSentence {
  return { start: unit.start, end: unit.end, text: documentText.slice(unit.start, unit.end) };
}

/**
 * Resolves one cited span. Returns the unit when the id is known and the quote matches the stored
 * slice exactly; otherwise the reason it failed, for the caller to record in a `CitationError`.
 */
export function resolveSpan(
  documentText: string,
  unitsById: ReadonlyMap<string, SentenceUnit>,
  unitId: string,
  quote: string,
): { unit: SentenceUnit } | { reason: FailedCitation["reason"] } {
  const unit = unitsById.get(unitId);
  if (!unit) return { reason: "unknown-unit" };
  if (documentText.slice(unit.start, unit.end) !== quote) return { reason: "quote-mismatch" };
  return { unit };
}
