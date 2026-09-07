# Spec: Cited analysis and drafting

Status: ready-for-agent

Covers PRD capabilities 1–4 (summary, risk flags, counter-offers, missing protections) and the
extraction they depend on. Red lines (5), the question box (partial — see Out of Scope), and the
saved library (6) get their own specs.

Governing decisions: ADR-0001 (citation invariant), ADR-0003 (severity ranking), ADR-0004 (danger
test), ADR-0005 (absences), ADR-0006 (minor tiers), ADR-0007 (register), ADR-0008 (clean documents).
Vocabulary: `CONTEXT.md`.

## Problem Statement

A Signer has a Document in front of them that they did not draft and cannot fully read. They know
it may contain something that will hurt them, and they do not know which sentence it is. Today they
either sign it unread, paste it into a general chatbot that cannot show them where its claims came
from, or pay several hundred dollars for a lawyer's read they mostly cannot justify for a routine
agreement.

What they need is not a summary they must take on faith. They need to be told which sentences put
them at risk, be able to check each claim against their own copy in seconds, and be handed words
they can send back — because knowing what to object to is only half the problem, and the other half
is being willing to say it.

## Solution

The Signer uploads a Document. It is parsed in their browser; only the extracted text is stored,
never the file. Redline returns a plain-English summary, the Risk flags ranked by what is most
likely to cost this Signer, each showing the exact Source sentence it came from, and a drafted
Counter-offer for each. Where the Document is harmful by omission, it returns Missing protections
carrying Proposed insertions — drafted language marked as not present in their Document.

Every claim about the text is checkable. A Risk flag that cannot show its Source sentence is never
rendered; the analysis fails loudly instead. Where a question cannot be answered from the Document,
Redline says nothing rather than guessing.

## User Stories

1. As a Signer, I want to upload a Document from my machine, so that I can have it analysed without
   retyping or pasting it.
2. As a Signer, I want my original file never to leave my browser, so that I am not handing a
   confidential agreement to a third party's storage.
3. As a Signer, I want to be told plainly when my Document is a scan that cannot be read, so that I
   do not receive a confident analysis of text that was guessed at.
4. As a Signer, I want a plain-English summary of what the Document is and what it commits me to,
   so that I can orient before reading any findings.
5. As a Signer, I want the clauses that could hurt me listed in order of what is most likely to cost
   me, so that I read the important one first rather than the one a lawyer would find most
   interesting.
6. As a Signer, I want each Risk flag to show the exact sentence it came from, so that I can find
   that sentence in my own copy and confirm Redline did not invent it.
7. As a Signer, I want to be able to locate that sentence in the full Document text, so that I can
   read what surrounds it before deciding whether I agree.
8. As a Signer, I want Redline to refuse to show me a finding it cannot cite, so that I never have
   to guess which of its claims are grounded.
9. As a Signer, I want to be told what a flagged clause actually does to me in concrete terms, so
   that I understand the consequence rather than the category.
10. As a Signer, I want clauses that are one-sided but bounded kept out of the main list, so that
    the two or three findings that could sink me are not buried among fifteen that cannot.
11. As a Signer, I want those bounded findings still available if I want them, so that I can go
    deeper on a high-stakes agreement without them being the default view.
12. As a Signer, I want bounded findings described flatly — what the clause does and that it is
    capped — so that I am not reading hedged prose that tells me nothing.
13. As a Signer, I want to be told when my Document fails to say something that should protect me,
    so that I learn about the risk that has no sentence to point at.
14. As a Signer, I want to be told specifically when payment timing is unaddressed, so that I catch
    the single most expensive omission for people like me before I sign.
15. As a Signer, I want Missing protections presented as a separate list from Risk flags, so that I
    am never misled into thinking Redline found language that is not there.
16. As a Signer, I want minor omissions separated from harmful ones, so that a nice-to-have does not
    read with the same weight as an unpaid-invoice risk.
17. As a Signer, I want clauses that worsen every other problem — arbitration, class-action waiver,
    unilateral amendment — surfaced outside the ranking, so that I learn what they do to my position
    without them displacing the risks likely to actually occur.
18. As a Signer, I want a drafted Counter-offer for every Risk flag, so that I can push back without
    knowing how to draft contract language.
19. As a Signer, I want each Counter-offer to be language I could paste into an email, so that the
    gap between reading the finding and acting on it is as small as possible.
