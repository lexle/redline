# 0005. A harmful absence is a missing protection, never a risk flag

Status: Accepted — 2026-09-04

## Decision

What a document fails to say is reported as a **missing protection** — a distinct object from a
risk flag. It carries a stable identifier (`MP-01`), cites nothing, and states plainly that the
document does not address the matter. Each one carries a **proposed insertion**: drafted
language, explicitly labelled as not present in the Signer's document, which they may send to
the counterparty or export as a marked-up copy.

The stored document text is never modified. No synthetic section number, placeholder paragraph
or virtual citation is ever written into it or shown as a citation.

## Considered options

- **Report absences as risk flags with a virtual citation** (e.g. a synthetic "§100 missing
  paragraph" inserted into the document). Rejected: it makes Redline cite text that does not
  exist in the Signer's contract, contradicting ADR-0001 and the rule that we state only what
  the document says. It also destroys the exact offsets ADR-0001 depends on. Most importantly it
  teaches the Signer that a Redline citation may be fabricated, which forfeits the product's
  only real guarantee.
- **Do not report absences in v1.** Keeps the invariant pure but forfeits the largest measured
  harm ($5,968/yr average, 71% affected) for the exact segment v1 serves.

## Why

The biggest measured dollar harm to freelancers comes from what contracts fail to say about
payment. A tool that only ranks present clauses misses the most valuable thing it could tell the
Signer v1 was built for. But a risk flag without a source sentence is a bug by ADR-0001. Making
absences a structurally different object resolves the collision instead of weakening either side:
a missing protection asserts nothing about the text, so it has nothing to cite.

## Consequences

- **There is no single unified severity ranking.** Missing protections and risk flags sort
  separately and must be presented as two lists.
- **Proposed insertions are the counter-offer for an absence**, and must always be marked as
  language not currently in the document.
- **Export produces a marked-up copy, never a rewritten stored document.**
