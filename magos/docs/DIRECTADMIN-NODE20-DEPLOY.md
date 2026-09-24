# MAGOS P4 — DirectAdmin / Node.js 20 Deployment — PROVIDER-TUTORIAL REFERENCE ONLY

> **Not the current production control panel.** HOSTAFRICA supplied a DirectAdmin tutorial, but the migrated Myriad Green account is visibly running cPanel and exposes **Setup Node.js App**. Use `CPANEL-NODE20-SELECTOR-DEPLOY.md` for the actual P4 deployment. This document is retained only as evidence of the provider guidance received.

## Status

Prepared for the HOSTAFRICA server migration confirmed on 24 September 2026.

The old cPanel/Passenger blocker was:

    /usr/local/bin/ea-passenger-runtime_nodejs-is-not-installed

HOSTAFRICA has moved the domain to a server that supports Node.js 20. This runbook supersedes the old cPanel-specific deployment instructions for the production runtime.

## HOSTAFRICA reference

HOSTAFRICA's DirectAdmin Node.js guide requires:

- Node.js support under Extra Features / Setup Node.js App / Node.js Selector,
- application files outside public_html,
- package.json with dependencies,
- application listening on the hosting-provided PORT,
- Production application mode,
- an explicit application root,
- an explicit application URL,
- an explicit startup file,
- NPM Install,
- Start Application,
- log review if startup fails.

Do not reuse the old server path blindly. The prior path:

    /home/myriaauq/repositories/myriad-green/magos

belonged to the previous server and is not authoritative on the new DirectAdmin host.

## Recommended deployed layout

Use the new DirectAdmin account's actual home directory and domain path.

Preferred logical layout:

    /home/<directadmin-user>/domains/<runtime-domain>/app/

Deploy the contents of the repository's magos directory into that app root so these files are at the application root:

    app.js
    package.json
    runtime/
    processor/
    writer/
    adapters/
    schemas/
    rules/
    workers/
    docs/

Do not place the MAGOS application inside public_html.

If Git is available on the new server and the whole repository is cloned instead, set the Node.js Application Root to the repository's magos directory rather than the repository root.

## DirectAdmin Node.js application values

Use:

- Node.js version: **20**
- Application mode: **Production**
- Application URL: **runtime.myriadgreen.co.za**
- Application startup file: **app.js**
- Application root: the new server's actual MAGOS app directory
- PORT: use the port injected by DirectAdmin; do not hard-code a competing production port

The hosted entrypoint now resolves port as:

    PORT -> MAGOS_PORT -> 3000

and binds by default to:

    0.0.0.0

This keeps the application compatible with the hosting reverse proxy while preserving a fallback for standalone testing.

## Required runtime secrets

Configure secrets in DirectAdmin's environment-variable / application configuration interface where supported.

Required before application start:

    MAGOS_RUNTIME_TOKEN=<secret>
    MAGOS_RUNTIME_VERSION=P3

Google authentication must also be configured using one supported method:

    GOOGLE_APPLICATION_CREDENTIALS=/home/<directadmin-user>/.magos-secrets/google-service-account.json

or:

    GOOGLE_SERVICE_ACCOUNT_JSON=<full JSON secret>

Prefer the private file-path method if the new server allows a protected directory outside the domain's public web root.

Do not paste any token or service-account private key into chat, GitHub, WordPress, public_html, or source files.

## Private Google credential path

Preferred:

    /home/<directadmin-user>/.magos-secrets/google-service-account.json

Target permissions:

    directory: 700
    file: 600

The service account remains:

    magos-runtime@myriad-green-magos.iam.gserviceaccount.com

The production host must prove Google access through the read-only runtime probe before any broader workbook permissions or live P5 sources are enabled.

## Optional variables

Only configure these when required:

    MAGOS_BIND_HOST=
    MAGOS_PORT=
    MAGOS_LEAD_INGRESS_TOKEN=
    MAGOS_LEAD_INGRESS_SOURCES=
    MAGOS_00A_FOLDER_ID=
    PDFCO_API_KEY=

For the initial P4 boot, do not enable provider/source ingress merely because the variables exist.

## Dependency installation

From DirectAdmin's Node.js application interface, use **Run NPM Install** after the application root is configured.

Equivalent package operation:

    npm install --omit=dev --no-audit --no-fund

The application-level package.json is magos/package.json.

## P4 validation sequence

Do not mark P4 PASS until all relevant checks have evidence.

### 1. Process boot

Start the application in DirectAdmin.

Expected startup behavior:

- no missing Node runtime error,
- no missing MAGOS_RUNTIME_TOKEN error,
- no dependency/module error,
- runtime remains running.

### 2. Public health check

Request:

    https://runtime.myriadgreen.co.za/healthz

Expected:

    HTTP 200

and a JSON response indicating:

    service = MAGOS Automation Runtime V1
    status = ok

### 3. Public readiness check

Request:

    https://runtime.myriadgreen.co.za/readyz

Expected:

    HTTP 200
    status = ready
    auth_configured = true

Note: /readyz currently proves runtime-token configuration. Google access is proven separately.

### 4. Google Sheets credential probe

Use the runtime bearer token privately.

POST:

    https://runtime.myriadgreen.co.za/v1/probes/google-sheets

Expected:

    HTTP 200
    google_sheets = reachable
    audit_store = reachable

This proves the deployed Node process can authenticate to Google and read the Global Audit workbook.

### 5. Controlled writer acceptance

Rerun the existing safe TEST-045 transaction acceptance over the hosted /v1/transactions endpoint.

Required evidence:

- authenticated HTTP request,
- correct precondition behavior,
- exactly one intended write where appropriate,
- read-back,
- replay with same idempotency key -> no duplicate,
- audit lineage.

### 6. P4 control update

Only after the hosted checks pass:

- update TEST-045 hosted evidence,
- update the runtime / hosting control register,
- update the P4 acceptance record,
- mark the old HOSTAFRICA Node runtime blocker RESOLVED,
- mark P4 PASS only if all acceptance conditions are met.

## Progressive permissions after P4

Do not grant all MAGOS workbooks to the service account up front.

After Global Audit probe passes:

1. grant CRM only when running the first controlled P5 Evidence_Index / Intake acceptance,
2. grant Commercial for controlled payment acceptance,
3. grant Supplier for controlled supplier acceptance,
4. grant Drive folders only for the exact 00A/file-move test.

Permissions should follow the production acceptance sequence rather than anticipate it.

## Existing production paths remain active

Until parity is proven:

- MGOS Intake & Sync Watch remains active,
- Gmail website lead handling remains active,
- current supplier handling remains active,
- Fluent Forms direct provider adapter remains OFF,
- P5Q supplier email live adapter remains OFF,
- 00A automated file moves remain OFF.

Deploying the runtime is not permission to retire legacy writers.

## Log troubleshooting

If DirectAdmin reports a startup failure, inspect the application logs and the domain logs shown by DirectAdmin. HOSTAFRICA documents domain logs under the account's domains/<domain>/logs/ structure.

Capture the exact first startup error before changing application settings. Avoid simultaneous changes to path, startup file, Node version, environment variables and DNS because that destroys diagnostic evidence.

## Acceptance truth

The server migration means:

    NODE.JS 20 HOST CAPABILITY = CONFIRMED BY HOSTAFRICA

It does not yet mean:

    MAGOS PRODUCTION RUNTIME = VALIDATED

P4 remains PARTIAL until the actual DirectAdmin deployment, health/readiness, Google credential probe and hosted transaction acceptance have all passed.
