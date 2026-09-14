/**
 * What `analyse` returns. Cited finding types carry a required `source`; there is no way to build
 * a Risk flag, a Worth a look or a Multiplier note without one. Absence types (Missing protection and
 * Nice to have) are their own types beside `RiskFlag` with no `source` field at all, never an
 * optional citation on a cited type.
 */
import type { CheckId, HarmCheck, RiskFlagCheck } from "./checks.ts";

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
  /** Which harm check the flag belongs to, or "other" for a flag outside the checklist's set. */
  readonly check: RiskFlagCheck;
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

/**
 * The protections Redline checks a Document for (PRD §5). A closed set: the model must pick one of
 * these, and there is no "other". Every Missing protection then belongs to a list the product can
 * name in full, and an absence outside the list is not a harm the research measured. Minor
 * absences belong to Nice to have (ADR-0008), not here. These kinds are also the checklist's
 * protection checks (see `checks.ts`).
 */
export type ProtectionKind =
  | "payment-timing"
  | "payment-amount"
  | "kill-fee"
  | "late-payment-remedy"
  | "scope-revision-limits";

/** In the order they sort: payment timing and amount first, because they carry the largest measured harm. */
export const PROTECTION_KINDS: readonly ProtectionKind[] = [
  "payment-timing",
  "payment-amount",
  "kill-fee",
  "late-payment-remedy",
  "scope-revision-limits",
];

/** A claim that is not read off any sentence. The only tier a Missing protection's claims can have. */
export interface InferenceClaim {
  readonly tier: "inference";
  readonly text: string;
}

/**
 * Something harmful the Document fails to say (ADR-0005). A different kind of object from a Risk
 * flag, not a Risk flag with its citation left empty: it has no `source` field at all, and no unit
 * id, because it asserts nothing about any sentence in the text.
 *
 * Provenance (ADR-0007): the statement that the Document does not address the matter cannot be
 * read off a sentence, since there is no sentence. It is a claim about the Document as a whole,
 * which the Signer can check by reading the whole Document, so it is stated flat, with no hedge.
 * The claims that follow it can only be inference, because read-off needs a sentence to read off;
 * claims needing facts about the Signer are withheld like everywhere else.
 */
export interface MissingProtection {
  readonly kind: "missing-protection";
  /** `MP-01`, `MP-02`, ... assigned by `analyse` in result order. */
  readonly id: string;
  readonly protection: ProtectionKind;
  /** A plain statement that the Document does not address the matter. Never blank. */
  readonly statement: string;
  /** How the absence would likely play out, in the model's order. May be empty. */
  readonly claims: readonly InferenceClaim[];
  /**
   * Drafted clause language the Signer could ask to add. Redline's words, never in the Document,
   * and never written into the stored text. Required and never blank.
   */
  readonly proposedInsertion: string;
}

/**
 * One sentence of the plain-English summary (ADR-0010). It rests on one or more Source sentences,
 * each validated verbatim like a Risk flag's. `sources` is required and never empty, so there is no
 * way to build a summary sentence that points at nothing. A summary never states an absence
 * (ADR-0005): what the Document leaves out belongs to Missing protections.
 */
export interface SummarySentence {
  readonly kind: "summary-sentence";
  /** needs-signer-facts sentences are withheld by `analyse`, so they never appear here. */
  readonly tier: ShownTier;
  readonly text: string;
  /** In the order the model cited them. Each is `documentText.slice(start, end) === text`. */
  readonly sources: readonly [SourceSentence, ...SourceSentence[]];
}

/**
 * What a Nice to have can be about: any Missing protection kind the model judged not harmful enough
 * to be a Missing protection in this Document, or one of a few minor protections that are never
 * Missing protections. A closed set, like `ProtectionKind`.
 */
export type NiceToHaveKind =
  | ProtectionKind
  | "portfolio-rights"
  | "attribution"
  | "expense-reimbursement"
  | "feedback-deadlines"
  | "confidentiality";

export const NICE_TO_HAVE_KINDS: readonly NiceToHaveKind[] = [
  ...PROTECTION_KINDS,
  "portfolio-rights",
  "attribution",
  "expense-reimbursement",
  "feedback-deadlines",
  "confidentiality",
];

