import { describe, expect, it } from "vitest";
import { analyse, AnalysisResponseError, CitationError } from "../../lib/analysis/analyse";
import { handleAnalyseRequest } from "../../lib/analysis/handle-analyse";
import { buildAnalyseRequestBody } from "../../lib/analysis/request";
import type { RedLine } from "../../lib/analysis/types";
import { loadFixture, SidecarModelClient } from "../support/sidecar-model-client";

const adhesion = loadFixture("adhesion-contract");
const sentenceOf = (id: string) => adhesion.sidecar.plantedClauses.find((clause) => clause.id === id)!.sentence;

const NON_COMPETE: RedLine = { text: "I won't agree to a non-compete that stops me working for other clients." };
const ARBITRATION: RedLine = { text: "Disputes go to a court, not   private arbitration." };

describe("analyse: the Signer's red lines drive the analysis", () => {
  it("shows the model every red line, in the Signer's words and order, with an id", async () => {
    const client = new SidecarModelClient(adhesion);
    await analyse(adhesion.text, [NON_COMPETE, ARBITRATION], client);

    expect(client.requests).toHaveLength(1);
    expect(client.requests[0].user).toContain(`[RL-1] ${JSON.stringify(NON_COMPETE.text)}`);
    expect(client.requests[0].user).toContain(`[RL-2] ${JSON.stringify(ARBITRATION.text)}`);
  });

  it("returns a Risk flag the model ties to a red line carrying that red line, with its Source sentence validated", async () => {
    const client = new SidecarModelClient(adhesion, { redLinesFor: { "RF-4": ["RL-1"] } });
    const result = await analyse(adhesion.text, [NON_COMPETE, ARBITRATION], client);

    const nonCompete = result.riskFlags.find((flag) => flag.source.text === sentenceOf("RF-4"))!;
    expect(nonCompete.redLines).toEqual([{ id: "RL-1", text: NON_COMPETE.text }]);
    expect(adhesion.text.slice(nonCompete.source.start, nonCompete.source.end)).toBe(sentenceOf("RF-4"));
    for (const flag of result.riskFlags.filter((candidate) => candidate !== nonCompete)) {
      expect(flag.redLines).toEqual([]);
    }
  });

  it("creates no finding from a red line that no sentence crosses", async () => {
    const without = await analyse(adhesion.text, [], new SidecarModelClient(adhesion));
    const withRedLines = await analyse(adhesion.text, [NON_COMPETE, ARBITRATION], new SidecarModelClient(adhesion));

    expect(withRedLines.riskFlags.map((flag) => flag.source)).toEqual(without.riskFlags.map((flag) => flag.source));
    expect(withRedLines.worthALook).toEqual(without.worthALook);
    expect(withRedLines.riskFlags.every((flag) => flag.redLines.length === 0)).toBe(true);
  });

  it("keeps a Multiplier note that crosses a red line out of the ranking, naming the red line", async () => {
    const client = new SidecarModelClient(adhesion, { redLinesFor: { "MN-1": ["RL-2"] } });
    const result = await analyse(adhesion.text, [NON_COMPETE, ARBITRATION], client);

    const arbitration = result.multiplierNotes.find((note) => note.source.text === sentenceOf("MN-1"))!;
    expect(arbitration.redLines).toEqual([{ id: "RL-2", text: ARBITRATION.text }]);
    expect(result.riskFlags.some((flag) => flag.source.text === sentenceOf("MN-1"))).toBe(false);
  });

  it("fails as malformed when a finding names a red line id the Signer does not have", async () => {
    const client = new SidecarModelClient(adhesion, { redLinesFor: { "RF-4": ["RL-3"] } });

    const failure = await analyse(adhesion.text, [NON_COMPETE, ARBITRATION], client).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AnalysisResponseError);
    expect((failure as Error).message).toContain('"RL-3"');
  });

  it("fails as malformed when a finding names a red line and the Signer has none", async () => {
    const client = new SidecarModelClient(adhesion, { redLinesFor: { "RF-1": ["RL-1"] } });
    await expect(analyse(adhesion.text, [], client)).rejects.toThrow(AnalysisResponseError);
  });

  it("still throws CitationError for a red-line flag whose quote was tampered with", async () => {
    const client = new SidecarModelClient(adhesion, {
      redLinesFor: { "RF-4": ["RL-1"] },
      tamper: (payload) => {
        const flag = payload.riskFlags.find((candidate) => candidate.redLines.includes("RL-1"))!;
        flag.quote = flag.quote.replace("twenty-four", "twelve");
        return payload;
      },
    });

    const failure = await analyse(adhesion.text, [NON_COMPETE], client).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(CitationError);
    expect((failure as CitationError).failures).toEqual([
      expect.objectContaining({ findingType: "risk-flag", reason: "quote-mismatch" }),
    ]);
  });
});

