# 07: DOCX extraction that preserves the text exactly

**What to build:** The Signer can upload a DOCX Document. Its text is extracted in the browser with the
same no-normalisation guarantee as PDF, so Source sentence offsets stay meaningful (ADR-0001).
DOCX was added to v1's formats on 2026-09-11.

**Blocked by:** 03

**Status:** done (2026-09-14)

**Approach decided 2026-09-11:** unzip the DOCX with `fflate` and read its document XML with the
browser's built-in DOMParser. Do not use a DOCX-parsing library. Every rule for whitespace and
paragraph breaks affects the offsets ADR-0001 depends on, so we write those rules ourselves.

**Dependencies pre-approved (2026-09-11):** `fflate`. Tests get DOMParser from `jsdom`, which is
approved in 01.

- [x] DOCX goes through the same extraction seam as .txt and PDF.
- [x] Text is taken from the Document's text runs in document order, including text inside tables.
      Which other parts are read (footnotes, headers, footers) is decided and written down. (Body
      only, including tables and text boxes; footnotes, endnotes, comments, headers and footers are
      excluded. Tracked changes read as accepted. Rules in `joinDocxBlocks`, `lib/extraction/docx.ts`.)
- [x] The rules for tabs, line breaks and paragraph boundaries are defined in one place and stated in
      the test.
- [x] No whitespace collapsing, no de-hyphenation, no paragraph reflow. Whitespace is kept exactly as
      the text runs hold it. Test: for a DOCX with irregular whitespace and a sentence split across
      several formatting runs, the extracted text is byte-identical to the expected text under those
      rules.
- [x] A DOCX with no extractable text, such as a page pasted in as an image, yields the no-text
      condition, and the Signer is told plainly. OCR is not attempted.
- [x] A file that is not a valid DOCX fails with a clear message, never a partial extraction.
- [x] Only the extracted text reaches the server. The DOCX never does.
