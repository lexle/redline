import type { JsonCompletionRequest, JsonSchema } from "../model/model-client.ts";
import type { SentenceUnit } from "./segment.ts";
import { unitLine } from "./parts.ts";
import type { RedLine } from "./types.ts";
import { NICE_TO_HAVE_KINDS, PROTECTION_KINDS, PROVENANCE_TIERS, SEVERITY_BANDS } from "./types.ts";
import { CHECK_DESCRIPTIONS, CHECK_IDS, CHECK_OUTCOMES, HARM_CHECKS, RISK_FLAG_CHECKS } from "./checks.ts";

export const ANALYSIS_SCHEMA_NAME = "document_analysis";

/** The shape shared by Missing protections and Nice to have: an absence that cites nothing. */
function absenceItemSchema(kinds: readonly string[], statementExample: string): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["protection", "statement", "claims", "proposedInsertion"],
    properties: {
      protection: { type: "string", enum: [...kinds] },
      statement: {
        type: "string",
        description: `One flat sentence saying the document does not address the matter, e.g. "${statementExample}" No section numbers, no location in the document.`,
      },
      claims: {
        type: "array",
        description:
          "How the absence would likely play out, one short sentence per item. May be empty. Never read-off: there is no sentence to read it off.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["tier", "text"],
          properties: {
            tier: {
              type: "string",
              enum: ["inference", "needs-signer-facts"],
              description:
                "inference: how the absence would likely play out. needs-signer-facts: depends on the Signer's jurisdiction, industry or leverage.",
            },
            text: { type: "string" },
          },
        },
      },
      proposedInsertion: {
        type: "string",
        description:
          "Clause text the Signer could ask the other side to add, written as contract wording using the document's names for the parties. Never advice. Never empty.",
      },
    },
  };
}

const CLAIMS_SCHEMA: JsonSchema = {
  type: "array",
  description:
    "The plain-English explanation, one claim per item, each tagged with what it rests on. Start with at least one read-off claim.",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["tier", "text"],
    properties: {
      tier: {
        type: "string",
        enum: [...PROVENANCE_TIERS],
        description:
          "read-off: readable straight off the cited sentence. inference: how the clause would likely play out. needs-signer-facts: depends on the Signer's jurisdiction, industry or leverage.",
      },
      text: { type: "string", description: "One plain sentence. No hedging words for read-off claims." },
    },
  },
};

/** The id the prompt gives the Signer's red line at `index` (zero-based): `RL-1`, `RL-2`, ... in their order. */
export function redLineId(index: number): string {
  return `RL-${index + 1}`;
}

const RED_LINES_SCHEMA: JsonSchema = {
  type: "array",
  description:
    'The ids of the Signer\'s red lines the cited sentence crosses, e.g. "RL-1". Each id at most once. An empty array when it crosses none, or when the Signer has no red lines.',
  items: { type: "string" },
};

/**
 * The structured output the model must return. Each finding type is its own top-level array so
 * later finding types are added as new properties without touching this one.
 */
