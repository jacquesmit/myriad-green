# MAGOS P5P — Fluent Forms Lead Adapter Contract V1

## Status

Code/control implementation only.

The adapter is **not connected to production WordPress or Fluent Forms**. The live Fluent Forms admin/export route and exact production field keys remain TO_CONFIRM. Existing Gmail-based website lead handling remains active until direct-provider parity is proven.

## Why this exists

Current website lead evidence shows two different realities:

1. Fluent Forms is active on WordPress.
2. The current operational lead boundary is still a structured WordPress admin email routed through Gmail.

The Gmail route has worked for leads such as Francois, Anita, Nomsa and Zanele, but the CRM evidence also records known provenance gaps:

- Gmail message ID is being used as a provisional source_event_id,
- the real Fluent submission ID is often absent,
- page URL/title and UTM/campaign data are absent,
- upload references may be lost,
- truncated email bodies can force REVIEW_REQUIRED,
- weekly Fluent summaries are aggregate evidence only and cannot identify an individual lead.

P5P therefore defines the direct provider adapter **without pretending that the live field keys are known yet**.

## Boundary

The route is:

    Fluent Forms server-side hook/export
      -> explicit source field map
      -> P5P canonical ingress request
      -> P5O /v1/ingress/leads
      -> P5M
      -> P5L
      -> P5N
      -> P3

P5P never writes CRM, Commercial, Supplier or Drive business state.

## Stable provider identity

Direct Fluent ingestion requires both:

- form_id
- entry_id

The canonical source event identity is:

    FLUENT_FORMS|FORM:<form_id>|ENTRY:<entry_id>

A Gmail message ID is not substituted into this direct-provider identity.

If the provider entry ID is unavailable, the direct Fluent adapter must not be used. The existing Gmail source path remains the fallback until provider authority is available.

## Evidence

Direct provider ingestion requires an explicit evidence_ref supplied by the source adapter.

P5P does not invent an admin URL because the authenticated Fluent Forms admin/export route is currently TO_CONFIRM.

The evidence reference must resolve to retained provider/source evidence appropriate for the production integration.

## Explicit field mapping

P5P accepts a fieldMap of:

    MAGOS canonical lead field -> exact Fluent provider field key

Example only:

    {
      "contact_name": "customer_name",
      "contact_phone": "mobile_number",
      "contact_email": "email_address",
      "suburb_area": "suburb_field",
      "service_category": "service_field",
      "issue_summary": "message_field"
    }

These example provider keys are synthetic and are **not** the production Myriad Green field names.

P5P performs no fuzzy matching on field labels and no semantic guessing.

If a provider field exists but is not explicitly mapped, it is not promoted into a MAGOS lead fact.

## Source metadata

A separate explicit metadataMap may preserve:

- page_url
- page_title
- utm_source
- utm_medium
- utm_campaign
- utm_content
- utm_term
- upload_refs

P5P additionally records provider provenance:

- provider = FLUENT_FORMS
- provider_form_id
- provider_form_name when supplied
- provider_entry_id

P5O only preserves an allowlisted source_metadata set in EventEnvelope metadata. Arbitrary source blobs are rejected.

Source metadata is evidence/provenance. It is not canonical client identity.

## Safety

P5P does not claim that a form submission is safe.

If no verified scanner results are supplied, P5O converts every content guard to UNKNOWN and the P5 policy requires review.

If an adapter supplies CLEAR or BLOCK decisions, it must also supply the P5O safety_attestation:

- provider
- scan_id
- scanned_at

A WordPress hook must never hard-code CLEAR.

## Uploads

Upload references are preserved only when the provider exposes them explicitly through the configured metadata map or explicit source metadata.

P5P does not infer that an upload exists because a form contains an upload field.

The source-specific parity test must prove that real upload references survive from Fluent Forms into the EventEnvelope before any legacy path is retired.

## What remains TO_CONFIRM

Before production connection we still need the live provider facts:

- exact Fluent form ID for Contact Us / Quote Request,
- exact production Fluent field keys,
- exact provider entry ID exposed to the hook/export,
- exact authenticated provider evidence/admin URL or equivalent retained evidence reference,
- exact upload reference shape,
- whether page/UTM values are already collected,
- server-side hook location and secret storage mechanism.

Until those are read from the live WordPress/Fluent configuration, P5P remains a disabled adapter contract.

## Migration rule

Do not replace the current Gmail website lead boundary immediately.

After P4 is live:

1. read the exact Fluent form/export schema,
2. create the production fieldMap from observed provider keys,
3. store the P5O ingress secret server-side only,
4. allowlist FLUENT_FORMS,
5. run controlled non-client test entries,
6. compare direct Fluent output to the existing Gmail intake for the same test submissions,
7. prove no field loss, no duplicate CRM/opportunity creation, stable replay suppression, upload/page provenance and safety behavior,
8. only then retire the overlapping Gmail website-lead writer.

The Gmail path may remain as evidence/notification after writer retirement, but it must not become a duplicate business writer.
