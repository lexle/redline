# Redline

Upload a contract, lease, freelance agreement, or terms of service; get back what
you are actually signing.

Read `research/summary.md` before deciding what the product should do.
Read `PRD.md` before building. If it does not exist yet, ask me for it.

## Stack — settled, not open for reinterpretation

- Next.js, scaffolded at the repo root. npm.
- Supabase for auth and database. Deployed on Vercel.
- The model is called through OpenRouter — never a provider SDK directly.
- Model pinned via `OPENROUTER_MODEL`, default `anthropic/claude-sonnet-4.5`.
  Never hardcode a model name at a call site.

## Rules that outrank convenience

- The uploaded file is parsed in the browser. Only the extracted text is stored,
  never the original file.
- Every risk flag cites the exact sentence it came from. A flag whose source
  sentence cannot be shown is a bug, not a degraded result — never ship a
  fallback path that returns a flag without its citation.
- State only what the document says. Where the text does not support a claim,
  the product does not make it.
- Credentials live in `.env.local`, which is gitignored. Never commit a secret:
  a key is public the moment it is pushed and has to be rotated.

## Scope — build exactly this, then stop

1. Plain-English summary.
2. Clauses that could hurt the reader, ranked by severity, each showing its
   exact source sentence.
3. A drafted counter-offer for each flagged clause.
4. Missing protections: terms the document leaves out that would protect the
   reader, each with a proposed insertion marked as not in the document. These
   cite nothing, because they claim nothing about the text.
5. A question box that answers only from the document.
6. An editable list of the user's own red lines, which drives the analysis.
7. A saved library of past documents.

Excluded on purpose: payments, billing, OCR for scanned documents, and sharing a
document between users. This version exists to prove the analysis can be
trusted, and none of those make it more trustworthy. OCR would actively
undermine it, because a citation is worthless when the text it points at was
misread.

## Ask me first

- Before adding any dependency.
- Before building anything that is not one of the seven capabilities above, however
  obvious a next step it looks.

## Repo traps

- `Project Redline/` is an empty git repo with no commits. It is gitignored, and
  untracking it will break `git add -A` with "does not have a commit checked out".

## Agent skills

- Issue tracker, triage labels, and domain-doc layout: see `docs/agents/`.
- Grilling skills (`/grill-me`, `/grilling`): always ask with selectable options.
