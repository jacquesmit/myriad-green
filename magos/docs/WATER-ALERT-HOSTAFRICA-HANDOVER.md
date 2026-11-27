# Water Alert Publisher — owner terminal handover

2026-11-27. PR #127. Retrieval and reusable CA preparation CI passed (45968927731). No production deployment yet.

## Step 1 — read-only inspection in authenticated HostAfrica cPanel Terminal

```bash
cd /home/myriaauq/repositories/myriad-green || exit 1
bash magos/scripts/hostafrica-release.sh inspect
```

Return sanitized output: current host SHA, branch, remote main SHA, Node activation, worker presence and state. Never share tokens. If inspection fails, stop. Do not pull/reset/restart.

## Step 2 — release preparation (not authorized for execution until candidate accepted)

Complete semantic classification and full shared engineering tests; reconcile current main and PR #127; pin reviewed merged main SHA. Confirm backup and rollback receipt prerequisites. Use existing release script, not a new deployment bridge.

## Step 3 — certificate configuration after approved code is available

Run the committed `magos/content/prepare-water-source-ca.sh` as runtime user with a private absolute output path outside the repository. Configure `NODE_EXTRA_CA_CERTS` in cPanel Node app before startup, preserving any existing extra CA bundle. Verify issuer and hostname checks. Coordinate with existing controlled release and scoped worker recycle; do not restart independently.

## Step 4 — production acceptance

Verify exact loaded SHA and existing release preflight; test actual official notice retrieval from production, semantic classification, dedupe, authorized publish/read-back/replay/update, schema and sitemap. Do not publish synthetic alerts. Record failures and rollback as required. WPVibe remains WordPress publication/QA interface. No production completion claim until evidence passes.
