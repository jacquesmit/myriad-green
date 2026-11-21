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


## 21 November 2026 — Business-action integration and canonical closeout build

### Committed implementation after whole-system Command Centre
- Integrated existing `accepted-job-execution`, `accepted-quote-job-plan`, `canonical-job-authority`, `job-commit-readback`, `quote-to-job-readiness`, and `scoped-action-gate` from the recovery branch, preserving original tests.
- Integrated existing `supplier-approval-processor`, `live-supplier-procurement`, `procurement-draft-transaction`, `procurement-issue-approval`, `supplier-procurement-readiness` and their unit/integration tests.
- Added separate bearer-style governance credentials and routes: `POST /v1/governance/create-job`, `/supplier-approval`, `/procurement-draft`, `/procurement-approve`. Their enabling secrets and trusted authority verifier(s) must be deliberately configured; missing independent approval returns REVIEW_REQUIRED. Procurement draft creates only a DRAFT and does not send a PO or authorize payment.
- Explicit generic-route denial prevents bypass through `/v1/transactions` or `/v1/events/run` for the sensitive operations.
- Added live `GET /v1/operator/job-closeout/:jobId` and a job detail UI action using *existing* `Variations`, `Project Direct Costs`, `Project Cost & Margin`, and `Job Execution` Commercial workbook tabs. Requires actual evidence and blocks stale/duplicate/approval-pending data. Does **not** mark job PAID, CLOSED or FINAL PROFIT automatically.
- Independent supplier approval attestation now required in addition to an API token; source event, status change, supplier identity and evidence must match a server-owned verifier result.

### Source-level discovery that corrects earlier planning
The Commercial workbook **already contains a `Variations` register, `Project Direct Costs`, `Project Cost & Margin`, `Labour Rates`, `Quote_Lines` and `Invoice_Lines`**. The Control Hub's CAP-010/CAP-012 wording that suggests creating an entirely new variation/cost store is historically incomplete. Reuse and normalize existing records first. Variation authority in Data_Ownership_Matrix is not yet independently proven, so a new automatic variation mutation is NOT enabled. Do not create an incompatible parallel register.

### Current strict truth state
Code changes are on PR #41, not confirmed deployed to HOSTAFRICA. Tests passing on preceding commits are not evidence of the newest exact SHA. Sensitive endpoints default to disabled or review without configured private tokens/trusted authority. No live customer funds, orders, jobs, supplier approvals or quote statuses were changed in this development continuation.

### Highest-value next execution
Run current-HEAD CI; capture deployed SHA; review release candidate against current `main`, legacy recovery and host worktree; configure private secrets and real authority verifier(s); then controlled quote-to-job and PO draft golden acceptance with record-by-record readback and duplicate replay. Following that, make actual-cost capture and variation approval authoritative in the existing Commercial workbook with policy, writer schema and independent business evidence.


## 21 November 2026 — Scheduling and business release gate integration

- `magos/processor/scheduling-readiness.js` now evaluates actual CRM `Jobs_Opportunities` and `Bookings`, Commercial `Job Execution` and `Procurement`, plus independently cleared `Payment Control` / `Payment_Allocations`. Missing crew/site/scope/materials/technical evidence and duplicate active provider bookings fail closed. Returns `READY_FOR_PROVIDER_AVAILABILITY_CHECK`, not an unauthorized Calendar/Amelia booking.
- Added `GET /v1/operator/scheduling-readiness/:jobId` and the Command Centre job-detail inspection action.
- `magos/processor/job-closeout-readiness.js` assesses existing `Variations`, `Project Direct Costs`, `Project Cost & Margin` and `Job Execution`. A calculated provisional contribution is not final net profit. No auto close/PAID transition.
- Supplier approval now requires independent verified source attestation; token possession alone cannot authorize supplier master mutations.
- Procurement DRAFT endpoint and other governed operations are source-bound and require distinct host credentials. Missing verifier/configuration is a **business release gate**, not a reason to create another parallel MAGOS app.
- Current legacy Control Hub CAP/GATE statuses must be reconciled against source code and real test evidence. The existence of an authoritative `Variations` tab is now independently observed, but its full writer owner/approval transition remains pending.

**Remaining priorities:** run current SHA CI, verify exact host checkout, validate first real controlled job / PO readback, activate approved source authority verifiers, reconcile Commercial variation ownership/schema, implement trusted field actuals and final invoice; then integrate warranty/reviews/service-due with explicit recurrence rules. External provider booking availability and bank clearance must be independently verified, never guessed from CRM snapshots.

No live website, shop, payment, customer or supplier records have been modified by the PR.


