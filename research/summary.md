# Redline — Research Summary

Synthesis of the research sprint. Sources: `agent-1-who-has-this-pain.md` (consolidated from
three passes), `agent-2-what-goes-wrong.md`, `agent-3-what-already-exists.md`,
`agent-4-who-would-pay.md`. Every agent ran under a 12-search cap with a source URL required
for each claim.

**Status of the evidence.** The first pain-research pass failed — 3 findings, no consumer forum
reached. A retry got past the blocks and the pain leg now stands on **18 sourced findings with
verbatim quotes**, from Reddit (via the pullpush archive API), the CFPB complaint database, the
FTC, and NPR. The earlier verdict that "the pain evidence is the weakest leg" no longer holds.
A different and sharper problem took its place — see §5.

---

## 1. The three sharpest pain points

### A. People sign things they know they don't understand, and only ask for help afterwards
A consumer's own words in a CFPB complaint about mortgage paperwork:

> "My wife and I signed documents that we did not understand we really need some help"

https://www.consumerfinance.gov/data-research/consumer-complaints/search/detail/11244754

This is the product thesis stated by a stranger, unprompted. Note the tense: *signed*. The
request for help arrives after the signature, which is a real go-to-market problem (§5).

### B. A tenant manually performing Redline's job on herself — after signing
She signed, then went looking for an early-termination clause, couldn't find one, and pasted her
lease's default clause to Reddit strangers to ask what it meant:

> "So I just signed my lease agreement; and I notice that the document does not have an early term clause"

> "Tenant shall be responsible for all rent due for the balance of the Lease term, even though Tenant may no longer be able to live in or use the Premises due to the eviction."

https://www.reddit.com/r/Tenant/comments/1kfccmc/renting_from_a_private_landlord_no_early/

The closest thing in this research to a live demo of the product. She wanted: find the clause
that governs my situation, tell me in plain English what it does to me, cite the sentence.

### C. Someone who caught a dangerous clause — and got it struck out
A subcontractor on a clause making him liable for the full cost of completing a three-year job
if he left for any reason:

> "I was startled to read that if I didn't complete the three year job for their client for any reason I would be liable for any and all expenses related to completing the job. ... That was a total WTF clause as far as I was concerned and I had them strike it out, which they did after a bit of hemming and hawing."

https://news.ycombinator.com/item?id=1794718

The counterfactual that validates the counter-offer feature: pushing back **works**. What it
cost him was a careful manual read most people will never do. And a freelancer in a parallel
case names the other half of the barrier — not comprehension, but nerve:

> "personally I wanted the first impression I left to be that I'm a 'team player,' as opposed to starting a legal battle on day one."

https://news.ycombinator.com/item?id=13544336

---

## 2. Clause types that matter most, ranked

Positions 1–4 rest on hard numbers; 5–8 on advocacy or practitioner commentary. No regulator
ranks clause types head-to-head — this is a synthesis, not a measured study.

| # | Clause type | Evidence | Confidence |
|---|---|---|---|
| 1 | **Auto-renewal / hard-to-cancel** | FTC negative-option record cites "tens of thousands of consumer complaints"; active FTC suits vs. Uber, Amazon, Chegg, LA Fitness; NY AG took $600K from Equinox over cancellation friction. **Also the single most common shape in our own pain findings — 5 of 18.** | **High** |
| 2 | **Arbitration + class-action waiver** | CFPB: up to 80M consumers covered in credit cards alone; class-action waivers grew 16%→43% of contracts (2012→2014) | High on prevalence, medium on felt harm |
| 3 | **Payment terms / non-payment (freelance)** | Freelancers Union: 71% hit payment trouble at some point, avg **$5,968/yr lost**; 2022 NY survey: 60–62% never paid for some work | **High** |
| 4 | **Non-compete / non-solicit** | ~30M US workers bound; FTC's Rollins case covered 18,000+ mostly low-wage employees | Medium-high |
| 5 | Joint-and-several liability (leases) | NCLC rental junk-fee comments; no complaint-count data | Low-medium |
| 6 | IP assignment (freelance) | Practitioner blogs; one cited $15K dispute | Low-medium |
| 7 | Unilateral amendment | FTC policy blog; proposed (not finalized) CFPB rule | Low-medium |
| 8 | Indemnification / liability caps | Law-firm commentary only | Low |

