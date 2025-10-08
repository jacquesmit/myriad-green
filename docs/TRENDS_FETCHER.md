Trends Snapshot Fetcher

This folder contains a simple Node script that demonstrates how to create SEO-friendly server-side snapshots for the site trends sections.

Files
- `services/trends-config.json` - list of services, their page path, geo and queries. Used by the fetcher.
- `scripts/fetch-trends-snapshots.js` - Node script that fetches (mock) trends and writes JSON snapshots to `data/trends-snapshots/`.

How it works
1. Run the script daily (cron) to refresh snapshots.
2. The script writes `data/trends-snapshots/{service}.json` with a small, crawlable summary and the top 3 terms.
3. Your server-side build should inject these snapshot pieces into the `trends__insights` cards and include `time`/`lastUpdated` metadata for SEO.

Next steps / Production hardening
- Replace the `mockFetchTrends` with a real provider API. Respect rate limits and store API keys in secure environment variables.
- Add retries and exponential backoff.
- Add logging and alerting for fetch failures.
- Consider generating and committing static HTML snippets if your site is fully static (so that snapshots are present in the built files for crawlers).
- For secure admin preview, render the interactive widget only behind an authenticated route or internal-only query flag — avoid exposing admin previews via public query params.

Production mode (google-trends-api)
- The project already includes `google-trends-api` as a dependency. To enable the production provider replace the mock behavior by setting the environment variable `USE_GOOGLE_TRENDS_API=true` when running the fetcher. Example:

	```powershell
	$Env:USE_GOOGLE_TRENDS_API = 'true'; node scripts/fetch-trends-snapshots.js
	```

- Notes:
	- `google-trends-api` is an unofficial wrapper around Google Trends and may have limitations. Validate responses in staging before enabling for production.
	- Respect rate limits: the fetcher uses pacing and retries, but if you need larger coverage reduce frequency or shard queries across accounts.
	- For strict SLA and stability, consider a paid trends/data provider with an official API.

	CI integration
	- A GitHub Actions workflow is included at `.github/workflows/trends-snapshots.yml` which will run daily and on pushes to `main`. By default the fetcher runs in mock mode unless you set the secret `USE_GOOGLE_TRENDS_API=true` in repository secrets (or set it to a provider flag you use).

	- The workflow optionally commits generated snapshots and updated HTML back to the `main` branch when run by the scheduled trigger. You can disable the automatic commit step by editing the workflow or removing the `if: github.event_name == 'schedule'` block.

	Local testing
	- You can test locally with the npm scripts:

		```powershell
		npm run trends:fetch   # fetch snapshots
		npm run trends:inject  # inject snapshots into HTML (creates .bak backups)
		npm run trends:run     # fetch then inject
		```

	Security note
	- If you enable real Google calls, do not store API keys/secrets in the repo. Use GitHub Secrets for the CI workflow and environment variables on any server cron/runner.
