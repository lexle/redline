# Build report

Unattended build run started 2026-09-14. This file is updated as work lands.

## Tickets

All under `.scratch/cited-analysis/issues/` unless noted. "Done" means built by a subagent, then
verified in the orchestrating session with typecheck, the full test suite, the build and a scan for
stubs, TODOs and mocks before the commit.

| Ticket | State | Notes |
|---|---|---|
| 01 Scaffold, test runner, CI | done | vitest, GitHub Actions; CI passed on GitHub |
| 02 Real test corpora | **not done** | `ready-for-human` on purpose (decision 2) |
| 03 Tracer: cited Risk flags | done | |
| 04 Provenance tiers | done | |
| 05 Locate the Source sentence | done | jsdom-tested; not checked in a real browser |
| 06 PDF extraction | done | pdfjs whitespace caveat (decision 16) |
| 07 DOCX extraction | done | body only; tracked changes read as accepted |
| 08 Counter-offers | done | |
| 09 Worth a look | done | |
| 10 Multiplier notes | done | |
| 11 Missing protections | done | |
| 12 Grounded summary | done | |
| 13 Clean documents and checklist | done | |
| 14 Export a marked-up copy | done | |
| 15 Long Documents | done | |
| 16 Launch gates on the real model | **blocked** | needs 02's corpora; also no model access (429) |
| 17 Paste a Document | done | |
| 18 Question box | done | |
| 19 Sign-in and red lines | done | Supabase parts unverified (see below) |
| 20 Saved library | done | Supabase parts unverified (see below) |
| launch-gates 01 Test Rocket Copilot | **not done** | `ready-for-human` |
| launch-gates 02 Expert review | **not done** | `ready-for-human`, blocked by 16 |

## Decisions made without the owner

1. **Analysis works signed out.** The app shell brief says everything sits behind sign-in. The
   owner's build instructions say a pasted Document must analyse with no Supabase variables, and
   only the library and red lines need an account. The build instructions are newer and more
   specific, so they win.
2. **Ticket 02 (real corpora) stays open.** It is `ready-for-human` on purpose: an agent-drafted
   clean corpus would grade the analysis against a model's idea of fair. The two fixtures under
   `tests/fixtures/` are test inputs, not the launch-gate corpora.
3. **Ticket 16 is blocked by 02.** Launch-gate recordings need the real corpora.
4. **Capabilities 5, 6, 7 and paste input had no tickets.** The owner's instructions ask for them,
   and all are in CLAUDE.md scope, so tickets were written for them before building.
5. **The model id lives only in `.env.example`.** CLAUDE.md gives a default model; the owner said
   never write a model id into code. Code fails with a clear error when `OPENROUTER_MODEL` is unset.
6. **`@supabase/supabase-js` is treated as approved.** The owner told the build to use the Supabase
   client. No other unlisted dependency was added.
7. **Tickets 17 to 20 now exist on disk.** An earlier run recorded decision 4 but died before saving
   the files. They are `17-paste-a-document`, `18-question-box`, `19-sign-in-and-red-lines` and
   `20-saved-library` under `.scratch/cited-analysis/issues/`.
8. **A shared build brief carries the architecture.** `.scratch/cited-analysis/build-brief.md` holds
   the owner's two answers and the conventions every ticket builds on, so each subagent starts from
   the same ground and a rerun can resume without this session's memory.
9. **The model cites sentence ids, not raw character offsets.** The server splits the stored text into
   sentence units with exact offsets. The model cites a unit id and echoes the quote, and the quote
   must equal the stored slice at those offsets byte for byte, or the analysis throws. Models are poor
   at counting characters, so asking for raw offsets would fail almost every real run. This keeps
   ADR-0001's verbatim check exact: nothing is normalised, fuzzy-matched or dropped.
10. **The app entry is `/app`.** The landing page already links there, so the landing stays untouched.
11. **The configured model is served by Fireworks.** `.env.local` sets `z-ai/glm-5.3-flash`, and
    OpenRouter lists Fireworks for it with structured outputs, so the provider pin works. The default
    in CLAUDE.md, `anthropic/claude-sonnet-4.5`, is not served by Fireworks: with
    `allow_fallbacks: false` every call against it would fail. `.env.example` keeps the CLAUDE.md
    default and says so in a comment.
12. **Question-box answers are grounded like the summary.** ADR-0010 asked the capability-5 spec to
    decide explicitly. An uncited answer is the paraphrase ADR-0001 rejects, so answers cite spans.
13. **Sign-in is a Supabase email one-time link, with tables reached from the browser under RLS.**
    There is no password handling to secure and no service key anywhere.
14. **Inconsistent model output fails the analysis; nothing guesses at what the model meant.**
    Tickets 04 to 13 fail an analysis as malformed when it is missing a required list, has a blank
    Counter-offer or Proposed insertion, cites one sentence under two finding types, withholds every
    claim on a finding, or has a checklist that contradicts the findings. Each rule follows the
    fail-loudly line in ADR-0001 and the spec. The cost is that a real model will trip these more
    often than a lenient parser would. How often is unmeasured, because the real model could not be
    reached (see Not verified). If it trips them too often, fix the prompt, not the checks.
