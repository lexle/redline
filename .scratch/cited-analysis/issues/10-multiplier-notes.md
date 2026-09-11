# 10: Multiplier notes sit outside the ranking

**What to build:** Clauses that cause no harm alone but worsen every other harm, namely arbitration,
class-action waivers and unilateral amendment, are surfaced as Multiplier notes. Each note states what
the clause does to the Signer's position if something else goes wrong. None of them ever enters the
Risk flag ranking, whatever its legal weight (ADR-0003).

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Multiplier note is a distinct finding type, carrying a Source sentence and a provenance tier,
      and it is never presented as a ranked flag.
- [ ] Its Source sentences pass the same verbatim validation as Risk flags, and a mismatch throws.
- [ ] Multiplier notes are shown outside the ranking and collapsed by default.
- [ ] Test at the analysis seam, synthetic client: an arbitration clause comes back as a Multiplier
      note, including in a Document with no ranked Risk flags.
- [ ] Test: a unilateral amendment clause never appears among the Risk flags.
