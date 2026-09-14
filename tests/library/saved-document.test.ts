import { beforeAll, describe, expect, it } from "vitest";
import { analyse } from "../../lib/analysis/analyse";
import type { AnalysisResult } from "../../lib/analysis/types";
import { buildSavedDocument, MAX_TITLE_LENGTH, titleForDocument } from "../../lib/library/payload";
import type { SavedDocumentPayload } from "../../lib/library/payload";
import { CitationError, reopenSavedDocument, StoredDocumentError } from "../../lib/library/reopen";
import { loadFixture, SidecarModelClient } from "../support/sidecar-model-client";
import type { Fixture } from "../support/sidecar-model-client";

const adhesion = loadFixture("adhesion-contract");

/** The adhesion contract with every line break written as CRLF, as a Windows-saved .txt would be. */
const adhesionCrlf: Fixture = { ...adhesion, text: adhesion.text.replace(/\r?\n/g, "\r\n") };

const plantedRiskFlags = adhesion.sidecar.plantedClauses.filter((clause) => clause.findingType === "risk-flag");

/** A row as the database hands it back: the payload through JSON, plus the columns the database fills in. */
function storedRow(payload: SavedDocumentPayload, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...JSON.parse(JSON.stringify(payload)),
    id: "3f1c2b9e-7a44-4d0b-9a8e-2c5d1e6f7a80",
    created_at: "2026-09-14T12:30:00.000+00:00",
    ...overrides,
  };
}

function allSpans(result: AnalysisResult) {
  return [
    ...result.summary.flatMap((sentence) => sentence.sources),
    ...result.riskFlags.map((flag) => flag.source),
    ...result.worthALook.map((entry) => entry.source),
    ...result.multiplierNotes.map((entry) => entry.source),
    ...result.checklist.flatMap((item) => ("source" in item ? [item.source] : [])),
  ];
}

let result: AnalysisResult;
let crlfResult: AnalysisResult;

beforeAll(async () => {
  result = await analyse(adhesion.text, [], new SidecarModelClient(adhesion));
  crlfResult = await analyse(adhesionCrlf.text, [], new SidecarModelClient(adhesionCrlf));
});

describe("the payload saved for an analysed Document", () => {
  it("holds the text byte for byte, the result, and the Risk flag count, and nothing else", () => {
    const payload = buildSavedDocument("adhesion-contract.txt", adhesion.text, result);

    expect(Object.keys(payload).sort()).toEqual(["result", "risk_flag_count", "text", "title"]);
    expect(payload.text).toBe(adhesion.text);
    expect(Buffer.from(payload.text, "utf8").equals(Buffer.from(adhesion.text, "utf8"))).toBe(true);
    expect(payload.result).toEqual(result);
    expect(payload.risk_flag_count).toBe(result.riskFlags.length);
    expect(payload.risk_flag_count).toBe(plantedRiskFlags.length);
    expect(payload.title).toBe("adhesion-contract.txt");
  });

  it("keeps CRLF line breaks exactly as analysed", () => {
    const payload = buildSavedDocument("adhesion-contract.txt", adhesionCrlf.text, crlfResult);

    expect(adhesionCrlf.text).toContain("\r\n");
    expect(payload.text).toBe(adhesionCrlf.text);
    expect(payload.text.split("\r\n").length).toBe(adhesionCrlf.text.split("\r\n").length);
    expect(payload.risk_flag_count).toBe(crlfResult.riskFlags.length);
  });

  it("refuses to save a result whose quotes don't match the text, so nothing unreopenable is stored", () => {
    expect(() => buildSavedDocument("crlf mix-up", adhesionCrlf.text, result)).toThrow(CitationError);
  });

  it("refuses a blank or overlong title, and cuts a long file name to fit", () => {
    expect(() => buildSavedDocument("   ", adhesion.text, result)).toThrow(RangeError);
    expect(() => buildSavedDocument("x".repeat(MAX_TITLE_LENGTH + 1), adhesion.text, result)).toThrow(RangeError);
    const long = `${"é".repeat(MAX_TITLE_LENGTH + 40)}.pdf`;
    expect(Array.from(titleForDocument(long))).toHaveLength(MAX_TITLE_LENGTH);
    expect(buildSavedDocument(titleForDocument(long), adhesion.text, result).title).toBe("é".repeat(MAX_TITLE_LENGTH));
  });
});

