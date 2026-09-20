# MAGOS Runtime

This subtree is the in-house MAGOS execution layer. It is deliberately separated from the Myriad Green website application even though it currently lives in the same repository.

## Implemented capabilities

### MAGOS Transaction Writer V1

The shared writer is the only approved path for authoritative business mutations once an adapter migrates onto the runtime.

It enforces:

1. Idempotency through `Automation_Run_Log`.
2. Live schema/header resolution.
3. `Writer_Schema_Registry` validation.
4. `Data_Ownership_Matrix` authority.
5. `Cross_System_Links` authority for downstream projections.
6. Preconditions before mutation.
7. Named-field writes.
8. Immediate read-back.
9. Compensation on later failure.
10. `Sync_Exceptions` evidence and same-key recovery.

### Writer Operations Library V1

The writer exposes a reusable operation catalog for processors and future adapters:

- update by canonical key
- create/append if absent
- upsert by key
- patch only if live values still match
- controlled state transition
- set fields only when empty
- linked-record creation
- evidence attachment
- snapshots
- immutable events
- document registration
- procurement requirements
- supplier-price records
- payment allocations
- accepted-scope job composition

These helpers compile business intent into governed TransactionPlan mutations. They do not bypass Data_Ownership_Matrix, Cross_System_Links, Writer_Schema_Registry, idempotency, read-back or compensation.

### P2 private HTTP runtime

The writer now has a deployable service boundary under `runtime/`.

- `GET /healthz`
- `GET /readyz`
- `POST /v1/probes/google-sheets` — bearer-authenticated
- `POST /v1/transactions` — bearer-authenticated

The service refuses to start without `MAGOS_RUNTIME_TOKEN`. No channel adapter is enabled by this release.

### P5 EventEnvelope + Decision Processor V1

P5 introduces the common decision boundary that future Gmail, WhatsApp, WordPress, 00A, payment, supplier and website adapters must use.

Flow:

1. Adapter emits `EventEnvelope V1`.
2. Processor validates the envelope and tri-state guards.
3. Duplicate events are detected by the deterministic idempotency key boundary.
4. Entity resolution must be deterministic or explicitly create-allowed.
5. Ambiguity, conflict, missing evidence, unknown guards, or weak confidence routes to review.
6. Only an exact approved match may produce `AUTO_WRITE`.
7. `AUTO_WRITE` must carry a valid P3 `TransactionPlan` with the same idempotency key.
8. P3 remains the only authoritative mutation path.

Protected decision endpoint:

- `POST /v1/events/decide` — bearer-authenticated; decision only, does not execute the writer.

The first release deliberately keeps event decision and transaction execution separate until P4 live-host validation and source-specific planners are proven.

### MAGOS-DOC-EXTRACT-01

MAGOS-DOC-EXTRACT-01 processes documents from the 00A intake boundary.

Flow:

1. Read immutable Drive file metadata and bytes.
2. Compute SHA-256 content hash and deterministic idempotency key.
3. Claim the event in Global Audit Automation_Run_Log.
4. Attempt native extraction first.
5. Escalate to PDF.co OCR only if native extraction quality is insufficient.
6. Classify the document.
7. Normalize safe generic fields.
8. Write evidence state to Document_State_Register.
9. Send uncertain extraction/classification to Sync_Exceptions.
10. Terminalise the run only after the audit writes complete.

No supplier, CRM, finance, procurement, quote, invoice, or job table is mutated directly by this worker. Clear outputs must be handed to the MAGOS Transaction Writer.

## Local commands

Install:

    npm install

Test all MAGOS components:

    npm test

Start the private runtime:

    MAGOS_RUNTIME_TOKEN=<secret> npm start

Probe a deployed runtime:

    MAGOS_RUNTIME_URL=https://<host> MAGOS_RUNTIME_TOKEN=<secret> npm run probe:runtime

Scan the configured 00A folder:

    npm run scan:00a

Copy `.env.example` to `.env` for local development. Never commit secrets.

## Container build

From the repository root:

    docker build -f magos/Dockerfile -t magos-runtime .

## Production requirements

The runtime host must provide HTTPS and secret injection. The service identity must have the minimum Google Drive/Sheets access needed by the current MAGOS authorities.

The hosting provider is infrastructure only. Do not move MAGOS business logic, source-of-truth state, or idempotency into the host.

Before any WhatsApp, Gmail, WordPress, 00A business-write, or other adapter is enabled, the deployed runtime must pass the protected Google Sheets probe and TEST-045 through the actual HTTP `TransactionWriter` entrypoint.
