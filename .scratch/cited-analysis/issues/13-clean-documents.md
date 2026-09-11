# 13: A clean Document returns a checklist, plus Nice to have

**What to build:** When a Document contains no Risk flags, Redline says so plainly and shows the
checklist of what it looked for and found acceptable, for example "no uncapped exposure, no lock-in,
payment terms present and specified" (ADR-0008). Minor absences that are not harmful enough to be
Missing protections appear under Nice to have, each with a Proposed insertion. The checklist is a
product surface the Signer reads, not a debug view.

**Blocked by:** 09, 10, 11. Fair agreements routinely contain capped liability and arbitration clauses.
Until those go to Worth a look and Multiplier notes, a clean Document cannot come back clean.

**Status:** ready-for-agent

- [ ] Zero Risk flags produces an explicit "nothing found" result, not an empty list that looks like
      a failure.
- [ ] Every analysis returns the checklist of what was examined, in language a Signer can read.
- [ ] Nice to have is its own finding type, shaped like a Missing protection: no span, and a Proposed
      insertion marked as not in the Document. It is collapsed by default.
- [ ] Test at the analysis seam, synthetic client: a response with no dangerous clauses yields zero
      Risk flags, a populated checklist and any Nice to have items.
- [ ] The clean-document corpus is run against the real model in ticket 16, not here.
