# 17: Paste a Document

**What to build:** The Signer can paste a Document's text instead of uploading a file (app shell
brief, added 2026-09-11). This is also the path that must work with no Supabase configuration.

**Blocked by:** 03

**Status:** done (2026-09-14)

- [x] The entry screen offers paste beside upload. Pasted text is stored exactly as pasted: no
      trimming, no line-ending or whitespace changes. (Browsers turn CRLF into LF inside a textarea
      before the app sees the text; the app changes nothing after that.)
- [x] Pasted text goes through the same `analyse` path as extracted text.
- [x] Empty or whitespace-only paste is refused with a plain message and analysis does not run.
- [x] With `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` absent, a pasted Document
      analyses end to end. (Server serves `/app` with both unset; the handler runs end to end with the
      stub client. Not run against the real model, which returned 429 all session.)
- [x] Test: the text handed to analysis is byte-identical to the pasted text, including CRLF and
      irregular whitespace.
