# MAGOS WhatsApp Business Cloud Ingress

## Purpose

Receive new WhatsApp Business Cloud messages inside the existing Myriad Green backend and write only business-safe message metadata to the live MGOS CRM Intake_Queue.

This is intentionally not a Make scenario. It reuses the existing Node/Express backend and Google Sheets API dependency.

## Runtime flow

1. Meta calls GET /webhooks/whatsapp for webhook verification.
2. Meta delivers message events to POST /webhooks/whatsapp.
3. The route verifies X-Hub-Signature-256 against WHATSAPP_APP_SECRET using the exact raw request body.
4. The route validates the configured phone_number_id and optional WABA ID.
5. Each immutable Meta message ID (wamid) is classified before any CRM write.
6. BUSINESS_SAFE messages are deduplicated by wamid and appended once to Intake_Queue.
7. The writer copies the previous Intake_Queue row's format and data validation, then reads the new row back and asserts the source schema and source_event_id.
8. PERSONAL, EXPLICIT, SCAM, PHISHING and SPAM_MARKETING messages never enter Intake_Queue, CRM_Master, Jobs_Opportunities or Evidence_Index.
9. UNKNOWN messages are held outside the CRM and logged only as a minimal diagnostic.
10. Media is not fetched at ingress. Unknown media is therefore fail-closed and cannot leak explicit visual content into Drive or Sheets.

## Environment variables

Required for production:

- WHATSAPP_WEBHOOK_VERIFY_TOKEN
- WHATSAPP_APP_SECRET
- WHATSAPP_ALLOWED_PHONE_NUMBER_ID
- MGOS_CRM_SPREADSHEET_ID

Recommended:

- WHATSAPP_ALLOWED_WABA_ID

Google authentication uses one of:

- GOOGLE_SERVICE_ACCOUNT_JSON
- GOOGLE_SERVICE_ACCOUNT_KEYFILE

If neither is supplied, the existing repository convention google-credentials.json is used. Never commit service-account JSON, Meta secrets or access tokens.

## MGOS target schema

The writer uses the current controlled Intake_Queue values:

- source_system = WHATSAPP
- source_type = CUSTOMER_MESSAGE
- source_event_id = Meta messages[].id (wamid)
- processing_status = NEW
- match_status = NO_MATCH until the existing WHATSAPP_CONTROLLED_INTAKE processor resolves canonical identity
- urgency = NORMAL, HIGH or URGENT

Raw incoming message text is not copied into Intake_Queue by this ingress. It records only derived business metadata and a non-content audit note.

## Safety classifications

- BUSINESS_SAFE: explicit Myriad Green service/commercial intent or a Click-to-WhatsApp referral
- PERSONAL: clear non-business personal/social content
- EXPLICIT: explicit sexual text pattern
- SCAM: common scam/guaranteed-return/lottery patterns
- PHISHING: credential/account-verification patterns, especially suspicious links
- SPAM_MARKETING: unrelated bulk marketing/SEO/casino/forex solicitation
- UNKNOWN: intent is not sufficiently proven

A generic greeting such as "Hi" is UNKNOWN, not automatically a lead. This preserves the MGOS rule that unknown is not yes.

## Media policy

The ingress does not fetch image, video, audio, document or sticker bytes. Media without enough safe business context is classified UNKNOWN. Even when a caption proves business intent, the row states NOT_FETCHED_SAFETY_GATE and the media itself remains outside the MGOS evidence store until a separate safe-media inspection stage exists.

## Operational tests before marking PASS

1. Meta GET verification returns hub.challenge only for the configured verify token.
2. A signed irrigation enquiry creates exactly one Intake_Queue row.
3. Replaying the same wamid creates no second business row.
4. A personal message creates no Intake_Queue or CRM row.
5. Explicit text creates no Intake_Queue or CRM row.
6. Scam/phishing text creates no Intake_Queue or CRM row.
7. Generic "Hi" remains HOLD_UNKNOWN.
8. Unsigned or badly signed POST is rejected before payload processing.
9. Wrong phone_number_id is rejected.
10. Force a Sheets write failure, restore the dependency and replay the same wamid; exactly one final row must exist.

Do not change the MGOS audit finding to PASS until the production endpoint is deployed, the Meta app is subscribed to the correct WABA, and the live tests above are read back from Webhook_Diagnostics and Intake_Queue.
