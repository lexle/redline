# 0003. Severity ranks probability-weighted harm; multipliers get notes instead

Status: Accepted — 2026-09-04

## Decision

Risk flags are ranked by the probable cost to this Signer — likelihood multiplied by what it
would cost them — not by worst-case legal exposure. Clauses that cause no harm on their own but
worsen every other harm (arbitration and class-action waivers, unilateral amendment) are not
ranked into that list. They are surfaced separately as **multiplier notes**, which state what
the clause does to the Signer's position if something else goes wrong.

## Why

The research warns that a legal-exposure ranking puts harm-multipliers on top and "feels
miscalibrated to the reader." The Signer is not a lawyer and judges Redline's credibility by
whether the top flag matches their intuition about what will actually bite them. Ranking an
arbitration clause above a missing payment term spends that credibility on a clause that will
never fire for most Signers.

Suppressing multipliers entirely is the opposite error: they genuinely change what happens when
a dispute starts, and a Signer who later ends up in one deserves to have been told. Separating
them keeps the ranking honest without hiding them.

## Consequences

- **Anyone legally trained will call the ranking wrong.** Expect this criticism specifically;
  it is the accepted cost of ranking for the reader rather than the reviewer.
- **The severity model needs empirical calibration**, because "probable" is a claim about the
  world, not about the text. Nothing in v1 currently measures whether a ranking was right.
- **Multiplier notes are a distinct output type** and must not be presented as ranked flags.
