# MAGOS P5M — Runtime Governed Event Dispatch V1

## Status

Code/control implementation only. Production host validation remains blocked by P4 until HOSTAFRICA provides a functioning Node/Passenger runtime and the credentialed hosted probes pass.

## Purpose

Expose one authenticated runtime entry point for governed EventEnvelope execution without allowing adapters or the HTTP layer to select arbitrary business mutation logic.

Endpoint:

    POST /v1/events/run

Bearer authentication is mandatory.

The endpoint delegates to GovernedProcessorRegistry and GovernedEventRunner.

## Registered event types

Only these event types are registered:

- DOCUMENT_RECEIVED
- DOCUMENT_FILED
- PAYMENT_OBSERVED
- SUPPLIER_PRICE_OBSERVED
- LEAD_SUBMITTED
- SUPPLIER_EMAIL_RECEIVED

Each event type has a complete explicit resolver/planner path.

The registry intentionally does not register:

- MESSAGE_RECEIVED
- any future event type without a complete reviewed processor factory

There is no generic production fallback.

An unregistered event type returns:

    422 UNSUPPORTED_GOVERNED_EVENT_TYPE

## Processor mapping

DOCUMENT_RECEIVED:

    ZeroAResolver
      -> planZeroADocument
      -> GovernedEventRunner
      -> P3 Transaction Writer

DOCUMENT_FILED:

    ZeroAResolver exact Evidence_Index lookup
      -> planDocumentFiled
      -> GovernedEventRunner
      -> P3 Transaction Writer

PAYMENT_OBSERVED:

    createPaymentProcessor
      -> GovernedEventRunner
      -> P3 Transaction Writer

SUPPLIER_PRICE_OBSERVED:

    createSupplierPriceProcessor
      -> GovernedEventRunner
      -> P3 Transaction Writer

LEAD_SUBMITTED:

    createLeadProcessor
      -> exact CRM identity / safe create resolver
      -> governed Intake_Queue + CRM_Master + Jobs_Opportunities plan
      -> GovernedEventRunner
      -> P3 Transaction Writer

SUPPLIER_EMAIL_RECEIVED:

    createSupplierEmailProcessor
      -> exact canonical supplier ID / exact supplier-email token
      -> governed Intake_Queue source-event plan
      -> optional post-commit contact review
      -> GovernedEventRunner
      -> P3 Transaction Writer

## Shared audit boundary

The registry requires the runtime writer to expose its audit ledger.

The same audit boundary is supplied to:

- EventObserver
- ReviewManager
- RetryController

This prevents a runtime dispatch path from executing business writes without event observability/review/retry lineage.

## HTTP state mapping

- COMMITTED -> 200
- DUPLICATE -> 200
- IGNORED -> 200
- REVIEW_REQUIRED -> 202
- REJECTED -> 400
- RETRY_REQUIRED -> 409
- DEAD_LETTER / FAILED / unexpected runner state -> 500
- unsupported governed event type -> 422

## Existing endpoints

/v1/events/decide remains a decision-only diagnostic boundary and does not execute writer mutations.

/v1/transactions remains the lower-level authenticated P3 TransactionPlan execution boundary.

Adapters should ultimately prefer /v1/events/run once their source-specific parity test is complete, because it preserves the full P5L lifecycle.

## Production rule

Do not activate any source adapter merely because /v1/events/run exists in code.

Production use still requires:

1. P4 hosted Node/Passenger runtime boots,
2. bearer auth works over HTTPS,
3. Google service-account probe succeeds,
4. controlled P3 writer acceptance succeeds over HTTP,
5. controlled /v1/events/run acceptance succeeds,
6. each source adapter passes its own parity/retirement condition.

Until then the endpoint is CODE_READY_P4_BLOCKED.
