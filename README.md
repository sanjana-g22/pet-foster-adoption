# Pawfect Match

### Pet Foster & Adoption Management System

Pawfect Match is a full-stack application for managing shelter pets, foster placements, adoption applications, medical records, and post-adoption follow-ups. It combines role-specific dashboards with PostgreSQL-enforced permissions and semantic pet recommendations.

Built with **Next.js, React, TypeScript, PostgreSQL, Neon, and pgvector**.

## Features

- **Pet management:** intake records, searchable listings, filters, lifecycle status changes, and adoption returns.
- **Medical tracking:** medical history, vaccination records, overdue-vaccination reports, and vaccination checks before a pet becomes available.
- **Foster management:** account approval, capacity checks, placement assignment, placement completion, and daily care updates.
- **Adoption workflow:** adopter profiles, application submission and review, adoption approval, and automatic follow-ups at 7, 30, and 90 days.
- **Semantic recommendations:** lifestyle-to-pet matching using MiniLM embeddings and cosine similarity.
- **Operational tools:** foster recommendations, an at-risk pet board, printable pet passports with QR codes, and lifecycle timelines.
- **Administration:** user listing, adoption analytics, and audit-log viewing.
- **Database access control:** PostgreSQL roles, table and column privileges, row-level security, and authorized workflow functions.

## Technology Stack

| Area | Implementation |
|---|---|
| Application | Next.js 16 App Router, React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Backend | Next.js route handlers and server-rendered pages |
| Database | PostgreSQL, hosted on Neon |
| Database client | `pg` / node-postgres |
| Authentication | JWT session cookies with `jose`; bcrypt password hashes |
| Validation | Zod |
| Semantic matching | Transformers.js (`@xenova/transformers`) |
| Embedding model | `Xenova/all-MiniLM-L6-v2`, 384 dimensions |
| Vector search | pgvector, cosine distance, HNSW index |
| Database identity verification | Node.js HMAC signing and PostgreSQL `pgcrypto` |
| Pet passports | QR codes generated with `qrcode` |

## Roles and Permissions

| Role | Access |
|---|---|
| Guest | Browse public pet information, register, and log in |
| Adopter | Maintain own profile, find matches, submit and view own applications, and complete own adoption follow-ups |
| Foster | View own profile; approved fosters can access their placements and assigned pets’ medical records and submit updates for active placements |
| Staff | Manage pets, medical records, vaccinations, foster approvals and placements, application reviews, and adoption workflows |
| Admin | Staff operations, user listing, adoption analytics, and audit-log viewing |

Self-registration supports **adopter** and **foster** accounts only. Foster accounts require approval before participating in placement workflows. Staff and admin accounts are provisioned through trusted maintenance operations, including the development account seed.

The database grants administrative user-column permissions to the admin role; the current admin user page provides a listing rather than a complete account-editing interface.

## Database-Enforced Authorization

Access control operates at both the application and database layers:

1. The application verifies the session cookie and applies page/API role checks.
2. Every web database operation runs in a transaction through a restricted login.
3. The backend signs the authenticated user ID together with the transaction ID.
4. PostgreSQL verifies the signature and retrieves the user’s current role and active status.
5. The connection uses `SET LOCAL ROLE` to select an allowlisted PostgreSQL role.
6. Grants and RLS policies determine which operations and rows are accessible.

### Database Roles

The five application group roles are:

- `pfa_guest`
- `pfa_adopter`
- `pfa_foster`
- `pfa_staff`
- `pfa_admin`

These are `NOLOGIN` roles. The setup script creates a separate restricted login named `pfa_web_...` for the application connection.

**RBAC controls operations; RLS controls row ownership.** For example, adopters cannot insert medical records, and an adopter’s application query cannot return another adopter’s applications—even without an ownership filter in the application query.

### Access-Control Protections

- RLS on all **18 business tables**.
- Column privileges that prevent ordinary users from changing roles or approval flags.
- Explicit caller checks in adoption, placement, return, and status-change functions.
- Identity checks that prevent impersonation by changing a SQL session variable or selecting a more privileged group role.
- Transaction-local context that is cleared on commit or rollback.
- Security-invoker views and limited public timeline/vaccination-summary functions.
- Protected audit/history writes through triggers; application users cannot forge or delete audit records.
- Separate maintenance credentials for migrations, seeds, and embedding generation.

The backend and database owner remain trusted components. Application users do not receive database credentials. Owner-level access is reserved for maintenance and is not used to demonstrate end-user RLS enforcement.

See [the database RBAC guide](docs/DB_RBAC_GUIDE.md) for implementation details and demonstration queries.

## Database Design

| Area | Tables |
|---|---|
| Accounts | `users`, `roles` |
| Pet lifecycle | `pets`, `pet_status_transitions`, `pet_status_history` |
| Medical care | `medical_records`, `vaccinations`, `required_vaccines` |
| Fostering | `foster_profiles`, `foster_placements`, `foster_updates` |
| Adoption | `adopter_profiles`, `applications`, `adoptions`, `followups` |
| Semantic vectors | `pet_embeddings`, `adopter_embeddings` |
| Auditing | `audit_log` |

