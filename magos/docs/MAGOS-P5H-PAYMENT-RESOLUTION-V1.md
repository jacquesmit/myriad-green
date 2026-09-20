# MAGOS P5H — Payment Resolution + Reconciliation V1

## Status

Code/control implementation only. Production payment mutation remains OFF until P4 hosted runtime validation and a controlled live acceptance test.

## Ownership repair

The previous conceptual Payment ownership row named both Payment_Events and Payment_Allocations in one source-of-truth tab field. That is too broad for the P3 writer, which requires one exact authoritative tab per entity.

P5H adds explicit writer-facing ownership contracts:

- Payment event -> Commercial / Payment_Events
- Payment allocation -> Commercial / Payment_Allocations

Payment Control remains a derived contract view and is not directly mutated by P5H.

## Truth rule

Payment proof is not cleared money.

The payment observation normalizer derives clearance from source authority, not from user-facing wording.

Approved clearance authorities for CLEARED are:

- BENEFICIARY_BANK
- BANK_API
- PAYMENT_GATEWAY
- OWNER_VERIFIED_BANK

Everything else, including CLIENT_PROOF, becomes PROOF_RECEIVED.

A missing provider transaction ID does not block OWNER_VERIFIED_BANK evidence; MAGOS uses deterministic payment-event identity instead of inventing a bank transaction ID.

## Resolution

P5H resolves only exact identities:

1. invoice_id verified against Invoices,
2. exact invoice document number,
3. exact Payment Control ID,
4. exact deposit_id,
5. exact quote number resolving to one Payment Control row.

Client name or amount alone is never enough.

If both an invoice and Payment Control ID are supplied, their opportunity lineage must agree where both sides expose it.

If an observed payment exceeds the exact invoice outstanding balance, the event routes to review.

## Duplicate suppression

Before planning, P5H checks:

- existing Payment_Events.idempotency_key,
- existing provider_transaction_id where supplied.

A duplicate is ignored before the planner runs.

## Planning

Every valid observation may create one immutable Payment_Events row.

PROOF_RECEIVED:

- records evidence and exact canonical linkage,
- does not create a CLEARED allocation,
- does not release Payment Control or procurement gates.

CLEARED:

- records a CLEARED payment event,
- may create one exact Payment_Allocations row only when the resolver has an explicit allocation_target,
- does not infer allocation merely because Payment Control contains an invoice/deposit pointer,
- never writes Payment Control directly.

An exact invoice match yields an INVOICE allocation target.

An exact deposit_id match yields a DEPOSIT allocation target.

A Payment Control or quote-number match alone can record the cleared event but does not auto-allocate because the control can represent more than one payment stage.

The derived finance projection can be reconciled separately after Payment_Events and Payment_Allocations read back successfully.

## Safety

P5H deliberately does not:

- infer a payment from client name,
- clear money from client proof,
- invent bank transaction IDs,
- overwrite prior payment events,
- mutate Payment Control directly,
- reopen or close invoices from payment text alone,
- infer a deposit/final allocation from Payment Control alone,
- split one payment across multiple targets without explicit allocation evidence.
