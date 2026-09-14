import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyse, AnalysisResponseError, CitationError } from "../../lib/analysis/analyse";
import { segmentSentences } from "../../lib/analysis/segment";
import { ANALYSIS_SCHEMA } from "../../lib/analysis/prompt";
import type { MissingProtection, RiskFlag } from "../../lib/analysis/types";
import {
  counterOfferFor,
  inferenceClaimFor,
  inferenceClaimForAbsence,
  loadFixture,
  proposedInsertionFor,
  readOffClaimFor,
  SidecarModelClient,
  statementFor,
} from "../support/sidecar-model-client";

const adhesion = loadFixture("adhesion-contract");
const clean = loadFixture("clean-agreement");
const plantedRiskFlags = adhesion.sidecar.plantedClauses
  .filter((clause) => clause.findingType === "risk-flag")
  .sort((a, b) => a.expectedRank! - b.expectedRank!);
const plantedWorthALook = adhesion.sidecar.plantedClauses.filter((clause) => clause.findingType === "worth-a-look");
const plantedMultiplierNotes = adhesion.sidecar.plantedClauses.filter((clause) => clause.findingType === "multiplier-note");
/** Every finding the stub sends that cites a Source sentence: Risk flags, Worth a look and Multiplier notes. */
const citedFindingCount = plantedRiskFlags.length + plantedWorthALook.length + plantedMultiplierNotes.length;

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
      ...payload,
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
    expect(citationError.passedCount).toBe(citedFindingCount - 1);
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
      ...payload,
      riskFlags: [
        ...payload.riskFlags,
        {
          unitId: doubleSpaced!.id,
          quote: doubleSpaced!.text.replace(/ {2,}/g, " "),
          title: "Collapsed",
          claims: [{ tier: "read-off", text: "Quote with whitespace collapsed." }],
          severityBand: "medium",
          rank: 7,
          counterOffer: "The Contractor proposes replacing this sentence.",
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
    expect(failure.passedCount).toBe(citedFindingCount - 2);
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

describe("analyse: every Risk flag carries its Counter-offer", () => {
  const flagFor = (id: string) => plantedRiskFlags.find((clause) => clause.id === id)!;

  it("returns a non-empty Counter-offer on every Risk flag, the one drafted for that flag's sentence", async () => {
    const result = await analyse(adhesion.text, [], new SidecarModelClient(adhesion));

    expect(result.riskFlags).toHaveLength(plantedRiskFlags.length);
    result.riskFlags.forEach((flag, position) => {
      const clause = plantedRiskFlags[position];
      expect(flag.source.text).toBe(clause.sentence);
      expect(flag.counterOffer.trim()).not.toBe("");
      expect(flag.counterOffer).toBe(counterOfferFor(clause));
    });
  });

  it("asks the model for the Counter-offer in the same call as the flag, as a required field", async () => {
    const client = new SidecarModelClient(adhesion);
    await analyse(adhesion.text, [], client);

    expect(client.requests).toHaveLength(1);
    const riskFlagItem = (client.requests[0].schema as typeof ANALYSIS_SCHEMA & {
      properties: { riskFlags: { items: { required: string[] } } };
    }).properties.riskFlags.items;
    expect(riskFlagItem.required).toContain("counterOffer");
  });

  it("fails the whole analysis, naming the flag, when the model omits a Counter-offer", async () => {
    const client = new SidecarModelClient(adhesion, { omitCounterOffer: ["RF-3"] });

    const failure = await analyse(adhesion.text, [], client).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AnalysisResponseError);
    expect((failure as Error).message).toContain("counterOffer is missing");
  });

  it("fails the whole analysis when a Counter-offer is empty or only whitespace", async () => {
    for (const blank of ["", "   \n\t"]) {
      const client = new SidecarModelClient(adhesion, { counterOffers: { "RF-5": blank } });

      const failure = await analyse(adhesion.text, [], client).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(AnalysisResponseError);
      expect((failure as Error).message).toContain("counterOffer is blank");
    }
  });

  it("returns no Counter-offer when its flag's citation fails, not even the ones on flags that passed", async () => {
    const client = new SidecarModelClient(adhesion, (payload) => {
      payload.riskFlags[0].unitId = "u99999";
      return payload;
    });

    const outcome = await analyse(adhesion.text, [], client).then(
      (result) => ({ result }),
      (error: unknown) => ({ error }),
    );
    expect(outcome).not.toHaveProperty("result");
    expect((outcome as { error: unknown }).error).toBeInstanceOf(CitationError);
    expect(JSON.stringify(outcome)).not.toContain(counterOfferFor(flagFor("RF-2")));
  });

  it("keeps each Counter-offer on its own flag after ranking reorders the flags", async () => {
    const client = new SidecarModelClient(adhesion, (payload) => ({
      ...payload,
      riskFlags: payload.riskFlags.map((flag) => ({ ...flag, rank: flag.severityBand === "medium" ? 1 : 9 })),
    }));
    const result = await analyse(adhesion.text, [], client);

    for (const flag of result.riskFlags) {
      const clause = plantedRiskFlags.find((candidate) => candidate.sentence === flag.source.text)!;
      expect(flag.counterOffer).toBe(counterOfferFor(clause));
    }
  });
});

describe("analyse: bounded clauses go to Worth a look, outside the Risk flag ranking", () => {
  const cappedLiability = adhesion.sidecar.plantedClauses.find((clause) => clause.id === "WAL-1")!;
  const cappedUnit = segmentSentences(adhesion.text).find((unit) => unit.text === cappedLiability.sentence)!;

  it("returns the clause with a stated liability cap as Worth a look, and not among the Risk flags", async () => {
    const result = await analyse(adhesion.text, [], new SidecarModelClient(adhesion));

    expect(result.worthALook.map((entry) => entry.source.text)).toEqual([cappedLiability.sentence]);
    expect(result.worthALook[0].kind).toBe("worth-a-look");
    expect(result.riskFlags.map((flag) => flag.source.text)).not.toContain(cappedLiability.sentence);
    expect(result.riskFlags.map((flag) => flag.rank)).toEqual(plantedRiskFlags.map((clause) => clause.expectedRank));
  });

  it("carries no rank, severity band or Counter-offer on a Worth a look entry", async () => {
    const result = await analyse(adhesion.text, [], new SidecarModelClient(adhesion));

    expect(Object.keys(result.worthALook[0]).sort()).toEqual(["claims", "kind", "source", "title"]);
  });

  it("gives Worth a look a Source sentence that is the exact stored text at its offsets", async () => {
    const result = await analyse(adhesion.text, [], new SidecarModelClient(adhesion));
    const [entry] = result.worthALook;

    expect(entry.source).toEqual({ start: cappedUnit.start, end: cappedUnit.end, text: cappedLiability.sentence });
    expect(adhesion.text.slice(entry.source.start, entry.source.end)).toBe(entry.source.text);
  });

  it("returns tiered claims on Worth a look and withholds the ones that need facts about the Signer", async () => {
    const leverageClaim = {
      tier: "needs-signer-facts" as const,
      text: "Two times your fees is a cap your client would accept raising.",
    };
    const client = new SidecarModelClient(adhesion, { extraClaims: { "WAL-1": [leverageClaim] } });
    const result = await analyse(adhesion.text, [], client);

    expect(result.worthALook[0].claims).toEqual([readOffClaimFor(cappedLiability), inferenceClaimFor(cappedLiability)]);
    expect(JSON.stringify(result)).not.toContain(leverageClaim.text);
  });

  it("fails the analysis when every claim on a Worth a look entry is withheld", async () => {
    const client = new SidecarModelClient(adhesion, (payload) => {
      payload.worthALook[0].claims = [{ tier: "needs-signer-facts", text: "A court where you live would cut this cap." }];
      return payload;
    });

    const failure = await analyse(adhesion.text, [], client).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AnalysisResponseError);
    expect((failure as Error).message).toContain(`unit ${cappedUnit.id}`);
  });

  it("throws CitationError when a Worth a look quote differs from the stored sentence", async () => {
    const tampered = cappedLiability.sentence.replace("two times", "three times");
    const client = new SidecarModelClient(adhesion, { worthALookQuotes: { "WAL-1": tampered } });

    const failure = await analyse(adhesion.text, [], client).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(CitationError);
    const citationError = failure as CitationError;
    expect(citationError.failures).toEqual([
      { index: 0, findingType: "worth-a-look", unitId: cappedUnit.id, quote: tampered, reason: "quote-mismatch" },
    ]);
    expect(citationError.passedCount).toBe(citedFindingCount - 1);
  });

  it("throws CitationError when a Worth a look cites a unit id that does not exist", async () => {
    const client = new SidecarModelClient(adhesion, (payload) => {
      payload.worthALook[0].unitId = "u99999";
      return payload;
    });

    const failure = await analyse(adhesion.text, [], client).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(CitationError);
    expect((failure as CitationError).failures).toEqual([
      expect.objectContaining({ findingType: "worth-a-look", unitId: "u99999", reason: "unknown-unit" }),
    ]);
  });

  it("fails the analysis as malformed when the same sentence is cited as a Risk flag and as Worth a look", async () => {
    const client = new SidecarModelClient(adhesion, (payload) => ({
      ...payload,
      riskFlags: [
        ...payload.riskFlags,
        {
          unitId: cappedUnit.id,
          quote: cappedUnit.text,
          title: "Capped warranty liability",
          claims: [{ tier: "read-off", text: "Warranty liability is capped at two times the fees." }],
          severityBand: "medium",
          rank: 7,
          counterOffer: "The Contractor's total liability shall not exceed the fees paid.",
        },
      ],
    }));

    const failure = await analyse(adhesion.text, [], client).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AnalysisResponseError);
    expect((failure as Error).message).toContain(`unit ${cappedUnit.id}`);
  });

  it("fails the analysis when the model's answer has no Worth a look list", async () => {
    const client = new SidecarModelClient(adhesion, (payload) => {
      delete (payload as Partial<typeof payload>).worthALook;
      return payload;
    });

    await expect(analyse(adhesion.text, [], client)).rejects.toBeInstanceOf(AnalysisResponseError);
  });

  it("asks the model for Worth a look as its own required list, with no rank or Counter-offer", async () => {
    const client = new SidecarModelClient(adhesion);
    await analyse(adhesion.text, [], client);

    const schema = client.requests[0].schema as {
      required: string[];
      properties: { worthALook: { items: { required: string[]; properties: Record<string, unknown> } } };
    };
    expect(schema.required).toEqual(expect.arrayContaining(["riskFlags", "worthALook"]));
    const item = schema.properties.worthALook.items;
    expect(item.required).toEqual(expect.arrayContaining(["unitId", "quote", "claims"]));
    expect(Object.keys(item.properties)).not.toContain("rank");
    expect(Object.keys(item.properties)).not.toContain("counterOffer");
    expect(Object.keys(item.properties)).not.toContain("severityBand");
  });

  it("returns no Worth a look for the clean agreement when the model finds none", async () => {
    const result = await analyse(clean.text, [], new SidecarModelClient(clean));
    expect(result.worthALook).toEqual([]);
  });
});

