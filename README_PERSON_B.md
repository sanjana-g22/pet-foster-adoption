# Person B contribution — Adoption & Matching

## Important integration note
These files are an additive starting implementation for the existing `pet-foster-adoption` repo. Review them with Person A before applying migrations to the shared Neon database. Never commit `.env.local`.

## Files
- `db/migrations/013_adoption_pipeline.sql`: adopter profiles, applications, adoptions, follow-ups, embeddings and analytics view.
- `db/migrations/014_adoption_workflows.sql`: approval procedure and follow-up scheduling trigger.
- `src/app/api/adopter/profile/route.ts`: read/update adopter profile.
- `src/app/api/applications/route.ts`: list/create applications.
- `src/app/api/matches/route.ts`: hybrid SQL + vector matching endpoint.
- `src/app/api/staff/applications/route.ts`: staff/admin review and approval endpoint.
- `src/app/api/followups/route.ts`: list and complete follow-ups.
- `src/app/(adopter)/adopter/page.tsx`: adopter dashboard with profile, apply, match and tracker sections.
- `src/app/(staff)/staff/applications/page.tsx`: staff application review page.
- `src/app/(admin)/admin/page.tsx`: analytics dashboard.

## Prerequisites
1. Person A's migrations must be applied first. These migrations depend on `users`, `pets`, `pet_status`, and `application_status`.
2. Ensure `CREATE EXTENSION vector` succeeds on the team's Neon database.
3. The matching route uses `@xenova/transformers` to generate 384-dimensional MiniLM embeddings. Install it with `npm install @xenova/transformers` in the repo. If this package has compatibility problems in the current Node version, pause and resolve that before applying the embedding route.
4. Confirm `.env.local` contains `DATABASE_URL`, `DATABASE_URL_DIRECT`, `JWT_SECRET`, and `NEXT_PUBLIC_APP_URL`. Use the Neon pooled URL for `DATABASE_URL` and the direct URL for `DATABASE_URL_DIRECT`, as supplied by your teammate/Neon.
5. Coordinate with Person A before migrations, seeding, or schema changes on the shared database.

## Apply and run (only after Person A confirms the shared schema is ready)
```bat
npm install @xenova/transformers
npm run db:migrate
npm run dev
```
Do not run `npm run db:migrate` until the team agrees: the migration runner applies every pending SQL file, not just Person B's.

## Suggested manual test
- Log in as an adopter and open `/adopter`.
- Save profile details and submit an application for an available pet.
- Use `/api/matches` via the matching UI/route after embeddings are generated for pets.
- Log in as staff/admin and open `/staff/applications` to review a submitted application.
- Approve only a pet whose status is `available` or `in_foster`; the transaction locks the pet row and prevents a second approved adoption.
- After approval, confirm follow-ups are created for days 7, 30 and 90.

## Known integration boundary
The base repository currently contains authentication and Person A's pet/foster tables, but it does not include a complete Person B adoption/matching implementation. This contribution introduces the core DB and API layer; validate the exact shared schema and UI styling with Person A before merging.
