import type { ModelClient } from "../model/model-client.ts";
import { buildAnalysisRequest } from "./prompt.ts";
import { segmentSentences } from "./segment.ts";
import type { SentenceUnit } from "./segment.ts";
import type { AnalysisResult, Claim, ProvenanceTier, RedLine, RiskFlag, SeverityBand } from "./types.ts";
import { PROVENANCE_TIERS, SEVERITY_BANDS } from "./types.ts";

export interface FailedCitation {
  /** Position of the finding in the model's response. */
  index: number;
  findingType: "risk-flag";
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

/** The model's JSON does not have the shape the schema demands. */
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

interface RawRiskFlag {
  unitId: string;
  quote: string;
  title: string;
  claims: RawClaim[];
  severityBand: SeverityBand;
  rank: number;
}

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

  const unitsById = new Map<string, SentenceUnit>(units.map((unit) => [unit.id, unit]));
  const failures: FailedCitation[] = [];
  const cited: { raw: RawRiskFlag; unit: SentenceUnit }[] = [];

  rawFlags.forEach((raw, index) => {
    const unit = unitsById.get(raw.unitId);
    if (!unit) {
      failures.push({ index, findingType: "risk-flag", unitId: raw.unitId, quote: raw.quote, reason: "unknown-unit" });
      return;
    }
    if (documentText.slice(unit.start, unit.end) !== raw.quote) {
      failures.push({ index, findingType: "risk-flag", unitId: raw.unitId, quote: raw.quote, reason: "quote-mismatch" });
      return;
    }
    cited.push({ raw, unit });
  });

  if (failures.length > 0) {
    throw new CitationError(failures, rawFlags.length);
  }

  // Claims that need facts about the Signer are withheld here, so they never reach the result and
  // no display can show them (ADR-0007).
  //
  // A Risk flag whose every claim is withheld fails the whole analysis with AnalysisResponseError.
  // It is not dropped: a dropped flag hides a sentence that met the danger test, which is an
  // invisible failure. It is not returned with no claims either: a flag nothing can be said about
  // from its own sentence is not grounded in that sentence. The prompt requires every flag to open
  // with a read-off claim, so this means the model broke that rule.
  const withClaims = cited.map(({ raw, unit }, index) => {
    const shown = raw.claims.filter(isShown);
    return { raw, unit, index, shown };
  });
  const emptied = withClaims.filter((flag) => flag.shown.length === 0);
  if (emptied.length > 0) {
    throw new AnalysisResponseError(
      `${emptied.length} Risk ${emptied.length === 1 ? "flag has" : "flags have"} no claim left once claims needing facts about the Signer are withheld: ` +
        emptied.map((flag) => `#${flag.index} (unit ${flag.raw.unitId})`).join(", ") +
        ".",
    );
  }

  const bandOrder = (band: SeverityBand) => SEVERITY_BANDS.indexOf(band);
  withClaims.sort(
    (a, b) =>
      bandOrder(a.raw.severityBand) - bandOrder(b.raw.severityBand) ||
      a.raw.rank - b.raw.rank ||
      a.unit.start - b.unit.start,
  );

  const riskFlags: RiskFlag[] = withClaims.map(({ raw, unit, shown }, position) => ({
    kind: "risk-flag",
    rank: position + 1,
    severityBand: raw.severityBand,
    title: raw.title,
    claims: shown as [Claim, ...Claim[]],
    source: { start: unit.start, end: unit.end, text: documentText.slice(unit.start, unit.end) },
  }));

  return { riskFlags };
}

function isShown(claim: RawClaim): claim is Claim {
  return claim.tier !== "needs-signer-facts";
}

function readRiskFlags(response: unknown): RawRiskFlag[] {
  if (typeof response !== "object" || response === null || !Array.isArray((response as { riskFlags?: unknown }).riskFlags)) {
    throw new AnalysisResponseError("The model's answer has no riskFlags list.");
  }
  return (response as { riskFlags: unknown[] }).riskFlags.map((item, index) => {
    const flag = item as Partial<Record<keyof RawRiskFlag, unknown>>;
    const problems: string[] = [];
    for (const key of ["unitId", "quote", "title"] as const) {
      if (typeof flag?.[key] !== "string") problems.push(`${key} is not a string`);
    }
    if (!Array.isArray(flag?.claims)) {
      problems.push("claims is not a list");
    } else {
      flag.claims.forEach((claim: unknown, claimIndex: number) => {
        const { tier, text } = (claim ?? {}) as { tier?: unknown; text?: unknown };
        if (!PROVENANCE_TIERS.includes(tier as ProvenanceTier)) problems.push(`claim ${claimIndex} has no known tier`);
        if (typeof text !== "string" || text.trim() === "") problems.push(`claim ${claimIndex} has no text`);
      });
    }
    if (!SEVERITY_BANDS.includes(flag?.severityBand as SeverityBand)) problems.push("severityBand is not high or medium");
    if (typeof flag?.rank !== "number" || !Number.isFinite(flag.rank)) problems.push("rank is not a number");
    if (problems.length > 0) {
      throw new AnalysisResponseError(`Risk flag #${index} in the model's answer is malformed: ${problems.join(", ")}.`);
    }
    return flag as RawRiskFlag;
  });
}
