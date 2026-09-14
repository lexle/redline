import { describe, expect, it } from "vitest";
import { analyse } from "../../lib/analysis/analyse";
import { segmentSentences } from "../../lib/analysis/segment";
import type { AnalysisResult, RiskFlag } from "../../lib/analysis/types";
import {
  buildMarkedUpCopy,
  ExportCitationError,
  markedUpCopyFileName,
  stripMarkedUpCopy,
} from "../../lib/export/marked-up-copy";
import { loadFixture, SidecarModelClient, type Fixture, type ModelPayload } from "../support/sidecar-model-client";

const adhesion = loadFixture("adhesion-contract");
const repeated = (adhesion.sidecar as unknown as { repeatedSentence: string }).repeatedSentence;

/** Adds a Nice to have, since the adhesion sidecar plans none. */
function withNiceToHave(payload: ModelPayload): ModelPayload {
  return {
    ...payload,
    niceToHave: [
      ...payload.niceToHave,
      {
        protection: "portfolio-rights",
        statement: "The agreement does not say whether the Contractor may show the work in a portfolio.",
        claims: [],
        proposedInsertion: "The Contractor may show the Deliverables in a portfolio once they are public.",
      },
    ],
  };
}

async function realResult(fixture: Fixture = adhesion, tamper = withNiceToHave): Promise<AnalysisResult> {
  return analyse(fixture.text, [], new SidecarModelClient(fixture, tamper));
}

