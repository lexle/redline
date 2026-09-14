/**
 * What `answerQuestion` returns: one of three structurally distinct outcomes. Only `answered` has
 * sentences, and every one of them carries at least one Source sentence. The other two carry no
 * sentence at all, so there is nowhere for speculation to go.
 */
import type { ShownTier, SourceSentence } from "../analysis/types.ts";

/** The kinds of fact about the Signer Redline does not have (ADR-0007). */
export type SignerFact = "jurisdiction" | "industry" | "leverage" | "other";

export const SIGNER_FACTS: readonly SignerFact[] = ["jurisdiction", "industry", "leverage", "other"];

export interface AnswerSentence {
  /** read-off: readable straight off its Source sentences. inference: how they would likely play out. */
  readonly tier: ShownTier;
  readonly text: string;
  /** Every sentence of the Document this one rests on, in the model's order. Never empty. */
  readonly sources: readonly [SourceSentence, ...SourceSentence[]];
}

export type Answer =
  | { readonly outcome: "answered"; readonly sentences: readonly [AnswerSentence, ...AnswerSentence[]] }
  /** The Document's text does not answer the question. A real answer, not a failure. */
  | { readonly outcome: "not-in-document" }
  /** The answer turns on facts about the Signer, named here, that Redline does not have. */
  | { readonly outcome: "needs-signer-facts"; readonly missingFacts: readonly [SignerFact, ...SignerFact[]] };
