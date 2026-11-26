# MAGOS repository instructions

## Mandatory current-state reconciliation before any task
Read [MAGOS-CURRENT.md](docs/MAGOS-CURRENT.md) first, particularly its top authoritative handoff; then relevant source/runbook and append-only [MAGOS-STATUS.md](docs/MAGOS-STATUS.md). Historical blockers do not override newer verified evidence. Do not repeat completed deployment, authentication or acceptance tests absent changed code/configuration, new evidence or regression. Distinguish deployed SHA from documentation-only main HEAD, and release/readiness from business golden-path acceptance. Update CURRENT and STATUS together for material changes and reconcile affected Control Hub evidence. Do not use old chat summaries as authority over current verified records.

For production hosting, runtime authentication, or live acceptance tasks, read
[the production cPanel runbook](docs/CPANEL-PASSENGER-DEPLOY.md) first. Use its
verified host settings and commands for `runtime.myriadgreen.co.za`. Check the
host's actual checkout before any deployment. Keep the runbook current when
new host evidence changes the documented setup or acceptance status.

Use the read-only probe to verify connectivity. Record transaction write,
read-back, and duplicate replay evidence separately before declaring a source
production-ready.

## Specialist agent work (mandatory)
Read [MAGOS Agent Orchestration — Controlled Evolution V2](docs/MAGOS-AGENT-ORCHESTRATION-V1.md)
and the canonical Drive MAGOS Agent Job Allocation Matrix, Agent Constitution,
Authority/Routing Contract, Global Audit/Data Ownership, and current host runbook
before changing an agent, routing rule, approval or deployed event flow.

Route by registered JT-### to exactly one AG-###. A code snapshot or markdown
playbook is not live authority. Require tenant, jurisdiction, branch, canonical
record, immutable provider source ID, evidence, a stable idempotency key and
independent approval before any authoritative mutation. All business writes
remain exclusively through the existing EventEnvelope/governed processor and
Transaction Writer. No parallel CRM, quotes, suppliers, task or audit ledger.
Do not activate a registered-only agent or claim production-ready before
AG-013 independent QA, AG-030 approval, hosted commit parity, read-back,
replay and recovery evidence.

## Executable MAGOS work supersedes speculative agent naming

For **new working runtime functionality** start with
[Executable Workflows V1](docs/MAGOS-EXECUTABLE-WORKFLOWS-V1.md).
Name executable capabilities by business outcome, e.g. `lead-intake`,
`supplier-inbox`, `payment-evidence`. Do not create more AG-numeric roles
when a workflow/module/function suffices. Historical AG/JT IDs remain
compatibility/provenance only and are not a prerequisite for a named
workflow executing through an existing governed processor.

This instruction does **not** waive approval, identity, payment, privacy,
canonical ownership or production QA gates. A functional workflow must
pass tests and a live same-key replay/readback acceptance case before
claiming production PASS. Prefer working code and the exact failing
runtime test over new charts, documents or generic agent definitions.

## Shared HOSTAFRICA release testing (mandatory)
Use `npm run test:hostafrica` in an isolated candidate checkout; retain the exact SHA, full log and successful exit status before authorizing deployment. Never interpret a killed process as a passing test or substitute a targeted rerun for full release acceptance. See the cPanel runbook.


## Mandatory shared optimization and output-quality standard
Read [Myriad Green Search, AI Discovery and Conversion Standard](../SEARCH-AI-DISCOVERY-STANDARD.md) for every public-content, website, ecommerce, publisher or public-tool task. All MAGOS work applies relevant provenance, accessibility, data quality, security and maintainability controls; private workflows and records must never be exposed for search indexing. Public outputs require documented acceptance against the shared standard, in addition to existing authority, transaction and release gates.
