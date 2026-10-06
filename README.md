# eBarangayMo

**Digital Blotter & Community Incident App**

An academic final-project web app for structured barangay incident intake, resident reporting, case tracking, and statistical reporting. The proposed SaaS customers are barangays and city government units in Cebu City, Mandaue, and Lapu-Lapu.

## Current stage

The Sprint 2 specification is approved and implementation is in progress. The release structure is `apps/api/` and `apps/web/`; completion is determined by real tests, not this stage label.

The `development` branch preserves the groupmate's prototype and remains reference-only. `SPRINT-2` starts from `main`, without importing that prototype. The obsolete local `ebarangaymo/` dependency folders were deleted with the user's approval.

## Sprint 2 goal

Deliver two connected, persistent workflows:

1. **Desk officer:** sign in, record a walk-in incident, find the case, inspect its details, and update its status with a history trail.
2. **Resident:** submit through a barangay-specific link or QR code, then have staff review and accept or reject the submission. Acceptance creates one official blotter.

Every staff operation must be restricted to the authenticated user's barangay. Use synthetic data for the project demo.

Heatmaps, statistical PDF reports, and final deployment are Sprint 3 deliverables. SMS, payments, resident accounts, and hearing automation are outside Sprint 2.

## Documentation

| Document | Purpose |
| --- | --- |
| [Project plan](docs/PROJECT_PLAN.md) | Product scope, architecture, data/security rules, UI direction, SaaS model, and roadmap |
| [Sprint 2](docs/SPRINT-2.md) | T3/T4 descriptions, ownership, acceptance checks, dependencies, and Definition of Done |
| [API contract](docs/API_CONTRACT.md) | Planned fields, endpoints, session flow, errors, and review-conversion behavior |
| [Contributor and AI policy](AGENTS.md) | Branching, task boundaries, permissions, and verification requirements |
| [Claude entry point](CLAUDE.md) | Required reading for Claude-based contributors |

## Intended stack and hosting

- **Frontend:** React, Vite, JavaScript, Tailwind CSS, and Lucide icons.
- **Backend:** Node.js, Express, and parameterized MySQL queries.
- **Database:** MySQL with InnoDB transactions and versioned migrations.
- **School hosting:** Node.js applications through `admin.dcism.org`; database administration through `dbadmin.dcism.org`.

The portal URLs are not the application's public URL or the database connection hostname. Confirm actual connection settings, runtime versions, HTTPS, and hosting permissions before deployment. Keep credentials out of the repository and the frontend.

Installation, migration, test, and launch commands will be added when their implementations exist. There is currently no release app to start from this branch.

## Branch policy

| Branch | Purpose | Integration destination |
| --- | --- | --- |
| `main` | Reviewed final/release application | None |
| `SPRINT-#` | Integration for a numbered sprint | `main`, after acceptance |
| `T#` | One assigned, numbered task | Its matching `SPRINT-#` |
| `development` | Existing prototype/reference | Do not merge automatically |

For Sprint 2, **DEV-5 / T3** maps to `T3` and **DEV-3 / T4** maps to `T4`. Task numbers, not Jira issue numbers, determine branch names. Read [AGENTS.md](AGENTS.md) before making changes.

## Commercial and reporting boundaries

The business model and example prices are proposal assumptions, not validated sales or market research. The final project demonstrates tenant isolation rather than implementing billing.

Do not call statistical exports DILG-compliant until the applicable official template and definitions are verified. Do not present mocked data, simulated SMS, or placeholder reports as completed functionality.
