# Contributor and AI Policy

This is the canonical policy for human contributors and AI agents working on eBarangayMo. Tool permissions are not approval to exceed the assigned task. Other agent entry points must reference this file rather than duplicate a conflicting policy.

## Read before working

1. Inspect the current branch and working-tree status.
2. Read [the project plan](docs/PROJECT_PLAN.md), [the active sprint](docs/SPRINT-2.md), and [the API contract](docs/API_CONTRACT.md).
3. Confirm the assigned task, its owner, allowed files, and acceptance criteria. Do not silently take over another person's task.
4. Check for applicable project skills, including `.github/skills/README.md` if that file exists. Respect more specific instructions that do not conflict with this policy.

Current stage: Sprint 2 implementation is authorized. Check actual code and verification results before claiming any feature is complete; documentation, rendered prototypes, and Jira statuses are not evidence of completion.

## Branching policy

| Branch | Meaning | Created from | PR destination |
| --- | --- | --- | --- |
| `main` | Reviewed, accepted final/release app | Existing release baseline | None |
| `SPRINT-#` | Integration for one numbered sprint | Accepted `main` baseline | `main` |
| `T#` | One globally unique numbered task | Its assigned `SPRINT-#` | Its assigned `SPRINT-#` |
| `development` | Historical prototype/reference | Existing branch | Do not integrate automatically |

### Sprint 2 mapping

| Jira issue | Task | Exact branch | Human owner |
| --- | --- | --- | --- |
| DEV-5 | T3: core backend | `T3` | Steven |
| DEV-3 | T4: core frontend | `T4` | Unassigned; the team chooses |

- Use the exact names `SPRINT-2`, `T3`, and `T4`. Task numbers, not Jira issue numbers, determine task branch names. Do not invent suffixes or recycle a task number.
- Product changes belong on a task branch. User-requested documentation/branch setup is the explicit administrative exception on `SPRINT-2`.
- Never put task work directly on `main`. Never target `main` with a task PR.
- Leave `development` untouched. Do not rename, delete, reset, overwrite, merge, or cherry-pick its contents without separate approval. Read it only for reference.
- Before creating a branch, check whether it already exists. Inspect/report an existing branch instead of resetting or recreating it.
- Respect dirty/untracked files and other contributors' work. Do not use `git reset --hard`, `git clean`, force pushes, or broad deletion as cleanup shortcuts.
- Select files explicitly when staging. In particular, do not stage local prototype leftovers or dependencies with `git add .`.

### Creating task branches

After the sprint's documentation/contract checkpoint has been explicitly committed and approved for task work, create a task branch from its sprint. For this execution, the user directed immediate implementation and controlled copies of uncommitted docs were provided to native task worktrees; do not confuse these copies with inherited Git history.

```sh
git switch SPRINT-2
git status --short --branch
git switch -c T3 SPRINT-2
```

The frontend owner uses `T4` instead. Do not run these commands over a dirty checkout. Do not create task worktrees expecting uncommitted sprint documents to appear there: worktrees share committed history, not uncommitted files.

Synchronize with the sprint through reviewed, non-destructive changes. A task integrates into its sprint only after its acceptance checks and review. The sprint integrates into `main` only after joint verification and release approval. Do not automatically merge either.

## Scope and file ownership

| Area | Owner | Boundary |
| --- | --- | --- |
| `apps/api/**`, `database/**` | T3 | API, validation, sessions, SQL/migrations, backend tests, safe environment setup |
| `apps/web/**` | T4 | Routes, API client, UI tokens/components, frontend tests, browser workflow checks |
| `docs/API_CONTRACT.md` | Coordinated | Both owners agree before changing fields, endpoints, or errors |
| Root/docs/shared configuration | Coordinated | Integrator or explicitly assigned contributor; no parallel conflicting edits |

The `apps/` and `database/` paths are planned, not evidence that files exist yet. Each app will own its package manifest and lockfile.

Sprint 2 includes authenticated desk intake, valid drafts, tenant-scoped records/search/status/history, persistent resident submissions, review/conversion, and basic counts. It excludes heatmaps, statistical PDF export, payments, SMS, attachments, resident accounts, and hearing/KP automation.

Do not import the monolithic prototype, add unrelated refactors, change the agreed stack, or silently expand these boundaries. Surface a necessary contract/scope change before dependent work proceeds.

