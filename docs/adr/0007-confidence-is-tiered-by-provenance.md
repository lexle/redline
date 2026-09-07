# 0007. Confidence is tiered by provenance, not by how sure the model feels

Status: Accepted — 2026-09-04

## Decision

How confidently Redline states something is determined by what the claim rests on, not by the
model's own certainty:

- **Readable off the sentence** — stated flat, no hedge. "You owe the full remaining balance if
  you leave."
- **Requires inference about how it would play out** — stated as inference, marked as such in
  those words.
- **Requires facts about the Signer we do not have** — their leverage, industry, jurisdiction —
  Redline says nothing rather than guessing.

## Why

Hedged language is safe and useless; confident language is useful and sometimes wrong. Model
confidence is the wrong axis to resolve that on, because it is unverifiable and drifts. Provenance
is verifiable, and ADR-0001 already forces us to track it for every flag — so this costs nothing
new to implement and inherits an existing guarantee.

It is also a liability posture. DoNotPay's $193K FTC settlement attached to claiming to *replace a
lawyer*, not to explaining a document. Refusing to speak where we lack the Signer's facts is what
keeps Redline an explainer.

## Consequences

- **Redline sounds unauthoritative on the questions Signers most want answered**, because those are
  usually the ones needing facts about them.
- **Silence is a valid output** for a question the document cannot answer, and the interface must
  make that legible rather than looking broken.
