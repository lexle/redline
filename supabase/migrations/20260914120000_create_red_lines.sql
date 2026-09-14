-- Red lines: the boundaries a Signer states in advance and will not accept crossing.
--
-- What this migration does:
--   1. Creates public.red_lines, one row per red line, owned by the auth user who wrote it.
--      user_id defaults to auth.uid(), so the browser never sends it; deleting the auth user
--      deletes their red lines.
--   2. Checks the text the way lib/red-lines/validate.ts does: not blank, at most 300 characters.
--      The text is stored exactly as written (no trimming).
--   3. Keeps updated_at current with a trigger.
--   4. Enables row-level security. The browser reaches this table with the anon key only, so the
--      policies below are the whole access control: a signed-in Signer can select, insert, update
--      and delete their own rows and nothing else. Signed-out requests (role anon) get no grant
--      and no policy, so they see and change nothing.
--
-- Run by hand in the Supabase SQL editor (or `supabase db push`). No service key is used by the app.

create table public.red_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint red_lines_text_not_blank check (text ~ '\S'),
  constraint red_lines_text_length check (char_length(text) <= 300)
);

comment on table public.red_lines is
  'A Signer''s red lines, in their own words. Every analysis they run is checked against them.';

create index red_lines_user_id_created_at_idx on public.red_lines (user_id, created_at);

-- updated_at follows every change to a row.
create function public.red_lines_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger red_lines_set_updated_at
before update on public.red_lines
for each row
execute function public.red_lines_set_updated_at();

-- Row-level security: every read and write is limited to the signed-in Signer's own rows.
alter table public.red_lines enable row level security;

revoke all on table public.red_lines from anon;
revoke all on table public.red_lines from authenticated;
grant select, insert, update, delete on table public.red_lines to authenticated;

create policy red_lines_select_own
on public.red_lines
for select
to authenticated
using ((select auth.uid()) = user_id);

-- with check stops a Signer inserting a row under someone else's user_id.
create policy red_lines_insert_own
on public.red_lines
for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- using limits which rows can be changed; with check stops a row being handed to another user.
create policy red_lines_update_own
on public.red_lines
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy red_lines_delete_own
on public.red_lines
for delete
to authenticated
using ((select auth.uid()) = user_id);
