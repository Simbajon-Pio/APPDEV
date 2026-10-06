# eBarangayMo Project Plan

**Digital Blotter & Community Incident App**

**Stage:** implementation in progress; completion depends on the verification below.

**Audience:** project teammates and their AI contributors.

## 1. Purpose and success criteria

Build a functional academic final-project web app that replaces handwritten incident intake with structured, searchable barangay records. The project targets barangays and city government units in Cebu City, Mandaue, and Lapu-Lapu.

The stated problems—illegible notes, misplaced records, and slow manual reporting—are project hypotheses to validate with staff, not independently measured adoption statistics.

The final-project release succeeds when:

- A desk officer can record, retrieve, and track a case without a paper notebook.
- A resident can submit a report that persists until authorized staff review it.
- Staff can convert an accepted submission into exactly one official blotter.
- Two barangays use the same app without accessing each other's records.
- Analytics and a statistical PDF reconcile with stored cases and clearly state their definitions.
- The UI is usable on phones and desktops, with deliberate typography, clear information hierarchy, and complete feedback states.
- The proposal explains who pays, why they would pay, and what operating costs exist.

This is not a production launch. Avoid enterprise infrastructure, automated billing, and extra workflows that do not serve these outcomes. Security and truthful behavior are still required because case records contain personal information.

## 2. Users and product boundaries

| User | Needs | Sprint 2 access |
| --- | --- | --- |
| Barangay desk officer / secretary | Log walk-ins, find records, review resident submissions, track status | Authenticated access to one assigned barangay |
| Resident | Send an incident report without visiting the hall | Public barangay-specific form; no case-data access |
| Barangay leadership / city buyer | Understand service value and aggregate outcomes | Business proposal; city-wide administrative access is not implemented |

Staff accounts are provisioned through a controlled command/seed, not public signup. Resident accounts, public case search, password-recovery flows, and staff tenant switching are not Sprint 2 features.

## 3. Roadmap

### Sprint 2 — core connected workflows

Board dates: **October 1–13, 2026**.

- Staff sign-in/out, protected routes, and persistent server sessions.
- Standardized US1 intake with valid saved drafts.
- Persistent, tenant-scoped blotter creation, list/search/filter/pagination, details, status transitions, and event history.
- Public resident submission by barangay link or actual QR code.
- Persistent staff review queue, rejection with reason, and atomic approval/conversion.
- Basic counts from live records, not mocked charts.

Explicitly excluded: heatmaps, statistical PDF export, attachments, SMS, payment processing, resident accounts, hearing scheduling, and KP summons/CFA automation.

### Sprint 3 — final-project completion

Board dates: **October 13–27, 2026**.

- Date-filtered analytics and defined resolution KPIs.
- Location visualization sourced from real stored incident locations or documented sitio/purok centroids.
- Statistical PDF export using a verified template, or clearly labelled as a draft template.
- Audited record corrections where needed; preserve original creation and submitted-report data.
- Accessibility/usability polish, synthetic demo data, school-hosted deployment, and end-to-end verification.

These features need their own specifications and numbered tasks before implementation. Do not add them silently to T3/T4.

### Beyond the final project

Payments, self-service tenant onboarding, resident accounts/recovery, SMS, attachments, detailed hearing/KP workflows, city-wide roles, and operational hardening are future work.

## 4. Existing prototype and release baseline

`development` is the groupmate's prototype. Leave it untouched. `main` contained only the initial README when this plan was approved; `SPRINT-2` starts from that baseline without merging or cherry-picking the prototype.

Reference paths exist on `development`, not necessarily on this branch:

- `ebarangaymo/ebarangaymo-frontend/src/App.jsx`: intake fields, UI concepts, and list/create/status calls.
- `ebarangaymo/ebarangaymo-backend/server.js`: parameterized SQL and basic blotter routes.
- `ebarangaymo/ebarangaymo-backend/db.js`: environment-configured MySQL pool.

Retain safe concepts and the supplied US1 requirements, not the prototype wholesale. Its resident queue and heatmap are mocked, search is unwired, creation accepts tenant/creator values from request bodies/defaults, listing is unscoped, and case numbering uses an unsafe read-last/increment pattern. Authentication, schema migrations, and tests were not tracked. Database-backed routes were inspected but not runtime-verified.

US1's Done status in Jira does not prove that release acceptance checks pass.

## 5. Architecture

Use **React + Vite, Express, and MySQL**, with JavaScript, explicit server-side validation, and automated tests. Keep the team's familiar stack rather than introducing a managed-backend migration or TypeScript rewrite.

Planned layout, created during later implementation:

