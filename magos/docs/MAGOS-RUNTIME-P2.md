# MAGOS Automation Runtime V1 — P2 Runtime Release

## Purpose

P2 turns the already-proven Transaction Writer V1 into a deployable, private HTTPS service without moving business authority out of the existing MAGOS control plane.

The runtime remains separate from WordPress and from the legacy website application even though all code currently lives in the same repository. WordPress and future channel adapters are edge systems. They do not own canonical CRM, commercial, supplier, procurement, or audit state.

## Runtime endpoints

- `GET /healthz` — process liveness only.
- `GET /readyz` — confirms the runtime authentication secret is configured.
- `POST /v1/probes/google-sheets` — authenticated credential/readiness probe against the authoritative Audit store.
- `POST /v1/transactions` — authenticated TransactionPlan V1 execution through the shared Transaction Writer.

The transaction endpoint never writes directly around the writer. All authority, schema, precondition, idempotency, readback, compensation, and exception behavior remains inside `magos/writer/transaction-writer.js`.

## Authentication

Set `MAGOS_RUNTIME_TOKEN` to a strong random secret in the deployment platform's secret store. The service refuses to start without it.

Call protected endpoints with:

`Authorization: Bearer <MAGOS_RUNTIME_TOKEN>`

Do not place this token in WordPress page source, browser JavaScript, GitHub files, or Drive documents.

## Google authentication

The existing Google authentication adapter is reused unchanged.

Preferred production order:

1. Workload/application default credentials supplied by the hosting platform.
2. `GOOGLE_APPLICATION_CREDENTIALS` when the platform mounts a service-account file.
3. `GOOGLE_SERVICE_ACCOUNT_JSON` as a secret environment variable when file mounting is unavailable.

The service identity must have only the Drive/Sheets access required by the current MAGOS authorities.

## Deployment

The runtime is container-ready using `magos/Dockerfile`.

Build from the repository root:

`docker build -f magos/Dockerfile -t magos-runtime .`

Run:

`docker run --rm -p 8080:8080 -e MAGOS_RUNTIME_TOKEN=... -e GOOGLE_SERVICE_ACCOUNT_JSON=... magos-runtime`

A provider such as Railway, Cloud Run, Fly.io, Render, or another HTTPS container host may run the image. The provider is infrastructure only; provider-specific business logic must not be introduced.

## Production acceptance

After deployment:

1. Confirm `/healthz`.
2. Confirm `/readyz`.
3. Run `npm run probe:runtime` with `MAGOS_RUNTIME_URL` and `MAGOS_RUNTIME_TOKEN`.
4. Execute TEST-045 through `POST /v1/transactions` using a safe live TransactionPlan.
5. Read back Automation_Run_Log, Sync_Exceptions, the authoritative row, and linked destination row.
6. Replay the identical idempotency key and prove `DUPLICATE_NO_OP`.

Only after those checks pass may P3 EventEnvelope/processor work begin.

## Release status definition

- IMPLEMENTED means code exists and passes CI.
- DEPLOYED means an HTTPS runtime is live with secrets injected.
- VALIDATED means the credentialed runtime has passed the live Audit probe and TEST-045 through the HTTP entrypoint.
- Adapter release remains blocked until VALIDATED.
