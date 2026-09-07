# 0008. A clean document returns what was checked, plus nice-to-haves

Status: Accepted — 2026-09-04

## Decision

When a Document contains no risk flags, Redline says so plainly and shows the checklist of what it
looked for and found acceptable — "no uncapped exposure, no lock-in, payment terms present and
specified." Minor absences that are not harmful enough to be missing protections are listed under
**nice to have**, each carrying a proposed insertion per ADR-0005.

## Why

Most documents are fine. A tool that always finds something becomes a horoscope, and a repeat
professional will notice within three documents. But bare silence reads as failure rather than as a
result, so the checklist is what makes "nothing found" credible: it shows the analysis ran and what
it covered.

## Consequences

- **This creates a real churn risk**, not an epistemic one. A subscriber who receives three clean
  reports in a row will ask what they are paying for. The honest version of this product produces
  that outcome regularly and the brief should say so.
- **The checklist is a product surface**, not a debug view — it has to be legible to a Signer.
