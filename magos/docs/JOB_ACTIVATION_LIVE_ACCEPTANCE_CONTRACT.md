# MAGOS Job Activation V1 — live acceptance evidence contract

Status: **BLOCKED FOR PRODUCTION RELEASE** pending trusted signature evidence source.

## Live source inspection (2026-10-11)
- Commercial master workbook contains `Quotes`, `Quote_Approval_Gate`, `Correspondence_Outbox`, `Payment Control`, `Payment_Events` and `Payment_Allocations`.
- **No dedicated signed acceptance register** appears in the Commercial workbook tab inventory.
- `Quote_Approval_Gate` validates whether the quotation can be sent. It is *not* client acceptance.
- `Correspondence_Outbox` records planned/sent communication. It is *not* signed acceptance.
- `Quotes['Quote Status']='ACCEPTED'` is a business status, but without independent signed evidence it cannot authorize P3 job creation.
- `Payment_Allocations` with a bank-cleared deposit documents funds only; it does not prove acceptance or signature.

## Minimum provider contract
An independent server-side source must verify: exact `quote_id`, `opportunity_id`, signed artifact reference, signer identity, signing timestamp and immutable signing `source_event_id`. These fields must be retrieved from a trusted signing provider or validated source, not from the HTTP caller or a freely editable status field.

Production gate must enforce both the signature verifier and the canonical financial requirement; a failure must produce `REVIEW_REQUIRED` and HTTP 202, with zero P3 writes. A signed source event is part of the idempotency key; matching the correct source event is mandatory for execution.

## Single release sequence
1. Connect and independently verify the actual signing provider / controlled signed acceptance record and run negative forgery/mismatch tests.
2. Use an authorized controlled transaction (never an unrelated customer job) to verify P3 planning, write, both canonical records, and audit ledger readback.
3. Deploy, restart application, run the full hosted test suite and `npm run verify:release`. Preserve generated JSON and identify exact deployed commit. Fail/blocked is not PASS.
4. Only then classify **Job Activation V1: PRODUCTION PASS**.

Neither a 272/272 suite result nor `/healthz`/`/readyz`/`/operator` HTTP 200 proves business activation. Scraper prospects remain separate from operational leads and jobs.