describe("analyse: a bounded clause that crosses a red line is a Risk flag, never Worth a look", () => {
  const CAP: RedLine = { text: "No cap on what I can be asked to pay back for warranty claims, unless it's one times the fee." };

  it("fails as malformed when a Worth a look entry names a red line", async () => {
    const client = new SidecarModelClient(adhesion, (payload) => {
      Object.assign(payload.worthALook[0], { redLines: ["RL-1"] });
      return payload;
    });

    const failure = await analyse(adhesion.text, [CAP], client).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AnalysisResponseError);
    expect((failure as Error).message).toMatch(/crosses a red line is a Risk flag, never Worth a look/);
  });

  it("ranks the clause among the Risk flags, with the model's band and Counter-offer, when it is sent as a flag", async () => {
    const capped = sentenceOf("WAL-1");
    const client = new SidecarModelClient(adhesion, (payload) => {
      const entry = payload.worthALook.find((candidate) => candidate.quote === capped)!;
      payload.worthALook = payload.worthALook.filter((candidate) => candidate !== entry);
      payload.riskFlags.push({
        ...entry,
        check: "other",
        severityBand: "medium",
        rank: 7,
        counterOffer: "The Contractor's total liability for any breach of the warranties shall not exceed the fees paid.",
        redLines: ["RL-1"],
      });
      return payload;
    });
    const result = await analyse(adhesion.text, [CAP], client);

    expect(result.worthALook).toEqual([]);
    const promoted = result.riskFlags.find((flag) => flag.source.text === capped)!;
    expect(promoted).toMatchObject({ severityBand: "medium", redLines: [{ id: "RL-1", text: CAP.text }] });
    expect(promoted.counterOffer).toContain("shall not exceed the fees paid");
    expect(adhesion.text.slice(promoted.source.start, promoted.source.end)).toBe(capped);
    expect(result.riskFlags.map((flag) => flag.rank)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("analyse: red lines in a long Document analysed in parts", () => {
  it("shows every red line to every part, and carries one crossed in a later part into the result", async () => {
    const client = new SidecarModelClient(adhesion, { redLinesFor: { "RF-4": ["RL-1"], "RF-6": ["RL-2", "RL-1"] } });
    const result = await analyse(adhesion.text, [NON_COMPETE, ARBITRATION], client, { partBudget: 4_000 });

    expect(client.calls.length).toBeGreaterThan(1);
    for (const call of client.calls) {
      expect(call.request.user).toContain(`[RL-1] ${JSON.stringify(NON_COMPETE.text)}`);
      expect(call.request.user).toContain(`[RL-2] ${JSON.stringify(ARBITRATION.text)}`);
    }
    const renewal = result.riskFlags.find((flag) => flag.source.text === sentenceOf("RF-6"))!;
    expect(renewal.redLines.map((line) => line.id)).toEqual(["RL-1", "RL-2"]);
    expect(adhesion.text.slice(renewal.source.start, renewal.source.end)).toBe(renewal.source.text);
    expect(result.riskFlags.find((flag) => flag.source.text === sentenceOf("RF-4"))!.redLines).toEqual([
      { id: "RL-1", text: NON_COMPETE.text },
    ]);
  });
});

describe("POST /api/analyse: red lines", () => {
  const post = (body: string) =>
    handleAnalyseRequest(
      new Request("http://localhost/api/analyse", { method: "POST", headers: { "Content-Type": "application/json" }, body }),
      () => new SidecarModelClient(adhesion),
    );

  it("refuses a blank red line without calling the model", async () => {
    const response = await post(buildAnalyseRequestBody(adhesion.text, [{ text: "   " }]));
    expect(response.status).toBe(400);
  });

  it("refuses a red line over the length limit", async () => {
    const response = await post(buildAnalyseRequestBody(adhesion.text, [{ text: "x".repeat(301) }]));
    expect(response.status).toBe(400);
  });
});