/**
 * A protection the Document omits that is not harmful enough to be a Missing protection (ADR-0008).
 * Shaped like a Missing protection: no `source` field at all, a flat statement that the Document
 * does not include it, inference-only claims, and a required Proposed insertion.
 */
export interface NiceToHave {
  readonly kind: "nice-to-have";
  /** `NH-01`, `NH-02`, ... assigned by `analyse` in the model's order. */
  readonly id: string;
  readonly protection: NiceToHaveKind;
  /** A plain statement that the Document does not include it. Never blank. */
  readonly statement: string;
  /** How the absence would likely play out. May be empty. */
  readonly claims: readonly InferenceClaim[];
  /** Drafted clause language, never in the Document. Required and never blank. */
  readonly proposedInsertion: string;
}

/** Which absence finding a missing protection check points at. */
export interface AbsenceReference {
  readonly kind: "missing-protection" | "nice-to-have";
  /** `MP-01` or `NH-01`: the id of that finding in the same result. */
  readonly id: string;
}

/** A harm check that found no clause of its kind. Claims an absence, so it cites nothing. */
export interface NotFoundCheck {
  readonly kind: "checklist-item";
  readonly check: HarmCheck;
  readonly outcome: "not-found";
}

/** A harm check that found a clause of its kind with a cap or an exit. Cites that sentence. */
export interface BoundedCheck {
  readonly kind: "checklist-item";
  readonly check: HarmCheck;
  readonly outcome: "bounded";
  /** The cap or exit, read off the Source sentence, e.g. "Liability is capped at the total fees". */
  readonly detail: string;
  readonly source: SourceSentence;
}

/** A harm check whose kind of clause is a Risk flag. The flags carry the citations. */
export interface FlaggedCheck {
  readonly kind: "checklist-item";
  readonly check: HarmCheck;
  readonly outcome: "flagged";
  /** The ranks of the Risk flags of this kind in the same result. Never empty. */
  readonly riskFlagRanks: readonly [number, ...number[]];
}

/** A protection the Document states. Cites the sentence that states it. */
export interface PresentCheck {
  readonly kind: "checklist-item";
  readonly check: ProtectionKind;
  readonly outcome: "present";
  /** What the sentence says about it, e.g. "Invoices are due within fifteen days". */
  readonly detail: string;
  readonly source: SourceSentence;
}

/** A protection the Document leaves out. The Missing protection or Nice to have carries it. */
export interface MissingCheck {
  readonly kind: "checklist-item";
  readonly check: ProtectionKind;
  readonly outcome: "missing";
  readonly absence: AbsenceReference;
}

export type ChecklistItem = NotFoundCheck | BoundedCheck | FlaggedCheck | PresentCheck | MissingCheck;

export type { CheckId };

export interface RedLine {
  readonly text: string;
}

export interface AnalysisResult {
  /** What the Document is and what it commits the Signer to, in the model's order. Never empty. */
  readonly summary: readonly [SummarySentence, ...SummarySentence[]];
  /**
   * True when the analysis returned zero Risk flags: the "nothing found" state (ADR-0008). Computed
   * by `analyse` from the Risk flags, never read from the model. It says nothing about Missing
   * protections, which are shown in their own list either way.
   */
  readonly nothingFound: boolean;
  /** What was examined: every check exactly once, in `CHECK_IDS` order. Never empty. */
  readonly checklist: readonly [ChecklistItem, ...ChecklistItem[]];
  /** Their own list, never merged into the Risk flag ranking (ADR-0005). */
  readonly missingProtections: readonly MissingProtection[];
  /** Minor absences, quieter than Missing protections. Never the same kind as a Missing protection. */
  readonly niceToHave: readonly NiceToHave[];
  readonly riskFlags: readonly RiskFlag[];
  /** In the order the sentences appear in the Document. Not ranked. */
  readonly worthALook: readonly WorthALook[];
  /** In the order the sentences appear in the Document. Not ranked. */
  readonly multiplierNotes: readonly MultiplierNote[];
}
