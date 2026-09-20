# MAGOS P5 — EventEnvelope + Decision Processor V1

## Status

Implemented in code for controlled validation. Not yet authorised as a live autonomous business-mutation path.

P4 hosted-runtime validation remains a release dependency before production event ingestion is enabled.

## Purpose

P5 creates one canonical decision boundary between external channels and the P3 Transaction Writer.

No Gmail, WhatsApp, WordPress, 00A, payment, supplier, or website adapter is allowed to own business mutation logic.

The target flow is:

    source adapter
      -> EventEnvelope V1
      -> deterministic processor
      -> Decision V1
      -> TransactionPlan V1
      -> P3 Transaction Writer
      -> authoritative MAGOS store

## EventEnvelope V1

The envelope carries source identity, source event identity, event type, occurrence/receipt timestamps, evidence, entity hints, payload, safety/quality guards, and a deterministic idempotency key.

The idempotency key is derived from:

    source + source_event_id + event_type

Replays of the same upstream event therefore resolve to the same transaction identity.

## Guard semantics

Each protected guard is tri-state:

- CLEAR
- BLOCK
- UNKNOWN

BLOCK rejects the event.

UNKNOWN routes to review. Unknown is never treated as clear.

The initial guards are spam, phishing, explicit content, malware, and irrelevant content.

## Decision states

- AUTO_WRITE — exact match, sufficient confidence, evidence, safe guards, and a valid P3 TransactionPlan.
- REVIEW_REQUIRED — uncertainty, ambiguity, conflict, missing evidence, unknown guards, or planning failure.
- IGNORE — duplicate event or unsupported event type.
- REJECTED — structurally invalid or explicitly blocked event.

## Auto-write controls

AUTO_WRITE requires all of the following:

1. EventEnvelope validates.
2. No guard is BLOCK or UNKNOWN.
3. Event is not already processed.
4. Event type is explicitly allowed by rules.
5. Evidence exists.
6. Entity resolution is deterministic, or the event rule explicitly allows creation.
7. Confidence meets the event threshold.
8. Match basis is explicitly approved.
9. Planner produces a P3-compatible TransactionPlan.
10. TransactionPlan preserves the EventEnvelope idempotency key.

No processor writes authoritative state directly.

## Source-of-truth rule

P5 does not decide ownership by convenience. Transaction planners must continue to obey Data_Ownership_Matrix and the MGOS Source of Truth Standard. P3 Writer enforcement remains authoritative.

## Review queue

REVIEW_REQUIRED decisions carry the event identity, evidence, reason code, match context where available, and an explicit human-decision requirement. The production destination remains Sync_Exceptions until a dedicated review surface is proven.

## Initial event rules

The initial rule file recognises:

- LEAD_SUBMITTED
- PAYMENT_OBSERVED
- DOCUMENT_RECEIVED
- SUPPLIER_EMAIL_RECEIVED
- MESSAGE_RECEIVED

MESSAGE_RECEIVED is intentionally not allowed to auto-write business state in this first release.

## Acceptance target

P5 V1 must prove:

- deterministic event identity,
- duplicate detection boundary,
- blocked inputs cannot mutate,
- Unknown is not Yes,
- ambiguous/conflicting matches go to review,
- exact deterministic matches may produce AUTO_WRITE,
- the returned transaction plan is compatible with P3,
- an adapter cannot bypass P3 by using P5.

Runtime activation and live source adapters remain separately gated.