describe("reopening a saved Document", () => {
  it("gives back the stored text and result, with every span still word for word the stored text", () => {
    for (const [text, analysed] of [
      [adhesion.text, result],
      [adhesionCrlf.text, crlfResult],
    ] as const) {
      const reopened = reopenSavedDocument(storedRow(buildSavedDocument("saved", text, analysed)));

      expect(reopened.text).toBe(text);
      expect(reopened.result).toEqual(analysed);
      expect(reopened.createdAt).toBe("2026-09-14T12:30:00.000+00:00");
      const spans = allSpans(reopened.result);
      expect(spans.length).toBeGreaterThan(plantedRiskFlags.length);
      for (const span of spans) expect(reopened.text.slice(span.start, span.end)).toBe(span.text);
    }
  });

  it("throws CitationError when one character of the stored text has changed inside a Source sentence", () => {
    const payload = buildSavedDocument("saved", adhesion.text, result);
    const flag = result.riskFlags[0];
    const at = flag.source.start + 4;
    const replacement = adhesion.text[at] === "X" ? "Y" : "X";
    const tampered = adhesion.text.slice(0, at) + replacement + adhesion.text.slice(at + 1);
    expect(tampered.length).toBe(adhesion.text.length);

    let thrown: unknown;
    try {
      reopenSavedDocument(storedRow(payload, { text: tampered }));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(CitationError);
    const failures = (thrown as CitationError).failures;
    expect(failures).toContainEqual(expect.objectContaining({ findingType: "risk-flag", index: 0, reason: "quote-mismatch" }));
  });

  it("throws CitationError when a summary sentence's stored quote was altered", () => {
    const row = storedRow(buildSavedDocument("saved", adhesion.text, result));
    const summary = (row.result as { summary: { sources: { text: string }[] }[] }).summary;
    summary[0].sources[0].text = summary[0].sources[0].text.replace(/\.$/, " without limit.");

    let thrown: unknown;
    try {
      reopenSavedDocument(row);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(CitationError);
    expect((thrown as CitationError).failures).toEqual([
      expect.objectContaining({ findingType: "summary-sentence", index: 0, spanIndex: 0, reason: "quote-mismatch" }),
    ]);
  });

  it("throws CitationError when a checklist item's quote points past the end of a shortened text", () => {
    const row = storedRow(buildSavedDocument("saved", adhesion.text, result));
    const lastSpanEnd = Math.max(...allSpans(result).map((span) => span.end));
    expect(() => reopenSavedDocument({ ...row, text: adhesion.text.slice(0, lastSpanEnd - 1) })).toThrow(CitationError);
  });

  it("fails as malformed when the stored result has no Risk flags list", () => {
    const row = storedRow(buildSavedDocument("saved", adhesion.text, result));
    delete (row.result as Record<string, unknown>).riskFlags;
    expect(() => reopenSavedDocument(row)).toThrow(StoredDocumentError);
  });

  it("fails as malformed when a Risk flag has lost its Source sentence", () => {
    const row = storedRow(buildSavedDocument("saved", adhesion.text, result));
    delete (row.result as { riskFlags: Record<string, unknown>[] }).riskFlags[2].source;
    expect(() => reopenSavedDocument(row)).toThrow(StoredDocumentError);
  });

  it("fails as malformed when a Missing protection carries a citation, or a citation sits outside any finding", () => {
    const withCitedAbsence = storedRow(buildSavedDocument("saved", adhesion.text, result));
    const absence = (withCitedAbsence.result as { missingProtections: Record<string, unknown>[] }).missingProtections[0];
    expect(absence).toBeDefined();
    absence.source = result.riskFlags[0].source;
    expect(() => reopenSavedDocument(withCitedAbsence)).toThrow(StoredDocumentError);

    const withStrayCitation = storedRow(buildSavedDocument("saved", adhesion.text, result));
    const claim = (withStrayCitation.result as { riskFlags: { claims: Record<string, unknown>[] }[] }).riskFlags[0].claims[0];
    claim.source = result.riskFlags[0].source;
    expect(() => reopenSavedDocument(withStrayCitation)).toThrow(StoredDocumentError);
  });

  it("fails as malformed when the stored Risk flag count disagrees with the result", () => {
    const row = storedRow(buildSavedDocument("saved", adhesion.text, result), { risk_flag_count: 0 });
    expect(() => reopenSavedDocument(row)).toThrow(StoredDocumentError);
  });
});