function markersOf(exported: string) {
  const plus = /^\[(\++) /.exec(exported)![1];
  return { open: `[${plus}`, close: `${plus}]` };
}

/** Where the block starting with `label` begins, as an offset into the stored text. */
function documentOffsetOfBlock(exported: string, label: string): number {
  const { open } = markersOf(exported);
  const at = exported.indexOf(`${open} ${label}`);
  expect(at, `block "${label}"`).toBeGreaterThan(0);
  expect(exported.indexOf(`${open} ${label}`, at + 1), `block "${label}" appears once`).toBe(-1);
  return stripMarkedUpCopy(exported.slice(0, at)).length;
}

function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function expectEveryFlagAtItsOffsets(exported: string, flags: readonly RiskFlag[]) {
  const { close } = markersOf(exported);
  for (const flag of flags) {
    expect(documentOffsetOfBlock(exported, `Risk flag ${flag.rank} (`)).toBe(flag.source.start);
    expect(documentOffsetOfBlock(exported, `Original clause for risk flag ${flag.rank} ends.`)).toBe(flag.source.end);
    const closingAt = exported.indexOf(`Original clause for risk flag ${flag.rank} ends.`);
    const closingEnd = exported.indexOf(close, closingAt);
    expect(exported.slice(closingAt, closingEnd)).toContain(flag.counterOffer);
  }
}

describe("buildMarkedUpCopy", () => {
  it("includes every Counter-offer after its own flag's clause and every Proposed insertion", async () => {
    const result = await realResult();
    expect(result.riskFlags.length).toBeGreaterThan(1);
    expect(result.missingProtections.length).toBeGreaterThan(0);
    expect(result.niceToHave.length).toBe(1);
    const exported = buildMarkedUpCopy(adhesion.text, result, "adhesion-contract.txt");

    expectEveryFlagAtItsOffsets(exported, result.riskFlags);
    for (const flag of result.riskFlags) {
      const opening = exported.indexOf(`Risk flag ${flag.rank} (`);
      const sentence = exported.indexOf(flag.source.text, opening);
      expect(exported.indexOf(flag.counterOffer, sentence)).toBeGreaterThan(sentence);
    }

    const endSection = exported.lastIndexOf("Proposed insertions.");
    expect(endSection).toBeGreaterThan(stripMarkedUpCopy(exported).length);
    for (const entry of [...result.missingProtections, ...result.niceToHave]) {
      const at = exported.indexOf(entry.proposedInsertion);
      expect(at).toBeGreaterThan(endSection);
      expect(exported.slice(0, at)).toMatch(/Proposed insertion, not in the original document:\n$/);
    }
    expect(exported.startsWith("[+++ Marked-up copy of adhesion-contract.txt, from Redline.")).toBe(true);
  });

  it("gives back the stored text byte for byte once the markers are removed", async () => {
    const result = await realResult();
    const exported = buildMarkedUpCopy(adhesion.text, result, "adhesion-contract.txt");
    expect(exported).not.toBe(adhesion.text);
    expect(stripMarkedUpCopy(exported)).toBe(adhesion.text);
  });

  it("leaves the stored text and the result unchanged", async () => {
    const result = await realResult();
    const textBefore = `${adhesion.text}`;
    const resultBefore = structuredClone(result);
    buildMarkedUpCopy(adhesion.text, result, "adhesion-contract.txt");
    expect(adhesion.text).toBe(textBefore);
    expect(result).toEqual(resultBefore);
  });

  it("marks the second occurrence of a repeated sentence when the flag points there", async () => {
    const occurrences = segmentSentences(adhesion.text).filter((unit) => unit.text === repeated);
    expect(occurrences).toHaveLength(2);
    const [first, second] = occurrences;
    const result = await realResult(adhesion, (payload) =>
      withNiceToHave({
        ...payload,
        riskFlags: payload.riskFlags.map((flag) => (flag.rank === 1 ? { ...flag, unitId: second.id, quote: second.text } : flag)),
      }),
    );
    const flag = result.riskFlags.find((candidate) => candidate.rank === 1)!;
    expect(flag.source.start).toBe(second.start);

    const exported = buildMarkedUpCopy(adhesion.text, result, "adhesion-contract.txt");
    expect(documentOffsetOfBlock(exported, "Risk flag 1 (")).toBe(second.start);
    expect(documentOffsetOfBlock(exported, "Risk flag 1 (")).not.toBe(first.start);
    expect(countOf(exported, repeated)).toBe(countOf(adhesion.text, repeated));
    expect(stripMarkedUpCopy(exported)).toBe(adhesion.text);
  });

  it("neither repeats nor drops text for overlapping and identical spans", async () => {
    const base = await realResult();
    const [one, two] = [...base.riskFlags].sort((a, b) => a.rank - b.rank);
    const overlapStart = one.source.start + 10;
    const overlapEnd = one.source.end + 25;
    const overlapping: RiskFlag = {
      ...two,
      source: { start: overlapStart, end: overlapEnd, text: adhesion.text.slice(overlapStart, overlapEnd) },
    };
    const identical: RiskFlag = { ...one, rank: 99, counterOffer: "A second proposed wording for the same clause." };
    const result: AnalysisResult = {
      ...base,
      riskFlags: [one, overlapping, identical, ...base.riskFlags.filter((flag) => flag !== one && flag !== two)],
    };

    const exported = buildMarkedUpCopy(adhesion.text, result, "adhesion-contract.txt");
    expect(stripMarkedUpCopy(exported)).toBe(adhesion.text);
    expectEveryFlagAtItsOffsets(exported, result.riskFlags);
    expect(countOf(exported, adhesion.text.slice(one.source.start, overlapStart))).toBe(
      countOf(adhesion.text, adhesion.text.slice(one.source.start, overlapStart)),
    );
    for (const flag of result.riskFlags) expect(countOf(exported, flag.counterOffer)).toBe(1);
  });

  it("still round-trips when the Document and a Counter-offer contain the marker strings", async () => {
    const text = `Clause marks like [+++ this +++] and [++++ this ++++] are part of the document.\n\n${adhesion.text}`;
    const fixture: Fixture = { ...adhesion, text };
    const result = await realResult(fixture, (payload) =>
      withNiceToHave({
        ...payload,
        riskFlags: payload.riskFlags.map((flag, index) =>
          index === 0 ? { ...flag, counterOffer: `${flag.counterOffer} [+++++ +++++]` } : flag,
        ),
      }),
    );
    const exported = buildMarkedUpCopy(text, result, "odd [+++].txt");

    expect(exported.startsWith("[++++++ ")).toBe(true);
    expect(stripMarkedUpCopy(exported)).toBe(text);
    expectEveryFlagAtItsOffsets(exported, result.riskFlags);
  });

  it("keeps a CRLF Document's CRLF line endings and writes its own lines the same way", async () => {
    const text = adhesion.text.replace(/\n/g, "\r\n");
    const fixture: Fixture = { ...adhesion, text };
    const result = await realResult(fixture);
    const exported = buildMarkedUpCopy(text, result, "adhesion-contract.txt");

    expect(stripMarkedUpCopy(exported)).toBe(text);
    expect(exported).toContain("\r\n");
    expect(/(^|[^\r])\n/.test(exported)).toBe(false);
    expectEveryFlagAtItsOffsets(exported, result.riskFlags);
  });

  it("keeps LF line endings for an LF Document", async () => {
    const result = await realResult();
    expect(buildMarkedUpCopy(adhesion.text, result).includes("\r")).toBe(false);
  });

  it("refuses a Risk flag whose offsets do not point at its Source sentence", async () => {
    const result = await realResult();
    const [flag, ...rest] = result.riskFlags;
    const shifted: AnalysisResult = {
      ...result,
      riskFlags: [{ ...flag, source: { ...flag.source, start: flag.source.start + 1, end: flag.source.end + 1 } }, ...rest],
    };
    expect(() => buildMarkedUpCopy(adhesion.text, shifted)).toThrow(ExportCitationError);
  });
});

describe("markedUpCopyFileName", () => {
  it("names the file after the Document", () => {
    expect(markedUpCopyFileName("adhesion-contract.txt")).toBe("adhesion-contract-marked-up.txt");
    expect(markedUpCopyFileName("Lease 2026.pdf")).toBe("Lease-2026-marked-up.txt");
    expect(markedUpCopyFileName("your pasted document")).toBe("your-pasted-document-marked-up.txt");
  });
});
