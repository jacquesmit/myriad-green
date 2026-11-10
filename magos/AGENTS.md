# MAGOS repository instructions

For production hosting, runtime authentication, or live acceptance tasks, read
[the production cPanel runbook](docs/CPANEL-PASSENGER-DEPLOY.md) first. Use its
verified host settings and commands for `runtime.myriadgreen.co.za`. Check the
host's actual checkout before any deployment. Keep the runbook current when
new host evidence changes the documented setup or acceptance status.

Use the read-only probe to verify connectivity. Record transaction write,
read-back, and duplicate replay evidence separately before declaring a source
production-ready.
