# FindIt

Lost and found web application for campus communities. Built with **React** (frontend), **NestJS**, **TypeORM**, and **PostgreSQL** (backend).

## Prerequisites

- **Node.js**: version 20 or newer
- **PostgreSQL**: version 14 or newer

## Setup & Running the Project

1. **Recreate the database** (for fresh migration):
   ```sql
   DROP DATABASE IF EXISTS findit;
   CREATE DATABASE findit;
   ```

2. **Install dependencies**:
   ```bash
   npm install
   npm install --prefix client
   npm install --prefix server
   ```

3. **Configure environment variables**:
   - Copy `server/.env.example` to `server/.env`:
     ```env
     DATABASE_URL=postgresql://postgres:postgres@localhost:5432/findit
     JWT_SECRET=your-secure-jwt-secret-key
     CLIENT_URL=http://localhost:5173
     SCHOOL_EMAIL_DOMAIN=your-school.edu
     PORT=3000
     ```
   - (Optional) Copy `client/.env.example` to `client/.env` if configuring a custom server host:
     ```env
     VITE_API_URL=http://localhost:3000/api
     ```

4. **Run database migrations**:
   ```bash
   npm run migration:run --prefix server
   ```

5. **Start development servers**:
   ```bash
   npm run dev
   ```
   This concurrently runs the NestJS watch server (`nest start --watch`) on port 3000 and the Vite client on port 5173.

6. **Access the application**:
   - Web application: [http://localhost:5173](http://localhost:5173)
   - Interactive Swagger API Documentation: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
   - Local mock emails are saved in `server/dev-emails/`.

## Testing

Run unit tests and end-to-end integration tests:
```bash
# Run test suite
npm run test --prefix server

# Run test coverage suite (>90% coverage on critical services)
npm run test:cov --prefix server
```

For continuous integration with a separate database, set `DATABASE_URL` in your test environment to point to a dedicated `findit_test` database.

## Architecture & Migration Details

- **Backend**: NestJS with strict TypeScript (`no .js` in source).
- **ORM**: TypeORM with migration files (`synchronize: false`).
- **Auth**: Single-use hashed `AuthToken` entity for verification and password reset.
- **Security**: Passwords hashed with bcrypt; unverified accounts blocked from signing in with resend option.
- **Reliability**: Asynchronous background email delivery preventing HTTP 500 regressions during SMTP outages.

## Quality checks (Labs 4, 5 and 6)

- `npm run lint`: ESLint on the whole repository (server and client, TypeScript only). `npm run lint:fix` fixes what can be fixed automatically.
- `npm run test:cov`: Jest with coverage. The run fails if a global coverage is under 80 % (statements, functions, lines) or 70 % (branches). The HTML report is written in `server/coverage/`.
- The GitHub Actions workflow (`.github/workflows/ci.yml`) runs `npm ci`, `npm run lint`, `npm run build`, `npm run test:cov --prefix server` and the "no `.js` in the TypeScript sources" check, then uploads `server/coverage` as the `coverage-report` artifact.
- `postman/FindIt API Postman Collection.json`: Postman collection (v2.1) with tests for the authentication, the gallery, the saved searches CRUD and the admin access control. Import it in Postman, set the collection variables `email` and `password` to a verified student account, start the server (`npm run dev`) and run the collection.
- `js-practice.js` and `practice/`: JavaScript exercises of Lab 5 adapted to FindIt (`node js-practice.js`, `node practice/main.mjs`). They are exercises outside the application sources.

## Account deletion and usability measure

- **FR-25 / NFR-PRIV-03**: a signed-in user opens "My account" in the header and uses "Delete my account" (with a confirmation step). The account is anonymized, the public announcements are archived, the saved searches are removed and the login is refused.
- **NFR-USA-01 / TC-NFR-USA-01**: `scripts/count-interactions.mjs` drives the application in a browser from the home page to a submitted declaration and counts the clicks, selections and file choices (typing is not counted). Last measure (after preselecting "I keep it"): lost object 5 interactions (limit 5, met); found object 6 interactions (limit 5, one above): "I found an object", category, precise object, place, one photo, submit. A single grouped object menu (category and precise object in one choice) would bring it to 5.

## DevOps chain

Every change goes through the same chain: a branch named with its Jira key, a commit that starts with the key, a pull request whose title starts with the key, the GitHub Actions checks (lint, build, tests with coverage), and the development panel of the Jira story.
