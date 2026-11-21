# MAGOS Specialist Agent Orchestration V1

Status: CODE IMPLEMENTED ON FEATURE BRANCH; TEST EXECUTION AND DEPLOYMENT NOT YET VERIFIED.

## Purpose
Introduce a provider-neutral, deterministic planning boundary for specialist MAGOS agents without duplicating CRM, Finance, Procurement or runtime ownership.

## Current implementation
- Six specialist roles: SALES, MARKETING, OPERATIONS, FINANCE, PROCUREMENT, ENGINEERING.
- A finite allowlist of capabilities per role; unknown capabilities block.
- Stable SHA-256 idempotency key based on source, source_event_id, capability and effect.
- Evidence required for every task; identity conflicts block.
- Read/draft plans are proposals only. All mutations await approval; an approval flag or token carried inside user/AI payload is not trusted.
- Unknown guards block mutations. Contact opt-out blocks outbound communications.
- No network, API, database, or email side effects. No production route enabled.
- The existing governed event runner and Transaction Writer remain the only future execution boundary.

## Outstanding shortfalls and gates
1. **P1 — CI and integration:** run agent-router tests in the MAGOS GitHub workflow; review pull request; no deployment before existing host checkout is reconciled.
2. **P2 — Durable task state:** define canonical Task, Approval and Agent_Run audit records in MAGOS authority/schema; protect against duplicate claims and concurrent agents.
3. **P3 — Authenticated execution:** implement per-action permissions, real approval identity, timeout, compensating action, rate limits and spend ceilings; validate end-to-end using non-customer test fixtures.
4. **P4 — First live workflow:** Sales/Intake agent only, replay-safe handoff through existing governed event runner and writer. Compare with legacy intake results before cutover.
5. **P5 — Expand:** connect other agents only after provenance, read-back, retries, dead-letter recovery, and kill switches are tested.
6. **P6 — Deployed-runtime acceptance:** prove deployed commit SHA, authenticated health/probes, test writes and exact read-back; record source-specific approval and rollback evidence.

## Non-goals / prohibited shortcuts
- Do not turn this planner into an unsupervised autonomous writer.
- Do not connect or modify WordPress/ecommerce, supplier pricing, advertisements, finance or customer records as part of this change.
- Do not mistake tests passing for a deployed production release.
- Approval and idempotency must be enforced by the execution layer; this planner is not their authority.