describe("analyse: harm multipliers come back as Multiplier notes, outside the Risk flag ranking", () => {
  const units = segmentSentences(adhesion.text);
  const arbitration = plantedMultiplierNotes.find((clause) => clause.clauseType === "arbitration-class-action-waiver")!;
  const amendment = plantedMultiplierNotes.find((clause) => clause.clauseType === "unilateral-amendment")!;
  const arbitrationUnit = units.find((unit) => unit.text === arbitration.sentence)!;
  const amendmentUnit = units.find((unit) => unit.text === amendment.sentence)!;

  it("returns the arbitration clause as a Multiplier note, and not among the Risk flags or Worth a look", async () => {
    const result = await analyse(adhesion.text, [], new SidecarModelClient(adhesion));

    const note = result.multiplierNotes.find((candidate) => candidate.source.text === arbitration.sentence);
    expect(note).toBeDefined();
    expect(note!.kind).toBe("multiplier-note");
    expect(result.riskFlags.map((flag) => flag.source.text)).not.toContain(arbitration.sentence);
    expect(result.worthALook.map((entry) => entry.source.text)).not.toContain(arbitration.sentence);
    expect(result.riskFlags.map((flag) => flag.rank)).toEqual(plantedRiskFlags.map((clause) => clause.expectedRank));
  });

  it("still returns the arbitration clause as a Multiplier note when the Document has no ranked Risk flags", async () => {
    const result = await analyse(adhesion.text, [], new SidecarModelClient(adhesion, { onlyMultiplierNotes: true }));

    expect(result.riskFlags).toEqual([]);
    expect(result.multiplierNotes.length).toBeGreaterThan(0);
    expect(result.multiplierNotes.map((note) => note.source.text)).toContain(arbitration.sentence);
  });

  it("never returns the unilateral amendment clause among the Risk flags", async () => {
    for (const client of [
      new SidecarModelClient(adhesion),
      new SidecarModelClient(adhesion, { onlyMultiplierNotes: true }),
    ]) {
      const result = await analyse(adhesion.text, [], client);
      expect(result.riskFlags.map((flag) => flag.source.text)).not.toContain(amendment.sentence);
      expect(result.multiplierNotes.map((note) => note.source.text)).toContain(amendment.sentence);
    }
  });

  it("gives every Multiplier note a Source sentence that is the exact stored text at its offsets, in Document order", async () => {
    const result = await analyse(adhesion.text, [], new SidecarModelClient(adhesion));

    expect(result.multiplierNotes.map((note) => note.source)).toEqual(
      [arbitrationUnit, amendmentUnit]
        .sort((a, b) => a.start - b.start)
        .map((unit) => ({ start: unit.start, end: unit.end, text: unit.text })),
    );
    for (const note of result.multiplierNotes) {
      expect(adhesion.text.slice(note.source.start, note.source.end)).toBe(note.source.text);
    }
  });

  it("carries no rank, severity band or Counter-offer on a Multiplier note", async () => {
    const result = await analyse(adhesion.text, [], new SidecarModelClient(adhesion));

    for (const note of result.multiplierNotes) {
      expect(Object.keys(note).sort()).toEqual(["claims", "kind", "source", "title"]);
    }
  });

  it("returns tiered claims on a Multiplier note and withholds the ones that need facts about the Signer", async () => {
    const enforceabilityClaim = {
      tier: "needs-signer-facts" as const,
      text: "A court in your state would not enforce this class-action waiver.",
    };
    const client = new SidecarModelClient(adhesion, { extraClaims: { [arbitration.id]: [enforceabilityClaim] } });
    const result = await analyse(adhesion.text, [], client);

    const note = result.multiplierNotes.find((candidate) => candidate.source.text === arbitration.sentence)!;
    expect(note.claims).toEqual([readOffClaimFor(arbitration), inferenceClaimFor(arbitration)]);
    expect(JSON.stringify(result)).not.toContain(enforceabilityClaim.text);
  });

  it("fails the analysis when every claim on a Multiplier note is withheld", async () => {
    const client = new SidecarModelClient(adhesion, (payload) => {
      const note = payload.multiplierNotes.find((candidate) => candidate.quote === amendment.sentence)!;
      note.claims = [{ tier: "needs-signer-facts", text: "Your client would never use this right." }];
      return payload;
    });

    const failure = await analyse(adhesion.text, [], client).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AnalysisResponseError);
    expect((failure as Error).message).toContain(`unit ${amendmentUnit.id}`);
  });

  it("throws CitationError when a Multiplier note quote differs from the stored sentence", async () => {
    const tampered = arbitration.sentence.replace("Wilmington, Delaware", "Dover, Delaware");
    const client = new SidecarModelClient(adhesion, { multiplierNoteQuotes: { [arbitration.id]: tampered } });

    const failure = await analyse(adhesion.text, [], client).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(CitationError);
    const citationError = failure as CitationError;
    expect(citationError.failures).toEqual([
      expect.objectContaining({ findingType: "multiplier-note", unitId: arbitrationUnit.id, quote: tampered, reason: "quote-mismatch" }),
    ]);
    expect(citationError.passedCount).toBe(citedFindingCount - 1);
  });

  it("names failures across every finding type in one CitationError", async () => {
    const client = new SidecarModelClient(adhesion, (payload) => {
      payload.riskFlags[0].quote += " ";
      payload.worthALook[0].unitId = "u99999";
      payload.multiplierNotes[0].quote = payload.multiplierNotes[0].quote.slice(1);
      return payload;
    });

    const failure = (await analyse(adhesion.text, [], client).catch((error: unknown) => error)) as CitationError;
    expect(failure).toBeInstanceOf(CitationError);
    expect(failure.failures.map((item) => item.findingType).sort()).toEqual(["multiplier-note", "risk-flag", "worth-a-look"]);
    expect(failure.passedCount).toBe(citedFindingCount - 3);
  });

  it("fails the analysis as malformed when the same sentence is cited as a Multiplier note and as a Risk flag", async () => {
    const client = new SidecarModelClient(adhesion, (payload) => ({
      ...payload,
      riskFlags: [
        ...payload.riskFlags,
        {
          unitId: arbitrationUnit.id,
          quote: arbitrationUnit.text,
          title: "Binding individual arbitration",
          claims: [{ tier: "read-off", text: "Every dispute goes to binding individual arbitration." }],
          severityBand: "medium",
          rank: 7,
          counterOffer: "Either party may bring a dispute in a court of competent jurisdiction.",
        },
      ],
    }));

    const failure = await analyse(adhesion.text, [], client).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AnalysisResponseError);
    expect((failure as Error).message).toContain(`unit ${arbitrationUnit.id}`);
  });

  it("fails the analysis as malformed when the same sentence is cited as a Multiplier note and as Worth a look", async () => {
    const client = new SidecarModelClient(adhesion, (payload) => ({
      ...payload,
      worthALook: [
        ...payload.worthALook,
        {
          unitId: amendmentUnit.id,
          quote: amendmentUnit.text,
          title: "The Client can change the terms",
          claims: [{ tier: "read-off", text: "The Client may amend any term by posting it to its portal." }],
        },
      ],
    }));

    const failure = await analyse(adhesion.text, [], client).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AnalysisResponseError);
    expect((failure as Error).message).toContain(`unit ${amendmentUnit.id}`);
  });

  it("fails the analysis when the model's answer has no Multiplier notes list", async () => {
    const client = new SidecarModelClient(adhesion, (payload) => {
      delete (payload as Partial<typeof payload>).multiplierNotes;
      return payload;
    });

    await expect(analyse(adhesion.text, [], client)).rejects.toBeInstanceOf(AnalysisResponseError);
  });

  it("asks the model for Multiplier notes as their own required list, with no rank, band or Counter-offer", async () => {
    const client = new SidecarModelClient(adhesion);
    await analyse(adhesion.text, [], client);

    const schema = client.requests[0].schema as {
      required: string[];
      properties: { multiplierNotes: { items: { required: string[]; properties: Record<string, unknown> } } };
    };
    expect(schema.required).toEqual(expect.arrayContaining(["riskFlags", "worthALook", "multiplierNotes"]));
    const item = schema.properties.multiplierNotes.items;
    expect(item.required).toEqual(expect.arrayContaining(["unitId", "quote", "claims"]));
    for (const field of ["rank", "counterOffer", "severityBand"]) {
      expect(Object.keys(item.properties)).not.toContain(field);
    }
  });

  it("returns no Multiplier notes for the clean agreement when the model finds none", async () => {
    const result = await analyse(clean.text, [], new SidecarModelClient(clean));
    expect(result.multiplierNotes).toEqual([]);
  });
});

