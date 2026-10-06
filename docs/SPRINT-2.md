# Sprint 2 — Core Blotter and Resident Reporting

**Goal:** Deliver a persistent desk-officer workflow and resident submission/review workflow, with enforced barangay isolation and a usable responsive interface.

**Stage:** implementation in progress; acceptance checks are not yet complete.

**Board dates:** October 1–13, 2026.

**Integration branch:** `SPRINT-2`, created from `main`.

**Requirements:** supplied US1, [project plan](PROJECT_PLAN.md), and [API contract](API_CONTRACT.md).

**Contributor policy:** [AGENTS.md](../AGENTS.md).

## 1. Sprint boundary

### Included

- Staff sign-in/out, persistent sessions, and authenticated tenant context.
- US1 intake with server-generated case number and immutable creation metadata.
- Valid saved drafts, searchable/filterable/paginated records, details, status transitions, and event history.
- Public resident reporting through a barangay-specific link or genuine QR code.
- Persistent resident queue, staff rejection with reason, and exactly-once approval/conversion.
- Basic overview counts from live, tenant-scoped records.
- MySQL migrations, synthetic seed data, integration tests, and responsive/accessibility checks.

### Not included

Heatmaps, statistical PDF export, SMS, attachments, payments, resident registration/login, password recovery, staff tenant switching, hearing scheduling, and KP summons/CFA automation. Analytics, maps, PDF reporting, audited record corrections where needed, and final deployment belong to Sprint 3. Remaining items stay in the future roadmap.

Neither T3 nor T4 means “build the entire backend/frontend.” Each owns only the Sprint 2 workflows below.

## 2. Existing tasks and ownership

| Jira issue | Current task | Scoped task title | Branch | Owner | Existing estimate |
| --- | --- | --- | --- | --- | --- |
| DEV-5 | T3: Backend | Core Backend — Blotter Intake and Resident Report Review | `T3` | Steven | 8 points |
| DEV-3 | T4: Frontend | Core Frontend — Desk Officer Workspace and Resident Reporting | `T4` | Unassigned | 8 points |

These are copy-ready descriptions for the existing tickets, not newly created or edited Jira issues. Preserve the current assignments/estimates until the team changes them. Public resident reporting adds scope beyond the original walk-in story; reassess both estimates before committing to the sprint deadline. Story points are not hour estimates.

The team must select the T4 owner. Suggested responsibilities for other available teammates are manual acceptance testing, synthetic-data preparation, UI feedback, and verifying the official reporting requirements for Sprint 3. These are proposals, not assignments or invented ticket numbers. Any separately assigned work gets its own approved `T#`.

## 3. DEV-5 / T3 — Core Backend

### Copy-ready description

Implement the server-side foundation for Sprint 2's desk-officer intake and resident-report review workflows, not the entire final backend. Build versioned MySQL migrations and synthetic seeds, authenticated staff sessions, tenant-scoped blotter create/list/search/detail/status/history APIs, safe sequential case numbering, and persistent public resident submissions with staff approve/reject conversion.

Follow US1 and the shared API contract. Derive tenant and creator identity from the authenticated session, preserve original submissions and creation audit fields, and prevent concurrent approval from creating duplicate cases. Supply automated tests, safe environment examples, and truthful setup instructions.

### Ownership

- `apps/api/**`: application startup, sessions/security middleware, validation, feature routes/services, SQL access, backend tests, package manifest/lockfile.
- `database/**`: ordered migrations and repeatable synthetic demo data.
- Initial environment/ignore setup, coordinated with the integrator.
- Changes to shared fields/endpoints/errors require agreement with T4 before implementation diverges.

Does not own frontend screens, charts/maps, PDFs, SMS, payment processing, or school-server administration.

### Deliverable slices

