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
