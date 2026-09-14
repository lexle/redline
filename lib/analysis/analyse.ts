import type { ModelClient } from "../model/model-client.ts";
import type { CheckId, CheckOutcome, RiskFlagCheck } from "./checks.ts";
import {
  CHECK_IDS,
  CHECK_OUTCOMES,
  CITED_OUTCOMES,
  HARM_OUTCOMES,
  isHarmCheck,
  PROTECTION_OUTCOMES,
  RISK_FLAG_CHECKS,
} from "./checks.ts";
import { buildAnalysisRequest } from "./prompt.ts";
import { DEFAULT_PART_BUDGET, splitIntoParts } from "./parts.ts";
import type { DocumentPart } from "./parts.ts";
import { segmentSentences } from "./segment.ts";
import type { SentenceUnit } from "./segment.ts";
import type {
  AnalysisResult,
  ChecklistItem,
  Claim,
  InferenceClaim,
  MissingProtection,
  MultiplierNote,
  NiceToHave,
  NiceToHaveKind,
  ProtectionKind,
  ProvenanceTier,
  RedLine,
  RiskFlag,
  SeverityBand,
  SourceSentence,
  SummarySentence,
  WorthALook,
} from "./types.ts";
import { NICE_TO_HAVE_KINDS, PROTECTION_KINDS, PROVENANCE_TIERS, SEVERITY_BANDS } from "./types.ts";

/** The finding types that cite a Source sentence and so go through citation validation. */
export type CitedFindingType = "risk-flag" | "worth-a-look" | "multiplier-note" | "summary-sentence" | "checklist-item";

export interface FailedCitation {
  /** Position of the finding in the model's response, within its own finding type's list. */
  index: number;
  findingType: CitedFindingType;
  /** For a summary sentence only: which of its spans failed, in the model's order. */
  spanIndex?: number;
  unitId: string;
  quote: string;
  reason: "unknown-unit" | "quote-mismatch";
}

/**
 * The model cited a sentence that cannot be shown verbatim. The whole analysis fails: no finding is
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

/** The model's JSON does not have the shape the schema demands, or contradicts itself. */
export class AnalysisResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisResponseError";
  }
}

interface RawClaim {
  tier: ProvenanceTier;
  text: string;
}

interface RawCitedFinding {
  unitId: string;
  quote: string;
  title: string;
  claims: RawClaim[];
}

/**
 * No unitId and no quote: a Missing protection or Nice to have that carries either is rejected as
 * malformed.
 */
interface RawAbsence<K extends NiceToHaveKind> {
  protection: K;
  statement: string;
  claims: RawClaim[];
  proposedInsertion: string;
}

type RawMissingProtection = RawAbsence<ProtectionKind>;

/**
 * One checklist entry as the model sends it. Strict structured output needs every field on every
 * item, so an outcome that cites nothing sends `unitId`, `quote` and `detail` as empty strings; any
 * other value there is rejected. The result types carry no such empty fields.
 */
interface RawChecklistItem {
  check: CheckId;
  outcome: CheckOutcome;
  unitId: string;
  quote: string;
  detail: string;
}

interface RawRiskFlag extends RawCitedFinding {
  check: RiskFlagCheck;
  severityBand: SeverityBand;
  rank: number;
  counterOffer: string;
}

interface RawSpan {
  unitId: string;
  quote: string;
}

interface RawSummarySentence {
  text: string;
  tier: ProvenanceTier;
  sources: RawSpan[];
}

/** Finding types whose sentence cannot also be cited by another of these types. */
type ExclusiveFindingType = Exclude<CitedFindingType, "summary-sentence" | "checklist-item">;

const FINDING_NAMES: Record<ExclusiveFindingType, { one: string; many: string; label: string }> = {
  "risk-flag": { one: "Risk flag", many: "Risk flags", label: "a Risk flag" },
  "worth-a-look": { one: "Worth a look entry", many: "Worth a look entries", label: "Worth a look" },
  "multiplier-note": { one: "Multiplier note", many: "Multiplier notes", label: "a Multiplier note" },
};

/**
 * How many parts of a long Document are sent to the model at once. Two, not all of them: the calls
 * go to one provider (Fireworks, pinned with no fallback), whose rate limit a burst of parallel
 * requests would hit, and a rate-limit error fails the whole analysis. Two still roughly halves the
 * wait against the route's time limit. A Document in one part makes one call either way.
 */
const PART_CONCURRENCY = 2;

export interface AnalyseOptions {
  /**
   * The most characters of unit lines one model call may carry. Defaults to `DEFAULT_PART_BUDGET`;
   * see there for why. Tests pass a small one to split short fixtures.
   */
  partBudget?: number;
}

type ShownFinding<T extends RawCitedFinding> = { raw: T; unit: SentenceUnit; index: number; shown: [Claim, ...Claim[]] };

type CitedSummarySentence = { raw: RawSummarySentence; sources: [SourceSentence, ...SourceSentence[]] };

/** What one model response yields once every citation in it matched and its claims were checked. */
interface PartAnalysis {
  readonly part: DocumentPart;
  readonly flags: ShownFinding<RawRiskFlag>[];
  readonly worthALook: ShownFinding<RawCitedFinding>[];
  readonly multiplierNotes: ShownFinding<RawCitedFinding>[];
  readonly summary: CitedSummarySentence[];
  readonly missingProtections: RawMissingProtection[];
  readonly niceToHave: RawAbsence<NiceToHaveKind>[];
  readonly checklist: RawChecklistItem[];
  readonly checkUnits: Map<CheckId, SentenceUnit>;
}

