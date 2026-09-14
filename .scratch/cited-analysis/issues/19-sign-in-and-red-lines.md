# 19: Sign-in and the Signer's red lines

**What to build:** Capability 6, and the sign-in it needs. A signed-in Signer keeps an editable list
of red lines, boundaries they will not accept crossing, and those red lines drive every analysis.

**Blocked by:** 04

**Status:** ready-for-agent

**Decided in the owner's absence (2026-09-14):** sign-in is Supabase email one-time link, through
`@supabase/supabase-js` in the browser. No password handling to build or secure. Tables are reached
from the browser under row-level security, so no service key exists anywhere.

- [ ] SQL migration under `supabase/migrations/`: a `red_lines` table owned by `auth.uid()`, with
      RLS enabled and policies so a Signer reads and writes only their own rows.
- [ ] `/sign-in` sends a one-time link. With the Supabase variables absent, it says accounts are not
      set up yet. Auth is never mocked in the product.
- [ ] `/red-lines` lets a signed-in Signer add, edit and delete red lines. Signed out, it asks them
      to sign in. Empty state is designed.
- [ ] A signed-in Signer's red lines are passed to `analyse`. Signed out, analysis runs with none.
- [ ] Red lines drive the analysis: a finding that crosses one says which, and a red line crossed by
      a clause is never demoted out of the Risk flags into Worth a look. A red line cannot create a
      finding without a validated Source sentence.
- [ ] Tests at the analysis seam, stub client: a red line reaches the model request, and a finding
      the model ties to a red line comes back carrying it with its Source sentence validated.
