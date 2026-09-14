import type { ModelClient } from "../model/model-client.ts";
import { buildAnalysisRequest } from "./prompt.ts";
import { segmentSentences } from "./segment.ts";
import type { SentenceUnit } from "./segment.ts";
import type {
  AnalysisResult,
  Claim,
  ProvenanceTier,
  RedLine,
  RiskFlag,
  SeverityBand,
  SourceSentence,
  WorthALook,
} from "./types.ts";
import { PROVENANCE_TIERS, SEVERITY_BANDS } from "./types.ts";

/** The finding types that cite a Source sentence and so go through citation validation. */
export type CitedFindingType = "risk-flag" | "worth-a-look";

export interface FailedCitation {
  /** Position of the finding in the model's response, within its own finding type's list. */
  index: number;
  findingType: CitedFindingType;
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
  /** Every cited finding in the response, across all cited finding types. */
  readonly findingCount: number;

  constructor(failures: FailedCitation[], findingCount: number) {
    super(
      `${failures.length} of ${findingCount} findings could not be matched to their source sentence: ` +
        failures
          .map((failure) =>
            failure.reason === "unknown-unit"
              ? `${failure.findingType} #${failure.index} cites unknown unit ${JSON.stringify(failure.unitId)}`
              : `${failure.findingType} #${failure.index} quote does not match unit ${failure.unitId} exactly`,
          )
          .join("; "),
    );
    this.name = "CitationError";
    this.failures = failures;
    this.findingCount = findingCount;
  }

  get passedCount(): number {
    return this.findingCount - this.failures.length;
  }
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

interface RawRiskFlag extends RawCitedFinding {
  severityBand: SeverityBand;
  rank: number;
  counterOffer: string;
}

type RawWorthALook = RawCitedFinding;

const FINDING_NAMES: Record<CitedFindingType, { one: string; many: string }> = {
  "risk-flag": { one: "Risk flag", many: "Risk flags" },
  "worth-a-look": { one: "Worth a look entry", many: "Worth a look entries" },
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
  const rawWorthALook = readWorthALook(response);

  // Both cited finding types go through one validation pass, so a single CitationError names every
  // failed finding of either type.
  const unitsById = new Map<string, SentenceUnit>(units.map((unit) => [unit.id, unit]));
  const failures: FailedCitation[] = [];
  const citedFlags = citeAll("risk-flag", rawFlags, documentText, unitsById, failures);
  const citedWorthALook = citeAll("worth-a-look", rawWorthALook, documentText, unitsById, failures);

  if (failures.length > 0) {
    throw new CitationError(failures, rawFlags.length + rawWorthALook.length);
  }

  // A sentence cited both as a Risk flag and as Worth a look is a contradictory response: a clause
  // cannot be uncapped-or-inescapable and bounded at once (ADR-0004, ADR-0006). The analysis fails
  // as malformed rather than picking one, because either choice would silently override the model
  // on the load-bearing judgement: keeping the flag hides that the model also called the clause
  // bounded, and keeping Worth a look demotes a clause the model said could sink the Signer.
  const flaggedUnitIds = new Set(citedFlags.map(({ unit }) => unit.id));
  const contradictions = citedWorthALook.filter(({ unit }) => flaggedUnitIds.has(unit.id));
  if (contradictions.length > 0) {
    throw new AnalysisResponseError(
      `${contradictions.length === 1 ? "A sentence is" : `${contradictions.length} sentences are`} cited both as a Risk flag and as Worth a look: ` +
        contradictions.map(({ unit }) => `unit ${unit.id}`).join(", ") +
        ".",
    );
  }

  const flagsWithClaims = withShownClaims("risk-flag", citedFlags);
  const worthALookWithClaims = withShownClaims("worth-a-look", citedWorthALook);

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

  return { riskFlags, worthALook };
}

function citeAll<T extends RawCitedFinding>(
  findingType: CitedFindingType,
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
  findingType: CitedFindingType,
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

function readList(response: unknown, key: "riskFlags" | "worthALook"): unknown[] {
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

function readWorthALook(response: unknown): RawWorthALook[] {
  return readList(response, "worthALook").map((item, index) => {
    const entry = item as Partial<Record<keyof RawWorthALook, unknown>> | undefined;
    const problems = citedFindingProblems(entry);
    if (problems.length > 0) {
      throw new AnalysisResponseError(
        `Worth a look entry #${index} in the model's answer is malformed: ${problems.join(", ")}.`,
      );
    }
    return entry as RawWorthALook;
  });
}