export async function analyse(
  documentText: string,
  redLines: readonly RedLine[],
  modelClient: ModelClient,
  options: AnalyseOptions = {},
): Promise<AnalysisResult> {
  const units = segmentSentences(documentText);
  if (units.length === 0) {
    throw new AnalysisResponseError("The document has no text to analyse.");
  }

  const parts = splitIntoParts(units, options.partBudget ?? DEFAULT_PART_BUDGET);
  const unitsById = new Map<string, SentenceUnit>(units.map((unit) => [unit.id, unit]));
  const analysed = await runEveryPart(parts, async (part) => {
    const position = parts.length > 1 ? { index: part.index, count: parts.length } : undefined;
    const response = await modelClient.completeJson(buildAnalysisRequest(part.units, redLines, position));
    const analysis = readPart(response, part, documentText, unitsById);
    // Each part must hold together on its own before it is merged: a part whose checklist
    // contradicts its own findings is as malformed as a whole-Document answer that does.
    if (parts.length > 1) assemble(documentText, [analysis]);
    return analysis;
  });
  return assemble(documentText, analysed);
}

/**
 * Runs every part, at most `PART_CONCURRENCY` at a time, and returns their analyses in part order.
 * Any part failing (the model call rejecting, a malformed answer, a citation that does not match)
 * fails the whole analysis: no further part is started, and the error of the earliest failed part
 * is thrown once the parts already running have settled. There is no partial result.
 */
async function runEveryPart(
  parts: readonly DocumentPart[],
  task: (part: DocumentPart) => Promise<PartAnalysis>,
): Promise<PartAnalysis[]> {
  const results: PartAnalysis[] = [];
  const failures: { index: number; error: unknown }[] = [];
  let next = 0;
  const worker = async () => {
    while (failures.length === 0 && next < parts.length) {
      const part = parts[next++];
      try {
        results[part.index] = await task(part);
      } catch (error) {
        if (parts.length > 1 && error instanceof Error) {
          error.message = `Part ${part.index + 1} of ${parts.length}: ${error.message}`;
        }
        failures.push({ index: part.index, error });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, parts.length) }, worker));
  if (failures.length > 0) {
    throw failures.sort((a, b) => a.index - b.index)[0].error;
  }
  return results;
}

/**
 * Reads one model response and checks every citation in it against the full stored text. Unit ids
 * are the full-text ids, so a span from any part resolves to offsets in the whole Document.
 */
function readPart(
  response: unknown,
  part: DocumentPart,
  documentText: string,
  unitsById: ReadonlyMap<string, SentenceUnit>,
): PartAnalysis {
  const rawFlags = readRiskFlags(response);
  const rawWorthALook = readUnrankedFindings(response, "worthALook", "worth-a-look");
  const rawMultiplierNotes = readUnrankedFindings(response, "multiplierNotes", "multiplier-note");
  const missingProtections = readAbsences(response, "missingProtections", PROTECTION_KINDS, ABSENCE_NAMES.missingProtections);
  const niceToHave = readAbsences(response, "niceToHave", NICE_TO_HAVE_KINDS, ABSENCE_NAMES.niceToHave);
  const rawSummary = readSummary(response);
  const checklist = readChecklist(response);

  // Every cited finding type goes through one validation pass, so a single CitationError names every
  // failed finding of any type. Summary sentences are checked span by span, withheld ones included.
  // Checklist entries that say something is in the text are checked too: they are claims about a
  // sentence, so they must show it verbatim like any other (ADR-0001).
  const failures: FailedCitation[] = [];
  const citedFlags = citeAll("risk-flag", rawFlags, documentText, unitsById, failures);
  const citedWorthALook = citeAll("worth-a-look", rawWorthALook, documentText, unitsById, failures);
  const citedMultiplierNotes = citeAll("multiplier-note", rawMultiplierNotes, documentText, unitsById, failures);
  const summary = citeSummary(rawSummary, documentText, unitsById, failures);
  const citedChecks = checklist.filter((item) => CITED_OUTCOMES.includes(item.outcome));
  const checkUnits = new Map(
    citeAll("checklist-item", citedChecks, documentText, unitsById, failures).map(({ raw, unit }) => [raw.check, unit]),
  );

  if (failures.length > 0) {
    throw new CitationError(
      failures,
      rawFlags.length + rawWorthALook.length + rawMultiplierNotes.length + rawSummary.length + citedChecks.length,
    );
  }

  // A part may cite only the units it was shown. A unit from elsewhere in the Document matches the
  // stored text, but the model was never shown it in this request, so the answer is malformed.
  const shown = new Set(part.units.map((unit) => unit.id));
  const outside = [
    ...[...citedFlags, ...citedWorthALook, ...citedMultiplierNotes].map(({ unit }) => unit.id),
    ...rawSummary.flatMap((sentence) => sentence.sources.map((span) => span.unitId)),
    ...[...checkUnits.values()].map((unit) => unit.id),
  ].filter((id, position, ids) => !shown.has(id) && ids.indexOf(id) === position);
  if (outside.length > 0) {
    throw new AnalysisResponseError(
      `The model's answer cites ${outside.length === 1 ? "a unit" : "units"} outside the part it was shown: ${outside.join(", ")}.`,
    );
  }

  // A sentence cited under two finding types is a contradictory response, and the analysis fails as
  // malformed rather than picking one, because either choice would silently override the model on
  // the load-bearing judgement.
  // - Risk flag and Worth a look: a clause cannot be uncapped-or-inescapable and bounded at once
  //   (ADR-0004, ADR-0006). Keeping the flag hides that the model also called the clause bounded;
  //   keeping Worth a look demotes a clause the model said could sink the Signer.
  // - Multiplier note and either other type: a multiplier is kept out of the ranking whatever its
  //   legal weight (ADR-0003), so a multiplier that is also a Risk flag has been ranked, and one that
  //   is also Worth a look has been judged as a harm of its own.
  failIfCitedTwice([
    ["risk-flag", citedFlags],
    ["worth-a-look", citedWorthALook],
    ["multiplier-note", citedMultiplierNotes],
  ]);

  return {
    part,
    flags: withShownClaims("risk-flag", citedFlags),
    worthALook: withShownClaims("worth-a-look", citedWorthALook),
    multiplierNotes: withShownClaims("multiplier-note", citedMultiplierNotes),
    summary,
    missingProtections,
    niceToHave,
    checklist,
    checkUnits,
  };
}

