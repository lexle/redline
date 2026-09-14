import { describe, expect, it } from "vitest";
import { analyse, AnalysisResponseError, CitationError } from "../../lib/analysis/analyse";
import { segmentSentences } from "../../lib/analysis/segment";
import {
  inferenceClaimFor,
  loadFixture,
  readOffClaimFor,
  SidecarModelClient,
} from "../support/sidecar-model-client";

const adhesion = loadFixture("adhesion-contract");
const clean = loadFixture("clean-agreement");
const plantedRiskFlags = adhesion.sidecar.plantedClauses
  .filter((clause) => clause.findingType === "risk-flag")
  .sort((a, b) => a.expectedRank! - b.expectedRank!);

describe("analyse: Risk flags cite their Source sentence", () => {
  it("returns only Risk flags whose Source sentence is the exact stored text at its offsets", async () => {
    const result = await analyse(adhesion.text, [], new SidecarModelClient(adhesion));

    expect(result.riskFlags.length).toBeGreaterThan(0);
    for (const flag of result.riskFlags) {
      expect(adhesion.text.slice(flag.source.start, flag.source.end)).toBe(flag.source.text);
    }
  });

  it("returns every planted Risk flag, ranked in the expected order", async () => {
    const result = await analyse(adhesion.text, [], new SidecarModelClient(adhesion));

    expect(result.riskFlags.map((flag) => flag.source.text)).toEqual(plantedRiskFlags.map((clause) => clause.sentence));
    expect(result.riskFlags.map((flag) => flag.rank)).toEqual(plantedRiskFlags.map((clause) => clause.expectedRank));
    expect(result.riskFlags.map((flag) => flag.severityBand)).toEqual(plantedRiskFlags.map((clause) => clause.severityBand));
  });

  it("ranks by severity band before the model's rank, so a no-ceiling cost comes first", async () => {
    const client = new SidecarModelClient(adhesion, (payload) => ({
      riskFlags: payload.riskFlags.map((flag) => ({ ...flag, rank: flag.severityBand === "medium" ? 1 : 9 })),
    }));
    const result = await analyse(adhesion.text, [], client);

    const bands = result.riskFlags.map((flag) => flag.severityBand);
    expect(bands).toEqual([...bands].sort((a, b) => (a === b ? 0 : a === "high" ? -1 : 1)));
    expect(result.riskFlags.map((flag) => flag.rank)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("shows the model every sentence unit with its id, so any sentence can be cited", async () => {
    const client = new SidecarModelClient(adhesion);
    await analyse(adhesion.text, [], client);

    expect(client.requests).toHaveLength(1);
    const [request] = client.requests;
    for (const unit of segmentSentences(adhesion.text)) {
      expect(request.user).toContain(`[${unit.id}] ${JSON.stringify(unit.text)}`);
    }
  });

  it("returns zero Risk flags for the clean agreement when the model finds none", async () => {
    const result = await analyse(clean.text, [], new SidecarModelClient(clean));
    expect(result.riskFlags).toEqual([]);
  });
});

describe("analyse: a citation that does not match fails the whole analysis", () => {
  it("throws CitationError when a flag cites a unit id that does not exist", async () => {
    const client = new SidecarModelClient(adhesion, (payload) => {
      payload.riskFlags[0].unitId = "u99999";
      return payload;
    });

    const failure = await analyse(adhesion.text, [], client).then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(CitationError);
    const citationError = failure as CitationError;
    expect(citationError.failures).toEqual([expect.objectContaining({ unitId: "u99999", reason: "unknown-unit" })]);
    expect(citationError.passedCount).toBe(plantedRiskFlags.length - 1);
  });

  it("throws when the echoed quote differs from the stored sentence by a single space", async () => {
    const client = new SidecarModelClient(adhesion, (payload) => {
      payload.riskFlags[2].quote = payload.riskFlags[2].quote.replace(" ", "  ");
      return payload;
    });

    await expect(analyse(adhesion.text, [], client)).rejects.toBeInstanceOf(CitationError);
  });

  it("throws when the quote has whitespace collapsed that the stored text keeps", async () => {
    const units = segmentSentences(adhesion.text);
    const doubleSpaced = units.find((unit) => unit.text.includes("  "));
    expect(doubleSpaced, "the fixture should contain irregular whitespace").toBeDefined();

    const client = new SidecarModelClient(adhesion, (payload) => ({
      riskFlags: [
        ...payload.riskFlags,
        {
          unitId: doubleSpaced!.id,
          quote: doubleSpaced!.text.replace(/ {2,}/g, " "),
          title: "Collapsed",
          claims: [{ tier: "read-off", text: "Quote with whitespace collapsed." }],
          severityBand: "medium",
          rank: 7,
        },
      ],
    }));

    await expect(analyse(adhesion.text, [], client)).rejects.toThrow(CitationError);
  });

  it("names every failed finding instead of returning the ones that passed", async () => {
    const client = new SidecarModelClient(adhesion, (payload) => {
      payload.riskFlags[0].quote += ".";
      payload.riskFlags[4].unitId = "nope";
      return payload;
    });

    const failure = (await analyse(adhesion.text, [], client).catch((error: unknown) => error)) as CitationError;
    expect(failure).toBeInstanceOf(CitationError);
    expect(failure.failures.map((item) => item.reason).sort()).toEqual(["quote-mismatch", "unknown-unit"]);
    expect(failure.passedCount).toBe(plantedRiskFlags.length - 2);
    expect(failure.message).toContain("nope");
  });
});

describe("analyse: every claim carries its provenance tier", () => {
  const jurisdictionClaim = {
    tier: "needs-signer-facts" as const,
    text: "A court in California would refuse to enforce this non-compete against you.",
  };
  const industryClaim = {
    tier: "needs-signer-facts" as const,
    text: "In software consulting, third-party claims like these are rare, so this is unlikely to matter to you.",
  };
  const flagFor = (id: string) => plantedRiskFlags.find((clause) => clause.id === id)!;

  it("withholds a claim that depends on the Signer's jurisdiction or industry, leaving it out of the result entirely", async () => {
    const client = new SidecarModelClient(adhesion, {
      extraClaims: { "RF-4": [jurisdictionClaim], "RF-2": [industryClaim] },
    });
    const result = await analyse(adhesion.text, [], client);

    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain(jurisdictionClaim.text);
    expect(serialised).not.toContain(industryClaim.text);
    expect(serialised).not.toContain("needs-signer-facts");

    // Both flags still stand on the claims that remain, still citing their sentence verbatim.
    for (const id of ["RF-4", "RF-2"]) {
      const clause = flagFor(id);
      const flag = result.riskFlags.find((candidate) => candidate.source.text === clause.sentence);
      expect(flag, `${id} should still be returned`).toBeDefined();
      expect(flag!.claims).toEqual([readOffClaimFor(clause), inferenceClaimFor(clause)]);
      expect(adhesion.text.slice(flag!.source.start, flag!.source.end)).toBe(clause.sentence);
    }
    expect(result.riskFlags).toHaveLength(plantedRiskFlags.length);
  });

  it("returns an inference claim marked as inference, and a read-off claim marked as read-off", async () => {
    const result = await analyse(adhesion.text, [], new SidecarModelClient(adhesion));

    result.riskFlags.forEach((flag, position) => {
      const clause = plantedRiskFlags[position];
      expect(flag.source.text).toBe(clause.sentence);
      expect(flag.claims).toEqual([
        { tier: "read-off", text: readOffClaimFor(clause).text },
        { tier: "inference", text: clause.why },
      ]);
    });
  });

  it("keeps the model's order of claims when withheld ones sit between them", async () => {
    const clause = flagFor("RF-1");
    const extraInference = { tier: "inference" as const, text: "A long delay could cost more than the whole fee." };
    const client = new SidecarModelClient(adhesion, {
      tamper: (payload) => {
        const flag = payload.riskFlags.find((candidate) => candidate.quote === clause.sentence)!;
        flag.claims = [flag.claims[0], jurisdictionClaim, extraInference, industryClaim, flag.claims[1]];
        return payload;
      },
    });
    const result = await analyse(adhesion.text, [], client);

    expect(result.riskFlags[0].source.text).toBe(clause.sentence);
    expect(result.riskFlags[0].claims).toEqual([readOffClaimFor(clause), extraInference, inferenceClaimFor(clause)]);
  });

  it("fails the analysis, naming the flag, when every claim a flag makes is withheld", async () => {
    const clause = flagFor("RF-3");
    const client = new SidecarModelClient(adhesion, {
      tamper: (payload) => {
        const flag = payload.riskFlags.find((candidate) => candidate.quote === clause.sentence)!;
        flag.claims = [jurisdictionClaim, industryClaim];
        return payload;
      },
    });
    const unit = segmentSentences(adhesion.text).find((candidate) => candidate.text === clause.sentence)!;

    const failure = await analyse(adhesion.text, [], client).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AnalysisResponseError);
    expect((failure as Error).message).toContain(`unit ${unit.id}`);
  });

  it("rejects a claim whose tier is not one of the three", async () => {
    const client = new SidecarModelClient(adhesion, (payload) => {
      (payload.riskFlags[0].claims[0] as { tier: string }).tier = "confident";
      return payload;
    });

    await expect(analyse(adhesion.text, [], client)).rejects.toBeInstanceOf(AnalysisResponseError);
  });

  it("still fails on a bad citation even when the flag's claims are all well tiered", async () => {
    const client = new SidecarModelClient(adhesion, {
      extraClaims: { "RF-5": [jurisdictionClaim] },
      tamper: (payload) => {
        payload.riskFlags[1].quote = payload.riskFlags[1].quote.slice(1);
        return payload;
      },
    });

    await expect(analyse(adhesion.text, [], client)).rejects.toBeInstanceOf(CitationError);
  });
});
