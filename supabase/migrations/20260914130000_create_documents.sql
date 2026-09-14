-- Saved Documents: the library of a Signer's past analyses (capability 7).
--
-- What this migration does:
--   1. Creates public.documents, one row per analysed Document, owned by the auth user who ran it.
--      user_id defaults to auth.uid(), so the browser never sends it; deleting the auth user deletes
--      their Documents.
--   2. Stores only the extracted text and the analysis result. There is no column for the uploaded
--      file, its bytes, or a storage path (CLAUDE.md: only the extracted text is stored). The title
--      is the name the result screen showed, checked the way lib/library/payload.ts checks it: not
--      blank, at most 200 characters.
--   3. Stores the Risk flag count beside the result so the library can show the risk before a
--      Document is opened without fetching every result. lib/library/reopen.ts refuses a row whose
--      count disagrees with its result.
--   4. Enables row-level security. The browser reaches this table with the anon key only, so the
--      policies below are the whole access control: a signed-in Signer can select, insert and
--      delete their own rows and nothing else. Signed-out requests (role anon) get no grant and no
--      policy, so they see and change nothing.
--
-- No update, by design: there is no update grant and no update policy. A saved analysis is a record
-- of what Redline said about exactly that text. Every Source sentence in the result is a pair of
-- offsets into the stored text, so editing either one could leave a citation pointing at words the
-- Document never contained. Nothing in the product edits a saved Document; to change one, the
-- Signer checks the Document again, which saves a new row, and deletes the old one.
--
-- Run by hand in the Supabase SQL editor (or `supabase db push`), after
-- 20260914120000_create_red_lines.sql. No service key is used by the app.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  text text not null,
  result jsonb not null,
  risk_flag_count integer not null,
  created_at timestamptz not null default now(),
  constraint documents_title_not_blank check (title ~ '\S'),
  constraint documents_title_length check (char_length(title) <= 200),
  constraint documents_text_not_blank check (text ~ '\S'),
  constraint documents_result_is_object check (jsonb_typeof(result) = 'object'),
  constraint documents_risk_flag_count_not_negative check (risk_flag_count >= 0)
);

comment on table public.documents is
  'A Signer''s saved Documents: the extracted text and the analysis result, never the uploaded file.';

create index documents_user_id_created_at_idx on public.documents (user_id, created_at desc);

-- Row-level security: every read and write is limited to the signed-in Signer's own rows.
alter table public.documents enable row level security;

revoke all on table public.documents from anon;
revoke all on table public.documents from authenticated;
grant select, insert, delete on table public.documents to authenticated;

create policy documents_select_own
on public.documents
for select
to authenticated
using ((select auth.uid()) = user_id);

-- with check stops a Signer inserting a row under someone else's user_id.
create policy documents_insert_own
on public.documents
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy documents_delete_own
on public.documents
for delete
to authenticated
using ((select auth.uid()) = user_id);
