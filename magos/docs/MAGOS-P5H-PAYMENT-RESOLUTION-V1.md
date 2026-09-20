# MAGOS P5H — Payment Resolution + Allocation V1

## Status

Code/control implementation while P4 hosted runtime remains blocked. No live payment automation is enabled.

## Core rule

Payment proof is not cleared funds.

P5H separates two observations:

- PROOF_RECEIVED
- CLEARED

A proof-only event may create an immutable Payment_Events row with:

    event_type = PAYMENT_PROOF_RECEIVED
    clearance_state = PROOF_RECEIVED

It does not create a cleared Payment_Allocation.

## Automatic CLEARED gate

Automatic CLEARED recording requires all of:

1. Exact canonical invoice_id or Payment Control ID.
2. Positive amount.
3. Payment event date.
4. Explicit clearance_authority of:
   - BENEFICIARY_BANK
   - PAYMENT_GATEWAY
   - AUTHORISED_BANK_REVIEWER
5. Exposed provider/bank transaction ID.
6. No existing same provider transaction with a conflicting amount.
7. Evidence attached to the EventEnvelope.

If any gate is missing, the resolver returns uncertainty/conflict and P5 routes to review.

## Exact business matching

P5H verifies canonical invoice and/or Payment Control IDs against the authoritative Commercial workbook.

Where both are supplied, the linked invoice/opportunity identities must agree.

Client name, payment amount, or free-text reference alone is not sufficient for automatic allocation.

## Payment event creation

Payment_Events uses deterministic CREATE_IF_ABSENT semantics.

Provider transaction ID is preferred for payment_event_id.

Proof-only events without a provider transaction use a deterministic hash derived from the EventEnvelope idempotency key. They remain proof-only.

## Cleared allocation

Only a CLEARED event can create Payment_Allocations.

The allocation requires an exact invoice_id and inherits the exact payment amount. If an exact deposit_id is present, allocation_type is DEPOSIT; otherwise INVOICE.

P5H does not directly mutate Payment Control totals or release procurement gates. Payment Control remains a derived contract view. A later reconciliation stage must calculate it from authoritative payment events and allocations.

## Ownership refinement

The prior conceptual Payment ownership row covered both Payment_Events and Payment_Allocations. P5H adds exact writer-facing authority rows:

- Payment event -> Payment_Events
- Payment allocation -> Payment_Allocations

This allows P3 to enforce exact source-of-truth tabs instead of weakening authority checks.