20. As a Signer, I want a Proposed insertion for each Missing protection, so that I can ask for the
    term that is absent rather than only being told it is absent.
21. As a Signer, I want every Proposed insertion clearly marked as not currently in my Document, so
    that I never send a clause back believing it is already there.
22. As a Signer, I want to export a marked-up copy showing my Document with the insertions in place,
    so that I can send the counterparty something concrete.
23. As a Signer, I want my stored Document text never altered by that export, so that the citations
    in my analysis keep pointing at what I actually uploaded.
24. As a Signer, I want to be told when nothing was found, so that I get a real result instead of
    manufactured concern.
25. As a Signer, I want to see the checklist of what was examined and found acceptable, so that
    "nothing found" reads as an analysis that ran rather than one that failed.
26. As a Signer, I want claims that read directly off a sentence stated flatly, so that I can act on
    them.
27. As a Signer, I want claims that require inference marked as inference, so that I know which
    parts are Redline's judgement rather than the Document's words.
28. As a Signer, I want silence where an answer would depend on my industry, jurisdiction or
    leverage, so that I am not given a confident answer to a question Redline cannot actually
    answer.
29. As a Signer, I want the analysis never to tell me what I should legally do, so that I am using
    an explainer rather than something posing as my lawyer.
30. As a Signer, I want a long Document analysed without silent truncation, so that a finding in the
    last five pages is not missed without my knowing.
31. As a Signer, I want to be told when analysis failed, so that I do not read a partial result as a
    complete one.
32. As a developer, I want the whole analysis reachable through one function, so that the citation
    invariant can be asserted at a single boundary.
33. As a developer, I want the model client passed in rather than imported, so that tests run
    deterministically without network access or mocking infrastructure.
34. As a developer, I want extraction tested separately from analysis, so that the no-normalisation
    property ADR-0001 depends on is asserted directly rather than inferred.
35. As a maintainer, I want a failed span validation to throw rather than degrade, so that the
    failure surfaces in CI instead of reaching a Signer as an uncited finding.

## Implementation Decisions

**Two seams, and only two.**

- `analyse(documentText, redLines, modelClient) → AnalysisResult` is the primary seam. Everything
  in PRD §4 is asserted here. The model client is a parameter, not an import, so tests supply a
  recorded or synthetic responder without a mocking layer. This deliberately avoids a third seam
  whose only purpose would be testability.
- `extractText(file) → string` is the second seam, running in the browser per CLAUDE.md. It is
  separate because its correctness requirement differs in kind: it must not normalise.

Span validation, severity ranking, output-type assignment and drafting are **internals behind seam
1**, not seams. Exposing them would couple tests to structure and would stop the citation invariant
being assertable at one boundary.

**Extraction preserves the text exactly.** No whitespace collapsing, no de-hyphenation, no paragraph
reflow. ADR-0001 names these as the quiet way the guarantee breaks: offsets survive the parse or the
citations are worthless. Where a Document yields no text — a scan — extraction reports that
condition and analysis does not run. OCR is refused, not attempted.

**The model returns spans, never prose claims about the text.** Every finding arrives as a character
offset pair into the stored text plus the model's description. Before anything is returned, each
span is resolved against the stored text and the quoted sentence must be found verbatim. A failed
check throws. There is no path that returns a finding without its Source sentence — that is the
whole of ADR-0001 and it is why the invariant is enforceable in code rather than by convention.

**The result carries five finding types, and their separation is structural, not cosmetic.**

- *Risk flags* — present in the text, uncapped exposure or no exit (ADR-0004). Ranked.
- *Worth a look* — present, but bounded. Not ranked with Risk flags. Collapsed by default.
- *Missing protections* — absent from the text. Carry **no span and no citation**, because they
  assert nothing about the text. This is what makes ADR-0005 hold without weakening ADR-0001: a
  Missing protection is a different kind of object, not a Risk flag with a field left empty. Nothing
  in the result type should permit an uncited Risk flag to be constructed.
- *Nice to have* — absent, minor. Same shape as Missing protections.
- *Multiplier notes* — present, but held outside the ranking entirely (ADR-0003).

**Ranking is by probable cost to this Signer**, not worst-case legal exposure. Arbitration and
unilateral amendment do not enter the ranking regardless of legal weight.

