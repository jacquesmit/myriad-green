# MAGOS Runtime

This subtree is the in-house MAGOS execution layer. It is deliberately separated from the Myriad Green website application even though it currently lives in the same repository.

## Implemented capability

MAGOS-DOC-EXTRACT-01 processes documents from the 00A intake boundary.

Flow:

1. Read immutable Drive file metadata and bytes.
2. Compute SHA-256 content hash and deterministic idempotency key.
3. Claim the event in Global Audit Automation_Run_Log.
4. Attempt native extraction first.
5. Escalate to PDF.co OCR only if native extraction quality is insufficient.
6. Classify the document.
7. Normalize safe generic fields.
8. Write evidence state to Document_State_Register.
9. Send uncertain extraction/classification to Sync_Exceptions.
10. Terminalise the run only after the audit writes complete.

No supplier, CRM, finance, procurement, quote, invoice, or job table is mutated by this worker. Clear outputs must be handed to the MAGOS Transaction Writer when that runtime endpoint is deployed.

## Local commands

Install:

    npm install

Test:

    npm test

Scan the configured 00A folder:

    npm run scan:00a

Copy .env.example to .env and configure service credentials. Never commit secrets.

## PDF.co cost control

PDF.co is an escalation adapter. Native text extraction is attempted first. The optional AI invoice parser is disabled unless PDFCO_ENABLE_AI_INVOICE=true. Supplier-specific Document Parser templates can be enabled with PDFCO_TEMPLATE_MAP_JSON.

## Production requirement

The service identity must have read access to the 00A Drive folder and write access to the MGOS Global Audit & Remediation Register. PDFCO_API_KEY is optional; without it, difficult scans are routed to review rather than silently accepted.