/**
 * Builds the result from the analysed parts, in part order. A Document in one part goes through
 * the same code, and every rule below then reduces to reading that one answer as it is.
 *
 * Merge rules for a Document analysed in parts:
 * - Risk flags, Worth a look and Multiplier notes are the union across parts. Parts overlap at their
 *   edges, so two parts can cite the same unit: under the same type that is one finding, taken from
 *   the earliest part that cites it (its title, claims and Counter-offer). Two Risk flags on one unit
 *   with a different severity band or check contradict each other and fail the analysis as
 *   malformed, and one unit under two different types fails as it does within one answer. Ranking
 *   runs once, over the merged Risk flags: band, then the model's rank, then Document order.
 * - Summary: every part's shown sentences, in part order, with no cap, so the summary covers the
 *   whole Document and not only its start. A sentence citing exactly the same units as a sentence
 *   from an earlier part is the overlap read twice, and only the first is kept. Every span was
 *   validated in its own part.
 * - Checklist: a protection is present if any part marks it present, citing that part's sentence
 *   (the earliest). A harm check is flagged if any part flags it, else bounded if any part finds it
 *   bounded (the earliest citation), else not-found. A bounded citation from any part on a sentence
 *   that is a merged Risk flag fails the analysis. The merged checklist then faces the same
 *   contradiction checks against the merged findings as a single answer does.
 * - Missing protections and Nice to have: raised only when the whole Document lacks the term. Their
 *   union is taken one entry per kind (the earliest part's wording), and any kind the merged
 *   checklist marks present is dropped, whichever part raised it. A kind left as both a Missing
 *   protection and a Nice to have fails as it does within one answer.
 * - `nothingFound` is computed on the merged Risk flags.
 */
function assemble(documentText: string, analyses: readonly PartAnalysis[]): AnalysisResult {
  const inParts = analyses.length > 1;

  failIfCitedTwice([
    ["risk-flag", analyses.flatMap((analysis) => analysis.flags)],
    ["worth-a-look", analyses.flatMap((analysis) => analysis.worthALook)],
    ["multiplier-note", analyses.flatMap((analysis) => analysis.multiplierNotes)],
  ]);
  if (inParts) failIfFlaggedDifferently(analyses);

  const flagsWithClaims = firstPerUnit(analyses.map((analysis) => analysis.flags));
  const worthALookWithClaims = firstPerUnit(analyses.map((analysis) => analysis.worthALook));
  const multiplierNotesWithClaims = firstPerUnit(analyses.map((analysis) => analysis.multiplierNotes));

  const bandOrder = (band: SeverityBand) => SEVERITY_BANDS.indexOf(band);
  flagsWithClaims.sort(
    (a, b) =>
      bandOrder(a.raw.severityBand) - bandOrder(b.raw.severityBand) ||
      a.raw.rank - b.raw.rank ||
      a.unit.start - b.unit.start,
  );

  const riskFlags: RiskFlag[] = flagsWithClaims.map(({ raw, unit, shown }, position) => ({
    kind: "risk-flag",
    rank: position + 1,
    severityBand: raw.severityBand,
    title: raw.title,
    check: raw.check,
    claims: shown,
    source: sourceOf(documentText, unit),
    counterOffer: raw.counterOffer.trim(),
  }));

  // Worth a look is never ranked: it keeps the Document's order.
  worthALookWithClaims.sort((a, b) => a.unit.start - b.unit.start);
  const worthALook: WorthALook[] = worthALookWithClaims.map(({ raw, unit, shown }) => ({
    kind: "worth-a-look",
    title: raw.title,
    claims: shown,
    source: sourceOf(documentText, unit),
  }));

  // Multiplier notes are never ranked either: they keep the Document's order.
  multiplierNotesWithClaims.sort((a, b) => a.unit.start - b.unit.start);
  const multiplierNotes: MultiplierNote[] = multiplierNotesWithClaims.map(({ raw, unit, shown }) => ({
    kind: "multiplier-note",
    title: raw.title,
    claims: shown,
    source: sourceOf(documentText, unit),
  }));

  const { items: mergedChecklist, units: checkUnits } = mergeChecklists(analyses);
  if (inParts) failIfBoundedIsFlagged(analyses, riskFlags);

  // Within one answer, a kind marked present beside an absence of that kind is a contradiction that
  // toChecklist reports. Across parts it is the point of merging: the part that lacks the term did
  // not see the part that states it.
  const presentKinds = new Set<string>(
    inParts ? mergedChecklist.filter((item) => item.outcome === "present").map((item) => item.check) : [],
  );
  const missingProtections = toMissingProtections(
    firstPerKind(analyses.map((analysis) => analysis.missingProtections)).filter((entry) => !presentKinds.has(entry.protection)),
  );
  const niceToHave = toNiceToHave(
    firstPerKind(analyses.map((analysis) => analysis.niceToHave)).filter((entry) => !presentKinds.has(entry.protection)),
  );
  failIfRaisedAsBothAbsences(missingProtections, niceToHave);
  const checklist = toChecklist(mergedChecklist, checkUnits, documentText, riskFlags, missingProtections, niceToHave);

  return {
    summary: toShownSummary(mergeSummaries(analyses)),
    // Computed here from the flags that survived validation. The model is never asked whether the
    // Document is clean, so it cannot declare it clean on its own.
    nothingFound: riskFlags.length === 0,
    checklist,
    riskFlags,
    worthALook,
    multiplierNotes,
    missingProtections,
    niceToHave,
  };
}

