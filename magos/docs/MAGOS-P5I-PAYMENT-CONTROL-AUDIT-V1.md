# MAGOS P5I — Payment Control Audit V1

## Status

Code/control implementation only. This stage is intentionally read-only with respect to financial and procurement state.

## Purpose

Compare the derived Payment Control amounts against authoritative Payment_Allocations without allowing payment proof or a projection mismatch to trigger a financial or procurement state change.

## Authoritative inputs

- Payment_Allocations
- Payment Control contract/deposit/invoice obligation fields

Only allocation rows with:

    allocation_state = CLEARED

are counted.

Proof-received, pending, failed and unknown allocations contribute zero.

## Calculated facts

For each Payment Control record the auditor calculates:

- cleared deposit received,
- cleared final received,
- total cleared received,
- remaining overall balance,
- whether the deposit obligation is financially satisfied,
- whether the contract amount is financially satisfied,
- whether the final invoice amount is financially satisfied.

These are comparison facts only.

## Output

The auditor returns:

- MATCH when the numeric Payment Control projection agrees with authoritative cleared allocations;
- MISMATCH with field-level observed and expected values when it does not.

## Explicit boundary

P5I does not:

- mark funds cleared,
- alter Payment Control,
- release procurement,
- change Procurement Status,
- change a booking/job state,
- initiate or move money.

A mismatch is an audit/review condition. Any later corrective write must use a separately authorised control with evidence and P3 read-back.