## 21 November 2026 — Integrated finance, closure and release-preflight evidence

**Source baseline:** the following changes have been merged into GitHub `main`, not asserted as deployed on HOSTAFRICA.

| Merged PR | Git merge SHA | Code delivered | GitHub test evidence |
| --- | --- | --- | --- |
| [#42](https://github.com/jacquesmit/myriad-green/pull/42) | `014cf982ccb56b5aacb9d4a54a566b632a56ce66` | Canonical invoice/cleared-allocation reconciliation, installed-part warranty and approved maintenance policy candidates, protected operator inspection APIs and Command Centre actions | MAGOS Runtime P2 and Document Extract passed on exact PR head `65ed5b7` |
| [#43](https://github.com/jacquesmit/myriad-green/pull/43) | `dd52582652c73891caf9f796b0484f4a15a151fc` | Single read-only operational close assessment joining job execution, variations, actual costs, invoice, recorded cleared allocations and aftercare | MAGOS Runtime P2 and Document Extract passed on exact PR head `f6b6a68` |
| [#44](https://github.com/jacquesmit/myriad-green/pull/44) | `8724daecf621e13cc5b331965cca2c82c865a9e5` | Authenticated running worker build SHA endpoint, host checkout vs worker SHA preflight, Google source and Control Hub evidence checks, cPanel runbook | MAGOS Runtime P2 and Document Extract passed on exact PR head `aa10125` |

### Actual development statuses

- **CODED/TESTED:** the three PR code paths above. Tests are simulated source-backed/isolated runtime regression tests, NOT live host transaction proofs.
- **INTEGRATED INTO MAIN:** PASS. GitHub `main` contains the new `receivables-reconciliation`, `aftercare-readiness`, `operational-closure`, and `release-preflight` modules and protected runtime endpoints.
- **PRODUCTION DEPLOYMENT:** NOT VERIFIED. The public health URL could not be reached through the available tool. No SSH access, deployment restart, host worker SHA or credential-backed live source read was established.
- **FULL BUSINESS OPERATION:** NOT COMPLETE. Approval sign-off, bank-confirmed clearance, trusted maintenance policy, invoice issuance, live provider replay, procurement/GRN integration, field labor actuals, aftercare dispatch and production go-live gates remain unresolved.
- **RELEASE INTEGRITY:** new read-only host command `node runtime/release-preflight.js` requires an independently approved GitHub commit SHA and the *running worker's* declaration of that same SHA. Preflight PASS is code/source readiness, not proof all 22 capabilities are complete.
- **CLIENT RECORD CHANGES:** NONE from these GitHub PRs. No invoice paid status, supplier authorization, aftercare message, job closed state or ecommerce checkout was changed.

### Highest-value next execution

From HOSTAFRICA cPanel: capture the actual working-tree and worker build SHA, verify private `MAGOS_RUNTIME_TOKEN`, separate `MAGOS_OPERATOR_READ_TOKEN`, set accurate `MAGOS_DEPLOY_COMMIT_SHA` only during an approved deployment/recycle and execute the read-only release preflight. Then run one controlled actual lead, quotation acceptance, deposit, job creation, supplier draft and closeout evidence chain with writer/read-back and same-key replay. Do not mark MAGOS COMPLETE until its operational gates have passed from authentic source records.


## 21 November 2026 — WPVibe live WordPress inspection and signing integration merge

**Live authenticated WordPress evidence (WPVibe, read-only):**
- `https://myriadgreen.co.za` connected as WordPress administrator; active theme Rey Child, WPVibe 1.20.3, PHP 8.5.13, WordPress 7.1.5 (tool-reported values).
- Active `Myriad Green Quote Acceptance Bridge` 0.3.2: code explicitly returns for customer submissions and `GET /mgos/v1/quote-acceptance/verify` always returns `verified:false`. Only owner-test signatures can presently be recorded.
- `Accept & Sign Quotation` WordPress page ID **9481** has `post_status=draft`, so it cannot be used as a published client signing destination.
- WordPress `mgos/v1` REST namespace exposes the older owner-test and verify routes but not the reviewed `verify-v2` endpoint.
- Active MAGOS Systems Calculator 3.0.0 runs as a shortcode and has no default MAGOS financial write authority.
- WPVibe authenticates WordPress only. Its WP-CLI is a PHP emulator; it does **not** inspect/deploy the independent HOSTAFRICA Node worker or Git worktree.

**Source integration:** GitHub PR [#45](https://github.com/jacquesmit/myriad-green/pull/45) was merged into `main` at commit `fe970930c15bbf6eb8989179d5fab8ded97d08ef`. It adds:
1. `magos/wordpress/mgos-reviewed-client-signature.php`: **undeployed candidate** companion for signed client receipts, private reviewer signature inspection, explicit approval evidence and authenticated `verify-v2`.
2. `magos/processor/wordpress-acceptance-verifier.js`: HTTPS-pinned source verification matched against Commercial `Quotes`, exact `Quote_Lines` active version, issued PDF and immutable signing receipt. Existing quote-to-job governed release remains protected by independently cleared funds and server-side authority.
3. `magos/processor/signed-quote-link.js` and isolated `POST /v1/governance/quote-signing-link`: creates HMAC signed client URLs only for active, issued, non-expired, exact-version quotes **after** confirming that the WordPress signing page is public and the reviewed WordPress verification route exists. Under the actual live WordPress conditions above, it correctly fails closed without emitting a link.
4. New PHP lint, static review-contract tests, Node verifier/link tests and runtime integration; the corresponding GitHub MAGOS Runtime, Document Extract and WordPress Signature Bridge workflows all returned **success** on PR head `15cfde5828fb2919139dbaee6b202a30b5c49ab9`.

**Truthmode:** CODED/CI-TESTED/INTEGRATED IN GIT = PASS. WordPress companion plugin deployed = NO. Signing page published = NO. HOSTAFRICA runtime deployed at current SHA = UNKNOWN. Customer acceptance positive end-to-end tested = NO. Entire MAGOS business operating system complete = NO. No WordPress production publishing, plugin installation, customer payments, quote status changes or job writes occurred.

**Release blocker and specific acceptance path:** Authorized server deployment access is required to install the verified companion WordPress plugin, stage and publish the quote signing page after browser acceptance, set matching secret config privately, reconcile the HOSTAFRICA Git/lsnode version, run `node runtime/release-preflight.js` and execute a controlled quote/signature/cleared-deposit/job golden transaction with source read-back. The required cPanel/SSH/worker access was not available through the WordPress-scoped WPVibe connector. Preserve live trading until these checks pass.


## 21 November 2026 — Canonical supplier allocation cost verification and operator queue

Three independently merged/tested development changes now exist on GitHub `main`:

| PR | Merge SHA | Delivered | CI result |
| --- | --- | --- | --- |
| [#50](https://github.com/jacquesmit/myriad-green/pull/50) | `e317c937e8ef1dbc7fc37252039df8967dfc05c5` | Supplier `Cost_Allocations` / `Supplier_Source_Lines` evidence reader; exact job/part/invoice/cents, reverse/supersession, allocation and external reviewer/stock checks; protected API and P3 verifier integration | MAGOS Runtime P2 and Document Extract PASS |
| [#51](https://github.com/jacquesmit/myriad-green/pull/51) | `cacd17dc719239c12056d095649e9bbd84a5446f` | Operator job-detail form for inspecting a specific supplier allocation and showing actual blocker reasons | MAGOS Runtime P2 and Document Extract PASS |
| [#52](https://github.com/jacquesmit/myriad-green/pull/52) | `032f52828c0af36e53c0cf3d27ffe92961b1da07` | Read-only job-level supplier allocation exception queue, including allocations matching opportunity but lacking job linkage, and protected operator action | MAGOS Runtime P2 and Document Extract PASS |

**Verified source finding:** existing Supplier `Cost_Allocations` contains a record with `FULLY_RECONCILED` status but an invalid placeholder `evidence_link` and self-referencing `reversal_of_allocation_id` / `supersedes_allocation_id`. The new verifier rejects this record; it does **not** silently count this as an evidenced expense.

**Source truth levels:** CODED/TESTED/MAIN = PASS for these modules. Real independent invoice-review authority and physical stock-split authority must be wired to their verified providers before positive production expense verification. A spreadsheet label alone is not a supplier invoice or goods receipt. HOSTAFRICA runtime deployment SHA and end-to-end production transactions remain UNVERIFIED. No supplier invoice, job cost, stock ledger or payment record was modified by these commits.

**Next high-leverage execution:** ground and implement independent supplier invoice-review and stock-split attestations from exact canonical source documents and approved physical allocation events. Then run a controlled single job receipt test through P3 write/readback. Preserve WooCommerce/WordPress customer production unchanged until separately accepted.


## 21 November 2026 — Supplier receipt/stock corroboration and running-worker SHA attestation

**Merged and GitHub CI PASS:**
- [PR #53](https://github.com/jacquesmit/myriad-green/pull/53) merge `093dd7a196eb8af05ac116f6b01b4a792b1f8a7c`: real Supplier `Goods_Received` + `Stock_Ledger` reconciliation is required alongside `Cost_Allocations`, supplier invoice identity, canonical part, matching Drive source ID, undamaged quantity, amount and exact negative stock issue to the job. Quotation-only, ambiguous GRN, unlinked inventory and contradictory allocation evidence fail closed. Existing independent invoice/physical stock approval remains required; no fake supplier authority is created.
- [PR #54](https://github.com/jacquesmit/myriad-green/pull/54) merge `667e382c815351143c42fbbfe97edcfad26a45cc`: runtime `/v1/runtime/build` now captures Git SHA and tracked-worktree state *at worker startup* independently from `MAGOS_DEPLOY_COMMIT_SHA`. Only matching clean checkout and declaration produce a verified fingerprint; build/readiness preflight rejects the old env-only declaration and disallows HTTP redirects on credential-bearing requests.

**Test evidence:** MAGOS Runtime P2 and MAGOS Document Extract both completed with `success` for PR #53 head `89ab8094e4494dc505982d5ec1ca221f9a87a695` and PR #54 head `38e489afd3bcbad778fa3d5672c19b527d4e51ec`. No production purchase, stock or bank record was written.

**Implementation truth:** source MERGED/CI-TESTED PASS. Independently reviewed supplier invoice and real stock release providers PARTIAL/PENDING; customer transaction acceptance test UNKNOWN; HOSTAFRICA deployed worker SHA NOT VERIFIED. The enhanced runtime must itself be deployed before the stronger build proof can be collected; a GitHub merge is not production acceptance.


## 21 November 2026 — Supplier job queue independent-authority repair (release candidate)

**Current source:** PR candidate `codex/magos-supplier-queue-authority-20261121`. The earlier #52 supplier queue was coded and exercised against blocked evidence, but its runtime route omitted `supplierCostReviewAuthority` and `supplierStockSplitAuthority`, so a real independently approved supplier allocation could never receive a positive decision through the job queue. The queue also re-read Goods Received and Stock Ledger for every allocation instead of keeping a consistent read-only view.

**Implemented in this candidate:**
- Job-queue processor now accepts and propagates *server-owned* independent reviewer and stock-split authority callbacks, never browser assertions.
- Authenticated operator route passes the existing configured authority functions.
- Canonical Supplier `Cost_Allocations`, `Goods_Received` and `Stock_Ledger` are read once for the full job inspection; unavailable dependent source fails closed.
- Queue state `INDEPENDENTLY_VERIFIED` is attainable only when exact supplier source, GRN, issue and independent callbacks all pass. No source or no configured authority is never represented as approved.
- Added positive and adverse regression tests covering matching invoices/cost cents/part quantities, missing authority and unavailable source.
- **Audit semantics:** read-only queue; never pays suppliers, creates orders, adjusts stock or marks final margin.

**Acceptance gates:** code staged in branch; GitHub CI and merge must be captured before marking CODE PASS. HOSTAFRICA worker commit still unverified, production inspector unavailable until verified deployment. WordPress quote-signing bridge remains not deployed; none of the missing source approvals may be treated as cleared.

**Highest next execution:** run exact-head CI, merge only on PASS; then inspect/repair documented live supplier allocation reversal/evidence contradictions through independently reviewed transactions, not silently writing a valid-looking status.


## 21 November 2026 — Supplier queue source-state fix and automatic Markdown evolution gate

**Merged code change:** [PR #55](https://github.com/jacquesmit/myriad-green/pull/55), Git merge SHA `365dd70b64b169baac4e292812d393484191fa7b`. This repaired `job-supplier-cost-queue.js` to pass the server-side independent invoice reviewer and stock-split authority callbacks, use a consistent source snapshot for Supplier Cost_Allocations, Goods_Received and Stock_Ledger, and return positively verified only when all independent evidence gates pass. A missing supplier ledger fails closed. Runtime P2 and Document Extract CI both passed on the reviewed PR head `7082ab38dd72976347257acc6e5d4c111dd74083`. No live cost, inventory, supplier, customer or bank row was written.

**New change in this PR candidate:** `magos/docs/MAGOS-CURRENT.md` created as the short authoritative source-of-truth index, retaining this append-only historical file and linked deployment/quote bridge runbooks. The new `magos/scripts/require-status-update.js` rejects code, tests, scripts or MAGOS workflow changes unless BOTH MAGOS-CURRENT.md and MAGOS-STATUS.md are changed in the same PR. The new `.github/workflows/magos-status-gate.yml` runs that gate using exact PR base/head SHAs and unit tests with full checkout history.

**Current truth:** gate code authored, workflow CI and branch policy enforcement TO_VALIDATE on exact PR head; host deployment, WordPress signature plugin, cleared funds release and end-to-end business acceptance remain NOT VERIFIED. Do not mark the entire system complete. Each future MAGOS code release must file current+historical Markdown along with its implementation and test evidence.


## 21 November 2026 — Finalized PR #56 + live release-boundary validation

**Update process completed and filed:** [PR #56](https://github.com/jacquesmit/myriad-green/pull/56) merged to GitHub `main` at commit `ec1510d526fa44c1b0de97436e19d125b0582beb`. Its new `MAGOS Evolving Status Gate` workflow **PASSED** (first workflow run), and the MAGOS Document Extract suite also **PASSED**. The new [MAGOS-CURRENT.md](MAGOS-CURRENT.md) is the concise first-read status pointer, while this existing document remains the append-only decisions and engineering history. The gate checks actual PR file changes and requires both files for code/agent/workflow/CI changes. **Required GitHub branch-protection enforcement remains TO_CONFIRM**; do not claim an unbypassable rule.

**Live WPVibe verification after merge:** WordPress `https://myriadgreen.co.za` connected with authenticated read access. `wp post get 9481 --field=post_status` returned `draft`; live REST `/mgos/v1` only exposed the legacy owner-test and `quote-acceptance/verify` routes, NOT `quote-acceptance/verify-v2`. Therefore customer-signing production acceptance is **FAIL** and the proposed reviewed companion is **NOT DEPLOYED**. No WordPress pages or plugins were mutated.

**HOSTAFRICA runtime:** read-only public `https://runtime.myriadgreen.co.za/healthz` and `/readyz` checks were inaccessible through the available web tool. This **does not prove an outage** and it does not prove release readiness. Worker SHA, environment configuration and P3 live transaction tests remain **UNKNOWN/TO_CONFIRM**.

**Source-of-truth status:** code and Git CI PASS for PR #55/#56; production execution not validated. Continue to reconcile `MAGOS-CURRENT.md` and `MAGOS-STATUS.md` in every subsequent MAGOS implementation PR. The next high-leverage real release gate remains a verified HOSTAFRICA deployed SHA plus WordPress customer signature plugin/page and controlled source-backed quote-to-job transaction, without customer financial writes until authorities are proven.


## 21 November 2026 — Reviewed signature vs live quote-line version: race hardening (candidate)

**Concrete source fault:** pre-existing `accept-reviewed-quote.js` applied the signed acceptance to `Quotes` with quote-state/PDF preconditions only. Its independent WordPress verifier checked `Quote_Lines` separately; a subsequent current-line revision could invalidate the signed version without changing the `Quotes` row and might be reported as accepted. Existing Commercial headers were previously inspected: `Quote_Lines` includes `quote_line_id`, `quote_id`, `quote_version`, `line_status`.

**Implementation:** read current quote lines after signature verification, verify exactly one current version equals the signed receipt, require unique quote-line IDs, add writer preconditions to each current line, and repeat version + line-ID-set readback after the P3 quote-state mutation. Record `COMMIT_READBACK_UNVERIFIED` on post-write mismatch. The general runtime token still cannot bypass protected quote-acceptance governance; payment clearing, job creation and procurement remain separate.

**Truth state:** candidate branch only, GitHub test and merge pending. No WordPress, hosting, quote, job or payment source records modified. This is not a fully atomic row-set lock against concurrent new rows: an immutable issued-document version authority is still required for production-level signed-consent guarantee. Keep whole-system production gate OPEN until validated.


## 21 November 2026 — PR #57 merge and tested quote-line version integrity

- **MERGED:** [#57](https://github.com/jacquesmit/myriad-green/pull/57) at `4b63ac60493a986a277114ed6bfb7230517ba728`.
- **Exact-head CI:** `275d69226ff582c9f670088fcfa08fbc98032af9`: MAGOS Runtime P2 #185 PASS, MAGOS Document Extract #218 PASS, MAGOS Evolving Status Gate #2 PASS.
- **What changed:** after independent reviewed WordPress signature verification, checked canonical current quote-line version and unique line IDs; added per-line P3 optimistic preconditions and readback of version and current-line set. Stale signatures, duplicates and post-write line revisions cannot be presented as verified success.
- **Production evidence:** no HOSTAFRICA live deploy or WordPress companion installation; source-level Google Sheets row-set insertion cannot be proven atomic. No quote, deposit or job ledger changes were made. Customer signing remains FAIL/NOT LIVE.


## 21 November 2026 — Reproducible reviewed client signature WordPress artifact (candidate)

**Engineering:** new `magos/scripts/package-reviewed-signature-plugin.sh` packages the existing, unchanged reviewed-signature PHP source into a single WordPress-installable folder ZIP and SHA-256 manifest. The existing `MAGOS WordPress Signature Bridge` GitHub CI now validates plugin PHP syntax and source contract, runs archive integrity/determinism tests and publishes the artifact to the run. No FTP credentials, signature data, host configuration or database contents are shipped.

**Acceptance:** GitHub CI/merge pending for candidate. The artifact is not installed automatically and WordPress `verify-v2` remains absent on the live site; page 9481 remains draft. Staging test, authenticated admin review, controlled installation, signed receipt and exact commercial quote/readback still required. Do not mark signing production-complete.

## 21 November 2026 — Merged PR #58, verified WordPress plugin ZIP packaging

- **GitHub merge:** [PR #58](https://github.com/jacquesmit/myriad-green/pull/58), commit `b4af09d03975938ab0c63ee1b850a555b3528a25`.
- **Exact PR head:** `071f7588426afc850b51f2d9862476acaf09fa53`. MAGOS WordPress Signature Bridge workflow #5 PASS (PHP lint, static signature controls, deterministic ZIP checks and ZIP upload), MAGOS Evolving Status Gate workflow #5 PASS, MAGOS Document Extract workflow #224 PASS.
- **Build outputs:** installable `magos-reviewed-client-signature.zip` and `magos-reviewed-client-signature.zip.sha256` via GitHub workflow artifact; no token, customer signature, WordPress database export or runtime secrets packed.
- **Truth:** code and CI artifacts PASS; live WordPress installation, reviewed endpoint, published client-signing page and signed quotation golden transaction NOT VERIFIED/NOT COMPLETE. HOSTAFRICA running Node SHA still NOT VERIFIED. No real customer acceptance, payment or booking was altered.


## 21 November 2026 — Exact deposit payment-event reconciliation before new job release (candidate)

**Source audit:** existing Commercial `Payment Control`, `Payment_Allocations`, `Payment_Events` headers independently inspected. The prior inspector summed `Payment_Allocations` marked `CLEARED` with any non-empty evidence reference, without verifying the backing payment event or uniqueness of allocation/event IDs. This could double count or accept stale proof.

**Implementation:** require exact deposit `payment_event_id` matching an unambiguous `Payment_Events` row with same opportunity, control, amount in cents, clearance state, cleared event type, Drive evidence, source authority and idempotency key. Reject duplicate allocation IDs, re-used bank events, invalid linked invoice/deposit identities, source read failures and malformed amounts. Zero-deposit records require separate approved release logic instead of fabricated bank clearance. Canonical job authority continues to source financial evidence from this inspector; no HTTP caller assertion is sufficient.

**Financial control limitation:** matched internal bank-event rows do not independently prove funds have reached the beneficiary bank. `independent_bank_confirmation:false` is explicit, and no job, bank, quote or supplier record has been mutated by this PR.

**Acceptance:** branch candidate `codex/magos-deposit-event-reconciliation-20261121`, exact-head Runtime P2, Evolving Status Gate, Document Extract suites and merge pending. HOSTAFRICA running worker, real payment provider/bank evidence and live job-release readback still UNVERIFIED.


## 21 November 2026 — External bank/provider settlement mandatory for governed job creation (candidate)

**Verified finding and correction:** PR #60 added exact internal Payment_Events reconciliation, but `canonical-job-authority.js` could still return `verified:true` for a job using only rows marked CLEARED in MAGOS. That is internal bookkeeping, not independent beneficiary-bank credit. To preserve "Unknown is not Yes," the protected job creation authority now takes an additional *server-owned* `bankClearanceVerifier` callback. It must be configured independently of operator/runtime tokens and must bind the exact control/opportunity/job, event IDs, cents, source BANK or PAYMENT_PROVIDER, cleared settlement and unique confirmation. Otherwise the quote-to-job transaction is REVIEW_REQUIRED; payment proof is never treated as cleared money.

**Implementation scope:** canonical-job-authority.js, runtime/app.js, unit and negative tests. Existing business records are read-only. No client, payment, purchase order or live WP production action was issued. Direct `jobAuthorityVerifier` test injection is not a live settlement provider.

**Current status:** code/test/MD candidate; CI + PR merge PENDING. HOSTAFRICA SHA, bank-provider callback, reviewed WordPress signature plugin, signed quote acceptance and actual P3 job replay remain NOT VERIFIED. Next source of truth remains [MAGOS-CURRENT.md](MAGOS-CURRENT.md); preserve this append-only history.


## 21 November 2026 — Merged financial release controls #60 and #61

**PR #60:** [canonical cleared deposit/payment-event reconciliation](https://github.com/jacquesmit/myriad-green/pull/60) merged at `834514014a431ebb7b3822a7d7ffbf16c01e7f04`; tested exact PR head `dab273b7e7a53db016ff16229a89c8718e0da94e`. MAGOS Runtime P2 #189, MAGOS Document Extract #230 and MAGOS Evolving Status Gate #8 all returned success. Actual Commercial `Payment Control`, `Payment_Allocations`, and `Payment_Events` schemas were read before implementation. Duplicate allocation or payment-event IDs, mismatched amounts/opportunities, non-cleared events, missing bank-credit evidence and zero-deposit false clearance now fail closed. Source payment-event reconciliation does not prove bank settlement.

**PR #61:** [independent bank/provider settlement authorization](https://github.com/jacquesmit/myriad-green/pull/61) merged at `be3802995169d6f596dd025e670ef8fb698452f9`; tested exact PR head `32541c32234319984befe17b22f36f1af2e13721`. MAGOS Runtime P2 #191, MAGOS Document Extract #232 and MAGOS Evolving Status Gate #9 all returned success. The server-owned canonical quote-to-job verifier now additionally requires a trusted BANK/PAYMENT_PROVIDER confirmation binding job/opportunity/control, unique cleared payment events, cents, status and confirmation ID. Missing callback or mismatch prevents governed job creation. No caller-supplied payment claims can substitute for this verifier.

**Truthmode:** CODE MERGED and CI VERIFIED = PASS; independent bank/provider callback **NOT CONFIGURED**; HOSTAFRICA deployed worker SHA **NOT VERIFIED**; reviewed WordPress signing bridge **NOT DEPLOYED/NOT VERIFIED**. No live payment, quotation, customer, job, supplier, stock or website records were mutated. This hardened gate may intentionally leave new job creation BLOCKED until trusted bank verification is integrated. Do not mark the entire MAGOS operating system production complete from this evidence.

**Next high-leverage action:** bind real credentialed beneficiary bank/provider credit confirmation to the callback, deploy the approved exact runtime SHA with rollback on HOSTAFRICA, and execute controlled positive/negative signed-quote → cleared-bank-credit → job P3 acceptance tests with readback/idempotent replay. The WP bridge remains independently blocked pending controlled installation and published-page acceptance.


## 21 November 2026 — Job-create precommit financial CAS (candidate)

**Why:** after PR #61, the bank settlement attestation passed before P3 job-create. Only quote/CRM preconditions were bound to the subsequent transaction. A bank event subsequently reversed, or allocation status altered, could leave the job approved against stale evidence.

**Changes:** added `job-payment-commit-preconditions.js`, which reuses the canonical deposit inspector and live registered `Payment Control`, `Payment_Allocations`, `Payment_Events` headers, ensures exact bank-attested unique IDs and cents, and prepares compare-and-match preconditions for all financial rows in the job-create P3 plan. The protected job executor requires authority opportunity identity and will fail without consistent evidence. The trusted bank verifier returns canonical opportunity ID. Regression cases cover valid dry-run, missing financial confirmation, mismatched opportunity, altered/revoked deposit and payment-event clearance at transaction time. Both current-state and historic MD files are included with the code candidate.

**Release classification:** CODE PENDING CI; merge PENDING; HOSTAFRICA SHA, real independent bank callback, reviewed WordPress client-signature plugin, deposit-bank integration and live P3 acceptance remain NOT VERIFIED. P3 row preconditions are not whole-sheet serializability, and no actual bank, quote or job row was mutated.


## 21 November 2026 — PR #62 merged: P3 deposit evidence compare-and-match

- **PR:** [#62](https://github.com/jacquesmit/myriad-green/pull/62); merged Git commit `5bd261451e69b35c9670d3fe4cfc636f80fd6f48`; exact tested head `5c2b9fbb368d3e734ad3cbadd8cfef0e8eb668e1`.
- **CI:** Runtime P2 run #193 PASS; Document Extract #236 PASS; Evolving Status Gate #10 PASS.
- **Code:** canonical independent bank/job authority now includes the verified opportunity ID; new `job-payment-commit-preconditions.js` generates compare-and-match checks for the exact Payment Control, Payment_Allocations and Payment_Events records. `accepted-job-execution.js` requires the attested opportunity to match the quote and extends the same P3 job-create transaction's preconditions. Tests verify rejection if a payment is reversed, reallocated, missing bank authority or modified before P3.
- **Truth:** CODE and TESTS PASS, merge PASS. HOSTAFRICA actual deployment, approved bank/provider confirmation and production golden-path job write/readback still UNKNOWN/BLOCKED. No independent bank confirmation was generated by these tests; no production transaction was executed. Whole-sheet atomicity remains an unresolved architectural limitation.


## 21 November 2026 — Bank-attested amount carried into final P3 job authorization (candidate)

**Observed engineering risk:** job-release source reconciliation could accept an internally consistent payment amount that changed after independent bank confirmation, because the previous attestation propagated the bank's event IDs but omitted `bank_confirmed_amount_cents` in the last-mile check.

**Implementation:** preserve integer bank-confirmed cents and required-deposit cents in canonical server-side authority; the job payment CAS builder now rejects missing or changed external cents and verifies source totals and deposit requirement against both bank attestations. The self-comparison validation of event ID arrays was replaced with explicit uniqueness checks. Tests cover valid sources, changed payment-event and allocation amounts together, changed required deposit and missing/mismatched bank amounts. No generated bank credentials or evidence.

**Release truth:** code and corresponding current/historical MD committed on branch; exact-head CI and merge PENDING. Real bank provider callback, reviewed signed quote plugin, HOSTAFRICA release SHA and live end-to-end transaction acceptance remain blocked/unverified. Source rows unchanged.


## 21 November 2026 — PR #63 merged; WordPress production signing source rechecked

- [PR #63](https://github.com/jacquesmit/myriad-green/pull/63) GitHub merged SHA `1acc9f8ec104c860a1a46fbe5968bed2311cfe0d`; exact CI head `879b28ba693d8c6e6ce91a0c4e3f620f80a9a4f3`; Runtime P2 #195 PASS, Document Extract #240 PASS, Evolving Status Gate #11 PASS. Exact independent bank cents now survive through P3 precommit checks and reject internal event/allocations amount changes with unchanged payment identifiers.
- Read-only authenticated WPVibe confirmed client page post `9481` is still `draft`; `mgos/v1` exposes legacy `verify` and owner-test only, not `verify-v2`. Legacy deployed source `mgos-quote-acceptance` v0.3.2 explicitly returns on non-owner-test Fluent submissions. No client signature or production deployment was performed. No permissions or plugin state were changed.
- Whole MAGOS is NOT production-certified; bank/provider callback, reviewed WP plugin installation, HOSTAFRICA running SHA, client signature end-to-end and golden transaction remain open.


## 21 November 2026 — Reviewed WordPress client acceptance purpose isolation (candidate)

**Source defect:** the candidate companion client-signature plugin rejected owner-test tokens but allowed any other signed purpose value, including missing/unknown purpose. The admin reviewer accepted a generic drive.google.com HTTPS link; this did not uniquely identify a signed receipt file.

**Implementation:** require exact signed purpose `CLIENT_ACCEPTANCE` before storing a pending client signature receipt; insist on file-specific `https://drive.google.com/file/d/<id>` evidence during human approval and private `verify-v2` response. Added static source regressions; PHP lint, package SHA and all relevant GitHub CI pending. No client signing data, live WordPress plugins/pages or customer transactions were modified.

**Release state:** branch candidate `codex/magos-client-signature-purpose-isolation-20261121`, CI/merge pending. Real production WordPress install, published signing page and server-side source receipt verification remain not done.


## 21 November 2026 — PR #64 merged with reviewed WordPress plugin release artifact

- GitHub [PR #64](https://github.com/jacquesmit/myriad-green/pull/64) merged at `f515b707c7d357d3928d17e5d721b83cc22f04e5`; exact PR head `0d8400c704e6a6ec7885692875c42a24b518a9cb`. WP Signature Bridge #7 PASS, Document Extract #244 PASS, Evolving Status Gate #12 PASS. No runtime tests were required for the PHP-only changes.
- Published GitHub Actions `magos-reviewed-client-signature-plugin` artifact ID `14725111232` (outer artifact SHA-256 `731dcf3e9b7456ddf94b8a81cdbb29703b774e5e390e1cd547f9ecdae3797eee`). Contains compiled PHP plugin archive and its SHA-256; archive expires 2026-12-21. The client submission now requires exact `CLIENT_ACCEPTANCE` purpose, and approval/verify-v2 require a file-specific Drive evidence link.
- WordPress 0.3.2 OWNER_TEST plugin remains live unchanged; client signing post ID 9481 is still a draft, no verify-v2 endpoint. No production plugin activation or customer-signature data write occurred. Full accepted-quote -> independently confirmed deposit -> P3 job launch remains NOT VERIFIED. Production release cannot be certified from this CI artifact.
