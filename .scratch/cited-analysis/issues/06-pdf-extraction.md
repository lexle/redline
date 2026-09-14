# 06: PDF extraction that preserves the text exactly and refuses scans

**What to build:** The Signer can upload a PDF. Its text is extracted in the browser without
normalisation, so every Source sentence's offsets stay meaningful (ADR-0001). A scanned PDF is
refused plainly rather than analysed from guessed text.

**Blocked by:** 03

**Status:** done (2026-09-14)

**Dependency pre-approved (2026-09-11):** `pdfjs-dist`.

- [x] Extraction is a seam of its own: it runs in the browser, takes a file, and returns either its
      text or a no-text condition. It is tested separately from the analysis.
- [x] No whitespace collapsing, no de-hyphenation, no paragraph reflow. Test: for a PDF with irregular
      whitespace, hyphenated line breaks and reflowed paragraphs, the extracted text is byte-identical
      to the PDF's own text content. The test states the rule for joining the PDF's text items,
      because "the PDF's own text content" has to be defined somewhere. (pdfjs itself gives runs of
      spaces inside a text item back as one space and drops a space at the end of a line; its public
      API has no switch for this. Redline adds no normalisation of its own. See BUILD-REPORT.md.)
- [x] A scanned PDF yields the no-text condition, not an empty string or partial garbage. (A PDF with
      any image-only page counts as a scan.)
- [x] On the no-text condition the Signer is told plainly that the Document is a scan and cannot be
      read, and analysis does not run.
- [x] OCR is not attempted, as a fallback or in any other form.
- [x] Only the extracted text reaches the server. The PDF never does.
