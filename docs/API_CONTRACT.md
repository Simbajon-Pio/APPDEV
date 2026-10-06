# Sprint 2 API Contract

**Status:** implementation contract; endpoints are being built, not yet verified.

Read [the project plan](PROJECT_PLAN.md), [Sprint 2](SPRINT-2.md), and [contributor policy](../AGENTS.md). API requests use same-origin `/api` with JSON and cookie credentials. Release data persists in MySQL; frontend fixtures exist only in tests.

## 1. Shared conventions

- JSON uses `snake_case`. Numeric IDs are positive safe integers. Missing or inaccessible tenant records return 404.
- Timestamps are ISO 8601 with `Z` or explicit offset; responses use UTC `Z`. The UI displays Asia/Manila and converts `datetime-local` input from Philippine time explicitly.
- Accept allowlisted fields only; reject supplied `id`, `case_id`, `barangay_id`, `city_id`, `created_by`, `created_at`, `submitted_at`, or `version` in intake bodies.
- Success: `{ "data": ... }`. Lists additionally have `meta: { page, page_size, total, total_pages }`.
- Error: `{ "error": { "code": "VALIDATION_ERROR", "message": "Check the marked fields.", "fields": { "sitio": "Required" } } }`. `fields` is optional.
- Codes: `UNAUTHENTICATED` (401), `FORBIDDEN` (403, CSRF/origin), `NOT_FOUND` (404), `CONFLICT` (409), `VALIDATION_ERROR` (422), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500). Never expose SQL/internal failures or personal details in errors/logs.
- All authenticated endpoints resolve tenant and creator from the server session. No public listing or acknowledgement-based lookup.

## 2. Enumerations and intake

Incident categories:

| Value | Label |
| --- | --- |
| `curfew_violation` | Curfew Violation |
| `noise_disturbance` | Videoke / Noise Disturbance |
| `property_dispute` | Property Dispute |
| `physical_altercation` | Physical Altercation |
| `financial_dispute` | Debt / Financial Dispute |
| `others` | Others |

Case statuses: `draft`, `pending_lupon`, `settled_at_desk`, `referred_to_pnp`, `unresolved`.

Initial status allows every value except `unresolved`. Approved resident conversions cannot use `draft`. Residency values: `resident`, `non_resident`, `unknown`. Review statuses: `pending_review`, `approved`, `rejected`.

### Complete staff intake body

| Field | Rule |
| --- | --- |
| `incident_type` | Required category enum |
| `incident_datetime` | Required valid offset timestamp, not later than current server time |
| `sitio` | Required trimmed text, 1–120 characters |
| `landmark` | Optional/null trimmed text, at most 255 |
| `complainant_name` | Required trimmed text, 1–160 |
| `complainant_contact` | Optional/null; 7–20 characters, digits, spaces, `+`, `-`, `(`, `)`; at least 7 digits |
| `complainant_sitio` | Optional/null text, at most 120 |
| `complainant_resident_status` | Required residency enum; never implicitly assume resident |
| `respondent_unknown` | Required boolean |
| `respondent_name` | Required 1–160 when respondent known; null when unknown |
| `respondent_contact` | Optional/null with contact rules; null when respondent unknown |
| `respondent_sitio` | Optional/null text, at most 120; null when respondent unknown |
| `respondent_resident_status` | Required residency enum; `unknown` when respondent unknown |
| `narrative` | Required trimmed plain text, 1–5000 |
| `status` | Required allowed initial status |

Optional blank strings normalize to null. Text is rendered as text, never HTML. JSON body limit is 32 KB. Draft uses the same required-field checks, receives a permanent number, and is excluded from Active lists/counts. No partial autosave or general intake-edit endpoint.

Example (synthetic names):

```json
{
  "incident_type": "noise_disturbance",
  "incident_datetime": "2026-10-06T20:30:00+08:00",
  "sitio": "Demo Purok 1",
  "landmark": null,
  "complainant_name": "Demo Complainant",
  "complainant_contact": null,
  "complainant_sitio": null,
  "complainant_resident_status": "unknown",
  "respondent_unknown": true,
  "respondent_name": null,
  "respondent_contact": null,
  "respondent_sitio": null,
  "respondent_resident_status": "unknown",
  "narrative": "Synthetic demonstration of an evening noise report.",
  "status": "pending_lupon"
}
```