**Three findings that should shape the product spec:**

- **#3 is not a clause, it's an absence.** The biggest measured dollar harm to freelancers comes
  from what the contract *fails to say* about payment. A tool that only ranks clauses that are
  present will miss the highest-value finding for the segment most likely to pay. Redline must
  flag **missing protections**, not just dangerous language.
- **#2 and #7 are harm-multipliers, not triggers.** They cause no felt pain until something else
  goes wrong. A severity model built on legal exposure alone will rank them top and feel
  miscalibrated to the reader.
- **Deadlines are a separate feature from clause risk.** In findings 4–8 of the pain file, the
  harm is a notice window stated once — *"auto renews unless written notice is given 10 days
  prior"*. That is date extraction, not risk ranking.

---

## 3. Where the existing tools are weak

**Enterprise CLM + AI review** (Ironclad/Jurist, LinkSquares, Evisort, LawGeex, Robin AI,
Spellbook): all quote-priced, five-to-six figures a year, built for legal-ops teams working
against an internal playbook. Complaints centre on search, editing friction and setup — one
reviewer called Ironclad "choose your own adventure," daunting without a full-time admin.
Unreachable for a person with one lease.

**Consumer-facing:** Rocket Lawyer's "Rocket Copilot" is the closest analog but sits inside a
subscription whose billing/cancellation pattern dominates its negative reviews (~60–70% of
Trustpilot negatives). ToS;DR is the only free plain-English consumer tool found, but it covers
only pre-analysed major-platform ToS and **cannot take your uploaded document**.

**Four gaps:**
1. Nobody serves the individual with a single one-off document at a self-serve price.
2. **The drafted counter-offer was not observed in any product researched.** Enterprise tools
   redline against a playbook you're assumed to have. A layperson has none. Most defensible differentiator.
3. **A document-scoped Q&A box was not found as a shipped feature.** Caveat: this rests on vendor
   blogs warning people off ChatGPT — self-serving framing, not proof.
4. **DoNotPay's FTC settlement** (Feb 2025, $193K, deceptive "AI lawyer" claims) is the
   positioning lesson: risk attaches to claiming to *replace* a lawyer, not to explaining a document.

**The real competitor is not a company** — it's someone pasting their lease into ChatGPT for free.

*Not checked before the cap:* Luminance, Kira, ContractPodAi, Legartis, LegalOn, Diligen, Lexion,
Legalese Decoder, Loio, Detangle.

---

## 4. Who would plausibly pay, and roughly what

| Segment | Evidence | What the alternative costs today |
|---|---|---|
| **Freelancers / contractors** | **Strong** | Lawyer flat fee $400–$460 avg; ContractsCounsel marketplace avg **$670** across 635 bids |
| **Small business owners** | **Strong** | ~$300/hr; **51% avoid counsel because it's too expensive**, while 1 in 4 call legal issues their biggest risk |
| **Creators / brand deals** | **Strong** | From **$750** (10 pages), with retainer discounts — an explicit repeat-purchase signal |
| **Employees (offer letters, non-competes)** | **Moderate** | $350–$1,000 flat; but roughly once per job change |
| **Renters** | **Weak on WTP** | $300–$450 flat fee exists, but **every renter-facing resource found was free or income-gated legal aid** |
| **Startup founders (term sheets)** | **Weak / not comparable** | $15K–$75K per round — deal counsel, not an explainer tool |

**Anchors:** LegalShield $29.95–$99/mo · Rocket Lawyer $39.99/mo.

