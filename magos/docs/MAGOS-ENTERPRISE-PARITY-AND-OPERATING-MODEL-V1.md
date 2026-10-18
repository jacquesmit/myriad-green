# MAGOS Enterprise Architecture & Synchronisation Control V1
Date: 2026-10-18
Status: DEVELOPMENT SPECIFICATION — NOT PRODUCTION SYNC PROOF
Authority: this document is a navigation, mapping and execution contract; NOT a database, new audit register, task queue, or permission grant.

## One integrated architecture
Corporate governance and risk -> MGOS canonical policy, Systems inventory and Data_Ownership_Matrix -> MAGOS governed event processor / writer / agent dispatch -> owning CRM, Commercial, Supplier, WordPress, Amelia/Calendar and SEO provider systems -> read-only MGOS Control Hub -> Audit_Tests, Sync_Exceptions and release/recovery evidence.
All changes to business facts occur in their current authoritative systems and approved write paths. No additional CRM, finance, supplier, job, order, or audit system is created.

## Canonical locations / reuse
Systems and registered dependencies: Global Audit SYS-001.. and Systems tab.
Business ownership: Global Audit Data_Ownership_Matrix.
Cross-system links: Global Audit Cross_System_Links.
Contradictions: Contradiction_Rules and Sync_Exceptions.
Transitions: State_Control_Register; State_Transition_Log; note separate event-state logic in Git magos/processor/event-observer.js.
Integration: Git magos/processor/processor-registry.js, governed-event-runner.js, writer/transaction-writer.js.
Tasks and agents: MAGOS Agent Job Allocation Matrix V1, Agent Registry, Job Types, Allocation Matrix, Live Queue.
Operating dashboard: existing MGOS Control Hub SYS-012 (read-only).
Evidence: Gmail/Drive immutable source records and canonical folders.
Website and commerce: WordPress, Fluent Forms, WooCommerce; do not mistake draft scaffolding for proven checkout.
Scheduling: Amelia authoritative for Amelia-origin bookings; Google Calendar authoritative only for its own appointments.
Every registered workflow must map to canonical business_record_id, source event ID, tenant/branch, job_type_id, primary owner, immutable idempotency key, approval gate, state authority, evidence URI, audit receipt, and downstream read-back.

## Enterprise capability mapping (map to existing SYS IDs, never blindly create systems)
1 Governance and board controls -> Audit/Governance, AG-001/030.
2 Strategy, executive and capital allocation -> existing management reporting; extension pending.
3 Accounting, finance and treasury -> Commercial SYS-002, AG-010; general ledger/tax/treasury coverage TO_CONFIRM.
4 CRM, quoting, contracts -> SYS-001/SYS-002, AG-003/005/011.
5 Marketing, local presence, SEO -> SYS-004/SYS-018/019, AG-020/027.
6 Field service and quality -> Commercial Job Execution and CRM jobs, AG-007/008/009/013.
7 Procurement and supplier management -> SYS-003/Commercial, AG-006/029.
8 People, recruitment, payroll and workforce -> identify canonical owner; broad automation NOT_VALIDATED.
9 Fleet, facilities, tools and asset lifecycle -> SYS-020 and source ledgers.
10 Customer support, aftercare and warranties -> CRM and installed asset records, AG-031.
11 Technology and IT service management -> SYS-011/Git/hosting, AG-012/030.
12 AI agents and process orchestration -> agent allocation workbook + existing MAGOS runtime, AG-001/012; dispatch NOT ACTIVE.
13 Legal/compliance/privacy/security -> governance and Access_Control; controls require jurisdiction mapping.
14 Health/safety and quality management -> operations/QA; enterprise scope to map.
15 BI and intelligence -> Control Hub derived views; freshness blocked where watermarks absent.
16 Corporate development and multi-branch -> prospective capability; not production deployed.

