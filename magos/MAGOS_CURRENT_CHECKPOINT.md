# MAGOS Current Development Checkpoint

Last updated: 2026-10-04
Status: ACTIVE DEVELOPMENT

## Production baseline

- Branch at checkpoint creation: main
- Baseline commit: 3029f57
- Commit: fix(runtime): default hosted runtime version to P5
- Previous TEST-071 quota-hardening baseline: 656fc8b
- Hosted runtime: MAGOS P5
- Production architecture remains governed EventEnvelope -> processor -> TransactionPlan -> P3 Transaction Writer -> audit/readback.

## Completed production acceptance

TEST-069 supplier-email acceptance:

- Case 1: PASS
- Case 2: PASS
- Case 3: PASS
- Case 4: PASS on tested production scope
- Case 5: PASS
- Case 6: PASS
- Exact duplicate replay: PASS

TEST-069 overall status remains IN_PROGRESS because the remaining acceptance matrix has not been completed.

Cases 4-6 have been independently production-vetted, but formal Audit_Tests recording of the latest Cases 4-6 remains TO_CONFIRM until independently read back.

## Case 6 historical evidence

At Case 6 execution time:

- supplier_id: SUP-AQUADAM-GAUTENG
- supplier: Aquadam
- supplier_approval_state: VETTING
- active_status: ACTIVE

MAGOS correctly routed the event to review because automated downstream supplier handling requires:

supplier_approval_state == APPROVED
AND
active_status == ACTIVE

Case 6 is immutable historical acceptance evidence and must not be rewritten because Aquadam was subsequently approved.

## New business decision

Aquadam has now been approved by Myriad Green.

This business decision has NOT yet been applied to the authoritative Supplier Master through a governed production transition.

Do not manually overwrite the Supplier Master merely to bypass governance.

## Identified capability gap

MAGOS currently reads and enforces supplier_approval_state but no governed supplier-approval mutation workflow was found.

Existing downstream enforcement is correct and must remain.

## Architecture decision

Do NOT create another low-level mutation mechanism.

Use the existing P3 STATE_TRANSITION transaction-writer operation.

Required governed event:

SUPPLIER_APPROVAL_CHANGED

Supplier approval lifecycle:

- VETTING
- APPROVED
- EXCLUDED
- SUSPENDED

supplier_approval_state remains the authority for approval state.

active_status remains a separate authoritative fact.

Normal automated supplier handling continues to require APPROVED + ACTIVE.

## Required implementation

Add supplier approval governance through the existing architecture:

1. Event-routing rule for SUPPLIER_APPROVAL_CHANGED.
2. Processor registry registration.
3. Exact supplier_id resolver.
4. Supplier approval planner.
5. Supplier approval processor.
6. STATE_TRANSITION transaction plan.
7. Expected current-state enforcement.
8. Evidence requirement.
9. Guard enforcement.
10. Idempotency.
11. Unit/integration tests.
12. Independent production readback.

No fuzzy supplier matching.
No supplier creation through an approval event.
No email/domain/name inference for approval authority.

## First production acceptance

After code review and tests pass:

Use Aquadam as the first real governed supplier approval transition:

SUP-AQUADAM-GAUTENG
VETTING -> APPROVED

Then independently read back:

- Supplier Master state
- transaction writer result
- run/audit evidence
- event transition evidence
- idempotent replay behavior
- prohibited/unintended mutations

Only then mark the supplier-approval capability production PASS.

## TEST-069 remaining work

After supplier approval governance is controlled:

- verify/update Audit_Tests for Cases 4-6
- Case 7 unknown sender review
- source collision
- UNKNOWN guards
- attested CLEAR/BLOCK behavior
- ambiguous exact sender where applicable
- prohibited mutation proof for applicable cases
- final TEST-069 verdict only after the full acceptance matrix passes

## Recovery rule

At the end of every material MAGOS development session:

1. Commit intended code changes.
2. Record current branch and commit.
3. Update this checkpoint with completed work and evidence.
4. Record unresolved BLOCKED / TO_CONFIRM / UNKNOWN items.
5. Record exactly one next implementation action.
6. Never mark production PASS without independent live readback.

## Implementation update — 2026-10-11

