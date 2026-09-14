# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Settled in CLAUDE.md, which is authoritative: Next.js (npm), Supabase for auth and database,
deployed on Vercel, model called through OpenRouter. No code exists yet; the first build tickets
are in `.scratch/cited-analysis/issues/`.

## Users

**The Signer**: a US freelancer, contractor or small-business owner reading a document they did
not draft and cannot fully read, **before** they sign it. The document is usually the
counterparty's template. They know it may hurt them and don't know which sentence will.

- Not served in v1: renters, consumers with subscription auto-renewals, and anyone who has
  already signed (ADR-0002).
- Assumed to sign several documents a year. That assumption is part of the buyer decision
  reopened on 2026-09-07 and is not settled.
- Desktop first: reading a contract and sending a Counter-offer happens at a desk. Every screen
  must still work on a phone.

## Product Purpose

Redline shows the Signer what they are actually signing, and hands them words to push back
with. People sign documents they know they don't understand. Pushing back works when someone
reads carefully enough to try, but most people never do that read, and many who do hesitate
to object.

v1 exists to prove the analysis can be trusted. Success is defined by the seven tests in
PRD.md §4. The first is a build gate: every Risk flag cites a real sentence, 100%, in CI.

## Positioning

- **Every claim about the text can be checked.** Each Risk flag shows its exact Source
  sentence, and every summary sentence points at the text it rests on (ADR-0001, ADR-0010). The
  Signer checks Redline against their own copy instead of trusting it.
- **It drafts the reply.** Every Risk flag gets a Counter-offer, and every Missing protection
  gets a Proposed insertion, written as language the Signer can send.
- **The Signer's own red lines drive the analysis.**
- **It is quiet on purpose.** It flags only what is uncapped or inescapable, and a clean
  document comes back clean (ADR-0004, ADR-0008).

The alternatives are doing nothing, pasting the document into ChatGPT for free, hiring a lawyer
($670 average), paying for QwickContractReview ($99 per review), or using Rocket Copilot
Contract Review, which is **free** and already explains documents and flags risks.

**Unconfirmed:** whether Rocket Copilot quotes exact sentences or drafts replies has not been
tested (`.scratch/launch-gates/issues/01-test-rocket-copilot.md`). The positioning above holds
only if it doesn't.

## Operating Context

- The Signer uploads a text-based .txt, PDF or DOCX file. It is parsed in their browser, and
  only the extracted text is stored. Scanned documents are refused, never OCR'd.
- They read a plain-English summary, then the ranked Risk flags. They check a Source sentence
  against the full text, and copy a Counter-offer into an email to the counterparty.
- Findings come in two lists that are never merged: Risk flags, and Missing protections.
  Three minor tiers are collapsed by default: Worth a look, Nice to have, and Multiplier notes.
- They can export a plain-text marked-up copy with Proposed insertions and Counter-offers
  marked as proposed. The stored text is never altered.
- Redline does not know the Signer's jurisdiction, industry or leverage. Where an answer
  depends on those, it says nothing.

## Capabilities and Constraints

The seven capabilities, and the rules that outrank convenience, are in CLAUDE.md. The domain
vocabulary is defined in CONTEXT.md; use its terms and avoid its listed synonyms. In
particular, "redline" is the product name and never the verb for a Counter-offer.

- Excluded on purpose: payments and billing, OCR, sharing between users, deadline tracking,
  outcome capture after launch, and lease or subscription clause libraries (PRD §7).
- Language and market: English, US.
- **Undecided:** who pays and how, whether v1 is paid, free or free with paid conversion, and
  whether the saved library earns its place (ADR-0002, reopened). Accounts wait on the same
  decision.

## Brand Commitments

- Name: **Redline**. Existing one-line description: "Upload a contract, lease, freelance
  agreement, or terms of service; get back what you are actually signing." No logo or visual
  assets exist.
- Voice follows provenance (ADR-0007). What the sentence says is stated flat. Inference is
  marked as inference. Where the Signer's facts would be needed, it stays silent. Bounded
  findings are stated as facts, never hedged.
- Redline explains documents. It never claims to replace a lawyer or tells the Signer what
  they should legally do. DoNotPay's $193K FTC settlement attached to exactly that claim.
- Every piece of user-facing copy goes through the humanizer skill before it is committed
  (CLAUDE.md, Copy). Copy that reads as model-written is a defect.

## Evidence on Hand

- `research/summary.md` and the agent files beside it: 18 sourced pain findings with verbatim
  quotes and URLs (CFPB, Reddit, Hacker News, FTC, NPR), a clause ranking, 11 competitors, and
  willingness-to-pay figures.
- Usable figures, with sources in the research: 71% of freelancers hit payment trouble, losing
  $5,968 a year on average (Freelancers Union); 51% of small businesses avoid counsel because
  it is too expensive; a lawyer's review averages $670 across 635 bids (ContractsCounsel).
- CFPB quotes are verbatim only within a roughly 125-character extract.
- The 82%/77% small-business figures come from a Rocket Lawyer-commissioned survey of US
  adults. They are not demand evidence.
- The sharpest quotes come from renters and consumers, whom v1 does not serve. Never present
  them as Redline users.
- **Absent, and never to be invented:** users, testimonials, customers, traction, pricing, a
  price any user has stated, screenshots, a logo, and any freelancer account of a clause that
  actually cost them money. Never claim that nobody serves this user, or that Redline was
  first; Rocket Copilot and QwickContractReview both exist.

## Product Principles

1. **Checkable beats persuasive.** A claim the Signer cannot verify against their own copy is
   not shown.
2. **Quiet is the feature.** Two or three findings that could sink the Signer, not fifteen
   that couldn't. A clean result is a real result.
3. **Confidence follows provenance.** How firmly something is said depends on what it rests
   on, never on how sure the model feels.
4. **End in words the Signer can send.** Every finding should leave the Signer holding
   language they could put in an email.
5. **Explain, never advise.** Redline tells the Signer what the document says and does, and
   stops there.
