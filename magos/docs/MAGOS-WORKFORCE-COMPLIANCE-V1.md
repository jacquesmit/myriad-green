# MAGOS Workforce, Payroll and Labour Compliance V1
Date: 2026-11-26 SAST. Status: REQUIREMENTS DOCUMENTED; implementation, legal registrations and production acceptance pending.
Owner direction: first-class whole-business domain; simple onboarding and low human input. No separate operating system or duplicate authority.

## Authority and integration
Read MAGOS-CURRENT.md first. Reuse MAGOS-TRANSACTION-WRITER-V1.md, MAGOS-P5-EVENT-PROCESSOR-V1.md, MAGOS-P5G-00A-FILING-V1.md, MAGOS-DOC-EXTRACT-01.md, MAGOS-EXECUTABLE-WORKFLOWS-V1.md and MAGOS-OPERATOR-DASHBOARD.md. Existing canonical stores remain authoritative; database migration deferred. Discover existing workforce/labour registers before schema changes. Restrict personnel storage separately from general Control Hub access. Do not add duplicate agents/schedulers. Extend existing weekly runtime report and capability inventory; do not change historic acceptance counts. CORE-003 governed write acceptance and role-based access are dependencies for live sensitive writes, not blockers for manual legal remediation or synthetic tests.

## Operator experience
One guided workflow: Add person -> secure upload -> verify identity/right to work -> choose employment terms -> identify statutory obligations -> generate contract -> sign and archive -> payroll setup -> safety/competency clearance -> active employment. Prefill company details from canonical employer profile; show only missing items and next actions. Existing employees use regularisation path, preserve actual start date, historical employment rights and payment records; do not reset service or invent signed documents. Status dimensions separate employment activity, onboarding, statutory compliance and operational safety. Existing active workers may be non-compliant; urgent safety restrictions must be surfaced without withholding earned wages.

## Canonical data contract (logical, mapping pending)
Employer, Person (opaque ID), Employment (employer, actual start/end, job role, hours, type, effective-dated terms), RemunerationAgreement (gross/net target, frequency, deductions, approved exceptions), PayrollPeriod, PayrollLine, PaymentMatch, Attendance, LeaveLedger, Registration, Obligation, SubmissionReceipt, DocumentEvidence, Training, PPEIssue, RiskAssessment, Incident, Assignment, OffboardingCase. Currency integer cents; dates SAST, immutable effective-dated changes, stable IDs and evidence references. Distinguish unknown from false. Sensitive identity, banking, tax, health and disciplinary data only in restricted records and Drive; no personal data in Git, general 00A, logs, notifications, public WordPress or unrestricted dashboards. Least privilege, access audit, retention schedule, secure deletion and breach process; synthetic fixtures only. Verify existing staff folder access before any ingestion. No broad sharing to bypass permission issues.

## Employment regularisation runbook
1. Confirm actual legal employer and commencement date; identify any prior employer period. Obtain ID/right-to-work and contact details, role, ordinary hours, pay agreement, bank and tax details securely; do not expose them in chat or commits.
2. Reconcile historic bank payments against payroll periods and corroborate with worker/employer; bank payment date alone is not proof of commencement. Separate salary, advances, reimbursements and other payments; unknown items go to review.
3. Check existing employer UIF/SARS/Compensation Fund registrations before creating new ones. Assess PAYE, SDL, UIF coverage, COIDA industry classification, bargaining council/sector coverage and employment equity obligations where applicable. Register via official channels, use true dates, reconcile prior declarations and liabilities, seek authority guidance on arrears/penalties. Compensation Fund registration is urgent; do not claim coverage or letter of good standing before receipt.
4. Prepare written employment particulars, contract, job description, hours/overtime, leave, lawful deductions, grievance/disciplinary procedures and privacy notice. Record actual start and actual signature dates separately. No backdated signatures or new probation imposed on existing staff.
5. Establish accrued leave, timesheets, payroll opening balances and safety history using evidence; do not fabricate historical records. Issue current PPE, induction, competency checks and site risk controls. Escalate unsafe work immediately.
6. Run prospective payroll, issue payslips, reconcile bank settlement; monthly statutory declarations and payment receipts, annual returns/reconciliations as applicable. Owner approves irreversible submissions/payments. No automatic historic deduction recovery.
7. Review evidence and close each obligation separately. Employee remains active while remediation status is tracked. No statutory completion inferred from prepared forms.

