# 14: Export a marked-up copy

**What to build:** The Signer can export a plain-text copy of their Document with its proposed changes
marked, so they have something concrete to send the counterparty (spec stories 22–23, ADR-0005). The
copy shows every Proposed insertion. For every Risk flag it shows the original clause, with the
Counter-offer marked as a proposed replacement. The export is a new artefact. The stored Document text
is never altered, so every Source sentence keeps pointing at what the Signer actually uploaded.

**Decided 2026-09-11:** plain text, with no new dependency. Counter-offers are included as well as
Proposed insertions. That goes beyond spec story 22, which names only insertions.

**Blocked by:** 08, 11

**Status:** ready-for-agent

- [ ] The export is the Document's stored text with proposed changes marked in plain text, generated
      and saved in the Signer's browser.
- [ ] Every Proposed insertion appears, visibly marked as proposed and not part of the original
      Document. Where it is placed is a suggestion and is never presented as a Source sentence.
- [ ] Every Risk flag's Counter-offer appears next to the clause it would replace, located by the
      flag's validated offsets. The original text stays in the export, and the replacement is marked
      as proposed.
- [ ] Someone reading only the export can always tell the Document's own text from proposed text.
- [ ] Overlapping or repeated spans neither duplicate nor lose original text.
- [ ] The stored Document text is byte-identical before and after export. This is tested.
- [ ] No synthetic section number or placeholder paragraph is written into the stored text.
