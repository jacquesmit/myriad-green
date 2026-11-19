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
