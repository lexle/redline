# 0004. A clause is dangerous when the downside is uncapped or there is no exit

Status: Accepted — 2026-09-04

## Decision

A clause earns a risk flag when a plausible bad outcome costs the Signer money with no ceiling,
or binds them with no way out. One-sidedness alone does not earn a flag, and neither does
departure from what is typical.

## Considered options

- **Asymmetry (a right granted to one side with no reciprocal).** Rejected because nearly every
  clause in a client's own template is asymmetric. It over-fires and buries real findings.
- **Deviation from market norm.** The most persuasive framing for a Signer, but it requires a
  corpus of normal agreements we do not have, and norms differ sharply by industry.

## Why

The strongest evidence in the research of this product working is the subcontractor who had a
clause struck out: he would have been liable for all costs of completing a three-year job if he
left for any reason. What made it a "total WTF clause" was not that it was unusual — it was that
his downside had no ceiling and no exit.

## Consequences

- **Redline is quieter than competing tools**, which is intended. See ADR-0005 on what happens
  when a document is clean.
- **Bad-but-bounded clauses are missed.** A clause that is genuinely unfair but caps the
  Signer's exposure will not be flagged.