1. **Database and identity:** isolated MySQL setup, two demo tenants, staff accounts, persistent authenticated sessions, security middleware, and tenant-scoped access tests.
2. **Desk intake and records:** validated create/draft/list/search/detail/status/history and live counts, with transaction-safe numbers and audit metadata.
3. **Resident reporting:** public tenant form metadata/submission, staff queue/detail, reject, and atomic approve/conversion.
4. **Integration handoff:** tested contract responses, error examples, environment documentation, and evidence from real-MySQL checks.

These are execution slices inside T3, not extra branch names or automatically created Jira tasks.

### Acceptance criteria

- [ ] A clean isolated MySQL database initializes from versioned migrations and synthetic seeds; no manually built schema is required.
- [ ] Seeds contain two isolated tenants and staff accounts, clearly marked as demo data; no genuine resident data or committed secrets.
- [ ] Staff sign-in/out, session persistence/expiry, and CSRF/origin controls work; unauthenticated staff requests are rejected.
- [ ] All US1 fields exist, with required-field, enum, length, contact, and timestamp validation at the API boundary.
- [ ] Protected identity/audit fields cannot be supplied or overwritten by the client. Barangay and city are bound to the authenticated staff member.
- [ ] A valid save returns a permanent `BLOT-[BRGY]-[YEAR]-[00001]` number and recorded creator/time. Concurrent saves cannot share a number.
- [ ] Draft saves use full validation, retain their number when submitted, remain outside default Active lists/statistics, and become discoverable through the Draft filter.
- [ ] Non-draft records sort by official submission time; a submitted draft appears at the top without changing its original creation metadata.
- [ ] List/search/filter/pagination/detail/history/counts never expose another tenant's records. Tests cover IDs, query parameters, and `OR` search conditions.
- [ ] Status transitions are validated, reject stale updates, preserve immutable fields, and append actor/time/reason history. There is no hard-delete endpoint.
- [ ] Public submissions persist after restart, return an acknowledgement reference, and provide no public access to stored personal details.
- [ ] Staff can review original submission data, confirm intake values, reject with a reason, or approve into one linked non-draft case.
- [ ] Concurrent/repeated approval, approval/rejection races, and transaction rollback cannot create duplicate or partially linked cases.
- [ ] Invalid inputs and failures return the documented status/error envelope without leaking SQL details, contacts, narratives, or credentials.
- [ ] Real-MySQL integration tests and backend checks pass; unavailable infrastructure is explicitly reported rather than replaced by mock evidence.

### Exclusions

No charts, map aggregation endpoint, statistical PDF, hearing management, general record-edit/delete endpoint, resident account system, billing, SMS, attachment storage, or hosted database administration.

## 4. DEV-3 / T4 — Core Frontend

### Copy-ready description

Implement the usable Sprint 2 interface, not the entire final frontend. Build staff sign-in and a responsive workspace, standardized US1 intake with valid draft handling, searchable/filterable records, case details/history, status updates, and the resident-report review queue. Build a mobile-friendly public submission form reachable through a barangay link or genuine QR code.

Connect release screens to the real API contract. Use deliberate typography, neutral surfaces, consistent spacing, semantic status colors, and complete loading/error/empty/success states. Preserve user input on failure and never present a simulated submission, notification, or report as completed functionality.

### Ownership

- `apps/web/**`: routing, session-aware API client, pages/forms, shared UI/tokens, frontend tests, package manifest/lockfile.
- Browser workflow and responsive/accessibility checks, coordinated with T3.
- No direct database access or backend/schema changes.
- Shared API-contract changes require agreement with T3.

Does not own heatmaps, statistical reports/PDF screens, SMS, payments, resident account management, or backend services in Sprint 2.

### Deliverable slices

1. **Workspace and session:** staff sign-in/out, protected navigation, authenticated tenant context, loading/session-expiry behavior, and shared form/UI primitives.
2. **Desk intake and records:** grouped US1 form, draft handling, real search/filter/pagination, details/history, and status-change feedback.
3. **Resident and review:** mobile public form/QR entry, real acknowledgement, staff queue/review/confirmation, reject reason, and conflict handling.
4. **Live integration and usability:** replace runtime fixtures with actual API calls, verify failure states, and run browser/accessibility/responsive checks.