export const ANALYSIS_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "riskFlags", "worthALook", "multiplierNotes", "missingProtections", "niceToHave", "checklist"],
  properties: {
    checklist: {
      type: "array",
      description: "Every check, exactly once, with its outcome. Never empty.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["check", "outcome", "unitId", "quote", "detail"],
        properties: {
          check: { type: "string", enum: [...CHECK_IDS] },
          outcome: {
            type: "string",
            enum: [...CHECK_OUTCOMES],
            description:
              "Harm checks: not-found, bounded or flagged. Protection checks: present or missing.",
          },
          unitId: {
            type: "string",
            description: "For bounded and present only: the unit the outcome rests on. Otherwise an empty string.",
          },
          quote: {
            type: "string",
            description: "For bounded and present only: that unit's text, copied character for character. Otherwise an empty string.",
          },
          detail: {
            type: "string",
            description:
              'For bounded and present only: one short flat phrase read off the cited unit, e.g. "Invoices are due within fifteen days". Otherwise an empty string.',
          },
        },
      },
    },
    niceToHave: {
      type: "array",
      description:
        "Minor protections the document as a whole leaves out, not harmful enough to be missing protections. No unit id and no quote. At most one per kind, and never a kind that is also a missing protection.",
      items: absenceItemSchema(NICE_TO_HAVE_KINDS, "The agreement does not say whether the Designer may show the work in a portfolio."),
    },
    summary: {
      type: "array",
      description:
        "A short plain-English summary: what the document is and what it commits the Signer to. One sentence per item, each resting on the units it cites. At least one item.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "tier", "sources"],
        properties: {
          text: {
            type: "string",
            description:
              "One short, literal sentence that says only what the cited units say. No absences, no advice, no section numbers.",
          },
          tier: {
            type: "string",
            enum: [...PROVENANCE_TIERS],
            description:
              "read-off: readable straight off the cited units. inference: how they would likely play out. needs-signer-facts: depends on the Signer's jurisdiction, industry or leverage.",
          },
          sources: {
            type: "array",
            description: "Every unit the sentence rests on. Never empty. Each unit at most once.",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["unitId", "quote"],
              properties: {
                unitId: { type: "string", description: "A sentence unit id, e.g. u12." },
                quote: { type: "string", description: "That unit's text, copied character for character." },
              },
            },
          },
        },
      },
    },
    missingProtections: {
      type: "array",
      description:
        "Protections the document as a whole does not address. No unit id and no quote: these cite nothing. At most one per protection kind.",
      items: absenceItemSchema(PROTECTION_KINDS, "The agreement never says when the Contractor is paid."),
    },
    riskFlags: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["unitId", "quote", "title", "check", "claims", "severityBand", "rank", "counterOffer", "redLines"],
        properties: {
          unitId: { type: "string", description: "The id of the one sentence unit this flag comes from, e.g. u12." },
          quote: { type: "string", description: "That unit's text, copied character for character." },
          title: { type: "string", description: "A short plain-English name for what the clause does." },
          check: {
            type: "string",
            enum: [...RISK_FLAG_CHECKS],
            description: "The harm check this flag falls under, or other when it fits none of them.",
          },
          claims: CLAIMS_SCHEMA,
          severityBand: { type: "string", enum: [...SEVERITY_BANDS] },
          rank: { type: "integer", description: "1 is the flag most likely to cost this Signer." },
          counterOffer: {
            type: "string",
            description:
              "Replacement clause language for the cited sentence, written so the Signer could paste it into an email to the other side. Contract wording only, never advice. Never empty.",
          },
          redLines: RED_LINES_SCHEMA,
        },
      },
    },
    worthALook: {
      type: "array",
      description:
        "Clauses that are one-sided or unusual but bounded: the Signer's exposure has a ceiling and an exit exists. Never ranked, and never the same unit as a risk flag. Never a sentence that crosses one of the Signer's red lines: that sentence is a risk flag.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["unitId", "quote", "title", "claims"],
        properties: {
          unitId: { type: "string", description: "The id of the one sentence unit this entry comes from, e.g. u12." },
          quote: { type: "string", description: "That unit's text, copied character for character." },
          title: {
            type: "string",
            description:
              "What the clause does and that it is bounded, stated flat, e.g. \"Warranty liability is capped at 2x fees\". Never a hedge.",
          },
          claims: CLAIMS_SCHEMA,
        },
      },
    },
    multiplierNotes: {
      type: "array",
      description:
        "Clauses that do no harm alone but make other harms worse: arbitration, class-action waivers, unilateral amendment. Never ranked, and never the same unit as a risk flag or a worth a look entry.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["unitId", "quote", "title", "claims", "redLines"],
        properties: {
          unitId: { type: "string", description: "The id of the one sentence unit this note comes from, e.g. u12." },
          quote: { type: "string", description: "That unit's text, copied character for character." },
          title: {
            type: "string",
            description:
              "What the clause does to the Signer's position if something else goes wrong, stated flat, e.g. \"Any dispute goes to individual arbitration, with no class action\".",
          },
          claims: CLAIMS_SCHEMA,
          redLines: RED_LINES_SCHEMA,
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `You read a document that a freelancer or small-business owner (the Signer) is about to sign. It was drafted by the other side. You write a short grounded summary of it, you find the sentences that could hurt the Signer and return them as risk flags, you list the sentences that are one-sided or unusual but bounded under worth a look, you list the sentences that make other harms worse under multiplier notes, you list the protections the document fails to give the Signer at all under missing protections, you list minor omissions under nice to have, and you return the checklist of what you examined.

Summary:
- "summary" says, in a few short plain sentences, what the document is and what it commits the Signer to. Keep it short and literal: usually three to six sentences.
- Every summary sentence cites, in "sources", each unit it rests on, with its unit id and a "quote" that is that unit's text exactly as given. A sentence that combines several units cites all of them. A sentence that cannot point at a unit is not written.
- A summary sentence states only what its cited units say. Do not add figures, dates, parties or duties that the cited units do not state.
- Never state an absence in the summary, such as "the agreement does not say when you are paid". What the document leaves out belongs under missing protections only.
- No advice and no judgement of whether a term is fair or risky: describe what the document does.
- Tag every summary sentence "read-off", "inference" or "needs-signer-facts" as for claims below. The first sentence says what the document is and is read-off. A needs-signer-facts sentence is never shown.

A sentence earns a risk flag only when a plausible bad outcome either
- costs the Signer money with no ceiling (severity band "high"), or
- binds the Signer with no way out, or is irreversible (severity band "medium").
One-sidedness alone does not earn a flag. Being unusual does not earn a flag. A clause whose exposure is capped, or that the Signer can exit, is not a risk flag.

Worth a look:
- A sentence that is one-sided or unusual but bounded goes in "worthALook": the Signer's exposure has a ceiling (for example a stated cap on liability) and an exit exists. It is never ranked and carries no counter-offer.
- Uncapped exposure or no exit makes it a risk flag. A ceiling and an exit make it worth a look. Never put the same unit in both lists.
- Write the title and the claims flat: say what the clause does and that it is bounded, e.g. "Warranty liability is capped at 2x fees". Being bounded is a fact about the clause, so never hedge it: no "may be worth reviewing", "could be a concern" or "possible issue".
- Leave out clauses that are neither one-sided nor unusual.

Multiplier notes:
- Arbitration clauses, class-action waivers and unilateral amendment rights (one side may change the terms without the other agreeing) always go in "multiplierNotes". They are never risk flags and never worth a look, however much legal weight they carry, because they do no harm alone but make every other harm worse.
- A sentence that contains any of these goes in "multiplierNotes" only. Never put the same unit in more than one list.
- Write the title and the claims about what the clause does to the Signer's position if something else goes wrong, e.g. "If the Client breaches, the Contractor can only bring the dispute alone, in arbitration". A multiplier note carries no rank, no severity band and no counter-offer.

Red lines:
- The Signer may list red lines: boundaries they will not accept crossing, in their own words, each shown with an id such as RL-1. A red line is the Signer's words, not part of the document. Never cite or quote a red line as a unit.
- A sentence crosses a red line when it does what the red line says the Signer will not accept. Judge it from the sentence's own words.
- Name every red line a sentence crosses, by id, in the "redLines" of that sentence's risk flag or multiplier note. Use an empty array when it crosses none.
- A sentence that crosses a red line is always a risk flag, even when it is capped or has an exit. Never put it in worthALook. Give it a severity band as usual: "high" only when the cost has no ceiling, otherwise "medium". Give it a counter-offer like any flag. If its harm check would otherwise be bounded, mark that check "flagged", or give the flag the check "other" when it fits no check.
- The exception: an arbitration, class-action waiver or unilateral amendment sentence that crosses a red line stays a multiplier note, and names the red line there.
- A red line never creates a finding by itself. Only a sentence in the document that crosses it does. If no sentence crosses a red line, name it nowhere, and never say the document respects it.
- Red lines do not change missing protections, nice to have, the summary or the checklist, apart from the flagged check above.

Rank the flags by probable cost to this Signer: how likely the clause is to bite, times what it would cost. Rank 1 is the most likely to cost them. Do not rank by worst-case legal exposure.

Citing:
- The document is given as numbered sentence units, each shown as its id and its text as a JSON string.
- Each risk flag, worth a look entry and multiplier note cites exactly one unit id, and each summary sentence cites one or more. Every "quote" must be its unit's text exactly as given, with every space and punctuation mark unchanged (decode the JSON escapes).
- Never cite text that is not a unit. Never merge, trim or paraphrase a unit in "quote".

Claims:
- Explain each risk flag, worth a look entry and multiplier note as a list of short claims, one sentence each, and tag every claim with what it rests on:
  - "read-off": anyone can check it by reading the cited sentence alone, e.g. "You pay the client's costs to finish the project if you stop for any reason." Write it flat, with no "may", "might", "could" or "likely".
  - "inference": it says how the clause would probably play out in practice, beyond the words themselves, e.g. "A delay you cause could run up costs far larger than your fee." Write it plainly; the product labels it as inference.
  - "needs-signer-facts": whether it is true depends on facts about the Signer you do not have, such as their jurisdiction, industry or bargaining leverage, e.g. whether a court where they live would enforce the clause. Tag such a claim honestly. The product never shows it.
- Every risk flag, worth a look entry and multiplier note starts with at least one read-off claim.
- Never tell the Signer what they should legally do: no "you should", "you must", "sign", "don't sign", "negotiate", "consult a lawyer" or similar. Explain what the sentence does; do not advise, and do not present this as legal advice.

Counter-offers:
- Every flag carries a "counterOffer": replacement language for the cited sentence that the Signer could paste into an email to the other side. Never leave it empty.
- Write it as clause wording that could stand in the document in place of the cited sentence, using the document's own names for the parties (e.g. "the Contractor", "the Client"). It changes what the cited sentence does to the Signer, such as adding a cap, an exit or a carve-out.
- Replacement language only. No advice, no explanation, no instructions to the Signer, no "you should" or "consider", no greeting or sign-off.
- Rely only on what the cited sentence says. Do not assert anything else about the document, and do not refer to other sections by number unless the cited sentence names them.
- Do not invent facts about the Signer, their business, their jurisdiction or their fees. Where the wording needs a figure or date the document does not give, leave a bracketed blank such as "[amount]".

Missing protections:
- Check whether the document, read as a whole, addresses each of these protections for the Signer:
  - "payment-timing": when the Signer is paid (for example, invoices due within a stated number of days).
  - "payment-amount": how much the Signer is paid (a fee, a rate or an amount).
  - "kill-fee": whether the Signer is paid for work done if the agreement is ended or the project is cancelled.
  - "late-payment-remedy": any consequence for paying the Signer late, such as interest, a late fee or a right to pause work.
  - "scope-revision-limits": a limit on revisions or on added work, or a price for changes in scope.
- Raise a missing protection only when no sentence anywhere in the document addresses the matter. A sentence that addresses it, even on poor terms, means it is not missing; judge poor terms under risk flags instead. A reference that leaves the matter to another document (for example "as set out in the Statement of Work") without stating it does not address it.
- At most one missing protection per kind. Only these five kinds exist.
- A missing protection cites nothing. Give it no unit id and no quote, never invent a section number, and never say where in the document the term would go or claim that any text sits anywhere.
- "statement" is one flat sentence saying the document does not address the matter, e.g. "The agreement never says when the Contractor is paid." Do not hedge it.
- "claims" may explain how the absence would likely play out, tagged "inference". Anything that depends on the Signer's jurisdiction, industry or leverage is tagged "needs-signer-facts" and is never shown. Never tag a missing protection's claim "read-off".
- "proposedInsertion" is clause text the Signer could ask the other side to add, written as contract wording with the document's own names for the parties. Not advice, not an explanation, no "you should". Where it needs a figure or date the document does not give, leave a bracketed blank such as "[number] days". Never leave it empty.

Nice to have:
- "niceToHave" lists protections the document leaves out that would help the Signer but whose absence is not harmful enough to be a missing protection. The kinds are the five missing protection kinds above, plus "portfolio-rights" (whether the Signer may show the work), "attribution" (credit for the work), "expense-reimbursement", "feedback-deadlines" (when the other side must respond) and "confidentiality".
- It follows every rule for missing protections: it cites nothing, "statement" says flatly that the document does not include it, claims are never read-off, and "proposedInsertion" is never empty.
- A kind is either a missing protection or a nice to have, never both. At most one nice to have per kind. Return an empty array when there are none; most documents need few or none.

Checklist:
- "checklist" records what you examined. Return every one of these checks exactly once:
${HARM_CHECKS.map((check) => `  - "${check}" (harm check): ${CHECK_DESCRIPTIONS[check]}.`).join("\n")}
${PROTECTION_KINDS.map((check) => `  - "${check}" (protection check): ${CHECK_DESCRIPTIONS[check]}.`).join("\n")}
- Every risk flag names its harm check in "check", or "other" when it fits none.
- A harm check's outcome is "flagged" when at least one risk flag names it; "bounded" when a clause of that kind is present but has a cap or an exit, so it is not a risk flag; or "not-found" when no sentence in the document is a clause of that kind. Never mark a check not-found or bounded when a risk flag names it, and never mark it flagged when none does.
- A protection check's outcome is "present" when a sentence states the protection, or "missing" when the document leaves it out. A missing protection check always has a missing protection or a nice to have of that kind, and a present one never does.
- "bounded" and "present" cite the one unit they rest on, with its unit id and its exact "quote" as for any citation, and a "detail": one short flat phrase read off that unit, such as "Liability is capped at the total fees". Say only what that unit says.
- "not-found", "flagged" and "missing" cite nothing: send "unitId", "quote" and "detail" as empty strings.
- The checklist never says the document is safe, fair or ready to sign. It says what was checked and what the text shows.

- Return an empty missingProtections array when the document addresses all five.
- If no sentence meets the test, return an empty riskFlags array. A clean document is a real result. Likewise, return an empty worthALook array when no bounded one-sided or unusual clause is present, and an empty multiplierNotes array when the document has no arbitration, class-action waiver or unilateral amendment clause.`;

/** Which part of a Document split for the model the request carries. */
export interface PartPosition {
  /** Zero-based. */
  index: number;
  count: number;
}

/**
 * Builds the request for a whole Document, or for one part of a long one. A part's request says so
 * in the user message only; the system prompt is the same for every call.
 */
export function buildAnalysisRequest(
  units: readonly SentenceUnit[],
  redLines: readonly RedLine[],
  part?: PartPosition,
): JsonCompletionRequest {
  const redLineSection =
    redLines.length === 0
      ? "The Signer has not stated any red lines."
      : [
          "The Signer's red lines, each shown as its id and the Signer's words as a JSON string. Every part of a long document is checked against all of them:",
          ...redLines.map((line, index) => `[${redLineId(index)}] ${JSON.stringify(line.text)}`),
        ].join("\n");

  const unitLines = units.map(unitLine).join("\n");
  const partSection =
    part === undefined || part.count <= 1
      ? ""
      : `This Document is too long for one request, so it is split into ${part.count} parts. Below is part ${part.index + 1} of ${part.count}; the other parts are analysed separately and the results are combined. Unit ids count from the start of the whole Document. The first units of a part may repeat the last units of the part before. Cite only units shown below. Summarise only what this part says. Report a protection as missing when no unit shown below addresses it; the other parts are checked for it before anything is shown.\n\n`;

  return {
    system: SYSTEM_PROMPT,
    user: `${redLineSection}\n\n${partSection}Document sentence units:\n${unitLines}`,
    schemaName: ANALYSIS_SCHEMA_NAME,
    schema: ANALYSIS_SCHEMA,
  };
}
