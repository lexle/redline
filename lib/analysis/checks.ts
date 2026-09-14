/**
 * The checklist Redline runs on every Document (ADR-0008). This file is the one place the check set
 * is defined. There are two groups:
 *
 * - Harm checks come from the danger test (ADR-0004): each names a kind of clause that can cost the
 *   Signer money with no ceiling or bind them with no way out. Every Risk flag belongs to one of
 *   these, or to "other" when a red line or an unusual clause earns a flag outside the set.
 * - Protection checks are the Missing protection kinds (PRD §5): each names something the Document
 *   should say for the Signer.
 *
 * Each check comes back with exactly one outcome. An outcome that says something is in the text
 * cites the sentence it rests on and goes through the same verbatim citation check as a Risk flag.
 * An outcome that says something was found wrong must match a returned finding. `analyse` fails the
 * whole analysis when the two disagree.
 */
import type { ProtectionKind } from "./types.ts";
import { PROTECTION_KINDS } from "./types.ts";

export type HarmCheck = "uncapped-liability" | "lock-in" | "non-compete" | "ip-overreach" | "personal-guarantee";

export const HARM_CHECKS: readonly HarmCheck[] = [
  "uncapped-liability",
  "lock-in",
  "non-compete",
  "ip-overreach",
  "personal-guarantee",
];

/** A Risk flag's check: one of the harm checks, or "other" for a flag outside the set. */
export type RiskFlagCheck = HarmCheck | "other";

export const RISK_FLAG_CHECKS: readonly RiskFlagCheck[] = [...HARM_CHECKS, "other"];

export type CheckId = HarmCheck | ProtectionKind;

/** Every check, in the order the checklist is returned: harms first, then protections. */
export const CHECK_IDS: readonly CheckId[] = [...HARM_CHECKS, ...PROTECTION_KINDS];

/**
 * - not-found: no clause of this kind is in the Document. Cites nothing: a claim about the whole
 *   Document, checkable by reading all of it, like a Missing protection's statement.
 * - bounded: a clause of this kind is present, but it has a cap or an exit. Cites that sentence.
 * - flagged: a clause of this kind is a Risk flag. Cites nothing of its own; the flags cite.
 */
export type HarmOutcome = "not-found" | "bounded" | "flagged";

/**
 * - present: the Document states this protection. Cites the sentence that states it.
 * - missing: the Document leaves it out. Cites nothing; a Missing protection or a Nice to have of
 *   the same kind carries it.
 */
export type ProtectionOutcome = "present" | "missing";

export type CheckOutcome = HarmOutcome | ProtectionOutcome;

export const HARM_OUTCOMES: readonly HarmOutcome[] = ["not-found", "bounded", "flagged"];
export const PROTECTION_OUTCOMES: readonly ProtectionOutcome[] = ["present", "missing"];
export const CHECK_OUTCOMES: readonly CheckOutcome[] = [...HARM_OUTCOMES, ...PROTECTION_OUTCOMES];

/** The outcomes that say something is in the text, and so cite the sentence they rest on. */
export const CITED_OUTCOMES: readonly CheckOutcome[] = ["bounded", "present"];

export function isHarmCheck(check: CheckId): check is HarmCheck {
  return (HARM_CHECKS as readonly string[]).includes(check);
}

/** What each check looks for, as the model is told it. */
export const CHECK_DESCRIPTIONS: Record<CheckId, string> = {
  "uncapped-liability":
    "a clause making the Signer liable for, or indemnifying the other side against, costs, losses or claims with no cap",
  "lock-in":
    "a clause binding the Signer with no way out: no right to end the agreement, or automatic renewal that is hard to cancel",
  "non-compete": "a restriction on whom the Signer may work for or solicit, during or after the agreement",
  "ip-overreach":
    "a transfer of rights in work beyond what the Signer is paid for, such as work for others or tools they owned before",
  "personal-guarantee": "a clause making the individual who signs personally liable for a company's obligations",
  "payment-timing": "when the Signer is paid",
  "payment-amount": "how much the Signer is paid",
  "kill-fee": "whether the Signer is paid for work done if the agreement ends early",
  "late-payment-remedy": "a consequence for paying the Signer late",
  "scope-revision-limits": "a limit on revisions or added work, or a price for changes in scope",
};
