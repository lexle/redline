# Redline — Product Brief

Upload a contract, lease, freelance agreement or terms of service; get back what you are
actually signing.

This brief records decisions, not options. Where a decision was contested, the rejected
alternative is named in `docs/adr/`. Vocabulary is defined in `CONTEXT.md` and used strictly here.

---

## 1. Who this is for

**The Signer**: a freelancer, contractor or small-business owner who signs several documents a
year, reading one **before** they sign it.

Three properties, each of which changes what gets built:

- **They did not draft it and cannot fully read it.** The document is the counterparty's template.
- **They sign repeatedly.** Several a year, not one every three years — the assumption that made the
  saved library (capability 6) worth building. **This is reopened as of 2026-09-07** (ADR-0002,
  Amendment 2): a free incumbent changes what the alternative to buying is, so whether v1 serves a
  repeat professional or a one-off user, and at what price, is undecided.
- **They have not signed yet.** The counter-offer — the thing no competing product was found to do
  — has no function after signature.

### What they do today instead

| Option | What it costs | Source |
|---|---|---|
| Nothing | Free. The default. | — |
| Paste it into ChatGPT | Free, no citations, no memory of their red lines | Research §3: *"The real competitor is not a company — it's someone pasting their lease into ChatGPT for free."* |
| Hire a lawyer | $400–$460 flat typical; **$670 average across 635 bids** on ContractsCounsel | Research §4 |
| Buy an AI review | $99 flat per review (QwickContractReview, shipped 2025) | Research §4 |
| **Use Rocket Copilot Contract Review** | **Free**, with email registration | [Rocket Lawyer newsroom](https://www.rocketlawyer.com/newsroom/rocket-lawyer-launches-rocket-copilot-contract-review) |

**51% of small businesses avoid counsel because it is too expensive**, while 1 in 4 name legal
issues as their biggest risk (research §4). A separate LegalShield survey (n=299) puts the same
finding at **60% avoiding a lawyer over cost and complexity**. That gap — knowing it matters,
declining to pay $670 to find out — is the space Redline occupies.

**It is not an empty space.** Rocket Lawyer ships Rocket Copilot Contract Review free, trained on
16 years of its own legal analysis data, targeting these exact users. On the evidence available it
already does capability 1 (plain-English explanation) and capability 2 (flagging risks, naming
liability limits and auto-renewals by example), with follow-up questions routed to a human Legal
Pro behind a Rocket Legal+ membership. Two things are not evidenced in its public material: whether
it quotes the exact sentence a finding came from, and whether it drafts language the Signer can
send. That absence is not proof — it has not been tested against the product — and confirming it is
a prerequisite for the positioning in §6.

The consequence for this brief: Redline is not competing with inaction and ChatGPT. It is
competing with a free incumbent that covers part of the same scope, and anything Redline charges
for has to be something that incumbent demonstrably does not do.

We are not serving renters, consumers with subscription auto-renewals, or one-off panic buyers.
Section 6 says who that hurts.

---

## 2. The problem

People sign documents they know they do not understand, and ask for help only afterwards. A
consumer, unprompted, in a CFPB complaint about mortgage paperwork:

> "My wife and I signed documents that we did not understand we really need some help"

<https://www.consumerfinance.gov/data-research/consumer-complaints/search/detail/11244754>

Note the tense: *signed*. This is the central difficulty of the product and it is stated in
section 8, not hidden here.

**Pushing back works when someone reads carefully enough to try.** A subcontractor on a clause
making him liable for the entire cost of completing a three-year job if he left for any reason:

> "I was startled to read that if I didn't complete the three year job for their client for any
> reason I would be liable for any and all expenses related to completing the job. ... That was a
> total WTF clause as far as I was concerned and I had them strike it out, which they did after a
> bit of hemming and hawing."

<https://news.ycombinator.com/item?id=1794718>

That clause is the template for what Redline flags: unbounded cost, no exit. What it took was a
careful manual read most people never perform. And comprehension is only half the barrier — a
freelancer in a parallel case names the other half:

> "personally I wanted the first impression I left to be that I'm a 'team player,' as opposed to
> starting a legal battle on day one."

<https://news.ycombinator.com/item?id=13544336>

This is why Redline drafts the counter-offer rather than only identifying the clause. Knowing
what to say is a smaller problem than being willing to say it; supplying the words lowers both.

**The largest measured harm is an absence, not a clause.** Freelancers lose an average of
**$5,968 a year** to payment trouble and **71% hit it at some point** (Freelancers Union, research
§2); a 2022 NY survey found 60–62% were never paid for some work. The cause is what the contract
fails to say. A tool that only ranks clauses that are present misses the most valuable thing it
could tell this Signer — which is why missing protections exist as a first-class output.

---

## 3. What the first version does

1. **A plain-English summary** of what the document is and what it commits the Signer to.

2. **Risk flags, ranked.** Clauses that could hurt the Signer, each showing the exact sentence it
   came from, quoted verbatim and locatable in the document. A flag whose source sentence cannot
   be shown fails loudly rather than rendering uncited (ADR-0001). Ranking is by probable cost to
   this Signer, not worst-case legal exposure (ADR-0003).

3. **A drafted counter-offer for each flagged clause** — replacement language the Signer can send.

4. **Missing protections**: harms arising from what the document does not say, each with a
   **proposed insertion** — drafted language explicitly marked as not present in their document.
   These cite nothing, because they assert nothing about the text (ADR-0005).

5. **A question box** that answers only from the document, and says so when the document does not
   answer.

6. **The Signer's own red lines**, editable, driving the analysis.

7. **A saved library** of past documents — extracted text only, never the uploaded file.

Three secondary outputs, all collapsed by default so the ranking stays short (ADR-0006):

- **Worth a look** — clauses that are one-sided or unusual but bounded: exposure has a ceiling and
  an exit exists. Written flatly ("liability is capped at 2× fees"), never as a hedge.
- **Nice to have** — minor absences, each with a proposed insertion.
- **Multiplier notes** — clauses that cause no harm alone but worsen every other harm: arbitration
  and class-action waivers, unilateral amendment. Held outside the ranking (ADR-0003).

Nothing beyond this list. Section 7 says what was excluded and why.

---

## 4. What good looks like

Seven tests. The first is a build gate; the rest are launch gates.

**1. Every risk flag cites a real sentence — 100%, enforced in CI.**
For every flag on every document in the test corpus, the cited sentence is found verbatim in the
stored text. Not a sample: all of them. This is the project's main invariant (ADR-0001) and a
single failure is a bug, not a degraded result.

**2. No fabricated citation ever reaches the Signer.**
Missing protections and nice-to-haves carry no citation, and no synthetic section number,
placeholder paragraph or proposed insertion is ever written into the stored document text
(ADR-0005). Testable directly: the stored text is byte-identical to what extraction produced.

**3. Payment-absence detection fires.**
Assemble freelance agreements that omit payment timing. Redline raises a missing protection on
every one. This is the single highest-value finding for the segment and the one an absence-blind
tool would miss entirely.

**4. Clean documents come back clean.**
On a corpus of fair, standard agreements, Redline returns **zero risk flags** — and a checklist of
what it checked, plus nice-to-haves (ADR-0008). A tool that finds something in everything is a
horoscope. If this test cannot be made to pass, the severity threshold is wrong.

**5. Pre-launch expert review.**
A lawyer reviews Redline's output on a sample of real documents against the ranking it produced.
Two questions, both answerable: does the top-ranked flag agree with the reviewer's, and is any
whole clause type systematically mis-ranked? This is the only calibration the severity model will
ever receive (ADR-0009), so it is a launch blocker with a real cost attached, not a nice-to-have.

**6. Rocket Copilot is tested directly, not assumed.**
Run a real contract through Rocket Copilot Contract Review and record two things: whether it quotes
the exact sentence each finding came from, and whether it drafts language the user can send. It is
free, so this costs an afternoon. The entire paid claim rests on the answer, and it is currently an
inference from a press release. If it turns out to cite verbatim and draft counter-offers, the
differentiator in §6 does not exist and the buyer decision reopened in ADR-0002 has to close
differently.

**7. Register holds under pressure.**
On documents where the answer depends on facts we do not have — the Signer's leverage, industry,
jurisdiction — Redline says nothing rather than guessing (ADR-0007). Testable by constructing
questions that cannot be answered from the text and confirming refusal, not hedged speculation.

---

## 5. Red lines: what gets flagged, how severely, and why

A clause earns a **risk flag** when a plausible bad outcome has no financial ceiling, or binds the
Signer with no way out (ADR-0004). One-sidedness alone does not qualify — nearly every clause in a
counterparty's template is asymmetric, and flagging on that basis buries the findings that matter.

### Risk flags — uncapped or inescapable

| Clause | Why it qualifies | Evidence |
|---|---|---|
| **Liability for completion / consequential costs** | No ceiling. The subcontractor case: liable for all costs of completing a three-year job if he left for any reason | Research §1C, verbatim quote |
| **Non-compete / non-solicit** | No exit — restricts earning after the relationship ends | ~30M US workers bound; FTC's Rollins case covered 18,000+ mostly low-wage employees. Confidence: medium-high |
| **Uncapped indemnification** | No ceiling, and triggered by third parties the Signer does not control | Law-firm commentary only. **Confidence: low** |
| **Overbroad IP assignment** | Irreversible; assigns work the Signer expected to keep or reuse | Practitioner blogs; one cited $15K dispute. Confidence: low-medium |
| **Personal guarantee** | No ceiling, and pierces the business entity to reach personal assets | **The research found no data on this at all.** Included on the ADR-0004 test alone |
| **Auto-renewal with hard cancellation** | Lock-in; an exit that exists on paper but not in practice | FTC negative-option record cites "tens of thousands of consumer complaints"; NY AG took $600K from Equinox over cancellation friction. Confidence: high. For this Signer it appears as auto-renewing retainers, a narrower case than the consumer evidence describes |

### Missing protections — harm from silence

| Absent term | Why it matters | Evidence |
|---|---|---|
| **Payment timing and amount** | The largest measured dollar harm to this exact segment | 71% hit payment trouble; **$5,968/yr average**; 60–62% never paid for some work. Confidence: high |
| **Kill fee / termination compensation** | Work performed, relationship ended, nothing owed | **No data found.** Included on reasoning, not evidence |
| **Late-payment interest or remedy** | Without it, late payment carries no consequence | No direct data |
| **Scope-change and revision limits** | Unbounded work for fixed pay | No direct data |

### Multiplier notes — real, but not ranked

**Arbitration + class-action waiver** and **unilateral amendment** are surfaced outside the
ranking. They cause no felt harm until something else goes wrong, and ranking them by legal
exposure puts them above a missing payment term — which the research warns "feels miscalibrated to
the reader" (§2). The prevalence is not in doubt: CFPB found up to 80M consumers covered in credit
cards alone, and class-action waivers grew from 16% to 43% of contracts between 2012 and 2014.

**Where this ranking is weak.** Research §2 states plainly that positions 1–4 rest on hard numbers
and 5–8 on advocacy or practitioner commentary, and that "no regulator ranks clause types
head-to-head — this is a synthesis, not a measured study." Two clause types above (personal
guarantees, kill fees) have no supporting data at all and are included on judgement. That is what
test 5 in section 4 exists to check.

