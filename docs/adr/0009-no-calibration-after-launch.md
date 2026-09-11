# 0009. The severity model is calibrated once, before launch, and never after

Status: Accepted — 2026-09-04; amended 2026-09-11 (capability count, see Amendment)

## Decision

The miscalibration gap is recorded as a known, accepted unknown. Before launch, a lawyer reviews a
sample of real Redline outputs against the ranking they produced. After launch, nothing in the
product measures whether its severity ranking is right, and no capability is added to make it.
Scope stays at the six capabilities in CLAUDE.md.

## Considered options

- **Outcome capture as a seventh capability** — ask returning Signers whether the counter-offer was
  sent, whether it was accepted, whether anything went wrong. The only mechanism that produces real
  calibration data, and repeat professionals return often enough to supply it. Rejected to hold the
  six-capability scope.
- **Sell to lawyers**, whose corrections would be expert-grade, and **a free tier** generating
  volume. Both rejected in ADR-0002 for reasons unrelated to calibration.
- **Drop the probability claim** and rank only by what is checkable from the text. Not taken, but
  see the consequences.

## Why

Every alternative that produces a calibration signal costs either scope or the segment decision,
and both were settled deliberately. A single expert review before launch catches systematic
miscalibration — a whole clause type ranked wrongly — which is the failure mode most likely to
embarrass the product early. What it cannot catch is drift, or being wrong about a specific clause
in a way only outcomes would reveal.

## Consequences

- **Calibration stops the day Redline ships.** ADR-0003 ranks by *probable* cost to the Signer,
  and after launch that claim is permanently unverifiable from inside the product. ADR-0001 makes
  hallucination visible; nothing makes miscalibration visible, and now nothing ever will.
- **This puts ADR-0003 under tension worth revisiting.** If the probability claim can never be
  checked, ranking by what is checkable from the text alone — exposure and exit, per ADR-0004 —
  would be the more honest model. That trade was not taken here and remains open.
- **The bounded/unbounded line in ADR-0006 is fixed at whatever judgement ships.** It was the
  decision most likely to improve with outcome data.
- **The pre-launch review is a real dependency**, not a nice-to-have: it is the only check the
  severity model will ever get, so it needs a real sample of real documents and a real lawyer.

## Amendment, 2026-09-11: scope is seven capabilities

CLAUDE.md listed six capabilities; PRD §3 lists seven, because missing protections (ADR-0005) are
a capability of their own. CLAUDE.md now lists the same seven, in PRD order. The references above to
"six capabilities" and to outcome capture as "a seventh capability" were counted against the old
list.

**The decision is unchanged.** Outcome capture would now be an eighth capability, and it is still
rejected to hold scope.
