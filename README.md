# Pawfect Match — Pet Foster & Adoption Management System

A full-stack web application for managing the pet fostering and adoption lifecycle. The platform brings together pet records, foster placements, medical history, adoption applications, intelligent pet matching, and post-adoption follow-ups in one system.

## Overview

Pawfect Match helps shelters and rescue organizations manage pets throughout their journey from intake to fostering and adoption. It provides role-based interfaces for administrators, staff, fosters, and adopters, with a PostgreSQL database supporting operational workflows, reporting, and search.

### Key Features

- **Pet Management:** Maintain pet profiles, species, breeds, age, temperament, health information, and adoption status.
- **Foster Management:** Manage foster profiles, placement records, capacity, and daily updates.
- **Medical Records:** Maintain medical history, vaccination records, and relevant health information.
- **Adoption Applications:** Allow adopters to submit applications for pets and track application statuses.
- **Adoption Workflows:** Support application review, adoption decisions, and lifecycle tracking.
- **Pawfect Match:** Use semantic embeddings to identify pets relevant to an adopter's preferences and lifestyle.
- **Adopter Profiles:** Store adopter preferences and lifestyle information to support pet matching.
- **Follow-up Management:** Support scheduled post-adoption follow-ups and overdue follow-up tracking.
- **Admin Analytics:** Display adoption pipeline metrics, application counts, follow-up metrics, and average time in the system by species.
- **User and Role Management:** Support role-based access for administrators, staff, fosters, and adopters.
- **Audit Logging:** Maintain a record of relevant database changes and system activity.
- **Database Search and Reporting:** Use PostgreSQL views, indexes, full-text search, triggers, and stored procedures to support application functionality and reporting.

## Technology Stack

- **Frontend:** Next.js, React, TypeScript
- **Backend:** Next.js App Router and API routes
- **Database:** PostgreSQL hosted on Neon
- **Semantic Matching:** Transformers.js and the `Xenova/all-MiniLM-L6-v2` embedding model
- **Vector Search:** PostgreSQL `pgvector` with cosine-similarity indexing
- **Package Management:** npm
- **Version Control:** Git and GitHub

## Application Roles

| Role | Responsibilities |
|---|---|
| Administrator | View analytics, manage users, and review audit activity |
| Staff | Manage operational workflows and review adoption applications where authorized |
| Foster | Access foster-related functionality and placement information |
| Adopter | Browse pets, maintain preferences, find suitable matches, and submit and track applications |

Access to pages and API endpoints is controlled by role-based authorization.

## Project Structure

```text
pet-foster-adoption/
├── db/
│   ├── migrations/       # Database schema and workflow migrations
│   ├── seeds/            # Seed data
│   └── ...
├── src/
│   ├── app/
│   │   ├── admin/        # Admin-related routes, where applicable
│   │   ├── adopter/      # Adopter pages
│   │   ├── staff/        # Staff pages
│   │   ├── api/          # Backend API routes
│   │   └── ...
│   ├── components/      # Shared UI components
│   └── lib/             # Database access and shared utilities
├── .env.example         # Environment variable template
├── package.json
└── README.md
```

Some routes may be organized into Next.js route groups such as `(admin)`. Route groups organize code without appearing in the URL.

## Prerequisites

Before running the application, ensure you have:

- Node.js compatible with the project's Next.js version
- npm
- A Neon PostgreSQL project
- Git
- An internet connection for downloading the embedding model when needed

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/sanjana-g22/pet-foster-adoption.git
cd pet-foster-adoption
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a local environment file by copying the example:

**Windows CMD:**

```bat
copy .env.example .env.local
```

**macOS/Linux:**

```bash
cp .env.example .env.local
```

Configure the variables required by the application. These may include:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled Neon PostgreSQL connection string |
| `DATABASE_URL_DIRECT` | Direct database connection string for operations that require it |
| `JWT_SECRET` | Secret used for signing or verifying authentication tokens |
| `NEXT_PUBLIC_APP_URL` | Public application URL; use `http://localhost:3000` locally |