/** One finding per unit, the earliest part's. Within one part, failIfCitedTwice has already run. */
function firstPerUnit<T extends { unit: SentenceUnit }>(perPart: readonly (readonly T[])[]): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const findings of perPart) {
    const fromThisPart = findings.filter((finding) => !seen.has(finding.unit.id));
    kept.push(...fromThisPart);
    for (const finding of fromThisPart) seen.add(finding.unit.id);
  }
  return kept;
}

/** One absence per kind, the earliest part's, in the order first raised. */
function firstPerKind<T extends { protection: NiceToHaveKind }>(perPart: readonly (readonly T[])[]): T[] {
  const kept: T[] = [];
  for (const entries of perPart) {
    for (const entry of entries) {
      if (!kept.some((candidate) => candidate.protection === entry.protection)) kept.push(entry);
    }
  }
  return kept;
}

/**
 * Summary sentences in part order. A sentence citing the same units as one from an earlier part is
 * dropped: it is the overlap between parts summarised twice. Sentences within one part are never
 * dropped.
 */
function mergeSummaries(analyses: readonly PartAnalysis[]): CitedSummarySentence[] {
  const earlierKeys = new Set<string>();
  const merged: CitedSummarySentence[] = [];
  for (const analysis of analyses) {
    const keyOf = (sentence: CitedSummarySentence) => sentence.sources.map((source) => source.start).join(",");
    merged.push(...analysis.summary.filter((sentence) => !earlierKeys.has(keyOf(sentence))));
    for (const sentence of analysis.summary) earlierKeys.add(keyOf(sentence));
  }
  return merged;
}

/**
 * One checklist entry per check across parts. Harm checks: flagged beats bounded beats not-found.
 * Protection checks: present beats missing. Among entries with the winning outcome, the earliest
 * part's is kept, with its citation.
 */
function mergeChecklists(analyses: readonly PartAnalysis[]): {
  items: RawChecklistItem[];
  units: Map<CheckId, SentenceUnit>;
} {
  const strength: Record<CheckOutcome, number> = { flagged: 2, bounded: 1, "not-found": 0, present: 1, missing: 0 };
  const items: RawChecklistItem[] = [];
  const units = new Map<CheckId, SentenceUnit>();
  for (const check of CHECK_IDS) {
    let chosen: { item: RawChecklistItem; analysis: PartAnalysis } | undefined;
    for (const analysis of analyses) {
      // readChecklist already rejected a checklist that leaves out any check.
      const item = analysis.checklist.find((candidate) => candidate.check === check)!;
      if (!chosen || strength[item.outcome] > strength[chosen.item.outcome]) chosen = { item, analysis };
    }
    items.push(chosen!.item);
    const unit = chosen!.analysis.checkUnits.get(check);
    if (unit) units.set(check, unit);
  }
  return { items, units };
}

/**
 * The same sentence flagged by two parts with a different severity band or check is two judgements
 * of one clause. Keeping either would override the model on the other, so the analysis fails.
 */
function failIfFlaggedDifferently(analyses: readonly PartAnalysis[]): void {
  const firstByUnit = new Map<string, RawRiskFlag>();
  const problems: string[] = [];
  for (const { raw, unit } of analyses.flatMap((analysis) => analysis.flags)) {
    const first = firstByUnit.get(unit.id);
    if (!first) {
      firstByUnit.set(unit.id, raw);
    } else if (first.severityBand !== raw.severityBand || first.check !== raw.check) {
      problems.push(
        `unit ${unit.id} as ${first.severityBand} ${first.check} and as ${raw.severityBand} ${raw.check}`,
      );
    }
  }
  if (problems.length === 0) return;
  throw new AnalysisResponseError(`Two parts flag the same sentence differently: ${problems.join(", ")}.`);
}

/**
 * A part that found a clause bounded while another part flagged the same sentence has judged one
 * clause capped and uncapped at once. The merged checklist would keep only the flag and hide that,
 * so the analysis fails.
 */
function failIfBoundedIsFlagged(analyses: readonly PartAnalysis[], riskFlags: readonly RiskFlag[]): void {
  const problems: string[] = [];
  for (const analysis of analyses) {
    for (const [check, unit] of analysis.checkUnits) {
      const item = analysis.checklist.find((candidate) => candidate.check === check)!;
      if (item.outcome !== "bounded") continue;
      const flag = riskFlags.find((candidate) => candidate.source.start === unit.start && candidate.source.end === unit.end);
      if (flag) problems.push(`${check} is marked bounded in part ${analysis.part.index + 1}, citing unit ${unit.id}, which is Risk flag #${flag.rank}`);
    }
  }
  if (problems.length > 0) {
    throw new AnalysisResponseError(`The checklist contradicts the findings: ${problems.join("; ")}.`);
  }
}

/**
 * Nice to have keeps the model's order: it is not ranked, and there is no measured harm to sort
 * by. Identifiers are assigned in that order. Like a Missing protection, nothing here touches the
 * Document text, and needs-signer-facts claims are withheld.
 */
function toNiceToHave(raw: readonly RawAbsence<NiceToHaveKind>[]): NiceToHave[] {
  return raw.map((entry, position) => ({
    kind: "nice-to-have",
    id: `NH-${String(position + 1).padStart(2, "0")}`,
    protection: entry.protection,
    statement: entry.statement.trim(),
    claims: entry.claims.filter((claim): claim is InferenceClaim => claim.tier === "inference"),
    proposedInsertion: entry.proposedInsertion.trim(),
  }));
}

/**
 * A kind raised both as a Missing protection and as a Nice to have is a contradictory response: the
 * same absence cannot be harmful enough to be a Missing protection and not harmful enough at once.
 * Picking either would override the model on that judgement, so the analysis fails as malformed.
 */
function failIfRaisedAsBothAbsences(missing: readonly MissingProtection[], niceToHave: readonly NiceToHave[]): void {
  const both = niceToHave.filter((entry) => missing.some((candidate) => candidate.protection === entry.protection));
  if (both.length === 0) return;
  throw new AnalysisResponseError(
    `The model's answer raises the same kind as a Missing protection and as a Nice to have: ` +
      both.map((entry) => entry.protection).join(", ") +
      ".",
  );
}

