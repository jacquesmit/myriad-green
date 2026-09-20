# MAGOS Writer Operations Library V1

## Purpose

The Transaction Writer is the shared mutation kernel for MAGOS. It must support many business capabilities without turning channel adapters into direct database writers and without embedding all business decision logic inside the writer.

The Operations Library provides reusable, auditable constructors that compile business intent into governed TransactionPlan mutations.

## Separation of responsibility

**Adapters** capture provider events and immutable source evidence.

**Processor/rules** decide what the event means and whether a business transaction is justified.

**Writer Operations Library** expresses the intended mutation in a consistent TransactionPlan shape.

**Transaction Writer** enforces authority, live schema, preconditions, idempotency, mutation, read-back, compensation and exception evidence.

The writer does not decide whether a bank payment belongs to a client, whether a WhatsApp message is spam, which supplier is cheapest, or whether a quote should be accepted. Those are processor/rules decisions.

## Primitive mutation operations

The kernel supports:

- `UPDATE_BY_KEY` — update named fields on one canonical existing row.
- `APPEND_IF_ABSENT` — append an immutable/canonical row only when its key does not exist.
- `CREATE_IF_ABSENT` — semantic alias of append-if-absent for record creation.
- `UPSERT_BY_KEY` — create when absent; update named fields when present.
- `PATCH_IF_MATCH` — update only when the current live row still matches declared field expectations.
- `STATE_TRANSITION` — transition a declared state field only from approved source states.
- `SET_IF_EMPTY` — fill missing fields but refuse to overwrite a different established value.

Destructive delete remains internal to compensation. It is not exposed as a normal business operation.

## Business-facing helpers

The library currently exposes:

- `updateByKey`
- `appendIfAbsent`
- `createIfAbsent`
- `upsertByKey`
- `patchIfMatch`
- `stateTransition`
- `setIfEmpty`
- `createLinkedRecord`
- `recordImmutableEvent`
- `attachEvidence`
- `setSnapshot`
- `registerDocument`
- `createProcurementRequirement`
- `recordSupplierPrice`
- `allocatePayment`
- `composeTransactionPlan`
- `createJobFromAcceptedScope`

The business helpers do not hard-code a competing database schema. The processor supplies the governed target, canonical key, authority/entity or link ID, and named fields based on current MAGOS registries.

## Why this scales

A future adapter can request a lead create, contact update, opportunity transition, accepted-quote job create, payment allocation, procurement requirement, supplier price record, document registration, execution event, completion snapshot or evidence attachment using the same writer path.

That means MAGOS gains many functions while retaining one mutation contract.

## Safety invariants

Every operation still passes through:

1. deterministic idempotency claim
2. Data_Ownership_Matrix or Cross_System_Links authority
3. Writer_Schema_Registry + live header validation
4. current-row/canonical-key resolution immediately before mutation
5. operation-specific conditions
6. named-field mutation
7. immediate read-back
8. compensation when a later mutation fails
9. Automation_Run_Log evidence
10. Sync_Exceptions failure/recovery evidence

## P3 release boundary

P3 expands writer capability only. It does not activate WhatsApp, Gmail, WordPress, 00A or other adapters and it does not authorize retirement of legacy paths.

Production adapter migration remains dependent on the P2 hosted credentialed runtime passing the live Google probe and TEST-045 through the HTTP TransactionWriter entrypoint.
