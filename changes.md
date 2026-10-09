# Changes & Migration Compliance Record

This document records the complete implementation of the checklist items across **Part A (Migration)**, **Part B (Post-Migration Features & Hardening)**, and **Part C (Client Optimizations)** on branch `feature/nestjs-typeorm-migration`.

---

## Part A: NestJS & TypeORM Migration

- **A1 (Express replaced with NestJS)**:
  - Created modular architecture: `auth`, `users`, `announcements`, and `mail` modules.
  - Implemented strong DTO validation via `class-validator` and `class-transformer` with a global `ValidationPipe` (whitelist + transform + forbidNonWhitelisted).
  - Enforced TypeScript strict mode in `tsconfig.json` (`strict: true`), with zero `.js` files in source trees.
- **A2 (Raw SQL replaced with TypeORM)**:
  - Eliminated all 14 hand-written SQL queries from Express.
  - Implemented `User`, `AuthToken`, and `FoundAnnouncement` entities.
  - Schema managed exclusively via TypeORM migration (`InitialSchema1730000000000`), with `synchronize: false` in `AppModule`.
- **A3 (API Route & Error Contract Preserved)**:
  - Maintained exact routes: `/api/auth/register`, `/api/auth/verify`, `/api/auth/resend-verification`, `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/logout`, and `/api/announcements/*`.
  - Implemented global `AllExceptionsFilter` (`http-exception.filter.ts`) to ensure uniform JSON error objects (`{ error: string, ...extra }`), preserving the `"expired"` and `"unverified"` flags that the client expects.
  - Preserved standard HTTP status codes (`201` for registration, `204` for logout, `200` for login/reset/resend, `401` for auth errors).
- **A4 (Swagger OpenAPI)**:
  - Added `@nestjs/swagger` with interactive documentation served at `/api/docs`.
  - Fully annotated all endpoints with `@ApiOperation`, `@ApiResponse`, `@ApiTags`, `@ApiBearerAuth`, and decorated DTOs with `@ApiProperty`.
- **A5 (Pinned Dependency Versions)**:
  - Replaced all `"latest"` and semver ranges (`^`, `~`) with exact versions across `server/package.json` (16 runtime + dev dependencies pinned) and `client/package.json` (8 pinned dependencies).
- **A6 (NestJS Server Execution & Database Setup)**:
  - Updated server execution script to `nest start --watch` via `npm run start:dev` and updated root `npm run dev` with `concurrently`.
  - Documented local database recreation steps (`DROP DATABASE findit; CREATE DATABASE findit;`) and migration command in `README.md`.
- **A7 (Unified AuthToken Entity)**:
  - Created `AuthToken` entity with `id`, `user` (ManyToOne, cascade on delete), `type` (`email_verification` | `password_reset`), `tokenHash` (SHA-256), `expiresAt`, and `usedAt`.
  - Generates 32-byte cryptographically secure tokens; single-use (marks `usedAt = now()`), invalidates prior tokens upon reissuance.
- **A8 (Configurable CORS Origins)**:
  - In `main.ts`, parses comma-separated origins from `CLIENT_URL` with trimming and fallback to `http://localhost:5173`.

---

## Part B: Hardening, Reliability & Testing

- **B1 (Unverified Account Login Refusal & Resend Link)**:
  - `AuthService.login()` rejects unverified accounts with `UnauthorizedException({ error: 'Please verify your account before signing in.', unverified: true })`.
  - Client (`App.tsx`) handles the unverified state and surfaces the "Resend verification email" action button immediately to allow one-click resend.
- **B2 (Non-blocking Resilient Email Delivery)**:
  - Background email delivery in both registration (`register`) and announcement submission (`create`): saves entities to PostgreSQL first, triggers email asynchronously with error catching, and returns immediate success responses to prevent SMTP outages from triggering HTTP 500 duplicate retries.
- **B3 (Comprehensive Test Suite & DoD Compliance)**:
  - Created unit tests and integration tests using Jest and Supertest (`auth.service.spec.ts`, `announcements.service.spec.ts`, `mail.service.spec.ts`, `announcements.controller.spec.ts`, `http-exception.filter.spec.ts`, `app.e2e.spec.ts`).
  - Achieved **>94% total coverage** (critical services: `AnnouncementsService` 100%, `AuthService` 96.4%, `MailService` 95.5%), easily surpassing the 70% Definition of Done requirement.
  - Enhanced GitHub Actions workflow (`ci.yml`) to run builds, tests, and verify no `.js` files exist in source folders on PR and push.
- **B4 (Extended User Fields for FR-01)**:
  - Added `firstName` (nullable varchar), `lastName` (nullable varchar), `gdprConsent` (boolean default false), `role` (varchar default 'student'), and `status` (varchar default 'active') to the `User` entity, migration, and DTOs.

---

## Part C: Client Enhancements

- **C1 (Configurable API Endpoint)**:
  - Updated client to read `import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'`.
  - Added `client/.env.example` with fallback documentation and enabled `--host` for network/mobile testing in `client/package.json`.
- **C2 (iOS Safari Zoom Prevention)**:
  - Configured `input, textarea { font-size: 16px; }` in `client/src/styles.css` to prevent auto-zooming on iOS Safari when focusing fields.
- **C3 (Consistent Font Hierarchy)**:
  - Applied `input, textarea, button { font-family: inherit; }` in `client/src/styles.css`.
- **C4 (Safari Mobile Dynamic Viewport Fix)**:
  - Set `.page { min-height: 100vh; min-height: 100dvh; }` with `100vh` fallback in `client/src/styles.css`.
