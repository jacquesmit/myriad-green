# MAGOS WordPress Quote Acceptance — Controlled Upgrade

**Evidence captured 2026-11-21 via connected WPVibe, authenticated read only.**

## Actual live findings
- Connected WordPress at `https://myriadgreen.co.za`; WPVibe plugin 1.20.3 and administrator read access.
- Active `mgos-quote-acceptance` 0.3.2 is a working **OWNER_TEST-only** signature form; the submission handler explicitly returns for real client tokens. Existing `GET /wp-json/mgos/v1/quote-acceptance/verify` always returns `verified:false`.
- Active MAGOS Systems Calculator 3.0.0 is a standalone shortcode, not a MAGOS quotation/checkout writer.
- WordPress runs independently of the HOSTAFRICA `runtime.myriadgreen.co.za` Node worker. WPVibe's WordPress/PHP emulator does **not** expose Node process IDs, remote Git SHA or the root of the MAGOS Node app.

## Implementation on the branch
1. `magos/processor/wordpress-acceptance-verifier.js` performs server-side HTTPS verification with a pinned `myriadgreen.co.za` origin, no redirects, runtime-only bearer credential, canonical Commercial `Quotes` status and opportunity match, all CURRENT `Quote_Lines` sharing one version, immutable issued PDF URL match, signed receipt identity, consent and independent approval. No unsigned/test-only/expired/stale quote can release a job.
2. `magos/runtime/app.js` uses this trusted verifier only when independently configured. Existing `job-activation` and `governance/create-job` paths retain cleared-funds and P3 gates.
3. `magos/wordpress/mgos-reviewed-client-signature.php` is a **candidate new plugin**, NOT deployed. Alongside legacy bridge 0.3.2 it listens only for validated, non-owner-test Fluent Forms submissions. It stores the signed PNG and SHA256 in WordPress evidence storage, status PENDING_REVIEW. WP admin review needs nonce, administrator capability, independent signer/document/version confirmation and a linked signed receipt stored in Google Drive. It exposes a separate bearer-protected `verify-v2` endpoint that rechecks byte integrity and reviewer provenance. The WordPress plugin writes no quote/job/payment/booking status.
4. Tests: Node provider-origin/identity/version/replay integrity tests, HTTP and existing job authority tests, PHP linter and static source-contract tests.

## Release sequence (NOT a production certification)
1. Resolve approved customer link issuance for the *actual current issued quote version*. The legacy WordPress plugin currently supplies only OWNER_TEST link generation; do not fabricate a client link or copy a test link.
2. On staging, install the reviewed companion WP plugin alongside 0.3.2 using the owner-approved deployment mechanism (WPVibe supports WordPress reads but its source/log-file surface is read-only, not a direct plugin PHP writer). Confirm legacy token parser and native Fluent Form hidden fields are present and active.
3. Staging test: real client quote issued -> signed native Fluent Form -> client receipt PENDING_REVIEW -> admin signature preview -> Drive signed evidence -> independent review -> `verify-v2` returns exact receipt -> MAGOS server matches canonical current Quote + Quote_Lines + opportunity + issued PDF -> separately cleared deposit -> authorized governed job creation -> exact canonical writer readback.
4. Negative acceptance: OWNER_TEST, unsigned form, unregistered field, duplicate submission, stale quote revision, superseded PDF, missing consent, non-Drive reviewer evidence, forged API token, missing active quote, payment proof without bank clearance must not release.
5. After staging acceptance, deploy the reviewed WP plugin and merge the known-good runtime SHA on HOSTAFRICA using recorded backup, credentials and targeted worker recycle. Verify new live `/v1/runtime/build` SHA via read-only release preflight; verify no public route leaks signatures or secrets.
6. Leave current live owner test plugin unchanged until customer acceptance source and provider verification pass. **Do not mark MAGOS quotation signing COMPLETE at code-merge time.**

### Known gaps and restrictions
- The legacy 0.3.2 owner-test bridge has **no verified customer link issuer** in the inspected deployed source. The companion client receipt plugin does not solve link issuance.
- The companion is not yet installed, and `verify-v2` will not exist on the live WordPress site until deployed.
- ADMIN approval is review evidence; it is not itself a legally verified client identity or settled deposit. The server-side canonical quote check and payment-control gates remain independent.
- Existing WooCommerce pricing/checkout/engineering work is outside this change. No shop changes are authorized by this bridge.

## Authoritative read-only sources
- Live WordPress plugin PHP via WPVibe `wp-content/plugins/mgos-quote-acceptance/mgos-quote-acceptance.php`
- Commercial `Quotes` and `Quote_Lines` in `CRM - Quote & Invoice Register 2026`
- `magos/processor/signed-acceptance-verification.js`
- `magos/processor/canonical-job-authority.js`
- `magos/docs/CPANEL-PASSENGER-DEPLOY.md`