## Single parity gate (NO PASS without receipts)
Per link, require source system/current authoritative row ID, source timestamp/watermark, canonical owner, target read-only projection, last delivered event ID, last successful reconciliation, row-level evidence, duplicate count, mismatch count, age/SLA, verified failure/exception owner and remediation receipt.
PASS only when all mandatory critical paths reconcile and replay has zero duplicate business writes. PARTIAL when a subset passes. BLOCKED if critical owner, timestamps, access or proof absent. UNKNOWN when not checked.
Never treat successful HTTP health checks, enabled tasks, document filenames, Git tests, or draft playbooks as full parity.

## Daily corporate control loop
Every morning: source freshness, overnight event backlog, failed jobs, bank clearance controls, unsent quotes, booked crew/procurement readiness, overdue actions, customer follow-ups, broken forms, website availability.
Throughout day: one canonical event -> validate -> dedupe -> map ownership -> enforce scope/permissions/business gate -> commit only through sanctioned writer -> read back -> immutable audit/exception -> next authorised action.
Every week: reconcile unclosed exceptions, profitable jobs and margins, supplier currency, fleet/tool readiness, employee safety/capacity, review/SEO performance, access and backup status.
Every month: financial close, tax obligations and cash forecast, corporate KPIs, compliance, audit exceptions, restore drill, architecture drift, versioned roadmap.
Every software change: inventory impact -> staged branch -> tests/negative tests -> independent QA -> authorised release -> rollback plan -> live proof -> document outcome.

## Initial blockers (observed)
- Source_Freshness_Register has BLOCKED_NO_SEMANTIC_WATERMARK for CRM/Commercial/Supplier at 2026-09-08 readback.
- Phase_Status Cross-System Integration PARTIAL and final service/product golden tests NOT_RUN.
- MAGOS agent Live Queue contains EXAMPLE-001 only; no verified production agent task receipts.
- Authority contract draft; machine-readable permissions and task routing not runtime-enforced.
- Restore Test entries in Backup_Recovery NOT_RUN.
- 2026-10-04 cross-contamination audit highlights CRM raw scraper vs operational data, forms inventory overlap, WooCommerce modules, booking source identity and procurement boundaries.
- Existing system inventory contains 44 registered SYS entries per historical audit; current exact inventory needs reconciliation, not blind new system creation.

## Release sequence / accountable agent
P0: AG-013 and AG-001 reconcile inventory/ownership/source freshness, exception severity, duplicate writers. Human owner signs off critical repair.
P1: AG-012 implements code-level provenance, scoped permissions, dispatch and canonical event->task linking on development branch with tests; AG-013 independently audits.
P2: AG-003/005/010/006/007/008/009 prove one real service golden transaction through closure, without inventing data.
P3: AG-023/024/029 prove one product commerce transaction and calculator estimated-to-approval journey.
P4: AG-030 executes backup restore test and scoped release/rollback; AG-001 establishes daily/weekly/monthly management loop.
P5: corporate people, governance, risk, capital and multi-branch capabilities added by gap-ranked business value.

## Guardrails
No production writes or claims of activated synchronisation from this document. No parallel authority ledgers. Do not merge development branches or turn on purchasing, publishing, payroll, finance clearance or irreversible agents without authorisation and evidence.

## Sources
Global Audit: https://docs.google.com/spreadsheets/d/1Y4iP2mVCIph8MrIL51mo-KpzgUkZbWW7ZUIlkH8lOTw/edit
Control Hub: https://docs.google.com/spreadsheets/d/1lxFrUEGeEojkxbpQiVfj1AxuB5C1ayaTzAT8rkaTObo/edit
Agent Matrix: https://docs.google.com/spreadsheets/d/1FKj-iudwat5bbFIrplgg237-ABPRq3ijQulf-LbSuBs/edit
Duplication audit: https://docs.google.com/document/d/1ruDSq_rqNDJ9kPD3KPOS8amo1bpfXg7TjfTSjQ15mJ4/edit
Repository: https://github.com/jacquesmit/myriad-green/tree/main/magos
