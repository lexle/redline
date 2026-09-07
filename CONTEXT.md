# Redline

Redline explains what a person is about to sign. This file is the glossary: the words
the project uses for its own concepts, and the ones it deliberately avoids.

## Language

**Signer**:
The person Redline serves — someone about to sign a document they did not draft and
cannot fully read. In v1 this is a freelancer or small-business owner, not a renter.
_Avoid_: user, customer, client, layperson

**Document**:
The contract, lease, agreement or terms a Signer uploads. Only its extracted text is
stored, never the file.
_Avoid_: contract (too narrow — leases and ToS are documents too), file, upload

**Risk flag**:
A clause in the Document that could hurt the Signer, carrying the severity it was
ranked at and the source sentence it came from.
_Avoid_: issue, finding, red flag, problem

**Source sentence**:
The exact sentence from the Document that a risk flag came from, quoted verbatim and
locatable in the stored text. A flag that cannot show one is a bug (see ADR-0001).
_Avoid_: citation, quote, excerpt, reference

**Counter-offer**:
Drafted replacement language a Signer can send back for a flagged clause. Only
meaningful before signature, which is why Redline is a pre-signature product.
_Avoid_: redline (the verb), suggestion, revision, markup

**Missing protection**:
Something harmful the Document fails to say — most often payment timing. A distinct object from
a risk flag: it cites nothing, because it asserts nothing about the text (see ADR-0005).
_Avoid_: missing clause, gap, omission risk, absent flag

**Proposed insertion**:
Drafted language offered for a missing protection, always marked as not present in the Signer's
Document. The counter-offer's equivalent for an absence.
_Avoid_: suggested clause, addition, fill-in

**Multiplier note**:
A clause that causes no harm alone but worsens every other harm — arbitration, class-action
waiver, unilateral amendment. Surfaced outside the severity ranking (see ADR-0003).
_Avoid_: secondary flag, low-priority flag, informational flag

**Red line**:
A boundary the Signer states in advance and will not accept crossing. Redline's input, not its
output; it drives the analysis rather than resulting from it.
_Avoid_: preference, rule, requirement, risk flag

**Worth a look**:
A clause that is one-sided or unusual but bounded — the Signer's exposure has a ceiling and an
exit exists. Listed outside the risk flag ranking and collapsed by default (see ADR-0006).
_Avoid_: minor flag, low severity flag, possible issue, could be a problem

**Nice to have**:
A protection the Document omits that is not harmful enough to be a missing protection. Carries a
proposed insertion like any absence (see ADR-0008).
_Avoid_: minor gap, optional clause, suggestion

