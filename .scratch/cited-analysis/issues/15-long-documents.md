# 15: Long Documents without silent truncation

**What to build:** A long Document is analysed in full. A finding in the last five pages comes back,
and if a Document cannot be analysed in full, the Signer is told so instead of receiving a partial
result presented as complete (spec stories 30–31).

**Blocked by:** 08, 12, 13

**Status:** ready-for-agent

Why this comes last: splitting a Document for the model affects every finding type. Offsets from each
part must map back to the whole stored text, and an absence can only be declared across the whole
Document. A Missing protection raised because one part lacks payment terms that another part contains
is a false claim about the text.

- [ ] A Document longer than the model's context window is analysed end to end, and no part is
      silently skipped.
- [ ] Spans from any part resolve to offsets in the full stored text and pass verbatim validation.
- [ ] Missing protections and Nice to have items are raised only when the whole Document lacks the
      term.
- [ ] The summary, Worth a look and Multiplier notes behave correctly across parts.
- [ ] If any part fails, the whole analysis reports failure, never a partial result.
- [ ] Tests at the analysis seam, synthetic client: a Risk flag planted in the final pages of a long
      Document comes back with a correct Source sentence, and payment terms that appear only in a late
      part prevent the payment-timing Missing protection.