### Acceptance criteria

- [ ] Staff sign-in/out, protected routes, session expiry, and tenant context work against the real API; the client never decides record ownership.
- [ ] Staff navigation contains Overview, Blotter Records, and Resident Reports, without functional-looking future-feature buttons.
- [ ] Intake represents all US1 fields, makes required/optional/unknown distinctions explicit, and does not invent a respondent, contact, or residency status.
- [ ] Required-field errors block submission; server validation maps to relevant controls. Input survives validation/network errors.
- [ ] Successful creation displays the server-issued number and updates the Active list; no locally fabricated number or success message.
- [ ] A valid Draft is saved intentionally, accessible by the Draft filter, excluded from default Active counts, and submitted without changing its case number.
- [ ] Search, filters, pagination, details, status changes, event history, and basic counts use live persisted data and remain correct after refresh.
- [ ] A stale status or review action reports a conflict and refreshes the current state rather than silently overwriting it.
- [ ] The resident form shows the target barangay, privacy/use information, and the non-emergency/non-acceptance notice.
- [ ] The form works at phone width, submits to persistent storage, and shows the returned acknowledgement reference; QR encodes the configured real public form URL.
- [ ] The review queue preserves original report details, lets staff confirm full intake values or reject with a reason, and handles an already-reviewed report without claiming a second conversion.
- [ ] Loading, empty, retryable error, submitting/disabled, success, expired-session, and conflict states exist. Duplicate clicks do not send overlapping mutations.
- [ ] Controls have labels, visible focus, keyboard access, adequate contrast, and appropriate dialog focus handling. Status is not conveyed only by color.
- [ ] Layouts near 400px, 768px, and 1440px work without page-level horizontal overflow; table overflow stays in its own container.
- [ ] Frontend tests, lint, production build, and real API/MySQL browser workflows pass. Release routes do not fall back to fake local data.

### Exclusions

No map/reporting UI, PDF generation, hearing/KP forms, resident account/recovery UI, SMS feedback, attachments, payment screens, or frontend database credentials.

## 5. Shared rules that neither task may reinterpret alone

### US1 traceability

| US1 requirement | T3 evidence | T4 evidence |
| --- | --- | --- |
| Valid creation saves and assigns sequential-format ID | Transactional save/counter plus MySQL concurrency test | Server number displayed; new official case at top of list |
| Required fields block invalid creation | 422 field errors and no DB write | Associated inline errors and retained input |
| Active user controls barangay/city | Server session scope plus two-tenant tests | Read-only tenant context; no ownership fields in create payload |
| Creator ID and immutable creation timestamp | Server-set fields preserved through all transitions | Display recorded creator/time; no editable audit controls |

The provided US1 is marked Done in Jira, but these checks still apply to the release code.

### Required field and draft decisions

Required: category, incident date/time, sitio/purok, complainant name, narrative, and allowed initial status. Contacts/address details may be unknown. Unknown respondent data is explicit and never fabricated. The contract defines exact machine values and bounds.

A Draft is a fully valid saved entry, not partial autosave. It gets its permanent number on save and becomes official on a permitted status transition. Partial drafts, general intake editing, and autosave are not hidden requirements in this sprint.

### Review and data rules

Public reports are Pending Review submissions, not official blotters. Approval uses confirmed intake and creates exactly one official case in the same tenant. Original submission data remains separately preserved. Rejection needs a reason. Other-tenant record IDs return not found. No public case lookup exists.

No client-supplied creator/tenant fields, unlocked case-number increments, public personal-data feeds, real personal demo data, or simulated notifications are acceptable shortcuts.

## 6. Dependencies and integration order

