# Trends Pipeline TODOs

This file collects the actionable follow-ups for the trends snapshot pipeline so we can reference and complete them over time.

## Current status
- Snapshot fetcher implemented (`scripts/fetch-trends-snapshots.js`) with optional `google-trends-api` mode.
- Injector implemented (`scripts/inject-trends-snapshots.js`) and ran successfully against service pages.
- CI workflow added (`.github/workflows/trends-snapshots.yml`) to run daily and on push to `main`.

---

## Priority tasks

1. Admin-only interactive preview (HIGH)
   - Create a server-side route (e.g., `/admin/trends-preview`) that requires authentication and serves the interactive widget (container unhidden).
   - Approach options:
     - Basic: protect with a single secure token read from env (e.g., `TRENDS_PREVIEW_TOKEN`) and check query param or header.
     - Better: integrate with your existing user/session/auth system and require a logged-in admin role.
   - Acceptance: Admin can visit preview URL and see the live interactive widget; public pages remain hidden.

2. Secure provider credentials (HIGH)
   - If using `google-trends-api` or another provider, store credentials/flags in environment variables or CI secrets.
   - Add documentation for required secrets and sample `.env.example` with variable names.

3. Monitoring & alerting (MEDIUM)
   - Log fetch outcomes (success/failure + HTTP error codes) to a logging sink (CloudWatch/Stackdriver/Sentry/rollbar, or a file with rotation).
   - Add a daily summary email or Slack alert when fetches fail repeatedly.

4. CI smoke test (MEDIUM)
   - Add a Puppeteer or Playwright job to fetch each service page and assert the presence of snapshot cards and a valid JSON-LD block.
   - Run during CI to prevent regressions.

5. Rollback & rollback-proofing (LOW)
   - Keep `.bak` copies (injector already does this). Add a small `scripts/revert-trends-injection.js` to restore backups if needed.
   - Consider generating static snippet files instead of editing HTML in-place for easier rollback.

6. Snapshot frequency & shaping (LOW)
   - Decide snapshot cadence (daily recommended) and whether to store hourly/daily history.
   - Keep snapshots intentionally small for SEO (top 3 + 1-line summary).

---

## How to mark tasks complete
- Update this file and the repository `todo` tool entry to mark the task done.
- Add code changes behind a PR and update this doc with the PR link.

---

## Quick commands
- Run fetcher locally (mock):
  ```powershell
  npm run trends:fetch
  ```

- Run inject locally:
  ```powershell
  npm run trends:inject
  ```

- Run fetch + inject (local test):
  ```powershell
  npm run trends:run
  ```

---

## Notes / Decisions
- The interactive widget is intentionally hidden server-side to avoid exposing competitive intel. The snapshot content is intentionally minimal and SEO-friendly.
- `google-trends-api` is supported for convenience; consider a paid official API if you need stability and scale.