---

## 6. The calls, and who is worse off

Nine decisions. Each names what it chose against and who pays for it.

**1. Freelancers and small businesses, not renters.** (ADR-0002)
Renters supplied three of the four sharpest quotes in the research, including a tenant who
manually performed Redline's job on herself after signing. Every renter-facing resource found was
free or income-gated legal aid, and no evidence exists of any renter paying for lease review.
*Worse off: renters — the users with the most vivid, best-evidenced need get nothing, and our
marketing copy is less moving than the evidence would support because the quotable harm belongs to
people we do not serve.*

**2. Pre-signature, not post-signature.** (ADR-0002)
Every pain quote in the corpus arrives *after* the signature. But the counter-offer, the one
differentiator found in no competing product, has no function once a document is signed.
*Worse off: the person who already signed — who is, on the evidence, the person actually asking
for help.*

**3. The repeat professional, not the one-off buyer. — REOPENED 2026-09-07.** (ADR-0002, Amendment 2)
The original reasoning: the one-off $99 review matches both the observed behaviour and the direct
competitor, but leaves the saved library as dead scope and pays full acquisition cost per sale.
That argument assumed the alternative to buying was not buying. Rocket Copilot Contract Review is
free, so the alternative is a free product from a known brand, and the decision is being re-argued
rather than defended. Nothing downstream of it should be treated as settled — including the saved
library, whose justification was repeat use.
*Worse off, if it closes the same way: the one-off panic buyer, who is exactly who the research
quotes describe.*