describe("analyse: Missing protections cite nothing and sit in their own list", () => {
  const expectedMissing = adhesion.sidecar.expectedMissingProtections!;
  const expectedFor = (kind: string) => expectedMissing.find((expected) => expected.id === kind)!;
  /** The sidecar order with payment timing and amount moved to the front, as the product sorts them. */
  const expectedOrder = [
    "payment-timing",
    "payment-amount",
    ...expectedMissing.map((expected) => expected.id).filter((id) => id !== "payment-timing" && id !== "payment-amount").reverse(),
  ];

  it("yields a payment-timing Missing protection for the adhesion contract, which never says when the Contractor is paid", async () => {
    const result = await analyse(adhesion.text, [], new SidecarModelClient(adhesion));

    const timing = result.missingProtections.find((entry) => entry.protection === "payment-timing");
    expect(timing).toBeDefined();
    expect(timing!.kind).toBe("missing-protection");
    expect(timing!.statement).toBe(statementFor(expectedFor("payment-timing")));
    expect(timing!.proposedInsertion).toBe(proposedInsertionFor(expectedFor("payment-timing")));
  });

  it("returns every expected Missing protection with no source property at all and no unit id", async () => {
    const result = await analyse(adhesion.text, [], new SidecarModelClient(adhesion));

    expect(result.missingProtections.map((entry) => entry.protection).sort()).toEqual(
      expectedMissing.map((expected) => expected.id).sort(),
    );
    for (const entry of result.missingProtections) {
      expect("source" in entry).toBe(false);
      expect("unitId" in entry).toBe(false);
      expect("quote" in entry).toBe(false);
      expect(Object.keys(entry).sort()).toEqual(["claims", "id", "kind", "proposedInsertion", "protection", "statement"]);
    }
  });

  it("puts payment timing and amount first, keeps the model's order for the rest, and numbers them MP-01 onward", async () => {
    const result = await analyse(adhesion.text, [], new SidecarModelClient(adhesion));

    expect(result.missingProtections.map((entry) => entry.protection)).toEqual(expectedOrder);
    expect(result.missingProtections.map((entry) => entry.id)).toEqual(["MP-01", "MP-02", "MP-03", "MP-04", "MP-05"]);
  });

  it("gives every Missing protection a non-blank Proposed insertion drafted for its own kind", async () => {
    const result = await analyse(adhesion.text, [], new SidecarModelClient(adhesion));

    expect(result.missingProtections).toHaveLength(expectedMissing.length);
    for (const entry of result.missingProtections) {
      expect(entry.proposedInsertion.trim()).not.toBe("");
      expect(entry.proposedInsertion).toBe(proposedInsertionFor(expectedFor(entry.protection)));
    }
  });

  it("never merges Missing protections into the Risk flag ranking", async () => {
    const result = await analyse(adhesion.text, [], new SidecarModelClient(adhesion));

    expect(result.riskFlags.map((flag) => flag.rank)).toEqual(plantedRiskFlags.map((clause) => clause.expectedRank));
    for (const flag of result.riskFlags) {
      expect(flag.kind).toBe("risk-flag");
      expect(adhesion.text.slice(flag.source.start, flag.source.end)).toBe(flag.source.text);
    }
  });

  it("returns an inference claim and withholds one that needs facts about the Signer, keeping the entry", async () => {
    const leverageClaim = {
      tier: "needs-signer-facts" as const,
      text: "In your state, unpaid invoices can be recovered in small claims court within thirty days.",
    };
    const client = new SidecarModelClient(adhesion, (payload) => {
      payload.missingProtections.forEach((entry) => entry.claims.push(leverageClaim));
      return payload;
    });
    const result = await analyse(adhesion.text, [], client);

    for (const entry of result.missingProtections) {
      expect(entry.claims).toEqual([inferenceClaimForAbsence(expectedFor(entry.protection))]);
    }
    expect(JSON.stringify(result)).not.toContain(leverageClaim.text);
    expect(result.missingProtections).toHaveLength(expectedMissing.length);
  });

  it("fails as malformed when a Missing protection's claim is tagged read-off, since there is no sentence", async () => {
    const client = new SidecarModelClient(adhesion, (payload) => {
      payload.missingProtections[0].claims = [{ tier: "read-off", text: "The agreement never says when you are paid." }];
      return payload;
    });

    const failure = await analyse(adhesion.text, [], client).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AnalysisResponseError);
    expect((failure as Error).message).toContain("read-off");
  });

  it("fails the whole analysis when a Proposed insertion is empty or only whitespace", async () => {
    for (const blank of ["", "  \n\t"]) {
      const client = new SidecarModelClient(adhesion, { proposedInsertions: { "kill-fee": blank } });

      const failure = await analyse(adhesion.text, [], client).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(AnalysisResponseError);
      expect((failure as Error).message).toContain("proposedInsertion is blank");
    }
  });

  it("fails the whole analysis when a Proposed insertion is missing", async () => {
    const client = new SidecarModelClient(adhesion, (payload) => {
      delete (payload.missingProtections[2] as { proposedInsertion?: string }).proposedInsertion;
      return payload;
    });

    const failure = await analyse(adhesion.text, [], client).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AnalysisResponseError);
    expect((failure as Error).message).toContain("proposedInsertion is missing");
  });

  it("fails the whole analysis when the same protection kind comes back twice", async () => {
    const client = new SidecarModelClient(adhesion, { duplicateProtections: ["payment-timing"] });

    const failure = await analyse(adhesion.text, [], client).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AnalysisResponseError);
    expect((failure as Error).message).toContain("payment-timing is a duplicate");
  });

  it("fails the whole analysis when a Missing protection carries a unit id, rather than showing it as cited", async () => {
    const client = new SidecarModelClient(adhesion, { attachUnitIdTo: ["late-payment-remedy"] });

    const failure = await analyse(adhesion.text, [], client).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AnalysisResponseError);
    expect((failure as Error).message).toContain("unitId");
    expect(failure).not.toBeInstanceOf(CitationError);
  });

  it("fails the whole analysis when a Missing protection carries only a quote", async () => {
    const client = new SidecarModelClient(adhesion, (payload) => {
      payload.missingProtections[1].quote = segmentSentences(adhesion.text)[0].text;
      return payload;
    });

    const failure = await analyse(adhesion.text, [], client).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AnalysisResponseError);
    expect((failure as Error).message).toContain("quote");
  });

  it("fails the whole analysis when a protection kind is not one of the five", async () => {
    const client = new SidecarModelClient(adhesion, (payload) => {
      payload.missingProtections[0].protection = "confidentiality";
      return payload;
    });

    await expect(analyse(adhesion.text, [], client)).rejects.toBeInstanceOf(AnalysisResponseError);
  });

  it("fails the analysis when the model's answer has no Missing protections list", async () => {
    const client = new SidecarModelClient(adhesion, (payload) => {
      delete (payload as Partial<typeof payload>).missingProtections;
      return payload;
    });

    await expect(analyse(adhesion.text, [], client)).rejects.toBeInstanceOf(AnalysisResponseError);
  });

  it("leaves the Document text byte-identical: nothing is inserted, numbered or rewritten", async () => {
    const onDisk = readFileSync(join(__dirname, "..", "fixtures", "adhesion-contract.txt"));
    const documentText = onDisk.toString("utf8");
    const before = `${documentText}`.slice(0);
    const result = await analyse(documentText, [], new SidecarModelClient(adhesion));

    expect(Buffer.from(documentText, "utf8").equals(onDisk)).toBe(true);
    expect(documentText).toBe(before);
    expect(result.missingProtections.length).toBeGreaterThan(0);
    for (const entry of result.missingProtections) {
      expect(documentText).not.toContain(entry.proposedInsertion);
    }
    // Every cited finding still points at the original offsets of the untouched text.
    for (const cited of [...result.riskFlags, ...result.worthALook, ...result.multiplierNotes]) {
      expect(onDisk.toString("utf8").slice(cited.source.start, cited.source.end)).toBe(cited.source.text);
    }
  });

  it("returns no Missing protections for the clean agreement, which addresses all five", async () => {
    const result = await analyse(clean.text, [], new SidecarModelClient(clean));
    expect(result.missingProtections).toEqual([]);
    for (const present of (clean.sidecar as unknown as { presentProtections: { sentence: string }[] }).presentProtections) {
      expect(clean.text).toContain(present.sentence);
    }
  });

  it("asks the model for Missing protections as their own required list with no unit id or quote", async () => {
    const client = new SidecarModelClient(adhesion);
    await analyse(adhesion.text, [], client);

    const schema = client.requests[0].schema as {
      required: string[];
      properties: {
        missingProtections: {
          items: { required: string[]; additionalProperties: boolean; properties: { protection: { enum: string[] } } };
        };
      };
    };
    expect(schema.required).toContain("missingProtections");
    const item = schema.properties.missingProtections.items;
    expect(item.required).toEqual(expect.arrayContaining(["protection", "statement", "proposedInsertion"]));
    expect(item.additionalProperties).toBe(false);
    for (const field of ["unitId", "quote", "source", "rank"]) {
      expect(Object.keys(item.properties)).not.toContain(field);
    }
    expect(item.properties.protection.enum).toEqual(
      expect.arrayContaining(["payment-timing", "payment-amount", "kill-fee", "late-payment-remedy", "scope-revision-limits"]),
    );
  });

  it("cannot express a Missing protection with a Source sentence, or a Risk flag without one (checked by tsc)", () => {
    const protection: MissingProtection = {
      kind: "missing-protection",
      id: "MP-01",
      protection: "payment-timing",
      statement: "The agreement never says when the Contractor is paid.",
      claims: [],
      proposedInsertion: "The Client shall pay each invoice within [number] days.",
      // @ts-expect-error A Missing protection has no source field.
      source: { start: 0, end: 1, text: "F" },
    };
    // @ts-expect-error A Risk flag without a source is not a Risk flag.
    const uncited: RiskFlag = {
      kind: "risk-flag",
      rank: 1,
      severityBand: "high",
      title: "Uncited",
      claims: [{ tier: "read-off", text: "No sentence." }],
      counterOffer: "Replacement wording.",
    };
    expect("source" in protection).toBe(true);
    expect("source" in uncited).toBe(false);
  });
});
