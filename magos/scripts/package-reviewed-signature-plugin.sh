#!/usr/bin/env bash
set -euo pipefail
# Build exactly the reviewed PHP source as a stable WordPress plugin directory.
# No host secrets, WP options, signature receipts or production database data.
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source_file="$root/magos/wordpress/mgos-reviewed-client-signature.php"
dist="$root/magos/dist"
plugin="magos-reviewed-client-signature"
test -s "$source_file"
command -v php >/dev/null
command -v zip >/dev/null
php -l "$source_file" >/dev/null
mkdir -p "$dist"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/$plugin"
cp "$source_file" "$tmp/$plugin/$plugin.php"
touch -t 198001010000 "$tmp/$plugin/$plugin.php"
(
 cd "$tmp"
 LC_ALL=C TZ=UTC zip -X -D -q "$dist/$plugin.zip" "$plugin/$plugin.php"
)
(
 cd "$dist"
 sha256sum "$plugin.zip" > "$plugin.zip.sha256"
)
echo "Packaged $plugin.zip from repository source; SHA256 recorded."
