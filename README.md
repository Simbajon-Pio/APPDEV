# eBarangayMo

**Digital Blotter & Community Incident App**

A civic-service web application for barangays that need a more reliable way to record and review community incidents than handwritten logs. The academic project targets barangays and city government units in Cebu City, Mandaue, and Lapu-Lapu. Its long-term goal is a clear, searchable record of how incidents are received and handled—while keeping residents’ personal information private and each barangay’s records isolated.

This repository is the release codebase, not the prototype on `development`. The application is being built from the reviewed `main` baseline with a small React/Vite frontend, an Express API, and MySQL. It is an academic project, not a production-ready government service.

## Product goals

The intended application brings three parts of barangay incident handling into one coherent service:

- **Record keeping:** help authorized desk staff record a walk-in incident, find its blotter, see its history, and update its status.
- **Resident reporting:** give residents a barangay-specific link or QR code to submit an incident for staff review, without creating a resident account or exposing case data.
- **Useful reporting:** build future analytics, location summaries, and statistical exports from saved records, with clearly described definitions and without exposing names, contact details, or narratives in aggregate views.

For a proposed SaaS model, barangays or participating city units would pay for staff tools; resident submissions remain free. Pricing in the project plan is illustrative, not validated market research. The application does not implement billing or sell resident data.

## Product and data principles

- **Private by default:** every staff query is scoped to the signed-in staff member’s assigned barangay. A client request cannot choose its own tenant, creator, or audit metadata.
- **Review before official acceptance:** a resident report is a submission for staff review, not automatically an official blotter or emergency-response channel. The original is preserved when staff approves or rejects it.
- **Traceable records:** official blotters receive a server-issued number and creation metadata. Status updates retain a staff/time/reason history; created records are not hard-deleted through the Sprint 2 application.
- **Faithful facts:** unknown identities, contacts, addresses, and residency stay unknown. Staff must not invent information absent from a resident’s original report.
- **Persistent, testable behavior:** MySQL is the application database. Tests and demos use explicitly synthetic records and isolated local databases, never genuine resident data.
- **Usable civic interface:** keep the UI readable, restrained, keyboard-accessible, and usable on phones, tablets, and desktop screens. Statuses have text labels as well as semantic colors.
- **Honest scope:** do not present mock data, simulated SMS, placeholder reports, unverified DILG compliance, or an academic demo as production functionality.

## Long-term roadmap

The destination is a tenant-isolated incident-record system with dependable intake, resident submissions, auditable staff review, and meaningful aggregate reporting. Analytics, map views, and statistical exports are future work and must be based on persisted tenant data with documented definitions. Resident accounts, SMS, payment processing, attachments, and hearing/KP automation are not part of the current core release.

### Current implementation stage

Sprint 2 builds the connected desk-officer and resident-report workflows: staff sign-in, complete blotter intake and drafts, tenant-scoped search/details/status history, resident submissions, staff review, and once-only conversion to an official blotter. The code and local tests are available, but the sprint is not declared fully accepted or deployed; check current test results rather than relying on this paragraph as proof.

## Run locally on Windows

### Prerequisites

- Node.js **22.12.0 or newer** and npm.
- Docker Desktop running.
- PowerShell in the repository root.

### First-time setup

1. Install the root and app dependencies:

   ```powershell
   npm install
   npm run install:apps
   ```

2. Start the local MySQL container. It is bound to loopback only and uses the synthetic database `ebarangaymo_test` on port `3307`:

   ```powershell
   docker compose up -d --wait mysql
   ```

3. Create the ignored API environment file:

   ```powershell
   Copy-Item apps/api/.env.example apps/api/.env
   ```

   Open `apps/api/.env` and check the local values. The development app origin and public URL must both be `http://127.0.0.1:5173`; the database host, port, name, user, and password should match the example and local Compose service. The supplied DB password is for this local synthetic container only.

   Generate a unique session secret in PowerShell:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Copy that output into `SESSION_SECRET` in `apps/api/.env`. Do not commit or share the `.env` file or generated secret. `DEMO_PASSWORD` is a synthetic local-demo password, not a production credential.

4. Apply the schema and insert the repeatable synthetic demo accounts:

   ```powershell
   npm run db:migrate
   npm run db:seed
   ```

### Start the app

Run the API and frontend in **separate PowerShell terminals**, both from the repository root:

```powershell
npm run dev:api
```

```powershell
npm run dev:web
```

Open **http://127.0.0.1:5173/login**. Use the seeded synthetic account `demo_a` or `demo_b` and the password in `DEMO_PASSWORD` (default: `DemoOnly!2026`). These demo identities and records are for local demonstration only.