**Drafting rides on the finding it belongs to.** Counter-offers are produced with their Risk flag and
Proposed insertions with their Missing protection, rather than through a second pass. This keeps
drafting testable at seam 1 and means a Counter-offer cannot exist detached from a cited finding.

**Every claim carries its provenance tier** — read off the sentence, inference, or refused for want
of facts about the Signer (ADR-0007). The tier is part of the finding, not a rendering choice, so
the register cannot drift between the analysis and the display.

**Export produces a new marked-up artefact.** The stored Document text is never mutated. No synthetic
section number, placeholder paragraph or virtual citation is ever written into it.

**The model is called through OpenRouter only**, pinned via `OPENROUTER_MODEL`, never hardcoded at a
call site.

## Testing Decisions

**What makes a good test here.** Assert on what a Signer would observe through seam 1 — which
findings came back, of which type, in what order, citing what. Do not assert on prompt text, model
response shape, or internal ranking arithmetic; those will change and the tests should not.

There is no prior art in this repo — it is greenfield, so these tests set the pattern.

**Tests at seam 1 (`analyse`), using a synthetic model client:**

- *Citation invariant.* For every Risk flag returned across the whole corpus, the cited sentence is
  found verbatim in the stored text. Every one, not a sample. This is the project's main invariant
  and belongs in CI from the first commit.
- *Uncited findings are impossible.* Given a model client returning a span that does not match the
  stored text, `analyse` throws. It does not return the finding uncited, and does not silently drop
  it — a dropped finding is an invisible failure.
- *Absences carry no citation.* Missing protections and Nice-to-haves come back with no span, and
  no Risk flag is ever constructed without one.
- *Payment-absence detection.* On freelance agreements omitting payment timing, a Missing protection
  is raised on every one.
- *Clean documents come back clean.* On a corpus of fair, standard agreements, zero Risk flags are
  returned, with a populated checklist. If this cannot pass, the danger threshold is wrong.
- *Bounded clauses do not enter the ranking.* A clause with a stated liability cap is returned as
  Worth a look, not as a Risk flag.
- *Multipliers stay out of the ranking.* An arbitration clause is returned as a Multiplier note even
  when the Document contains no ranked Risk flags.
- *Refusal holds.* Questions answerable only from facts about the Signer produce refusal, not hedged
  speculation.
- *Long documents are not silently truncated.* A finding placed in the final pages of a long
  Document is returned.

**Tests at seam 2 (`extractText`):**

- *No normalisation.* For a Document with irregular whitespace, hyphenated line breaks and reflowed
  paragraphs, the extracted text is byte-identical to the source's text content. This is the test
  that keeps ADR-0001's offsets meaningful, and it cannot be asserted through `analyse`.
- *Scans are refused.* A scanned PDF yields the no-text condition rather than empty string or
  partial garbage.

**The corpora are a real deliverable.** The clean-document set and the payment-absence set are
prerequisites for tests that PRD §4 treats as launch gates, not fixtures to be improvised.

## Out of Scope

- **Red lines (capability 5).** `analyse` takes them as a parameter so the seam is right, but
  editing, storing and applying them is its own spec.
- **The question box (capability 4).** Provenance tiering and refusal are built here because they
  govern all output; the Q&A surface is separate.
- **The saved library (capability 6).** Nothing here persists beyond a single analysis.
- **Authentication, accounts, payments, billing.** Not needed to prove the analysis can be trusted.
- **OCR.** Refused by ADR-0001, not deferred.
- **Deadline and date extraction.** A different product per PRD §7.
- **Outcome capture.** Rejected in ADR-0009; the severity model has no feedback path in v1.
- **Sharing a Document between users.**

## Further Notes

**The severity threshold is the thing most likely to be wrong**, and the clean-document test is what
will reveal it. If a corpus of fair agreements produces Risk flags, the ADR-0004 danger test is
being applied too loosely — fix the threshold, not the test. Per ADR-0009 this is also the only
calibration the model gets before launch, so treat a failure here as a finding about the product,
not a nuisance.

**The result type is doing load-bearing work.** ADR-0005 holds because a Missing protection cannot be
expressed as a Risk flag with an empty citation. If a future change makes the citation optional on a
single finding type, the invariant is gone and nothing will fail loudly to say so.

**Pre-launch expert review is a dependency of this spec, not a follow-up.** It needs real Documents
and a real lawyer, and it is the only check the ranking will ever receive.
