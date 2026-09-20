# MAGOS P5O — Authenticated Lead Ingress V1

## Status

Code/control implementation only.

This does **not** activate WordPress, Fluent Forms, Meta, WhatsApp, or any other live source. Source adapters remain disconnected until P4 hosted runtime validation and source-specific parity acceptance.

## Purpose

P5N already governs `LEAD_SUBMITTED` business decisions. P5O adds a narrow external ingress boundary so a website or provider adapter can submit one canonical lead without receiving the high-privilege MAGOS runtime token.

The route is:

    trusted source adapter
      -> POST /v1/ingress/leads
      -> separate ingress authentication
      -> source allowlist
      -> canonical LEAD_SUBMITTED EventEnvelope
      -> P5M GovernedProcessorRegistry
      -> P5L GovernedEventRunner
      -> P5N lead processor
      -> P3 writer/review/retry controls

## Separate authentication

The endpoint uses:

    X-MAGOS-INGRESS-TOKEN

configured from:

    MAGOS_LEAD_INGRESS_TOKEN

This token is intentionally separate from:

    MAGOS_RUNTIME_TOKEN

The runtime bearer token can invoke privileged internal routes and must never be placed in WordPress, browser JavaScript, form HTML, or a third-party lead provider.

If the ingress token is not configured, the endpoint returns 503.

## Source allowlist

Allowed canonical source names are configured as a comma-separated list:

    MAGOS_LEAD_INGRESS_SOURCES=WORDPRESS,FLUENT_FORMS

If the submitted source is not on the allowlist, the request is rejected before governed dispatch.

An allowlist entry does not approve the business record. It only identifies which technical adapters may enter this boundary.

## Canonical request contract

Example shape:

```json
{
  "source": "WORDPRESS",
  "source_event_id": "provider-stable-entry-id",
  "occurred_at": "2026-09-20T12:00:00+02:00",
  "correlation_id": "optional",
  "evidence_ref": "https://provider.example/admin/entry/123",
  "evidence_type": "WEBSITE_FORM_ENTRY",
  "guards": {
    "spam": "CLEAR",
    "phishing": "CLEAR",
    "explicit_content": "CLEAR",
    "malware": "CLEAR",
    "irrelevant": "CLEAR"
  },
  "lead": {
    "contact_name": "Client Name",
    "contact_phone": "+27...",
    "contact_email": "client@example.com",
    "suburb_area": "Pretoria East",
    "service_category": "Irrigation installation",
    "issue_summary": "New system enquiry"
  }
}
```

The adapter maps only known source fields into this canonical contract. It does not write CRM, create a job, decide payment state, or perform lifecycle mutations.

## Required identity and evidence

P5O requires:

- `source`,
- stable provider `source_event_id`,
- non-empty `evidence_ref`,
- a `lead` object.

The source event ID drives deterministic replay suppression downstream.

The evidence reference must point to retained provider/source evidence. P5O does not manufacture evidence URLs.

## Safety guards

Accepted guard values are:

- `CLEAR`
- `BLOCK`
- `UNKNOWN`

for:

- spam
- phishing
- explicit_content
- malware
- irrelevant

If a source adapter does not supply a guard result, P5O sets that guard to `UNKNOWN`.

This is intentional. P5 event policy treats unknown guards as review-required. Missing safety scanning can therefore never silently become `CLEAR`.

A future content-safety worker may populate these guard outcomes before submission or through a separately governed adapter stage. P5O itself does not pretend that unscanned content has passed.

## Source attribution

If the lead payload does not explicitly supply these fields, P5O fills them from the canonical source name:

- record_origin
- acquisition_source
- first_contact_channel

This is source attribution only. It does not infer campaign, intent, urgency, booking state, service qualification, or consent.

## What P5O does not do

P5O does not:

- expose `MAGOS_RUNTIME_TOKEN`,
- accept browser-direct public writes as trusted runtime calls,
- infer client identity from name/address,
- create CRM records itself,
- bypass P5N,
- mark unknown safety checks as clear,
- create evidence references,
- retire the existing MGOS Intake & Sync Watch,
- activate WordPress or Fluent Forms automatically.

## Deployment sequence

After P4 is live and authenticated:

1. create a new ingress secret in the hosting secret store,
2. configure the exact source allowlist,
3. implement one source-side adapter with server-side secret storage,
4. use a non-client controlled test submission,
5. prove source event ID/evidence/guards read back correctly,
6. prove replay no-op,
7. compare the governed result against the legacy intake path,
8. only then decide whether that source's legacy writer can be retired.

Until that acceptance passes, P5O remains code-ready and production OFF.
