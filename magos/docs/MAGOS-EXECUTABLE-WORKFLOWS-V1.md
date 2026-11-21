# MAGOS — Executable Workflow Architecture (V1)
Status: CODE IMPLEMENTED ON FEATURE BRANCH. CI and hosted acceptance must be recorded by SHA before production claims.
Decision: 2026-11-21. Replaces the *naming and build priority* of the speculative AG-001..AG-038 planning hierarchy; does not erase the legacy registers or change their existing business ownership.

## Product decision

MAGOS is a business operating system, not a directory of fictional AI employees.
Use **workflow** or **capability** for executable software. Name each one by what it does, not a numerical AG ID.

The old AG-xxx and JT-xxx catalogue is retained as a provenance crosswalk during migration, not as a blocker for implementing a verified workflow. Never advertise an old playbook as deployed automation. Existing canonical data ownership, payment, quote, procurement and security rules still apply.

## Executable capabilities on this branch

| Workflow ID | Human name | Existing processor reused | Initial implementation |
| --- | --- | --- | --- |
| `lead-intake` | Lead Intake | `LEAD_SUBMITTED` | Executable via governed event runner |
| `supplier-inbox` | Supplier Inbox | `SUPPLIER_EMAIL_RECEIVED` | Executable via governed event runner |
| `payment-evidence` | Payment Evidence | `PAYMENT_OBSERVED` | Executable via governed event runner |
| `supplier-pricing` | Supplier Pricing | `SUPPLIER_PRICE_OBSERVED` | Executable via governed event runner |
| `document-intake` | Document Intake | `DOCUMENT_RECEIVED` | Executable via governed event runner |
| `document-filing` | Document Filing | `DOCUMENT_FILED` | Executable via governed event runner |

These are operationally meaningful API routes, **not** autonomous LLM workers. A workflow's business result can be `REVIEW_REQUIRED`, `REJECTED`, `RETRY_REQUIRED`, etc.; a workflow endpoint existing is not proof of successful business mutation.

## Runtime

- `GET /v1/workflows` — bearer-authenticated catalogue.
- `POST /v1/workflows/run` — bearer-authenticated workflow execution. Input: `{ "workflow_id": "lead-intake", "envelope": <existing MAGOS EventEnvelope V1> }`.
- The runtime verifies workflow/event-type binding, event schema, presence of source evidence and **source-derived immutable event ID/idempotency key**.
- No user-provided claim `approved`, named agent, price or state can directly authorize the transaction writer.
- WorkflowRunner calls the existing `GovernedProcessorRegistry.run(envelope)`. The existing event processors, P3 transaction writer, authoritative Sheets, review and retry paths decide the result.
- No new database, queue, account hierarchy, transaction writer, or automatic schedule is created.

The existing `/v1/events/run` remains available for compatibility. The earlier `/v1/agents/plan` and `/v1/agents/authority` are **legacy research endpoints** and should not be an operational dependency. Retire or isolate these after controlled client inventory; do not force 38 agents into the execution layer.

## Build-first roadmap: actual blockers, not documentation counts

1. **Merge current approved runtime baseline first.** Reconcile main against unmerged Release 0/dashboard recovery work. Do not overwrite currently live hotfixes or assume a branch is deployed.
2. **Verify release in hosted runtime.** Capture full SHA, authenticated endpoint, provider scopes and deployed worker evidence; record the CI and host result in MAGOS status.
3. **Run first real golden event.** Choose one controlled non-customer test lead, preserve immutable provider identity, confirm canonical CRM write/readback, audit receipt and same-key duplicate replay. Record the exception if blocked.
4. **Fix precisely the first failing seam** (provider ingress, auth, exact matching, writer schema, readback or stale-event recovery) rather than creating more agents.
5. Repeat for supplier-mail, documents and payments, respecting finance clearance and all human release gates.
6. Only after the domain operations consistently execute: add a durable task scheduler, operator action list and role-specific AI assistance. The existing `Sync_Exceptions` and `Automation_Run_Log` remain the single audit surfaces.

## Naming conventions

- Human-facing title: `Lead Intake` (noun + action or short functional area).
- Stable code ID: `lead-intake` (lowercase kebab-case).
- Event type: existing `LEAD_SUBMITTED` (UPPER_SNAKE_CASE).
- Source record and provider event IDs: retain canonical identity (never client names).
- Legacy role crosswalk: `AG-002` (only documentation/migration).
- One task capability per end-to-end outcome; multiple internal steps do not automatically become new agents.

## Truthmode

IMPLEMENTED: named workflow catalog, validation, runtime endpoint and delegation to existing governed runner.
VALIDATED: only after CI passes on exact SHA (and not equivalent to production validation).
PENDING: hosted verification, live data readback, branch integration, first golden transaction, retry/concurrency evidence and independent release signoff.
NOT COMPLETE: autonomous 38-agent system. It is neither the goal nor a reason to delay the six concrete workflows above.

## Source controls

- [MAGOS runtime evolution directive](https://docs.google.com/document/d/1F4oij4hil7telCn9wM5BgPDoGIfzYxIc1jv-700PsM0/edit)
- [Current agent allocation workbook — historical governance crosswalk](https://docs.google.com/spreadsheets/d/1FKj-iudwat5bbFIrplgg237-ABPRq3ijQulf-LbSuBs/edit)
- [Global Audit and authoritative Data Ownership](https://docs.google.com/spreadsheets/d/1Y4iP2mVCIph8MrIL51mo-KpzgUkZbWW7ZUIlkH8lOTw/edit)
- [MGOS Control Hub](https://docs.google.com/spreadsheets/d/1lxFrUEGeEojkxbpQiVfj1AxuB5C1ayaTzAT8rkaTObo/edit)
- [Release 0 status branch](https://github.com/jacquesmit/myriad-green/blob/codex/magos-status-reconciliation-20261119/magos/docs/MAGOS-STATUS.md)

Do not merge the planned concept of 38 agents with the actual number of executable capabilities. Build and verify services first.
