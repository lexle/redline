import type { JsonCompletionRequest, JsonSchema } from "../model/model-client.ts";
import type { SentenceUnit } from "./segment.ts";
import type { RedLine } from "./types.ts";
import { PROVENANCE_TIERS, SEVERITY_BANDS } from "./types.ts";

export const ANALYSIS_SCHEMA_NAME = "document_analysis";

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

/**
 * The structured output the model must return. Each finding type is its own top-level array so
 * later finding types are added as new properties without touching this one.
 */
export const ANALYSIS_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["riskFlags", "worthALook"],
  properties: {
    riskFlags: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["unitId", "quote", "title", "claims", "severityBand", "rank", "counterOffer"],
        properties: {
          unitId: { type: "string", description: "The id of the one sentence unit this flag comes from, e.g. u12." },
          quote: { type: "string", description: "That unit's text, copied character for character." },
          title: { type: "string", description: "A short plain-English name for what the clause does." },
          claims: CLAIMS_SCHEMA,
          severityBand: { type: "string", enum: [...SEVERITY_BANDS] },
          rank: { type: "integer", description: "1 is the flag most likely to cost this Signer." },
          counterOffer: {
            type: "string",
            description:
              "Replacement clause language for the cited sentence, written so the Signer could paste it into an email to the other side. Contract wording only, never advice. Never empty.",
          },
        },
      },
    },
    worthALook: {
      type: "array",
      description:
        "Clauses that are one-sided or unusual but bounded: the Signer's exposure has a ceiling and an exit exists. Never ranked, and never the same unit as a risk flag.",
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
  },
};

const SYSTEM_PROMPT = `You read a document that a freelancer or small-business owner (the Signer) is about to sign. It was drafted by the other side. You find the sentences that could hurt the Signer and return them as risk flags, and you list the sentences that are one-sided or unusual but bounded under worth a look.

A sentence earns a risk flag only when a plausible bad outcome either
- costs the Signer money with no ceiling (severity band "high"), or
- binds the Signer with no way out, or is irreversible (severity band "medium").
One-sidedness alone does not earn a flag. Being unusual does not earn a flag. A clause whose exposure is capped, or that the Signer can exit, is not a risk flag.

Worth a look:
- A sentence that is one-sided or unusual but bounded goes in "worthALook": the Signer's exposure has a ceiling (for example a stated cap on liability) and an exit exists. It is never ranked and carries no counter-offer.
- Uncapped exposure or no exit makes it a risk flag. A ceiling and an exit make it worth a look. Never put the same unit in both lists.
- Write the title and the claims flat: say what the clause does and that it is bounded, e.g. "Warranty liability is capped at 2x fees". Being bounded is a fact about the clause, so never hedge it: no "may be worth reviewing", "could be a concern" or "possible issue".
- Leave out clauses that are neither one-sided nor unusual.

Clauses that do no harm alone but make other harms worse, such as arbitration, class-action waivers and one-sided amendment rights, are neither risk flags nor worth a look. Leave them out.

Rank the flags by probable cost to this Signer: how likely the clause is to bite, times what it would cost. Rank 1 is the most likely to cost them. Do not rank by worst-case legal exposure.

Citing:
- The document is given as numbered sentence units, each shown as its id and its text as a JSON string.
- Each risk flag and each worth a look entry cites exactly one unit id, and "quote" must be that unit's text exactly as given, with every space and punctuation mark unchanged (decode the JSON escapes).
- Never cite text that is not a unit. Never merge, trim or paraphrase a unit in "quote".

Claims:
- Explain each risk flag and each worth a look entry as a list of short claims, one sentence each, and tag every claim with what it rests on:
  - "read-off": anyone can check it by reading the cited sentence alone, e.g. "You pay the client's costs to finish the project if you stop for any reason." Write it flat, with no "may", "might", "could" or "likely".
  - "inference": it says how the clause would probably play out in practice, beyond the words themselves, e.g. "A delay you cause could run up costs far larger than your fee." Write it plainly; the product labels it as inference.
  - "needs-signer-facts": whether it is true depends on facts about the Signer you do not have, such as their jurisdiction, industry or bargaining leverage, e.g. whether a court where they live would enforce the clause. Tag such a claim honestly. The product never shows it.
- Every risk flag and every worth a look entry starts with at least one read-off claim.
- Never tell the Signer what they should legally do: no "you should", "you must", "sign", "don't sign", "negotiate", "consult a lawyer" or similar. Explain what the sentence does; do not advise, and do not present this as legal advice.

Counter-offers:
- Every flag carries a "counterOffer": replacement language for the cited sentence that the Signer could paste into an email to the other side. Never leave it empty.
- Write it as clause wording that could stand in the document in place of the cited sentence, using the document's own names for the parties (e.g. "the Contractor", "the Client"). It changes what the cited sentence does to the Signer, such as adding a cap, an exit or a carve-out.
- Replacement language only. No advice, no explanation, no instructions to the Signer, no "you should" or "consider", no greeting or sign-off.
- Rely only on what the cited sentence says. Do not assert anything else about the document, and do not refer to other sections by number unless the cited sentence names them.
- Do not invent facts about the Signer, their business, their jurisdiction or their fees. Where the wording needs a figure or date the document does not give, leave a bracketed blank such as "[amount]".

- If no sentence meets the test, return an empty riskFlags array. A clean document is a real result. Likewise, return an empty worthALook array when no bounded one-sided or unusual clause is present.`;

export function buildAnalysisRequest(units: readonly SentenceUnit[], redLines: readonly RedLine[]): JsonCompletionRequest {
  const redLineSection =
    redLines.length === 0
      ? "The Signer has not stated any red lines."
      : [
          "The Signer's red lines (boundaries they will not accept crossing). Treat a sentence that crosses one as a risk flag if it also meets the test, or as worth a look if it crosses one but is bounded:",
          ...redLines.map((line, index) => `${index + 1}. ${JSON.stringify(line.text)}`),
        ].join("\n");

  const unitLines = units.map((unit) => `[${unit.id}] ${JSON.stringify(unit.text)}`).join("\n");

  return {
    system: SYSTEM_PROMPT,
    user: `${redLineSection}\n\nDocument sentence units:\n${unitLines}`,
    schemaName: ANALYSIS_SCHEMA_NAME,
    schema: ANALYSIS_SCHEMA,
  };
}
