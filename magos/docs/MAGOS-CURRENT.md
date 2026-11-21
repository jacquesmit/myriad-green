# MAGOS — Current Engineering State

> **Authoritative current index.** Read this file **first**, then [MAGOS-STATUS.md](MAGOS-STATUS.md) for append-only engineering history, the relevant subsystem runbook, source code, CI, and live sources. Previous decisions stay discoverable. A historic claim never overrides newer verified source evidence. Never claim deployment or customer transaction acceptance from a GitHub merge.

**As-of:** 2026-11-21 (Africa/Johannesburg)  
**System:** MAGOS — the existing whole-business Myriad Green operating system, not a new product or collection of renamed agents.  
**Repository:** [jacquesmit/myriad-green](https://github.com/jacquesmit/myriad-green)  
**Production:** `https://runtime.myriadgreen.co.za` — Node worker deploy SHA **NOT VERIFIED** against current `main`.

## One truth table

| Capability / layer | Implemented | Automated tests | Production validated | Precise state |
| --- | --- | --- | --- | --- |
| MAGOS Node runtime and Command Centre | YES | PASS in GitHub CI | NOT VERIFIED at current SHA | PARTIAL |
| Canonical CRM/lead intake, quotations, job lifecycle and workflow routing | CODE EXISTS | TESTED paths | Golden end-to-end NOT VERIFIED | PARTIAL |
| Governed P3 writer and audit/ownership controls | YES | TESTED paths | Live new-action readback NOT VERIFIED | PARTIAL |
| WordPress reviewed quote signing / acceptance | GitHub candidate + verifier | Node/PHP CI tested | Companion plugin NOT DEPLOYED; WP signing page 9481 DRAFT | FAIL for production |
| Procurement and supplier approval | Governed stages, read-only and protected write paths | TESTED paths | Independent approval/provider acceptance incomplete | PARTIAL |
| Supplier `Cost_Allocations`, invoice/GRN/stock checks and expense controls | Code merged, [#50–#55](https://github.com/jacquesmit/myriad-green/pulls?q=is%3Apr+is%3Amerged) | PASS on reviewed commits | Exact independent invoice/stock authority and live write unverified | PARTIAL |
| Receivables, completion, costs, field evidence and aftercare inspection | Code exists, protected inspections | TESTED paths | Final closeout and bank/provider acceptance incomplete | PARTIAL |
| WooCommerce ecommerce / System Builder | Separate in-progress website work | Partial evidence | Full payment/shipping/tax and product hydraulic acceptance pending | PARTIAL / NOT READY |
| HOSTAFRICA worker identification and release preflight | SHA attestation coded [#54](https://github.com/jacquesmit/myriad-green/pull/54) | PASS in CI | Worker deployment / release fingerprint NOT VERIFIED | BLOCKED |
| Continuous documentation / status reconciliation | PR candidate for status gate | Gate tests pending | Required GitHub branch protection NOT VERIFIED | PENDING |

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
