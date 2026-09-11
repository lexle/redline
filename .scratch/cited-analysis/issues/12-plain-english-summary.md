# 12: A plain-English summary whose every sentence is grounded

**What to build:** A short plain-English summary of what the Document is and what it commits the
Signer to, shown before any findings so they can orient themselves.

**Governing decision:** ADR-0010. Every summary sentence points at one or more spans in the stored
text, and each span is validated verbatim, just like a Risk flag.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Each summary sentence carries one or more spans. Each span is resolved against the stored text
      and must match verbatim.
- [ ] A summary sentence whose span does not match makes the analysis throw, as a Risk flag's would.
      There is no path to an ungrounded summary sentence.
- [ ] Each summary sentence carries a provenance tier. Anything that would need facts about the Signer
      is left out.
- [ ] The Signer can see which part of the Document each summary sentence rests on.
- [ ] Tests at the analysis seam, synthetic client: every summary sentence's spans are found verbatim,
      and a mismatched span throws.