**4. Probable harm, not worst-case legal exposure.** (ADR-0003)
The Signer is not a lawyer and judges credibility by whether the top flag matches their intuition.
*Worse off: the Signer who ends up in a dispute where the arbitration clause turns out to have
mattered more than anything ranked above it. Also: our standing with anyone legally trained, who
will read the ranking as naive. Expect that criticism specifically.*

**5. Uncapped or inescapable, not asymmetric or unusual.** (ADR-0004)
*Worse off: anyone harmed by a clause that is genuinely unfair but bounded. Redline will be quieter
than competing tools, on purpose.*

**6. Absences are missing protections, never risk flags.** (ADR-0005)
A virtual citation — a synthetic section number for what a document omits — was proposed and
rejected. It would make Redline cite text that does not exist in the Signer's contract, destroy the
exact offsets ADR-0001 depends on, and teach the Signer that a citation may be fabricated.
*Worse off: anyone wanting one unified ranked list. Absences and present clauses sort separately
and always will.*

**7. Prefer the miss, for bounded harms only.** (ADR-0006)
An over-flagging tool does not fail gracefully; once the list reads as noise the Signer stops
reading and Redline catches nothing.
*Worse off: the Signer hurt by something Redline saw, classified as bounded, and demoted. We cannot
claim to catch everything.*

