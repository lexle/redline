/**
 * How a long Document is split for the model. Pure and free of model code, so the browser can use
 * it to say a Document will be read in parts.
 *
 * A part is a run of whole sentence units; a unit is never cut. Units keep the ids and offsets of
 * the full-text segmentation, so a citation from any part resolves against the full stored text.
 */
import { segmentSentences } from "./segment.ts";
import type { SentenceUnit } from "./segment.ts";

/**
 * The default size of one part, in characters of the unit lines the prompt shows the model (each
 * line is `[id] "text"`, JSON-escaped).
 *
 * Why 60,000: the model id is never written into code, so its context window is unknown here, and
 * the budget has to hold for any model `OPENROUTER_MODEL` might name. 60,000 characters is roughly
 * 15,000 tokens of Document. With the instructions and the schema (about 5,000 tokens) and a long
 * structured answer (every flag carries claims and a Counter-offer, and the checklist is always
 * complete), one call stays well under a 64k-token window, and far under the 128k-200k windows of
 * the models this product is run with. A smaller part also keeps the model's attention on fewer
 * sentences. The Document fixtures (about 12,000 characters) and most freelance agreements fit in
 * one part, so they still make exactly one call.
 */
export const DEFAULT_PART_BUDGET = 60_000;

/** Parts after the first repeat whole units from the end of the part before, up to this share of the budget. */
const OVERLAP_SHARE = 0.1;

export interface DocumentPart {
  /** Zero-based position among the parts, in Document order. */
  readonly index: number;
  /** Whole units, in Document order, with their full-text ids and offsets. */
  readonly units: readonly SentenceUnit[];
}

/** The line the prompt shows for a unit. Part sizes are measured on these lines. */
export function unitLine(unit: SentenceUnit): string {
  return `[${unit.id}] ${JSON.stringify(unit.text)}`;
}

/**
 * Splits units into parts of at most `budget` characters of unit lines (newlines included).
 *
 * - Everything within the budget is one part.
 * - Otherwise each part takes as many whole units as fit. A single unit longer than the budget is a
 *   part on its own, over budget, because cutting it would break its citation.
 * - Each later part starts by repeating whole units from the end of the part before, up to a tenth
 *   of the budget, so a clause that leans on the sentence before it is still read with it. The
 *   repeat never covers the whole previous part, so every part adds units and splitting ends.
 */
export function splitIntoParts(units: readonly SentenceUnit[], budget: number): DocumentPart[] {
  if (!Number.isFinite(budget) || budget <= 0) {
    throw new RangeError(`A part budget must be a positive number of characters, not ${budget}.`);
  }
  const sizes = units.map((unit) => unitLine(unit).length + 1);
  const overlapBudget = Math.floor(budget * OVERLAP_SHARE);
  const parts: DocumentPart[] = [];
  let start = 0;
  while (start < units.length) {
    let end = start;
    let size = 0;
    while (end < units.length && (end === start || size + sizes[end] <= budget)) {
      size += sizes[end];
      end++;
    }
    parts.push({ index: parts.length, units: units.slice(start, end) });
    if (end === units.length) break;
    let next = end;
    let overlap = 0;
    while (next - 1 > start && overlap + sizes[next - 1] <= overlapBudget) {
      next--;
      overlap += sizes[next];
    }
    start = next;
  }
  return parts;
}

/** How many parts the analysis will send for this text at the default budget. */
export function countParts(documentText: string, budget: number = DEFAULT_PART_BUDGET): number {
  return splitIntoParts(segmentSentences(documentText), budget).length;
}