- Development branch already existed; no new branch created.
- Added governed `SUPPLIER_APPROVAL_CHANGED` processor using existing P3 `STATE_TRANSITION`.
- Registered processor and event-routing allowlist on development branch.
- Added exact canonical supplier ID and expected current-state checks; no supplier creation.
- Added governance-source/actor/authorization attestation requirements and evidence/guard gating.
- Added focused negative and positive tests. Tests are committed but NOT YET EXECUTED on the hosted working tree.
- No Aquadam production mutation performed. No production PASS claimed.
- Current development branch commit: `08cf5d0` before this checkpoint update.
- TO_CONFIRM: Node unit/integration test outcome, event ingress authorization provenance, writer schema/authority registry compatibility, production readback and idempotent replay.

## 2026-10-11 implementation continuation

- Server confirmed 12/12 focused supplier-approval and registry tests PASS at `34a2932`.
- Added separate-token `/v1/governance/supplier-approval` ingress on development branch, with server-built approval attestation rather than caller-supplied `approval_authorized` metadata.
- Generic `/v1/events/run` rejects supplier approval; generic `/v1/transactions` rejects direct writes to canonical `supplier/Suppliers`.
- Approval governance endpoint requires explicit guard results rather than inventing CLEAR attestations.
- Added runtime HTTP tests for credential isolation, prohibited paths and guard preservation.
- These subsequent runtime authorization changes have NOT YET been executed/tested on the hosted checkout.
- Aquadam production mutation NOT EXECUTED.

## Verified hosted test evidence — 2026-10-11

- Server fast-forwarded successfully to `49c1c0a`.
- Node.js 20 ran `tests/runtime-http.test.js`, `tests/supplier-approval-governance.test.js` and `tests/processor-registry.test.js`.
- Result: **35 tests PASS, 0 FAIL** (runtime HTTP + governed supplier approval + registry).
- Dedicated supplier approval auth, generic event/transaction bypass rejection, guard preservation and exact P3 transition planning passed test execution.
- Evidence source: operator-provided hosted terminal transcript, 2026-10-11.
- Not yet verified: production deployment, writer authority/schema registry parity, authenticated live approval event and independent supplier/audit readback.
- Aquadam Supplier Master has not been mutated through this implementation.

## Verified P3 writer integration — 2026-10-11

- Hosted checkout fast-forwarded to `2ad0b18`.
- Three tests in `supplier-approval-writer-integration.test.js` passed, zero failures.
- Verified simulated authoritative-store commit, preservation of `active_status`, idempotent duplicate, registry/owner rejection and stale-state rejection.
- Combined focused results so far: 35 HTTP/processor/registry tests + 3 P3 writer integration tests PASS.
- TO_CONFIRM: live Supplier Master `Suppliers` headers, Writer_Schema_Registry mappings, Data_Ownership_Matrix row, hosted deployment and real governance credential.
- Aquadam production mutation remains NOT EXECUTED.

## P5 business-lifecycle development — 2026-10-11

- Built read-only `processor/quote-to-job-readiness.js` to evaluate accepted quote, exact opportunity, signed acceptance evidence, canonical line status, cleared payment and existing job duplication independently.
- Added focused unit tests in `tests/quote-to-job-readiness.test.js`.
- These newly added tests have NOT YET been executed; code is development-only, no production workflow changed.
- No job, payment, quote or supplier business record has been mutated by this development.
- Aquadam remains business-approved but canonical supplier state VETTING pending governed production transition; quote-access controls remain separate.

## Exact next action

Run `tests/quote-to-job-readiness.test.js`, then bind quote-to-job release decisions to verified authoritative lookups and the existing `createJobFromAcceptedScope` transaction-plan helper; do not invent payment clearance or acceptance evidence.

## P5 procurement draft transaction implementation — 2026-10-11

- New `processor/procurement-draft-transaction.js` binds canonical supplier and quote through existing ExactLookupService, computes a governed P3 `CREATE_IF_ABSENT` transaction plan for an **UNRELEASED DRAFT** Purchase_Orders record, and exposes `dryRun` and execution paths.
- New `tests/procurement-draft-transaction.test.js` covers write invocation, replay no-op, missing quote, supplier exclusion, mismatched supplier, no evidence/project and dry-run. Newly committed tests awaiting hosted execution. The suite uses a fake writer; actual P3 integration remains TO_CONFIRM.
- Live Audit `Writer_Schema_Registry` now has WSR-480..492 for Supplier Purchase_Orders needed fields, exact columns and readback verified, 13/13.
- Live purchase order creation or release NOT executed; supplier financial permissions and PO line/requirement reconciliation NOT claimed complete. Do not treat draft as authorization to buy.
- Remaining integrated release work: P3 real writer integration test, authoritative BOQ/PO-line reconciliation, authenticated release endpoint and independent audit readback. No unrelated workflow should be blocked by these work items.

