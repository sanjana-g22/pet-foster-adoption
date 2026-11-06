# Database-enforced RBAC: setup, verification and demonstration

Prepared against GitHub commit `c1cc86ac0392b975c9cf878e0e201484871fd0e5` (6 November 2026).
Requires Node.js 20.9+ (Node 22 LTS is suitable), PostgreSQL 15+, the existing pgvector extension, and a schema-owner connection with permission to create roles and install pgcrypto.

Use the project's own database: these migrations harden the `public` schema and its views, so do not apply them to a database shared with unrelated applications.

## What changed

The web app still authenticates sessions and shows role-appropriate pages. PostgreSQL now independently enforces access using five NOLOGIN group roles (`pfa_guest`, `pfa_adopter`, `pfa_foster`, `pfa_staff`, `pfa_admin`), GRANT/REVOKE, column privileges, and RLS on all 18 business tables. Each local installation gets a separate restricted LOGIN role named `pfa_web_...`.

Every web query, including server-rendered page queries, uses a transaction. After checking the signed session cookie, the server signs `userId:transactionId` using a private key. PostgreSQL verifies that signature and reads the user's current role and active state from `users`; the query then runs with `SET LOCAL ROLE`. Policies also require the selected SQL role to match that verified identity. A SQL caller cannot become an admin by changing `app.current_user_id` or switching to `pfa_admin`. Context signatures cannot be replayed in another transaction. Commit/rollback clears transaction-local settings.

Authentication remains an application responsibility. This design trusts the backend and the migration owner, not browser-supplied IDs. It is not intended to defend against an attacker who controls the application server, its private signing key, or the database owner. Application users do not get database passwords. Database roles determine operations; RLS determines ownership.

Login verifies existing bcrypt hashes through a narrowly scoped database function; password hashes are not returned to web queries. Self-registration can create only adopter/foster accounts. Existing accounts keep their passwords. The pet-embedding maintenance script now uses DATABASE_URL_DIRECT; it must not use the restricted web connection. Workflow functions explicitly verify staff/admin and the actor ID. Audit/history triggers can append records without granting runtime users direct write access to audit/history tables. Maintenance seed bypass is unavailable to runtime logins. Views use security-invoker permissions; public pet pages use restricted summary/timeline functions.

## Permission matrix

| Role | Permitted operations |
|---|---|
| Guest | Read public pet rows, public timeline and vaccination summary; login/register |
| Adopter | Own profile and embedding rows; submit/read own applications; read own adoptions; complete own follow-ups; browse public pets |
| Foster | Own profile; approved fosters can read own placements and assigned pet medical data and add updates to their active placements |
| Staff | Pet/medical/vaccination and foster operations; approve/revoke foster accounts; review applications; approve adoptions; operational reports |
| Admin | Staff access plus user administrative columns and audit-log reads |

App admin is not a PostgreSQL superuser. App admin cannot delete audit history. Only maintenance credentials can change the schema or migrate/seed. Staff cannot change user roles. Public pet detail data retains the existing application's public fields; medical records and detailed vaccination records are restricted. Public timeline author names and internal notes are hidden by the database.

## Files to show your teacher

- `db/migrations/080_database_rbac.sql`: real roles, permissions, RLS, restricted authentication/registration functions, protected audit triggers and public summaries.
- `db/migrations/081_protected_workflows.sql`: caller checks in existing workflows.
- `src/lib/db.ts`: restricted web connection and verified transaction-local identity.
- `db/tests/rbac-tests.mjs`: SQL checks with the actual restricted login (no Next.js server required).
- `db/tests/01_lifecycle_tests.sql`: existing lifecycle tests updated to provide a signed test actor.

Two old behaviours were intentionally tightened: public SQL cannot retrieve hidden medical/audit data, and a rejected/withdrawn application resubmission now returns to `submitted` and clears old review metadata.

## 1. Prepare your Git branch (Windows Command Prompt)

Use **Command Prompt**, not PowerShell, for the `%USERPROFILE%`, `%TEMP%` and `cd /d` examples below. Open a terminal in your existing `pet-foster-adoption` folder. Run commands one at a time and stop on any failure.

```bat
git status --short
git switch main
git pull --ff-only origin main
git switch -c sanjana/db-layer-rbac
```

The first command should show no pending work. If it shows changes, preserve them on their own branch/commit before continuing; do not reset or delete them. A Git branch isolates code, not your database.

Download `Pet_DB_RBAC_Ready.zip` to Downloads, then extract outside the repository:

```bat
tar -xf "%USERPROFILE%\Downloads\Pet_DB_RBAC_Ready.zip" -C "%TEMP%"
node "%TEMP%\Pet_DB_RBAC_Ready\install.mjs" --check
node "%TEMP%\Pet_DB_RBAC_Ready\install.mjs" --apply
git diff --stat
npm ci
```

