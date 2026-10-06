# Hosting eBarangayMo

This guide separates the verified local demo from a possible school-hosted academic demo. **No school server, hosted database, or public application URL has been verified or deployed.** Do not use real incident or resident data until the institution approves the application, data handling, privacy roles, and retention policy.

## What is known—and what is not

- `admin.dcism.org` was identified as an application administration portal.
- `dbadmin.dcism.org` was identified as a MySQL administration portal.
- Neither portal address establishes the Node host, MySQL hostname, database name, or final public app URL.
- Local development has been verified with Node.js, Vite, Express, and a synthetic MySQL database. School Node version, proxy behavior, HTTPS, network rules, DB grants, backup arrangements, and deployment workflow remain unconfirmed.

Ask the responsible school administrator or project supervisor to provide and approve these values before deployment:

| Area | Confirm before proceeding |
| --- | --- |
| Node runtime | Supported Node.js version (at least the version required by `package.json`), install/build method, start command, process restart behavior, and injected `PORT` |
| Public routing | Exact public HTTPS origin, domain/subpath behavior, reverse-proxy routing to Node, forwarded host/protocol headers, and whether the app can serve its frontend and API on one origin |
| MySQL | Actual host and port, MySQL/MariaDB version, TLS/network requirements, an isolated database/schema, least-privilege account, connection limits, and which migration privileges are permitted |
| Operations | How secrets are stored, who can access logs, backup/restore and retention arrangements, and how to stop/roll back a failed academic demo |
| Data approval | Whether any real personal data is permitted; controller/processor responsibilities, consent/notice, access roles, correction, export, retention, and deletion requirements |

Do not test access to the school portals or guess connection details. Request them through the authorized school contact.

## Deployment boundary

The academic demo is not production-ready. It has no verified production hosting arrangement, formal backup/restore drill, operating monitoring, incident response process, privacy review, or official government approval. Obtain explicit authorization before uploading or starting it, creating a hosted database, running a migration, changing firewall rules, or handling real personal information.

Until data handling is approved, use only synthetic records. Never copy the local demo credentials, sample `.env`, session token, or seed data as a production configuration. Never expose DB credentials or `SESSION_SECRET` to Vite/client-side variables, browser bundles, screenshots, or Git.

## Application layout

The intended hosted request flow is same-origin:

```text
Browser -- HTTPS --> school reverse proxy --> Node/Express
                                             ├── /api/* --> MySQL
                                             └── frontend routes/assets --> apps/web/dist
```

The API server can serve the built frontend when `WEB_DIST_PATH` points to the deployed `apps/web/dist` directory. `npm run build` creates that bundle; `npm start` starts the API and does not itself build the frontend. The deployed UI should use relative `/api` requests, not a hardcoded local address. See [the API contract](API_CONTRACT.md) for the session, Origin, CSRF, and tenant rules.

## Prepare a host only after approval

1. **Confirm deployment settings.** Obtain the exact HTTPS browser origin and actual DB endpoint/account from the authorized administrators. Confirm the app can be routed at the domain root or document the supported subpath behavior before publishing a QR code.
2. **Provision isolated resources.** Request a new project database/schema and a dedicated least-privilege application user. Do not reuse a shared school schema or a broad administrator account. The user requires only the operations supported by the approved migrations/runtime. Keep test and demo DB credentials distinct from other school systems.
3. **Configure server-only variables through the hosting control panel.** Use actual approved values for:
   - `NODE_ENV=production`
   - `PORT` as injected by the host, if applicable
   - `APP_ORIGIN=https://<approved-public-app-origin>` (exact origin, no path/trailing route)
   - `PUBLIC_APP_URL=https://<approved-public-app-origin>` (or the confirmed canonical public base URL if a supported subpath is used)
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` from the school administrator
   - `DB_CONNECTION_LIMIT` within the school's per-account limit
   - `SESSION_SECRET` as a generated, stable secret of at least 32 random bytes; never rotate it casually because it signs active sessions
   - `WEB_DIST_PATH` as the actual absolute path to the deployed frontend build directory
4. **Build and stage files.** With the approved Node runtime and lockfiles, install dependencies with `npm ci` at the root and the app-level install command as required by the hosting workflow (`npm run install:apps` uses each app lockfile). Build the UI with `npm run build`. Keep credentials out of the build and repository. Confirm the host preserves `apps/web/dist` and starts the API from the expected project root.
5. **Validate proxy and cookies.** The API uses `trust proxy` in production and secure session cookies. Confirm that the reverse proxy terminates HTTPS, supplies trusted forwarded headers, and routes the browser and `/api` to the same application origin. Confirm cookie behavior, including `Secure`, `HttpOnly`, `SameSite=Lax`, and the configured host/path. Do not relax Origin or CSRF checks to get around a proxy mismatch.
6. **Review migrations before any execution.** Inspect migration SQL and obtain permission to run it against the newly created isolated project DB. Confirm backup/snapshot and restore plan first. Run only the schema migration against the approved target. Do not run destructive resets, local E2E setup, or demo seed commands against production/shared data. The seed contains synthetic demo users and must not be treated as production provisioning.
7. **Use a controlled release check.** Start the service only after the administrator approves. Check the HTTPS login screen, authentication, session persistence across restart, staff Origin/CSRF checks, public barangay form and QR destination, report review, upload/path behavior, and sanitized errors. Confirm two seeded/synthetic tenants cannot access each other's cases and reports. Verify no personal details appear in public metadata or routine logs.
8. **Confirm recoverability and shutdown.** Test restore using the administrator's approved process, record who can stop the app and how to revert the deployment, then remove any temporary synthetic records through an authorized, non-destructive cleanup process. Do not claim completion until the project supervisor approves the acceptance results.

`npm run test:e2e` is a local test command: its Playwright configuration deliberately starts fresh loopback servers and targets the isolated test DB `ebarangaymo_test`. Do not point it at a hosted environment. Local Compose settings and synthetic passwords are never production values.

## Current status

Only the local synthetic MySQL, API, and browser flows have been exercised. The school connection and hosting process remain unverified, no deployment or hosted DB operation has occurred, and the project must not be described as production-ready or DILG-compliant. Statistical exports require verification against the applicable official template and definitions before making a compliance claim.
