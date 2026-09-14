# 20: A saved library of past Documents

**What to build:** Capability 7. A signed-in Signer's analysed Documents are saved and can be
reopened. Only extracted text and the analysis result are stored, never the uploaded file.

**Blocked by:** 19

**Status:** done (2026-09-14). Built and tested without a Supabase project; the parts that need
one are listed as unverified in BUILD-REPORT.md.

Note: ADR-0002 Amendment 2 reopened whether the library earns its place. CLAUDE.md still lists it in
scope, and the owner's build instructions ask for it, so it is built.

- [x] SQL migration: a `documents` table (owner, title, extracted text, analysis result as JSON,
      created at) with RLS so a Signer reaches only their own rows. No column for a file.
      (`20260914130000_create_documents.sql`; no update policy, because editing stored text or a
      result would break its citations. Not yet run against a database.)
- [x] After a signed-in analysis, the Document is saved. Signed out, nothing is saved and the result
      says a Signer can sign in to keep it. (Signed-in save unverified without a project.)
- [x] `/library` lists saved Documents newest first, showing each one's Risk flag count so the risk
      shows before it is opened. Empty state is designed. A saved Document can be deleted.
      (List and delete unverified without a project.)
- [x] Reopening a saved Document shows its stored result, and every Source sentence still validates
      verbatim against the stored text. A stored result that fails validation is shown as a failure.
- [x] Test: the payload written to storage holds the text byte-identical to the analysed text and
      carries no file data; reopening re-validates spans and throws on a tampered text.