/**
 * Builds the checklist in `CHECK_IDS` order and fails the whole analysis as malformed when it
 * contradicts the findings. The checklist is what makes a clean result credible (ADR-0008), so a
 * checklist that says one thing while the findings say another is never shown:
 * - a harm check marked flagged with no Risk flag of that kind, or marked not-found or bounded while
 *   a Risk flag of that kind was returned;
 * - a bounded check citing the same sentence as a Risk flag;
 * - a protection check marked present while a Missing protection or Nice to have of that kind was
 *   returned, or marked missing with neither.
 * A Risk flag checked as "other" belongs to no check and constrains none.
 */
function toChecklist(
  raw: readonly RawChecklistItem[],
  citedUnits: ReadonlyMap<CheckId, SentenceUnit>,
  documentText: string,
  riskFlags: readonly RiskFlag[],
  missingProtections: readonly MissingProtection[],
  niceToHave: readonly NiceToHave[],
): [ChecklistItem, ...ChecklistItem[]] {
  const problems: string[] = [];
  const byCheck = new Map(raw.map((item) => [item.check, item]));
  const items = CHECK_IDS.map((check): ChecklistItem | null => {
    // readChecklist already rejected a checklist that leaves out any check.
    const item = byCheck.get(check)!;
    const detail = item.detail.trim();
    if (isHarmCheck(check)) {
      const flags = riskFlags.filter((flag) => flag.check === check);
      const ranks = flags.map((flag) => `#${flag.rank}`).join(", ");
      if (item.outcome === "flagged") {
        if (flags.length === 0) {
          problems.push(`${check} is marked flagged, but no Risk flag is of that kind`);
          return null;
        }
        const riskFlagRanks = flags.map((flag) => flag.rank) as [number, ...number[]];
        return { kind: "checklist-item", check, outcome: "flagged", riskFlagRanks };
      }
      if (flags.length > 0) {
        problems.push(`${check} is marked ${item.outcome}, but Risk flag ${ranks} is of that kind`);
        return null;
      }
      if (item.outcome === "not-found") return { kind: "checklist-item", check, outcome: "not-found" };
      const unit = citedUnits.get(check)!;
      const sameSentence = riskFlags.find((flag) => flag.source.start === unit.start && flag.source.end === unit.end);
      if (sameSentence) {
        problems.push(`${check} is marked bounded, citing unit ${unit.id}, which is Risk flag #${sameSentence.rank}`);
        return null;
      }
      return { kind: "checklist-item", check, outcome: "bounded", detail, source: sourceOf(documentText, unit) };
    }
    const absences = [...missingProtections, ...niceToHave].filter((entry) => entry.protection === check);
    if (item.outcome === "present") {
      if (absences.length > 0) {
        problems.push(`${check} is marked present, but ${absences[0].id} says the Document leaves it out`);
        return null;
      }
      const unit = citedUnits.get(check)!;
      return { kind: "checklist-item", check, outcome: "present", detail, source: sourceOf(documentText, unit) };
    }
    if (absences.length === 0) {
      problems.push(`${check} is marked missing, but no Missing protection or Nice to have is of that kind`);
      return null;
    }
    // failIfRaisedAsBothAbsences already ruled out two absences of one kind.
    const [absence] = absences;
    return { kind: "checklist-item", check, outcome: "missing", absence: { kind: absence.kind, id: absence.id } };
  });
  if (problems.length > 0) {
    throw new AnalysisResponseError(`The checklist contradicts the findings: ${problems.join("; ")}.`);
  }
  return items as [ChecklistItem, ...ChecklistItem[]];
}

const CHECKLIST_FIELDS = ["check", "outcome", "unitId", "quote", "detail"] as const;

/**
 * Reads the checklist. Any of these fails the whole analysis as malformed: no checklist list, an
 * empty one, an unknown check, the same check twice, a check left out, an outcome that does not
 * belong to its check's group, a cited outcome (bounded, present) with a blank unit id, quote or
 * detail, or an uncited outcome (not-found, flagged, missing) that carries any of them. An absence
 * carrying a quote would cite text it claims is not there, so it is never ignored.
 */
function readChecklist(response: unknown): RawChecklistItem[] {
  if (typeof response !== "object" || response === null || !Array.isArray((response as Record<string, unknown>).checklist)) {
    throw new AnalysisResponseError("The model's answer has no checklist.");
  }
  const list = (response as Record<string, unknown[]>).checklist;
  if (list.length === 0) {
    throw new AnalysisResponseError("The model's answer has an empty checklist.");
  }
  const seen = new Map<CheckId, number>();
  const items = list.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new AnalysisResponseError(`Checklist item #${index} in the model's answer is malformed: it is not an object.`);
    }
    const entry = item as Record<string, unknown>;
    const problems: string[] = [];
    for (const key of Object.keys(entry)) {
      if (!(CHECKLIST_FIELDS as readonly string[]).includes(key)) problems.push(`it has an unexpected field ${JSON.stringify(key)}`);
    }
    const check = entry.check as CheckId;
    const knownCheck = CHECK_IDS.includes(check);
    if (!knownCheck) {
      problems.push("check is not a known check");
    } else if (seen.has(check)) {
      problems.push(`check ${check} is a duplicate of checklist item #${seen.get(check)}`);
    } else {
      seen.set(check, index);
    }
    const outcome = entry.outcome as CheckOutcome;
    if (!CHECK_OUTCOMES.includes(outcome)) {
      problems.push("outcome is not a known outcome");
    } else if (knownCheck) {
      const allowed: readonly CheckOutcome[] = isHarmCheck(check) ? HARM_OUTCOMES : PROTECTION_OUTCOMES;
      if (!allowed.includes(outcome)) problems.push(`outcome ${outcome} does not apply to check ${check}`);
    }
    for (const key of ["unitId", "quote", "detail"] as const) {
      if (typeof entry[key] !== "string") problems.push(`${key} is not a string`);
    }
    if (CHECK_OUTCOMES.includes(outcome) && problems.length === 0) {
      const cited = CITED_OUTCOMES.includes(outcome);
      for (const key of ["unitId", "quote", "detail"] as const) {
        const blank = (entry[key] as string).trim() === "";
        if (cited && blank) problems.push(`${key} is blank, but a ${outcome} check cites the sentence it rests on`);
        if (!cited && entry[key] !== "") problems.push(`it has a ${key}, but a ${outcome} check cites nothing`);
      }
    }
    if (problems.length > 0) {
      throw new AnalysisResponseError(`Checklist item #${index} in the model's answer is malformed: ${problems.join(", ")}.`);
    }
    return entry as unknown as RawChecklistItem;
  });
  const leftOut = CHECK_IDS.filter((check) => !seen.has(check));
  if (leftOut.length > 0) {
    throw new AnalysisResponseError(`The checklist leaves out ${leftOut.join(", ")}.`);
  }
  return items;
}