1. **Documentation checkpoint:** review the contract and approved boundaries. Commit the checkpoint only with explicit permission; new task branches/worktrees must start from committed shared documents.
2. **Task branching:** T3/T4 owners create their exact branches from `SPRINT-2`. Do not share one mutable checkout between concurrent implementations.
3. **Parallel foundation:** T3 establishes schema/auth/core APIs; T4 develops its shell/forms against clearly marked test/development fixtures matching the contract.
4. **Workflow completion:** T3 completes resident review/conversion; T4 connects all release flows to real API responses. Coordinate contract changes before either side relies on them.
5. **Joint verification:** demonstrate both workflows with two synthetic tenants and run automated checks, including real-MySQL concurrency and browser tests.
6. **Reviewed integration:** task PRs target `SPRINT-2`; the accepted sprint targets `main`. Commits, pushes, PRs, and merges require explicit authorization. Do not integrate merely because one task's screens render.

Agents may help within the assigned ownership boundaries; they do not change human assignments. Sonnet implementation agents are permitted after the execution plan is reviewed. Keep architecture, shared contracts, and final acceptance centrally coordinated.

## 7. End-to-end acceptance script

Use an isolated test database and synthetic data only.

1. Initialize two demo barangays and a staff account for each. Start the real API and frontend with MySQL.
2. Sign in as Tenant A; submit a valid walk-in incident. Verify its number, tenant, creator/time, and top-of-list placement after refresh.
3. Submit invalid intake and attempt protected-field spoofing directly to the API. Verify field errors/rejection and no unwanted row.
4. Save a valid Draft. Verify the Draft filter finds it while default Active lists/counts exclude it. Submit it; check its original case number/audit metadata and new Active placement.
5. Search/filter/page records; open details/history; change status. Try the same update from a stale second view and confirm conflict handling.
6. Open Tenant A's public link/QR on a narrow screen. Submit a resident report; record its acknowledgement. Confirm it persists in the staff queue after reload/restart, without appearing as an official blotter yet.
7. Review and approve it. Verify the original data remains, exactly one official case exists, and a repeated/concurrent approval does not create another. Reject a second report with a reason.
8. Sign in as Tenant B. Tenant A's search results, record IDs, history, reports, review actions, and counts must be inaccessible. Attempt direct API requests, not only UI navigation.
9. Check empty results, validation failures, disconnected API, expired session, submitting states, focus order, and layouts near 400px/768px/1440px.
10. Run automated backend/MySQL/frontend/browser checks and save concise evidence. If MySQL/hosting is unavailable, report exactly which checks remain blocked.

## 8. Definition of Done

- [ ] Both task acceptance lists pass against the approved contract.
- [ ] No cross-tenant access or client-controlled identity/audit metadata.
- [ ] Case numbering and report conversion pass real concurrency/rollback checks.
- [ ] Core records/reports persist after refresh and server restart.
- [ ] All release screens use real APIs; fixtures remain only in labelled tests/development paths.
- [ ] Error/session/conflict states, responsive layouts, and keyboard access are verified.
- [ ] Setup/migration/seed/test commands are documented only after the scripts exist and have been run.
- [ ] No secrets, real resident data, fake compliance claims, or simulated integrations are committed.
- [ ] A reviewer checks the integrated result; known limitations and actual test outcomes are recorded.
- [ ] The team approves completion before updating ticket status or merging the sprint.

## 9. Risks and explicit follow-ups

| Item | Impact | Action |
| --- | --- | --- |
| Resident reporting expands the original intake story | Both 8-point estimates may be optimistic | Team reassesses estimates/capacity; do not silently drop agreed features |
| T4 is unassigned | No accountable frontend owner yet | Team selects an owner before implementation |
| School connection/runtime details are not yet verified | Hosted deployment and remote DB tests may be blocked | T3 documents actual prerequisites; develop against local MySQL |
| General record corrections are deferred | Sprint 2 intake cannot silently be edited after save | Clearly state this UI boundary; plan audited correction in Sprint 3 |
| Official statistical template not verified | Cannot claim DILG compliance | Verify requirements before Sprint 3 report work |
| Documentation is initially uncommitted | Task worktrees will not inherit it | Obtain commit authorization before creating task branches/worktrees |

This document does not authorize edits to Jira, deployment, school DB administration, commits, pushes, or merges. Those actions need separate approval.
