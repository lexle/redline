# Build report

Unattended build run started 2026-09-14. This file is updated as work lands.

## Tickets

(filled in as tickets complete)

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

## First commands

(filled in at the end)