/**
 * Resolves every span of every summary sentence. A sentence is returned only when all of its spans
 * matched; any failed span is recorded, and the caller then throws for the whole analysis.
 */
function citeSummary(
  sentences: readonly RawSummarySentence[],
  documentText: string,
  unitsById: ReadonlyMap<string, SentenceUnit>,
  failures: FailedCitation[],
): { raw: RawSummarySentence; sources: [SourceSentence, ...SourceSentence[]] }[] {
  const cited: { raw: RawSummarySentence; sources: [SourceSentence, ...SourceSentence[]] }[] = [];
  sentences.forEach((raw, index) => {
    const sources: SourceSentence[] = [];
    raw.sources.forEach(({ unitId, quote }, spanIndex) => {
      const unit = unitsById.get(unitId);
      if (!unit) {
        failures.push({ index, findingType: "summary-sentence", spanIndex, unitId, quote, reason: "unknown-unit" });
      } else if (documentText.slice(unit.start, unit.end) !== quote) {
        failures.push({ index, findingType: "summary-sentence", spanIndex, unitId, quote, reason: "quote-mismatch" });
      } else {
        sources.push(sourceOf(documentText, unit));
      }
    });
    // readSummary already rejected a sentence with no spans, so a full match is never empty.
    if (sources.length === raw.sources.length) {
      cited.push({ raw, sources: sources as [SourceSentence, ...SourceSentence[]] });
    }
  });
  return cited;
}

// Summary sentences that need facts about the Signer are withheld entirely (ADR-0007): not shown, and
// not in the result, so no display can leak them.
//
// A summary left empty, whether the model sent none or every sentence was withheld, fails the whole
// analysis as malformed rather than being returned empty. Any Document with text says at least what
// it is, and that can be read straight off one of its sentences, so an empty summary means the model
// broke the rule to open with a read-off sentence. Returning it empty would put a blank at the top of
// the result, where the Signer looks first, and read as though the Document said nothing.
function toShownSummary(
  cited: readonly { raw: RawSummarySentence; sources: [SourceSentence, ...SourceSentence[]] }[],
): [SummarySentence, ...SummarySentence[]] {
  const shown = cited
    .filter(({ raw }) => raw.tier !== "needs-signer-facts")
    .map(
      ({ raw, sources }): SummarySentence => ({
        kind: "summary-sentence",
        tier: raw.tier as SummarySentence["tier"],
        text: raw.text.trim(),
        sources,
      }),
    );
  if (shown.length === 0) {
    throw new AnalysisResponseError(
      cited.length === 0
        ? "The model's answer has an empty summary."
        : "The summary has no sentence left once sentences needing facts about the Signer are withheld.",
    );
  }
  return shown as [SummarySentence, ...SummarySentence[]];
}

/**
 * Reads the summary. Any of these fails the whole analysis as malformed: a sentence with blank text,
 * an unknown tier, no sources list, zero spans (a summary sentence that points at nothing is exactly
 * what ADR-0010 rules out), a span without a string unit id and quote, or the same unit cited twice
 * in one sentence.
 */
function readSummary(response: unknown): RawSummarySentence[] {
  if (typeof response !== "object" || response === null || !Array.isArray((response as Record<string, unknown>).summary)) {
    throw new AnalysisResponseError("The model's answer has no summary list.");
  }
  return ((response as Record<string, unknown[]>).summary).map((item, index) => {
    const sentence = item as Partial<Record<keyof RawSummarySentence, unknown>> | undefined;
    const problems: string[] = [];
    if (typeof sentence?.text !== "string" || sentence.text.trim() === "") problems.push("text is blank");
    if (!PROVENANCE_TIERS.includes(sentence?.tier as ProvenanceTier)) problems.push("tier is not a known tier");
    if (!Array.isArray(sentence?.sources)) {
      problems.push("sources is not a list");
    } else if (sentence.sources.length === 0) {
      problems.push("it cites no span of the document");
    } else {
      const seen = new Set<string>();
      sentence.sources.forEach((span: unknown, spanIndex: number) => {
        const { unitId, quote } = (span ?? {}) as { unitId?: unknown; quote?: unknown };
        if (typeof unitId !== "string" || typeof quote !== "string") {
          problems.push(`span ${spanIndex} has no unitId or quote`);
          return;
        }
        if (seen.has(unitId)) problems.push(`span ${spanIndex} cites unit ${unitId} a second time`);
        seen.add(unitId);
      });
    }
    if (problems.length > 0) {
      throw new AnalysisResponseError(`Summary sentence #${index} in the model's answer is malformed: ${problems.join(", ")}.`);
    }
    return sentence as RawSummarySentence;
  });
}