**A direct competitor already exists at this price point.** QwickContractReview.com charges a flat
**$99 per review** for plain-English summary, red-flag detection and obligation highlights,
explicitly targeting freelancers and small businesses. Founder: *"too many small businesses and
freelancers sign contracts they don't fully understand — and end up paying the price later."*
https://markets.financialcontent.com/clarkebroadcasting.mymotherlode/article/247pressrelease-2025-10-2-qwickcontractreviewcom-delivers-99-contract-reviews-in-48-hours-empowering-small-businesses-and-freelancers-nationwide

**Read:** ~$99/review or ~$20–40/mo sits below every lawyer fee and at parity with the one AI comp.

---

## 5. What contradicts the hypothesis

**1. The people with the sharpest pain and the people with the money may not be the same people.**
This is the central tension, and it got *sharper* when the pain evidence improved. Our acute,
quotable, first-person harm is overwhelmingly **consumer**: gyms, subscriptions, mortgages,
residential leases. Our strongest willingness-to-pay evidence is **freelancers, small businesses
and creators**. Those barely overlap. And note what we could not find after a dedicated retry:
**not one freelancer describing a specific clause that actually cost them money.** The two
freelance findings are both near-misses — people who caught it in time. The segment most likely
to pay has the weakest pain voice in the entire corpus.

**2. Renters are the most vividly evidenced segment and possibly the worst first customer.**
Three of the most compelling quotes are tenants. And the entire support ecosystem serving them is
free legal aid — no evidence any renter pays for lease review today.

**3. The intent arrives after the signature.** *"signed documents that we did not understand"*,
*"I just signed my lease agreement; and I notice"*, *"hindsight is a wonderful thing"*. People
reach for help once it has already gone wrong, when the product can no longer prevent anything.
Redline needs an answer to "why would someone pay *before* they've been burned?" — the pre-signature
moment is a harder sell than the evidence makes it look.

**4. The most common pain shape may not need this product.** Auto-renewal is the single most
frequent pattern in both regulator data and our findings, and the harm is almost always one
sentence with a date in it. That is a deadline tracker, not a contract analyst. If this is the
wedge, the product is a different product.

**5. Every willingness-to-pay figure is a lawyer's price, not a user's stated price.** No survey
of any segment naming a price for a contract-explainer tool was found. "A lawyer costs $670 so
$99 is cheap" is an inference — and the alternative most people actually choose is free: do
nothing, or paste it into ChatGPT.

**6. A $99 AI contract-review product aimed at these exact segments already shipped.** Validates
the mechanic and the price; also means you are not first. Nothing found on its traction.

**Does the evidence support building this?** Yes — more confidently than before on the pain, less
confidently on the buyer. The harm is real, well documented, and people describe it in almost
exactly the product's own terms. The market hole is real and the counter-offer feature appears
genuinely unserved. What remains unevidenced is the specific claim that someone will **pay,
before signing, to avoid a harm they have not yet felt.** That is one testable question, and it
is cheap: 15 conversations with freelancers and small-business owners, asking a price out loud.
Worth doing before the PRD, not after. Alternatively, a free model could significantly simplify marketing and user testing. If Redline has been helpful, users can leave a good review or make a donation. This would make the go-to-market process easier and allow us to identify the real pain points in the market without a paywall getting in the way. 

---

## Research quality notes

- **Pain:** 18 findings across 3 passes. Retry #1 reached Reddit only via pullpush.io (heavily
  rate-limited); retry #2 reached CFPB via WebFetch (curl is Akamai-blocked). **All CFPB quotes are
  verbatim only within a ~125-character extract** — not verified full narratives. Never reached:
  Reddit comment threads, r/smallbusiness, Avvo/JustAnswer/ConsumerAffairs/Quora.
- **Clauses:** 10 findings. The ranking is a synthesis across differently-scoped sources, not a
  measured study. No data found on personal guarantees, kill fees, or fee escalators.
- **Competitors:** 11 products. Most pricing is third-party estimate, not vendor-confirmed.
- **Willingness to pay:** 10 findings. The BusinessWire 82%/77% small-business figures come from a
  search snippet, not a direct read. unlikely to be that high.