Foreign keys, check constraints, unique indexes, triggers, and stored functions enforce data integrity. Workflow functions use transactions and row locks for operations such as foster placement and adoption approval.

Adoption approval schedules follow-ups and rejects competing pending applications for the same pet.

The schema also includes full-text pet search, reporting views, a foster-capacity view, and a computed pet-urgency score.

## Project Structure

| Path | Purpose |
|---|---|
| `src/app/` | Pages, layouts, and API route handlers |
| `src/app/(public)/` | Public pages, registration, login, and pet browsing |
| `src/app/(adopter)/` | Adopter pages |
| `src/app/(foster)/` | Foster pages |
| `src/app/(staff)/` | Staff pages |
| `src/app/(admin)/` | Admin pages |
| `src/components/` | Shared UI components |
| `src/lib/` | Authentication, database access, validation, queries, and error handling |
| `src/proxy.ts` | Role-aware page navigation checks |
| `db/migrations/` | Ordered schema and authorization migrations |
| `db/seeds/` | Development accounts and pet data |
| `db/tests/` | Database authorization and lifecycle tests |
| `db/rbac-setup.mjs` | Restricted-login and identity-key setup |
| `db/rbac-check.mjs` | Runtime-role, RLS, and view configuration checks |
| `seed-pet-embeddings.mjs` | Pet embedding generation and storage |
| `docs/DB_RBAC_GUIDE.md` | Detailed setup, migration, and verification instructions |

Route-group names in parentheses organize the code without appearing in page URLs.

## Prerequisites

- Node.js **20.9 or later**; Node.js 22 is suitable.
- npm and Git.
- PostgreSQL **15 or later**, with pgvector available and permission to install `pgcrypto`.
- A schema-owner connection with role-creation permissions for initial setup.
- Internet access for dependency installation and the initial embedding-model download.

Use a dedicated project database. The authorization migration hardens the `public` schema and its views, so it should not be applied to a database shared with unrelated applications.

## Local Setup

Run commands from the repository root, where `package.json` is located. Continue only when the preceding command succeeds.

### 1. Clone and Install

```bash
git clone https://github.com/sanjana-g22/pet-foster-adoption.git
cd pet-foster-adoption
npm ci
```

### 2. Create the Environment File

For a new checkout only:

**Windows Command Prompt:**

```bat
copy .env.example .env.local
```

**macOS/Linux:**

```bash
cp .env.example .env.local
```

Existing installations should preserve their current `.env.local`.

Set the following values:

