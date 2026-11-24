#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
php_source="$root/magos/wordpress/mgos-water-alert-publisher.php"
css_source="$root/magos/wordpress/assets/water-alert.css"
dist="$root/magos/dist"
plugin="magos-water-alert-publisher"
test -s "$php_source"
test -s "$css_source"
command -v php >/dev/null
command -v zip >/dev/null
php -l "$php_source" >/dev/null
mkdir -p "$dist"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/$plugin/assets"
cp "$php_source" "$tmp/$plugin/$plugin.php"
cp "$css_source" "$tmp/$plugin/assets/water-alert.css"
touch -t 198001010000 "$tmp/$plugin/$plugin.php" "$tmp/$plugin/assets/water-alert.css"
(
 cd "$tmp"
 LC_ALL=C TZ=UTC zip -X -D -q "$dist/$plugin.zip" "$plugin/$plugin.php" "$plugin/assets/water-alert.css"
)
(
 cd "$dist"
 sha256sum "$plugin.zip" > "$plugin.zip.sha256"
)
echo "Packaged $plugin.zip from reviewed repository source."
