#!/usr/bin/env bash
set -euo pipefail
# MAGOS HOSTAFRICA release control — operator-run in the authenticated cPanel
# Terminal ONLY. inspect is read-only; deploy is explicitly gated.
# Never execute from GitHub Actions against a live server.
mode="${1:-inspect}"
repo="${MAGOS_REPO_ROOT:-/home/myriaauq/repositories/myriad-green}"
app="$repo/magos"
target="${MAGOS_RELEASE_SHA:-}"
remote=""
fatal(){ printf 'FAIL %s\n' "$1" >&2; exit 1; }
sha_ok(){ [[ "$1" =~ ^[0-9a-f]{40}$ ]]; }
usage(){
 cat <<'EOF'
MAGOS HOSTAFRICA RELEASE CONTROL
  bash magos/scripts/hostafrica-release.sh inspect
  MAGOS_RELEASE_SHA=<FULL_40_CHARACTER_SHA> \
    MAGOS_APPROVE_LIVE_DEPLOY=YES MAGOS_HOST_BACKUP_CONFIRMED=YES \
    bash magos/scripts/hostafrica-release.sh deploy
The deploy operation does NOT set cPanel secrets, install packages or modify
WordPress. It requires previously configured private env tokens and a clean
host checkout; it verifies GitHub main and the running worker before PASS.
Always run inspect first. Never paste any credentials into support tickets.
EOF
}
if [[ "$mode" == "--help" || "$mode" == "help" ]]; then usage;exit 0;fi
[[ "$mode" == inspect || "$mode" == deploy ]] || fatal 'INVALID_MODE'
if [[ "$mode" == deploy ]]; then
  sha_ok "$target" || fatal 'FULL_RELEASE_SHA_REQUIRED'
  [[ "${MAGOS_APPROVE_LIVE_DEPLOY:-}" == YES ]] || fatal 'LIVE_DEPLOY_APPROVAL_REQUIRED'
  [[ "${MAGOS_HOST_BACKUP_CONFIRMED:-}" == YES ]] || fatal 'HOST_BACKUP_CONFIRMATION_REQUIRED'
  [[ "$(id -un)" == myriaauq ]] || fatal 'WRONG_HOST_USER'
fi
[[ -d "$repo/.git" && -f "$app/app.js" ]] || fatal 'EXPECTED_MAGOS_CHECKOUT_NOT_FOUND'
git -C "$repo" rev-parse --is-inside-work-tree >/dev/null || fatal 'GIT_CHECKOUT_INVALID'
current="$(git -C "$repo" rev-parse HEAD)" || fatal 'LOCAL_SHA_UNAVAILABLE'
sha_ok "$current" || fatal 'LOCAL_SHA_NOT_FULL_COMMIT'
dirty="$(git -C "$repo" status --porcelain --untracked-files=no)" || fatal 'GIT_STATUS_UNAVAILABLE'
[[ -z "$dirty" ]] || fatal 'TRACKED_WORKTREE_DIRTY_STOP'
printf 'CURRENT_HOST_SHA=%s\n' "$current"
printf 'HOST_BRANCH=%s\n' "$(git -C "$repo" branch --show-current)"
# Credential prompts must not hang a production release, and errors may
# include credentials. Print a fixed error code, NEVER raw git stderr.
remote="$(GIT_TERMINAL_PROMPT=0 timeout 25 git -C "$repo" ls-remote --exit-code origin refs/heads/main 2>/dev/null | awk 'NR==1{print $1}')" ||
  fatal 'PRIVATE_GITHUB_ORIGIN_MAIN_UNREACHABLE_CHECK_EXPIRED_TOKEN'
sha_ok "$remote" || fatal 'REMOTE_MAIN_SHA_INVALID'
printf 'REMOTE_GITHUB_MAIN_SHA=%s\n' "$remote"
if [[ "$mode" == inspect ]]; then
  printf 'NODE_ACTIVATION=%s\n' "$([[ -r "$HOME/nodevenv/repositories/myriad-green/magos/20/bin/activate" ]] && echo PRESENT || echo MISSING)"
  printf 'EXPECTED_HOST_USER=%s\n' "$(id -un)"
  if command -v pgrep >/dev/null 2>&1;then
    pgrep -u "$(id -un)" -f '^lsnode:/home/myriaauq/repositories/myriad-green/magos/' >/dev/null 2>&1 &&
      printf 'MAGOS_WORKER=DETECTED\n' || printf 'MAGOS_WORKER=NOT_DETECTED\n'
  fi
  printf 'STATE=INSPECTED_ONLY_NO_CHANGES\n'
  exit 0
fi
[[ "$remote" == "$target" ]] || fatal 'RELEASE_SHA_NOT_CURRENT_ORIGIN_MAIN'
[[ "${MAGOS_DEPLOY_COMMIT_SHA:-}" == "$target" ]] ||
  fatal 'CPANEL_DEPLOY_SHA_DECLARATION_NOT_CONFIRMED'
