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

## Current boundary

No WhatsApp, Gmail, WordPress or 00A channel adapter is allowed to call this writer until the Gavin Phase-2 acceptance transaction passes live read-back. EventEnvelope V1 and broader TransactionPlan producer contracts remain P2.