```text
apps/api/                 Express routes, middleware, services, SQL access, tests
apps/web/                 React routes, feature components, API client, shared UI, tests
database/migrations/      Versioned, ordered MySQL migrations
database/seeds/           Repeatable, explicitly synthetic demo data
docs/                     Product plan, sprint scope, shared contract
AGENTS.md                 Canonical contributor/AI policy
CLAUDE.md                 Required-reading pointer for Claude contributors
README.md                 Project stage, documentation, later runnable instructions
```

Each app owns its package manifest and lockfile. Choose supported, stable dependency versions after confirming the school Node runtime; lock them during implementation.

Keep server startup separate from application construction so tests can exercise the app without starting a listening process. Separate authentication, blotters, resident review, validation, and SQL services. Keep React pages/forms, shared controls, routing, and API requests separate. Do not reproduce a single-file application.

### Request flow

1. React calls relative `/api` URLs through one client that checks HTTP status and maps structured errors.
2. Vite proxies those requests during development.
3. Hosted Express serves the built frontend and API under one origin.
4. Staff middleware resolves the authenticated user/tenant before scoped services query MySQL.
5. Public reporting resolves a barangay slug independently; it never grants staff privileges.

Do not put database credentials or hardcoded localhost API URLs in components. Do not silently retry mutations after an ambiguous network failure.

## 6. Identity, tenant isolation, and audit integrity

### Staff authentication

- One staff account belongs to one barangay and its city in Sprint 2.
- Hash passwords; store sessions in MySQL so a server restart does not discard valid sessions.
- Use HttpOnly, SameSite cookies, with Secure cookies and HTTPS on hosting.
- Protect state-changing staff requests with CSRF tokens and origin checks. Restrict any development CORS allowance to the configured origin.
- Bound input sizes and rate-limit sign-in/public submission.
- Return sanitized errors; do not log passwords, session values, narratives, contacts, or raw database failures.

### Tenant enforcement

Staff `barangay_id`, `city_id`, creator identity, and creation timestamp come from authenticated server/database context. Reject requests attempting to supply protected fields.

Apply tenant predicates to list, search, detail, status changes, history, resident review, conversion, and aggregates. Group SQL search conditions correctly so `OR` clauses cannot bypass tenancy. Return 404 for other-tenant record IDs without exposing their existence.

The public form resolves its tenant through a validated URL slug. Residents cannot select arbitrary tenant IDs or read case data.

### Minimum entities

| Entity | Responsibility |
| --- | --- |
| `cities` | Stable city identity |
| `barangays` | City relation, unique stable code, public slug, display context |
| `users` | Hashed staff credentials and assigned tenant |
| `sessions` | Persistent, expiring server-side session data |
| `blotters` | US1 fields, immutable identity/audit metadata, status, submission/update metadata |
| `case_sequences` | Transaction-locked counter per barangay/year |
| `case_events` | Append-only application event history with actor/time/reason |
| `resident_reports` | Original validated submission, acknowledgement reference, review state, linked case |

Enforce valid barangay/city relationships and unique case/report links. Index tenant/date, tenant/status, and relevant tenant/location/category access patterns. Use `utf8mb4`, parameterized SQL, and InnoDB transactions.

Creator, creation time, case number, and tenant cannot change through application endpoints. This is application-level audit integrity, not a claim that database administrators cannot alter data.

### Case numbering and dates

Format: **`BLOT-[BRGY]-[YEAR]-[00001]`**.

- Use a configured, unique barangay code—not the first three characters of its name.
- The year is the server's intake year in **Asia/Manila**, not the incident year.
- Allocate the next sequence inside the transaction that saves the case and creation event. Lock the counter row and enforce uniqueness.
- Never use unlocked `MAX()+1` or read-last/increment allocation.
- Concurrent saves must produce distinct case IDs; do not promise gap-free numbering.
- Keep the case ID on all later status updates, including draft submission.
- Store timestamps consistently in UTC. Display and filter by Philippine civil dates in Asia/Manila. Require explicit-offset/UTC timestamps at the API boundary.

## 7. Desk intake and status lifecycle

The supplied US1 is the requirements reference:

> As a Barangay Desk Officer / Secretary, I want to log walk-in disputes and incidents into a standardized digital intake form so that we eliminate paper notebooks, prevent lost dispute records, and structure incident data for DILG reports.

### Intake fields

| Group | Fields and rules |
| --- | --- |
| Case identity | Server-generated blotter number |
| Incident | Category; required incident date/time; required sitio/purok; optional landmark/street address |
| Complainant | Required full name; optional contact/address; explicit residency selection or unknown |
| Respondent | Name/contact/address/residency where known; explicit unknown respondent is allowed |
| Narrative | Required plain-text incident summary and initial actions; no fabricated details |
| Initial status | Draft, Pending Lupon, Settled at Desk, or Referred to PNP |

