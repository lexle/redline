---
version: 1
slug: "app-app-layout-tsx"
primary_target: "app/(app)/layout.tsx"
related_targets: []
---

# App shell

## Scope

The signed-in frame of the app. Visitor mode: **Operate**. This is a brief only: no app screen is
built yet.

## Task

The Signer brings one document and leaves knowing what could cost them, holding words to send
back. They use it a handful of times a year; that frequency is under review in ADR-0002. Desktop
first, and every region must still work on a phone.

## What the frame holds

1. **Bring a document:** upload a text-based PDF, DOCX or .txt, or paste text. Scans are refused
   plainly and never guessed at. Paste is not in the current tickets; this brief added it on
   2026-09-11, and the ticket set needs to pick it up.
2. **The result**, in this order:
   - The plain-English summary, each sentence grounded (ADR-0010).
   - Ranked Risk flags, each with its Source sentence and Counter-offer.
   - Missing protections with Proposed insertions, in their own list.
   - Worth a look, Nice to have and Multiplier notes, collapsed by default.

   A clean result says nothing was found and shows the checklist of what was examined
   (ADR-0008). A failed analysis shows as a failure, never as a partial result.
3. **The question box:** it answers only from the document. When the document does not answer,
   it says so plainly, and that silence has to read as an answer, not a malfunction (ADR-0007).
4. **Red lines:** the Signer's own boundaries, as an editable list that drives the analysis.
5. **Library:** past documents, stored as extracted text only.
6. **Sign-in:** everything above sits behind it.

## States to design

No document yet, no red lines yet, an empty library, extracting, analysing, result, clean result,
scan refused, analysis failed, and a question the document cannot answer.

## Direction

This comes from the landing page's direction round (Page Flags, seed key 473d9d8a), carried into
Operate at a quieter register:

- The document is the page, centered. Risk flags sit on its edge at the lines they cite, numbered
  by rank, and the ranked list runs in a rail beside the page. Selecting either one lights the
  line.
- Missing protections are flags with no line under them: outlined tape in their own list, labeled
  as not in the document. They never sit on the page.
- Red lines are the Signer's own set of flags, kept in one place and applied to every document.
- Library entries are stacked pages whose flag tabs peek out at the edge, so the risk shows
  before a document is opened.
- Minor tiers are shorter, quieter tabs, collapsed by default.
- Operate rules win over the world: standard controls, one sans for UI, restrained color, and
  150–250ms motion that shows state changes only.

## Unresolved

- Accounts and the library wait on who pays (ADR-0002, reopened).
- Whether question-box answers cite spans the way the summary does is for the capability-5 spec
  to decide (ADR-0010).
- The route structure and the sign-in screen are not designed.
