# 0002. v1 serves the pre-signature repeat freelancer, not the renter

Status: Partially reopened — 2026-09-07
- Segment (freelancers and small businesses, not renters): **Accepted**, 2026-09-04
- Moment (pre-signature): **Accepted**, 2026-09-04
- Buyer shape and pricing (repeat professional, paid): **REOPENED**, 2026-09-07 — see Amendment 2

## Decision

Redline v1 is built for a freelancer or small-business owner who signs several documents a
year and is reading one **before** signing it. Renters, consumers with subscription
auto-renewals, and one-off panic buyers are explicitly not served in v1.

## Considered options

- **Renters.** Three of the four sharpest quotes in the research are tenants, including one
  manually performing Redline's job on herself. Rejected on money, not need: every
  renter-facing resource found was free or income-gated legal aid, and no evidence exists of
  any renter paying for lease review.
- **Consumers with auto-renewal traps.** The most frequent harm shape in both regulator data
  and our own findings (5 of 18). Rejected because the harm is one sentence containing a date;
  that is a deadline tracker, a different product.
- **Post-signature.** Where demand demonstrably is — every pain quote arrives after the
  signature. Rejected because the counter-offer, the one differentiator found in no competing
  product, has no function once the document is signed.
- **One-off $99 review.** Matches the observed behaviour and the one direct comp. Rejected
  because it leaves the saved library as dead scope and pays full acquisition cost per sale.

- **Free analysis with a donation ask, aimed at one-off users.** Considered and rejected. Its
  real insight is worth keeping: it sidesteps the one claim the research could not evidence — that
  someone will pay, before signing, to avoid a harm they have not felt — by declining to ask the
  question. It also gives capability 6 a better justification than repeat use does, since "sign up
  to keep your analysis" makes the saved library the conversion mechanism rather than a power-user
  archive. Rejected on revenue and on evidence: consumer donation conversion runs well under 1%
  against a $99/review direct comp and real per-document inference cost, and a donation never
  produces a stated price, which is the cheapest validation available to us. Secondary cost: at
  price zero nothing filters out the renters and consumers this ADR excludes, so usage data would
  describe a broader product than the one being built.

- **B2B: sell to lawyers, who pre-check their clients' contracts.** Considered seriously and
  rejected. It solves two real problems — the lawyer is a qualified annotator, which is the only
  cheap source of calibration data for the severity model (ADR-0003), and it puts the pain and the
  wallet in the same person for the first time. It was rejected because per-client contract memory
  is a playbook, and §3 of the research shows the playbook segment is the most crowded in the
  space (Spellbook, LegalOn, Robin AI, LawGeex, Luminance — funded and shipping). It also destroys
  the differentiator: the drafted counter-offer was unserved precisely *because* laypeople have no
  playbook, so serving people who do have one means competing head-on where we are weakest.
  Secondary costs: privileged client documents impose isolation, no-training and retention
  requirements from day one, and law-firm sales carries conflicts checks and malpractice review
  that make "B2B is easier" doubtful.

## Why

The research's central tension is that the sharpest pain and the clearest willingness to pay
sit in different people. Serving the quotable segment means building for users with no
demonstrated wallet; serving the paying segment means building for users with a quiet pain
voice. We chose the wallet.

## Consequences

- **This is a bet on an unevidenced cell, not a synthesis of the findings.** No freelancer in
  the corpus describes a clause that actually cost them money; both freelance findings are
  near-misses. The intersection of freelancer, pre-signature and repeat buyer was never
  observed directly.
- **The cheapest possible falsification is 15 conversations asking a price out loud**, as the
  research recommends. A narrow target makes that test easier, not harder.
- **Marketing copy will be less moving than the evidence supports.** The quotable harm belongs
  to people we are not serving.
- **Lease-specific and subscription-specific clause vocabulary is out of scope for v1**, and
  the flag library is tuned to freelance service agreements.

## Amendment, 2026-09-07: the segment is not unserved

Verification of a research citation surfaced a competitive fact this ADR was decided without.
Rocket Lawyer ships **Rocket Copilot Contract Review free**, trained on 16 years of proprietary
legal analysis data, aimed at exactly the small-business owners this ADR selects. On its public
material it already covers plain-English explanation and risk flagging, with human follow-up behind
a membership.

**The segment choice stands** — the reasoning above concerned where pain and willingness to pay
overlap, and a competitor serving the same people does not change that. What changes is everything
downstream of it:

- **Research §3's first gap ("nobody serves the individual at a self-serve price") is false.** Any
  reasoning in this repo resting on it is unsound.
- **The rejection of freemium above was argued on donation economics and segment drift, not on
  competition.** Those arguments are untouched, but the surrounding situation is: the incumbent's
  price is zero, so a paid v1 must justify its price against free rather than against $670.
- **The paid repeat-professional call is the decision now under most stress.** It was chosen partly
  because a one-off buyer pays full acquisition cost per sale. That logic assumed the alternative
  to buying was not buying, not a free product from a known brand.
- **What Redline charges for must be what Rocket Copilot demonstrably does not do.** On current
  evidence that is the citation guarantee (ADR-0001), the drafted counter-offer, and red lines
  driving the analysis. This is unconfirmed: absence from a press release is not absence from a
  product, and it has not been tested directly. **Confirming it is a prerequisite, not a
  formality.**

## Amendment 2, 2026-09-07: the buyer decision is reopened

Rocket Copilot Contract Review is free and covers part of this product's scope (Amendment 1). The
decision to serve a paying repeat professional was made against an assumed alternative of *not
buying*. The real alternative is a free product from a brand these users already know. That is new
information material to the decision, so the decision is reopened rather than defended.

**What is reopened:** whether v1 serves a repeat professional or a one-off user, and whether it is
paid, free, or free with paid conversion. The rejections of the one-off $99 model and of
freemium-with-donation recorded above were reasoned without this fact and should be re-argued, not
reused.

**What is not reopened:** the segment (freelancers and small businesses over renters) and the moment
(pre-signature). Neither turns on the competitor's price — the first is about where pain and
willingness to pay overlap, the second about when the counter-offer can function.

**What has to be settled before this closes:**

1. What Rocket Copilot actually does — specifically whether it quotes the exact sentence a finding
   came from and whether it drafts sendable language. This is now a launch gate in PRD §4 and the
   answer determines whether a paid claim exists at all.
2. Whether the paid claim, if one exists, is large enough to charge for — verifiability, the drafted
   counter-offer and red lines driving analysis are narrower than "understand what you are signing."
3. Whether the saved library still earns its place. Its justification in this ADR was repeat use,
   which is exactly what has been reopened.

**Consequence for anything built in the meantime:** the analysis core is unaffected. The citation
guarantee, the danger test, the output types and drafting do not depend on who pays or how often
they return. Work blocked on this decision is limited to pricing, accounts and the saved library.
