# 04: Every claim carries its provenance tier

**What to build:** How firmly Redline states something depends on what the claim rests on, not on
how sure the model feels (ADR-0007):

- A claim read directly off the Source sentence is stated flat, with no hedge.
- A claim that needs inference about how the clause would play out is marked as inference, in
  those words.
- A claim that would need facts about the Signer that Redline does not have (their leverage,
  industry, jurisdiction) is not made at all.

The tier belongs to the finding, not to the display, so the register cannot drift between the
analysis and the display. Every finding type built after this ticket carries a tier from the start.

**Blocked by:** 03

**Status:** ready-for-agent

Interpretation note: the spec's "Refusal holds" test talks about questions, but the question box is
out of scope for this spec and the analysis takes no question. Here it means that claims depending on
facts about the Signer are withheld. Refusal in the question box belongs to the capability-5 spec.

- [ ] Every claim a Risk flag makes carries a tier: read off the sentence, inference, or withheld.
- [ ] The display labels inference as inference. Read-off claims carry no hedge.
- [ ] A claim tagged as needing facts about the Signer is not shown, and no hedged speculation replaces
      it. The Risk flag itself still shows if its read-off claims stand.
- [ ] Nothing in the output tells the Signer what they should legally do.
- [ ] Tests at the analysis seam, synthetic client: a claim that depends on the Signer's jurisdiction
      or industry is absent from the result, and an inference-tier claim comes back marked as
      inference.