/**
 * Missing protections sort in their own list, never merged with the Risk flag ranking (ADR-0005).
 * Payment timing, then payment amount, come first because they carry the largest measured harm
 * (PRD §5); the rest keep the model's order. Identifiers are assigned after sorting, so `MP-01` is
 * always the first entry shown.
 *
 * Nothing here reads or touches the Document text: a Missing protection has no offsets to resolve,
 * and its Proposed insertion is returned beside the text, never written into it.
 */
function toMissingProtections(raw: readonly RawMissingProtection[]): MissingProtection[] {
  const paymentFirst: ProtectionKind[] = ["payment-timing", "payment-amount"];
  const priority = (entry: RawMissingProtection) => {
    const position = paymentFirst.indexOf(entry.protection);
    return position === -1 ? paymentFirst.length : position;
  };
  return raw
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => priority(a.entry) - priority(b.entry) || a.index - b.index)
    .map(({ entry }, position) => ({
      kind: "missing-protection",
      id: `MP-${String(position + 1).padStart(2, "0")}`,
      protection: entry.protection,
      statement: entry.statement.trim(),
      // Provenance (ADR-0007) for an absence: the statement is a claim about the Document as a whole,
      // checkable by reading all of it, so it is stated flat. No claim can be read-off, because there
      // is no sentence; a read-off tier was already rejected as malformed. Claims that depend on the
      // Signer's facts are withheld here, and unlike a cited finding, a Missing protection left with
      // no claims still stands: its statement and Proposed insertion carry it, not its claims.
      claims: entry.claims.filter((claim): claim is InferenceClaim => claim.tier === "inference"),
      proposedInsertion: entry.proposedInsertion.trim(),
    }));
}

// Summary sentences are not part of this check: a summary sentence may rest on a sentence that is
// also a Risk flag, since saying what the Document commits the Signer to is not a judgement of harm.
function failIfCitedTwice(
  groups: readonly (readonly [ExclusiveFindingType, readonly { unit: SentenceUnit }[]])[],
): void {
  const typesByUnit = new Map<string, ExclusiveFindingType[]>();
  for (const [findingType, findings] of groups) {
    for (const { unit } of findings) {
      const types = typesByUnit.get(unit.id) ?? [];
      if (!types.includes(findingType)) types.push(findingType);
      typesByUnit.set(unit.id, types);
    }
  }
  const contradictions = [...typesByUnit].filter(([, types]) => types.length > 1);
  if (contradictions.length === 0) return;
  throw new AnalysisResponseError(
    `${contradictions.length === 1 ? "A sentence is" : `${contradictions.length} sentences are`} cited under more than one finding type: ` +
      contradictions
        .map(([unitId, types]) => `unit ${unitId} as ${types.map((type) => FINDING_NAMES[type].label).join(" and as ")}`)
        .join(", ") +
      ".",
  );
}

function citeAll<T extends { unitId: string; quote: string }>(
  findingType: Exclude<CitedFindingType, "summary-sentence">,
  findings: readonly T[],
  documentText: string,
  unitsById: ReadonlyMap<string, SentenceUnit>,
  failures: FailedCitation[],
): { raw: T; unit: SentenceUnit; index: number }[] {
  const cited: { raw: T; unit: SentenceUnit; index: number }[] = [];
  findings.forEach((raw, index) => {
    const unit = unitsById.get(raw.unitId);
    if (!unit) {
      failures.push({ index, findingType, unitId: raw.unitId, quote: raw.quote, reason: "unknown-unit" });
      return;
    }
    if (documentText.slice(unit.start, unit.end) !== raw.quote) {
      failures.push({ index, findingType, unitId: raw.unitId, quote: raw.quote, reason: "quote-mismatch" });
      return;
    }
    cited.push({ raw, unit, index });
  });
  return cited;
}

// Claims that need facts about the Signer are withheld here, so they never reach the result and
// no display can show them (ADR-0007).
//
// A cited finding whose every claim is withheld fails the whole analysis with AnalysisResponseError.
// It is not dropped: a dropped finding hides a sentence the model judged worth showing, which is an
// invisible failure. It is not returned with no claims either: a finding nothing can be said about
// from its own sentence is not grounded in that sentence. The prompt requires every finding to open
// with a read-off claim, so this means the model broke that rule.
function withShownClaims<T extends RawCitedFinding>(
  findingType: ExclusiveFindingType,
  cited: readonly { raw: T; unit: SentenceUnit; index: number }[],
): { raw: T; unit: SentenceUnit; index: number; shown: [Claim, ...Claim[]] }[] {
  const withClaims = cited.map((finding) => ({ ...finding, shown: finding.raw.claims.filter(isShown) }));
  const emptied = withClaims.filter((finding) => finding.shown.length === 0);
  if (emptied.length > 0) {
    const names = FINDING_NAMES[findingType];
    throw new AnalysisResponseError(
      `${emptied.length} ${emptied.length === 1 ? `${names.one} has` : `${names.many} have`} no claim left once claims needing facts about the Signer are withheld: ` +
        emptied.map((finding) => `#${finding.index} (unit ${finding.raw.unitId})`).join(", ") +
        ".",
    );
  }
  return withClaims as { raw: T; unit: SentenceUnit; index: number; shown: [Claim, ...Claim[]] }[];
}

function sourceOf(documentText: string, unit: SentenceUnit): SourceSentence {
  return { start: unit.start, end: unit.end, text: documentText.slice(unit.start, unit.end) };
}

function isShown(claim: RawClaim): claim is Claim {
  return claim.tier !== "needs-signer-facts";
}

const ABSENCE_FIELDS = ["protection", "statement", "claims", "proposedInsertion"] as const;

const ABSENCE_NAMES = {
  missingProtections: { one: "Missing protection", lower: "missing protection" },
  niceToHave: { one: "Nice to have", lower: "nice to have" },
} as const;

