# MAGOS Agent Orchestration — Controlled Evolution V2

Status: IMPLEMENTED IN GIT FEATURE BRANCH / CI PENDING / NOT DEPLOYED / NO AUTONOMOUS WRITES.

## Canonical sources and the correction to V1
The prior V1 six-department prototype was NOT an authoritative role model. It has been replaced with the registered AG-001..AG-038 identities and JT job ownership from **MAGOS Agent Job Allocation Matrix V1** (Drive), as of 2026-11-21.

- [Agent registry and allocation workbook](https://docs.google.com/spreadsheets/d/1FKj-iudwat5bbFIrplgg237-ABPRq3ijQulf-LbSuBs/edit)
- [Agent constitution](https://docs.google.com/document/d/1t-yVXvMQcb-hO049fdWCqYtr2dm0DQppT5p6TLVvJsY/edit)
- [Authority and routing contract](https://docs.google.com/document/d/1b3_izPCM7bJZ27h0_Iql3UPetJzM9UjQLGzNDI5s5oM/edit)
- [Business state-machine draft](https://docs.google.com/document/d/16xBviPdK9M45s0JinWyKnyrRQRNrAPRf2aHhpBE2-gU/edit)
- [Runtime evolution directive](https://docs.google.com/document/d/1F4oij4hil7telCn9wM5BgPDoGIfzYxIc1jv-700PsM0/edit)
- [MAGOS Global Audit / Data Ownership](https://docs.google.com/spreadsheets/d/1Y4iP2mVCIph8MrIL51mo-KpzgUkZbWW7ZUIlkH8lOTw/edit)
- [MGOS Control Hub](https://docs.google.com/spreadsheets/d/1lxFrUEGeEojkxbpQiVfj1AxuB5C1ayaTzAT8rkaTObo/edit)
- [AG-030 Governance](https://docs.google.com/document/d/1XQ2SewVmLNhLT0rdOOX9QGCwE-o4eCg_3TXspbfBvCQ/edit)
- [AG-013 independent QA](https://docs.google.com/document/d/1a6gYVB1jgcnUYwuf0ioki5iW5CpV9Xk9VOrNSQy6zrc/edit)
- [Internal information outbound firewall](https://docs.google.com/document/d/19YN5Zt2rqX7xGAN4iK-saa7Ll80QQ63BTjLbJ1GmaP0/edit)

The Git snapshot `magos/rules/agent-allocation.snapshot.v1.json` preserves 38 agent identities and 46 job-type assignments as a NON-AUTHORITATIVE, read-only code reference. The canonical Drive workbook remains authoritative. A snapshot mismatch must block execution until formally reconciled and tested; the snapshot alone cannot grant permissions or provide live ownership.

## Implemented code
- `magos/agents/agent-router.js`: explicit JT owner routing, hierarchical scope requirements (tenant, jurisdiction, country, region, branch, canonical record and correlation), idempotency key, evidence reference gate, deny-by-default controls, QA routing and approved/registered-only distinctions.
- `POST /v1/agents/plan`: private bearer-authenticated proposal only. It cannot send mail, call tools or invoke the Transaction Writer. Even an input containing "approved": true is not authoritative.
- Test cases cover owner resolution, wrong agent, opt-out, unknown/insufficient scope, stale sources, registration-only roles, idempotency scope isolation and HTTP authentication.
- Existing EventEnvelope V1, GovernedProcessorRegistry, ReviewManager, RetryController, AuditLedger, Transaction Writer and Drive/MGOS business source of truth remain unchanged.

## Immutable safety requirements for production
1. AG-001 routes, never becomes the domain specialist.
2. Every operational event has an exact JT ID and exactly one registered primary AG ID.
3. No unscoped tenant/jurisdiction/branch/record operation.
4. Missing evidence, unknown guards, stale identity or incomplete approvals result in BLOCKED/REVIEW_REQUIRED; never silently PASS.
5. AG-013 independent QA; AG-025 cannot validate own website release; AG-010 validates cleared funds; AG-007 owns release decision; AG-030 authorizes high-risk production release.
6. No purchase, invoice issue, public send, payment clearance or deployed change without independent authenticated approval and provider read-back.
7. Outbound quote and communication renderer must exclude supplier/internal costs, margins, private notes and unapproved brand identifiers.
8. AI prompt, `.md` rules or client-provided approval tokens are NOT executable authority.
9. Legacy Make/Apps Script/ChatGPT intake paths remain until parity and controlled cutover is proven.
10. Never create a parallel CRM, supplier library, quote register or private agent task database.

## Pending work / completion gates
| Gate | What must pass | State |
| --- | --- | --- |
| G1 | GitHub CI tests for agent plan and current runtime | PENDING |
| G2 | Canonical agent assignment read and source-of-truth freshness | PARTIAL: live Drive reader code, no hosted credentialed readback or permission authority |
| G3 | Durable task audit, atomic claim, independent approval receipt and exact scope | PARTIAL: Sync_Exceptions review handoff, readback and trusted-reader approval policy coded; atomic claim, durable execution record and live verified approval pending |
| G4 | Approved action executes only through EventEnvelope -> GovernedProcessorRegistry -> Transaction Writer and authoritative read-back | PENDING |
| G5 | Bounded retry, timeout, dead-letter, replay, opt-out and kill-switch exercises | PENDING |
| G6 | Host SHA and deployed route verified via authenticated probes | PENDING |
| G7 | Lead intake parallel golden test then explicit legacy migration | PENDING |
| G8 | Independent AG-013 signoff and owner production release | PENDING |

## Implementation sequencing
Prefer REUSE > WRAP > EXTEND > MIGRATE LATER; do not build a second task ledger or writer. Next integrate AG-001 task proposals with a governed task/event envelope after live schema/ownership confirmation, and validate real write/read-back/duplicate cases under controlled fixtures. Until G1-G8 pass, autonomous agent completion = PARTIAL.

## Git/Drive reconciliation discipline
Before any merge or production deployment: compare Git `main`, agent branch, deployed HOSTAFRICA checkout and Drive canonical workbook revision. Preserve historical .md files as history; supersede with dated evidence, never silently rewrite prior decisions. Record exact source/commit/test/runtime proof and outstanding blockers.

## 2026-11-21 implementation note
Drive AG role files reviewed for AG-001 through AG-031 where accessible; AG-004 native Doc fetch returned NOT_FOUND despite registry reference. The agent allocation workbook, governance, authority, state, source-of-truth and evolution directive were checked directly. Candidate AG-032..038 registration-only roles remain staged, not active.

Read-only source comparison is a safety check, not policy authorization. Approvals must be loaded from a trusted server-owned canonical reader, not supplied by the calling AI or HTTP body. A recorded review is not a durable execution claim: existing Sheets exception append is not a proven atomic multiworker lock. No worker may execute tasks until this distinction is resolved and concurrency tests pass.

## Branch collision/reconciliation finding — 21 November 2026
The read-first audit discovered two significant prior MAGOS development lines outside main:
- `magos/agent-routing-v1` (existing resolver, read-only guard, candidate AG-032..038 roles). The prior owner resolver and original tests are REUSED in the new feature branch; the pure staging-only read-only guard remains as historical code pending a controlled manifest/audit-sink integration. Do not create another corporate agent manifesto or independently activate these roles.
- `codex/magos-release-0-recovery-20261116` includes substantial unmerged operator dashboard, scope action gates, commercial acceptance, procurement and tests; `codex/magos-status-reconciliation-20261119` proposes the current `MAGOS-STATUS.md`. Do not blindly merge or overwrite either: preserve source main's newer commits, reconcile lineages and host SHA, then make a separate reviewed integration plan.

This agent PR is a narrow integration against main. It does not claim reconciliation/merge of the 120-commit recovery lineage or active host deployment. The highest-leverage next release gate remains fresh HOSTAFRICA cPanel SHA and a controlled authorization/readback/concurrency test, with legacy integrations left active until parity.
