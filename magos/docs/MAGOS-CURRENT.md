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