Categories: Curfew Violation; Videoke / Noise Disturbance; Property Dispute; Physical Altercation; Debt / Financial Dispute; Others.

The UI and API both validate required fields, enums, lengths, and supplied contacts. Unknown respondents are represented as unknown/null rather than a fabricated name. Do not assume residency or copy incident location into a party's home address.

### Draft interpretation

A Sprint 2 Draft is a **valid saved entry**, not incomplete autosave. It passes the same required-field checks and receives a case number on first save. It is excluded from the default Active list and statistics, but visible through a Draft filter.

Submitting the draft changes its status and records its submission time. It keeps its original creation time, creator, and case number. Order the Active list by official submission time so a newly submitted draft appears at the top. Partial drafts and autosave are outside Sprint 2.

### Status updates

- Draft may become an allowed initial non-draft status.
- Pending Lupon may become Settled at Desk, Referred to PNP, or Unresolved.
- Reopening Settled at Desk, Referred to PNP, or Unresolved returns the case to Pending Lupon and requires a reason.
- An official case cannot return to Draft.
- Every change records actor, timestamp, previous/new status, and required reason.
- Reject stale/conflicting transitions; do not let an outdated screen overwrite another update.
- Do not offer hard deletion.

Search by case number or party name; filter by category, status, sitio/purok, and incident-date range. Paginate results and expose full details/history only to the tenant's staff.

## 8. Resident submission and review

1. Open `/report/:barangaySlug` by URL or a genuine QR code encoding that URL.
2. Display the target barangay, privacy/use notice, and a statement that the form is not an emergency-response channel or automatic official case acceptance.
3. Collect reporter name, optional contact, category, incident date/time, sitio/purok, optional landmark/known respondent, and narrative.
4. Persist Pending Review and return a random acknowledgement reference. Success means stored for review—not a sent SMS or accepted blotter.
5. Staff review their tenant's original submission, complete/confirm intake details, and approve or reject with a reason.
6. Approval locks the submission and atomically allocates a case number, creates one blotter/event, and links/marks the report approved.
7. Guard repeated/concurrent approval and approval/rejection races. Retrying approval must not create a second blotter or overwrite the original submission.

Keep original submitted values separately from staff-confirmed intake. Review can clarify unknown details; it cannot invent contacts, parties, or dates.

No resident accounts, public blotter list, party-name lookup, or reference-based personal-data access exist in Sprint 2. Rate limits, bounded input, and a honeypot provide baseline abuse controls, not a claim of production hardening.

## 9. UI/UX direction

Create an approachable civic-service workspace, not a generic three-accent dashboard template.

- Use restrained neutral surfaces, readable typography, strong hierarchy, consistent spacing, and purposeful brand accents.
- Use semantic colors for status with text labels. Avoid arbitrary card colors, gradient-heavy heroes, excessive rounded cards, and decorative effects.
- Use one readable type system and system fallback; use tabular numerals or monospace selectively for case IDs.
- Staff navigation: **Overview**, **Blotter Records**, **Resident Reports**. Keep account/tenant context visible. Hide unavailable map/report actions rather than making them look functional.
- Group intake by incident/location, complainant, respondent, and narrative/status. Distinguish required, optional, and unknown values.
- Keep search/filter state visible. Use a focused table and readable full-page or scoped-drawer details/review; avoid nested large modals.
- Make the resident form mobile-first and simpler than the staff workspace.
- Include loading, empty, error/retry, success, disabled/submitting, expired-session, and stale/conflict states. Preserve input on failure and prevent accidental duplicate sends.
- Support keyboard navigation, associated labels, visible focus, dialog focus management, and accessible contrast.
- Check layouts near **400px, 768px, and 1440px**. Only a table may scroll horizontally inside its own container; navigation remains usable on mobile.

Load applicable frontend-design skills before building the UI and data-visualization skills before creating charts/maps/KPI displays. This planning phase creates no mockups or chart implementation.

## 10. SaaS business model

### Customer and offer

**Buyer:** barangay leadership/administration or a city government unit.

**Users:** authorized desk officers, secretaries, and staff.

**Residents:** free reporting access.

Offer one standard barangay subscription covering staff access, blotter management, resident reporting, and completed analytics/export features. Benefits are structured intake, traceability, searchable records, consistent incident data, and less manual statistical compilation.

Optional onboarding/training fees must be tied to real effort. City contracts bundle separately isolated barangays; they do not automatically grant city employees access to personal case records.

### Illustrative pricing hypothesis

