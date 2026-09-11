# 02: Assemble the payment-absence and clean-document corpora

**What to build:** The two sets of real Documents that PRD §4 tests 3 and 4 run against. The spec
calls them "a real deliverable", not fixtures to be improvised: they decide whether the launch gates
mean anything.

**Blocked by:** None (can start immediately).

**Status:** ready-for-human

Why a human: the clean-document test grades a judgement about which agreements count as fair and
standard. If an agent drafted the corpus, Redline's analysis would be checked against a model's idea
of fair, and the test would be circular.

- [ ] A payment-absence set: freelance service agreements that do not address payment timing, each
      with a short note recording which payment terms it omits.
- [ ] A clean-document set: fair, standard freelance and small-business agreements with no uncapped
      exposure and no lock-in, each with a note on why it counts as clean.
- [ ] The sets include all three formats v1 accepts (.txt, text-based PDF, DOCX). Scans belong in the
      extraction tests, not here.
- [ ] The set size is decided and written down alongside the corpora, so that "every one" in the
      launch gates refers to a known number.
- [ ] Each Document's source and licence are recorded. Nothing confidential or client-identifying is
      included, because the corpora are committed to the repo.