## Procurement issue approval integration, 2026-10-11

- Added `processor/procurement-issue-approval.js`: read-only join of authoritative `Purchase_Orders`, `Purchase_Order_Lines`, Commercial `Procurement`, `Supplier_Quotes` and Suppliers; validates exact job, PO line to procurement, BOQ part, approval status, cleared deposit and arithmetic; compiles a P3 `STATE_TRANSITION` DRAFT→APPROVED_FOR_ISSUE. This means internal approval only, never supplier dispatch or payment.
- Added `tests/procurement-issue-approval.test.js` with happy path and negative cases; new tests not yet executed on hosted Node.
- RELEASE BLOCKER: approvalEvidence/approverId are caller inputs and require independently authenticated operator authority plus durable evidence verification before exposing or executing this plan in production. No production route or order issue created.
- Production procurement capability remains PARTIAL: true order dispatch, complete PO lines/requirements workflow and authenticated approval endpoint remain pending. Development of other capabilities is not blocked.

## P5 procurement approval runtime batch — 2026-10-11

- `runtime/app.js`: dedicated `/v1/governance/procurement-approve` route requires `MAGOS_PROCUREMENT_APPROVAL_TOKEN` distinct from normal runtime, lead ingress and supplier approval credentials. Caller IDs and evidence are validated before canonical lookup. Authenticated request plans exact PO/BOQ/deposit review via `procurement-issue-approval`, then executes the P3 writer; generic `/v1/transactions` blocks supplier `Purchase_Orders` mutations.
- `tests/procurement-approval-http.test.js`: 4 HTTP security and integration tests committed; hosted execution NOT YET VERIFIED. Earlier 210 tests passed on host at 8987523.
- Important production LIMITATION: this is internal `APPROVED_FOR_ISSUE` state only; no supplier PO dispatch or money movement. Approval evidence is caller-supplied and not independently verified in this route. Production deployment remains BLOCKED until evidence provenance and authentic operator permissions are verified; do not configure an external webhook with the privileged token.
- Live Supplier Master not mutated by this code; current production route deployment not independently confirmed.

## Procurement authority boundary hardening — 2026-10-11

- Separate procurement token no longer substitutes for a documented business approval.
- `runtime/app.js` requires server-side `procurementAuthorityVerifier` attestation bound to the exact poId, sourceEventId and evidenceRef, with an independently identified `authorized_actor_id` before P3 writer execution.
- Default verifier fails closed (`APPROVAL_AUTHORITY_NOT_VERIFIED`), so no live procurement approval is unlocked accidentally by configuring just the token.
- HTTP tests updated to inject trusted fake attestation for positive path; added rejection of absent/mismatched attestation. Newly changed tests not yet run; previous host baseline 223/223 PASS at 74ef5b0.
- Next: attach verifier to a genuine persisted, explicitly approved MGOS authority/evidence record and verify live readback; then hosted full test and controlled release. Treat as production PENDING, not globally blocking MAGOS development.

## Operator command-center slice — 2026-10-11

- `processor/operator-snapshot.js`: unified, read-only projection from canonical CRM Intake_Queue, Jobs_Opportunities, commercial Quotes and Procurement, and Audit Sync_Exceptions. No shadow database or business mutations.
- `GET /v1/operator/snapshot` is runtime-token authenticated and reads existing TransactionWriter stores; JSON counts and actionable exceptions, purchasing reviews, quote follow-ups and job actions.
- `tests/operator-snapshot.test.js`: four new tests for aggregation, read-only boundary, missing authority and HTTP authentication. COMMITTED; HOSTED TESTS PENDING.
- This is a backend command-center API, NOT a completed user-facing operator interface. The live deployment is NOT verified.
- Next integration: real authorization-backed command center, client-to-job operations, and tested hosted deployment; preserve scoped controls and avoid new sources of truth.