Run the Node commands while your terminal is still in the repository root (the folder containing package.json). The installer checks the exact base commit and file contents, supports Windows CRLF checkout, and does not touch `.env.local`, `.git` or node_modules. It refuses conflicting local changes. The ZIP also contains the complete updated source under `project/`; you do not need to manually copy individual files. If `--check` reports a newer/different main, stop and have the patch rebased; do not force-copy it.

## 2. Use a Neon test branch first

Your repository documents Neon as its database provider. In your Neon project, open **Branches → New branch**, choose your current database branch as the parent, select **Current data**, and name the child `rbac-test`. This copies current schema/data without changing the parent. Use PostgreSQL 15 or later.

In the connection dialog, select **rbac-test**, the existing database, and the schema-owner role. Copy the **direct/unpooled** connection URL. Edit your local file:

```bat
notepad .env.local
```

Keep your existing JWT_SECRET and NEXT_PUBLIC_APP_URL. Set `DATABASE_URL_DIRECT` to the **rbac-test schema-owner URL**. Do not put URLs or passwords in Git. Do not replace this file with `.env.example`.

For a local PostgreSQL database instead, use its schema-owner URL. Test in a separate database or take a backup first. You do not need Docker for this package.

## 3. Apply the migrations and generate restricted credentials

Stop any running Next.js server with Ctrl+C. From the repository root:

```bat
npm run db:migrate
npm run db:rbac:setup
npm run db:rbac:check
```

What these commands do:

