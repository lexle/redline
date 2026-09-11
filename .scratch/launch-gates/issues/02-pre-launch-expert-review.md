# 02: Pre-launch expert review of the severity ranking

**What to build:** A lawyer reviews Redline's output on a sample of real Documents against the ranking
it produced (PRD §4 test 5). Per ADR-0009 this is the only calibration the severity model will ever
receive, so it is a launch blocker with a real cost, not a nice-to-have.

**Blocked by:** cited-analysis 16 (launch-gate tests against the real model). The review needs the
finished analysis running on the real model.

**Status:** ready-for-human

- [ ] A lawyer is engaged and the cost agreed, ideally someone who reviews freelance or small-business
      service agreements.
- [ ] The reviewer is told the ranking is by probable cost to this Signer, not worst-case legal
      exposure (ADR-0003). Otherwise the review grades the product against a standard it deliberately
      rejected.
- [ ] A sample of real Documents is chosen and its size written down. It should not be only the test
      corpora, which were chosen to pass or fail specific gates.
- [ ] Nothing confidential is shared with the reviewer without permission.
- [ ] Recorded for each Document: does Redline's top-ranked Risk flag agree with the reviewer's?
- [ ] Recorded: is any whole clause type systematically mis-ranked? This includes any type Redline
      sends to Worth a look or Multiplier notes that the reviewer would rank, because the
      bounded/unbounded line (ADR-0006) gets no other check.
- [ ] Before launch, the findings become concrete changes to the threshold or ranking, or are recorded
      as accepted with no change.
