import { describe, expect, it } from "vitest";
import { analyse, AnalysisResponseError, CitationError } from "../../lib/analysis/analyse";
import { splitIntoParts } from "../../lib/analysis/parts";
import { segmentSentences } from "../../lib/analysis/segment";
import type { ModelClient } from "../../lib/model/model-client";
import { ModelError } from "../../lib/model/model-client";
import { loadFixture, SidecarModelClient } from "../support/sidecar-model-client";
import type { Fixture, ModelPayload } from "../support/sidecar-model-client";

const adhesion = loadFixture("adhesion-contract");
const clean = loadFixture("clean-agreement");

/** Small enough that each fixture needs several parts. */
const BUDGET = 4_000;

const riskFlagClause = (id: string) => adhesion.sidecar.plantedClauses.find((clause) => clause.id === id)!;

/** The clean agreement three times over, then the adhesion contract's completion-cost clause at the very end. */
function cleanWithLateRiskFlag(): Fixture {
  const planted = riskFlagClause("RF-1");
  return {
    text: `${clean.text}\n\n${clean.text}\n\n${clean.text}\n\n${planted.sentence}\n`,
    sidecar: { ...clean.sidecar, document: "clean x3 + RF-1", plantedClauses: [planted] },
  };
}

/** The adhesion contract, which never says when the Contractor is paid, then the clean agreement, which does. */
function adhesionThenClean(): Fixture {
  return {
    text: `${adhesion.text}\n\n${clean.text}`,
    sidecar: {
      document: "adhesion + clean",
      plantedClauses: adhesion.sidecar.plantedClauses,
      presentProtections: clean.sidecar.presentProtections,
      expectedMissingProtections: [],
      expectedNiceToHave: clean.sidecar.expectedNiceToHave,
    },
  };
}

function missingKinds(payload: unknown): string[] {
  return (payload as ModelPayload).missingProtections.map((entry) => entry.protection);
}

