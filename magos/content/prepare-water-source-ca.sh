#!/bin/sh
set -eu
umask 077
dest=${1:?Provide absolute CA bundle output path}
case "$dest" in /*) ;; *) exit 2;; esac
roots=${SSL_CERT_FILE:-/etc/ssl/certs/ca-certificates.crt}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl --fail --silent --show-error --proto '=http' --max-time 25 --max-filesize 65536 'http://cacerts.geotrust.com/GeoTrustTLSRSACAG1.crt' -o "$tmp/issuer.der"
openssl x509 -inform DER -in "$tmp/issuer.der" -out "$tmp/issuer.pem"
openssl verify -CAfile "$roots" "$tmp/issuer.pem"
timeout 20 openssl s_client -connect www.tshwane.gov.za:443 -servername www.tshwane.gov.za -showcerts </dev/null 2>/dev/null | openssl x509 -out "$tmp/leaf.pem"
openssl verify -purpose sslserver -verify_hostname www.tshwane.gov.za -CAfile "$roots" -untrusted "$tmp/issuer.pem" "$tmp/leaf.pem"
stage=$(mktemp "${dest}.XXXXXX")
cat "$tmp/issuer.pem" > "$stage"
mv -f "$stage" "$dest"