## Usable operator web interface — 2026-10-11

- `runtime/operator-page.js` provides a responsive browser-accessible command centre at `GET /operator` showing five KPI counts and an actionable live work queue.
- It calls the existing authenticated `GET /v1/operator/snapshot`; credential is kept in browser memory only and cleared on demand, no localStorage/sessionStorage, no external JS/CDN. No business data embedded in public HTML shell.
- `runtime/app.js` serves `/operator` with no-store and restrictive browser CSP; original API remains bearer-authenticated.
- `tests/operator-page.test.js` checks shell, no server-side privileged data read, CSP and secret absence.
- CODE COMMITTED; HOSTED VERIFICATION AND RESTART NOT YET VERIFIED. Actual dashboard counts and source tab mapping need real-host acceptance before production PASS; no claims about actual live workload.
- Development next: connect individual business action execution (lead→quote→job) behind scoped governance and build financial/procurement operator screens without shadow sources.

## Operator record drill-down — 2026-10-11

- Added read-only, canonical per-record workstream queues to the existing `operator-snapshot.js` projection for leads, quotes, jobs, procurement and exceptions. Relevant exact opportunity/job/supplier IDs remain linked in returned records.
- Browser `/operator` now offers workstream buttons and selectable record details, enabling actual navigation of an individual item instead of only aggregate counts.
- Added two regression tests. Branch implementation committed; newest tests and actual hosted dashboard remain TO_CONFIRM until full-host run and live API acceptance. This is record inspection, not yet quote/job write operations.

## Canonical accepted quote → job transaction planning — 2026-10-11

- Added `processor/accepted-quote-job-plan.js` tying canonical commercial Quotes, CRM Jobs_Opportunities and Job Execution to the existing P3 `createJobFromAcceptedScope` recipe. The planner verifies exact opportunity linkage, accepted status, line-control state, clearance input, absence of an existing execution row and produces one two-write plan; it does not execute a job automatically.
- Added `tests/accepted-quote-job-plan.test.js`: positive path, unaccepted quote, proof-not-cleared and duplicate job. These tests are committed but not hosted-verified.
- SECURITY/PRODUCTION REMAINS PENDING: caller-supplied acceptanceEvidence and paymentClearance are NOT independently attested in the new planner; never expose this plan for execution without canonical source verification and approval. Not yet a production job-creation endpoint.
- Next meaningful release: attach authoritative acceptance/payment evidence resolver, confirm schema/ownership for CRM and Job Execution, then governed writer execution from authenticated operator action with verified audit readback.

## Governed quote-to-job execution — 2026-10-11

- `accepted-job-execution.js` now composes canonical accepted-scope job plan into the P3 writer behind an independently supplied server-side authority verifier. Default authority is fail-closed.
- `POST /v1/governance/create-job` uses a dedicated `MAGOS_JOB_CREATION_TOKEN`, rejects caller payment/acceptance assertions and blocks generic CRM job_id writes by runtime token; returns review rather than writing on missing proof.
- `tests/accepted-job-execution.test.js` covers writer execution with trusted server-attested state, rejection, proof-only, dry-run and authenticated HTTP. Tests committed but hosting verification PENDING; real acceptance/payment verification service not yet connected.
- This is functioning guarded route code, NOT a verified production workflow. Production writes must not be enabled with a stub verifier. Current full suite most recently 225/225 PASS prior to subsequent changes.

## Integrated operator quote-to-job inspection batch — 2026-10-11

- Added canonical `job-release-inspection.js` read-only quote/opportunity lookup, explicit signed-acceptance and cleared-funds or approved-terms evidence requirements, and pre-existing job rejection. The API intentionally never asserts financial clearance.
- New authenticated `GET /v1/operator/job-readiness/:quoteId` endpoint; operator UI now allows direct per-quote readiness inspection from the browser, without exposing mutation privileges.
- Added `tests/job-release-inspection.test.js` with canonical inspection, safety-negative cases, and HTTP authorization. New code/tests COMMITTED, HOSTED VERIFICATION PENDING. Full production rollout must include current operator interface and previous job/procurement security changes in ONE suite and deployment acceptance run.
- Honest release scope: actionable read-only quote inspections are developed; true approved job mutation still depends on independently sourced acceptance and payment evidence. No live customer records changed.

