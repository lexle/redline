# 19: Sign-in and the Signer's red lines

**What to build:** Capability 6, and the sign-in it needs. A signed-in Signer keeps an editable list
of red lines, boundaries they will not accept crossing, and those red lines drive every analysis.

**Blocked by:** 04

**Status:** done (2026-09-14). Built and tested without a Supabase project; the parts that need
one are listed as unverified in BUILD-REPORT.md.

**Decided in the owner's absence (2026-09-14):** sign-in is Supabase email one-time link, through
`@supabase/supabase-js` in the browser. No password handling to build or secure. Tables are reached
from the browser under row-level security, so no service key exists anywhere.

- [x] SQL migration under `supabase/migrations/`: a `red_lines` table owned by `auth.uid()`, with
      RLS enabled and policies so a Signer reads and writes only their own rows.
      (`20260914120000_create_red_lines.sql`; not yet run against a database.)
- [x] `/sign-in` sends a one-time link. With the Supabase variables absent, it says accounts are not
      set up yet. Auth is never mocked in the product. (Link sending unverified without a project.)
- [x] `/red-lines` lets a signed-in Signer add, edit and delete red lines. Signed out, it asks them
      to sign in. Empty state is designed. (CRUD unverified without a project.)
- [x] A signed-in Signer's red lines are passed to `analyse`. Signed out, analysis runs with none.
- [x] Red lines drive the analysis: a finding that crosses one says which, and a red line crossed by
      a clause is never demoted out of the Risk flags into Worth a look. A red line cannot create a
      finding without a validated Source sentence. (A Worth a look naming a red line fails the
      analysis; the model must send it as a Risk flag.)
- [x] Tests at the analysis seam, stub client: a red line reaches the model request, and a finding
      the model ties to a red line comes back carrying it with its Source sentence validated.
