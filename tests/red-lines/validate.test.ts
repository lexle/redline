import { describe, expect, it } from "vitest";
import { checkRedLineText, MAX_RED_LINE_LENGTH } from "../../lib/red-lines/validate";

describe("checkRedLineText", () => {
  it("refuses an empty or whitespace-only red line", () => {
    expect(checkRedLineText("")).toEqual({ ok: false, problem: "blank" });
    expect(checkRedLineText(" \n\t ")).toEqual({ ok: false, problem: "blank" });
  });

  it("refuses a red line over the limit and says how long it is", () => {
    expect(checkRedLineText("a".repeat(MAX_RED_LINE_LENGTH + 1))).toEqual({
      ok: false,
      problem: "too-long",
      length: MAX_RED_LINE_LENGTH + 1,
    });
  });

  it("counts characters, not UTF-16 units, so the limit matches the database", () => {
    const emoji = "🚫".repeat(MAX_RED_LINE_LENGTH);
    expect(emoji.length).toBe(MAX_RED_LINE_LENGTH * 2);
    expect(checkRedLineText(emoji)).toEqual({ ok: true, text: emoji });
  });

  it("keeps an accepted red line exactly as written, spaces and all", () => {
    const text = "  No personal guarantee,  ever.\n";
    expect(checkRedLineText(text)).toEqual({ ok: true, text });
    const atLimit = "b".repeat(MAX_RED_LINE_LENGTH);
    expect(checkRedLineText(atLimit)).toEqual({ ok: true, text: atLimit });
  });
});
