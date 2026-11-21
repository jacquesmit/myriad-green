# MAGOS Operations Command Centre

The existing production page is https://runtime.myriadgreen.co.za/operator.
It uses the same cPanel Node.js application and does not maintain another data store.

| View | Existing authority |
| --- | --- |
| Lead intake and clients | CRM Intake_Queue and CRM_Master |
| Quotes and acceptance review | Commercial Quotes and existing job-activation inspection |
| Jobs, dispatch and work proof | CRM Jobs_Opportunities and Bookings, plus Commercial Job Execution |
| Finance | Commercial Payment Control and Payment_Allocations |
| Procurement and suppliers | Commercial Procurement and Supplier Master Suppliers |
| Exceptions | Global Audit Sync_Exceptions |
| Other registers | Supplier pricing, SEO, publishing and governance open in their existing workbooks |

Payment proof is shown separately from cleared allocation evidence. An ambiguous
canonical ID requires review and is excluded from trusted counts. A failed
source read appears as unavailable. Every successful read shows its check time.

## Deployment and acceptance

Use the [cPanel deployment runbook](CPANEL-PASSENGER-DEPLOY.md) and keep the
existing application root and startup file. Add a new, independent
`MAGOS_OPERATOR_READ_TOKEN` to the existing application's private settings.
Use it at /operator. Keep the general runtime token on the runtime.

1. Deploy the tested dashboard commit and restart the existing app.
2. Open /operator and confirm that the page and its same-origin CSS/JS load.
   Verify the dashboard API denies an unauthenticated read.
3. Load operations with the dedicated credential. Reconcile one live record
   each from leads, quotes, jobs, bookings, finance, procurement, suppliers,
   work proof and exceptions. Record the exact IDs and source links in the
   existing Audit_Tests register. If a source is partial, record the blocker.
4. Check a finance record with both proof and an allocation. Verify the cleared
   amount against the canonical allocation. Confirm Lock removes the loaded
   data and Refresh updates the read time.
5. Record the dashboard read gate separately from business workflow acceptance.
   Quote release, bookings, bank clearance, job creation, procurement and
   publishing still require their existing governed workflows and live read-back.

The snapshot API and existing governed writer interfaces retain their own
authentication and release evidence. The dashboard itself is read-only.
