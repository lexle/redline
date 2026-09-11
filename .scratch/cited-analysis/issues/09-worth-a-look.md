# 09: Bounded clauses go to Worth a look

**What to build:** A clause that is one-sided or unusual but bounded, meaning the Signer's exposure
has a ceiling and an exit exists, is listed under Worth a look instead of being ranked as a Risk flag
(ADR-0004, ADR-0006). Worth a look is collapsed by default, so the two or three findings that could
sink the Signer are not buried among fifteen that cannot.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Worth a look is a distinct finding type. It carries a Source sentence (the clause is present in
      the text) and a provenance tier, and it never enters the Risk flag ranking.
- [ ] Its Source sentences pass the same verbatim validation as Risk flags, and a mismatch throws.
- [ ] Entries are written flatly: what the clause does and that it is bounded ("liability is capped
      at 2× fees"). They are never written as hedges ("this may be worth reviewing"), because bounded
      is a fact about the clause, not a confidence level.
- [ ] Worth a look is shown separately from Risk flags and collapsed by default.
- [ ] Test at the analysis seam, synthetic client: a clause with a stated liability cap comes back as
      Worth a look, not as a Risk flag.
