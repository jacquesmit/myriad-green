# MAGOS production runtime on cPanel

> **CURRENT RELEASE — 25 November 2026:** production exact SHA `b5e73575e092ef6abf39842e3ffb9ff44a45084e` (PR #104), Node 20.20.2, 647/647 sequential tests and 13/13 live preflight PASS (owner Terminal evidence). Older blocked and pending release entries are historical. See [MAGOS-CURRENT.md](MAGOS-CURRENT.md) first. No repeat deployment/credential setup solely to reconcile documentation.

Use this runbook for `runtime.myriadgreen.co.za`. The settings and authenticated
probe below were verified in cPanel Terminal on **10 November 2026 (SAST)**.
The [DirectAdmin guide](DIRECTADMIN-NODE20-DEPLOY.md) is historical for this domain.

| Setting | Last verified value |
| --- | --- |
| Host and control panel | HOSTAFRICA `cpr52`, cPanel → Node.js (CloudLinux), Production |
| Runtime URL | `https://runtime.myriadgreen.co.za` |
| Application root | `/home/myriaauq/repositories/myriad-green/magos` |
| Startup file | `app.js` |
| Node.js | `20.20.2` as displayed in cPanel |
| Node.js activation file | `$HOME/nodevenv/repositories/myriad-green/magos/20/bin/activate` |
| Last verified deployed checkout | Tested main release [`b5e73575`](https://github.com/jacquesmit/myriad-green/commit/b5e73575e092ef6abf39842e3ffb9ff44a45084e) |
| Runtime version returned by health endpoint | `P5` |

Check the branch, commit, and tracked worktree before changing a deployment.
The public `P5` label is a runtime version, so identify the deployed release
using the host checkout and a route specific to that release.

```bash
git -C /home/myriaauq/repositories/myriad-green status --short --branch --untracked-files=no
git -C /home/myriaauq/repositories/myriad-green log -1 --format='%H %s'
```

## Read-only hosted Google Sheets probe

Run this exact block in **cPanel → Terminal**. It activates the app's verified
Node.js environment and calls the repository smoke script directly.

```bash
(
  cd /home/myriaauq/repositories/myriad-green/magos || exit 1
  magos_activate="$HOME/nodevenv/repositories/myriad-green/magos/20/bin/activate"
  if [ ! -r "$magos_activate" ]; then
    echo "MAGOS Node.js 20 activation file not found"
    exit 1
  fi
  source "$magos_activate" || exit 1
  MAGOS_RUNTIME_URL=https://runtime.myriadgreen.co.za node runtime/smoke.js
)
```

The smoke script calls `/healthz`, `/readyz`, and the authenticated
`POST /v1/probes/google-sheets`. The protected request uses
`Authorization: Bearer` with the existing `MAGOS_RUNTIME_TOKEN`, loaded from
the process environment or the app's private `.env` by the script. Keep the
value in private host configuration and share only the probe output. Supplier
email and lead ingress use separate credentials.

| Output | Meaning and next check |
| --- | --- |
| Plain Terminal says `npm: command not found` | Run the activation block above. It invokes `node` directly. |
| Activation file missing | Recheck the Node.js app's configured root and version in cPanel and confirm its activation command before proceeding. |
| `MAGOS_RUNTIME_TOKEN is required` | The shell process cannot read the runtime token. Check the configured variable by name and the private app environment. |
| Probe returns `401 UNAUTHORIZED` | Authentication failed before Sheets was checked. Use the verified block above. If it still returns 401, verify the credential source and bearer header forwarding before changing any secret. |
| Probe returns `503` with Sheets unreachable | Authentication passed. Check the runtime's Google credential configuration and access to the audit workbook. |
| `google_sheets: reachable` and `audit_store: reachable` | **PASS** for the read-only live connectivity check. |

## If a new route still returns Express 404 after deployment

First verify the expected route is in the host checkout. If cPanel stop/start
controls the public domain but a newly deployed route still returns Express
`404`, ask HOSTAFRICA to verify the running worker's root and startup file and
recycle the lingering `lsnode` worker for this app. In the November incident,
HOSTAFRICA cleared two old workers and the supplier-email route changed from
Express `404` to `503 MAGOS_SUPPLIER_EMAIL_INGRESS_NOT_CONFIGURED`. The previous
incident reference is **#9342462**.

## Last verified acceptance status

| Gate | Evidence |
| --- | --- |
| Hosted runtime deployment | **PASS**. HOSTAFRICA verified the cPanel worker root and startup file. The supplier-email route responded with the expected disabled-route code. |
| Authenticated Google Sheets and audit-store connectivity | **PASS**, 10 November 2026. The operator's cPanel smoke output showed runtime `P5`, `auth_configured: true`, and both stores `reachable`. |
| Controlled supplier-email write, read-back and replay | **PENDING**. In a controlled test window, submit one evidence-backed event through the restricted supplier endpoint. Read back one matching `Intake_Queue` row and its audit record, then replay the same provider message ID and verify the row count stays at one. Follow the [supplier-email acceptance cases](MAGOS-P5Q-SUPPLIER-EMAIL-INTAKE-V1.md) before connecting a live mailbox collector. |


## Whole MAGOS integration candidate — 21 November 2026 (NOT DEPLOYED)

The operator dashboard, whole-business capability view and workflow endpoints were implemented on the feature branch `codex/magos-agent-orchestration-v1-20261121` and assembled as PR #41. **The hosted checkout is not confirmed to match this PR.** Do not treat historical `P5` /healthz as a commit SHA.

Safe verification sequence after reviewed merge and authorization:

1. Capture current host `git status --short --branch`, full `git rev-parse HEAD`, runtime Node version and existing environment names (never disclose values).
2. Capture host rollback SHA before deployment. Verify all selected GitHub CI jobs PASS on the exact candidate SHA.
3. Configure a **new distinct** `MAGOS_OPERATOR_READ_TOKEN` privately; do not reuse `MAGOS_RUNTIME_TOKEN` or any ingress secret. Read-only operator access should not be sufficient to invoke writer endpoints.
4. Verify `GET /operator` is a shell with zero customer data, `/operator.js` and `/operator.css` load, and `GET /v1/operator/dashboard` and `GET /v1/operator/coverage` return 401 without the proper header. Then authenticate with `X-MAGOS-Operator-Token`.
5. Verify each whole-business Command Centre department shows a genuine canonical record or explicit UNAVAILABLE, including finance allocations versus proof. `Whole MAGOS build` must reflect original Control Hub FAIL and PARTIAL states. Do not accept an all-PASS screenshot lacking source evidence.
6. The quotation-readiness and activation buttons must return real read-only inspection output, and MUST NOT change client status, money, booking or procurement. A missing independent signed-acceptance verifier must return review, never automatic clearance.
7. Only after data and auth parity, run the existing governed EventEnvelope test event and same-idempotency replay under controlled test identities. Record exact writer/evidence receipt and independent read-back in Audit_Tests.
8. If errors appear, roll back to the captured SHA and recycle only the targeted MAGOS lsnode worker per the previously hosting-verified process. Never kill unrelated workers.
9. Keep existing source adapters and customer-facing operations in place until parity is independently demonstrated. **Do not promote the browser shell or CI passing to whole MAGOS COMPLETE.**

The operator UI does not itself launch an additional database or payment authority. The existing CRM, Commercial, Supplier, Global Audit and Control Hub registers remain the authoritative business data.


## Verified-build release preflight (21 November 2026)

Use the full commit SHA of the **approved and CI-tested** GitHub release. Do NOT substitute the current host SHA as the expected value: the comparison must be independently anchored to GitHub.

After an authorized deployment, set `MAGOS_DEPLOY_COMMIT_SHA` to that exact SHA in the private Node application environment **before recycling the MAGOS worker**. The authenticated `GET /v1/runtime/build` endpoint reports the value captured when the worker started. An old worker that has not received the new configuration must fail identity verification. A healthy `/healthz` does not prove the deployed commit.

In cPanel Terminal, using the already verified MAGOS Node environment:

```bash
(
  cd /home/myriaauq/repositories/myriad-green/magos || exit 1
  source "$HOME/nodevenv/repositories/myriad-green/magos/20/bin/activate" || exit 1
  # Replace with independently approved exact GitHub 40-character release SHA.
  # Set MAGOS_EXPECTED_GIT_SHA privately for this shell invocation.
  node runtime/release-preflight.js
)
```

Required private environment names: `MAGOS_EXPECTED_GIT_SHA`, `MAGOS_DEPLOY_COMMIT_SHA`, `MAGOS_RUNTIME_URL`, `MAGOS_RUNTIME_TOKEN` and distinct `MAGOS_OPERATOR_READ_TOKEN`. Never paste their actual secret values in a support ticket or repository. The preflight reads host checkout, tracked worktree, `/healthz`, `/readyz`, authenticated runtime build, authenticated Sheets probe, workflow catalogue and the read-only Control Hub coverage. It emits **PASS/FAIL metadata and counts only**, no customer rows or secret values.

**PASS does not mean the business system is complete.** It means host code, process declaration and currently accessible core sources meet this read-only release contract. Independent live golden transactions, bank settlement, production user acceptance and full business capability gates remain additional signoffs. No checkout, restart, deployment, payment, quote or business record is modified by the preflight.

If any test fails, STOP and preserve the existing hosted deployment. Capture the failure code and Git status/readback, then repair only the failed dependency. Do not blindly pull `main`, overwrite server modifications, rotate credentials, kill unrelated `lsnode` workers or claim a production PASS.



## 21 November 2026 — Controlled cPanel release command (new candidate)

The existing [`hostafrica-release.sh`](../scripts/hostafrica-release.sh) is a server-side operator tool, **not a cloud deploy button**. Run it in the authenticated HOSTAFRICA cPanel Terminal only. The ordinary `inspect` mode is read-only: it reports tracked checkout SHA, current branch, remote private GitHub `origin/main` SHA, account name, Node activation path and worker presence. It refuses uncommitted tracked files and fails if the private repo cannot be reached. It will catch an expired Git token without printing the token or credentials.

**Inspect from the verified cPanel checkout, after the approved script has become available locally:**

```bash
cd /home/myriaauq/repositories/myriad-green || exit 1
bash magos/scripts/hostafrica-release.sh inspect
```

If the server has not yet fetched this script, the existing safe native read-only checks still work: `git status --short --branch --untracked-files=no`, `git rev-parse HEAD`, and `GIT_TERMINAL_PROMPT=0 git ls-remote origin refs/heads/main`. Never expose remote credentials in ticket output. Do not pull newer source solely to run an inspection while the host checkout is dirty.

**Before the live deployment command:** obtain an independently reviewed exact 40-character `main` release SHA; confirm GitHub CI for the release; capture the host rollback SHA and backup; confirm no unrelated tracked edits; configure private `MAGOS_DEPLOY_COMMIT_SHA` in cPanel Node environment to the exact target before starting the new worker; make the distinct runtime/operator tokens available privately to the Terminal process; verify existing Node dependencies. Do not paste secrets into email, GitHub, or support tickets.

**Explicit deployment (operator-approved; NOT executed in this conversation):**

```bash
cd /home/myriaauq/repositories/myriad-green || exit 1
export MAGOS_RELEASE_SHA='REPLACE_WITH_APPROVED_40_CHARACTER_GITHUB_MAIN_SHA'
export MAGOS_APPROVE_LIVE_DEPLOY=YES
export MAGOS_HOST_BACKUP_CONFIRMED=YES
# MAGOS_DEPLOY_COMMIT_SHA, MAGOS_RUNTIME_TOKEN and MAGOS_OPERATOR_READ_TOKEN
# must already be present in your PRIVATE cPanel runtime/Terminal environment.
bash magos/scripts/hostafrica-release.sh deploy
```

The script verifies the remote commit equals the pinned approved target, refuses dirty tracked files, refuses missing cPanel declaration/token/backup flags, stores rollback SHA under `~/.magos-release-evidence/` with restricted permissions, fetches the exact target, switches to that commit, checks `app.js` syntax, recycles only the HOSTAFRICA-approved `myriaauq` MAGOS `lsnode` worker and runs the **authenticated** `runtime/release-preflight.js`. No WooCommerce, WordPress or finance source mutation occurs. The script does not alter cPanel environment variables or install dependencies; absent prerequisites are blockers.

**Important recovery limitation:** If any post-checkout step fails, the script stops and prints the previous rollback SHA. It does **not** automatically perform rollback because the private cPanel `MAGOS_DEPLOY_COMMIT_SHA` must be restored to the rollback commit before recycling the old worker. Use the last verified host SHA, existing environment configuration and HOSTAFRICA-approved targeted recycle with hosting support. Avoid unverified blind restarts or destructive git resets. A successful read-only release preflight is not business transaction acceptance.

**HOSTAFRICA mail evidence:** support ticket #3622207 confirms the targeted recycle on 11–12 November; ticket closed 16 November automatically. Support was contacted again 21 November requesting read-only checkout, private Git access and worker evidence. GitHub notification of 3 November says the old `MAGOS cPanel Git Push` fine-grained token expired; whether fetch is still possible is **UNKNOWN** until the `inspect` command is executed on the server.


## 22 November 2026 — Operator frontend acceptance added to controlled release preflight

The existing `node magos/runtime/release-preflight.js` now requires the actual served HTML operator shell and browser assets, independent operator deployment fingerprint matching the selected full Git SHA, denial of anonymous or runtime writer-token requests to the operator dashboard, and authenticated read-only CRM/job/quote registers containing at least one source-derived record. A healthy `/healthz`, old `P5` banner, or a GitHub CI PASS no longer suffices for `ready:true`. On any failed check, the already-existing HOSTAFRICA deployment script stops with a rollback-required warning; it does **not** automatically change credentials or roll back the checkout. Inspect only is still non-mutating. Record the sanitized check names/status, exact SHA and host rollback evidence without sharing tokens, clients, customer details or ledger records.

Passing preflight **certifies deployment/source-read readiness only**. It does not independently certify signed quote acceptance, cleared bank transactions, authorized supplier purchase, payroll, job margins, owner job close or whole-system acceptance. The preflight is not evidence that these additional stages have been executed live.


## Historical — 24 November initial production release blocker (RESOLVED)
HOSTAFRICA ticket #3957866 (22 Nov) confirmed production HEAD `88576e4595186e73259d5e4f32d2940ac8b4a569` on `codex/magos-production-intake-20261107`, clean tracked files, readable origin/main then `780bd0f3e3ce17ba7a0ed9d34e57e8b01c8b8954`, Node 20.20.2 and two MAGOS workers started after HEAD. This is historical evidence, not today's SHA. Tickets #9342462/#3622207 (11–12 Nov) approved the existing path/account-scoped recycle; do not request support again unless controlled local recovery fails. Reuse PR #65's `magos/scripts/hostafrica-release.sh` and existing preflight; do not create a parallel deployment path. Inspect first; reconcile host-only commits before checkout; pin tested main SHA, verify backup and private environment, recycle only scoped workers, verify loaded SHA and capability-specific endpoint, retain rollback receipt. No blind pull/reset or broad process kill. A new secret requires process reload, not a new app. A P5 health response is not release identity.
24 Nov evidence: WPVibe plugin list exit 0, Water Alert Publisher 0.1.0 active; user confirmed configuration saved on both sides and website loads. Browser health P5 OK, readiness ready/auth_configured true; unauthenticated WP status 401; authenticated WP status returned NOT_FOUND for synthetic key (expected, no write). Authenticated empty POST to runtime /v1/content/water-alert/publish returned Cannot POST; expected 400 WATER_ALERT_NOTICE_REQUIRED from merged source. Runtime endpoint FAIL, actual running SHA and runtime token acceptance unverified; likely checkout lag or stale worker, not proven. No test article or server deployment performed. Do not repeat WP installation or credential setup. Next: existing controlled host release and empty POST smoke test, then real official-source acceptance/replay/update. Support escalation only after exact sanitized failure evidence. No credentials in Git or logs.


## HOSTAFRICA resource-limited regression testing — 24 November 2026
On exact candidate 78c351f4fe47370d9bdb0799dedfedd0a7d2554c, the default concurrent suite reported 614 pass / 5 fail (four SIGKILL file processes and one temporary local Git fixture assertion). Sequential rerun of all five affected files returned exit 0, 30 pass / 0 fail. Resource contention is strongly suggested, not independently proven. Actual origin/main access passed. On shared HOSTAFRICA use `npm run test:hostafrica` (Node test concurrency 1) in an isolated candidate checkout, with test-only configuration and no live business writes. Require a complete clean run, exact candidate SHA, retained log and exit 0 before approving deployment; a targeted retest does not replace the full suite. Do not upgrade npm or contact support solely for the initial failures. Full sequential suite, branch reconciliation, backup and live deployment remain pending. Production 88576e4595186e73259d5e4f32d2940ac8b4a569 preserved in verified local backup/magos-production-20261124; divergence 119/90. No production checkout or worker change. This named command is not yet a mechanically enforced release gate; PR review and exact-head tests pending.


## Final release receipt — 24/25 November 2026 SAST
PR #103 sequential regression restore; first release candidate 646/646 passed but preflight 10/13, rolled back. PR #104 fixes worker legacy Git -C via child-process cwd; Control Hub service-account Viewer access restored. Corrected SHA b5e73575e092ef6abf39842e3ffb9ff44a45084e: 647/647 tests, 13/13 preflight PASS; ready:true; running worker, checkout, operator identity, authentication isolation, canonical coverage and 129 core records verified. Existing Node app retained. Scoped recycle procedure approved in tickets #3622207/#3957866; backup branch backup/magos-production-20261124 and private application archive retained, gzip PASS (not full external data backup). No further release work required for this receipt unless runtime/config changes or actual regression. Docs-only main advancement does not change deployed SHA. Dedicated water publication endpoint authenticated and post 10622 published; replay duplicate no-op verified. Business golden path remains pending. Never store secrets in docs.
