# 18: A question box that answers only from the Document

**What to build:** Capability 5. The Signer asks a question about the Document and gets an answer
drawn only from its text. When the Document does not answer, Redline says so plainly, and that
reads as an answer, not a malfunction (ADR-0007).

**Blocked by:** 04, 12

**Status:** ready-for-agent

**Decided in the owner's absence (2026-09-14):** answers are grounded the way ADR-0010 grounds the
summary. ADR-0010 asked the capability-5 spec to decide this explicitly; the reason is that an
uncited answer is the unfalsifiable paraphrase ADR-0001 rejects.

- [ ] One function, `answerQuestion(documentText, question, modelClient)`, with the client passed in.
- [ ] Every answer sentence carries one or more spans, validated verbatim through the same citation
      mechanism as flags. A mismatch throws.
- [ ] Three outcomes, structurally distinct: an answer (grounded sentences with provenance tiers),
      "the Document does not say", and "this depends on facts about you Redline does not have"
      (jurisdiction, industry, leverage). The last two carry no speculation.
- [ ] Nothing in an answer tells the Signer what they should legally do.
- [ ] The question box sits on the result screen, and each answer sentence can show the text it
      rests on.
- [ ] Tests at the function, stub client built from the fixtures: grounded answer spans are found
      verbatim; a mismatched span throws; a not-in-document response yields that outcome with no
      answer sentences; a jurisdiction question yields the facts-needed outcome.
