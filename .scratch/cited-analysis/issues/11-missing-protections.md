# 11: Missing protections with Proposed insertions

**What to build:** When the Document fails to say something that would protect the Signer, above all
payment timing, Redline reports a Missing protection (ADR-0005). Each one comes with a Proposed
insertion: drafted language the Signer can ask for, always marked as not present in their Document.
A Missing protection is a different kind of object from a Risk flag, not a Risk flag with an empty
field. It cites nothing because it asserts nothing about the text, and it sorts in its own list.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Missing protection is its own finding type with a stable identifier (`MP-01`, …). It has no
      span and no Source sentence, and it states plainly that the Document does not address the
      matter.
- [ ] The result type can express neither a Missing protection as a Risk flag with an empty Source
      sentence, nor a Risk flag without one.
- [ ] Every Missing protection carries a Proposed insertion, displayed as language not currently in
      the Document.
- [ ] Missing protections are shown as a separate list from Risk flags and never merged into one
      ranking.
- [ ] The absences checked include at least payment timing and amount, kill fee or termination
      compensation, a late-payment remedy, and scope-change or revision limits (PRD §5).
- [ ] No synthetic section number, placeholder paragraph or virtual citation is written into the
      stored text or shown as a Source sentence. Test: the stored text is byte-identical before and
      after analysis.
- [ ] Tests at the analysis seam, synthetic client: absences come back with no span, and a Document
      that omits payment timing yields a payment-timing Missing protection.
- [ ] The payment-absence corpus is run against the real model in ticket 16, not here.
