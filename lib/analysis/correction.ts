import type { JsonCompletionRequest, ModelClient } from "../model/model-client.ts";
import { CitationError } from "./citation.ts";
import { asciiJsonString } from "./parts.ts";
import type { SentenceUnit } from "./segment.ts";

/**
 * Asks the model, reads the answer with `read`, and if `read` rejects it (a citation that does not
 * match, or an answer that contradicts itself) asks once more with the reasons appended.
 *
 * Nothing from a rejected answer survives: the second answer is read from scratch through the same
 * checks, and if it is rejected too, that error is thrown. The first rejection is logged, so a
 * model that needs correcting on most runs shows up in the logs rather than disappearing behind a
 * result that came back. Model errors (network, HTTP, unparseable JSON) are not retried here.
 */
export async function askWithOneCorrection<T>(
  modelClient: ModelClient,
  request: JsonCompletionRequest,
  unitsById: ReadonlyMap<string, SentenceUnit>,
  isRejection: (error: unknown) => boolean,
  read: (response: unknown) => T,
): Promise<T> {
  const first = await modelClient.completeJson(request);
  try {
    return read(first);
  } catch (error) {
    if (!isRejection(error)) throw error;
    console.warn(`Model answer rejected, asking once more: ${(error as Error).message}`);
    const corrected = await modelClient.completeJson({
      ...request,
      user: `${request.user}\n\n${correctionNote(error as Error, unitsById)}`,
    });
    return read(corrected);
  }
}

function correctionNote(error: Error, unitsById: ReadonlyMap<string, SentenceUnit>): string {
  const reasons =
    error instanceof CitationError
      ? error.failures.map((failure) => {
          const unit = unitsById.get(failure.unitId);
          return unit
            ? `- ${failure.findingType} #${failure.index} quoted unit ${failure.unitId} inexactly. Its exact text is ${asciiJsonString(unit.text)}.`
            : `- ${failure.findingType} #${failure.index} cited unit ${JSON.stringify(failure.unitId)}, which is not one of the units shown.`;
        })
      : [`- ${error.message}`];
  return [
    "A previous answer to this request was rejected and thrown away, for these reasons:",
    ...reasons,
    "Answer again in full, from the start, following every rule. Copy each quote character for character from its unit, and cite each unit under at most one of riskFlags, worthALook and multiplierNotes.",
  ].join("\n");
}