```dotenv
DATABASE_URL_DIRECT="postgresql://OWNER:PASSWORD@HOST/DATABASE?sslmode=require"
JWT_SECRET="REPLACE_WITH_A_RANDOM_SECRET"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Replace the example URL with the complete **schema-owner, direct/unpooled connection URL** for the intended database. For Neon, select the correct branch, database, and owner role when copying it. The hostname is the endpoint after `@`, not the username such as `neondb_owner`.

Generate a JWT secret for a new environment:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy the generated value into `JWT_SECRET`. Keep an existing installation’s secret unless intentionally rotating it.

| Variable | Purpose | Configuration |
|---|---|---|
| `DATABASE_URL_DIRECT` | Owner connection for maintenance | Set manually |
| `JWT_SECRET` | JWT session signing; at least 32 characters | Set manually |
| `NEXT_PUBLIC_APP_URL` | Application origin | Set manually |
| `DATABASE_URL` | Restricted web connection | Generated by RBAC setup |
| `DATABASE_CONTEXT_SECRET` | Database identity-signing key | Generated/retrieved by RBAC setup |
| `PFA_DB_LOGIN` | Restricted login name | Generated by RBAC setup |

Keep credentials and `.env.local` backups out of version control.

### 3. Migrate and Configure Permissions

```bash
npm run db:migrate
npm run db:rbac:setup
npm run db:rbac:check
```

The migration runner records applied files in `schema_migrations`. The setup command creates the restricted login, installs or retrieves the identity-signing key, and updates `.env.local`.

The configuration check verifies runtime restrictions, RLS on the business tables, and caller permissions on views.

Do not use the schema-owner URL as the web application’s `DATABASE_URL`.

### 4. Optional Development Data

For an empty development/demo database:

```bash
npm run db:seed
```

**Do not use seeding as an upgrade step.** The pet seed script deletes and recreates its demo data; rerunning account seeds can reset demo-account details and passwords.

The account seed creates these demo users, all with password `Demo@12345`:

| Role | Email |
|---|---|
| Admin | `admin@demo.com` |
| Staff | `staff@demo.com` |
| Foster | `foster1@demo.com`, `foster2@demo.com` |
| Adopter | `adopter1@demo.com`, `adopter2@demo.com` |

These are development credentials, not production accounts.

### 5. Start the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The database connectivity endpoint is [http://localhost:3000/api/health](http://localhost:3000/api/health).

## Updating an Existing Installation

Preserve `.env.local`, stop the running application, and test schema changes on an isolated database or Neon branch first. A Git branch isolates code, not database changes.

After pulling the updated code, select the intended database using `DATABASE_URL_DIRECT`, then run:

```bash
npm ci
npm run db:migrate
npm run db:rbac:setup
npm run db:rbac:check
```

The RBAC release adds:

- `080_database_rbac.sql`
- `081_protected_workflows.sql`

Previously recorded migrations are skipped. Do not delete migration-history rows, reset the database, or reseed existing data to apply this update.

A GitHub merge does not execute SQL migrations. Apply the same release to the shared database separately, coordinate the change with other users of that database, and restart the application with its updated environment.

## Semantic Pet Matching

The matching pipeline:

1. Builds descriptive text from pet attributes.
2. Generates normalized, 384-dimensional MiniLM embeddings.
3. Stores vectors and their source text in `pet_embeddings`.
4. Embeds the adopter’s submitted lifestyle description.
5. Uses pgvector cosine distance to return up to **12 available pets**, optionally filtered by species.

Generate or refresh stored pet embeddings after creating or updating pet data:

```bash
node seed-pet-embeddings.mjs
```

This is a maintenance operation using `DATABASE_URL_DIRECT`. The first run downloads the model. Without stored pet embeddings, semantic matching has no candidates to return.

Similarity reflects textual relevance; it is not an adoption probability or a guarantee of suitability. Staff review remains part of the adoption process.

## Testing

```bash
npm run db:rbac:check
npm run db:test:rbac
npm run db:test:lifecycle
npm run lint
npm run typecheck
npm run build
```

| Check | Coverage |
|---|---|
| RBAC configuration | Restricted runtime login, RLS configuration, invoker views |
| RBAC integration suite | 55 checks covering ownership isolation, denied writes, identity spoofing, role switching, workflow access, and audit protection |
| Lifecycle suite | 13 checks covering status transitions, vaccinations, foster capacity, placement uniqueness, constraints, search, and audit recording |
| ESLint / TypeScript / build | Code quality, type checking, and production compilation |

The RBAC suite uses the actual restricted login to send SQL directly; the website does not need to be running. It creates uniquely named fixtures and cleans them up on normal completion or handled failure. The lifecycle suite rolls back its test changes.

Use a development database for testing.

For manual verification, check public browsing, each role’s dashboard, profile saving, application review, foster updates, and pet passports. Confirm that another user’s records and unauthorized operations remain inaccessible.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build the production application |
| `npm run start` | Run the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript checks |
| `npm run db:migrate` | Apply unapplied SQL migrations |
| `npm run db:rbac:setup` | Configure the restricted database login and signing key |
| `npm run db:rbac:check` | Verify database access-control configuration |
| `npm run db:test:rbac` | Run database authorization tests |
| `npm run db:test:lifecycle` | Run lifecycle and integrity tests |
| `npm run db:seed:accounts` | Seed development accounts |
| `npm run db:seed:pets` | Seed demo pets and related records |
| `npm run db:seed` | Run both seed scripts |
| `node seed-pet-embeddings.mjs` | Generate and store pet embeddings |

## Deployment

Use a host that supports the Next.js Node.js runtime and outbound PostgreSQL connections.

1. Test the release against a separate database first.
2. Apply migrations and run RBAC setup for the deployment database through a trusted maintenance environment.
3. Configure the web deployment with `DATABASE_URL`, `DATABASE_CONTEXT_SECRET`, `JWT_SECRET`, and `NEXT_PUBLIC_APP_URL`.
4. Keep the owner connection out of the web runtime when maintenance runs separately.
5. Build and start the application.
6. Verify database connectivity, logins, role isolation, and key workflows.

```bash
npm run build
npm run start
```

Embedding inference requires model access/cache availability and sufficient runtime memory and execution time. Check the target host’s constraints before relying on semantic matching in deployment.

## Troubleshooting

| Issue | Action |
|---|---|
| `ENOTFOUND neondb_owner` | Recopy the complete connection URL; the owner name belongs before the password, not in the hostname position |
| Permission denied creating roles or extensions | Use the schema-owner connection with the required maintenance privileges |
| Unsafe web database login | Run `db:rbac:setup`, then restart the app with its generated `DATABASE_URL` |
| Missing or mismatched identity key | Run setup against the intended database; do not invent a replacement `DATABASE_CONTEXT_SECRET` |
| No semantic matches | Generate stored pet embeddings and confirm available pets exist |
| Role changed but navigation is stale | Log out and log in again; page navigation uses the role stored in the session cookie |
| Old migration reports an existing relation | Reconcile the existing schema and migration history before proceeding; do not reset tables or blindly mark migrations applied |

For detailed recovery and demonstration steps, see [DB_RBAC_GUIDE.md](docs/DB_RBAC_GUIDE.md).

## Contributing

Create a feature branch, make the change, run the relevant checks, and open a pull request against `main`.

Include migration and environment requirements when changing database access. Review staged files to ensure credentials are not included, and coordinate shared-database migrations with the team.
