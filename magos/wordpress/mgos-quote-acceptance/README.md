# MGOS Quote Acceptance WordPress Bridge — installation package

Status: **BUILD / PENDING LIVE INSTALLATION AND UX SIGN-OFF**. Not ready to activate automatic job creation.

## Included
- `mgos-quote-acceptance.php` WordPress plugin, signing-link validation, shortcode `[mg_quote_acceptance]`, Fluent Forms submission intake and private authentication-bound verification endpoint.
- `assets/quote-acceptance-v1.css` fixed responsive appearance. **UX MUST BE REVISED AND APPROVED LATER** on real desktop/mobile displays and acknowledgement PDF.

## Critical prerequisites
1. Install and activate this folder as a WordPress plugin in a staging site first, not the production site.
2. Confirm installed Fluent Forms licence includes *Signature* field. Require name, explicit consent, signing input and hidden `quote_accept_token` populated from verified `accept_token` query parameter (configure exact field names). Test actual Fluent Forms signature payload and webhook hooks against installed version; this code assumes signature field returns a string reference.
3. Configure WordPress option `mgos_quote_acceptance_config` via restricted server-side administration (not a frontend form): `form_id`, high-entropy `link_secret` and separate `verification_token`. These secrets must be stored privately.
4. Create WordPress page at `/accept-and-sign-quotation/` with shortcode. Issue links only from a trusted server process generating `base64url(JSON payload).HMAC_SHA256` signed with the link secret. Payload: `quote_id`, `opportunity_id`, `version`, `expiry` (Unix seconds), `issued_pdf_ref` (HTTPS URL).
5. Critically, the form currently stores submissions only as `PENDING_REVIEW`. There is **no automated promotion to VERIFIED**, and the verification endpoint is **deliberately fail-closed**, even for manually VERIFIED records, until canonical quote/version matching is implemented. Do not connect P3 job release on the assumption a Fluent entry is verified.
6. Design and implement exact persisted Fluent signature verification, canonical `Quotes` version/expiry and immutable PDF hash reconciliation, only then return a positively verified response conforming to MAGOS signing-provider contract.
7. Point the MAGOS HTTPS signing verifier at the WordPress endpoint only *after* that full end-to-end verification passes. Run negative tests for mismatched quote, forged tokens, duplicate submissions, stale revision and payment proof without clearance.
8. Perform reviewed desktop/mobile UX and PDF acknowledgement QA later, as requested, before marking the page production-ready.

## Security warning
The shortcode's token-bound summary is **not live-source verified**. Do not infer current price, deposit or eligibility from signed token alone. WordPress pages, backend configuration and signature plugin must be independently inspected. No automatic job release is included.

## Release gate
Code committed != installed != tested != live verified. Current status remains **PARTIAL / PENDING**.
