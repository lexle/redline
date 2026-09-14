# 01: Scaffold the app, test runner and CI

**What to build:** An empty Redline app a developer can run locally, with a test suite that runs on
every push to GitHub. Nothing here faces the Signer yet. It is the ground every later ticket stands
on, and it puts CI in place before the first real analysis exists, so the citation invariant can be
enforced from its first commit.

**Blocked by:** None (can start immediately).

**Status:** done (2026-09-14)

**Dependencies pre-approved (2026-09-11):** `next`, `react`, `react-dom`, `typescript`, `vitest`,
`@types/react`, `@types/react-dom`, `@types/node`, `jsdom`, `@testing-library/react`,
`@testing-library/dom`, `eslint`, `eslint-config-next`. Anything not on this list needs the user's OK first, per CLAUDE.md. That
includes Tailwind and anything else a scaffolder adds by default.

- [x] Next.js app at the repo root, using npm. Existing docs, `research/`, `.scratch/` and the
      current `.gitignore` rules are preserved, not overwritten by the scaffolder.
- [x] The dev server starts and serves a placeholder page. (Serves the landing page; checked by
      `npm run build`, not in a browser.)
- [x] A test runner is configured and one trivial test passes via `npm test`.
- [x] A GitHub Actions workflow runs the test suite on every push and pull request, and the build
      fails when a test fails. (First run happens on push.)
- [x] An env example file lists `OPENROUTER_API_KEY` (no value) and `OPENROUTER_MODEL` (default
      `anthropic/claude-sonnet-4.5`). Real values live only in `.env.local`, which stays gitignored.
- [x] No secret is committed.
