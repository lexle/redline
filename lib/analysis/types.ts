/**
 * What `analyse` returns. Cited finding types carry a required `source`; there is no way to build
 * a Risk flag without one. Later finding types (Worth a look, Multiplier note, Missing protection,
 * Nice to have) are added as their own types beside `RiskFlag`, never as optional fields on it.
 */

/** The exact sentence a finding came from: `documentText.slice(start, end) === text`. */
export interface SourceSentence {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** high: likely to cost money with no ceiling. medium: no exit, or irreversible. */
export type SeverityBand = "high" | "medium";

export const SEVERITY_BANDS: readonly SeverityBand[] = ["high", "medium"];

export interface RiskFlag {
  readonly kind: "risk-flag";
  /** 1 is the flag most likely to cost this Signer. */
  readonly rank: number;
  readonly severityBand: SeverityBand;
  readonly title: string;
  readonly explanation: string;
  readonly source: SourceSentence;
}

export interface RedLine {
  readonly text: string;
}

export interface AnalysisResult {
  readonly riskFlags: readonly RiskFlag[];
}