Keep using `127.0.0.1` for the UI address. Do not open the UI through `localhost` or port `5000`: the API validates the exact browser Origin, and port `5000` is not the Vite UI. Vite forwards relative `/api` requests to the local API.

Stop each development server with **Ctrl+C**. Stop MySQL while preserving its database volume with:

```powershell
npm run db:stop
```

`npm run db:down` removes the local Compose containers/network but preserves the named database volume. Do not add `-v` if you want to keep local data.

## Build, tests, and lint

```powershell
npm test
npm run lint
npm run build
```

`npm test` runs the API and web unit suites. `npm run test:integration` runs the MySQL-backed API integration workflow; configure it for the loopback-only database whose name ends in `_test`. Never aim it at a school/shared database. `npm run test:e2e` launches fresh API and Vite servers in Chromium and exercises real browser/API workflows; the local MySQL container must already be running, migrated, and seeded. Playwright does not start or prepare MySQL for you.

`npm run build` creates the frontend production bundle under `apps/web/dist`; it does not start the app. `npm start` starts only the API. To have Express serve the built UI, configure `WEB_DIST_PATH` to the deployed `apps/web/dist` directory. For normal local UI development, use `npm run dev:web`.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Login or a write returns **403** | Open the UI at `http://127.0.0.1:5173`, confirm `APP_ORIGIN` matches exactly, and retry from the UI so its CSRF flow runs. Do not change the server to accept arbitrary origins. |
| Invalid demo login returns **401** | Run `npm run db:seed` against the isolated local demo DB, then use the current `DEMO_PASSWORD` value from your local environment. |
| A page returns **404** | Make sure you are using the Vite URL for frontend routes and that both API and UI processes are running. The API alone does not serve the UI unless `WEB_DIST_PATH` points to a completed build. Unknown API paths and unknown barangay slugs intentionally return 404. |
| API reports a database connection error | Check Docker Desktop and `docker compose ps`; start MySQL, compare `.env` with the local Compose port/name/user, then run migration and seed. |
| Vite cannot start or port 5173 is occupied | Stop the other Vite process or inspect its owner. Vite intentionally fails rather than silently changing the configured origin/port. |
| `npm run test:e2e` cannot find Chromium | Install the Playwright browser for this repo with `npx playwright install chromium`, then rerun the E2E command. |

## Repository structure

```text
apps/api/             Express API, MySQL access, session/security code, backend tests
apps/web/             React/Vite UI, API client, feature pages and frontend tests
database/migrations/  Versioned MySQL schema changes
database/seed.js       Synthetic local demo accounts and tenant seed
 tests/e2e/            Chromium end-to-end checks
 docs/                 Project goals, API contract, sprint scope, hosting guidance
AGENTS.md              Canonical contributor and AI policy
CLAUDE.md              Required-reading entry point for Claude contributors
```

## Contributing and branches

Read [AGENTS.md](AGENTS.md) before changing code. Keep responsibilities in the matching task branches and integrate into the sprint branch only after review and checks:

- `main`: reviewed release baseline; do not add task work directly.
- `SPRINT-#`: integration branch for one sprint; for this work, `SPRINT-2`.
- `T#`: task branch based on the assigned sprint; Sprint 2 uses `T3` (backend) and `T4` (frontend).
- `development`: historical groupmate prototype, reference-only; do not import or merge it automatically.

Do not commit secrets, genuine blotter information, or local `.env` files. Use test-first changes, synthetic test records, and isolated MySQL. Report actual verification outcomes. Pushes, hosted deployments, school database work, Jira updates, or PRs require explicit authorization.

## Project references

- [Project plan](docs/PROJECT_PLAN.md) — product goals, architecture, privacy, design direction, business proposal, and roadmap.
- [API contract](docs/API_CONTRACT.md) — shared request/response, validation, auth, and tenant-isolation behavior.
- [Sprint 2](docs/SPRINT-2.md) — current task boundaries, acceptance criteria, and verification checklist.
- [Hosting guide](docs/HOSTING.md) — school-hosting prerequisites and a safe deployment checklist.
- [Contributor policy](AGENTS.md) — canonical branch, scope, security, and contributor rules.

## Hosting boundary

The school portals `admin.dcism.org` and `dbadmin.dcism.org` are administration portals; they are **not confirmed** application/public URLs or database connection hosts. Read the [hosting guide](docs/HOSTING.md) and confirm the actual Node.js runtime, reverse-proxy setup, HTTPS URL, MySQL endpoint, permissions, and privacy approvals with the administrators before deployment. This repository does not contain school credentials, and no school deployment or database operation has been performed.

Statistical outputs must not be called DILG-compliant until the applicable template, formulas, categories, and definitions are verified. Prices and costs in the business proposal are hypotheses, not proven market results.
