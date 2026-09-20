# MAGOS P5B-00A — 00A Resolver + Planner V1

## Status

Code/control implementation only. Production auto-write remains OFF until P4 hosted-runtime validation and one controlled live 00A acceptance pass.

## Purpose

Convert a validated 00A document output into the common P5 EventEnvelope, resolve only deterministic canonical relationships, and compile a governed P3 TransactionPlan.

This release does not create suppliers, products, jobs, invoices, payments or procurement requirements from free text.

## Exact-match policy

The resolver accepts only:

1. Existing Evidence_Index row by immutable Drive file ID.
2. Canonical IDs supplied by trusted upstream context and verified against the authoritative store.
3. Exactly one canonical record found by exact document reference.

Name-only matching is not accepted.

Multiple exact-reference candidates are AMBIGUOUS and route to review.

An unverified supplied canonical ID is a CONFLICT and routes to review.

## First planner action

The first planner action is intentionally narrow:

    DOCUMENT_RECEIVED
      -> Evidence_Index CREATE_IF_ABSENT

The write records the immutable Drive file ID, evidence classification, source event, canonical links, evidence URL, filing state, privacy class, timestamp and idempotency key.

This gives 00A a safe production destination without allowing document text to redefine business truth.

## Filing state

If a canonical folder is already known, the evidence row is FILED.

If the business entity is matched but no canonical destination folder is supplied, the evidence row is MATCHED_PENDING_FILING.

A later filing worker may move the Drive file and update the evidence relationship only after its own acceptance test.

## Explicitly deferred

The following are not automatic in V1:

- supplier creation from names,
- product creation from descriptions,
- supplier-price creation without canonical supplier + canonical part + source-line evidence,
- payment clearance,
- invoice/payment state mutation,
- procurement release,
- job/quote acceptance mutation,
- Drive move/rename.

Those become later source-specific planners after exact authority and schema contracts are proven.