## 3. Session and CSRF flow

1. `GET /api/auth/csrf` creates/uses an anonymous server session and returns `{ "data": { "csrf_token": "opaque-token" } }`. Send `Cache-Control: no-store`.
2. `POST /api/auth/login` takes `{ "username": "demo_a", "password": "user-supplied" }`, with `X-CSRF-Token` and allowed Origin. Username 1–80, password 1–128. Login failures are generic, not user-existence disclosures. Rate-limit 10 attempts per 15 minutes per client IP.
3. Successful login regenerates the session ID and CSRF token, and returns `{ "data": { "user": User, "csrf_token": "new-token" } }`.
4. `GET /api/auth/me` returns the same authenticated shape. User contains `id`, `username`, `display_name`, `barangay: { id, name, code, slug }`, `city: { id, name }`, and `report_url` (the configured public form URL).
5. Every staff mutation sends the current `X-CSRF-Token` and same-origin credentials. Reject missing/incorrect token or disallowed Origin with 403. Do not use unrestricted CORS. Test clients supply the configured Origin.
6. `POST /api/auth/logout` requires staff session and CSRF, destroys its session and clears the cookie, then returns `{ "data": { "logged_out": true } }`. Bootstrap CSRF again before another login.

Use password hashing, a MySQL session store, HttpOnly/SameSite=Lax cookie, Secure+HTTPS when hosted, and an 8-hour session lifetime. The client handles 401 by clearing authenticated UI state, not by retrying a mutation automatically. Never store passwords/session cookies in localStorage.

## 4. Staff blotter endpoints

- `POST /api/blotters`: complete intake body. Returns 201 with full `Blotter`. Allocate `BLOT-[unique barangay code]-[Asia/Manila intake year]-[five digit sequence]` inside the creation transaction with locked counter and uniqueness constraints. No gap-free guarantee. Record creator/time and creation event.
- `GET /api/blotters`: paginated tenant list. Default excludes drafts, orders `submitted_at DESC, id DESC`. Explicit `status=draft` lists drafts ordered `created_at DESC, id DESC`.
- `GET /api/blotters/:id`: full tenant-scoped `Blotter`.
- `GET /api/blotters/:id/events`: `{ "data": [CaseEvent] }`, chronological events, scoped through the parent blotter. Events include `id`, `event_type`, `actor_id`, `actor_name`, `created_at`, `from_status`, `to_status`, `reason`.
- `PATCH /api/blotters/:id/status`: `{ "status": "settled_at_desk", "expected_version": 1, "reason": "Optional explanation" }`. Returns full updated blotter. `expected_version` is required; updates increment version atomically and append an event. Stale version or same-status update returns 409; reload before retrying.

A returned `Blotter` includes all intake fields plus `id`, `case_id`, `barangay_id`, `city_id`, `created_by`, `creator_name`, `created_at`, `submitted_at` (null for draft), `updated_at`, `version` (starts 1), `source` (`walk_in` or `resident_report`), and `resident_report_id` (null for walk-in).

Transitions: Draft to Pending Lupon/Settled at Desk/Referred to PNP; Pending Lupon to Settled at Desk/Referred to PNP/Unresolved; a terminal status to Pending Lupon requires a trimmed 1–1000-character reason. Official cases never revert to Draft. A draft's first official transition sets `submitted_at` and never changes its original creator/time/number. No hard deletion.

### List filters

`page` default 1; `page_size` default 20, max 100. Invalid integers/ranges return 422. `q` max 160 searches literal case number/complainant/respondent substrings (escape `%`, `_`, and backslash); combine scoped predicates with grouped search `OR`.

`incident_type`, `status`, `sitio` (exact text), `date_from`, `date_to` may be supplied. Date fields are `YYYY-MM-DD`, inclusive Philippine calendar dates; SQL uses local day's UTC start and the exclusive UTC start after `date_to`. Reject invalid/reversed ranges. Dates filter `incident_datetime`, not creation dates. All filters combine with AND. Unknown query keys are rejected.

`GET /api/overview` returns:

```json
{
  "data": {
    "total_blotters": 0,
    "pending_lupon": 0,
    "settled_at_desk": 0,
    "referred_to_pnp": 0,
    "unresolved": 0,
    "pending_reports": 0
  }
}
```

