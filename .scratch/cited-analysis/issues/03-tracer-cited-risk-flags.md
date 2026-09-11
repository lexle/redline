# 03: Tracer bullet: a .txt Document returns cited Risk flags

**What to build:** The Signer uploads a plain-text Document and gets back ranked Risk flags, each
showing the exact Source sentence it came from. This is the thinnest end-to-end path: extraction in
the browser, analysis on the server through OpenRouter, span validation, and display. It puts the
citation invariant (ADR-0001) in CI from the first real analysis.

**Blocked by:** 01

**Status:** ready-for-agent

Governing decisions: ADR-0001, ADR-0003, ADR-0004.

- [ ] The Signer picks a .txt file. Its text is extracted in the browser, and only the text is sent to
      the server. The file itself never leaves the browser.
- [ ] The analysis is reachable through one function. It takes the Document text, the Signer's red
      lines (an empty list for now) and a model client passed in as a parameter, not imported.
- [ ] The production model client calls OpenRouter over HTTP. There is no provider SDK, the model is
      read from `OPENROUTER_MODEL` with no model name hardcoded at the call site, and the API key
      never reaches the browser.
- [ ] The model returns character-offset spans plus a description, never prose claims about the
      text. Each span is resolved against the stored text and must match verbatim before anything is
      returned.
- [ ] A span that does not match makes the analysis throw. The finding is neither returned uncited nor
      silently dropped.
- [ ] The result type cannot represent a Risk flag without a Source sentence.
- [ ] Risk flags are shown ranked by probable cost to this Signer, each with its Source sentence quoted
      verbatim.
- [ ] When analysis fails, the Signer is told it failed. A partial result is never shown as complete.
- [ ] Tests at the analysis seam, using a synthetic model client and no network: every returned Risk
      flag's Source sentence is found verbatim in the stored text, and a mismatched span throws.
- [ ] These tests run in CI.
