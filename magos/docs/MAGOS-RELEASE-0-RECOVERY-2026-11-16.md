# MAGOS Release 0 — Recovery and Production Baseline Control

**Date:** 2026-11-16 (Africa/Johannesburg)  
**Scope:** Existing MAGOS Node.js application only  
**Status:** IN PROGRESS — production release NOT authorised  
**Change policy:** Documentation/read-only verification only. No production deploy, production business writes, WordPress/shop changes or source-of-truth migration.

## 1. Owner decision

Continue coding the existing MAGOS application. Consolidate business operating rules; make the existing `/operator` dashboard usable; only then extend business automation, WPVibe integrations and MCP. Do not create a second operational database or rebuild the app in WordPress.

## 2. Verified GitHub checkpoint

| Item | Observed evidence | State |
| --- | --- | --- |
| Code repository | `jacquesmit/myriad-green`, `magos/` | PASS — exists |
| Main branch SHA | `cfb3124149df0dbed26daf083fd47e091aa8c42b` | Observed 2026-11-16 |
| MAGOS development branch | `codex/magos-production-intake-20261107`, SHA `88576e4595186e73259d5e4f32d2940ac8b4a569` | Observed 2026-11-16 |
| Branch comparison | Development ahead 119 commits, behind 7 relative to `main`; divergent history; 57 files reported as changed | BLOCKED — reconcile, not blind merge |
| Dashboard PR | #38 merged 2026-11-10 into *development* branch, NOT main | PASS — merged to development |
| Dashboard branch CI | Three MAGOS GitHub Actions workflow runs completed successfully at `eb2ee578a6f4fb7d302a5312d0d347a65744c0c5` on 2026-11-10 | PASS — historical GitHub CI, not production |
| Operator dashboard code | `magos/runtime/operator-page.js`, `operator.js`, `operator.css`, `processor/operator-dashboard.js` on development | PASS — code exists |
| Release acceptance code | `magos/runtime/release-acceptance.js`; `npm run verify:release` | PASS — script exists; current execution not verified |
| Current hosted release SHA | cPanel runbook historically lists `5b29a34` | UNKNOWN — host read-back required |
| Runtime credentialed probes | Historical runbook reports PASS on 2026-11-10 | Historical only; fresh probe TO_CONFIRM |
| Live dashboard read parity | No current per-record authenticated reconciliation evidence | BLOCKED |
| Production business-write acceptance | Release script intentionally leaves `P3_PRODUCTION_JOB_COMMIT` BLOCKED absent controlled read-back | BLOCKED |

Source references:
- [Production runbook](docs/CPANEL-PASSENGER-DEPLOY.md)
- [Operator dashboard](docs/MAGOS-OPERATOR-DASHBOARD.md)
- [Earlier recovery checkpoint](../MAGOS_CURRENT_CHECKPOINT.md)
- [Dashboard PR #38](https://github.com/jacquesmit/myriad-green/pull/38)
- [Development versus main](https://github.com/jacquesmit/myriad-green/compare/main...codex/magos-production-intake-20261107)

## 3. Release 0 exact execution sequence

### Gate R0-A: Establish deployed checkout — BLOCKED pending host evidence

Use cPanel Terminal on HOSTAFRICA, with NO modifications:

```bash
git -C /home/myriaauq/repositories/myriad-green status --short --branch --untracked-files=no
git -C /home/myriaauq/repositories/myriad-green log -1 --format='%H %s'
```

Record full SHA, branch, worktree status, app root, startup file and Node version. Compare SHA to GitHub commit. Do not infer deployed SHA from `/healthz` `P5` label: this is a runtime version, not commit identity.

### Gate R0-B: Read-only hosted probe — BLOCKED pending authenticated host access

Follow `magos/docs/CPANEL-PASSENGER-DEPLOY.md` to activate the actual hosted Node environment; use `node runtime/smoke.js`. Record individual `/healthz`, `/readyz`, and protected Google Sheets and audit-store probe results. Keep all tokens private. Never paste secrets into GitHub, logs or chat.

### Gate R0-C: Complete test and release-acceptance evidence — TO_CONFIRM

From the *confirmed* intended checked-out release:

```bash
cd /home/myriaauq/repositories/myriad-green/magos
npm test
npm run verify:release
```

The second script performs network read-only checks, and deliberately returns a nonzero exit when business release gates remain BLOCKED. Report platform and business gate results separately. Do not misclassify an intentional business BLOCKED as a failed code test. Verify any missing dependencies and exact runtime configuration before running.

### Gate R0-D: Controlled branch reconciliation — BLOCKED until R0-A and test outcome

Compare actual deployed SHA with development `88576e4` and main `cfb3124`. Review 7 behind commits and the 119 ahead, especially runtime entrypoints, governance routes, authentication, schema/authority contracts, dashboard UI and worktree-specific changes. Preserve both branches and create a reviewed, testable release candidate; no forced merge or direct production push. Require code review, passing CI, matching audit/checkpoint notes and a rollback SHA.

### Gate R0-E: Dashboard real-record read acceptance — BLOCKED

After release candidate is approved, verify:
1. `/operator` renders and same-origin JS/CSS load;
2. `/v1/operator/dashboard` rejects unauthenticated reads, dedicated `MAGOS_OPERATOR_READ_TOKEN` works without transaction permissions;
3. each of leads, clients, quotes, jobs, bookings, payments, allocations, procurement, suppliers, work evidence, and exceptions shows a genuine canonical source record with exact ID and source link;
4. duplicate/ambiguous IDs are excluded from trusted counts, source failures show unavailable, stale timestamps are visible;
5. payment proof is visibly separate from cleared funds;
6. Lock clears loaded data and Refresh updates checked time;
7. evidence is recorded in `Audit_Tests`.

Do not claim live dashboard PASS from HTML or a browser screenshot alone.

### Gate R0-F: Release authorisation — BLOCKED

Only approve a release when SHA, rollback, code CI, hosted probes and dashboard read parity are all PASS. **Business automation and client-record writes remain separate controlled acceptance phases.**

## 4. Next build after R0

1. Normalise systems register and exact writer ownership; no shadow database.
2. Separate raw scraper prospect staging from operational `CRM_Master`, preserving IDs and attribution.
3. Validate CRM lead ingestion and dedupe from actual approved channels.
4. Validate quote acceptance, cleared payments, exact job creation and production read-back.
5. Validate procurement, supplier approvals, payment allocation and SOP-driven workflow gates.
6. Connect existing WordPress/Fluent Forms/MGOS/WooCommerce interfaces via WPVibe only after documented contracts and approval; ecommerce programme remains paused.
7. Offer read-only MCP tools after authenticated record access passes.
8. Run final end-to-end lead-to-cash, role security, restore and legacy parity acceptance.

## 5. Status semantics

- **IMPLEMENTED:** code or configuration exists.
- **TESTED:** automated test evidence passes for named SHA.
- **DEPLOYED:** host explicitly confirms SHA on running worker.
- **VALIDATED:** independent production record/permission read-back passes.
- **OPERATIONAL:** workflow meets its business acceptance cases and monitoring/recovery requirements.
- **UNKNOWN/TO_CONFIRM/BLOCKED:** never silently convert to PASS.

## 6. Exactly one next action

**Obtain the actual cPanel deployed Git SHA and worktree branch, then reconcile that precise baseline with the GitHub development branch before a deployment.**
