# MAGOS — Current Engineering State

> **Authoritative current index.** Read this file **first**, then [MAGOS-STATUS.md](MAGOS-STATUS.md) for append-only engineering history, the relevant subsystem runbook, source code, CI, and live sources. Previous decisions stay discoverable. A historic claim never overrides newer verified source evidence. Never claim deployment or customer transaction acceptance from a GitHub merge.

**As-of:** 2026-11-21 (Africa/Johannesburg); live WordPress rechecked after PR #56  
**System:** MAGOS — the existing whole-business Myriad Green operating system, not a new product or collection of renamed agents.  
**Repository:** [jacquesmit/myriad-green](https://github.com/jacquesmit/myriad-green)  
**Production:** `https://runtime.myriadgreen.co.za` — Node worker deploy SHA **NOT VERIFIED** against current `main`; public health/ready URLs were inaccessible via available read-only tool on 2026-11-21, not proof of outage.

## One truth table

| Capability / layer | Implemented | Automated tests | Production validated | Precise state |
| --- | --- | --- | --- | --- |
| MAGOS Node runtime and Command Centre | YES | PASS in GitHub CI | NOT VERIFIED at current SHA | PARTIAL |
| Canonical CRM/lead intake, quotations, job lifecycle and workflow routing | CODE EXISTS | TESTED paths | Golden end-to-end NOT VERIFIED | PARTIAL |
| Governed P3 writer and audit/ownership controls | YES | TESTED paths | Live new-action readback NOT VERIFIED | PARTIAL |
| WordPress reviewed quote signing / acceptance | GitHub candidate + verifier; quote-line version race preconditions staged for review | Node/PHP CI tested; newest race regression CI PENDING | Live WPVibe checked 2026-11-21: companion `verify-v2` route MISSING, page 9481 DRAFT | FAIL for production |
| Procurement and supplier approval | Governed stages, read-only and protected write paths | TESTED paths | Independent approval/provider acceptance incomplete | PARTIAL |
| Supplier `Cost_Allocations`, invoice/GRN/stock checks and expense controls | Code merged, [#50–#55](https://github.com/jacquesmit/myriad-green/pulls?q=is%3Apr+is%3Amerged) | PASS on reviewed commits | Exact independent invoice/stock authority and live write unverified | PARTIAL |
| Receivables, completion, costs, field evidence and aftercare inspection | Code exists, protected inspections | TESTED paths | Final closeout and bank/provider acceptance incomplete | PARTIAL |
| WooCommerce ecommerce / System Builder | Separate in-progress website work | Partial evidence | Full payment/shipping/tax and product hydraulic acceptance pending | PARTIAL / NOT READY |
| HOSTAFRICA worker identification and release preflight | SHA attestation coded [#54](https://github.com/jacquesmit/myriad-green/pull/54) | PASS in CI | Worker deployment / release fingerprint NOT VERIFIED | BLOCKED |
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

1. Verify HOSTAFRICA host checkout, running worker and `/v1/runtime/build` identity; deploy approved, tested source safely with backup/rollback and independently confirm loaded SHA. **Not done.**
2. Install and test the new reviewed WordPress signature companion and client page with controlled signed-quote acceptance, exact issued version/PDF and cleared funds before any job creation. **Not done.**
3. Bind real approved invoice and physical stock attestations to supplier-cost workflow; perform one controlled P3 cost write/readback and duplicate replay. **Not done.**
4. Finish golden journeys for intake → CRM → quote → signed acceptance → cleared payment → job → procurement → field evidence → invoice → reconciliation → warranty/aftercare, then web shop purchase-to-fulfilment separately. **Not done.**

**Release rule:** code PASS ≠ production PASS. `UNKNOWN` is never `YES`.

## Latest verified delivery / next gate

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
