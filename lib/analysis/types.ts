/**
 * What `analyse` returns. Cited finding types carry a required `source`; there is no way to build
 * a Risk flag, a Worth a look or a Multiplier note without one. Later finding types (Missing protection,
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
  /**
   * Replacement language for the Source sentence that the Signer could send to the counterparty.
   * Redline's drafted words, not the Document's. Required and never blank: it exists only as part
   * of a cited Risk flag, and a flag is never returned without one.
   */
  readonly counterOffer: string;
}

/**
 * A clause that is one-sided or unusual but bounded: the Signer's exposure has a ceiling and an
 * exit exists (ADR-0004, ADR-0006). It is present in the text, so it cites its Source sentence, but
 * it never enters the Risk flag ranking: it has no rank, no severity band and no Counter-offer.
 */
export interface WorthALook {
  readonly kind: "worth-a-look";
  /** What the clause does and that it is bounded, stated flat, e.g. "Liability is capped at 2x fees". */
  readonly title: string;
  /** What the entry says about its Source sentence, in the model's order. Never empty. */
  readonly claims: readonly [Claim, ...Claim[]];
  readonly source: SourceSentence;
}

/**
 * A clause that does no harm alone but makes other harms worse: arbitration, a class-action waiver,
 * unilateral amendment (ADR-0003). It cites its Source sentence, and it never enters the Risk flag
 * ranking whatever its legal weight: it has no rank, no severity band and no Counter-offer.
 */
export interface MultiplierNote {
  readonly kind: "multiplier-note";
  /** What the clause does to the Signer's position if something else goes wrong, stated flat. */
  readonly title: string;
  /** What the note says about its Source sentence, in the model's order. Never empty. */
  readonly claims: readonly [Claim, ...Claim[]];
  readonly source: SourceSentence;
}

export interface RedLine {
  readonly text: string;
}

export interface AnalysisResult {
  readonly riskFlags: readonly RiskFlag[];
  /** In the order the sentences appear in the Document. Not ranked. */
  readonly worthALook: readonly WorthALook[];
  /** In the order the sentences appear in the Document. Not ranked. */
  readonly multiplierNotes: readonly MultiplierNote[];
}
