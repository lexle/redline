import { describe, expect, it } from "vitest";
import { segmentDocument, SpanRangeError } from "../../lib/document/segments";
import { loadFixture } from "../support/sidecar-model-client";

const adhesion = loadFixture("adhesion-contract");
const repeated = (adhesion.sidecar as unknown as { repeatedSentence: string }).repeatedSentence;
const firstAt = adhesion.text.indexOf(repeated);
const secondAt = adhesion.text.indexOf(repeated, firstAt + 1);

function joined(segments: { text: string }[]): string {
  return segments.map((segment) => segment.text).join("");
}

describe("segmentDocument", () => {
  it("covers the stored Document text byte for byte, irregular whitespace included", () => {
    const planted = adhesion.sidecar.plantedClauses.map((clause) => {
      const start = adhesion.text.indexOf(clause.sentence);
      return { id: clause.id, start, end: start + clause.sentence.length };
    });
    const segments = segmentDocument(adhesion.text, planted);

    expect(joined(segments)).toBe(adhesion.text);
    expect(Buffer.from(joined(segments), "utf8").equals(Buffer.from(adhesion.text, "utf8"))).toBe(true);
    for (const segment of segments) {
      expect(adhesion.text.slice(segment.start, segment.end)).toBe(segment.text);
    }
    for (let index = 1; index < segments.length; index += 1) {
      expect(segments[index].start).toBe(segments[index - 1].end);
    }
    for (const span of planted) {
      const covered = segments.filter((segment) => segment.spanIds.includes(span.id));
      expect(joined(covered)).toBe(adhesion.text.slice(span.start, span.end));
    }
  });

  it("highlights each occurrence of a repeated sentence at its own offsets", () => {
    expect(firstAt).toBeGreaterThanOrEqual(0);
    expect(secondAt).toBeGreaterThan(firstAt);
    const segments = segmentDocument(adhesion.text, [
      { id: "second", start: secondAt, end: secondAt + repeated.length },
      { id: "first", start: firstAt, end: firstAt + repeated.length },
    ]);

    const first = segments.filter((segment) => segment.spanIds.includes("first"));
    const second = segments.filter((segment) => segment.spanIds.includes("second"));
    expect(first.map(({ start, end, text }) => ({ start, end, text }))).toEqual([
      { start: firstAt, end: firstAt + repeated.length, text: repeated },
    ]);
    expect(second.map(({ start, end, text }) => ({ start, end, text }))).toEqual([
      { start: secondAt, end: secondAt + repeated.length, text: repeated },
    ]);
    expect(joined(segments)).toBe(adhesion.text);
  });

  it("splits overlapping spans without repeating or dropping text", () => {
    const text = "The Client may amend. The Contractor accepts.";
    const segments = segmentDocument(text, [
      { id: "a", start: 4, end: 20 },
      { id: "b", start: 11, end: 36 },
      { id: "c", start: 0, end: text.length },
    ]);

    expect(joined(segments)).toBe(text);
    expect(segments.map(({ start, end, spanIds }) => ({ start, end, spanIds }))).toEqual([
      { start: 0, end: 4, spanIds: ["c"] },
      { start: 4, end: 11, spanIds: ["a", "c"] },
      { start: 11, end: 20, spanIds: ["a", "b", "c"] },
      { start: 20, end: 36, spanIds: ["b", "c"] },
      { start: 36, end: text.length, spanIds: ["c"] },
    ]);
  });

  it("keeps adjacent spans apart without a gap or a shared character", () => {
    const text = "One sentence.Two sentence.";
    const segments = segmentDocument(text, [
      { id: "one", start: 0, end: 13 },
      { id: "two", start: 13, end: 26 },
    ]);

    expect(segments.map(({ text: part, spanIds }) => ({ part, spanIds }))).toEqual([
      { part: "One sentence.", spanIds: ["one"] },
      { part: "Two sentence.", spanIds: ["two"] },
    ]);
  });

  it("returns the text as one unmarked segment when nothing is cited", () => {
    expect(segmentDocument("  line\r\n\tnext  ", [])).toEqual([
      { start: 0, end: 15, text: "  line\r\n\tnext  ", spanIds: [] },
    ]);
  });

  it("throws for spans outside the text, reversed, or not whole offsets", () => {
    const text = "Short text.";
    expect(() => segmentDocument(text, [{ id: "past", start: 5, end: 12 }])).toThrow(SpanRangeError);
    expect(() => segmentDocument(text, [{ id: "before", start: -1, end: 3 }])).toThrow(SpanRangeError);
    expect(() => segmentDocument(text, [{ id: "reversed", start: 6, end: 2 }])).toThrow(/reversed \[6, 2\)/);
    expect(() => segmentDocument(text, [{ id: "fraction", start: 1.5, end: 3 }])).toThrow(SpanRangeError);
    expect(() =>
      segmentDocument(text, [
        { id: "fine", start: 0, end: 5 },
        { id: "bad", start: 0, end: 99 },
      ]),
    ).toThrow(/bad \[0, 99\)/);
  });
});
