# MAGOS P5L — Governed Event Runner V1

## Status

Code/control implementation only. Production adapter activation remains OFF until P4 hosted runtime validation and controlled end-to-end acceptance.

## Purpose

P5L composes the controls already built in P5A-K into one execution lifecycle.

Adapters should eventually hand an EventEnvelope to one governed runner rather than calling resolver, planner, writer, review, observability, and retry components independently.

The runner does not replace those components. It orchestrates them.

## Normal lifecycle

    EventEnvelope
      -> EventObserver.ensure
      -> ObservedEventProcessor
      -> AUTO_WRITE / REVIEW_REQUIRED / REJECTED / IGNORE
      -> ObservedTransactionExecutor for AUTO_WRITE
      -> Transaction Writer
      -> COMMITTED / DUPLICATE / RETRY_REQUIRED / FAILED

Normal successful event state:

    RECEIVED
      -> VALIDATED
      -> DECIDED
      -> PLANNED
      -> EXECUTING
      -> COMMITTED

## Review lifecycle

A normal REVIEW_REQUIRED decision opens the existing durable ReviewManager exception and leaves the event at REVIEW_REQUIRED.

An approved review resumes only through:

    REVIEW_REQUIRED
      -> DECIDED
      -> PLANNED
      -> EXECUTING
      -> COMMITTED

The original EventEnvelope idempotency key is preserved.

P5L does not allow an approved review to jump directly from REVIEW_REQUIRED to EXECUTING.

## Retry lifecycle

The writer may return RETRY_REQUIRED.

The event observer records:

    EXECUTING -> RETRY_REQUIRED

The RetryController then classifies the writer reason.

Allowed outcomes:

- RETRY — replay the original EventEnvelope with the same idempotency key.
- REVIEW_REQUIRED — route the original event to durable review.
- DEAD_LETTER — create the existing dead-letter exception and terminate the observation as FAILED.

A retry replay does not restart the normal RECEIVED/VALIDATED path. It re-resolves the same original event, requires a fresh AUTO_WRITE plan, and transitions:

    RETRY_REQUIRED -> EXECUTING

If re-resolution no longer produces AUTO_WRITE, P5L routes to review instead of forcing the stale plan.

## Post-commit follow-up

Some event types legitimately commit safe evidence while still requiring a separate human follow-up.

Example: P5J may commit an immutable supplier source line but require product-mapping review.

P5L supports a separate post-commit review key:

    review:followup:<event-idempotency>:<reason-code>

This does not reopen or rewrite the committed event.

The follow-up exception explicitly states that the original event is already committed and must not be replayed to perform a new business action.

## Terminal replay behavior

If the observed event is already terminal:

- COMMITTED
- DUPLICATE
- REJECTED
- IGNORED
- FAILED

P5L returns a terminal no-op result instead of re-running the business processor.

REVIEW_REQUIRED also returns without mutation until an explicit approved-review resume is invoked.

## Boundaries

P5L does not:

- change authority ownership,
- weaken EventObserver transition rules,
- invent new source facts,
- bypass ReviewManager approval rules,
- bypass RetryController classification,
- execute an adapter-specific side effect,
- expose a production endpoint by itself,
- activate WhatsApp, Gmail, WordPress, 00A, payment, or supplier mutations.

## Acceptance

P5L acceptance must prove:

1. normal event reaches COMMITTED through the full observed lifecycle,
2. review opens without calling writer,
3. retry replays the same lineage without illegal state transitions,
4. approved review resumes through DECIDED/PLANNED,
5. post-commit follow-up remains separate from original committed state,
6. non-retryable writer failures route to review,
7. retry exhaustion creates dead-letter evidence and terminates the observation.
