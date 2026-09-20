# MAGOS P5C/P5D — Exact Lookup + Review/Resume V1

## Status

Implemented for code/control validation. Production source execution remains OFF until P4 hosted-runtime validation.

## P5C exact lookup layer

The lookup service uses the real authoritative MAGOS stores and exact keys.

Canonical entity routes:

- CRM -> CRM_Master.crm_id
- Opportunity -> Jobs_Opportunities.opportunity_id
- Job -> Jobs_Opportunities.job_id
- Quote -> Quotes.quote_id
- Invoice -> Invoices.invoice_id
- Payment -> Payment_Events.payment_event_id
- Supplier -> Suppliers.supplier_id
- Evidence -> Evidence_Index.drive_file_id

Document-reference routes include Supplier_Quotes.supplier_quote_number, Import_Log.supplier_quote_number, Payment_Events.provider_transaction_id and selected exact document-number fields.

No fuzzy or name-only join is performed.

A duplicate exact key fails closed as an ambiguous lookup rather than selecting an arbitrary row.

## P5D review/resume

A REVIEW_REQUIRED decision can be materialised in Sync_Exceptions using:

    review:event:<original event idempotency key>

The review record stores the event identity, evidence, reason and match context.

APPROVE requires a confidence-1 exact match with basis EXACT_ID, EXACT_REFERENCE or EXACT_FILE_LINK.

REJECT closes the review without business mutation.

APPROVE does not create a new event. Resume runs the original EventEnvelope through P5 again using the approved exact match and preserves the original event and TransactionPlan idempotency key.

The review record stays IN_PROGRESS until the downstream writer commits. It may then be marked RESOLVED.

## Control rule

Human review resolves uncertainty; it does not bypass authority.

The approved match must still be exact, P5 must still produce a valid P3 plan, and P3 still enforces ownership, schema, preconditions, read-back, compensation and idempotency.