**8. Confidence tiered by provenance, not by felt certainty.** (ADR-0007)
*Worse off: the Signer asking the interesting question — "will this hold up?", "is this normal in my
industry?" — which is exactly where Redline goes quiet.*

**9. No calibration after launch.** (ADR-0009)
Outcome capture as a seventh capability was considered and rejected to hold scope. Two other
routes that would have supplied the signal — selling to lawyers, and a free tier generating volume
— were rejected in ADR-0002 for unrelated reasons.
*Worse off: every Signer after the first. The severity model is fixed at whatever ships. ADR-0001
makes hallucination visible; nothing makes miscalibration visible, and now nothing ever will.*

**A tension left open.** ADR-0003 ranks by *probable* harm — a claim about the world. After launch
that claim is permanently unverifiable. If it can never be checked, ranking by what is checkable
from the text alone (exposure and exit, per ADR-0004) is the more defensible model. That trade was
not taken. It is recorded here so that reopening it is a decision rather than a discovery.

---

## 7. What we are not building

**OCR for scanned documents.** Not a scope cut — a correctness requirement. A citation is worthless
when the text it points at was misread, so scanned documents are refused rather than best-guessed
(ADR-0001). This is the clearest case where adding a feature would make the product less
trustworthy.

**Deadline and date tracking.** Auto-renewal is the most frequent harm shape in both regulator data
and our own findings — 5 of 18 — and the harm is almost always one sentence containing a date.
That is a deadline tracker, a different product. Research §5.4 warns that if this is the wedge,
we are building the wrong thing.

