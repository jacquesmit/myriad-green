# MAGOS Transaction Writer V1

Status: P1 CODE IMPLEMENTED / LIVE ACCEPTANCE REQUIRED

## Purpose

Transaction Writer V1 is the shared mutation path for MAGOS authoritative Google Sheets stores. It evolves the existing AuditLedger controls rather than introducing a new database or duplicate ownership layer.

## Reused controls

- Data_Ownership_Matrix determines authoritative owner/tab.
- Cross_System_Links authorises downstream reference/projection writes.
- Writer_Schema_Registry supplies expected field/ordinal contracts.
- AuditLedger resolves live headers and canonical-key rows immediately before mutation.
- Automation_Run_Log owns idempotency/run evidence.
- Sync_Exceptions owns durable failure/recovery state.

## Transaction behavior

1. Claim idempotency key in Automation_Run_Log.
2. Resolve ownership/link controls.
3. Resolve live schema and compare registered ordinals.
4. Evaluate preconditions before business writes.
5. Execute named-field updates or append-if-absent by canonical key.
6. Read back every declared field.
7. Compensate completed mutations if a later mutation fails.
8. Commit Automation_Run_Log only after business read-back succeeds.
9. Replay of a COMMITTED idempotency key returns DUPLICATE_NO_OP.
10. Recoverable failure uses RETRY_REQUIRED and one idempotent Sync Exception; replay reuses the same run and resolves the exception on success.
11. Google Sheets 429/rate-limit and transient 5xx failures use bounded exponential retry inside AuditLedger before they are allowed to escape the storage boundary.
12. If a transient Sheets failure still escapes the writer after bounded retry, the observed executor classifies it as RETRY_REQUIRED rather than FAILED so the original event lineage remains replayable.

## Current boundary

No WhatsApp, Gmail, WordPress or 00A channel adapter is allowed to call this writer until the Gavin Phase-2 acceptance transaction passes live read-back. EventEnvelope V1 and broader TransactionPlan producer contracts remain P2.


## Google Sheets transient-failure hardening

AuditLedger applies bounded retry to Google Sheets reads and idempotent overwrite operations used by observability, idempotency, schema validation, read-back, and recovery.

Default controls:

- `MAGOS_SHEETS_RETRY_ATTEMPTS=7`
- `MAGOS_SHEETS_RETRY_BASE_MS=1000`
- `MAGOS_SHEETS_RETRY_MAX_MS=30000`

The delay doubles per retry and is capped by the configured maximum. A provider `Retry-After` value is honoured within the same cap. Retry classification includes HTTP 429, transient Google 5xx responses, `RESOURCE_EXHAUSTED`, and Google rate-limit/quota reasons. Ordinary permission-denied failures are not retried.

Raw row append and row deletion are deliberately excluded from automatic API-level retry because their commit state can be ambiguous after a transient response. Those flows remain under MAGOS canonical-key, transaction, compensation, and stale-execution reconciliation controls so replay cannot blindly duplicate a row or delete the wrong row.

This control is deliberately bounded. It does not convert persistent permission, schema, identity, or authority failures into success and it does not create a replacement event or idempotency key.
