import type { JsonCompletionRequest, JsonSchema } from "../model/model-client.ts";
import type { SentenceUnit } from "./segment.ts";
import type { RedLine } from "./types.ts";
import { SEVERITY_BANDS } from "./types.ts";

export const ANALYSIS_SCHEMA_NAME = "document_analysis";

/**
 * The structured output the model must return. Each finding type is its own top-level array so
 * later finding types are added as new properties without touching this one.
 */
export const ANALYSIS_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["riskFlags"],
  properties: {
    riskFlags: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["unitId", "quote", "title", "explanation", "severityBand", "rank"],
        properties: {
          unitId: { type: "string", description: "The id of the one sentence unit this flag comes from, e.g. u12." },
          quote: { type: "string", description: "That unit's text, copied character for character." },
          title: { type: "string", description: "A short plain-English name for what the clause does." },
          explanation: {
            type: "string",
            description: "One or two plain sentences on what this sentence does to the Signer, stating only what it says.",
          },
          severityBand: { type: "string", enum: [...SEVERITY_BANDS] },
          rank: { type: "integer", description: "1 is the flag most likely to cost this Signer." },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `You read a document that a freelancer or small-business owner (the Signer) is about to sign. It was drafted by the other side. You find the sentences that could hurt the Signer and return them as risk flags.

A sentence earns a risk flag only when a plausible bad outcome either
- costs the Signer money with no ceiling (severity band "high"), or
- binds the Signer with no way out, or is irreversible (severity band "medium").
One-sidedness alone does not earn a flag. Being unusual does not earn a flag. A clause whose exposure is capped, or that the Signer can exit, is not a risk flag. Clauses that do no harm alone but make other harms worse, such as arbitration, class-action waivers and one-sided amendment rights, are not risk flags either. Leave all of those out.

Rank the flags by probable cost to this Signer: how likely the clause is to bite, times what it would cost. Rank 1 is the most likely to cost them. Do not rank by worst-case legal exposure.

Citing:
- The document is given as numbered sentence units, each shown as its id and its text as a JSON string.
- Each flag cites exactly one unit id, and "quote" must be that unit's text exactly as given, with every space and punctuation mark unchanged (decode the JSON escapes).
- Never cite text that is not a unit. Never merge, trim or paraphrase a unit in "quote".

Writing:
- State only what the cited sentence says. Do not guess the Signer's jurisdiction, industry or leverage.
- Explain; never advise. Do not tell the Signer what they should legally do, and do not present this as legal advice.
- If no sentence meets the test, return an empty riskFlags array. A clean document is a real result.`;

export function buildAnalysisRequest(units: readonly SentenceUnit[], redLines: readonly RedLine[]): JsonCompletionRequest {
  const redLineSection =
    redLines.length === 0
      ? "The Signer has not stated any red lines."
      : [
          "The Signer's red lines (boundaries they will not accept crossing). Treat a sentence that crosses one as a risk flag if it also meets the test:",
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
