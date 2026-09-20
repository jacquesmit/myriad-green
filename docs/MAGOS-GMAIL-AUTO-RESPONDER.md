# MAGOS Gmail Auto Responder — MGOS-GMAIL-AUTO-RESPONDER-001

## Purpose

Native MAGOS capability for scanning new Gmail messages, blocking unsafe/non-business mail before any model call, creating personalized replies with OpenAI, sending only when the message and generated reply both pass controls, and preserving canonical source-event lineage in Intake_Queue.

This is MAGOS infrastructure. Make is not part of the runtime path.

## Flow

Gmail -> Gmail API -> MAGOS Gmail worker -> deterministic safety gate -> Intake_Queue -> OpenAI reply generation -> output guard -> Gmail draft/send -> labels + audit + idempotency read-back

## Safety and cost rules

1. Gmail SPAM/TRASH are excluded from candidate retrieval.
2. Automated/list mail, personal messages, porn/explicit text, spam and phishing are blocked before the OpenAI API is called.
3. Profanity, financial/legal messages, unknown intent, executable attachments and uninspected image/video attachments are routed to MAGOS/Review with no model call.
4. Only BUSINESS_SAFE mail can reach reply generation.
5. Generated replies containing internal-system references, prices, payment-clearance claims, booking confirmation or guarantees are forced to draft/review.
6. MAGOS_GMAIL_AUTO_SEND=false is the safe default. In this mode safe replies are drafted, not sent.
7. The worker never downloads attachment bytes.
8. Every Gmail message is idempotently claimed in Firestore before mutation.
9. Business/review messages are represented in the canonical Intake_Queue using the immutable Gmail message ID as source_event_id.
10. Original Gmail messages remain the source evidence; raw bodies are not copied into Intake_Queue.

## Required environment variables

- MAGOS_WORKER_SECRET
- GMAIL_CLIENT_ID
- GMAIL_CLIENT_SECRET
- GMAIL_REFRESH_TOKEN
- GMAIL_ACCOUNT_EMAIL
- OPENAI_API_KEY
- MGOS_CRM_SPREADSHEET_ID
- Google Sheets service-account credentials already used by MAGOS: GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_KEYFILE

Optional:

- GMAIL_REDIRECT_URI
- GMAIL_SEND_AS
- OPENAI_MODEL (defaults to gpt-5.6-luna)
- MAGOS_GMAIL_AUTO_SEND (false by default)
- MAGOS_GMAIL_QUERY

## Worker endpoint

POST /internal/magos/gmail/process

Header:

x-magos-worker-secret: <MAGOS_WORKER_SECRET>

Optional JSON body:

{"maxMessages":10}

Health:

GET /internal/magos/gmail/health

## Gmail labels

- MAGOS/Processed
- MAGOS/Review
- MAGOS/Drafted
- MAGOS/Auto Replied
- MAGOS/Blocked Spam
- MAGOS/Blocked Explicit
- MAGOS/Blocked Phishing
- MAGOS/No Reply

## Production activation sequence

1. Deploy the MAGOS backend on an always-available HTTPS runtime.
2. Complete Gmail OAuth for the business mailbox with read/modify/send/draft permissions and store only refresh-token/secret values server-side.
3. Keep MAGOS_GMAIL_AUTO_SEND=false.
4. Run controlled tests for safe enquiry, replay/duplicate, profanity, porn/explicit, spam, phishing, bank-detail change, image attachment, automated sender and OpenAI failure.
5. Read back Gmail labels/draft state, Intake_Queue, Webhook_Diagnostics and Firestore claim state.
6. Enable auto-send only after all tests pass. Payment/bank/legal/media/unknown categories remain review-only even after auto-send is enabled.

## Current status

Code implementation: IMPLEMENTED ON FEATURE BRANCH.

Production deployment/authentication/live replay: NOT YET VALIDATED.

Auto-send: OFF BY DEFAULT.
