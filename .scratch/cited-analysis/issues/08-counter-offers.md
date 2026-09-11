# 08: A Counter-offer for every Risk flag

**What to build:** Every Risk flag comes with a drafted Counter-offer: replacement language the Signer
could paste straight into an email to push back on that clause. Knowing what to object to is half the
problem; being handed the words lowers the other half.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Every Risk flag returned carries a Counter-offer. A model response that omits one counts as a
      failed generation, not as a flag shown without its Counter-offer.
- [ ] The Counter-offer is produced in the same pass as its Risk flag, not a second one. The result
      type means a Counter-offer cannot exist detached from a cited Risk flag.
- [ ] The Counter-offer is replacement language the Signer can send, not advice about what to do, and
      the Signer can copy it with one action.
- [ ] A Counter-offer asserts nothing about the Document beyond what its Risk flag's Source sentence
      supports.
- [ ] Tests at the analysis seam, synthetic client: every Risk flag has a Counter-offer, and no
      Counter-offer appears without its Risk flag.
