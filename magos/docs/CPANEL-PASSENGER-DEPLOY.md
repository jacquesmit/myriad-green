# MAGOS production runtime on cPanel

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
| Last verified deployed checkout | `codex/magos-production-intake-20261107` at [`5b29a34`](https://github.com/jacquesmit/myriad-green/commit/5b29a34026c95edf5ee3d9b55466d43adff53812) |
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

