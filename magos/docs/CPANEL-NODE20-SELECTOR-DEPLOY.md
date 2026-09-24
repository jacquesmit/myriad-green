# MAGOS P4 — cPanel Setup Node.js App / Node.js 20

## Current production host

Verified from the migrated HOSTAFRICA account on 24 September 2026:

- control panel: cPanel
- cPanel user: myriaauq
- home directory: /home/myriaauq
- primary domain: myriadgreen.co.za
- cPanel exposes **Setup Node.js App**
- cPanel also exposes Application Manager, but P4 should use **Setup Node.js App** on this Node-capable server
- HOSTAFRICA separately confirmed that the migrated server supports Node.js 20

The provider-supplied DirectAdmin tutorial does not match the actual migrated account UI.

## Do not reuse the old Passenger failure path

The previous server failed because Passenger attempted to execute a missing Node runtime:

    /usr/local/bin/ea-passenger-runtime_nodejs-is-not-installed

That blocker is superseded by the migrated server exposing Setup Node.js App.

The historical Application Manager / Passenger deployment document remains evidence only.

## First manual step

Open:

    cPanel -> Software -> Setup Node.js App

Do not create the application until the Node.js version selector and actual application-root fields are visible.

The next acceptance screenshot must confirm:

- Node.js 20 is selectable,
- whether the application mode supports Production,
- how Application root is expressed,
- how Application URL / domain is selected,
- what Startup file field is presented.

## Expected MAGOS application settings

Subject to the actual cPanel form:

- Node.js version: 20
- Application mode: Production
- Application URL / domain: runtime.myriadgreen.co.za
- Startup file: app.js
- Application root: the actual MAGOS application directory on the migrated server, outside public_html

Do not assume the old repository exists until verified.

The migrated account still reports:

    /home/myriaauq

but the repository path must be read back before use.

## Repository / application layout

Preferred if the old repository migrated intact:

    /home/myriaauq/repositories/myriad-green/magos

Use this path only after File Manager or Git Version Control proves it exists on the new server.

If it does not exist, deploy the current GitHub main to a private application path outside public_html and point Setup Node.js App at the magos directory.

At application root, these must exist:

    app.js
    package.json
    runtime/
    processor/
    writer/
    adapters/
    schemas/
    rules/
    workers/

## Runtime entrypoint

The current hosted entrypoint is:

    app.js

It resolves its listen port in this order:

    PORT -> MAGOS_PORT -> 3000

and binds by default to:

    0.0.0.0

The hosting platform should provide PORT. Do not hard-code a conflicting production port.

## Required secrets

Before starting production runtime:

    MAGOS_RUNTIME_TOKEN
    MAGOS_RUNTIME_VERSION=P3

Google authentication must use one of:

    GOOGLE_APPLICATION_CREDENTIALS=/home/myriaauq/.magos-secrets/google-service-account.json

or:

    GOOGLE_SERVICE_ACCOUNT_JSON=<secret JSON>

Do not paste secrets into chat, GitHub, WordPress, or public_html.

## Google credential migration check

The previous private path was:

    /home/myriaauq/.magos-secrets/google-service-account.json

Because the home directory is still /home/myriaauq, the same path may have migrated, but this is not assumed.

Verify existence and private permissions before setting GOOGLE_APPLICATION_CREDENTIALS.

Desired permissions:

    ~/.magos-secrets     700
    google-service-account.json     600

## Dependency install

Use Setup Node.js App's package/dependency action if provided.

Equivalent command from the MAGOS application root:

    npm install --omit=dev --no-audit --no-fund

Do not run the root website package as the MAGOS runtime package. The Node application package is:

    magos/package.json

## P4 production validation

P4 remains PARTIAL until the actual hosted runtime proves all of the following.

1. Application starts and remains running.
2. https://runtime.myriadgreen.co.za/healthz returns HTTP 200.
3. https://runtime.myriadgreen.co.za/readyz returns HTTP 200 with auth configured.
4. Authenticated POST /v1/probes/google-sheets returns google_sheets=reachable and audit_store=reachable.
5. Hosted TEST-045 proves writer preconditions, intended write/read-back and replay no-duplicate behavior.
6. Global Audit and the P4 acceptance record are updated from production evidence.

## Source activation rule

Do not enable any P5 source adapter merely because the Node app starts.

The following remain OFF until their individual production acceptance passes:

- Fluent Forms direct adapter
- P5O lead ingress source connection
- P5Q supplier-email source connection
- automatic 00A file moves
- supplier-price production mutation
- payment production mutation

Existing verified production paths remain active until parity is proven.

## Truth state

Current state:

    NODE.JS 20 HOST SUPPORT              CONFIRMED BY HOSTAFRICA
    cPANEL SETUP NODE.JS APP             VISIBLE
    HOSTED ENTRYPOINT CODE               PASS IN CI
    PRODUCTION NODE APP CREATED          PENDING
    PRODUCTION /healthz                  PENDING
    PRODUCTION /readyz                   PENDING
    GOOGLE SHEETS PROBE                  PENDING
    HOSTED TEST-045                      PENDING
    P4                                   PARTIAL