1. The existing migration runner consults `schema_migrations`. On your existing database it skips already-applied files and applies `080_database_rbac.sql` and `081_protected_workflows.sql`. It preserves users, hashes, pets and audit history. **Do not delete schema_migrations, rerun the old SQL manually, reset tables, or drop the database.**
2. Setup generates a private context key in the database (or reuses that database's existing key), creates a restricted SQL login, tests it and updates `.env.local` automatically. It keeps a private `.env.local.rbac-backup-...` file. Existing logins created by this setup are reused on reruns.
3. The check confirms a restricted runtime login, RLS on 18 tables and invoker views.

After setup:

| Setting | Purpose |
|---|---|
| `DATABASE_URL` | Restricted web login; generated automatically |
| `DATABASE_URL_DIRECT` | Owner connection for migrations, seeds and tests only |
| `DATABASE_CONTEXT_SECRET` | Generated signing key; must match the database key |
| `PFA_DB_LOGIN` | Generated runtime login name |
| `JWT_SECRET` | Your existing session-cookie signing key; unchanged |

Use the SQL setup script to create the runtime login. Do not create it through Neon's default role-creation UI: those roles can carry elevated Neon privileges.

There is no need to run seeds on an existing database. The original pet seed script deletes/recreates demo data and is not an upgrade step. For a deliberately empty new demo database only, run `npm run db:seed` after migrations/setup.

## 4. Run checks before merging

```bat
npm run db:test:rbac
npm run db:test:lifecycle
npm run lint
npm run typecheck
npm run build
npm run dev
```

Expected: **55 RBAC checks**, **13 lifecycle checks**, and passing lint/typecheck/build. The RBAC test creates uniquely named temporary test records, rolls each tested workflow back and removes its fixtures in finally. Identity sequence numbers can advance; this is normal. If a test process is forcibly killed, its uniquely named fixtures can remain. The lifecycle suite runs entirely inside a rolled-back transaction.

Open http://localhost:3000. Use existing accounts. If your database was already seeded with the original demo accounts, those are admin@demo.com, staff@demo.com, foster1@demo.com and adopter1@demo.com with the original demo password `Demo@12345`. These are public demo credentials, not recommended for a public deployment.

Check:

- Guest pet list and pet detail load.
- Adopter profile saves; application submits; duplicate pending application is rejected.
- Staff can review/approve an application and manage pets/fosters.
- Approved foster sees own placements, updates them and opens the pet passport.
- Another foster cannot update that placement.
- Adopter cannot access admin user listing or create placements.
- Admin can view audit logs.

Log out/in after changing a user's role: the DB uses the current role immediately, but page-navigation middleware still uses the role in the session cookie.

## 5. Push and open a pull request

After all checks pass, stop the development server if needed and run:

```bat
git status --short
git diff --check
git add .env.example README.md package.json seed-pet-embeddings.mjs db docs src
git diff --cached --stat
git commit -m "Enforce PostgreSQL roles and row-level access policies"
git push -u origin sanjana/db-layer-rbac
```

Inspect the staged list before committing. Never force-add `.env.local` or its backups. The package does not contain credentials.

On GitHub, create a PR from `sanjana/db-layer-rbac` into `main`. Suggested title:

> Enforce role-based access and ownership in PostgreSQL

Suggested description:

> Adds PostgreSQL group roles, least-privilege runtime credentials, RLS on 18 business tables and explicit workflow authorization. All web queries use verified transaction-local identity; owner credentials remain limited to maintenance. Login, registration, public summaries and server-rendered pages work through the restricted connection. Adds 55 RBAC checks and adapts the 13 lifecycle checks. Production build, type checking and lint pass.

Merge only after testing your database branch. GitHub merging code does not apply database migrations or copy Neon data.

## 6. Apply the tested release to the shared database

Coordinate this step with your teammates: stop the old app while changing its database access. A Git branch does not isolate a shared Neon database.

After the PR is merged:

```bat
git switch main
git pull --ff-only origin main
```

Then choose the intended shared database's **owner/direct URL** for `DATABASE_URL_DIRECT` in `.env.local`, and run:

```bat
npm ci
npm run db:migrate
npm run db:rbac:setup
npm run db:rbac:check
npm run build
npm run dev
```

If this is the same database you already migrated, migration files are skipped. If it is the original shared branch, 080 and 081 run there for the first time. The setup command derives the new restricted URL from the selected owner/direct URL, so it switches the web connection to the correct database too. Your isolated test-branch data does not need to be merged into the shared database.

Each teammate pulls the code and runs setup with authorized maintenance access on their own environment. A new local installation generates its own restricted login. For hosting, set DATABASE_URL, DATABASE_CONTEXT_SECRET, JWT_SECRET and the app URL in the deployment's private environment and restart/redeploy. Do not expose the migration-owner URL to client code; omit it from the production web process if migrations run separately.

## Demonstrating database enforcement

Run these commands with the web server stopped:

```bat
npm run db:rbac:check
npm run db:test:rbac
npm run db:test:lifecycle
```

Explain: “The Node test runner sends SQL directly through the restricted PostgreSQL login. Next.js routes are not involved. PostgreSQL denies forbidden operations, filters another user's rows, and permits authorized workflows.”

For screenshots in the Neon SQL Editor, the following **read-only inspection** queries show configuration:

```sql
SELECT rolname, rolcanlogin, rolsuper, rolcreaterole, rolbypassrls
FROM pg_roles WHERE rolname LIKE 'pfa_%' ORDER BY rolname;

SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname='public'
ORDER BY tablename, policyname;

SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee LIKE 'pfa_%' ORDER BY grantee, table_name, privilege_type;
```

The SQL Editor normally uses owner credentials, which bypass RLS. Do not use owner `SELECT *` results as a test of adopter permissions. Use the provided restricted-login suite for enforcement evidence.

## Troubleshooting and recovery

- **Installer base mismatch:** main changed or your checkout differs. Do not force-copy; rebase/regenerate the patch against current main.
- **Permission denied creating roles/extension/schema:** DATABASE_URL_DIRECT must be the actual schema owner with role-creation rights. Use your Neon owner connection, not a newly restricted runtime connection. Do not grant owner/superuser rights to the runtime.
- **relation already exists in an old migration:** the database was built manually without matching schema_migrations history. Stop; do not reset or blindly mark migrations applied. Reconcile the existing schema/history first.
- **Unsafe web database login:** run setup and restart Next.js. Never use the owner connection as DATABASE_URL.
- **Invalid/missing context key:** use the setup command against the correct database. Do not manually invent a different DATABASE_CONTEXT_SECRET.
- **A migration fails:** each file is transactional, but earlier files may already have committed. Stop the app, fix the specific error, rerun db:migrate; it resumes from unapplied files. Do not delete migration-history rows.
- **Build fails downloading fonts or the semantic model cannot load:** these existing features require network access. The RBAC SQL tests do not download the model.
- **Revert during testing:** leave the test branch, restore your previous local environment and use the previous code against the unchanged parent DB. Do not disable RLS to make old code work against a migrated DB. A code-only Git revert does not undo database migrations.

## Validation performed for this package

- Current GitHub base verified before implementation and again before packaging.
- Full production build, TypeScript and ESLint passed.
- PostgreSQL 18.6 with pgvector: fresh migration chain passed; repeated migrations skipped cleanly.
- Upgrade from the original schema preserved existing users/password hashes, pets and audit history.
- Restricted-login setup and repeat setup passed. Also verified migrations/setup with a non-superuser owner with role-creation rights, matching the required Neon-style privilege model.
- 55 database RBAC integration checks passed; 13 existing lifecycle checks passed.
- 44 HTTP checks passed, including all four roles, public pages, registration, profile save, application submission/duplicate rejection and forbidden API access.

Not claimed: validation against your private live Neon project, every browser interaction, or semantic-model downloads. Run the commands on your Neon test branch before merging. This package cannot guarantee zero bugs in every environment.

Official references: https://www.postgresql.org/docs/current/ddl-rowsecurity.html ; https://www.postgresql.org/docs/current/sql-createview.html ; https://www.postgresql.org/docs/current/pgcrypto.html ; https://neon.com/docs/manage/roles ; https://neon.com/docs/manage/branches