/**
 * Reads the Missing protections or the Nice to have list, which share a shape. Any of these fails
 * the whole analysis as malformed: an unknown kind, the same kind twice in one list, a blank
 * statement, a missing or blank Proposed insertion, a read-off claim, or any field beyond the four
 * above. A unit id or quote on an absence would be a citation of text the entry claims is absent,
 * so it is never ignored.
 */
function readAbsences<K extends NiceToHaveKind>(
  response: unknown,
  key: "missingProtections" | "niceToHave",
  kinds: readonly K[],
  names: { one: string; lower: string },
): RawAbsence<K>[] {
  const seen = new Map<K, number>();
  return readList(response, key).map((item, index) => {
    const problems: string[] = [];
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new AnalysisResponseError(`${names.one} #${index} in the model's answer is malformed: it is not an object.`);
    }
    const entry = item as Record<string, unknown>;
    for (const field of Object.keys(entry)) {
      if (!(ABSENCE_FIELDS as readonly string[]).includes(field)) {
        problems.push(
          field === "unitId" || field === "quote" || field === "source"
            ? `it has a ${field}, but a ${names.lower} cites nothing`
            : `it has an unexpected field ${JSON.stringify(field)}`,
        );
      }
    }
    if (!kinds.includes(entry.protection as K)) {
      problems.push("protection is not a known kind");
    } else {
      const kind = entry.protection as K;
      if (seen.has(kind)) problems.push(`protection ${kind} is a duplicate of ${names.lower} #${seen.get(kind)}`);
      else seen.set(kind, index);
    }
    if (typeof entry.statement !== "string" || entry.statement.trim() === "") problems.push("statement is blank");
    if (typeof entry.proposedInsertion !== "string") {
      problems.push("proposedInsertion is missing");
    } else if (entry.proposedInsertion.trim() === "") {
      problems.push("proposedInsertion is blank");
    }
    if (!Array.isArray(entry.claims)) {
      problems.push("claims is not a list");
    } else {
      entry.claims.forEach((claim: unknown, claimIndex: number) => {
        const { tier, text } = (claim ?? {}) as { tier?: unknown; text?: unknown };
        if (tier === "read-off") problems.push(`claim ${claimIndex} is read-off, but there is no sentence to read it off`);
        else if (!PROVENANCE_TIERS.includes(tier as ProvenanceTier)) problems.push(`claim ${claimIndex} has no known tier`);
        if (typeof text !== "string" || text.trim() === "") problems.push(`claim ${claimIndex} has no text`);
      });
    }
    if (problems.length > 0) {
      throw new AnalysisResponseError(`${names.one} #${index} in the model's answer is malformed: ${problems.join(", ")}.`);
    }
    return entry as unknown as RawAbsence<K>;
  });
}

function readList(
  response: unknown,
  key: "riskFlags" | "worthALook" | "multiplierNotes" | "missingProtections" | "niceToHave",
): unknown[] {
  if (typeof response !== "object" || response === null || !Array.isArray((response as Record<string, unknown>)[key])) {
    throw new AnalysisResponseError(`The model's answer has no ${key} list.`);
  }
  return (response as Record<string, unknown[]>)[key];
}

/** Problems with the fields every cited finding shares. */
function citedFindingProblems(finding: Partial<Record<keyof RawCitedFinding, unknown>> | undefined): string[] {
  const problems: string[] = [];
  for (const key of ["unitId", "quote", "title"] as const) {
    if (typeof finding?.[key] !== "string") problems.push(`${key} is not a string`);
  }
  if (!Array.isArray(finding?.claims)) {
    problems.push("claims is not a list");
  } else {
    finding.claims.forEach((claim: unknown, claimIndex: number) => {
      const { tier, text } = (claim ?? {}) as { tier?: unknown; text?: unknown };
      if (!PROVENANCE_TIERS.includes(tier as ProvenanceTier)) problems.push(`claim ${claimIndex} has no known tier`);
      if (typeof text !== "string" || text.trim() === "") problems.push(`claim ${claimIndex} has no text`);
    });
  }
  return problems;
}

function readRiskFlags(response: unknown): RawRiskFlag[] {
  return readList(response, "riskFlags").map((item, index) => {
    const flag = item as Partial<Record<keyof RawRiskFlag, unknown>> | undefined;
    const problems = citedFindingProblems(flag);
    if (!SEVERITY_BANDS.includes(flag?.severityBand as SeverityBand)) problems.push("severityBand is not high or medium");
    if (typeof flag?.rank !== "number" || !Number.isFinite(flag.rank)) problems.push("rank is not a number");
    if (!RISK_FLAG_CHECKS.includes(flag?.check as RiskFlagCheck)) problems.push("check is not a known check");
    // A Risk flag without its Counter-offer is a failed generation, never a flag shown without one.
    if (typeof flag?.counterOffer !== "string") {
      problems.push("counterOffer is missing");
    } else if (flag.counterOffer.trim() === "") {
      problems.push("counterOffer is blank");
    }
    if (problems.length > 0) {
      throw new AnalysisResponseError(`Risk flag #${index} in the model's answer is malformed: ${problems.join(", ")}.`);
    }
    return flag as RawRiskFlag;
  });
}

/** Reads a list of cited findings that carry no rank, band or Counter-offer: Worth a look and Multiplier notes. */
function readUnrankedFindings(
  response: unknown,
  key: "worthALook" | "multiplierNotes",
  findingType: "worth-a-look" | "multiplier-note",
): RawCitedFinding[] {
  return readList(response, key).map((item, index) => {
    const entry = item as Partial<Record<keyof RawCitedFinding, unknown>> | undefined;
    const problems = citedFindingProblems(entry);
    if (problems.length > 0) {
      throw new AnalysisResponseError(
        `${FINDING_NAMES[findingType].one} #${index} in the model's answer is malformed: ${problems.join(", ")}.`,
      );
    }
    return entry as RawCitedFinding;
  });
}
