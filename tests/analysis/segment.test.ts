import { describe, expect, it } from "vitest";
import { segmentSentences } from "../../lib/analysis/segment";
import { loadFixture } from "../support/sidecar-model-client";

const fixtures = [loadFixture("adhesion-contract"), loadFixture("clean-agreement")];

describe("segmentSentences", () => {
  it("gives each planted sentence as exactly one unit", () => {
    const { text, sidecar } = fixtures[0];
    const units = segmentSentences(text);
    for (const clause of sidecar.plantedClauses) {
      const matches = units.filter((unit) => unit.text === clause.sentence);
      expect(matches, `${clause.id} should be one whole unit`).toHaveLength(1);
    }
  });

  it("keeps every unit's text identical to the stored slice at its offsets", () => {
    for (const { text, sidecar } of fixtures) {
      const units = segmentSentences(text);
      expect(units.length, sidecar.document).toBeGreaterThan(20);
      for (const unit of units) {
        expect(unit.text).toBe(text.slice(unit.start, unit.end));
      }
    }
  });

  it("gives units unique ids, in document order, without overlap", () => {
    for (const { text } of fixtures) {
      const units = segmentSentences(text);
      expect(new Set(units.map((unit) => unit.id)).size).toBe(units.length);
      for (let index = 1; index < units.length; index++) {
        expect(units[index].start).toBeGreaterThanOrEqual(units[index - 1].end);
      }
    }
  });

  it("drops no text: everything outside the units is whitespace", () => {
    for (const { text } of fixtures) {
      let covered = "";
      let cursor = 0;
      for (const unit of segmentSentences(text)) {
        covered += text.slice(cursor, unit.start).replace(/\s/g, "") + unit.text;
        cursor = unit.end;
      }
      covered += text.slice(cursor).replace(/\s/g, "");
      expect(covered.replace(/\s/g, "")).toBe(text.replace(/\s/g, ""));
      expect(text.slice(cursor).trim()).toBe("");
    }
  });

  it("keeps irregular whitespace inside a unit and never starts or ends a unit on whitespace", () => {
    const { text } = fixtures[0];
    const units = segmentSentences(text);
    expect(units.some((unit) => unit.text.includes("make  itself"))).toBe(true);
    for (const unit of units) {
      expect(unit.text).toBe(unit.text.trim());
    }
  });

  it("splits sentences on one line but not at abbreviations", () => {
    const text = "Fees are due, e.g. monthly.  The U.S. courts apply.\n\tSee Schedule A. It lists the work.";
    expect(segmentSentences(text).map((unit) => unit.text)).toEqual([
      "Fees are due, e.g. monthly.",
      "The U.S. courts apply.",
      "See Schedule A.",
      "It lists the work.",
    ]);
  });

  it("handles Windows line endings without putting a carriage return in a unit", () => {
    const text = "HEADING\r\n\r\nFirst sentence. Second one.\r\n";
    const units = segmentSentences(text);
    expect(units.map((unit) => unit.text)).toEqual(["HEADING", "First sentence.", "Second one."]);
    for (const unit of units) expect(text.slice(unit.start, unit.end)).toBe(unit.text);
  });
});