| Offering | Example price | Status |
| --- | --- | --- |
| One barangay, monthly | ₱1,500/month | Proposal assumption, not validated market pricing |
| One barangay, annual | ₱15,000/year | Proposal assumption; monthly equivalent ₱1,250 |
| City bundle | Quote per participating barangay | Specify any volume discount and resulting support cost |

Do not implement billing/payment processing to demonstrate this model. Show two synthetic tenants using the same features with isolated data.

### Operating-cost model

Budget for hosting/database/storage, backups and restore testing, onboarding/training, support time, maintenance, and security/privacy work. School hosting helps the demo; it does not prove a commercial service can operate for free.

Illustrative **monthly-plan** scenario only:

| Item | Assumption |
| --- | --- |
| Fixed monthly overhead | ₱3,000 |
| Variable monthly cost per tenant | ₱500 |
| Monthly revenue per tenant | ₱1,500 |
| Contribution per tenant | ₱1,000 |
| Operating-overhead break-even | 3 monthly-plan tenants |

This excludes development recovery, taxes, sales, and additional salaries. Annual discounts and city bundles change the calculation. It is not a profitability claim.

### Validation and adoption

1. Interview prospective staff to validate the intake/reporting problem and current process.
2. Demonstrate synthetic cases and measure time to log/find a case and prepare a report.
3. Pilot only with authorized participants; collect usability/support feedback.
4. Test willingness to pay and procurement constraints before treating prices as viable.
5. Clarify data-controller responsibilities, processing terms, access, retention, export/deletion, hosting suitability, and backup needs before real government use.

Do not sell resident data. Do not imply official government affiliation, verified legal compliance, or production readiness from the academic demo.

## 11. Hosting and privacy prerequisites

The user confirmed MySQL school hosting and Node.js app support:

- `dbadmin.dcism.org`: database-administration portal.
- `admin.dcism.org`: app/server administration portal.

Before deployment, confirm actual DB host/port/name, MySQL/MariaDB version, transaction support, TLS/network rules, migration permissions, Node version/start command, environment configuration, reverse-proxy/subpath behavior, HTTPS, and the actual public application URL.

Use a least-privilege application account and isolated project/test database. Develop with local MySQL until school connectivity is available. Do not probe the portals, upload an application, create resources, or alter shared tables without authorization. Never run destructive test resets against school/shared data.

Use synthetic records only until the team/school authorizes real personal-data handling and establishes access/privacy/retention requirements. Deployment permission and database credentials are separate from the approval to write this plan.

## 12. Analytics, maps, and PDF reporting rules

These are Sprint 3 requirements, not delivered features.

- Query persisted, tenant-scoped, non-draft cases with one selected incident-date period using Asia/Manila day boundaries.
- Define a demo resolution rate as settled cases divided by official non-draft cases in that incident-date cohort. Referrals/unresolved cases are not settled. State the period and numerator/denominator; show zero-count states clearly.
- Do not imply this metric is automatically the DILG definition.
- Use stored coordinates only where properly collected, or documented sitio/purok centroids. Label centroid views as aggregated distributions, not exact incident locations.
- Do not display invented heat circles, personal names, or exact sensitive addresses in aggregate views.
- Verify the applicable official statistical template, categories, denominators, and sign-off before using “DILG-compliant.” Until verified, name the export **Barangay Incident Statistical Report — draft template**.
- PDF output includes tenant, reporting period, generated date, category/status totals, and the defined resolution metric. It must reconcile with API totals and exclude narratives/contact details by default.
- Hearing summons/CFA templates are a different workflow and do not complete statistical-report requirements.

## 13. Execution and verification

[SPRINT-2.md](SPRINT-2.md) contains copy-ready T3/T4 scope and acceptance criteria. [API_CONTRACT.md](API_CONTRACT.md) defines their shared interface. [AGENTS.md](../AGENTS.md) governs branching and authorization.

The approved scope is now in implementation after the user's explicit direction to proceed. Sonnet/max-effort workers handle backend and frontend in separate exact task worktrees, with central interface/integration coordination and no overlapping writes. The user's rerouter may select a different runtime model; distinguish the request from observed routing.

Product verification must include:

- Real-MySQL migrations and integration tests in an isolated database.
- Two-tenant access, input/identity validation, safe concurrent numbering, status conflicts, audit integrity, conversion races/rollback, and restart persistence.
- Frontend tests, lint, production build, and real API/MySQL browser workflows.
- Resident submission, queue after refresh, conversion, search/details/status/history, QR destination, keyboard use, and responsive layouts.
- Hosted session/HTTPS/proxy/DB/restart checks only after deployment approval.

If MySQL or hosting is unavailable, report the blocked checks instead of treating mocks as equivalent. Do not mark a feature complete based solely on an agent response, prototype appearance, or board status.
