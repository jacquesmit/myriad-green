# Myriad Green — Quote Acceptance UX & Evidence Contract V1
Status: BUILD SPECIFICATION — requires live WordPress QA before production approval
Aligned to canonical MYRIAD GREEN CLIENT COMMERCIAL DOCUMENT PRODUCTION STANDARD V2.3 (2026-08-12).

## Customer journey: one page, one action
Canonical slug proposed: `/accept-and-sign-quotation/`. All links must include an opaque server-issued one-time/expiry-bound quote-specific token; never trust editable quote ID, value, version, price or recipient from the browser.

1. Header: Myriad Green mark (unaltered aspect ratio), 'Accept & sign your quotation', client support line. No navigation distractions.
2. **Quotation summary (read-only, server-derived)**: quote number + version, client, service address, scope title, grand total, agreed deposit amount/terms, valid-until, view/download the immutable issued quotation PDF. Explicitly warn when quote is expired or superseded. A changed PDF/version invalidates an old signing link.
3. **Acceptance**: client full legal name, email/telephone (matching/verification rules), role/authority for business signer, explicit checkbox 'I have reviewed the exact quotation, scope, exclusions, payment terms and version shown above and accept them'. Display linked privacy notice and signed consent wording. Signature field (only if the installed Fluent Forms Pro feature is actually available); capture immutable server timestamp and provider entry ID.
4. Primary action: **Accept and sign quotation**. Prevent accidental double submissions; accessible mobile button; inline field-specific errors.
5. Confirmation state: 'Acceptance received — verification pending' until trusted server reconciliation passes. NEVER say deposit is cleared, order is booked, or work is scheduled because a form was submitted. Show reference and next step. After independent verification: 'Quotation accepted', status of payment separately, with acknowledgement link.
6. Show no raw tokens or authority credentials in page HTML, submission emails, links beyond opaque bounded token.

## Fixed visual system
- White canvas, charcoal text, deep green `#006B2E` primary, dark green `#00441F` heading, lime `#7AC943` only for controlled accents; no decorative full-page saturated boxes.
- Desktop centered max width 760px; mobile full width with 20px horizontal breathing room.
- Read-only quote card first; form fields second; total and payment schedule visible before signature.
- Body >=16px, tap targets >=44px, keyboard focus outlines, WCAG-conscious contrast.
- Logo is a single immutable asset, `width:auto; height:auto; object-fit:contain`, no skew/stretch.
- No changing pagination, typography, headings or footer between acceptance/receipt/booking outputs. Fixed V2.3 component family; populated data varies, layout remains governed.
- Neutral metadata styling and obvious `PENDING`, `VERIFIED`, `BLOCKED` wording; never use color alone to signal state.

## Evidence architecture — distinct operational records
Fluent Forms accepts the submission; it is NOT the authoritative proof by itself. A server-side plugin must:
- Validate an unexpired, single-quote token and the currently issued immutable quote revision from canonical Commercial `Quotes`, rejecting superseded or mismatched amounts/versions.
- On the Fluent Forms *successful saved entry* action capture exact Form ID, Entry ID, signer identity, agreement checkbox, signature attachment reference/digest, quote ID + version, opportunity ID and server UTC time. Store an immutable locally indexed acceptance entry / provider event ID.
- Keep intake distinct from real leads and outbound scraper; signing a quote cannot create a new prospect or duplicate an opportunity.
- Expose **read-only authenticated** `GET` verification for MAGOS with exact `quote_id` and `opportunity_id`; verify the issued quote revision and exact persisted Fluent entry, signed attachment, consent and immutable evidence record before returning `verified:true`. Otherwise `verified:false`; no self-asserted acceptance.
- Return the already defined MAGOS signing-provider contract: `verified`, `quote_id`, `opportunity_id`, `status:SIGNED`, `evidence_ref`, `source_event_id` (derive from form/entry IDs), `signer_identity`, ISO `signed_at`. Never expose personal detail beyond that needed for job release.
- Authentication: separate high-entropy bearer shared secret, TLS, allowlisted endpoint, rate limits, non-cacheable responses, fail-closed on missing configuration.
- MAGOS independently verifies matching quote/opportunity/signing event, cleared `Payment_Allocations` (when required) and P3 job/Execution/audit readbacks. Job creation is always governed; never done inside a Fluent submission hook.

## Acceptance document: fixed V2.3 template
MRG-QA is the acknowledgement (not the signing entry). Title: 'Quotation Acceptance Acknowledgement'. Immutable acceptance event ID, exact quote no/version, client, signed time, accepted total + deposit terms, quote PDF evidence ref, acknowledgement and separate payment/booking status. Maintain standard identity footer, consistent logo ratio and typography. QA includes mobile and A4 print rendering, 2-page overflow, alignment, currency and no unsupported payment claims.

## Release acceptance gates
- U1: desktop/mobile UX reviewed against fixed layout, accessible focus/tap controls, correct real logo placement, no skew, no clipped text.
- U2: issued quote details read from canonical source; invalid/expired/superseded link fails closed.
- U3: exact consent + signature persisted in Fluent entry with immutable evidence reference and provider entry ID.
- U4: unauthenticated verification rejected; wrong quote/opportunity/version/entry rejected; duplicate signed form cannot create two jobs.
- U5: success returns signed provider facts only after durable readback; no payment/booking inference.
- U6: MAGOS confirms signature independently, bank-cleared deposit from canonical allocation, P3 writes, dual-source readback + matching committed audit entry.
- U7: deployed revision and full consolidated suite proven with artifacts; no test customer's records changed without explicit controlled authorization.

## Current evidence
Drive contains canonical commercial document Standard V2.3 and a V2.3 quote acknowledgement PDF; those do not prove that a working signing form exists. This specification is not an installed WordPress page nor a passed live UX review.
