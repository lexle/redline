import type { ModelClient } from "../model/model-client.ts";
import { buildAnalysisRequest } from "./prompt.ts";
import { segmentSentences } from "./segment.ts";
import type { SentenceUnit } from "./segment.ts";
import type {
  AnalysisResult,
  Claim,
  InferenceClaim,
  MissingProtection,
  MultiplierNote,
  ProtectionKind,
  ProvenanceTier,
  RedLine,
  RiskFlag,
  SeverityBand,
  SourceSentence,
  SummarySentence,
  WorthALook,
} from "./types.ts";
import { PROTECTION_KINDS, PROVENANCE_TIERS, SEVERITY_BANDS } from "./types.ts";

/** The finding types that cite a Source sentence and so go through citation validation. */
export type CitedFindingType = "risk-flag" | "worth-a-look" | "multiplier-note" | "summary-sentence";

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

/** No unitId and no quote: a Missing protection that carries either is rejected as malformed. */
interface RawMissingProtection {
  protection: ProtectionKind;
  statement: string;
  claims: RawClaim[];
  proposedInsertion: string;
}

interface RawRiskFlag extends RawCitedFinding {
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

type ExclusiveFindingType = Exclude<CitedFindingType, "summary-sentence">;

const FINDING_NAMES: Record<ExclusiveFindingType, { one: string; many: string; label: string }> = {
  "risk-flag": { one: "Risk flag", many: "Risk flags", label: "a Risk flag" },
  "worth-a-look": { one: "Worth a look entry", many: "Worth a look entries", label: "Worth a look" },
  "multiplier-note": { one: "Multiplier note", many: "Multiplier notes", label: "a Multiplier note" },
};

export async function analyse(
  documentText: string,
  redLines: readonly RedLine[],
  modelClient: ModelClient,
): Promise<AnalysisResult> {
  const units = segmentSentences(documentText);
  if (units.length === 0) {
    throw new AnalysisResponseError("The document has no text to analyse.");
  }

  const response = await modelClient.completeJson(buildAnalysisRequest(units, redLines));
  const rawFlags = readRiskFlags(response);
  const rawWorthALook = readUnrankedFindings(response, "worthALook", "worth-a-look");
  const rawMultiplierNotes = readUnrankedFindings(response, "multiplierNotes", "multiplier-note");
  const rawMissingProtections = readMissingProtections(response);
  const rawSummary = readSummary(response);

  // Every cited finding type goes through one validation pass, so a single CitationError names every
  // failed finding of any type. Summary sentences are checked span by span, withheld ones included.
  const unitsById = new Map<string, SentenceUnit>(units.map((unit) => [unit.id, unit]));
  const failures: FailedCitation[] = [];
  const citedFlags = citeAll("risk-flag", rawFlags, documentText, unitsById, failures);
  const citedWorthALook = citeAll("worth-a-look", rawWorthALook, documentText, unitsById, failures);
  const citedMultiplierNotes = citeAll("multiplier-note", rawMultiplierNotes, documentText, unitsById, failures);
  const citedSummary = citeSummary(rawSummary, documentText, unitsById, failures);

  if (failures.length > 0) {
    throw new CitationError(
      failures,
      rawFlags.length + rawWorthALook.length + rawMultiplierNotes.length + rawSummary.length,
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

  const flagsWithClaims = withShownClaims("risk-flag", citedFlags);
  const worthALookWithClaims = withShownClaims("worth-a-look", citedWorthALook);
  const multiplierNotesWithClaims = withShownClaims("multiplier-note", citedMultiplierNotes);

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

  return {
    summary: toShownSummary(citedSummary),
    riskFlags,
    worthALook,
    multiplierNotes,
    missingProtections: toMissingProtections(rawMissingProtections),
  };
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

function citeAll<T extends RawCitedFinding>(
  findingType: ExclusiveFindingType,
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

const MISSING_PROTECTION_FIELDS = ["protection", "statement", "claims", "proposedInsertion"] as const;

/**
 * Reads the Missing protections. Any of these fails the whole analysis as malformed: an unknown
 * protection kind, the same kind twice, a blank statement, a missing or blank Proposed insertion, a
 * read-off claim, or any field beyond the four above. A unit id or quote on a Missing protection
 * would be a citation of text the entry claims is absent, so it is never ignored.
 */
function readMissingProtections(response: unknown): RawMissingProtection[] {
  const seen = new Map<ProtectionKind, number>();
  return readList(response, "missingProtections").map((item, index) => {
    const problems: string[] = [];
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new AnalysisResponseError(`Missing protection #${index} in the model's answer is malformed: it is not an object.`);
    }
    const entry = item as Record<string, unknown>;
    for (const key of Object.keys(entry)) {
      if (!(MISSING_PROTECTION_FIELDS as readonly string[]).includes(key)) {
        problems.push(
          key === "unitId" || key === "quote"
            ? `it has a ${key}, but a missing protection cites nothing`
            : `it has an unexpected field ${JSON.stringify(key)}`,
        );
      }
    }
    if (!PROTECTION_KINDS.includes(entry.protection as ProtectionKind)) {
      problems.push("protection is not a known kind");
    } else {
      const kind = entry.protection as ProtectionKind;
      if (seen.has(kind)) problems.push(`protection ${kind} is a duplicate of missing protection #${seen.get(kind)}`);
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
      throw new AnalysisResponseError(`Missing protection #${index} in the model's answer is malformed: ${problems.join(", ")}.`);
    }
    return entry as unknown as RawMissingProtection;
  });
}

function readList(response: unknown, key: "riskFlags" | "worthALook" | "multiplierNotes" | "missingProtections"): unknown[] {
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
