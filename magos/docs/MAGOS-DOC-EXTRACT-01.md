# MAGOS-DOC-EXTRACT-01

Status: CODE IMPLEMENTED / DEPLOYMENT CREDENTIALS PENDING

Purpose: native MAGOS extraction capability for PDFs, scans, invoices, orders, statements and reports entering through 00A or another approved evidence channel.

## Authority boundaries

- Google Drive remains the original evidence store.
- Automation_Run_Log owns runtime idempotency and terminal state.
- Document_State_Register owns extracted-document evidence state.
- Sync_Exceptions is the human review queue.
- The worker does not directly write CRM, Commercial, Supplier, Procurement or Finance business rows.
- Only the MAGOS Transaction Writer may perform those mutations.

## Retry behaviour

The idempotency key is:

    doc-extract:v1:<drive_file_id>:<sha256>

Before extraction, the worker resolves the live Automation_Run_Log header row and searches the current idempotency_key column. COMMITTED, REVIEW_REQUIRED and RUNNING rows are treated as owned events and are not duplicated. FAILED rows are retried by updating the existing run row.

This fixes the previous class of writer errors where a cached row/column target could drift. The adapter resolves headers and the current row immediately before every update.

## Cost behaviour

PDF.co is called only when native extraction does not meet the configured text-quality threshold.

Default paid sequence for a difficult scan:

    presigned upload -> OCR text extraction

AI invoice parsing is OFF by default. Supplier/document templates are opt-in through PDFCO_TEMPLATE_MAP_JSON.

## Deployment inputs still required

- MAGOS_00A_FOLDER_ID
- Google service identity / workload credentials with the required Drive and Sheets access
- PDFCO_API_KEY if paid OCR fallback is desired

The absence of PDF.co credentials is not fatal. Low-quality scans become REVIEW_REQUIRED rather than being guessed or discarded.
