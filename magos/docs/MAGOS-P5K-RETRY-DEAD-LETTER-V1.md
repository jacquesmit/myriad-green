# MAGOS P5K — Retry + Dead-Letter Control V1

## Status

Code/control implementation only. Production scheduling remains OFF until P4.

## Purpose

Prevent infinite loops, duplicate replacement events and uncontrolled replay.

## Retry policy

Only explicitly classified transient failures retry automatically.

Initial retryable classes:

- PRECONDITION_FAILED
- TEMPORARY_GOOGLE_API_FAILURE
- TEMPORARY_PROVIDER_FAILURE
- RATE_LIMITED
- NETWORK_TIMEOUT
- LOCK_CONTENTION

Known authority, schema, validation, ambiguity and identity failures do not retry automatically.

Unknown failure codes also do not retry automatically.

## Bounded retries

Default automatic retry limit:

    3

When the limit is reached, the event enters the dead-letter path.

A retry must reuse the original EventEnvelope and original event idempotency key.

No retry may create a replacement event merely to bypass idempotency or prior evidence.

## Dead letter

Dead-letter identity:

    deadletter:event:<original event idempotency key>

The durable exception records:

- event identity,
- source identity,
- event type,
- original event idempotency key,
- retry count,
- retry limit,
- original failure reason,
- error/evidence.

The item is routed to Sync_Exceptions for investigation.

## Recovery

Human or automated remediation may later approve replay, but replay still uses the original event idempotency lineage and returns through P5/P3 controls.
