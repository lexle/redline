# Build brief shared by every ticket

Read this whole file before starting a ticket. It holds the owner's answers and the architecture
every ticket builds on. Where it conflicts with a ticket, this file wins. Where it conflicts with
CLAUDE.md, CLAUDE.md wins, apart from the two owner answers below, which settle the questions
CLAUDE.md said to ask about.

## Read first

`CLAUDE.md`, `CONTEXT.md` (use its vocabulary in code, tests and copy), `PRODUCT.md`, `DESIGN.md`,
`.impeccable/surfaces/app-app-layout-tsx.md` (app shell brief), `.scratch/cited-analysis/spec.md`,
your ticket file, and every ADR your ticket names in `docs/adr/`.

## Owner answers (settled, do not ask)

1. **Model.** Call whatever `OPENROUTER_MODEL` says, through OpenRouter's OpenAI-compatible endpoint
   (`https://openrouter.ai/api/v1/chat/completions`) with `OPENROUTER_API_KEY`, using `fetch`. No
   provider SDK. Every request sets
   `provider: { order: ["fireworks"], allow_fallbacks: false, require_parameters: true }`,
   `reasoning: { effort: "low" }`, and asks for structured JSON output
   (`response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }`) on every
   analysis and answer call. Never write a model id into code, tests or fixtures. If
   `OPENROUTER_MODEL` or `OPENROUTER_API_KEY` is unset, the production client throws a clear error.
   The model id may appear only in `.env.example`.
2. **Supabase.** No project exists. Build sign-in, the library and red lines against
   `@supabase/supabase-js`, reading `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   Every table and policy is a SQL migration under `supabase/migrations/`, run by hand later. The
   app must start and analyse a pasted Document with both variables absent; only the library and
   red lines need an account. Do not mock auth in the product: when the variables are absent, those
   screens say accounts are not set up yet.

## Dependencies

Approved: `next`, `react`, `react-dom`, `typescript`, `vitest`, `@types/*`, `jsdom`,
`@testing-library/react`, `@testing-library/dom`, `eslint`, `eslint-config-next`, `pdfjs-dist`,
`fflate`, `@supabase/supabase-js`. Nothing else. No Tailwind, no tsx, no zod, no UI kit. If you
think you need something else, don't add it; write the code or report back.

## Architecture

- `lib/analysis/` holds seam 1: `analyse(documentText, redLines, modelClient): Promise<AnalysisResult>`.
  Span validation, ranking, type assignment and drafting are internals. Tests go through `analyse`.
- `lib/extraction/` holds seam 2: `extractText(file): Promise<{ kind: "text"; text } | { kind: "no-text" }>`
  (plus a clear error for invalid files). It runs in the browser.
- `lib/model/` holds the `ModelClient` interface and the OpenRouter implementation. `analyse`
  receives the client as a parameter and never imports the implementation.
- **How citations work.** The server splits the stored text into sentence units, each with a
  stable id and exact `[start, end)` offsets into the stored text. The prompt shows the model each
  unit with its id and its text JSON-escaped. The model cites a unit id and echoes the quoted text.
  Resolution maps the id to offsets, and validation requires
  `documentText.slice(start, end) === quote` exactly. Unknown id or any mismatch throws a
  `CitationError` naming every failed finding. No normalisation, no fuzzy match, no retry that hides
  a failure, no dropping. Every cited finding in the result carries `{ start, end, text }`.
- **Result type.** Cited finding types (Risk flag, Worth a look, Multiplier note, summary sentence)
  have a required `source` field. Absence types (Missing protection, Nice to have) have no
  `source` field at all. Use separate types, never an optional citation.
- API routes under `app/api/` call `analyse` with the production client. The API key never reaches
  the browser. The uploaded file never reaches the server; only extracted or pasted text does.
- App screens live in the `app/(app)/` route group, sharing `app/(app)/layout.tsx`: `/app` is the
  entry (`app/(app)/app/page.tsx`; the landing page's "Try it on a document" already links there),
  then `/library`, `/red-lines`, `/sign-in`. Do not change the landing page's design.
- Plain CSS modules, matching `app/_landing/landing.module.css` and the tokens in `app/globals.css`.

## Tests

- Runner: vitest. `npm test` runs everything once. `npx tsc --noEmit` must pass.
- Documents come from `tests/fixtures/`: `adhesion-contract.txt` with its sidecar
  `adhesion-contract.json` (each planted clause: exact sentence, type, expected severity band), and
  `clean-agreement.txt`, which has none. Build other inputs from these where possible.
- The model client in tests is a stub in `tests/support/` that returns payloads built from the
  sidecar, finding each sidecar sentence's unit id through the product's own segmenter. Tests run
  with no key and no network.

## What does not count as done

A ticket containing any of these is still open: a function that returns a fixed value; a TODO or a
"not implemented" error; a test that checks a file exists or a function is defined; a test that
mocks the thing it is meant to test. Tests assert what a Signer would observe through the seam.

## Screens and copy

Every screen obeys `DESIGN.md`, `PRODUCT.md` and the app shell brief (Operate register: standard
controls, Archivo for UI, Tinos only for the Document's own words, magenta only as flag material,
cyan only for focus and selection, square corners, 150-250ms state motion, works at phone width).
Do not start an impeccable direction round; it opens a browser and waits for a person. Run every
line a reader sees (labels, errors, empty states) through the `humanizer:humanizer` skill before
you finish. Never say Redline gives legal advice or replaces a lawyer.

## Git

Do not commit. The orchestrator verifies and commits. Never touch `.env.local` or print its values.
Do not untrack `Project Redline/`.

## Report back

At most 25 lines: files added or changed (paths only), test command and its pass/fail counts,
decisions you made with one-line reasons, and anything left unfinished. Never claim something
passes without having run it.
