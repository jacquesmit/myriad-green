# cPanel / Passenger Deployment — HISTORICAL

> **Superseded for production.** HOSTAFRICA moved the MAGOS runtime domain to a DirectAdmin server with Node.js 20 support on 24 September 2026. Use `DIRECTADMIN-NODE20-DEPLOY.md` for the current production deployment. Keep this document only as evidence of the previous server configuration.

This repository includes a cPanel-compatible Passenger entrypoint at `magos/app.js`.

cPanel Application Manager uses Passenger. Passenger searches for `app.js` by default. Keeping the startup file at the application root avoids requiring root-level Apache configuration to point Passenger at `runtime/server.js`.

## Recommended cPanel layout

Clone the repository outside `public_html`, for example:

`~/repositories/myriad-green`

Register the Application Manager path as:

`repositories/myriad-green/magos`

Do not expose the Git repository directory itself as a website document root.

## Application Manager values

- Application Name: `magos-runtime`
- Deployment Environment: `Production`
- Application Path: `repositories/myriad-green/magos`
- Startup file: default `app.js` (no custom Passenger startup configuration required)
- Recommended deployment domain/subdomain: `runtime.myriadgreen.co.za`

The exact Deployment Domain and Base Application URL depend on which domain/subdomain exists in cPanel.

## Required environment variables

At minimum:

- `MAGOS_RUNTIME_TOKEN`
- `MAGOS_RUNTIME_VERSION=P3`
- Google credentials via `GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_SERVICE_ACCOUNT_JSON`

Optional:

- `MAGOS_PORT=3000`
- `MAGOS_BIND_HOST=127.0.0.1`

Never place secrets in public WordPress files or commit them to Git.

## Dependency installation

Use Application Manager's Enable Dependencies action when available, or run from the MAGOS application directory:

`npm install --omit=dev`

## Restart

Passenger applications can be restarted by touching:

`tmp/restart.txt`

Create `tmp` first if required.

## Release proof

After registration and secret injection:

1. Open `/healthz`
2. Open `/readyz`
3. Run the authenticated `/v1/probes/google-sheets`
4. Rerun TEST-045 through `/v1/transactions`

Do not activate provider adapters before those checks pass.