## Hosted deployment verification — 2026-10-11

- Operator-provided cPanel output: repository `ff4c0f6` hosted Node 20 test command resulted 245 tests, 245 PASS, 0 FAIL (about 32.6 seconds). This is automated code verification, not live transactional proof.
- Live checks initially showed `/healthz` HTTP 200, `/readyz` HTTP 200, `/operator` HTTP 404, despite local `/operator` HTTP 200. Two old lsnode processes predated latest code.
- After controlled hosting application process restart, user reported `/healthz`, `/readyz`, `/operator` all HTTP 200. ROUTE DEPLOYMENT PASS; operator API with canonical credentials, authoritative record read, signed acceptance, P3 production writes and audit readback still NOT VERIFIED.
- No more repeated restart requests are needed. Keep developing integrated customer-to-job lifecycle; one consolidated hosted suite for next release batch.

## Operator live-schema alignment batch — 2026-10-11

- Checked actual authoritative headers of `Intake_Queue`, `Quotes`, `Procurement`, and `Sync_Exceptions` using the native spreadsheet connection. Updated operator projection: `processing_status`, `matched_crm_id`, `matched_opportunity_id`, `routing_action`, `action_required`; accepted canonical procurement technical state `PASS` or `PASSED`.
- Surfaced accepted quotations without an attached job inside the existing quotation workstream, preserving pending-quotation KPI separately. This allows the already-deployed Inspect Job Readiness UI to inspect accepted quotes rather than hiding them.
- Added live-schema regression cases and accepted-quote visibility test. Commit branch updated, NOT YET tested or deployed to cPanel. Next release cycle to run consolidated test suite and restart once; no production job writes.

## Quote-to-job duplicate guard — 2026-10-11

- Extended accepted quote P3 planning to detect an existing `Job Execution` row for the same `opportunity_id` or `quote_id`, not only the requested new Job ID. Blocks alternate-ID duplication before writer execution; no client records changed.
- New regression test for duplicate execution under a different job ID. Committed to GitHub; consolidated hosted verification and deployment of this batch PENDING.

## P3 quote-to-job concurrent execution safeguards — 2026-10-11

- Planner now fails closed if authoritative `Job Execution` index cannot be read, instead of silently permitting a potentially duplicated job.
- Adds a P3 transaction precondition requiring the live CRM `Jobs_Opportunities.job_id` to remain empty at commit time. Intended to refuse races after readiness inspection and before transactional execution.
- Added regression tests for missing execution index and CRM precondition. Changes committed, next full hosted verification and live deployment are deliberately consolidated with the upcoming batch. No live records changed.

## Governing release blocker fixed — 2026-10-11

- Verified the canonical `Cross_System_Links` register: `LNK-009` is ACTIVE, points to commercial `Job Execution`. The prior accepted-job plan incorrectly used `opportunity_id` as `link_id`, which P3 authority validation would reject. Fixed planner to use `LNK-009`; regression test added.
- Also committed earlier in this development batch: refuse unavailable execution index and add live CRM job_id-empty precondition. All unverified changes remain pending the NEXT ONE consolidated hosted verification, not represented as deployed.
- **Business workflow is still not production released**: the jobAuthorityVerifier defaults to fail-closed and requires an independently authenticated signed-acceptance/payment attestation. No production job write was attempted.

## Canonical deposit-evidence operator deliverable — 2026-10-11

- Added read-only `processor/deposit-evidence-inspection.js`, using canonical Commercial `Payment Control` deposit requirements and `Payment_Allocations` with `allocation_state=CLEARED`, matching control IDs, deposit allocation type, and bank evidence links; payment proof alone cannot clear an obligation. No financial mutations.
- Added authenticated `GET /v1/operator/deposit-evidence/:opportunityId`, displayed alongside the quote-to-job readiness view in `runtime/operator-page.js`; isolated tests for cleared, proof-only, inadequate/invalid allocation, and HTTP authorization.
- Live canonical sheet headers were inspected for both `Payment Control` and `Payment_Allocations`. This is **read-only evidence visibility**, not a trusted job-creation authority verifier. Signed acceptance and approval remains separately required. Branch commits remain pending one consolidated hosted suite and release deployment. No customer records changed.