## Payroll policy
Default gross-pay agreement; individual net-pay exceptions permitted only by explicit approved, effective-dated agreement. For the owner-approved individual exception, gross up to preserve agreed net pay while recording employee UIF withholding and separate employer contribution; never waive mandatory withholding. Do not store named employee or actual amounts in Git. Solve gross-to-net with versioned statutory rules, rounding and monthly cap across fortnightly periods; validate PAYE including bonuses/benefits and other lawful deductions. Synthetic test: net target 3750, 1% uncapped employee UIF and no PAYE/other deductions => gross 3787.88, employee UIF 37.88, employer UIF 37.88, employer cost 3825.76; provisional only, validate monthly rounding and real circumstances. Historical arrears separate; no retrospective employee deductions without lawful basis. Effective-dated rules include source URL, effective dates, review approval and regression tests.

## Executable workflows and triggers
- Restricted document intake -> review -> canonical employee lookup -> deduplicate -> evidence link; no automatic public filing.
- Employment terms approved -> draft contract -> owner/employee sign -> verify signed receipt.
- Registration due -> check existing reference -> prepare official forms -> owner submits or authorised supported integration -> verified receipt -> reconcile liability.
- Attendance/job completion -> approved hours -> overtime/leave calculations -> job cost allocation (avoid duplicate cost posting).
- Fortnightly payroll -> calculate draft -> review exceptions -> approve -> payslip/payment instruction -> bank match -> close.
- Monthly/annual compliance -> calendar based on effective rules and official deadlines -> draft -> approve -> submit -> reconcile receipts. No unsupported portal automation, credential storage, CAPTCHA bypass or blind submission retries.
- Injury -> immediate human safety escalation -> incident evidence and applicable reporting deadline; never wait for weekly automation.
- Leave/PPE/training expiry -> availability and procurement tasks; restrict assignment where safety/competency requires.
- Offboarding -> lawful process, final payroll/leave, required certificates/declarations, return assets, revoke access, retention.
- Regulatory update -> verify official source, propose rule change, test, approve; no silent tax changes.

## Events and controls
Proposed event types: EMPLOYEE_INTAKE_RECEIVED, IDENTITY_VERIFIED, EMPLOYMENT_TERMS_APPROVED, CONTRACT_SIGNED, REGISTRATION_CONFIRMED, ATTENDANCE_APPROVED, PAYROLL_DRAFTED, PAYROLL_APPROVED, PAYMENT_MATCHED, STATUTORY_RECEIPT_VERIFIED, LEAVE_APPROVED, SAFETY_CLEARANCE_UPDATED, INCIDENT_REPORTED, EMPLOYMENT_ENDED. Map to existing EventEnvelope/decision processor and operation registry before implementation. Stable idempotency keys per employee/period/document/version; audit actor/source/correlation; replay no-op; review queue, retry/dead-letter and ambiguous external write reconciliation. No autonomous legal decisions, disciplinary decisions, payments or submissions until explicit scoped authorisation and accepted integration. Human input only for missing facts, signatures, genuine approvals and exceptions.

## Dashboard and acceptance gates
Workforce panel in existing Command Centre: onboarding next action, compliance due/overdue, payroll drafts and reconciliations, attendance/leave, safety/assignment, labour cost per job; restricted views with masked particulars. Existing finance/procurement/jobs consume only necessary approved fields. Test role isolation including general operator/anonymous access; no sensitive data in logs or public assets.
W01 documentation; W02 existing register mapping and restricted schema; W03 onboarding/regularisation; W04 contracts and statutory workflow; W05 payroll and historic reconciliation; W06 time/leave/assignment; W07 safety/PPE; W08 events/automation; W09 finance/job costing; W10 UI; W11 production acceptance.
Acceptance: synthetic onboarding happy path plus missing ID/duplicate/permission denial; existing employee actual service preserved; gross/net exception isolated; tax thresholds, UIF caps, multiple pay periods, rounding, leave/overtime boundaries; approved write/readback/replay; payment mismatch and failed submission recovery; signed evidence and receipt gates; retention/access tests; production exact SHA, CI, backup/rollback, authenticated UI and controlled real evidence. PASS only for independently verified gates; no new overall percentage. Initial state: W01 documented candidate, W02-W11 pending. No real employee data or registrations written by this specification.

## Official operator links (checked 2026-11-26; verify applicability and current rules before submission)
- BCEA: https://www.gov.za/documents/basic-conditions-employment-act
- UIF registration/declarations: https://ufiling.labour.gov.za/uif/
- SARS UIF: https://www.sars.gov.za/types-of-tax/unemployment-insurance-fund/
- SARS employer guide 2027: https://www.sars.gov.za/guide-for-employers-in-respect-of-employees-tax-2027/
- Compensation Fund employer obligations: https://www.labour.gov.za/DocumentCenter/Pages/Compensation-Fund--obligations-of-the-employer-.aspx
- Compensation Fund registration: https://www.labour.gov.za/DocumentCenter/Pages/COID_How_To_Register_with_the_Compensation_Fund.aspx
Additional official OHS, POPIA, minimum wage and sector-specific verification required before rule activation.
