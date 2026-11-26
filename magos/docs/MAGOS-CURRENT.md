# MAGOS — Current Engineering State

> **Authoritative current index.** Read this file **first**, then [MAGOS-STATUS.md](MAGOS-STATUS.md) for append-only engineering history, the relevant subsystem runbook, source code, CI, and live sources. Previous decisions stay discoverable. A historic claim never overrides newer verified source evidence. Never claim deployment or customer transaction acceptance from a GitHub merge.

**As-of:** 2026-11-26 (Africa/Johannesburg); authoritative snapshot immediately below.
**System:** MAGOS — the existing whole-business Myriad Green operating system, not a new product or collection of renamed agents.  
**Repository:** [jacquesmit/myriad-green](https://github.com/jacquesmit/myriad-green)  
**Production:** `https://runtime.myriadgreen.co.za` — tested release `b5e73575e092ef6abf39842e3ffb9ff44a45084e` DEPLOYED; 647/647 tests and 13/13 read-only preflight PASS.




## CURRENT ENGINEERING PARITY — 26 November 2026 (SAST)

**GitHub integrated baseline:** `21031d4c0db6411da80e2f63bdbc7ce6c8b2aecd`. **Last accepted production:** `b5e73575e092ef6abf39842e3ffb9ff44a45084e` (owner-reported 647/647 host tests and 13/13 preflight). Newer application changes are not verified deployed. Owner reported successful operator login and live data on 26 November; exact running SHA not independently read this session. Whole-business acceptance remains PARTIAL.

| Package | Integrated evidence | Outstanding |
| --- | --- | --- |
| CI hardening | PR #109, merge d502ead9070e4f34b6d0692131e800a3e57a542d; four CI workflows PASS | Branch protection, dependency lockfile, security scanning |
| CI modernization and TAP evidence | PR #112, merge b875d40419180d26c5da232f1580b40bc4780442; six CI workflows PASS; artifact 15104589315 metadata verified; #110 closed | Artifact contents not independently downloaded; git annotation cause unverified |
| CORE-003 synthetic lead integration | PR #113, merge 373b22ccaea84fcb4e0c92245f4fe491e9a842ca; four CI workflows PASS | Controlled live canonical write/readback/replay; not a business PASS |
| Operator refresh and deployment request guards | PR #114, merge 21031d4c0db6411da80e2f63bdbc7ce6c8b2aecd; three CI workflows PASS | Browser interaction and production readback |
| OAuth and consolidated inventories | PR #108 integrated; source implementation exists | Live OAuth configuration, authenticated acceptance and deployment |
 
**Resume:** controlled release of integrated runtime after exact candidate host tests and rollback preparation; CORE-003 and quotation/payment/job lifecycle acceptance; frontend usability in parallel. Do not interpret earlier candidate entries as unresolved merges. No production or commercial record mutation during this documentation reconciliation. Drive capability states must not be promoted on synthetic evidence alone. Full subsystem-document and Drive parity remains to be checked; this receipt reconciles the current engineering index and directly affected dashboard/lead/writer documents.

## 26 November 2026 — engineering CI hardening candidate
Existing Runtime P2 CI now triggers for all magos/** and MAGOS workflow changes and runs the complete sequential `npm run test:hostafrica` suite rather than a hand-maintained list. Existing entrypoint, container and release checks retained. Transaction writer CI aligned to documented Host Africa Node 20. Changes are candidate-only until exact-head CI passes and merge is verified; no host deployment or business acceptance implied. Dependency lockfile, protected branch enforcement, security scanning, isolated staging and CORE-003 golden-path execution remain outstanding. Preserve the last accepted production receipt and existing status authority.

## CURRENT AUTHORITATIVE HANDOFF — 25 November 2026 (SAST)

**DEPLOYED_AND_READ_ONLY_PREFLIGHT_PASS. BUSINESS_GOLDEN_PATH=NOT_YET_VERIFIED.** This section supersedes every earlier runtime/hosting/dashboard-deployment blocker or pending statement in this file and historical documents. Do not repeat passed checks or treat a historical incident as an active blocker. Revalidate only when new evidence, changed code/configuration, or a genuine regression requires it.

- Production release: [PR #104](https://github.com/jacquesmit/myriad-green/pull/104), exact tested/deployed SHA `b5e73575e092ef6abf39842e3ffb9ff44a45084e`. Owner supplied cPanel Terminal evidence: **647/647 sequential regression tests PASS**, zero failures/cancellations/skips/todos; **13/13 live read-only preflight checks PASS**, ready:true. Checkout SHA, tracked cleanliness, health, readiness, running worker SHA, Sheets audit, workflow inspection, canonical coverage, browser shell/assets, operator identity, auth isolation and 129 core records validated. This is release/read readiness, not full business write acceptance. Subsequent documentation-only commits do not require redeployment.
- Resolved host issues: PR #103 restored six procurement regression tests and sequential HOSTAFRICA test script; initial candidate 646/646 tests but live preflight 10/13, safely rolled back. PR #104 fixed legacy worker Git incompatibility (child-process cwd instead of git -C). Control Hub service account Viewer access restored; canonical coverage 22/22 readable. Corrected release passed all 13 checks. Do not request fresh credentials, reinstall the app, contact hosting support or redeploy merely because old notes say BLOCKED.
- Water Alert Publisher v0.1.0 installed/active, dedicated isolated auth configured privately on both systems. Planner READY_TO_PUBLISH, no side effects. Runtime publish route and WordPress status authentication PASS. Production post 10622 created, owner viewed public article, canonical and public readback PASS. Initially REVIEW_REQUIRED / WP_ALERT_SITEMAP_NOT_CONFIRMED; index/follow, canonical, BlogPosting and social metadata verified. Rank Math links per sitemap changed 199 to 201 (owner reported issue with 200), saved and LiteSpeed purged; exact URL subsequently present. Exact replay returned DUPLICATE_NO_OP, same ID and fingerprint, verified:true, public_readback:true, sitemap_verified:true, faq_schema_verified:true. No new duplicate. Domain validation is not independent factual source verification. [Article](https://myriadgreen.co.za/journal/tshwane-water-supply-update-24-november-2026/); [evidence register](MAGOS-WORDPRESS-PLUGIN-DEPLOYMENT-REGISTER.md).
- Dashboard: existing [operator page](https://runtime.myriadgreen.co.za/operator) is hosted by the same runtime; release preflight verified shell/assets, operator deployment identity, auth isolation, canonical coverage and 129 core records. Do not describe dashboard as undeployed. Per-record UX, new growth/publishing panel, persistent run history and end-to-end business actions not accepted merely by read preflight. See [dashboard requirements](MAGOS-OPERATOR-DASHBOARD.md).
- Last measured whole-business capability map: 22 total, 0 fully PASS, 18 PARTIAL, 4 FAIL; site_complete:false, production_business_acceptance_verified:false. This snapshot predates final publishing replay; do not treat 18/22 as percent complete or invent a new count. Reconcile capability-specific gates against the tested release. Runtime release acceptance 100% (13/13); business acceptance remains PARTIAL.
- Handover duplicated in Control Hub Core_Build_Queue L13 (CORE-012 cell note). Existing parent status unchanged.

**P0 owner-approved usability gate:** conventional dashboard sign-in, secure sessions, MFA and role-based access. No cPanel/token entry for daily human access. See [dashboard authentication requirements](MAGOS-OPERATOR-DASHBOARD.md). DOCUMENTED, implementation and live acceptance pending.



## Integration naming convention — owner direction, 25 November 2026
Use distinct functional names in all future builds, deployment records and integration registers. Google Cloud project: **Myriad Green MAGOS** (existing); Google Auth Platform branding: **MAGOS Operator Access** (chosen name, configuration in progress); OAuth web client: **MAGOS Operator Web Client** (reserved name, creation not yet verified); frontend: **MAGOS Command Centre** (existing); backend: **MAGOS Runtime** (existing); future restricted WordPress integration: **MAGOS WPVibe Bridge** (planned, not built). Maintain these mappings in the existing integration/deployment documentation, not duplicate projects or credentials. Record actual creation, activation and verification separately; never store secrets in Git or registers. Use these exact names when resuming configuration or starting the bridge. Owner approval of naming is not proof of live OAuth activation.



## Authentication and integration naming register — owner-approved 25 November 2026
Use functional names consistently; do not create duplicate Google projects, clients, dashboards or integrations solely because names differ. Existing Google Cloud project display name: **Myriad Green MAGOS** (owner screenshot verified). Google Auth Platform branding name: **MAGOS Operator Access** (selected naming, creation not yet confirmed). OAuth web application client name: **MAGOS Operator Web Client** (planned, not yet created/verified). Existing frontend: **MAGOS Command Centre**, https://runtime.myriadgreen.co.za/operator. Existing backend: **MAGOS Runtime**, https://runtime.myriadgreen.co.za. Future restricted WordPress integration: **MAGOS WPVibe Bridge** (planned, not implemented). OAuth setup in progress on existing Google Cloud project; support email selected irrigationsa@gmail.com; owner account allowlist and OAuth client configuration still require confirmation. PR #105 candidate latest tested head 80ae47f8788cae0a07ccd6e95bca591c7c291339 passed all three CI workflows; not deployed. Record actual client identifier, configuration status, scopes, callback URL and acceptance evidence when created; never store client secrets, session signing keys or tokens in documentation. Resume Google Auth Platform branding at App name, then Audience; do not recreate the existing Cloud project.



## 26 November 2026 — active execution checkpoint and remaining effort
Owner returned to Water Alert Publisher work; dashboard login PR #105 paused separately (tested candidate; OAuth configuration and production activation incomplete). Water publisher PR #106 open draft, candidate head a624328094afdfa2eafcfb1db90b4d41c2b708fc: exact URL matching and paginated Rank Math sitemap discovery implemented with regression tests; CI/merge/deploy not yet confirmed. Existing pilot publication, canonical/public readback, sitemap inclusion, FAQ and duplicate replay remain passed; do not repeat without regression. Independent factual source corroboration was reported in chat but supporting retrieved source evidence is not present in this record; treat as TO_CONFIRM before claiming factual acceptance. Automated source-content verification remains outstanding.
Remaining engineering effort estimates (planning assumptions, not measured completion or delivery promises): targeted sitemap/cache invalidation 30–60 min; automated official-source verification 60–90 min; same-source update acceptance 30–45 min; secure connection of existing scheduled automation 45–90 min; production release and acceptance 45–90 min; documentation 15–30 min. Aggregate approximately 4–7 hours (rounded; integration uncertainty may increase effort). Separate workstreams: dashboard automation monitoring 2–4 hours; Google login activation 30–60 min assuming prerequisites pass; journal frontend and customer-facing article improvements 2–4 hours. Highest priority is unattended water publishing; preserve existing schedule, no duplicate automation or repeated pilot tests. Record exact CI and production receipts before closing gates. These are estimates, not guarantees or scheduled background work.



## 26 November 2026 — Drive reconciliation checkpoint
Existing Control Hub https://docs.google.com/spreadsheets/d/1lxFrUEGeEojkxbpQiVfj1AxuB5C1ayaTzAT8rkaTObo/edit is retained, not replaced. Scope inventory read: 44 system records (including planned/legacy), 22 capabilities, 18 lifecycle gates, 12 core packages. Drive baseline 18 PARTIAL/4 FAIL remains historical formal business acceptance; no new overall percentage. CORE-002 updated VALIDATED on documented 647/647 and 13/13 deployed runtime receipt; CORE-003 moved BLOCKED→PARTIAL because hosting dependency resolved but controlled canonical business write/read-back/replay not evidenced. CORE-004–009 and CORE-011 moved DOCUMENTED→PARTIAL on existing implementation evidence, not production acceptance. CORE-010 recurrence and CORE-012 broad migration retained; CORE-012 note updated for Water Alert and login candidates, both exact-head 3/3 CI PASS, not deployed. CAP-021 gap/next action/evidence corrected; status PARTIAL retained. Historical progress percentages annotated, not replaced. Automation_Directory I5 #REF! traced to derived source AG2 #REF!; upstream source/import repair pending, do not overwrite formula or provider status. Restore full scope: qualification/BOQ, variations, actual field inputs, costing, labour, recurring service/review triggers, supplier scorecards, fleet/tools, accounting/tax, 00A, Gmail/WhatsApp, Amelia, social source/generate/publish/metrics, service calculator, EskomSePush, backup/restore and continuity. Database migration remains deferred. Next verify canonical event golden path CORE-003 then GATE-001..018; continue owner-approved water publisher separately without duplicate adapters. This is initial register reconciliation, not full per-system code/test/live audit; remaining 44-system mapping and dashboard readback pending. No production runtime changes.



## 26 November 2026 — low-human-input execution tranche
Owner approved minimum operational baseline across all systems: read-only/draft tasks first; controlled mutations only after original authority and acceptance gates; owner intervention limited to genuine approvals/credentials/hosting. Do not block independent packages on unrelated dependencies. Reuse existing schedules, canonical registers and modules. Global Audit Automation_Register S2 spill #REF! was caused by explicit S24:S36 states; bounded original derived formula to S2:S23, preserving all 13 explicit states, readback S2:S36 35 valid labels. Control Hub Automation_Directory O1 import extended A1:S19→A1:S36; eight derived anchors A5/B5/H5/I5/K5/L5/M5/N5 extended to row 36 source; readback A5:I39 all 35 IDs/statuses, no #REF!. Manual implementation metadata columns retained; future register additions require range expansion or tested dynamic import. Provider labels still historical, not live acceptance; daily intake provider is enabled while historical register calls same ID disabled. Existing weekly MAGOS Runtime Status (Sunday 19:00 SAST) updated in place to review 44 systems/22 capabilities/18 gates/12 packages, automation registry parity, source freshness, CI/deploy, independent read-only/draft tasks and grouped owner decisions. Schedule unchanged, no additional task. First run of revised prompt pending. Control Hub dashboard readback 26 Nov showed 3 quotes awaiting decision, R46,360 recorded outstanding, 93 open sync exceptions, WhatsApp transport BLOCKED_EXTERNAL, 1 blocked booking sync; these are displayed source totals, not bank-verified or fresh reconciliation of individual items. Read-only sample Client_Actions/Finance_Queue/Procurement_Queue/Job_Queue available; oldest entries require freshness verification, not blind collection or booking. Next: reconcile stale provider states and missing newer schedules in authoritative registry; use existing daily intake and conversion review for operational triage; fix dashboard source coverage and verify live operator output; continue water PR #106 and CORE-003 independently. No production code or commercial records changed. Native visual inspection and exhaustive cross-system audit pending.



## 26 November 2026 — consolidated release candidate
Combined PR #105 (owner OAuth/session controls), #106 (bounded sitemap verification), and #107 (whole-system dashboard inventories) from exact previously tested heads 80ae47f8788cae0a07ccd6e95bca591c7c291339, a624328094afdfa2eafcfb1db90b4d41c2b708fc, b60f1e48c926ae1b076b9bef73dab7eef5eb0911. Non-overlapping code copied only after base blob equality; operator.js combined navigation with authorized() session/token checks. Preserve existing main documentation. Individual CI receipts do not certify integrated release. Pending integrated exact-head CI, deployment, OAuth configuration and authenticated UI readback. Water source factual corroboration remains TO_CONFIRM; no claim of independent corroboration, no unattended publication activation. Targeted cache invalidation and genuine same-source update remain pending. Dashboard reads register labels, not live business acceptance. Existing deployed release unchanged; CORE-003 controlled canonical business write/readback/replay remains next core acceptance. No duplicate scheduler, no new authority or credentials.



## 26 November 2026 — consolidated release merged
PR #108 exact head `7f6c243e5f23c9c26ace3056833454d7f46c6b93` 5/5 CI PASS (Document Extract 45738646233; Evolving Status 45738646279; Transaction Writer 45738646248; Water Publisher 45738646202; Runtime P2 45738646190). GitHub merge `4bcef11a768783a3d96ba7bcdede245ab126c5f1` confirmed. This is a merged candidate, not deployed; last accepted production remains b5e73575. PRs #105–107 retained as historical candidate branches; do not independently merge overlapping implementations again. OAuth activation, source corroboration, targeted cache invalidation, provider scheduling, production UI validation and CORE-003 business acceptance remain pending. Proceed with independent read-only and deterministic business improvements before grouped host deployment.



## 26 November 2026 — owner-approved cross-system optimization mandate
[Shared search, AI discovery, experience and conversion standard](../../SEARCH-AI-DISCOVERY-STANDARD.md) is mandatory for future public website, ecommerce, journal, Water Alert Publisher, MAGOS-generated content and public-tool work. Apply relevant quality and security rules to private systems without exposing private data. Adoption is DOCUMENTED; sitewide audit, automated enforcement and live compliance remain pending. Preserve original screenshot uncertainty, existing governance and production acceptance gates.

### Next execution, in order
1. Finish existing Water Alert Publisher: targeted Rank Math/LiteSpeed sitemap invalidation and bounded retry (no routine global purge); independent official notice content verification; legitimate changed-source update acceptance; securely connect existing scheduled Water Alert Publisher (no duplicate schedule, no secrets in prompts/Git); prove unattended run and safe failure reporting. Exact create/replay tests already PASS.
2. Reconcile existing operator dashboard with verified runtime/capability evidence and expose publishing run outcomes, source links, review exceptions, freshness, next actions; preserve read-only boundary and separate governed action routes. No parallel dashboard or data store. UX/UI and reader-facing journal improvements separate deferred workstreams.
3. Continue existing whole-business golden path: reviewed quote signing, bank/provider clearance, job release, procurement/stock/approved costs, field evidence, invoice/reconciliation, closeout and aftercare. Do not mark untested business workflows complete. Ecommerce payment/shipping/tax remains a separate acceptance track.
4. Reuse detect → verify → decide → execute → read back → record → deduplicate across CRM, approved job evidence/case studies, GBP/SEO, reviews, maintenance, procurement, inventory, finance and ecommerce. These are opportunities, not claims of production implementation. Prefer durable existing canonical sources and executable named workflows over new agent names.
5. On every material change update CURRENT, append STATUS, update affected runbook/register and operational Control Hub evidence. Keep exact tested/deployed SHA distinct from docs-only main HEAD. Other chats must read this current snapshot before acting.

## HISTORICAL — 24 November initial release blocker (RESOLVED by PR #104; not current)
HOSTAFRICA ticket #3957866 (22 Nov) confirmed production HEAD `88576e4595186e73259d5e4f32d2940ac8b4a569` on `codex/magos-production-intake-20261107`, clean tracked files, readable origin/main then `780bd0f3e3ce17ba7a0ed9d34e57e8b01c8b8954`, Node 20.20.2 and two MAGOS workers started after HEAD. This is historical evidence, not today's SHA. Tickets #9342462/#3622207 (11–12 Nov) approved the existing path/account-scoped recycle; do not request support again unless controlled local recovery fails. Reuse PR #65's `magos/scripts/hostafrica-release.sh` and existing preflight; do not create a parallel deployment path. Inspect first; reconcile host-only commits before checkout; pin tested main SHA, verify backup and private environment, recycle only scoped workers, verify loaded SHA and capability-specific endpoint, retain rollback receipt. No blind pull/reset or broad process kill. A new secret requires process reload, not a new app. A P5 health response is not release identity.
24 Nov evidence: WPVibe plugin list exit 0, Water Alert Publisher 0.1.0 active; user confirmed configuration saved on both sides and website loads. Browser health P5 OK, readiness ready/auth_configured true; unauthenticated WP status 401; authenticated WP status returned NOT_FOUND for synthetic key (expected, no write). Authenticated empty POST to runtime /v1/content/water-alert/publish returned Cannot POST; expected 400 WATER_ALERT_NOTICE_REQUIRED from merged source. Runtime endpoint FAIL, actual running SHA and runtime token acceptance unverified; likely checkout lag or stale worker, not proven. No test article or server deployment performed. Do not repeat WP installation or credential setup. Next: existing controlled host release and empty POST smoke test, then real official-source acceptance/replay/update. Support escalation only after exact sanitized failure evidence. No credentials in Git or logs.

## One truth table

| Capability / layer | Implemented | Automated tests | Production validated | Precise state |
| --- | --- | --- | --- | --- |
| MAGOS Node runtime and Command Centre | YES | 647/647 sequential PASS | Exact deployed release and dashboard read preflight PASS | RELEASE PASS; business workflows PARTIAL |
| Canonical CRM/lead intake, quotations, job lifecycle and workflow routing | CODE EXISTS | TESTED paths | Golden end-to-end NOT VERIFIED | PARTIAL |
| Governed P3 writer and audit/ownership controls | YES | TESTED paths | Live new-action readback NOT VERIFIED | PARTIAL |
| WordPress reviewed quote signing / acceptance | GitHub candidate + verifier; quote-line version race preconditions staged for review | Node/PHP CI tested; newest race regression CI PENDING | Live WPVibe checked 2026-11-21: companion `verify-v2` route MISSING, page 9481 DRAFT | FAIL for production |
| Procurement and supplier approval | Governed stages, read-only and protected write paths | TESTED paths | Independent approval/provider acceptance incomplete | PARTIAL |
| Supplier `Cost_Allocations`, invoice/GRN/stock checks and expense controls | Code merged, [#50–#55](https://github.com/jacquesmit/myriad-green/pulls?q=is%3Apr+is%3Amerged) | PASS on reviewed commits | Exact independent invoice/stock authority and live write unverified | PARTIAL |
| Receivables, completion, costs, field evidence and aftercare inspection | Code exists, protected inspections | TESTED paths | Final closeout and bank/provider acceptance incomplete | PARTIAL |
| Water Intelligence / Alert Publisher | Planner + live WordPress publisher | CI + host regression PASS | Post 10622 created; public/sitemap/FAQ and exact replay PASS | PARTIAL: unattended schedule, targeted sitemap refresh, source verification and update pending |
| WooCommerce ecommerce / System Builder | Separate in-progress website work | Partial evidence | Full payment/shipping/tax and product hydraulic acceptance pending | PARTIAL / NOT READY |
| HOSTAFRICA worker identification and release preflight | PR #104 corrected worker Git compatibility | 647/647 PASS | 13/13 preflight PASS on deployed SHA b5e73575 | PASS for release |
| Continuous documentation / status reconciliation | Gate [PR #56](https://github.com/jacquesmit/myriad-green/pull/56) MERGED at `ec1510d526fa44c1b0de97436e19d125b0582beb` | Gate and document CI PASS | Required GitHub branch protection NOT VERIFIED | PASS for workflow; PARTIAL for enforcement |

## Source-of-truth files and order of reading

1. **This file**: current engineering state, scope and highest-leverage next action; must be updated in every MAGOS implementation PR.
2. **[MAGOS-STATUS.md](MAGOS-STATUS.md)**: append-only change history, decisions, release evidence and failed/partial gate outcomes. Do not erase or relabel historic work as deployed.
3. **[CPANEL-PASSENGER-DEPLOY.md](CPANEL-PASSENGER-DEPLOY.md)**: actual known HOSTAFRICA/cPanel configuration, worker identity, rollback and read-only deployment preflight.
4. **[MAGOS-WP-QUOTE-BRIDGE.md](MAGOS-WP-QUOTE-BRIDGE.md)**: WordPress/Node quote signing boundary and live blockers.
5. GitHub commits, exact CI runs, canonical Sheets/CRM/Supplier workbook metadata and the deployed process. Later source evidence outranks earlier prose.

## Change lifecycle — mandatory

For each real MAGOS code change:

1. **Read** both current/historical `.md` files and the source code or sheet/host evidence.
2. **Implement** directly in existing modules; no parallel financial store, agent naming sprawl, or caller-supplied approval booleans.
3. **Test** success, failure, replay and independent authority, including live header contracts where applicable.
4. **Update** this file (current truth) **and** append an entry to `MAGOS-STATUS.md` in the *same branch / PR*. The `MAGOS Evolving Status Gate` workflow will fail code PRs missing either update. Branch protection enforcement must also be verified.
5. **File** through a GitHub PR; merge only on exact-head CI PASS; record actual merge commit in history on follow-up. Deploy and verify **separately**; a merge does not mean deployed.
6. Mark `PRODUCTION_VALIDATED` only after hosted worker SHA, authentic source transactions, writer readback, idempotent replay and rollback acceptance pass.

## Highest-leverage next production actions

1. HOSTAFRICA release verification **DONE** on b5e73575; do not repeat solely because earlier incident records exist. Finish unattended publishing and dashboard evidence reconciliation as described in current handoff.
2. Install and test the new reviewed WordPress signature companion and client page with controlled signed-quote acceptance, exact issued version/PDF and cleared funds before any job creation. **Not done.**
3. Bind real approved invoice and physical stock attestations to supplier-cost workflow; perform one controlled P3 cost write/readback and duplicate replay. **Not done.**
4. Finish golden journeys for intake → CRM → quote → signed acceptance → cleared payment → job → procurement → field evidence → invoice → reconciliation → warranty/aftercare, then web shop purchase-to-fulfilment separately. **Not done.**

**Release rule:** code PASS ≠ production PASS. `UNKNOWN` is never `YES`.

## Historical delivery evidence (older than current handoff)

- **PR #55** [merged](https://github.com/jacquesmit/myriad-green/pull/55) at `365dd70b64b169baac4e292812d393484191fa7b`: supplier job queue independent authorities and one source snapshot; runtime + document CI PASS.
- **PR #56** [merged](https://github.com/jacquesmit/myriad-green/pull/56) at `ec1510d526fa44c1b0de97436e19d125b0582beb`: mandatory Markdown reconciliation gate, this current state file, append-only history. New MAGOS Evolving Status Gate CI run #1 PASS; Document Extract CI PASS.
- **Live WordPress recheck (2026-11-21):** page ID `9481` remains `draft`; namespace `mgos/v1` has legacy `verify` and owner-test link only, NOT `quote-acceptance/verify-v2`. Customer signing flow is **NOT LIVE**.
- **Live HOSTAFRICA check:** `/healthz` and `/readyz` could not be accessed from the read-only public tool. This is **NOT VERIFIED**, not an assertion that the server is down.
- **Merge enforcement:** the gate exists and executed successfully in CI; GitHub required-check branch protection was **not** independently inspected. Never claim changes are non-bypassable before repository settings validate that.

## Quote acceptance version-integrity control — latest candidate

- Candidate branch `codex/magos-quote-version-race-guard-20261121` modifies canonical `acceptReviewedQuote` only; the WordPress public signing page and finance/booking sources remain unchanged.
- WordPress signing receipt must match the **current exact quote version** in existing Commercial `Quote_Lines` after the independent verification call. Duplicate or missing `quote_line_id` blocks authorization.
- P3 transaction receives per-current-line quote version/status preconditions in addition to the `Quotes` state precondition. Post-write readback checks the same current line ID set and version; mismatched revision becomes `COMMIT_READBACK_UNVERIFIED`, **not** successful business acceptance.
- **Important limitation:** Google Sheets does not provide atomic row-set isolation for new line inserts concurrent with an in-progress P3 transaction. These checks narrow the stale-signature window; strict production guarantees still require an immutable issued-quote snapshot / version-control gate and authenticated live replay test. Not complete.
- Test scenarios: valid acceptance, changed version, duplicate line IDs, altered version post-write and inserted current line on the same version. CI and merge status pending.

### Release evidence — quote version race guard

- [PR #57](https://github.com/jacquesmit/myriad-green/pull/57) merged to `main` at `4b63ac60493a986a277114ed6bfb7230517ba728`; MAGOS Runtime P2, Document Extract and Evolving Status Gate **all PASS** on PR head `275d69226ff582c9f670088fcfa08fbc98032af9`.
- New acceptance checks bind each currently issued `Quote_Lines` record to P3 preconditions and check the version/line set again after the write. No WordPress deployment or live signed transaction was performed. **Source-level race narrowing is not proof of atomic version isolation.**

## WordPress reviewed-signature release packaging — candidate

- Added `magos/scripts/package-reviewed-signature-plugin.sh` to package only `magos/wordpress/mgos-reviewed-client-signature.php` under the installable WordPress plugin slug, with a reproducible ZIP and SHA-256 checksum.
- The `MAGOS WordPress Signature Bridge` CI builds, tests and uploads the plugin ZIP plus checksum as a **release artifact**, not a live site installation. Any installation must verify checksum, use approved WordPress admin/hosting access, test on staging, confirm `verify-v2` source and signing-page safety, and retain rollback.
- **Code/CI status: PR candidate.** Live site still has no reviewed companion route and signing page 9481 is draft. Do not claim customer signing enabled or accept customer deposits solely because a ZIP exists.

### Merged release packaging — reviewed client signature bridge

- [PR #58](https://github.com/jacquesmit/myriad-green/pull/58) merged into `main` at `b4af09d03975938ab0c63ee1b850a555b3528a25` after exact-head WordPress Signature Bridge workflow #5 PASS, MAGOS Evolving Status Gate workflow #5 PASS and MAGOS Document Extract #224 PASS (PR head `071f7588426afc850b51f2d9862476acaf09fa53`).
- CI produced the reproducible `magos-reviewed-client-signature.zip` and `.zip.sha256` as GitHub workflow artifacts; archive content and independent checksum tests PASS.
- **No live WordPress plugin was installed.** The production client signing page is still a draft based on last confirmed WPVibe inspection. Customer signature end-to-end acceptance remains BLOCKED until controlled install and production validation.

## Deposit-to-job financial authority — current candidate

- **Source correction in progress:** `deposit-evidence-inspection.js` now requires an exact matching row in `Payment_Events` for each cleared `Payment_Allocations` deposit. Both must agree on payment event ID, control, opportunity, cents, cleared state and Drive evidence. Duplicate payment IDs and allocations are rejected.
- Confirmed live Commercial schema: `Payment Control`, `Payment_Allocations`, `Payment_Events` already hold the authoritative references; no replacement payment database was created.
- A zero-required deposit is now reported as **`NO_DEPOSIT_REQUIRED_NOT_BANK_CLEARED`** rather than inventing cleared funds, pending a separately approved no-deposit release policy.
- **Critical truth:** `Payment_Events` is itself an internal historical register. Matching `CLEARED` rows is not independent real-time bank/provider settlement confirmation. The inspector returns `independent_bank_confirmation:false`; production job and procurement authorization still require bank/provider evidence and release acceptance. Never treat spreadsheet status as a verified incoming bank transaction.
- The change has test fixtures for valid source pairs, missing payment events, duplicate rows/events, mismatch, invalid evidence, zero deposit. **Merged in PR #60** after all three CI suites passed.

## Independent bank release authority — current candidate

- **PR #60 merged** at `834514014a431ebb7b3822a7d7ffbf16c01e7f04` after Runtime P2, Document Extract, Evolving Status Gate CI PASS. Canonical `Payment Control`, `Payment_Allocations`, `Payment_Events` consistency checks are now in GitHub `main`. Their `CLEARED` labels are internal observations, **not** independent bank settlement.
- Next boundary **candidate** `codex/magos-bank-provider-release-authority-20261121`: existing `createCanonicalJobAuthorityVerifier` now requires a distinct *server-side* `bankClearanceVerifier` before it permits creation of a job from an accepted, signed quote.
- The independent bank/provider authority must confirm the exact control ID, opportunity, job ID, unique cleared event ID set, cleared cents, settlement state and authoritative confirmation ID. A missing verifier blocks job creation; generic runtime/HTTP caller cannot supply approval. Tests include missing, mismatched, duplicated and unavailable authority.
- **Production gap:** no real bank/provider credentialed verification callback is connected in the HOSTAFRICA worker. This is intentional fail-closed, not permission to manufacture an attestation. Source and CI were merged in PR #61; real bank/provider integration is still pending. The previous working business operations outside new guarded flows remain unchanged.

### Release evidence — deposit reconciliation and independent bank authorization

- [PR #60](https://github.com/jacquesmit/myriad-green/pull/60) MERGED to `main`: `834514014a431ebb7b3822a7d7ffbf16c01e7f04`. Exact head `dab273b7e7a53db016ff16229a89c8718e0da94e` passed MAGOS Runtime P2 #189, Document Extract #230, and Evolving Status Gate #8. The canonical payment-event reconciliation is CODE/CI PASS, not live financial verification.
- [PR #61](https://github.com/jacquesmit/myriad-green/pull/61) MERGED to `main`: `be3802995169d6f596dd025e670ef8fb698452f9`. Exact head `32541c32234319984befe17b22f36f1af2e13721` passed MAGOS Runtime P2 #191, Document Extract #232, Evolving Status Gate #9. New governed job creation requires separate trusted bank/provider settlement confirmation matched to exact canonical event IDs and amount.
- **Unresolved:** real bank/provider authority callback is NOT CONFIGURED; on HOSTAFRICA the deployed commit SHA is NOT VERIFIED; WordPress reviewed signature bridge/published page remain NOT VERIFIED. These are hard live acceptance gates, not completed features. No bank confirmation, new customer job, payment or supplier transaction was fabricated during this build.


## Payment clearance held through P3 job creation — candidate

- **Observed defect:** the independently reviewed bank/provider attestation was checked before P3, while the existing job-create plan only included quote and CRM preconditions. A recorded deposit or Payment_Events clearance could be changed before job creation without invalidating that transaction.
- **Implementation candidate:** `job-payment-commit-preconditions.js` re-reads canonical `Payment Control`, `Payment_Allocations`, and `Payment_Events` after the signed quote/job plan has been resolved. It requires the independent bank attestation's exact control/opportunity, unique event and allocation IDs, and recorded cents to agree. Existing P3 writer then receives `PATCH/CREATE` preconditions for the exact deposit amount, cleared bank event state and evidence links, before any new job records are written.
- `accepted-job-execution.js` rejects a different opportunity or missing bank authorization, attaches the finance preconditions to the same P3 plan and does not mutate records on preview. `canonical-job-authority.js` now returns its verified canonical opportunity ID explicitly.
- **Truth:** CODE staged; CI/merge pending. The P3 writer's compare-and-match checks apply to known rows. Google Sheets does **not** provide atomic isolation over newly inserted/reversed rows; a real bank provider integration and end-to-end hosted idempotency acceptance remain necessary. No live customer or bank values have been changed.


### Release evidence — job payment CAS #62

- [PR #62](https://github.com/jacquesmit/myriad-green/pull/62) **MERGED** to GitHub `main` at `5bd261451e69b35c9670d3fe4cfc636f80fd6f48`. Exact tested PR head `5c2b9fbb368d3e734ad3cbadd8cfef0e8eb668e1`.
- GitHub actions: MAGOS Runtime P2 **#193 PASS**, MAGOS Document Extract **#236 PASS**, MAGOS Evolving Status Gate **#10 PASS**. Source commit now contains `job-payment-commit-preconditions.js` and the protected job executor integration.
- Existing P3 transaction binds financial source row compare-and-match conditions to the confirmed job, control, cleared payment events, allocation IDs, amounts and Drive evidence; regression tests cover reversed events, mismatched opportunity, missing bank attestation, dry-run and source mismatch.
- **Production acceptance remains OPEN:** no bank/payment-provider attestation is connected in deployed HOSTAFRICA runtime; deployed SHA, WordPress reviewed-signing bridge and a genuine bank-to-signed-quote-to-job transaction are NOT VERIFIED. Google Sheets row-level CAS does not guarantee sheet-wide serializability. No real client or financial records edited by this implementation.


## P3 independent bank amount integrity — 21 November 2026 candidate

- **Defect reproduced in source review:** the previous post-attestation job-release compare-and-match checked the *set* of payment event/allocation IDs but did not retain the exact `confirmed_amount_cents` from the separate verified bank callback. If an allocation and its Payment_Events amount changed together, the IDs and internal reconciliation still matched even though the external bank attested a different amount.
- **Change:** `canonical-job-authority.js` now includes the bank-verified integer cents and confirmed deposit requirement in its server-owned attestation. `job-payment-commit-preconditions.js` requires safe positive integer bank-confirmed amounts, compares both cents values against canonical source totals, and binds them into the P3 precommit decision. Missing/malformed bank confirmation is `REVIEW_REQUIRED`, never clearance. Existing CAS checks remain.
- **Tests:** accepted-job-execution regression now covers simultaneous event+allocation increases, changed deposit requirement, missing/incorrect externally confirmed cents, and positive dry-run/commit. Bank verifier positive test checks the returned exact cents.
- **Evidence level:** branch `codex/magos-bank-amount-commit-binding-20261121` CODE STAGED; CI/PR/merge PENDING. No real bank confirmation or provider credentials connected, HOSTAFRICA SHA still NOT VERIFIED, and no customer or financial source rows edited. Never mark MAGOS production complete on this code fix.


### Merged implementation — bank amount integrity #63 and live WP source check

- [PR #63](https://github.com/jacquesmit/myriad-green/pull/63) merged to `main` at `1acc9f8ec104c860a1a46fbe5968bed2311cfe0d` after exact-head MAGOS Runtime P2 #195 PASS, Document Extract #240 PASS, Evolving Status Gate #11 PASS (tested head `879b28ba693d8c6e6ce91a0c4e3f620f80a9a4f3`). The P3 creation decision now compares *external bank-confirmed cents*, required-deposit cents, and recorded Payment_Allocations/Payment_Events amounts. CODE/CI PASS; actual bank verifier still NOT CONFIGURED.
- WPVibe live read-only recheck 2026-11-21: the signed-client page `9481` remains `draft` and `/mgos/v1` has **no `quote-acceptance/verify-v2` route**. The deployed legacy plugin 0.3.2 continues to be OWNER_TEST-only. Reviewed client signing is therefore **not production-operational**, despite CI archive creation.


## WordPress reviewed client signature strict purpose and evidence — candidate

- **Source improvement:** reviewed companion `mgos-reviewed-client-signature.php` now accepts only HMAC-validated `purpose=CLIENT_ACCEPTANCE` tokens. Previously, it excluded `OWNER_TEST` but did not explicitly reject missing or unknown token purposes. The existing legacy token verifier still checks expiry, HMAC and document identity.
- Admin approval and private `verify-v2` now require a **specific Google Drive file** in `/file/d/<id>/...`, not a generic Drive homepage or folder link; the receipt SHA-256 and independent review gates remain enforced.
- Automated source-contract tests now verify token-purpose exclusion and Drive file specificity; reproducible ZIP packaging must re-run in PHP lint/Bridge CI. **CODE candidate; CI/merge pending.**
- **No production install:** authenticated WPVibe still reports page 9481 `draft` and no live `verify-v2` route as of 2026-11-21. A packaged plugin is not an active customer acceptance workflow. Actual FluentForm submission, consent and reviewed-signature acceptance are still NOT VERIFIED.


### Release evidence — exact client-purpose WordPress bridge #64

- [PR #64](https://github.com/jacquesmit/myriad-green/pull/64) MERGED at `f515b707c7d357d3928d17e5d721b83cc22f04e5`; exact tested PR head `0d8400c704e6a6ec7885692875c42a24b518a9cb`. WordPress Signature Bridge CI #7 PASS (PHP lint, source contracts, deterministic ZIP and SHA), Document Extract #244 PASS, Evolving Status Gate #12 PASS.
- Approved CI artifact: `magos-reviewed-client-signature-plugin` (artifact ID `14725111232`, archive digest `sha256:731dcf3e9b7456ddf94b8a81cdbb29703b774e5e390e1cd547f9ecdae3797eee`, expires 2026-12-21). This contains the actual installable plugin ZIP and checksum. A GitHub artifact is **not** an installed plugin and should only be deployed after staging, checksum and rollback review.
- Live WordPress remains `verify-v2` MISSING and page `9481` DRAFT on the latest 2026-11-21 WPVibe inspection. HOSTAFRICA deployed runtime SHA NOT VERIFIED. Customer signature positive-path, bank provider confirmation and end-to-end job release remain BLOCKED. No customer-facing page or plugin was changed.


## HOSTAFRICA deployment release execution — 21 November 2026 candidate

- **Verified HOSTAFRICA tickets:** #9342462 enabled cPanel Terminal and earlier recycled the lingering worker; #3622207 confirmed correct runtime root and recommended the app-specific `lsnode` worker recycle. Ticket #3622207 was auto-closed 16 November 2026, not a new release sign-off. HOSTAFRICA was emailed on 21 November to reopen the case and provide actual read-only Git/worker evidence. An expired legacy GitHub `MAGOS cPanel Git Push` PAT was reported by GitHub on 3 November; remote fetch ability requires live verification.
- **Implemented candidate:** new `magos/scripts/hostafrica-release.sh` supports read-only `inspect` and explicitly approved `deploy`. Deployment checks exact remote `main` SHA, clean tracked worktree, hosting user, private token isolation, cPanel deploy declaration, existing dependencies, host backup confirmation, rollback SHA receipt, app syntax and scope-limited worker recycle; postdeploy `release-preflight.js` must establish the running worker's Git SHA and reachable canonical read-only systems. No code execution against HOSTAFRICA was performed here.
- **Tests and governance:** new `magos/tests/hostafrica-release.test.js` covers syntax, clean read-only inspection, Git remote failure, dirty checkout and refusal to deploy absent explicit flags; added to `MAGOS Runtime P2` workflow. Existing `MAGOS-CURRENT.md` and `MAGOS-STATUS.md` changes are in the same branch. CI/merge pending.
- **Not complete:** no authenticated cPanel shell connector is present; WordPress reviewed signature plugin remains uninstalled, client page remains draft, bank/provider verifier is not connected; live source-backed golden workflows and exact hosted running commit are unverified. Do not mark MAGOS COMPLETE from this release procedure.


### HOSTAFRICA release control #65 — merged and tested

- [PR #65](https://github.com/jacquesmit/myriad-green/pull/65) MERGED at `c694c27697c5f98e07dac1450d369e9a798b0864`. Exact tested PR head `3e25ecd387d6709444d87ff28da39faa555d9ef7`; MAGOS Runtime P2 run **#197 PASS**, Document Extract run **#248 PASS**, Evolving Status Gate run **#13 PASS**.
- Host operator can use `magos/scripts/hostafrica-release.sh inspect` to verify source and private GitHub access without changing the deployment; `deploy` requires explicit release SHA, approved backup, private environment tokens, clean Git, correct cPanel user, matching remote SHA and successful authenticated release preflight after the app-scoped worker recycle. Tests include read-only inspection, inaccessible Git remote and refusal to deploy without approvals.
- A HOSTAFRICA support-ticket reply was **SENT** (ticket #3622207) requesting checkout, Git access and running-worker evidence. Support reply, actual deployment, authenticated running process SHA, WordPress reviewed-signature install and independent bank/provider API remain **PENDING/UNKNOWN**. The hosted P5 response seen earlier in November is NOT proof current main is loaded.


## 22 November 2026 — Whole-system evidence evaluator (development branch)

- Added `magos/scripts/whole-system-acceptance.js`: standalone, read-only, fail-closed assessment across **16 explicit release boundaries** (host SHA, live sources, CRM intake, signed quotes, bank settlement, job creation, procurement, scheduling, field evidence, cost/margin, invoices, aftercare, people/assets, website, ecommerce and restore).
- Accepts only a JSON `gates` object with exact named gate IDs; absent/malformed/unsupported PASS evidence becomes FAIL. PASS entries require a pinned tested 40-character SHA, HTTPS evidence link, verification timestamp and named reviewer. PARTIAL never becomes PASS. No bank, customer, supplier or WordPress writes.
- Run: `node magos/scripts/whole-system-acceptance.js /path/to/release-evidence.json`. Nonzero exit code for blocked or malformed evidence. This script checks evidence *shape*, **not actual host truth** or the evidence links; manual independent source verification is still mandatory. No input evidence file is committed or fabricated. Validated CI/merge and live sign-off PENDING.
- **Security correction:** GitHub repository metadata obtained on 2026-11-22 reports `jacquesmit/myriad-green` as **public**, despite older runbook language calling it private. Confirm intended visibility and audit Git history for credentials before host releases. Git public status is not proof of leaked secrets.


### 22 November 2026 — Acceptance evaluator merged and support re-open attempt corrected

- [PR #66](https://github.com/jacquesmit/myriad-green/pull/66) **MERGED** into `main` at `9fc577b5b23ec696bf7aa9fdba13d98084a65dc9`; exact head `9a533c63a046d13af9cc1ea6a932f9f7e6cbae93` passed MAGOS Runtime P2 #199, Document Extract #252, Evolving Status Gate #14. This is source/test PASS only, **not** live release certification.
- The 21 November reply on existing ticket #3622207 was **rejected** by HOSTAFRICA's closed-ticket system (two automated rejection emails). On 22 November, a **new unthreaded email** was successfully submitted to `support@hostafrica.com` requesting a NEW ticket and read-only host/Git/worker facts. Sending email does not prove a new ticket exists; HOSTAFRICA acceptance/ID and server evidence are PENDING.
- Public `/healthz` and `/readyz` could not be retrieved via available web checks; mark **UNKNOWN**, not outage. No payment, client signature, WP release, bank credentials or customer data were changed.


## 22 November 2026 — Recurring aftercare service-history correction (candidate)

- Existing `magos/processor/aftercare-readiness.js` derived recurring maintenance exclusively from installed date. A separately serviced pump/valve/tank could therefore receive an incorrect next-due suggestion. This is an operational accuracy issue, not merely a dashboard concern.
- Candidate now derives the next service interval from **independently documented last servicing** when `last_service_date`, `last_service_job_id`, and `last_service_evidence` are all present, chronologically valid and linked to the installed part. Missing/contradictory metadata blocks the draft candidate for owner review; historical assets with no recorded servicing continue to use installation as a provisional anchor.
- The calculation now anchors all monthly intervals to the original verified date, avoiding cumulative end-of-month drift. Records remain `DRAFT_REVIEW_ONLY`; client consent, message sending, warranty liability and booking remain unauthorized.
- Unit regressions cover verified cadence reset, partial/no proof, impossible/future/preinstallation dates and end-of-month recurrence. **Source PR/test and live aftercare register verification still pending**. No customer contact or live Sheets edits.


### 22 November 2026 — Aftercare cadence fix merged

- [PR #68](https://github.com/jacquesmit/myriad-green/pull/68) MERGED into `main` at `c64e47ff7942b05c2920078a8ca0ee655ed86bf4` after exact-head `55e3ecf5b057c3f27c438cd373ca3efb1ab904c6` passed Runtime P2 #201, Document Extract #256 and Evolving Status Gate #16.
- Read-only maintenance candidates now use documented last service metadata when complete and chronological, otherwise refuse incomplete service claims; anchors avoid month-end cumulative drift. **Canonical Installed_Parts source schema and evidence provenance must still be validated**; this is NOT proof a service happened, permission to message a customer, or a live operational release.


## 22 November 2026 — Independent aftercare service evidence authority (candidate)

- Corrected the post-#68 evidence defect: merely filling `Installed_Parts.last_service_date`, `last_service_job_id` and `last_service_evidence` is **not** independently verified servicing. The prior code incorrectly labelled those fields `VERIFIED_LAST_SERVICE` and could reset the recurring schedule from self-entered data.
- `assessAftercare` now rejects any claimed last service unless an **independent, exactly matched server-generated canonical Job Execution receipt** identifies installed part, service job, date, evidence, client, property and verified source; duplicated, mismatched, missing, unavailable and forged-source receipts fail closed. `inspectJobAftercare` accepts only an optional server-configured verifier callback, never an HTTP customer-provided receipt. Missing callback does not pass.
- Existing installed-date-only draft maintenance remains usable, and no bookings, messages, warranties or client records are changed. Unit regressions include accepted receipt and negative provider failures.
- **Production BLOCKED:** the actual canonical service receipt adapter must be integrated against verified live `Job Execution` headers and evidence. The verifier callback is a strict contract, NOT an independent provider integration. Do not mark recurring service automation active from passing tests. Candidate CI/merge pending.


## 22 November 2026 — Canonical service history verifier and real source-schema audit

- **Live read-only source inspection:** [Supplier Master Parts & Pricing Library](https://docs.google.com/spreadsheets/d/11MpTf4A9S2NeCH8uQMGmDVW0Rwgit2Ze--7jLYu0Ztk/edit) `Installed_Parts` has 23 populated header columns from `installed_part_id` to `warranty_status`, and **NO** `last_service_date`, `last_service_job_id`, `last_service_evidence` or `Service_History` tab. [Commercial Quote & Invoice Register](https://docs.google.com/spreadsheets/d/1NJxYXRMS_6HU53wWqgSJh9jhf2jlLRa-Avi0ZfMLoNc/edit) `Job Execution` has `Job ID`, `CRM ID`, `Completion Status` and `Completion Sign-off`, but no dedicated service completion date or installed-part ID in its verified first-row headers.
- **Code implementation:** new `processor/service-history-verifier.js` validates a proposed Supplier `Service_History` record with exact installed-part/job/date/evidence/client/property links, unique service event, independent human `reviewed_by`/`reviewed_at` approval, and exactly one matching Commercial `Job Execution` with completed/handover state, correct CRM ID and nonempty sign-off. `inspectJobAftercare` uses that canonical read-only verifier when recorded last-service fields are present. Absent tab/authority fails closed, not fabricated service.
- **Production migration still required:** governed creation/ownership and header registration for a canonical `Service_History` tab; verified population from real signed and evidenced service jobs; approved source/read credential and tests; integration of the `last_service_*` linkage on `Installed_Parts` under its authoritative ownership. This PR does not mutate either live workbook.
- Evidence is code + exact source-header reconnaissance only; **not** a deployed, owner-approved or automatically scheduled service flow. PR/CI/merge PENDING.


### 22 November 2026 — Independent service history implementation merged

- [PR #70](https://github.com/jacquesmit/myriad-green/pull/70) merged `3b3883281d28fbea1c52926d1caf28b0c976d363` after Runtime P2, Document Extract and Evolving Status Gate CI passed at exact head `7037df7de9a479bb5d3c5dd9a7590a71d01ed975`.
- [PR #71](https://github.com/jacquesmit/myriad-green/pull/71) merged `ff420aecb0d6a7c514ee474e880d09deb239430a` after three CI workflows passed at exact head `5b004afa9d749f4b185f9213e470db93d9babee4`. The read-only `service-history-verifier.js` joins reviewed service records to completed Commercial Job Execution; missing source safely blocks service-reset claims.
- Verified live workbook headers expose the remaining migration blocker: no `Service_History` Supplier tab and no `last_service_*` linkage on `Installed_Parts`. No source rows/tabs were created or changed. **Aftercare recurring messages/scheduling remain NOT DEPLOYED**; canonical schema/ownership and an actual signed-off service transaction must be added and validated separately.
- HOSTAFRICA accepted NEW support ticket **#3957866** for read-only deployment verification. Only acknowledgment has been received; no host SHA/worker result or deployment proof yet.


## 22 November 2026 — Core lead-to-job integrity repair (development candidate)

- Reprioritized from isolated aftercare/host work to the canonical **accepted quotation → independently bank-cleared deposit → P3 job creation → CRM and Commercial read-back** business transaction.
- Concrete defect: `job-commit-readback.js` previously validated only the job/opportunity/quote identifiers, allowing a P3 `COMMITTED` result with a **wrong client, altered accepted scope, changed recorded deposit state or mismatched job status** to be reported as verified. The read-back now requires the exact planned CRM and Commercial values from the same P3 TransactionPlan and verifies actual CRM client identity against the execution's CRM ID. Source exceptions, missing compiled expectations and missing link identities fail closed.
- `accepted-quote-job-plan.js` now refuses an accepted job with missing canonical CRM ID or accepted project scope *before* writing. The accepted scope is pinned to the quote P3 compare-and-match preconditions so an intervening scope edit cannot silently enter a job.
- Regression tests cover full positive writer roundtrip, wrong client, scope drift, false deposit state, wrong scheduling/job status, missing scope/client before write and source read-back failures. No payment/provider confirmation is fabricated; actual independent bank callback remains unconfigured. The code treats an already-committed but inconsistent job as `COMMIT_READBACK_UNVERIFIED` for reconciliation, **not as safely rolled back**.
- Candidate branch `codex/magos-core-job-readback-integrity-20261122`; GitHub CI/merge pending. Production execution, quote signature WordPress bridge, real provider clearance and a live golden lead-to-paid-job remain BLOCKED/UNKNOWN. No live customer/financial rows changed.


## 22 November 2026 — Core quote activation line-state mismatch correction

- Confirmed a cross-module defect in the business lifecycle: `quote-to-job-readiness.js` permits canonical accepted quote `Line Control State=LINE_CONTROL_OK`, while `job-release-inspection.js` previously recognized only `PASS`. A valid accepted quote could therefore pass one core workflow and be falsely blocked in the operator activation/financial-signature assessment.
- Updated the canonical read-only job-release inspection to recognize both supported statuses `PASS` and `LINE_CONTROL_OK`; all other/unknown states remain blocked. Added job-release and job-activation regression checks confirming bank receipt evidence remains **evidence only**, not independent payment authority. No customer records or bank statuses changed.
- Feature branch `codex/magos-quote-activation-line-state-20261122`; CI/merge pending. This is a core lifecycle integration repair; live WordPress client-signature and independent bank/provider release remain unverified.


## 22 November 2026 — Unified operational job lifecycle (development candidate)

- **Business integration, not a new source ledger:** added `processor/job-lifecycle.js` and protected `GET /v1/operator/job-lifecycle/:jobId` to inspect the same job across accepted quotation, exact CRM/Commercial identity, ledger deposit evidence and the relevant scheduling **or** financial/field closeout path. Reuses existing `inspectDepositEvidence`, `inspectSchedulingReadiness` and `inspectOperationalClosure` source readers.
- The output records each stage with actual canonical status and a next-action reason. It distinguishes `EVIDENCED_ONLY` for reconciled Payment_Events/Allocations from independently confirmed bank settlement, `PROVIDER_CHECK_REQUIRED` from a booked appointment, and `OWNER_REVIEW` from completed/paid job. It NEVER marks production complete, job closed or customer outreach authorized from these read-only inspections.
- Checks uniqueness of the job/Job Execution records, exact opportunity/client/quote linkage and accepted scope equality before invoking downstream checks. Conflicting identities fail closed. Completed work follows closeout rather than falsely failing because it cannot be rescheduled.
- Regression tests cover active job lifecycle, deposit evidence versus authority, bad client/opportunity, stale scope, completed job routing and protected HTTP with zero writer calls. No server/provider changes or customer data modifications.
- Code candidate branch `codex/magos-unified-job-lifecycle-20261122`; CI/merge PENDING. The output is an operator diagnostic, NOT a replacement for real bank provider attestation or the golden customer transaction.


### 22 November 2026 — Business lifecycle visible in Command Centre (candidate)

- Following tested and merged [PR #75](https://github.com/jacquesmit/myriad-green/pull/75) (`3c37192817e331ff98608443ce9d1e7490c0faa8`), each job detail card now offers **Inspect full job lifecycle**, using existing authenticated `/v1/operator/job-lifecycle/:jobId` rather than requiring a separate API client. The browser renders quote, ledger, scheduling/closeout stage states and a next action via safe `textContent`, without a second data ledger or customer-data write.
- Added an operator-page source regression ensuring integrated action/API linkage, neutral independent-bank warning and no browser token storage. This is a code candidate; CI/merge and deployed Command Centre are NOT VERIFIED. Existing detailed inspections are preserved.


## 22 November 2026 — Scraper vs inbound CRM provenance segregation (candidate)

- **Live CRM source verified read-only:** `Myriad Green Outreach CRM` `CRM_Master` has `lead_direction` (column BV), `record_origin` (BW), `acquisition_source` (BX), `first_contact_channel` (BY), source evidence and canonical CRM IDs. Rows 2–12 explicitly show `OUTBOUND / SCRAPER / OUTBOUND_PROSPECTING`; later records show `INBOUND / WHATSAPP_CLIENT_REQUEST`, `INBOUND / GMAIL / GOVERNMENT_RFQ`, and `UNKNOWN / DRIVE_IMPORT`. The `today_outreach` tab contains outreach tasks rather than self-initiated customer requests. The intake tab has source_system/type but no canonical `lead_direction` column. These are verified source structures, not inferred counts of the complete live book.
- **Defect:** the historical Command Centre showed one undifferentiated `Clients / CRM` dataset, although hundreds of scraped outbound prospects occupy `CRM_Master`. The P3 lead observation also defaults missing direction to `INBOUND`, allowing an outbound-source event mistakenly routed to the inbound processor to be treated as a new customer enquiry.
- **Build:** introduced `processor/lead-provenance.js` for a conservative classification: `INBOUND_ENQUIRY`, `OUTBOUND_PROSPECT`, `CONVERTED_OUTBOUND` (preserves original acquisition source), or `PROVENANCE_REVIEW`. Strong provenance conflicts or unknown legacy `DRIVE_IMPORT` records are never asserted inbound. `lead-processor.js` rejects outbound source, source type, explicit direction and scraper origin **before** the authoritative transaction planner; no CRM or opportunity write is compiled.
- **Command Centre:** derived exclusive `Inbound CRM`, `Scraper / outbound prospects`, `Provenance review` views from **one canonical CRM_Master read**, plus distinct counts. Legacy scrape-only records with source_query and map/website discovery evidence are conservatively labelled outbound; conflicting source metadata is held for review. No data migration, customer communication or scraping campaign was performed.
- Tests added for original source/converted prospect, true inbound, unknown/contradictory records, unavailable CRM source, blocked outbound ingress, permitted website lead, and operator navigation; Runtime P2 CI now explicitly runs `lead-intake.test.js`.
- Source CODE STAGED; CI/PR/merge and deployed browser validation PENDING. Do not claim full CRM remediation or verified live pipeline totals until full source scan/dedupe and controlled runtime checks.


### 22 November 2026 — Full bounded CRM direction scan, read-only

- Read `CRM_Master!BV1:BY1553` (only lead direction, origin, acquisition and first contact; no CRM data altered). Google Sheets returned 1,464 rows including headers/blank provenance rows; 1,408 rows had at least one populated attribution field. Recorded `lead_direction`: **1,325 OUTBOUND**, **58 INBOUND**, **19 UNKNOWN**, and **6 missing/malformed** (including invalid email/forwarded labels). These are counts of *labels*, not validated leads, not sales and not proof of live production readiness.
- All 1,325 recorded `OUTBOUND` rows in this bounded sample have `SCRAPER / OUTBOUND_PROSPECTING` source metadata. The code now adds `WEBSITE_FORM` to the accepted explicit inbound-origin vocabulary. Historical invalid/unknown provenance is held for review, never silently reassigned.
- No mass reclassification, campaigns or client writes performed. Source row offsets may not equal immutable CRM IDs; do not use row numbers as identity.


### 22 November 2026 — Scraper attribution segregation merged and inbound count hardened

- [PR #77](https://github.com/jacquesmit/myriad-green/pull/77) MERGED to `main` at `26748fd382657f2a30c9d318c771190aa95b5da7`. Exact tested head `f523c92ae5de0995fc3fb98eccca15b4e26f4e5e` passed MAGOS Runtime P2 #219, Document Extract #278 and Evolving Status Gate #29. Code/CI PASS; live HOSTAFRICA operator UI acceptance PENDING.
- After merging, another dashboard weakness was isolated: `projectOperations` accepted generic `source_type=LEAD` as inbound even when `source_system=UNKNOWN`; this could overstate inbound opportunities. New change requires a credible inbound source system for any lead type; excludes scraper/google-places/outbound and supplier, RFQ, invoice or document types regardless of labels. Explicit inbound evidence still requires qualification and is not a booked or paid job.
- Regression tests cover unknown-source generic LEAD, scraped event mislabelled as WEBSITE_FORM, known Gmail/WordPress customer enquiries and separate RFQ/invoice handling. No source records modified. Branch `codex/magos-inbound-queue-source-authority-20261122`; CI/merge PENDING.


### 22 November 2026 — Inbound KPI source authority merged

- [PR #78](https://github.com/jacquesmit/myriad-green/pull/78) MERGED to `main` at `c5ebc0c0c676066cb7c5ebd5360ec025c656c2e0` after exact head `3c5dc4ff237fa06c876562dd116eca420f1d22d6` passed MAGOS Runtime P2 #221, Document Extract #280 and Evolving Status Gate #30.
- Read-only inbound snapshot now requires an approved inbound source system, and excludes generic LEAD records whose source is UNKNOWN, SCRAPER, GOOGLE_PLACES or explicit outbound. A source_type label alone cannot establish inbound provenance. Gmail/WordPress/WhatsApp/Amelia customer submissions continue to qualify as operational intake when source and type match.
- **Scope of evidence:** exact-code CI PASS and merged; operator browser and deployed runtime remain NOT VERIFIED. Live CRM direction scan labels 1,325 outbound, 58 inbound, 19 unknown and 6 missing/malformed among 1,408 nonempty provenance rows. These are not verified enquiries or sales conversion counts. No live spreadsheet rows or outreach campaigns modified.


## 22 November 2026 — Source-attributed lead-to-job conversion joins (candidate)

- Built `processor/attributed-conversions.js` to join **one existing canonical CRM_Master source record** through `Jobs_Opportunities`, `Quotes`, and `Job Execution` by unique CRM, opportunity, quotation and job execution identifiers. This corrects a structural gap: the current Command Centre differentiated scraper origins but did not connect that origin to an actual quote or created job.
- Read-only `MAGOS_ATTRIBUTED_CONVERSION_V1` reports opportunity, quoted, accepted-status and **canonical linked job** counts by original acquisition source. Uncontacted scraper records do not count as enquiries; previous outbound origin remains `OUTBOUND_SCRAPER` when jobs result. Imported/contradictory provenance stays `UNKNOWN` for review. Source errors, duplicate canonical IDs, reused job IDs, mismatched execution/client/quote/opportunity links and quote/job conflicts generate exceptions instead of fabricated conversions.
- Existing `operator-dashboard.js` now computes a `conversions` department directly from already-read source rows; new Command Centre navigation `Lead-to-job conversion`, plus source-linked job and attribution exception indicators. No separate customer ledger, duplicate marketing data store, quote/job write or owner action is created.
- **Critical distinction:** `accepted` means the recorded quote status is ACCEPTED; it is not yet a cryptographically verified signed quote. `linked_jobs` means matching canonical job IDs, not proven revenue, independent bank clearance, profitability or a completed job. Report fields explicitly keep `payment_status=NOT_VERIFIED`, `profit_status=NOT_VERIFIED`, `payment_authorized=false` and `revenue_verified=false`. Do NOT use this preliminary funnel as a ROAS or net profit statement.
- Added positive/negative unit and authenticated HTTP tests for outbound conversion, inbound source, unknown provenance, duplicate IDs, reused job IDs, false CRM/quote links, unavailable source, zero writer calls. CI workflow explicitly includes `attributed-conversions.test.js`.
- Candidate branch `codex/magos-attributed-conversion-spine-20261122`; CI/merge PENDING. No real customer communication, GitHub production deployment or live workbook modifications. Full real-source reconciliation and cross-system lead→paid-job acceptance remain pending.


### 22 November 2026 — Real inbound enquiry evidence joins original acquisition and canonical sale

- [PR #80](https://github.com/jacquesmit/myriad-green/pull/80) merged to `main` at `e3ffdaa8382c6505b1f4b7846684da5cc96e1093`. Exact tested head `b155611c12ee7d0d8c8baaacf5416baaafc66e22` passed Runtime P2 #223, Document Extract #284 and Evolving Status Gate #32.
- Extends the canonical conversion spine: `Intake_Queue` source events are linked into `CRM_Master` → `Jobs_Opportunities` → `Quotes` → `Job Execution` **only using matched_crm_id + matched_opportunity_id and qualified inbound source-system/type metadata**. Duplicate `source_system|source_event_id` events are excluded from matched-enquiry counts; a mismatch in CRM ownership creates a review exception.
- Original outbound/scraper attribution remains immutable when the business later receives a genuine inbound enquiry; `inbound_link_state` and `matched_inbound_events` are independent of original `source`. Multiple inbound events for a single opportunity are counted as one inbound-linked opportunity in overview metrics, not multiple sales. Scraped records, unknown event sources and supplier/RFQ document types do not inflate inbound counts.
- Command Centre `conversions` records now show original source and independently linked inbound events, with `Inbound linked` overview metric. No new source authority, duplicate CRM ledger, client communication or payment assertion.
- Regression tests cover original scraped origin plus later WhatsApp event, website form linkage, duplicate source events, incorrect CRM ownership, unknown/scraper lead types and non-lead supplier email. **Branch pending CI/merge and production runtime confirmation.**


### 22 November 2026 — Inbound-to-sale linkage merged

- [PR #81](https://github.com/jacquesmit/myriad-green/pull/81) MERGED to `main` at `e87ea7588138b35faa87c5feb1cd1aac3503fcc0`; exact tested head `27b6417b9da295399450c352903a5b326d4fa713`: MAGOS Runtime P2 #225 PASS, Document Extract #286 PASS, Evolving Status Gate #33 PASS.
- The canonical `Intake_Queue` → `CRM_Master` → `Jobs_Opportunities` → `Quotes` → `Job Execution` read-only trace exists in merged code and is exposed from the operator dashboard. It preserves original acquisition source and tracks later inbound contact separately; missing, conflicting and duplicate source links are not counted as proven customer conversions.
- **Runtime evidence remains pending:** GitHub CI validated code against fixtures, not the actual production server with connected live CRM, signed acceptance and independent bank provider receipts. No live sheet mutations, payment authorizations or client outreach were performed.


## 22 November 2026 — Dated delivery plan and usable frontend milestone tracker (candidate)

- **Live source read-only:** authoritative [MAGOS Control Hub Business_Capability_Map](https://docs.google.com/spreadsheets/d/1lxFrUEGeEojkxbpQiVfj1AxuB5C1ayaTzAT8rkaTObo/edit) contains 22 capabilities: **0 PASS, 18 PARTIAL, 4 FAIL** (`CAP-010` variation control, `CAP-012` job profitability, `CAP-015` recurring revenue, `CAP-019` labour/capacity). These are source acceptance states, NOT an effort percentage. At this checkpoint the existing dashboard had capability status but no explicit target dates/missed milestone analysis.
- Added `processor/delivery-roadmap.js` with 4 transparent **proposed planning targets only**, NOT owner-approved or guaranteed dates:
  1. `UI-01` 2026-11-25 — usable operator frontend pilot, tested login/current deployed commit and actual CRM/job records (`CAP-020/021`).
  2. `FLOW-02` 2026-12-04 — controlled lead → signed quote → provider-confirmed deposit → job read-back (`CAP-001/002/004/005/006/020/021`).
  3. `FIELD-03` 2026-12-18 — procurement → field proof/variation → actual-cost/invoice controls (`CAP-007..012`).
  4. `FULL-04` 2027-01-15 — full 22-capability + 16 whole-system production release-gate acceptance **candidate** (not a release promise).
- Each milestone shows target date, recorded PASS/total, canonical capability blockers, missed-target state, and next action in Johannesburg local time. Dates are *planning targets*, not contractual commitments. No automatic PASS from date or code merge. The existing System Coverage read-only endpoint now projects these milestones and the **actual frontend system workspace** renders a delivery tracker table; no additional database, credential or customer write.
- Corrected a production-status defect in `system-coverage.js`: 22 source PASS labels alone can no longer set `production_complete=true`. It instead reports `capability_gates_passed` separately and `production_complete=false`/`production_acceptance=NOT_VERIFIED` until an independently validated live release-attestation path is installed.
- Frontend source already exists at `magos/runtime/operator-page.js`, `operator.js`, `operator.css` on existing `/operator`. External attempt to read `https://runtime.myriadgreen.co.za/operator` and `/healthz` through web lookup was inaccessible; the currently deployed frontend version was NOT verified. This PR does not deploy it.
- New delivery roadmap, operator-page and all-green-gate-failure regression tests added to Runtime P2 CI. Branch `codex/magos-front-end-rollout-tracker-20261122`; CI and merge pending.


## 22 November 2026 — Command Centre live deployment fingerprint (candidate)

- Delivery roadmap frontend is already on merged `main` via PR #83 `e7cfc8232d199b9b6e2d86651436a7d55b98af97`; CI PASS for exact source head `d6f5628a2d0d710e310c343e5b82751d32cabb73` (Runtime P2 #227, Document Extract #290, Evolving Status Gate #35).
- A real user-visible gap remained: the Command Centre offered no proof of which Git commit the running HOSTAFRICA Node worker was actually serving. The existing privileged `/v1/runtime/build` was not accessible using the restricted operator credential.
- Added read-only `GET /v1/operator/deployment` behind `requireOperatorRead` with **only the process-start declared deployment SHA compared against a clean process-start Git checkout**. Returns exact SHA only when both attest each other; otherwise HTTP 202 `NOT_VERIFIED`. Never uses a mutable live checkout, user HTTP-submitted SHA, or a public token. Explicitly reports production business acceptance unverified.
- The existing operator frontend now displays short SHA or a prominent `NOT VERIFIED` message after authenticated dashboard load, and clears the information when locked. This is a prerequisite for verifying that recent frontend work is actually visible on the hosted application; it is **not** a claim of completed production acceptance.
- Added HTTP authentication, false dirty/mismatch declaration and operator frontend tests. Branch `codex/magos-operator-deployment-verification-20261122`; CI/merge and actual hosted SHA verification pending. No provider settings or business rows changed.


## 22 November 2026 — Command Centre source-to-job funnel, actionable exceptions (candidate)

- Existing `processor/attributed-conversions.js` and dashboard already returned source-attributed opportunity, quote, accepted-status and linked-job groupings, but the frontend presented only individual opportunities. In the existing `/operator` **Lead-to-job conversion** department, implemented a visible acquisition-source funnel table (original source → opportunities → quoted → recorded accepted → uniquely linked jobs), with clickable source filtering into canonical opportunity records.
- Preserves clear distinctions: a recorded ACCEPTED quote does not prove a signed acceptance, a linked job does not prove independent bank settlement, and no source-group total is described as cash revenue or margin. If canonical source reads fail, show **UNKNOWN / unavailable**, never misleading zero. No parallel database or customer write.
- Fixed a real navigation defect: the overview Action queue linked attribution exceptions to `conversions`, but the department had no corresponding detail records. Each reconciliation exception is now a `REVIEW_REQUIRED` detail record, so a clicked issue is inspectable in the Command Centre with a canonical register reconciliation action.
- Added tests for live source grouping, frontend table/search presence, explicit evidence caution, and exception-to-record linkage. Candidate branch `codex/magos-frontend-source-funnel-20261122`. CI, merge and deployed-browser acceptance pending. Avoid treating source-code UI as hosted until the process-start deployment fingerprint confirms the SHA.


## 22 November 2026 — Quote validity revenue follow-up controls (candidate)

- Verified actual canonical Commercial `Quotes` headers include `Quote Date`, `Valid Until`, cached `Days Remaining`, `Quote Status`, `Workflow Stage` and `Next Action`. A real earlier quote row shows `TO_CONFIRM/PDF_READY` and elapsed validity, which is **not** proof it was ever delivered; it must not trigger customer follow-up merely because the date is past.
- Added pure `processor/quote-validity.js` to derive Johannesburg-local recorded validity review from `Valid Until` and actual current local date; ignores potentially stale `Days Remaining` formulas and rejects impossible dates. Only quotes recorded `SENT`, `ISSUED` or `AWAITING_ACCEPTANCE` can be flagged for client follow-up review. Draft, TO_CONFIRM, accepted or cancelled records are never treated as sent.
- Existing `operator-dashboard.js` now marks `VALIDITY_ELAPSED_REVIEW`, `VALIDITY_ENDS_TODAY` and `VALIDITY_UNKNOWN_REVIEW` and surfaces an actionable next step in the existing Quotes workspace, with distinct `quotes_validity_review` metric. The existing `/operator` action queue prioritizes quote validity review. Source quote status remains unchanged; `Customer delivery` remains `NOT_INDEPENDENTLY_VERIFIED`; no automatic client email, repricing, status transition or write.
- Regression tests verify an elapsed date overrides stale days-remaining, invalid/empty date is UNKNOWN, unissued drafts not chased, future validity retained, and dashboard next-action priorities. Runtime P2 CI includes `quote-validity.test.js`. Candidate branch `codex/magos-quote-validity-review-20261122` pending GitHub tests and merge. Production quote delivery and live customer follow-up still require independent verification.


## 22 November 2026 — Benchmark-driven CAP-010 scope variation workflow (code candidate)

- The pre-existing Control Hub `Competitive_Benchmark` register maps **CAP-010 / BM-010** to **Simpro (primary)** and **Fergus (supporting)**, with acceptance requiring scope delta, price/cost impact, client approval evidence and downstream invoice linkage. This decision was established before the current implementation; do not replace the benchmark with an invented application roster.
- Read-only inspection of live Commercial `Variations` headers identified the actual authority columns `Variation ID`, `Job ID`, `Original Scope Ref`, `New Finding`, `Additional Work`, `Cost Impact (R)`, `Selling Price Impact (R)`, `Approval Status`, `Approval Evidence`, `Invoice Ref`, `Execution Status`, `Drive Evidence`. Examples included recorded completed work lacking retrospective client variation consent, including a zero-price substituted tank and an additional irrigation variation. No client, financial or source record altered.
- Added `processor/variation-review.js` to classify every existing scope change with independently retained fields: documented original scope, scope delta, amount/cost parse, written client approval state/evidence, execution state, invoice reference and field evidence. Fail closed on missing IDs, duplicates, undocumented scope, incomplete actuals, missing written approval, retrospective execution without approval or missing invoice link for positive-price changes. A zero-price change still needs consent. `financial_close_authorized=false` and `payment_clearance=NOT_VERIFIED` regardless of variation review result. Reuses the canonical register; no second variation store, invoice authorization or client message.
- The existing `operator-dashboard.js` reads `Variations` as a dedicated source, projects reviewable records into `variations` department, and adds `variations_review` / `retrospective_variations` metrics and action-queue exceptions. Existing frontend gains **Scope variations** navigation and **Variations to resolve** metric. Existing job closeout still applies its distinct variation blocking gates; this does not assert CAP-010 production acceptance.
- Added positive and negative tests for approved records, retrospective consent, zero-price variations, missing cost/evidence/price, duplicate variation IDs and integrated Command Centre rendering. Wired `variation-review.test.js` to MAGOS Runtime P2 CI.
- Existing proposed deployment checkpoints are now shown at **17:00 Africa/Johannesburg** in the existing delivery roadmap and operator frontend. Dates remain **proposed planning targets**, not user-approved delivery guarantees: UI pilot 25 November 2026, controlled lead-to-job 4 December 2026, field/finance 18 December 2026, full production acceptance candidate 15 January 2027. No independent hosted deployment or full-system acceptance passed during this branch.
- Branch `codex/magos-variation-command-centre-20261122`; CI/merge pending. Source capability CAP-010 remains FAIL until benchmark completion test and independently evidenced production gates actually pass.


## 22 November 2026 — CAP-010 variation-to-closeout enforcement (candidate)

- **Benchmark context:** approved CAP-010/BM-010 = Simpro primary, Fergus supporting. The already-merged source-level `variation-review.js` examines original scope, delta, client consent/evidence, price and cost impact, completed-work proof, invoice link and duplicate variation IDs. Read-only live `Variations` examples prove retrospective and unbilled scope must be handled independently of job completion.
- **Identified and corrected a real integration defect:** prior `job-closeout-readiness.js` only inspected variation approval and a few execution states, so a job could reach `READY_FOR_INDEPENDENT_FINANCIAL_CLOSE_REVIEW` with undocumented variation scope, missing additional labour/parts cost, changed-price variance with no invoice link, or absent field proof. The closeout inspector now invokes the **same** `inspectVariationRegister` rules as the Command Centre and carries each independent variation blocker into field/financial readiness. Existing compatibility blocker `VARIATION_APPROVAL_UNVERIFIED:<id>` is preserved for consumers. Duplicate IDs also fail the final closeout gate.
- Existing job detail frontend now has an actionable **View job scope variations** button opening the same canonical variation register filtered to that job ID. It does not create another variation store, invoice or workflow.
- Regression tests updated to cover a fully evidenced variation and block missing original scope, cost/sell impacts, positive-price change without invoice linkage, missing field proof and retrospectively completed zero-price substitutions without consent. Integrated operational closure must also surface the field blocker. Independent finance, bank clearance and owner approval remain mandatory; no auto financial authorization or source writes.
- Branch `codex/magos-variation-closeout-integrity-20261122`: CI and merge pending. **This is tested-code progress, not evidence CAP-010 has passed its independently evidenced production gate.** Current hosted release SHA and end-to-end live closeout unverified.


## 22 November 2026 — Aspire/LMN CAP-019 labour-cost visibility (candidate)

- CAP-019 is a **recorded FAIL** in the pre-existing Control Hub benchmark; Aspire is primary, LMN/Simpro supporting. Inspected existing live Commercial source schemas read-only: `Labour Rates` contains person/role, daily ZAR rate, effective date and owner-confirmed authority; `Project Cost & Margin` contains `crew_daily_rate_total`, `crew_days`, `provisional_labour_cost`, `labour_cost_status`. `Job Execution` has a free-text `Crew / Owner` field but does **not** provide individually identified and independently verified actual worker shifts. This remains a real missing source, not grounds to invent time entries.
- New `processor/labour-reconciliation.js` checks unique rate identities, ZAR/correct rate basis/date, margin job IDs and per-job provisional crew rate × days reconciliation to recorded provisional labour cost. Distinguishes mathematically matched estimates from **actual labour verified=0** without worker IDs and source time evidence. Explicit blockers for missing values, unsupported rates, duplicates and mismatched crew-cost calculations. No labour payroll authorization, final job cost or margin assertion; no canonical source modifications.
- The **existing** Command Centre gains `Labour cost review` department, `Labour to reconcile` KPI, per-job evidence gap details and actionable mismatched crew-cost exceptions. Source failures show UNAVAILABLE, not zero. Existing closeout's independently governed job costing and owner approval gates continue to apply.
- New unit and operator-dashboard regression tests; Runtime P2 CI workflow executes `labour-reconciliation.test.js`. Candidate branch `codex/magos-labour-cost-reconciliation-20261122`, CI/merge and live hosted read pending.
- Prior substantive [PR #89](https://github.com/jacquesmit/myriad-green/pull/89) merged to `main` at `b7578772087d30cddbfdbb0401f723f6cfbcd538` after exact source head `b7ee8deb9499f0f7eb7dd59808639a7bf038e930` passed Runtime P2 #237, Document Extract #301 and Evolving Status Gate #41.


## 22 November 2026 — Real customer RFQ recovered in source-to-job attribution (candidate)

- **Business source verified read-only:** canonical [Myriad Green Outreach CRM](https://docs.google.com/spreadsheets/d/1kV3qTzzXxzRPzLj1rgBDS-B0KgKU_FCw8HQwFVxlOno/edit) `Intake_Queue` has actual columns `intake_id`, `source_system`, `source_type`, `source_event_id`, `match_status`, `matched_crm_id`, `matched_opportunity_id`, `processing_status`, `supplier_id`, `business_document_type`. A canonical customer water-filtration RFQ (row 9, `INT-20260727-GMAIL-0008`) is `GMAIL / RFQ`, `NEW_RECORD`, `LINKED`, with nonempty CRM/opportunity IDs, but the previous source-to-job and inbound-queue code excluded **all RFQ** records as supplier-only. Generic RFQ without verified source and identity must still not enter customer metrics. A separate malformed legacy row 2 has date in the intake ID and human values in source columns; it is not evidence of a valid provider event and remains outside this patch.
- Added pure shared `customer-rfq-provenance.js` classification: only an approved inbound provider, exact event/intake/CRM/opportunity pointers, known canonical match state and actual LINKED processing, no supplier ID/document and no outbound/self-test flags may qualify a GMAIL/WEB RFQ as a customer enquiry. No guessing by subject, name or phone.
- Both `operator-snapshot.js` and `attributed-conversions.js` reuse that exact authority. Qualified customer RFQ now appears in inbound enquiry queue and inbound-event-to-opportunity linkage; supplier RFQs, unlinked enquiries and generic unknown events remain excluded. The original CRM acquisition source and scraper origin remain unchanged; quote acceptance, payment, bank clearance and profit are never invented. **This fixes an actual omission in a revenue-facing dashboard rather than adding another detached module.**
- New unit/negative and operator-dashboard tests against actual live column vocabulary. Runtime P2 CI explicitly runs `customer-rfq-provenance.test.js`. Branch `codex/magos-customer-rfq-canonical-inbound-20261122` awaiting CI/merge. All live spreadsheet reads were read-only. No customer, quotation, financial or production records changed; latest hosted SHA remains NOT VERIFIED. CAP-001/CAP-002 and complete golden customer transaction still PARTIAL.


## 22 November 2026 — Operator frontend release readiness gate (candidate)

- **Real production blocker:** previously `magos/runtime/release-preflight.js` verified host/worker exact SHA, health/ready endpoints, audit source, workflow catalogue and Control Hub coverage but **never checked that the owner-visible /operator frontend was served, that its JS/CSS loaded, that the operator read credential could inspect genuine canonical work or that runtime writer credentials were denied operator access**. Consequently a deployment could be declared preflight PASS while the Command Centre was broken or empty.
- Extended the **existing** read-only release preflight with `OPERATOR_BROWSER_SHELL`, `OPERATOR_BROWSER_ASSETS`, `OPERATOR_DEPLOYMENT_IDENTITY`, `OPERATOR_AUTH_ISOLATION` and `OPERATOR_CANONICAL_RECORDS`. Checks require actual HTML dashboard structure, JS/CSS content, exact independent operator process SHA, HTTP 401 for anonymous and runtime-writer-token attempts to read the operator dashboard, and successful read-only operator dashboard load with available client/job/quote departments and at least one identifiable source-derived record. A failed source must never become a false zero-value PASS.
- The preflight reports only metadata, total qualifying core record count, check codes and capability counts; no customer records, credentials, source evidence URLs or amounts are printed. It performs only GET and existing read-only Sheets probe. It is invoked by the already-existing controlled `hostafrica-release.sh` after a separately authorized cPanel deployment, **not** by a new remote deployment mechanism. No current live HostAfrica release, job, quote or money mutated.
- Added tests exercising green health with absent/broken browser shell or assets, stale/missing operator deployment fingerprint, operator token isolation and unavailable/empty canonical business data, in addition to existing running-SHA verification. Candidate branch `codex/magos-frontend-release-acceptance-20261122`; CI/merge and actual cPanel live run pending. This strengthens the **25 November 2026 17:00 SAST** proposed operator pilot gate; it does not claim the pilot is live, or MAGOS whole-business completion.


## 22 November 2026 — Integrated contextual navigation across MAGOS records (candidate)

- Implemented read-only, source-derived cross-workstream links within the **existing** `/operator` Command Centre, aligning with the previously approved Simpro/Aspire/LMN benchmark of one connected business experience. Before this change, operators had to manually search multiple departments to move from a job to its customer, quote, finance, work evidence, variations and labour-cost review. The already available standalone **View job scope variations** button did not solve the broader navigation gap.
- New `processor/operator-crosslinks.js` indexes only explicitly present canonical `crm_id`, `opportunity_id`, `job_id` and `quote_id` fields from existing read-only dashboard projections. No name/telephone/fuzzy matching, no parallel store, no automatic data mutation. It refuses mismatched canonical IDs, duplicate/ambiguous target IDs, unavailable source departments and exception-only attribution records. Each displayed record is linked to up to 30 matching records in other valid workstreams with overflow disclosure.
- `operator-dashboard.js` now exposes the per-record `related` links plus summary `canonical_navigation` metadata, and the existing `operator.js` renders **Related MAGOS work** clickable buttons in record detail. Responsive `operator.css` styles the related controls. From a job, available source-backed links lead to the matching CRM client, quote, payment/finance, field evidence, variation and labour review in the same screen. A missing link is not shown as a confirmed relationship.
- Added standalone unit tests for exact positive matches, conflicting/missing IDs, duplicate target quarantine, unavailable registers and fake names, and integrated real dashboard frontend tests. Included `operator-crosslinks.test.js` in Runtime P2 CI; both historical and current MAGOS status files updated. Candidate `codex/magos-canonical-cross-record-navigation-20261122`; CI/merge and actual hosted browser acceptance pending. No WordPress, ecommerce, client, invoice, job or financial source changes.

- **CI-detected integration issue fixed in same PR:** existing quotes projection listed pending quotes and accepted-without-job only, which hid **accepted quotations already linked to jobs** and declined/historical quotes from the owner frontend. This broke the agreed one-system CRM → quote → job trace. The Quotes department now displays all uniquely identified canonical quote records, including accepted/job-linked and historical, without changing the separate `pending_quotes` KPI or trusting a quote as bank settlement. Added a specific regression test for this behavior.


## 22 November 2026 — Completed-job accessibility and commercial closeout (candidate)

- The current `/operator` Jobs department relied on `projectOperations().records.jobs`, which deliberately returns only **active** jobs. That means historical/completed jobs disappeared from the workspace even though the same record details contain **Inspect full job lifecycle**, actual costs and closeout, warranties, scheduling and final owner-closure inspections. The omission prevents the approved Simpro/Aspire-style field-to-finance closeout workflow from being usable on completed installations.
- Updated `operator-dashboard.js` to keep the **active_jobs** KPI and action queue restricted to active work, while adding uniquely identified, recorded completed/cancelled/historical jobs back to the searchable Jobs workspace from the authoritative `Jobs_Opportunities` sheet. These records preserve exact `opportunity_id`, `job_id`, `client_crm_id`, recorded job status, invoice reference and payment status as *recorded claims*, never inferred clearance. Explicit `Completion evidence status=NOT_INDEPENDENTLY_VERIFIED` remains until separate governing inspections pass. Unconverted opportunities and duplicated/ambiguous IDs remain excluded/quarantined. Adds `jobs_with_recorded_id` metric and a separate **Jobs on record** dashboard indicator.
- Added regression tests proving active KPI stays accurate, completed jobs remain actionable, cancelled history is not counted as active, no phantom job is created, and duplicate historical IDs remain review-only. No business source writes or automatic financial completion.
- **WPVibe read-only inspection:** authenticated WordPress site `https://myriadgreen.co.za` was verified reachable (site_info 22 Nov 2026) with the existing `mgos-quote-acceptance` plugin and Amelia booking plugin installed. WPVibe's WordPress Abilities API currently exposes core and WooCommerce abilities but **does not itself expose a MAGOS Node runtime deployment or end-to-end signed acceptance proof**. Site inspected only; no WordPress/ecommerce settings or content modified. HostAfrica `runtime.myriadgreen.co.za` process SHA and production acceptance remain unverified.
- Branch `codex/magos-completed-job-closeout-workspace-20261122` — CI/merge pending. Neither the 22 Control Hub capabilities nor 16 whole-system acceptance gates are promoted to PASS by this source and frontend change.


## 22 November 2026 — Real-world job status and active pipeline correction (candidate)

- **Read-only verified live CRM evidence:** `Jobs_Opportunities` in canonical Myriad Green Outreach CRM contains actual job status values including `JOB_COMPLETED` (13 rows), `JOB_COMPLETED_CLOSED` (1), `JOB_IN_PROGRESS` (4), `JOB_BOOKED` (5), `AWAITING_MATERIALS` (1), `ASSESSMENT_NEEDED`, `NO_JOB`, `CALL_OUT_NEEDED` and pre-quotation states. In inspected records, **two `NO_JOB` and one `ASSESSMENT_NEEDED` rows nevertheless carry a job ID**. The previous active-job rule only excluded a short terminal-status list, so it incorrectly treated `JOB_COMPLETED_CLOSED` and pre-job/ambiguous states with an ID as active work. The 93-row bounded source inspection was read-only; no CRM writes occurred.
- Added `processor/job-status-classification.js` to define supported active, historical and pre-job statuses from actual canonical source vocabulary. `projectOperations` active-job KPI now counts only uniquely identified records with a job ID and a supported active state. `JOB_COMPLETED_CLOSED` stays historical; `NO_JOB`, `ASSESSMENT_NEEDED`, `CALL_OUT_NEEDED`, empty/unknown status with job ID are flagged for review, never silently counted active. Existing dashboard preserves recorded historical jobs for post-service closeout/aftercare and provides **Job status conflicts** KPI plus actionable `JOB_STATUS_REVIEW` queue entries for contradictions.
- This read-only classification does NOT assert independent deposit clearance, job authorization, completed commissioning, invoicing, profit or field evidence. Source status remains displayed verbatim in separate details when review-required. No new record store or client changes.
- Added unit regression for observed status vocabulary, contradictory ID/state, duplicate-ID quarantine, no-source behavior and integrated operator dashboard; wired into existing Runtime P2 CI. Candidate branch `codex/magos-job-lifecycle-kpi-integrity-20261122`. CI/merge and HostAfrica deployed running SHA must be independently checked before PASS in those respective layers.


## 22 November 2026 — End-to-end signed quote acceptance wired into job lifecycle (candidate)

- **Concrete business-integrity gap identified:** `processor/job-lifecycle.js` returned `ACCEPTED_QUOTE=PASS` from recorded commercial quote status, line control and matching scope, while the integrated `/v1/operator/job-lifecycle/:jobId` endpoint did not invoke the existing trusted WordPress signed-acceptance verifier. A recorded `ACCEPTED` quote was therefore visible as an apparently passed quote stage without separate client-signature verification.
- The integrated lifecycle inspector now calls the **existing** `verifySignedAcceptance` when the canonical quote and accepted scope line up. It creates a separate `CLIENT_SIGNED_ACCEPTANCE` stage: **REVIEW_REQUIRED** when the trusted provider is unavailable, signed data is missing, the quote/opportunity identity conflicts or the accepted scope is invalid; **EVIDENCED_ONLY** when independent signature evidence passes, still awaiting separate owner and financial authorization. The output includes verified source event and evidence reference only for a verified signature, never invented signer/approval. Invoice/payment/job release actions remain unchanged.
- The existing `runtime/app.js` job-lifecycle handler now injects `getSignedAcceptanceVerifier()`, the **same WordPress canonical-source verification provider already used by `job-activation` and governed acceptance**. No duplicate acceptance service, new database, WordPress update or client data write. Provider failures do not promote job acceptance. `signed-acceptance-verification.js` now carries provider-returned `quote_version` metadata and exposes `quote_version_verified=true` **only** when the approved `WP_VERIFIED_SIGNED_RECEIPT_AND_CANONICAL_COMMERCIAL_MATCH` attestation supplies a nonempty version. The WordPress verifier already compares exact current `Quote_Lines` version, issued PDF, provider receipt, signer, independent reviewer and signed receipt, but deployed WordPress support still requires independent acceptance verification.
- Regression tests now cover recorded ACCEPTED without signature, mismatched version/scope or quote, trusted and untrusted version claims, provider downtime, endpoint read-only authentication and exact provider injection, and independence from banking/owner closeout. Candidate `codex/magos-lifecycle-signed-acceptance-gate-20261122`: CI and merge pending; hosted runtime and real signed receipt still NOT VERIFIED. Existing MAGOS release and whole-business gates remain unpromoted.


## 22 November 2026 — Live customer signing dependency diagnostics (candidate)

- **New live authoritative WPVibe verification**: `myriadgreen.co.za` WordPress `mgos-quote-acceptance` is active version **0.3.2** (owner test bridge); a direct read-only GET of `/mgos/v1/quote-acceptance/verify-v2` returned WordPress `rest_no_route` HTTP **404**. The WordPress REST namespace `mgos/v1` is registered, but this separate reviewed-client-signature route is not. The existing `Accept & Sign Quotation` page WordPress ID `9481` was confirmed `draft` by WP-CLI. **Real client signing cannot be called live or accepted; WordPress signing companion `magos/wordpress/mgos-reviewed-client-signature.php` is source-coded/tested but NOT installed.** Do not publish the draft or issue customer links before the companion is installed and positive/negative staging acceptance checks pass. No live WordPress records changed during this inspection.
- Extended the existing `signed-quote-link.js` contract with `inspectSigningReadiness()` returning two independent structured checks: `CLIENT_SIGNING_PAGE` and `INDEPENDENT_SIGNATURE_BRIDGE`. It reports BLOCKED with specific reasons for missing published page and unregistered `verify-v2` independently, rather than a single generic false. A successful route/page combination is **READY_FOR_CONTROLLED_SIGNING_TEST**, not signed-receipt acceptance, customer-link authorization, bank clearance or job creation. Existing `inspectSigningPage()` boolean and `issueSignedQuoteLink()` fail-closed source interfaces remain compatible.
- Added authenticated read-only `GET /v1/operator/client-signing-readiness`, **separate operator credential** and no writer invocation. Quotes record detail now includes **Check client signing readiness** with next blockers shown from the actual WordPress source. No runtime token, WordPress bearer secret, customer data or signature ever returned by the diagnostic. Negative and positive tests cover both prerequisites, authenticated HTTP isolation, no writer calls and frontend action. Source branch `codex/magos-wordpress-client-signing-readiness-20261122`, CI and merge pending.
- This improves the linked MAGOS → WordPress signing interface observability. It does **not** deploy the reviewed companion WordPress plugin, publish the signing page, verify a client signature, or validate a hosted Node runtime. Those are still live acceptance blockers.


## 24 November 2026 — Water Intelligence / Alert Publisher candidate

- Added `magos/content/water-alert-publisher.js` and `magos/rules/water-alert-publisher.v1.json` for deterministic municipal-water notice normalization, exact official-source verification, immutable source-event dedupe, content fingerprinting and `ACTIVE / RECENT / HISTORICAL` lifecycle.
- Added authenticated read-only `POST /v1/content/water-alert/plan`. It performs no WordPress mutation and returns `publishing_performed:false`.
- The planner maps area pages only from exact **published** site-index matches; it never invents a suburb URL. It carries Myriad Green outage/backup-water, pump, irrigation and shop link policy plus SEO/AEO/GEO requirements.
- Added unit and runtime endpoint regression tests and dedicated [MAGOS-WATER-ALERT-PUBLISHER-V1.md](MAGOS-WATER-ALERT-PUBLISHER-V1.md).
- **Current state:** CODED on `codex/magos-water-alert-publisher-20261124`; PR #99 MAGOS Runtime P2, Document Extract and Evolving Status Gate passed on the reviewed implementation head. WordPress publisher adapter, live create/update read-back, same-source replay, sitemap verification, rollback and HOSTAFRICA deployment are **NOT VALIDATED**.
- The module is intentionally not in the governed write workflow catalogue yet. A read-only planning endpoint is not publication authority.

**Next gate:** implement a separately authenticated WordPress publisher adapter and prove one controlled official City of Tshwane notice through create/update → public read-back → Rank Math/schema → sitemap → identical replay with no duplicate.


### 24 November 2026 — Water intelligence discovery expansion

- The Water Alert Publisher condition-watch now uses two evidence lanes.
- **Official lane:** verified official municipal/Rand Water notices may become Local Water Alerts Journal create/update actions under the publication rules.
- **Discovery lane:** credible local news, community publications, municipal reporting and public social signals may identify an event, but remain verification-only until an official source corroborates the facts.
- Secondary-only reports must remain `REVIEW_REQUIRED`; they do not authorize a public post.
- This expands detection coverage without weakening source provenance or duplicate controls.


## 24 November 2026 — Water Alert WordPress publisher candidate

- Water Intelligence / Alert Publisher V1 planner from PR #99 is merged into `main` at `d0320a06338b61a6e1ee87a0aead937d6c0aff38`.
- New candidate branch `codex/magos-water-alert-wordpress-publisher-20261124` adds a dedicated WordPress companion plugin and Node publisher adapter.
- The WordPress boundary is idempotent by immutable source key + content fingerprint: CREATE_NEW, UPDATE_EXISTING or DUPLICATE_NO_OP. Duplicate source-key ambiguity blocks.
- The runtime publication endpoint uses a separate credential and re-verifies official source + ACTIVE lifecycle. Caller-supplied ready/verified flags, existing-post claims and area-index claims are not publication authority.
- Public acceptance requires canonical REST read-back, live HTML provenance markers, FAQ schema and Rank Math post-sitemap inclusion.
- Live WordPress taxonomy was checked before coding: category `local-water-alerts`; tags `tshwane-water`, `johannesburg-water`, `water-tankers`, `water-interruption`, `backup-water`, `booster-pumps`, `jojo-tanks`, `low-water-pressure` exist.
- A dedicated CI workflow packages only the reviewed PHP + CSS into a reproducible ZIP with SHA-256.

**Truth:** source implementation is a candidate until exact-head CI passes. The plugin is not yet installed live; no HOSTAFRICA runtime deployment or unattended WordPress publish has been validated from this code path.


### Water Alert Publisher merge evidence

- PR #100 merged into `main` at `96562c1ab2eda4ea983eced2a9e754edc508f5f8`; exact PR head `7a575f8c3a534856a8acefae422a34d0326b9746` passed all five relevant GitHub workflows.
- Reproducible WordPress plugin artifact was produced and checksummed.
- Live deployment remains **BLOCKED / NOT VALIDATED** because the connected WPVibe plugin installer accepts repository slugs only and cannot upload this private GitHub ZIP artifact. Do not substitute a theme/snippet hack for the reviewed plugin boundary.


## HOSTAFRICA resource-limited regression testing — 24 November 2026
On exact candidate 78c351f4fe47370d9bdb0799dedfedd0a7d2554c, the default concurrent suite reported 614 pass / 5 fail (four SIGKILL file processes and one temporary local Git fixture assertion). Sequential rerun of all five affected files returned exit 0, 30 pass / 0 fail. Resource contention is strongly suggested, not independently proven. Actual origin/main access passed. On shared HOSTAFRICA use `npm run test:hostafrica` (Node test concurrency 1) in an isolated candidate checkout, with test-only configuration and no live business writes. Require a complete clean run, exact candidate SHA, retained log and exit 0 before approving deployment; a targeted retest does not replace the full suite. Do not upgrade npm or contact support solely for the initial failures. Full sequential suite, branch reconciliation, backup and live deployment remain pending. Production 88576e4595186e73259d5e4f32d2940ac8b4a569 preserved in verified local backup/magos-production-20261124; divergence 119/90. No production checkout or worker change. This named command is not yet a mechanically enforced release gate; PR review and exact-head tests pending.


## Production branch reconciliation — 24 November 2026
User-reported full sequential host test on pinned main 78c351f4fe47370d9bdb0799dedfedd0a7d2554c: 640 tests, 640 pass, zero fail/cancelled. This applies only to that candidate, not subsequent PR changes. Compared literal Express method/path declarations against production 88576e4595186e73259d5e4f32d2940ac8b4a569: no old literal routes missing; 24 added. Lead and supplier email adapters byte-identical. The old procurement approval HTTP regression file was absent on main despite the route remaining; restored its six tests unchanged from production in this PR to prevent regression of approval authority, generic-write denial and non-dispatch. Exact new PR-head CI and full semantic reconciliation remain pending. Old release-acceptance command was superseded in architecture by preflight and whole-system acceptance, but parity of all old checks is not yet certified. No live checkout or worker change. Verified local rollback branch points to original production SHA; not a full host backup.


## HISTORICAL — hosted deployment incident, 24 November 2026 (resolved by PR #104)
Exact merged candidate 4a559cfd777e65a2b797ee5b1ad6d50888d88522 passed 646/646 sequential cPanel tests (exit 0). Private application archive gzip integrity passed; original Git rollback reference retained. Deployment switched checkout and requested scoped worker recycle. Live preflight passed 10/13 checks including health, readiness, audit source, dashboard authentication isolation and 129 core records; failed running worker identity, operator deployment identity and canonical coverage. Operator restored original declaration and checkout 88576e4595186e73259d5e4f32d2940ac8b4a569, recycled worker, health returned P5 ok. Read-only diagnosis using worker PATH reproduced legacy Git rejecting -C; use child-process cwd instead, retaining exact SHA and clean tracked checkout attestation. Control Hub connector independently verified all required headers and 22 distinct valid capability IDs; hosted service-account read returned HTTP 403. Actual denial reason/identity and minimum read permission must be confirmed, not inferred or bypassed. No change to capability records. Water Alert Publisher remains installed/authenticated but live runtime integration blocked. No further production deployment until both host prerequisites pass. New correction CI and exact release validation pending.


## Resume checkpoint — 25 November 2026 — Water Alert Publisher
**PARTIAL: live engine operational; unattended publishing not accepted.** Production runtime pinned at `b5e73575e092ef6abf39842e3ffb9ff44a45084e`; owner reported 647/647 tests and 13/13 preflight checks PASS. Post 10622 created, public readback PASS; after Rank Math save (201 links) and LiteSpeed purge, sitemap PASS; exact replay `DUPLICATE_NO_OP`, same ID, verified/public/sitemap/FAQ all true. Evidence: [deployment register](MAGOS-WORDPRESS-PLUGIN-DEPLOYMENT-REGISTER.md), commit `0c417e8004b128a0700ccc7a3225c5a3e42808b8`. Do not repeat passed tests, recreate post, rotate credentials or redeploy solely for docs.
Resume in order: (1) inspect existing publisher and Rank Math/LiteSpeed integration; implement targeted sitemap invalidation and bounded verification, no routine global purge; test before deployment. (2) independently verify official notice content, not only domain; test legitimate same-source revision without fabricated public information. (3) connect existing Water Alert Publisher schedule securely to approved MAGOS route; no secrets in prompts/Git; prove unattended execution and safe failure reporting. (4) record acceptance in current/history/register. Reader-facing article copy and journal frontend UX/UI are deferred separate workstreams. No manual action tonight. Full business acceptance remains unverified.


## 26 November 2026 — engineering package 2 reconciled
PR #109 merged at d502ead9070e4f34b6d0692131e800a3e57a542d. PR #110 exact head 30994ff0e0ca2670758ddd0c92b3b70fc05de031 passed six CI workflows; regression run 45778845421 generated artifact 15097666515 (metadata verified, content not independently downloaded). Merge rejected due to concurrent changes. Reconciled six workflow files onto main 0341c0ae86f180b295cf828e1ee5afefb0c04292 after confirming original base and current main blob equality for each. Preserved current documentation and appended this receipt. Runner action modernization and TAP retention require fresh integrated CI before merge. Git exit 128 cause, reproducible dependencies, security and CORE-003 remain pending. No production deployment or business acceptance claimed.


## 26 November 2026 — CORE-003 synthetic lead golden path candidate
Engineering package 2 PR #112 merged at b875d40419180d26c5da232f1580b40bc4780442 after six CI checks passed; regression artifact 15104589315 metadata verified; PR #110 closed as superseded. New integration tests in transaction-writer.test.js connect actual lead processor, planner and P3 transaction writer with isolated in-memory storage and identity lookup. Assert canonical intake/client/opportunity linkage, readback, audit state, exact replay no-op, and authority rejection. Fixture schema is synthetic, not live schema verification. Candidate commit ca50e1d189f3bcbca5d0d249ac0ff6cbbd05d94c awaits exact-head CI. CORE-003 remains PARTIAL pending deployed canonical business write/readback/replay; no production data or real transactions changed. Continue independent engineering work without bypassing release gates.


## 26 November 2026 — operator refresh consistency candidate
PR #113 merged at 373b22ccaea84fcb4e0c92245f4fe491e9a842ca after four CI checks passed; synthetic lead-to-writer integration accepted in CI, live CORE-003 still PARTIAL. Frontend candidate invalidates cached capability coverage after successful dashboard refresh, reloads selected capability workspace, and cancels superseded deployment identity requests on refresh/lock to avoid stale responses. Added two source-level regression assertions. Exact-head CI, native browser interaction and deployed UI readback remain pending. No new dashboard, no production change or business mutation.
