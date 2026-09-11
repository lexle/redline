# 0010. Every summary sentence is grounded in the Document

Status: Accepted — 2026-09-11

## Decision

Every sentence of the plain-English summary points at one or more spans in the stored Document text,
and each span is validated verbatim before the summary is shown. This is the same check ADR-0001
applies to risk flags. A summary sentence whose spans do not match fails the analysis loudly. There is
no path that shows a summary sentence without the text it rests on.

## Considered options

- **Leave the summary uncited, marked only with a provenance tier (ADR-0007).** Cheaper, and
  ADR-0001 as written covers only risk flags. Rejected: a tier says how firmly a claim is stated, not
  whether the Document says it. An ungrounded summary sentence is exactly the unfalsifiable paraphrase
  ADR-0001 rejected for flags.
- **Cite the section a summary sentence came from.** Rejected for the reason ADR-0001 gave: a section
  number sends the Signer back into the document they could not read.

## Why

The summary is read first and read by every Signer, including those who never open a flag, and it
shapes how they read everything below it. If it can say something the Document does not, such as
"you are paid within 30 days" in a contract that is silent on payment, it breaks the rule that Redline
states only what the Document says. It breaks it at exactly the point where the Signer is least able
to catch the error. The span mechanism already exists for flags, so grounding the summary costs a
validation pass, not a new design.

## Consequences

- **The summary is more literal and shorter** than a free-written one. A sentence that cannot point
  at text is not written.
- **A sentence combining several clauses carries several spans**, and every one must validate.
- **Absences never appear in the summary.** What the Document does not say belongs to missing
  protections (ADR-0005), which cite nothing and are presented separately.
- **More analyses will fail loudly**, because a mis-spanned summary sentence now fails the whole
  result, as a mis-spanned flag already does.
- **The question box (capability 5) faces the same choice.** Its spec should decide explicitly
  whether answers are grounded this way, rather than inheriting this decision by default.