15. **The checklist cites its positive claims.** A check saying a protection is present, or a harm is
    bounded, cites the sentence it rests on through the same verbatim check as a Risk flag. Saying
    "payment terms present" is a claim about the text, and CLAUDE.md says state only what the
    Document says. Auto-renewal is folded into the lock-in check.
16. **PDF whitespace is whatever pdfjs gives back, and that was accepted.** `pdfjs-dist` returns a run
    of spaces inside a text item as one space and drops a space at the end of a line. Its public API
    has no switch to keep them. Redline adds no normalisation of its own: no de-hyphenation, no
    reflow, no trimming. The join rule is written in `lib/extraction/pdf.ts` and in the test.
    ADR-0001 needs the stored text to be what extraction produced and citations to be measured
    against that text, and both still hold, so every Source sentence stays exact. What is lost:
    the stored text of a PDF can differ in spacing from what a PDF viewer copies out. If that
    matters, the alternative is reaching into pdfjs internals, which would break on upgrades.
17. **A PDF with any image-only page counts as a scan and is refused whole.** Analysing only the
    pages that have text, without saying so, is the silent partial result the spec forbids.

## Not verified

- **Real-model smoke, first attempts (after ticket 03):** three runs of `npm run smoke` all got
  `429 Too Many Requests: Provider returned error`. The key itself is fine (OpenRouter reports a
  $5 limit, $0 used, no key rate limit), so the 429 comes from Fireworks, and with
  `allow_fallbacks: false` OpenRouter cannot route around it. Retried at the end of the run; see
  below.
- **Diagnosis of the 429.** A 20-token "Say ok" request with the same pin also got 429, with
  `provider_error_code: RATE_LIMIT_EXCEEDED` and `limit_source: upstream_provider_shared_pool`.
  OpenRouter's shared Fireworks pool for `z-ai/glm-5.3-flash` is saturated, and the size of
  Redline's prompts has nothing to do with it. OpenRouter suggests two ways out: add your own
  Fireworks key under
  https://openrouter.ai/settings/integrations (BYOK, which gets its own limits), or change the
  provider pin. Both are your call, because you set the pin, so neither was done.
- **Everything that needs a Supabase project (ticket 19).** No project exists, so none of the
  following has run: the migration SQL, sign-in links being sent and redeemed, sign-out, red line
  list/add/edit/delete, and whether the RLS policies really limit a Signer to their own rows. What
  is tested: with both Supabase variables unset, the app builds, `/app`, `/sign-in` and `/red-lines`
  answer 200, the account screens say accounts are not set up, and a Document analyses with no red
  lines. How red lines drive the analysis is tested at the `analyse` seam. No test mocks supabase-js,
  because that would test the mock. When you create the project, add `<site>/sign-in` to its
  allowed redirect URLs.
- **Everything that needs a Supabase project (ticket 20).** None of the following has run: the
  `documents` migration, whether RLS really limits a Signer to their own saved Documents, the
  signed-in save/list/open/delete paths, the not-found case for someone else's id, and whether
  `jsonb` returns a stored result in a form that still passes reopening. What is tested: the stored
  payload holds the text byte for byte and no file data, reopening re-checks every span against
  the stored text and fails on a changed character or a tampered quote, and with Supabase unset
  `/library` says accounts are not set up and makes no request.
- **Real-model smoke, final attempt (end of run): still 429.** Every attempt this session got the
  same upstream rate limit, about 20 in all between tickets 03 and 20, and none reached the model.
  So no flags came back from the real model and **zero flags were verified against it**. Whether
  the real model produces citations that survive the verbatim check, and how often it trips the
  malformed-response checks, are both unknown. Only the stubbed pipeline is proven. The smoke
  script itself runs up to the API call and reports a 429 as a clear error.
- **Nothing was checked in a real browser.** Screens are covered by jsdom render tests and
  `next build`. Tab placement, tape, scrolling, the PDF worker, clipboard and download have not been
  looked at.
- **CI on GitHub works.** The first push, `f9a0830` (tickets 01 to 15 and 17), ran the CI workflow
  (typecheck, tests, build) and it passed.

## First commands

Run these in order from the repo root.

```sh
git pull
npm ci
npm run typecheck && npm test && npm run build   # all three should pass
npm run smoke                                    # real model; see the 429 note above
npm run dev                                      # then open http://localhost:3000/app and paste a Document
```

If `npm run smoke` still returns 429, choose one of two fixes. Either add your own Fireworks key
under https://openrouter.ai/settings/integrations, or change the provider pin in
`lib/model/openrouter-client.ts`. Then run smoke again.

When the Supabase project exists:

1. Put `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
2. Run the files in `supabase/migrations/` in filename order in the SQL editor.
3. Add `http://localhost:3000/sign-in` and the deployed `/sign-in` URL to the allowed redirect URLs.
4. Sign in at `/sign-in`, add a red line, analyse a Document, and check it appears in `/library`.
5. With a second account, confirm you cannot see the first account's red lines or Documents.
