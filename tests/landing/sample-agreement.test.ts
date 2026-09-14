import { describe, expect, it } from "vitest";
import { clauses, flags, splitClause } from "../../app/_landing/sample-agreement";

describe("landing sample agreement", () => {
  it("quotes every sample flag word for word from the clause it points at", () => {
    for (const flag of flags) {
      const clause = clauses.find((candidate) => candidate.number === flag.clause);
      expect(clause, `flag ${flag.rank} points at a missing clause`).toBeDefined();
      expect(clause!.text).toContain(flag.sentence);
    }
  });

  it("splits each flagged clause so the pieces rebuild the clause exactly", () => {
    for (const clause of clauses) {
      const { before, flag, after } = splitClause(clause);
      if (flag) {
        expect(before + flag.sentence + after).toBe(clause.text);
      } else {
        expect(before).toBe(clause.text);
        expect(after).toBe("");
      }
    }
  });

  it("refuses a flag whose sentence is not in its clause", () => {
    const flagged = clauses.find((clause) => flags.some((flag) => flag.clause === clause.number))!;
    const altered = { ...flagged, text: flagged.text.replace(/\.$/, " and more.") };
    expect(() => splitClause(altered)).toThrow(/word for word/);
  });
});