Use the exact variable names documented in `.env.example`. Other environment variables may be required depending on the configured application features.

**Security:** Never commit `.env.local`, database passwords, JWT secrets, API keys, or other credentials to GitHub. Use environment variables in deployment settings for production.

### 4. Set up the database

Create or use a Neon PostgreSQL database and configure the connection strings in `.env.local`.

The SQL migrations in `db/migrations/` define the database schema, including tables, types, indexes, views, triggers, and workflow logic.

Apply migrations using the project's configured migration command:

```bash
npm run db:migrate
```

Only run migrations against a database you are authorized to modify. Coordinate shared database changes with the project team.

If seed scripts are provided, use the relevant documented commands to populate development or test data.

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The development server supports hot reloading as you edit the application.

## Semantic Pet Matching

Pawfect Match uses text embeddings to compare adopter preferences with pet information.

The matching workflow consists of:

1. Constructing a descriptive text representation from each pet's attributes.
2. Generating a numerical embedding using `Xenova/all-MiniLM-L6-v2`.
3. Storing pet embeddings in the PostgreSQL `pet_embeddings` table.
4. Comparing preference-based embeddings with stored pet embeddings using vector similarity.
5. Returning relevant pets for the adopter to review.

The embedding table stores the pet ID, vector representation, source text, model name, and update timestamp. PostgreSQL `pgvector` supports similarity search, while the project's indexes help make retrieval more efficient.

A pet's similarity score indicates semantic relevance; it should not be interpreted as a guarantee that the pet is suitable for a particular home.

If the project includes an embedding-generation script, review its configuration and database target before running it. Generating embeddings writes to the database and should only be performed against an authorized environment.

## Application Workflow

A typical adoption workflow is:

1. Staff maintain pet records and their current status.
2. Adopters browse available pets and explore recommendations.
3. Adopters maintain their profiles and submit applications.
4. Authorized staff review submitted applications.
5. Application decisions update the adoption workflow according to the configured business rules.
6. Follow-ups can be scheduled to support post-adoption monitoring.
7. Administrators review adoption metrics and recorded activity.

The exact transitions, eligibility rules, and follow-up schedules are defined by the database migrations and application implementation.

## Available npm Scripts

Use the scripts defined in `package.json`:

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Compile and validate the production build |
| `npm run start` | Start the production server after building |
| `npm run lint` | Run linting, if configured |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:seed` | Run the configured seed workflow, if available |

Additional scripts may be available for individual seed tasks or other project utilities.

## Testing and Validation

Before submitting changes or deploying the application:

1. Install dependencies successfully.
2. Run `npm run build` and resolve build errors.
3. Verify authentication and role-based access.
4. Test pet browsing and semantic matching.
5. Test adopter profile saving and application submission.
6. Verify that submitted applications appear in the tracker and authorized review interfaces.
7. Test adoption status transitions and follow-up behavior using appropriate test data.
8. Verify admin analytics, user management, and audit log pages.
9. Confirm that credentials and local environment files are not included in Git commits.

Use test accounts and a development database when testing actions that change adoption records.

## Deployment

The application can be deployed to a platform that supports Next.js, such as Vercel.

General deployment steps:

1. Import the GitHub repository into the hosting platform.
2. Configure the required environment variables securely.
3. Ensure the production database schema is up to date.
4. Run the production build.
5. Deploy the application and verify the main workflows.

Use a separate development or staging database for testing schema changes before applying them to production.

## Contributing

1. Create a feature branch for your changes.
2. Implement and test the feature locally.
3. Review your Git diff and ensure no secrets are included.
4. Commit your changes with a descriptive message.
5. Push the branch to GitHub.
6. Open a pull request for review before merging into the main branch.

Coordinate database migrations with other contributors to avoid conflicting schema changes.

## License

Add the project's chosen license here if one has been selected.

## Acknowledgements

Built using Next.js, React, PostgreSQL, Neon, and open-source machine learning tools.