**Payments and billing.** Not needed to establish whether the analysis can be trusted, which is
what v1 exists to prove.

**Sharing a document between users.** Same reason.

**Outcome capture and any post-launch feedback loop.** (ADR-0009) The only mechanism that would
calibrate the severity model, declined to hold the six-capability scope. The cost is stated in
section 6, call 9.

**A lease and consumer-subscription clause library.** Follows from call 1. The flag library is
tuned to freelance service agreements.

**Any claim to replace a lawyer.** DoNotPay's February 2025 FTC settlement — $193K over deceptive
"AI lawyer" claims — attached to claiming to *replace* a lawyer, not to explaining a document
(research §3). Redline explains documents. ADR-0007's refusal to answer where it lacks the
Signer's facts is what keeps that line intact.

---

## 8. What the research could not tell us

Stated plainly, because building on these as though they were settled is the likeliest way this
goes wrong.

**Nobody has said they would pay for this.** Every willingness-to-pay figure in the research is a
*lawyer's* price, not a user's stated price. No survey of any segment naming a price for a
contract-explainer tool was found. "A lawyer costs $670, so $99 is cheap" is an inference — and the
alternative most people actually choose is free. The research's own recommendation: **15
conversations with freelancers and small-business owners, asking a price out loud. Worth doing
before the PRD, not after.** That has not been done.

**No freelancer in the corpus describes a clause that actually cost them money.** After a dedicated
retry, both freelance findings are near-misses — people who caught it in time. The segment we chose
to serve has the weakest pain voice in the entire research corpus. Section 1 is a bet, not a
synthesis of the findings.

**The intent arrives after the signature.** *"signed documents that we did not understand"*, *"I
just signed my lease agreement; and I notice"*. We are building for a moment the research never
observed anyone seeking help in. Why someone would pay *before* being burned is unanswered.

**The "nobody serves this user" gap is false.** Research §3 lists as its first gap that nobody
serves the individual with a single one-off document at a self-serve price. Rocket Copilot Contract
Review does, at zero, from a brand these users already know. Research §3 describes Rocket Copilot as
sitting inside a subscription; that is out of date. Any argument in this brief that rests on the
market hole being unserved needs re-examining against that fact.

**A competitor already ships this at $99.** QwickContractReview.com offers plain-English summary,
red-flag detection and obligation highlights, targeting freelancers and small businesses. Nothing
was found on its traction — not whether it works, not whether anyone buys it.

**Ten competitors were never examined**: Luminance, Kira, ContractPodAi, Legartis, LegalOn,
Diligen, Lexion, Legalese Decoder, Loio, Detangle. The claim that the drafted counter-offer is
unserved rests on the eleven products that were checked.

**The Q&A box gap is weakly evidenced.** The finding that no shipped product offers document-scoped
Q&A rests on vendor blogs warning people off ChatGPT — self-serving framing, not proof.

**Evidence quality limits, from the research's own notes**: all CFPB quotes are verbatim only
within a ~125-character extract, not verified full narratives. The 82%/77% small-business figures were
misattributed to a LegalShield study; they are in fact from a survey commissioned by **Rocket
Lawyer**, a direct competitor, to launch its own free contract-review product, and the sample is
1,000 US adults rather than small-business owners. They should not be treated as demand evidence. Reddit comment threads, r/smallbusiness, Avvo, JustAnswer, ConsumerAffairs and Quora
were never reached. No data was found on personal guarantees, kill fees or fee escalators — three
things this brief flags anyway, on judgement.

---

*Decisions: `docs/adr/`. Vocabulary: `CONTEXT.md`. Evidence: `research/summary.md`.*
