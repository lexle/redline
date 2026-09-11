# 16: Launch-gate tests against the real model

**What to build:** PRD §4 tests 3 (payment-absence detection fires) and 4 (clean Documents come back
clean) run over the real corpora through the real model. The responses are recorded so the tests
replay in CI deterministically and without network. The synthetic-client tests in earlier tickets
prove the pipeline; a synthetic responder returning zero flags on a clean corpus proves nothing about
the analysis. This ticket proves the analysis.

**Blocked by:** 02, 06, 07, 15

**Status:** ready-for-agent

- [ ] Recording mode: run the corpora through the production model client (OpenRouter,
      `OPENROUTER_MODEL`) and save each response, together with the model it came from. Changing
      `OPENROUTER_MODEL` means recording again.
- [ ] Replay mode: CI runs the same tests against the recorded responses, with no network and no API
      key.
- [ ] Payment-absence gate: every Document in the payment-absence corpus yields a payment-timing
      Missing protection. Every one, not a sample.
- [ ] Clean-document gate: every Document in the clean-document corpus yields zero Risk flags and a
      populated checklist.
- [ ] The citation invariant holds across every recorded response: for every finding that carries a
      Source sentence, that sentence is found verbatim in the stored text.
- [ ] Recordings contain no API key or other secret.
- [ ] If the clean-document gate fails, the fix goes in the danger threshold (ADR-0004), not in the
      test or the corpus. Stop and report the failure to the user as a finding about the product
      (spec, Further Notes).
