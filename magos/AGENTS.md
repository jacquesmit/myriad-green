# MAGOS repository instructions

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
