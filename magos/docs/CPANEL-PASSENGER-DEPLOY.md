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