## Integrated release verification contract — 2026-10-11

- Added `runtime/release-acceptance.js`, exposed as `npm run verify:release`. One run executes the full hosted Node test suite, public `/healthz`, `/readyz`, `/operator` availability and authenticated authoritative operator snapshot schema/read, and writes `tmp/magos-release-acceptance.json` with commit/checks/verdict. No production transaction is performed and no credentials are printed.
- A missing runtime credential or failed live canonical read produces BLOCKED/FAIL, **not PASS**. This gate verifies code + read-only live integration; financial and job-creation transaction acceptance MUST be added and evidenced separately before describing them as operational. A full-suite PASS is not an end-to-end job PASS.
- This code is COMMITTED ONLY. Run one consolidated release check after the next integrated development batch and deploy; do not run it separately after each change.

## Job activation evidence-to-P3 integration — 2026-10-11

- Added `signed-acceptance-verification.js`: a trusted server-side evidence verifier must attest exact quote/opportunity, immutable signed artifact, signer, time and source event; a user-entered confirmation or accepted quote field alone cannot pass.
- `job-activation-assessment.js` combines signed provider acceptance with canonical cleared deposit evidence; operator assessment displays both dimensions. Incomplete evidence remains REVIEW_REQUIRED.
- Added `canonical-job-authority.js` to reuse the same source-verified signed event and canonical `Payment_Allocations` deposit evidence at governed P3 execution. Job endpoint now uses this resolver by default when no explicit test verifier is supplied; absent production provider verifier fails closed. Tests added for exact source events, missing provider and integrated readiness.
- DELIVERY VERDICT: code committed; hosted consolidated verification and live provider integration PENDING. This is **not** signed-document verification from a real provider until an independent acceptance verifier is configured. No live job mutated.

## Active build verification hardening — 2026-10-11

- Corrected `runtime/release-acceptance.js` test enumeration: Node child process does not shell-expand `tests/*.test.js` with `spawnSync`. Script now supplies the actual discovered `.test.js` paths.
- Consolidated release report now explicitly marks signed-acceptance activation and authorized P3 job transaction/audit readback as BLOCKED unless actually evidenced, preventing a misleading overall PASS on HTTP and unit tests alone. No production writes in the acceptance script.
- Inspected LIVE `Writer_Schema_Registry`: `Jobs_Opportunities` registered under workbook_role `CRM`, **not `CRM_MASTER`**. Corrected accepted quote P3 job plan and added regression test. An actual authoritative write would otherwise fail schema validation.
- All changes committed to branch; next hosted consolidated run and deployment pending. No client data mutated.

## Inbound Lead Queue Isolation — 2026-10-11

- Operator dashboard lead projection now explicitly excludes scraper/outbound prospect records, RFQ, supplier and other non-lead intake. Inbound channels qualify through named source types and supported inbound systems. This changes the read-only dashboard projection only; it does not mutate or relocate the scraper, `today_outreach`, or operational records, and does not alter CRM source-of-truth ownership.
- Added regression test for scraper, outbound, supplier RFQ, website form and Amelia booking. Existing snapshot fixture data updated with canonical source fields. The resulting source filters require full batch verification on hosting before production PASS.
- Remains open: trusted provider acceptance-source adapter, controlled P3 job activation and audit readback. Code repository ahead of latest deployed/verified branch.

## Integrated release candidate — 2026-10-11 (latest)

- Release gate now reports separate `platform_verdict` and `business_verdict`; an unverified real-job transaction remains BLOCKED even if runtime and tests pass.
- `accepted-job-execution.js` now requires independent post-P3 CRM `Jobs_Opportunities` and Commercial `Job Execution` readback before reporting COMMITTED. A committed writer with missing/mismatched canonical records returns COMMIT_READBACK_UNVERIFIED. New `job-commit-readback.js` and tests; accepted-job mocked writer fixture now actually updates both linked rows for readback assertions.
- Operator active jobs counts only rows with a real `job_id` and an unfinished status, not all opportunities. This complements prior scraper/inbound lead separation and is covered by regression tests.
- Development changes COMMITTED, not hosted-deployed or consolidated-test VERIFIED. Production signature provider is not connected, and no genuine job creation/audit completion claim is made. Avoid reusing old 245/245 baseline for this new revision.
