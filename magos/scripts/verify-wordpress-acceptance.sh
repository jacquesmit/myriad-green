#!/usr/bin/env bash
set -uo pipefail
# MAGOS WordPress acceptance staging QA. Read-only; never creates jobs.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN="$ROOT/wordpress/mgos-quote-acceptance/mgos-quote-acceptance.php"
STATUS=0
pass(){ printf 'PASS: %s\n' "$1"; }
fail(){ printf 'FAIL: %s\n' "$1"; STATUS=1; }
if command -v php >/dev/null 2>&1; then
 php -l "$PLUGIN" >/dev/null 2>&1 && pass 'PLUGIN_PHP_LINT' || fail 'PLUGIN_PHP_LINT'
else fail 'PHP_CLI_NOT_AVAILABLE'; fi
if [ -f "$ROOT/wordpress/mgos-quote-acceptance/assets/quote-acceptance-v1.css" ]; then
 pass 'CSS_PACKAGED'
else fail 'CSS_MISSING'; fi
if [ -n "${MAGOS_WORDPRESS_BASE_URL:-}" ]; then
 base="${MAGOS_WORDPRESS_BASE_URL%/}"
 page_code=$(curl -L -sS --max-time 20 -o /dev/null -w '%{http_code}' "$base/accept-and-sign-quotation/" || true)
 [ "$page_code" = '200' ] && pass 'PUBLIC_ACCEPTANCE_PAGE' || fail "PUBLIC_ACCEPTANCE_PAGE_HTTP_$page_code"
 verify_code=$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' "$base/wp-json/mgos/v1/quote-acceptance/verify?quote_id=RELEASE-NEGATIVE&opportunity_id=RELEASE-NEGATIVE" || true)
 [ "$verify_code" = '401' ] && pass 'UNAUTHENTICATED_VERIFY_DENIED' || fail "UNAUTHENTICATED_VERIFY_HTTP_$verify_code"
else printf 'BLOCKED: LIVE_WP_URL_NOT_CONFIGURED\n';STATUS=1; fi
printf 'RELEASE_VERDICT: %s\n' "$([ "$STATUS" -eq 0 ] && echo 'STAGING_BASIC_PASS_ONLY' || echo 'BLOCKED_OR_FAILED')"
exit "$STATUS"
