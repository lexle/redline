# 05: Locate a Source sentence in the full Document

**What to build:** From any Risk flag, the Signer can jump to its Source sentence highlighted in the
full Document text, then read what surrounds it before deciding whether they agree (spec story 7).
This lets the Signer check a flag themselves instead of taking it on trust.

**Blocked by:** 03

**Status:** done (2026-09-14)

- [x] The full stored Document text can be viewed alongside the analysis. Its whitespace is displayed
      as stored, so offsets line up.
- [x] Selecting a Risk flag scrolls to its Source sentence and highlights it. (Covered by jsdom render
      tests; not checked in a real browser.)
- [x] The highlight is placed from the validated offsets, not by searching for the text. When the same
      sentence appears twice, the right occurrence is highlighted. This is tested.
- [x] Displaying the Document never alters the stored text.
