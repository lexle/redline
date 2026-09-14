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

/**
 * What a claim rests on (ADR-0007). The model tags every claim with one of these.
 * - read-off: readable straight off the Source sentence. Stated flat, no hedge.
 * - inference: how the clause would play out. Shown marked as inference.
 * - needs-signer-facts: depends on the Signer's jurisdiction, industry or leverage, which Redline
 *   does not have. Never returned by `analyse`.
 */
export type ProvenanceTier = "read-off" | "inference" | "needs-signer-facts";

export const PROVENANCE_TIERS: readonly ProvenanceTier[] = ["read-off", "inference", "needs-signer-facts"];

/** The tiers a returned claim can have. Withheld claims are absent from the data, not hidden. */
export type ShownTier = Exclude<ProvenanceTier, "needs-signer-facts">;

export interface Claim {
  readonly tier: ShownTier;
  readonly text: string;
}

export interface RiskFlag {
  readonly kind: "risk-flag";
  /** 1 is the flag most likely to cost this Signer. */
  readonly rank: number;
  readonly severityBand: SeverityBand;
  readonly title: string;
  /** What the flag says about its Source sentence, in the model's order. Never empty. */
  readonly claims: readonly [Claim, ...Claim[]];
  readonly source: SourceSentence;
}

export interface RedLine {
  readonly text: string;
}

export interface AnalysisResult {
  readonly riskFlags: readonly RiskFlag[];
}
