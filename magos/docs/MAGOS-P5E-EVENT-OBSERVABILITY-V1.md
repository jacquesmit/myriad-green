# MAGOS P5E — Event Observability V1

## Status

Code/control implementation prepared while P4 hosted runtime remains blocked.

## Design decision

MAGOS already has three different classes of state:

1. Automation_Run_Log — operational/runtime execution state.
2. Lifecycle_Events — business lifecycle facts.
3. State_Transition_Log — controlled business-state mutations.

P5E keeps those boundaries intact.

Current event runtime state is added to Automation_Run_Log.

An immutable Event_Transition_Log records the event processor's state history. It is intentionally separate from business lifecycle/state-transition history so runtime mechanics cannot masquerade as client/job truth.

## Event state model

    RECEIVED
      -> VALIDATED
      -> DECIDED
      -> PLANNED
      -> EXECUTING
      -> COMMITTED

Controlled branches:

- VALIDATED -> REVIEW_REQUIRED
- VALIDATED -> DUPLICATE
- VALIDATED -> REJECTED
- VALIDATED -> IGNORED
- EXECUTING -> RETRY_REQUIRED
- EXECUTING -> FAILED
- RETRY_REQUIRED -> EXECUTING / REVIEW_REQUIRED / FAILED

Illegal transitions fail closed.

## Separate observability identity

The runtime observation row uses:

    eventobs:<original event idempotency key>

The original event idempotency key is stored separately in event_idempotency_key.

This is deliberate. The P3 writer must remain free to use the original event idempotency key for authoritative transaction execution without the observability row being mistaken for a committed business transaction.

## Current-state fields

Automation_Run_Log gains:

- event_id
- correlation_id
- event_source
- source_event_id
- event_type
- event_state
- last_successful_stage
- decision_reason
- next_action
- retry_count
- processor_version
- event_idempotency_key
- related_ids_json
- state_changed_at

## Immutable transition history

Event_Transition_Log records:

- transition_id
- event identity
- source identity
- previous/new state
- stage
- reason code/reason
- related canonical IDs
- retry count
- processor version
- evidence
- timestamp
- observation run key

## Operational value

A single current row answers:

- Where is this event now?
- What completed successfully?
- What is blocking it?
- What happens next?
- How many retries occurred?
- Which business IDs are linked?

The transition ledger answers:

- How did it get here?
- Which processor/version made each decision?
- Did it loop or retry?
- Did review occur before mutation?

This directly supports MAGOS housekeeping and production incident diagnosis without creating a second business source of truth.