[[ -n "${MAGOS_RUNTIME_TOKEN:-}" && -n "${MAGOS_OPERATOR_READ_TOKEN:-}" ]] ||
  fatal 'PRIVATE_RUNTIME_OR_OPERATOR_CREDENTIAL_UNAVAILABLE'
[[ "$MAGOS_RUNTIME_TOKEN" != "$MAGOS_OPERATOR_READ_TOKEN" ]] ||
  fatal 'REUSED_RUNTIME_OPERATOR_CREDENTIAL'
activate="$HOME/nodevenv/repositories/myriad-green/magos/20/bin/activate"
[[ -r "$activate" ]] || fatal 'NODE20_ACTIVATION_MISSING'
# shellcheck source=/dev/null
source "$activate" || fatal 'NODE20_ACTIVATION_FAILED'
command -v node >/dev/null || fatal 'NODE_EXECUTABLE_MISSING'
command -v npm >/dev/null || fatal 'NPM_EXECUTABLE_MISSING'
[[ -d "$app/node_modules" ]] || fatal 'MAGOS_DEPENDENCIES_MISSING_STOP_BEFORE_CHECKOUT'
(cd "$app" && node -e "require('express');require('dotenv')") >/dev/null ||
  fatal 'EXISTING_MAGOS_DEPENDENCIES_INVALID'
# The controlled rollback SHA is written OUTSIDE the Git worktree, without
# embedding any runtime credentials in an audit artifact.
audit="$HOME/.magos-release-evidence"
mkdir -p -m 700 "$audit" || fatal 'AUDIT_DIRECTORY_UNAVAILABLE'
chmod 700 "$audit"
receipt="$audit/$(date -u +%Y%m%dT%H%M%SZ)-deployment"
printf 'ROLLBACK_SHA=%s\nTARGET_SHA=%s\n' "$current" "$target" > "$receipt"
chmod 600 "$receipt"
printf 'ROLLBACK_RECEIPT=%s\n' "$receipt"
# Last source gate: fetch the exact approved main commit from the repository.
GIT_TERMINAL_PROMPT=0 git -C "$repo" fetch --quiet --no-tags origin main 2>/dev/null ||
  fatal 'GIT_FETCH_FAILED_NO_CHECKOUT_CHANGE'
fetched="$(git -C "$repo" rev-parse FETCH_HEAD)" ||
  fatal 'FETCH_HEAD_UNAVAILABLE'
[[ "$fetched" == "$target" ]] || fatal 'FETCHED_SHA_MISMATCH_NO_CHECKOUT_CHANGE'
git -C "$repo" switch --detach "$target" >/dev/null ||
  fatal 'CHECKOUT_FAILED_STOP'
[[ "$(git -C "$repo" rev-parse HEAD)" == "$target" ]] ||
  fatal 'CHECKOUT_SHA_MISMATCH_STOP'
[[ -z "$(git -C "$repo" status --porcelain --untracked-files=no)" ]] ||
  fatal 'CHECKOUT_DIRTY_STOP'
node --check "$app/app.js" >/dev/null || fatal 'APP_SYNTAX_FAILED_ROLLBACK_REQUIRED'
printf 'HOST_CHECKOUT_DEPLOYED_SHA=%s\n' "$target"
# HOSTAFRICA tickets #9342462 / #3622207 verified this exact scoped
# worker recycling procedure; do not terminate any other Node.js process.
if pkill -u myriaauq -f 'lsnode:/home/myriaauq/repositories/myriad-green/magos/'; then
 printf 'MAGOS_WORKER_RECYCLE=REQUESTED\n'
else
 code=$?
 [[ "$code" == 1 ]] || fatal 'TARGETED_WORKER_RECYCLE_FAILED'
 printf 'MAGOS_WORKER_RECYCLE=NO_PREEXISTING_WORKER\n'
fi
export MAGOS_EXPECTED_GIT_SHA="$target"
export MAGOS_RUNTIME_URL="${MAGOS_RUNTIME_URL:-https://runtime.myriadgreen.co.za}"
# Full authenticated preflight checks hosted checkout SHA, worker SHA, tracked
# cleanliness, runtime readiness, Sheets audit source and Command Centre.
if ! node "$app/runtime/release-preflight.js";then
 printf 'STATE=POST_DEPLOY_PREFLIGHT_FAILED_REQUIRES_OPERATOR_ROLLBACK\n' >&2
 printf 'ROLLBACK_SOURCE_SHA=%s\n' "$current" >&2
 fatal 'LIVE_RELEASE_NOT_VERIFIED'
fi
printf 'STATE=DEPLOYED_AND_READ_ONLY_PREFLIGHT_PASS\n'
printf 'BUSINESS_GOLDEN_PATH=NOT_YET_VERIFIED\n'
