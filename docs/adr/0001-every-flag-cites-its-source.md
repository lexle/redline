# 0001. Every risk flag cites its source sentence

Status: Accepted — 2026-08-28

## Decision

Every risk flag carries the exact sentence from the uploaded document it came from, quoted
verbatim and locatable in the source text. A flag whose source sentence cannot be shown is a bug,
not a formatting shortfall — it fails loudly rather than being shown uncited.

## Alternatives

- **Let the model describe risks in its own words, quoting nothing.** Fluent, cheaper, tolerant
  of messy input — and unfalsifiable. A reader cannot tell an accurate paraphrase from an
  invented one, and neither can we.
- **Cite the clause or section number.** Cheaper, but "Section 8.2" sends the reader back into
  the document they already could not read.
- **Cite where available, degrade gracefully where not.** Silent and inverted failure: uncited
  flags are the likeliest to be wrong, so the guarantee vanishes where it matters most.

## Why

A reader can take any flag, find that sentence in their own contract, and confirm we did not
invent it — verification they perform themselves, not trust they extend to us. It makes the
counter-offer usable: you negotiate against specific language, not a summary. And it turns
hallucination from an invisible failure into a visible one, because a claim with no sentence
behind it cannot be rendered at all.

## Consequences

- **OCR stays excluded.** A citation is worthless when the text it points at was misread.
  Scanned documents are refused, not best-guessed.
- **Extraction must preserve exact offsets** into the stored text. Parsing that normalises
  whitespace, de-hyphenates, or reflows paragraphs breaks the guarantee quietly.
- **The model returns spans, not prose**, and every response is validated against the source
  before display: a quote that does not appear verbatim is a failed generation.
- **Tests assert provenance, not presence.** For every flag, the cited sentence must be found in
  the document. This is the project's main invariant and belongs in CI from the start.
- **Some real risks go unreported.** Harms from what a document *omits* — missing payment terms
  being the clearest case in the research — have no sentence to cite. That is a known gap needing
  its own decision, not a reason to weaken this one.