describe("analyse: a long Document is analysed in parts, end to end", () => {
  it("splits a long Document into several parts and returns the Risk flag planted in the final part, cited at its full-text offsets", async () => {
    const fixture = cleanWithLateRiskFlag();
    const client = new SidecarModelClient(fixture);
    const result = await analyse(fixture.text, [], client, { partBudget: BUDGET });

    expect(client.calls.length).toBeGreaterThan(1);
    const units = segmentSentences(fixture.text);
    const planted = riskFlagClause("RF-1");
    const plantedUnit = units.find((unit) => unit.text === planted.sentence)!;
    // Every unit was shown to the model in some part, and only the last part shows the planted clause.
    expect(new Set(client.calls.flatMap((call) => call.unitIds))).toEqual(new Set(units.map((unit) => unit.id)));
    expect(client.calls.filter((call) => call.unitIds.includes(plantedUnit.id))).toHaveLength(1);
    expect(client.calls.at(-1)!.unitIds).toContain(plantedUnit.id);

    expect(result.riskFlags).toHaveLength(1);
    const [flag] = result.riskFlags;
    expect(flag.source.text).toBe(planted.sentence);
    expect(fixture.text.slice(flag.source.start, flag.source.end)).toBe(flag.source.text);
    expect(flag.source.start).toBeGreaterThan(clean.text.length * 3);
    expect(result.nothingFound).toBe(false);
    expect(result.checklist.find((item) => item.check === "uncapped-liability")).toEqual({
      kind: "checklist-item",
      check: "uncapped-liability",
      outcome: "flagged",
      riskFlagRanks: [1],
    });
  });

  it("tells each part's request that it is one part of several, with ids from the whole Document", async () => {
    const fixture = cleanWithLateRiskFlag();
    const client = new SidecarModelClient(fixture);
    await analyse(fixture.text, [], client, { partBudget: BUDGET });

    const count = client.calls.length;
    client.calls.forEach((call, index) => {
      expect(call.request.user).toContain(`part ${index + 1} of ${count}`);
    });
    expect(client.calls[1].unitIds[0]).not.toBe("u1");
  });

  it("does not raise the payment-timing Missing protection when payment terms appear only in a late part", async () => {
    const fixture = adhesionThenClean();
    const client = new SidecarModelClient(fixture);
    const result = await analyse(fixture.text, [], client, { partBudget: BUDGET });

    // The early parts, on their own, reported payment timing missing.
    const paymentSentence = clean.sidecar.presentProtections!.find((entry) => entry.id === "payment-timing")!.sentence;
    const paymentUnit = segmentSentences(fixture.text).find((unit) => unit.text === paymentSentence)!;
    const early = client.calls.filter((call) => !call.unitIds.includes(paymentUnit.id));
    expect(early.length).toBeGreaterThan(0);
    for (const call of early) expect(missingKinds(call.response)).toContain("payment-timing");

    expect(result.missingProtections.map((entry) => entry.protection)).not.toContain("payment-timing");
    expect(result.missingProtections).toEqual([]);
    const timing = result.checklist.find((item) => item.check === "payment-timing");
    expect(timing).toMatchObject({ outcome: "present", source: { text: paymentSentence } });
    if (timing?.outcome !== "present") throw new Error("payment timing should be present");
    expect(fixture.text.slice(timing.source.start, timing.source.end)).toBe(paymentSentence);
    expect(timing.source.start).toBeGreaterThan(adhesion.text.length);
    // The adhesion contract's Risk flags, from the early parts, all survive the merge and rank once.
    expect(result.riskFlags.map((flag) => flag.rank)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("raises the payment-timing Missing protection exactly once when every part lacks payment terms", async () => {
    const client = new SidecarModelClient(adhesion);
    const result = await analyse(adhesion.text, [], client, { partBudget: BUDGET });

    expect(client.calls.length).toBeGreaterThan(1);
    for (const call of client.calls) expect(missingKinds(call.response)).toContain("payment-timing");
    expect(result.missingProtections.filter((entry) => entry.protection === "payment-timing")).toHaveLength(1);
    expect(result.missingProtections.map((entry) => entry.id)).toEqual(["MP-01", "MP-02", "MP-03", "MP-04", "MP-05"]);
    expect(result.missingProtections[0].protection).toBe("payment-timing");
    expect(result.checklist.find((item) => item.check === "payment-timing")).toEqual({
      kind: "checklist-item",
      check: "payment-timing",
      outcome: "missing",
      absence: { kind: "missing-protection", id: "MP-01" },
    });
  });

  it("returns the same unit cited by two overlapping parts as one finding", async () => {
    // Find a budget whose parts overlap on a planted Risk flag, then check the analysis through that split.
    const units = segmentSentences(adhesion.text);
    const plantedIds = adhesion.sidecar.plantedClauses
      .filter((clause) => clause.findingType === "risk-flag")
      .map((clause) => units.find((unit) => unit.text === clause.sentence)!.id);
    const budget = Array.from({ length: 60 }, (_, step) => 2_000 + step * 50).find((candidate) =>
      splitIntoParts(units, candidate).some((part, index, parts) =>
        part.units.some((unit) => plantedIds.includes(unit.id) && parts[index + 1]?.units.some((later) => later.id === unit.id)),
      ),
    );
    expect(budget, "some budget should put a planted clause in the overlap between two parts").toBeDefined();

    const client = new SidecarModelClient(adhesion);
    const result = await analyse(adhesion.text, [], client, { partBudget: budget });

    const shared = plantedIds.filter((id) => client.calls.filter((call) => call.unitIds.includes(id)).length > 1);
    expect(shared.length).toBeGreaterThan(0);
    for (const id of shared) {
      const answeredBy = client.calls.filter((call) =>
        (call.response as ModelPayload).riskFlags.some((flag) => flag.unitId === id),
      );
      expect(answeredBy.length).toBeGreaterThan(1);
    }
    expect(result.riskFlags).toHaveLength(6);
    expect(new Set(result.riskFlags.map((flag) => flag.source.start)).size).toBe(6);
    expect(result.riskFlags.map((flag) => flag.rank)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("makes exactly one model call for a Document within the budget, with no mention of parts", async () => {
    const client = new SidecarModelClient(adhesion);
    const result = await analyse(adhesion.text, [], client);

    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].request.user).not.toContain("part 1 of");
    expect(result.riskFlags).toHaveLength(6);
  });
});

describe("analyse: any part failing fails the whole long Document", () => {
  it("throws CitationError when one part returns a tampered quote", async () => {
    const fixture = cleanWithLateRiskFlag();
    const plantedSentence = riskFlagClause("RF-1").sentence;
    const client = new SidecarModelClient(fixture, (payload) => {
      for (const flag of payload.riskFlags) if (flag.quote === plantedSentence) flag.quote = flag.quote.replace(" ", "  ");
      return payload;
    });

    const failure = await analyse(fixture.text, [], client, { partBudget: BUDGET }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(CitationError);
    expect((failure as CitationError).failures).toEqual([
      expect.objectContaining({ findingType: "risk-flag", reason: "quote-mismatch" }),
    ]);
  });

  it("fails the whole analysis when one part's model call rejects", async () => {
    const stub = new SidecarModelClient(adhesion);
    let calls = 0;
    const client: ModelClient = {
      completeJson(request) {
        calls++;
        return calls === 2 ? Promise.reject(new ModelError("http", "OpenRouter answered 429")) : stub.completeJson(request);
      },
    };

    await expect(analyse(adhesion.text, [], client, { partBudget: BUDGET })).rejects.toBeInstanceOf(ModelError);
  });

  it("fails as malformed when a part cites a unit it was not shown", async () => {
    const units = segmentSentences(adhesion.text);
    const last = units.at(-1)!;
    const client = new SidecarModelClient(adhesion, (payload, shown) => {
      if (!shown.unitIds.includes(last.id)) {
        payload.summary[0].sources.push({ unitId: last.id, quote: last.text });
      }
      return payload;
    });

    await expect(analyse(adhesion.text, [], client, { partBudget: BUDGET })).rejects.toThrow(AnalysisResponseError);
  });

  it("fails as malformed when two parts cite the same unit as different finding types", async () => {
    const units = segmentSentences(adhesion.text);
    const planted = adhesion.sidecar.plantedClauses.filter((clause) => clause.findingType === "risk-flag");
    const plantedIds = planted.map((clause) => units.find((unit) => unit.text === clause.sentence)!.id);
    const budget = Array.from({ length: 60 }, (_, step) => 2_000 + step * 50).find((candidate) =>
      splitIntoParts(units, candidate).some((part, index, parts) =>
        part.units.some((unit) => plantedIds.includes(unit.id) && parts[index + 1]?.units.some((later) => later.id === unit.id)),
      ),
    )!;
    let seenOnce = new Set<string>();
    const client = new SidecarModelClient(adhesion, (payload, shown) => {
      // The stub also builds a whole-Document answer up front; only the part answers count here.
      if (shown.unitIds.length === units.length) return payload;
      // The second time a planted flag's unit is answered, send it as Worth a look instead.
      const [again, first] = [
        payload.riskFlags.filter((flag) => seenOnce.has(flag.unitId)),
        payload.riskFlags.filter((flag) => !seenOnce.has(flag.unitId)),
      ];
      seenOnce = new Set([...seenOnce, ...first.map((flag) => flag.unitId)]);
      payload.riskFlags = first;
      payload.worthALook.push(...again.map(({ unitId, quote, title, claims }) => ({ unitId, quote, title, claims })));
      payload.checklist = payload.checklist.map((item) =>
        item.outcome === "flagged" && !first.some((flag) => flag.check === item.check) ? { ...item, outcome: "not-found" } : item,
      );
      return payload;
    });

    await expect(analyse(adhesion.text, [], client, { partBudget: budget })).rejects.toThrow(
      /cited under more than one finding type/,
    );
  });
});
