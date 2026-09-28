import { describe, expect, it } from "vitest";
import { asciiJsonString, unitLine } from "../../lib/analysis/parts";
import { buildAnalysisRequest } from "../../lib/analysis/prompt";
import { segmentSentences } from "../../lib/analysis/segment";

// Typeset text as PDFs and Word files deliver it: curly quotes, a non-breaking space, a soft
// hyphen, a ligature and a character outside the Basic Multilingual Plane.
const TYPESET = "The “Fee” is due within 30 days of in­voicing, per the ﬁnal schedule \u{1F4C4}.";

describe("the prompt shows every unit in plain ASCII", () => {
  it("escapes every character outside printable ASCII", () => {
    const shown = asciiJsonString(TYPESET);

    expect(shown).toMatch(/^[\x20-\x7e]+$/);
    expect(shown).toContain("\\u201cFee\\u201d");
    expect(shown).toContain("30\\u00a0days");
    expect(shown).toContain("in\\u00advoicing");
    expect(shown).toContain("\\ufb01nal");
  });

  it("decodes back to exactly the stored text, so a copied escape passes the verbatim check", () => {
    for (const text of [TYPESET, 'Plain "quoted" text with a \\ backslash.', "Line one\nline two\ttabbed."]) {
      expect(JSON.parse(asciiJsonString(text))).toBe(text);
    }
  });

  it("is what the analysis request carries for each unit", () => {
    const [unit] = segmentSentences(TYPESET);
    const request = buildAnalysisRequest([unit], []);

    expect(unitLine(unit)).toBe(`[${unit.id}] ${asciiJsonString(unit.text)}`);
    expect(request.user).toContain(unitLine(unit));
    expect(request.user).not.toContain("“");
  });
});
