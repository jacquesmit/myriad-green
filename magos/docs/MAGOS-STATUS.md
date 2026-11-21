# MAGOS status

Reviewed 19 November 2026 (SAST). Git baseline [`fbd6596`](https://github.com/jacquesmit/myriad-green/commit/fbd6596272f6496f11ea1b4b60a5ad7454d6de9f). Branch reconciliation is **PARTIAL**. Release 0 production acceptance is **BLOCKED**.

This is the proposed single current status record for MAGOS. Once merged to `main`, update it in the same pull request as material changes to architecture, implementation or validation. Update it after a production check with a timestamp, deployed SHA and a reference to redacted evidence or the existing Audit_Tests register. The cPanel runbook owns hosting procedures, Git owns code provenance, and the existing MGOS registers own business records and audit results.

## Current architecture

MAGOS is the Node.js execution layer in this repository. Adapters emit an EventEnvelope. The decision processor resolves canonical IDs and either requests review or produces a governed TransactionPlan. The P3 writer enforces source ownership, idempotency and read-back for authoritative writes. The operator dashboard is designed as a read-only view of existing MGOS source records, with its own read credential. See the [runtime README](../README.md) and [dashboard design](https://github.com/jacquesmit/myriad-green/blob/bff01caf744988c1fc9fb039a893014a2fb958a5/magos/docs/MAGOS-OPERATOR-DASHBOARD.md).

## Implemented capabilities

| Capability | Code evidence | Integration state |
| --- | --- | --- |
| HTTP runtime, event decision and governed transaction writer | [Runtime entrypoint](https://github.com/jacquesmit/myriad-green/blob/fbd6596272f6496f11ea1b4b60a5ad7454d6de9f/magos/runtime/app.js) and [writer](https://github.com/jacquesmit/myriad-green/blob/fbd6596272f6496f11ea1b4b60a5ad7454d6de9f/magos/writer/transaction-writer.js) | Present on audited main |
| Operator dashboard | [PR #38](https://github.com/jacquesmit/myriad-green/pull/38), dashboard page, source reader and tests on the operator lineage | Development branch. Reconcile with main before release |
| Stale EXECUTING recovery changes | Writer, governed runner and tests in the separate branch comparison below | Diverged. Check for equivalent main behavior and reconcile overlapping changes |

## Validated capabilities

- The [16 November recovery note](https://github.com/jacquesmit/myriad-green/blob/bff01caf744988c1fc9fb039a893014a2fb958a5/magos/docs/MAGOS-RELEASE-0-RECOVERY-2026-11-16.md) records successful historical dashboard CI at `eb2ee57`. That evidence applies to that revision. Current main and any integrated release candidate still need test evidence.
- Run the MAGOS test suite on the candidate SHA. Record suite/CI links and results for dashboard HTTP/auth, source authority, writer and replay before promoting any capability.

## Production capabilities

| Check | State | Evidence |
| --- | --- | --- |
| Runtime and authenticated Sheets/audit connectivity | Historical PASS, 10 November | [cPanel runbook](CPANEL-PASSENGER-DEPLOY.md), last verified checkout `5b29a34` |
| Current running commit and current connectivity | UNKNOWN | Public health check could not be retrieved in this review. Capture host checkout and worker evidence plus fresh read-only probe |
| Dashboard authentication and canonical read parity | BLOCKED | Requires a confirmed running revision and authenticated, source-linked records in Audit_Tests |
| Governed production business writes and replay | BLOCKED for Release 0 sign-off | Require controlled write, independent read-back and duplicate replay evidence per workflow |

## Branch reconciliation

Ahead/behind is relative to the pinned main commit above. Counts describe Git ancestry and may include equivalent changes.

| Git branch | Tip | Ahead / behind | Disposition |
| --- | --- | --- | --- |
| `codex/magos-production-intake-20261107` | [`88576e4`](https://github.com/jacquesmit/myriad-green/commit/88576e4595186e73259d5e4f32d2940ac8b4a569) | [119 / 8](https://github.com/jacquesmit/myriad-green/compare/fbd6596272f6496f11ea1b4b60a5ad7454d6de9f...88576e4595186e73259d5e4f32d2940ac8b4a569) | Development baseline and PR #38 target. Use for provenance. |
| `codex/magos-dashboard-snapshot-20261110` | [`505d714`](https://github.com/jacquesmit/myriad-green/commit/505d7144bca7d70afca6ad0c40a9fe510406e5ae) | [118 / 8](https://github.com/jacquesmit/myriad-green/compare/fbd6596272f6496f11ea1b4b60a5ad7454d6de9f...505d7144bca7d70afca6ad0c40a9fe510406e5ae) | Sibling of the operator branch. Review its unique commit for behavior to retain. |
| `codex/magos-operator-dashboard-v1-20261110` | [`eb2ee57`](https://github.com/jacquesmit/myriad-green/commit/eb2ee578a6f4fb7d302a5312d0d347a65744c0c5) | [118 / 8](https://github.com/jacquesmit/myriad-green/compare/fbd6596272f6496f11ea1b4b60a5ad7454d6de9f...eb2ee578a6f4fb7d302a5312d0d347a65744c0c5) | Dashboard code and tests. Use this lineage for the dashboard candidate. |
| `codex/magos-release-0-recovery-20261116` | [`bff01ca`](https://github.com/jacquesmit/myriad-green/commit/bff01caf744988c1fc9fb039a893014a2fb958a5) | [120 / 8](https://github.com/jacquesmit/myriad-green/compare/fbd6596272f6496f11ea1b4b60a5ad7454d6de9f...bff01caf744988c1fc9fb039a893014a2fb958a5) | Contains the operator branch. Its two additional commits change only the recovery note. |
| `magos/p5q-stale-executing-recovery` | [`3af9907`](https://github.com/jacquesmit/myriad-green/commit/3af990793b8cf01ded6ff9199bdec7decee76145) | [6 / 10](https://github.com/jacquesmit/myriad-green/compare/fbd6596272f6496f11ea1b4b60a5ad7454d6de9f...3af990793b8cf01ded6ff9199bdec7decee76145) | Separate writer and governed runner changes. Review independently against current main. |

The snapshot and operator branches diverge by one commit each. Release 0 recovery descends from the operator branch, with two additional commits and a net diff limited to its recovery note. Main also changed the runtime app, Fluent Forms and supplier email adapters, HTTP tests, and hosting documentation after the shared base. The stale recovery comparison additionally overlaps main changes to the writer and runner. Keep main behavior as the integration baseline and resolve overlapping changes explicitly.

## Decision history

- **4 October** — [Development checkpoint](https://github.com/jacquesmit/myriad-green/blob/bff01caf744988c1fc9fb039a893014a2fb958a5/magos/MAGOS_CURRENT_CHECKPOINT.md) records earlier supplier-email case evidence and governed writer decisions. Individual historical cases retain their original scope.
- **10 November** — [Dashboard PR #38](https://github.com/jacquesmit/myriad-green/pull/38) landed on the production-intake development lineage.
- **16 November** — [Release 0 recovery decision](https://github.com/jacquesmit/myriad-green/blob/bff01caf744988c1fc9fb039a893014a2fb958a5/magos/docs/MAGOS-RELEASE-0-RECOVERY-2026-11-16.md) prioritised recovery and the existing dashboard. Its branch counts are dated.
- **19 November** — Refresh branch evidence against main and propose this record as the current status index. Preserve old checkpoints and runbooks. For a superseding decision, record its date, rationale and evidence link. Prefer the newer validated evidence for the same scope and keep disputed facts open until reconciled.

## Pending work

1. Capture current cPanel branch, full SHA, tracked worktree state and running worker evidence. Run the authenticated read-only smoke checks and record a rollback SHA. Use the [cPanel runbook](CPANEL-PASSENGER-DEPLOY.md).
2. Create the integration candidate from current main. Review the snapshot-only commit and port the needed dashboard and development changes with explicit resolutions for the overlapping runtime, adapters and tests. Review stale-execution recovery in its own change set.
3. Run CI at the candidate SHA and record release acceptance results. Complete the dashboard read gate and separate business acceptance gates from the Release 0 recovery note. Link the existing Audit_Tests entries and register any unresolved exceptions.


## 21 November 2026 — Whole MAGOS integration candidate (supersedes partial feature framing)

This entry is a **development checkpoint**, not a live deployment statement. Prior 19 November source evidence remains historical.

**Product scope:** one business operating system, not one bot, one e-commerce section or 38 speculative AG roles. The canonical Control Hub `Business_Capability_Map` contains 22 business capabilities, including lead-to-cash, procurement, scheduling, variation, job costing, operations, review generation, recurring revenue, staff and assets. `Lifecycle_Gates` contains 18 phase transitions. The separate website/ecommerce estate is part of the same overall business but retains its own provider authority and release gates.

**Existing unmerged code lines:** `codex/magos-release-0-recovery-20261116` contains dashboard, commercial and job-release additions not present on main. `magos/agent-routing-v1` contains a speculative AG owner resolver. Both were inspected, not blindly merged. The new integration branch `codex/magos-agent-orchestration-v1-20261121` reuses selected components and is accessible through GitHub PR #41.

### Implemented in the current integration candidate
- A real authenticated MAGOS operator interface at `/operator`, with read-only canonical views of leads, clients, quotes, jobs, dispatch, payment allocations, procurement, suppliers, work evidence and audit exceptions. Restored existing browser JS/CSS and its tests from the recovery branch.
- Operator API `GET /v1/operator/dashboard` with a separate read-only credential, plus runtime-compatible read-only `GET /v1/operator/snapshot`.
- Read-only `GET /v1/operator/coverage` and a visible **Whole MAGOS build** navigation area, reading canonical Control Hub `Business_Capability_Map`; a failed/partial capability stays failed/partial, never automatically PASS.
- Read-only quote, deposit and job activation inspections at `/v1/operator/job-readiness/:quoteId`, `/v1/operator/deposit-evidence/:opportunityId` and `/v1/operator/job-activation/:quoteId`. Signed acceptance requires independent verification and proof-of-payment is not treated as cleared funds.
- Six named workflow entrypoints bound to existing governed event processors: Lead Intake, Supplier Inbox, Payment Evidence, Supplier Pricing, Document Intake and Document Filing. This is executable code, not autonomous LLM staff.
- Regression tests for entire command centre, authenticating credential isolation, live-source failure, duplicate IDs, operator read path, controls and workflow delegation.

### Fact / gap matrix (current Control Hub source)
| Capability groups | Current finding |
| --- | --- |
| Inbound lead capture, CRM IDs, evidence and audit | PARTIAL: existing code/data present, live ingestion parity and identity reconciliation pending |
| Qualification, estimation, quoting and client acceptance | PARTIAL: specifications and commercial logic exist; verified version/line acceptance and pricing completeness pending |
| Payment, bank clearance, procurement | PARTIAL: source controls exist; supplier/BOQ/PO/GRN end-to-end release pending |
| Scheduling, field work, job closeout | PARTIAL/FAIL: readiness and final close gates not fully implemented |
| Variations and job costing | FAIL: no independently validated full operational transaction |
| Warranty, reviews and recurring services | PARTIAL/FAIL: existing records and future triggers not yet end-to-end |
| Finance, labour, fleet and management intelligence | PARTIAL/FAIL: cash management/cost actuals and labour capacity still incomplete |
| Website, SEO and ecommerce | SEPARATE SUBSYSTEMS: must integrate via approved source connectors and explicit release gates; not complete via the MAGOS operator UI |
| Core runtime and management cockpit | PARTIAL: code and CI candidate in Git; deployed SHA, credentials, actual readbacks and branch parity not yet proven |
| Legal, risk, security and backup | PARTIAL/UNKNOWN: current access and restore evidence must be refreshed; no autonomous authorization |

**Critical distinction:** GitHub CI PASS verifies a source revision only. Runtime code is not deemed deployed. A valid read-only inspection is not permission to issue a quotation, purchase parts, schedule a client or transfer money. The existing P3 writer/business authority remains intact.

### Exact end-state acceptance before MAGOS is 'COMPLETE'
1. **RUNTIME:** checked-out host commit/worker and authenticated source probes agree with Git `main`; backup/rollback and restored worker are demonstrated.
2. **CLIENT LIFECYCLE:** real provider enquiry -> unique intake -> canonical contact/client/site/opportunity -> qualification -> evidence-backed quote version -> signed acceptance -> cleared deposit policy -> material demand -> procurement receipt -> crew schedule -> actual field work -> resolved variations -> correct final invoice -> reconciled payment -> actual job contribution -> warranty/review/recurrence, with controlled branch-specific exceptions.
3. **ACCOUNTING/OPERATIONS:** every material business status change is written only at its source of truth; payment clearance, supplier cost, profit and tax obligations remain distinct. Every transaction has audit/read-back and repeat-safe state.
4. **WEBSITE/SHOP:** public service/booking flows and approved product variants/payments/shipping/tax/engineering settings pass desktop/mobile/provider acceptance without revealing wholesale costs. No launch claim on a CSS/demo-only pass.
5. **ADMIN/SAFETY:** permissions, legal/safety obligations, staffing, asset readiness, recovery and backup tests have validated owners and evidence. The executive dashboard exposes current exceptions instead of quietly hiding them.
6. **GOVERNANCE:** all 22+ registered business capability and relevant website/shop gates are individually tested, materially complete or explicitly approved as out-of-scope with recorded owner decision. No document-only PASS.

### Exactly one highest-value dependency

**Obtain the actual HOSTAFRICA running Git SHA and authorized read-only probe evidence, then reconcile the main/recovery/integration branch against that deployed baseline.** The integrated source branch is not itself deployment evidence. Do not silently promote older recovery files wholesale or bypass client-money/supplier gates.

## State semantics
- CODED = committed source exists.
- TESTED = named SHA's CI/tests passed.
- INTEGRATED = function is connected to the application/runtime source.
- DEPLOYED = host confirmed exact running SHA.
- PRODUCTION PASS = validated source records, business state, replay and independent QA.
- COMPLETE = whole-business end-state gate met.
