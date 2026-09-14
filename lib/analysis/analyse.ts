import type { ModelClient } from "../model/model-client.ts";
import { buildAnalysisRequest } from "./prompt.ts";
import { segmentSentences } from "./segment.ts";
import type { SentenceUnit } from "./segment.ts";
import type { AnalysisResult, RedLine, RiskFlag, SeverityBand } from "./types.ts";
import { SEVERITY_BANDS } from "./types.ts";

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

interface RawRiskFlag {
  unitId: string;
  quote: string;
  title: string;
  explanation: string;
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

  const bandOrder = (band: SeverityBand) => SEVERITY_BANDS.indexOf(band);
  cited.sort(
    (a, b) =>
      bandOrder(a.raw.severityBand) - bandOrder(b.raw.severityBand) ||
      a.raw.rank - b.raw.rank ||
      a.unit.start - b.unit.start,
  );

  const riskFlags: RiskFlag[] = cited.map(({ raw, unit }, position) => ({
    kind: "risk-flag",
    rank: position + 1,
    severityBand: raw.severityBand,
    title: raw.title,
    explanation: raw.explanation,
    source: { start: unit.start, end: unit.end, text: documentText.slice(unit.start, unit.end) },
  }));

  return { riskFlags };
}

function readRiskFlags(response: unknown): RawRiskFlag[] {
  if (typeof response !== "object" || response === null || !Array.isArray((response as { riskFlags?: unknown }).riskFlags)) {
    throw new AnalysisResponseError("The model's answer has no riskFlags list.");
  }
  return (response as { riskFlags: unknown[] }).riskFlags.map((item, index) => {
    const flag = item as Partial<Record<keyof RawRiskFlag, unknown>>;
    const problems: string[] = [];
    for (const key of ["unitId", "quote", "title", "explanation"] as const) {
      if (typeof flag?.[key] !== "string") problems.push(`${key} is not a string`);
    }
    if (!SEVERITY_BANDS.includes(flag?.severityBand as SeverityBand)) problems.push("severityBand is not high or medium");
    if (typeof flag?.rank !== "number" || !Number.isFinite(flag.rank)) problems.push("rank is not a number");
    if (problems.length > 0) {
      throw new AnalysisResponseError(`Risk flag #${index} in the model's answer is malformed: ${problems.join(", ")}.`);
    }
    return flag as RawRiskFlag;
  });
}
