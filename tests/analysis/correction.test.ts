import { afterEach, describe, expect, it, vi } from "vitest";
import { analyse, AnalysisResponseError, CitationError } from "../../lib/analysis/analyse";
import type { JsonCompletionRequest, ModelClient } from "../../lib/model/model-client";
import { ModelError } from "../../lib/model/model-client";
import { loadFixture, SidecarModelClient } from "../support/sidecar-model-client";
import type { ModelPayload } from "../support/sidecar-model-client";

const adhesion = loadFixture("adhesion-contract");
const plantedFlag = adhesion.sidecar.plantedClauses.find((clause) => clause.findingType === "risk-flag")!;

/** Doubles a word in the planted flag's quote, the way the real model misquoted a long sentence. */
function misquote(payload: ModelPayload): ModelPayload {
  for (const flag of payload.riskFlags) {
    if (flag.quote === plantedFlag.sentence) flag.quote = flag.quote.replace(" ", " the ");
  }
  return payload;
}

/** Also cites the planted flag's sentence as a Multiplier note. */
function citeTwice(payload: ModelPayload): ModelPayload {
  const flag = payload.riskFlags.find((candidate) => candidate.quote === plantedFlag.sentence)!;
  payload.multiplierNotes.push({ unitId: flag.unitId, quote: flag.quote, title: flag.title, claims: flag.claims, redLines: [] });
  return payload;
}

/** Answers from `broken` for the first `badAnswers` calls, then from the clean stub, recording every request. */
function flakyClient(broken: SidecarModelClient, badAnswers: number) {
  const clean = new SidecarModelClient(adhesion);
  const requests: JsonCompletionRequest[] = [];
  const client: ModelClient = {
    completeJson(request) {
      requests.push(request);
      return (requests.length <= badAnswers ? broken : clean).completeJson(request);
    },
  };
  return { client, requests };
}

afterEach(() => vi.restoreAllMocks());

describe("analyse: a rejected model answer is thrown away and asked for once more", () => {
  it("returns the second answer when the first misquotes a sentence, and tells the model the exact text", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client, requests } = flakyClient(new SidecarModelClient(adhesion, misquote), 1);

    const result = await analyse(adhesion.text, [], client);

    expect(requests).toHaveLength(2);
    expect(requests[1].user.startsWith(requests[0].user)).toBe(true);
    expect(requests[1].user).toContain(`Its exact text is ${JSON.stringify(plantedFlag.sentence)}`);
    expect(result.riskFlags.map((flag) => flag.source.text)).toContain(plantedFlag.sentence);
    for (const flag of result.riskFlags) {
      expect(adhesion.text.slice(flag.source.start, flag.source.end)).toBe(flag.source.text);
    }
    expect(warn).toHaveBeenCalledOnce();
  });

  it("returns the second answer when the first cites one sentence under two finding types", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client, requests } = flakyClient(new SidecarModelClient(adhesion, citeTwice), 1);

    const result = await analyse(adhesion.text, [], client);

    expect(requests).toHaveLength(2);
    expect(requests[1].user).toContain("cited under more than one finding type");
    expect(result.multiplierNotes.map((note) => note.source.text)).not.toContain(plantedFlag.sentence);
  });

  it("throws the second rejection when the corrected answer is wrong too", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client, requests } = flakyClient(new SidecarModelClient(adhesion, misquote), 2);

    await expect(analyse(adhesion.text, [], client)).rejects.toBeInstanceOf(CitationError);
    expect(requests).toHaveLength(2);
  });

  it("asks only once more, however many times the model gets it wrong", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client, requests } = flakyClient(new SidecarModelClient(adhesion, citeTwice), 5);

    await expect(analyse(adhesion.text, [], client)).rejects.toBeInstanceOf(AnalysisResponseError);
    expect(requests).toHaveLength(2);
  });

  it("does not retry a model call that failed outright", async () => {
    let calls = 0;
    const client: ModelClient = {
      completeJson() {
        calls++;
        return Promise.reject(new ModelError("http", "OpenRouter answered 500"));
      },
    };

    await expect(analyse(adhesion.text, [], client)).rejects.toBeInstanceOf(ModelError);
    expect(calls).toBe(1);
  });
});