## Data and security invariants

- MySQL is the agreed database. Do not substitute SQLite or a mocked database and claim MySQL acceptance passed.
- Staff identity, `barangay_id`, `city_id`, and creator metadata come from the authenticated server context, never an untrusted request body.
- Scope every staff list, search, detail, update, history, resident-review, conversion, and aggregate query to the authenticated tenant. Other-tenant records behave as not found.
- Public reporting resolves the tenant from a validated barangay slug. It grants no public access to case lists, names, contacts, or narratives.
- Preserve original resident submissions. Approval atomically produces exactly one linked blotter; rejection records a reason. Never fabricate parties or contacts.
- Case numbers use a transaction-safe per-barangay/year counter, not `MAX()+1` or an unlocked read-last/increment sequence.
- Preserve case number, tenant, creator, and creation time. Status events append an actor/time trail. No hard-delete endpoint in Sprint 2.
- Use parameterized SQL, password hashing, persistent server sessions, CSRF/origin controls, bounded inputs, sanitized errors, and appropriate hosted cookie/HTTPS settings.
- Keep credentials and session keys in server environment variables. Never commit genuine resident records, `.env` files, session cookies, or personal-data logs. Environment examples contain no secrets.
- Use explicitly synthetic test/demo data and isolated databases. Never run destructive seed resets or tests against the shared school database.
- `dbadmin.dcism.org` and `admin.dcism.org` are administration portals, not verified connection settings or the public app URL. Confirm hosting/runtime/DB details before deployment.

## Development and verification

- Plan behavior changes before coding; implement them test-first. Run a regression test that fails for the intended reason before applying the fix, then run the relevant suite.
- Keep files focused. Separate page/form/API responsibilities and route/service/database responsibilities. Reuse safe patterns, not the prototype's unsafe shortcuts.
- Follow the contract's fields/enums/timestamps/errors exactly. Do not independently invent different frontend and backend shapes.
- UI fixtures are permitted for development/tests only. Release flows must use the real API and persistent MySQL data.
- Check frontend labels/focus/keyboard use and layouts near 400px, 768px, and 1440px. Keep status text alongside semantic colors.
- Verify two-tenant isolation, concurrent numbering, immutable audit fields, status transitions, repeated approval, and persistence with real MySQL.
- Report exact commands and their actual results. If infrastructure is unavailable or a test fails, say so. Do not call a mocked, skipped, or unrun check passing.
- Keep README launch/test/migration commands accurate once those scripts exist. Do not document nonexistent scripts as ready to run.
- A feature is complete only when its acceptance criteria pass. A ticket's board status is not verification.

## Agent orchestration

The user permits Sonnet implementation agents and requests maximum reasoning effort. Planning, shared interfaces, integration, and acceptance remain centrally coordinated. The user explicitly accepts their rerouter selecting another runtime model; distinguish requested model/effort from observed response metadata.

- Select `sonnet` and `effort: "max"` when the execution interface supports both; the workflow runner does. If another interface has no effort setting, report that limitation instead of claiming it was configured.
- Give each agent a specific task and non-overlapping file ownership.
- Use task branches/worktrees consistent with this policy. If the agent harness permits only its automatic isolated worktree, use that as a temporary execution workspace; the coordinator reviews and integrates owned changes into the exact `T#` branch. Never substitute a helper branch for the approved task/integration history.
- Avoid simultaneous writes to shared contracts, root configuration, or lockfiles.
- Review agent output against the specification and actual test results. Do not assume an agent's completion message is proof.
- Preserve the human task assignments; delegating to an agent does not reassign a Jira issue.
- Do not claim a thinking-effort setting was configured if the available agent interface does not expose it.

## Actions requiring separate authorization

Do not commit, push, open or merge PRs, edit Jira, publish documents externally, deploy, probe school administration systems, or alter hosted databases unless that action is explicitly authorized. Permission bypass only changes tool access; it does not change the requested scope.

Never bypass hooks or signing by default. When commits or PRs are authorized, follow the attribution instructions supplied for that session; do not invent attribution for other contributors.

Do not claim DILG compliance until the applicable report template and definitions are verified. Do not claim production readiness or official government affiliation from this academic prototype.
