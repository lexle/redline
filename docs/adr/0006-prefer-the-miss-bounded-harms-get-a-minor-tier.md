# 0006. Redline prefers the miss; bounded harms go to a separate minor tier

Status: Accepted — 2026-09-04

## Decision

Redline would rather stay silent on a mildly unfair clause than dilute the two or three that could
sink the Signer. Clauses that are one-sided or unusual but **bounded** — the Signer's exposure has
a ceiling and an exit exists — do not enter the risk flag ranking. They are listed separately as
**worth a look**, collapsed by default.

Entries in that tier are written flatly, stating what the clause does and that it is bounded
("liability is capped at 2× fees"). They are never written as hedges ("this may be worth
reviewing"), because bounded is a fact about the clause, not a confidence level. Hedged phrasing
here would reintroduce exactly the uselessness ADR-0007 exists to prevent.

## Why

An over-flagging tool does not fail gracefully, it fails completely: once the Signer learns the
list is noisy they stop reading it, and then Redline catches nothing at all. A tool that misses one
bounded harm still gets read next time. But discarding bounded findings entirely throws away real
information the Signer may want when the stakes are high, so they are kept and demoted rather than
suppressed.

## Consequences

- **Redline cannot claim to catch everything**, and some Signers will be hurt by something it saw
  and chose not to rank.
- **Four secondary sections now exist** — worth a look, nice to have, missing protections and
  multiplier notes. A report with five kinds of caveat buries the findings that matter, so every
  minor tier collapses by default and the primary ranking stays short.
- **The bounded/unbounded line is the load-bearing judgement**, and per ADR-0009 it is fixed at
  whatever judgement ships — there is no post-launch signal that would correct it.