Only non-draft blotters and the authenticated tenant's pending submissions contribute. These are all-time counts, not Sprint 3 date-filtered analytics.

## 5. Public resident endpoints

- `GET /api/public/barangays/:slug`: public `{ id, name, slug, city_name, report_url, incident_categories }` within `data`. No users, case counts, addresses, narratives, or contacts. `report_url` is the configured app base plus `/report/:slug`, not a DB/admin portal.
- `POST /api/public/barangays/:slug/reports`: required `reporter_name` (1–160), `incident_type`, `incident_datetime`, `sitio`, `narrative`; optional/null `reporter_contact`, `landmark`, `respondent_name`; optional `website` honeypot (must be empty). Use staff field bounds. Tenant comes only from the slug. Additional identity/audit/status fields are rejected.
- Limit 5 submissions per 15 minutes per client IP, independent from sign-in. Bound input; reject honeypot submissions generically without insertion. Public submission does not require a staff CSRF token; it has no authenticated privileges. Do not allow cross-origin browser submission unless explicitly configured.
- Successful persistence returns 201 and no personal details:

```json
{
  "data": {
    "reference": "RPT-opaque-random-reference",
    "status": "pending_review",
    "submitted_at": "2026-10-06T12:30:00.000Z"
  }
}
```

References use cryptographically random bytes and a unique index, not a fixed value/guessable database ID. A reference is acknowledgement only. Do not add a public tracking GET endpoint. UI explains that receipt is not official acceptance or an emergency response.

## 6. Staff resident review

- `GET /api/resident-reports`: default pending queue, newest first. Allow `status`, `q` (reference/reporter literal substrings), `page`, `page_size`; use list bounds/scoping above.
- `GET /api/resident-reports/:id`: returned `ResidentReport` has `id`, `reference`, `barangay_id`, `city_id`, `status`, immutable `original: { reporter_name, reporter_contact, incident_type, incident_datetime, sitio, landmark, respondent_name, narrative }`, `submitted_at`, `reviewed_at`, `reviewed_by`, `reviewer_name`, `rejection_reason`, `blotter_id`, `case_id`. Unreviewed fields are null.
- `POST /api/resident-reports/:id/approve`: `{ "intake": CompleteStaffIntake }` with a non-draft initial status. Staff confirms all fields, allowing unknown respondent/residency. Do not manufacture contacts/home addresses. Never overwrite `original`.
- Approval locks the tenant-scoped report. When pending, allocate and save the case/event, mark approved, and link all inside one transaction; returns 201 `{ "data": { "report": ResidentReport, "blotter": Blotter } }`.
- If already approved, return 200 with its existing report/blotter, without applying a repeated intake payload. If rejected, return 409. A unique source-report/case association prevents duplicate conversion. Approval/rejection races serialize on the report lock; no partial result on rollback.
- `POST /api/resident-reports/:id/reject`: `{ "reason": "trimmed 1–1000 character reason" }`. Lock and update only Pending Review; returns full report in `data`. Same reason on already rejected report returns 200 unchanged; different reason or already approved returns 409. Reviewer/time are never overwritten by retry.

## 7. Shared verification cases

1. Tenant A cannot list/search/detail/history/update/review Tenant B by direct IDs or filters; no query condition bypasses tenant scope.
2. Invalid/unknown intake fields and spoofed identity cause 422 and no write. Missing/invalid CSRF or Origin causes 403 for staff mutations.
3. Concurrent creates return unique case IDs; creation event and counter allocation roll back with failed saves.
4. A valid draft gets a number, is excluded from Active/overview, then appears at top on submission with unchanged creation fields.
5. Stale status version, prohibited transition, or reopening without reason cannot overwrite the stored record.
6. Resident submission persists; acknowledgement/public metadata cannot read personal case details.
7. Concurrent approval produces one linked blotter. Reject/approve races and retries preserve original and reviewer metadata.
8. Date boundaries use Asia/Manila; literal `%`/`_` search does not become a wildcard. Unknown filters, invalid dates, and oversized pages are validation errors.
9. Session expiry, server restart, sanitized API failures, and frontend error/conflict states are tested with real MySQL integration where applicable.

Routine contract defaults (bounds, session duration, list size, rate limits, explicit version and CSRF endpoint) are defined here for both teams. Change them only through coordinated contract edits; do not invent incompatible shapes independently.
