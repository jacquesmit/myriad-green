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

## Provider integration implemented (pending real credentials and live verification)

`adapters/signing-provider-verifier.js` is wired as the runtime default. It requires two server-side environment variables:

- `MAGOS_SIGNING_VERIFY_URL`: an actual trusted signature-provider HTTPS verification endpoint; never use a fabricated URL
- `MAGOS_SIGNING_VERIFY_TOKEN`: the independent provider's authenticated read-only verification credential

MAGOS makes an authenticated server-to-server GET with exact `quote_id` and `opportunity_id` query parameters. The source must respond with JSON fields `verified: true`, exact IDs, `status: COMPLETED` or `SIGNED`, `evidence_ref`, `signer_identity`, ISO-parsable `signed_at`, and `source_event_id`. All fields are checked independently; invalid, pending, mismatched or unavailable responses fail closed.

**Not configured** does not mean a signature exists. As of this checkpoint the live signing provider has not been identified or connected; no credentials have been supplied. Do not mark live production acceptance PASS until authenticated verification from the real provider returns evidence for an approved test quote, subsequent P3 transaction succeeds, and audit/readback is evidenced.
