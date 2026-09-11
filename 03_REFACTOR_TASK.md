# Refactoring Tasks & Roadmap

This document outlines the current state of refactoring tasks and the technical debt roadmap, based on the *actual* codebase implementation.

## P0 — Data Integrity & Financial Correctness

### ID: P0-1
**TITLE**: Mutative Endpoint Hard-Locking
**STATUS**: IN PROGRESS
**PROBLEM**: While the Financial Close Certification Engine provides 10 strict checks and locks the UI from edits, certain legacy mutative endpoints (like `updateTransaksi`) do not natively check the `CERTIFIED` status of a day before allowing an edit. 
**CURRENT STATE**: Validation happens effectively at the UI layer and during business workflows, but a direct API call could potentially bypass certification locks.
**TARGET STATE**: All mutative endpoints affecting transaction amounts must query `getSettlementRecord` and `getCertificationRecord` to reject requests (HTTP 403/400) if the day is locked.
**AFFECTED FILES**: `server.ts` (API routes).
**DEPENDENCIES**: `financialCloseCertificationEngine.ts`.
**ACCEPTANCE CRITERIA**: Direct cURL requests to modify a transaction on a `CERTIFIED` date return an error and fail to mutate the DB.

## P1 — Security, Authorization, and Auditability

### ID: P1-1
**TITLE**: Role-Based Access Control (RBAC) Hardening in Express
**STATUS**: IN PROGRESS
**PROBLEM**: The frontend correctly hides "Owner-only" buttons, but `server.ts` routes often check `req.body.actor.actor_role` which can be spoofed by a client, instead of relying on a secure session/JWT.
**CURRENT STATE**: `server.ts` extracts actor info from the request payload.
**TARGET STATE**: Implement a proper JWT or session middleware that validates the user's role on the server, injecting it into `req.user` rather than trusting `req.body`.
**AFFECTED FILES**: `server.ts`.
**DEPENDENCIES**: Authentication endpoints.
**ACCEPTANCE CRITERIA**: Spoofed POST requests with fake `actor_role: "OWNER"` are rejected by the server if the underlying token is an ADMIN.

## P2 — Architecture & Maintainability

### ID: P2-1
**TITLE**: Modularize `server.ts` Routes
**STATUS**: NOT STARTED
**PROBLEM**: `server.ts` is a monolithic file approaching 9,000 lines. While domain logic has been successfully moved to `src/lib/*Engine.ts`, the Express route definitions remain clustered.
**CURRENT STATE**: All `app.post` and `app.get` definitions are in one file.
**TARGET STATE**: Routes are split into domain controllers (e.g., `src/server/routes/transactionRoutes.ts`, `src/server/routes/settlementRoutes.ts`).
**AFFECTED FILES**: `server.ts`.
**DEPENDENCIES**: None.
**ACCEPTANCE CRITERIA**: `server.ts` only handles middleware setup and router registration.

### ID: P2-2
**TITLE**: Database Driver Migration (Cloud SQL)
**STATUS**: NEWLY IDENTIFIED / BLOCKED (Awaiting Infra)
**PROBLEM**: The system relies on Google Apps Script as the ultimate SSOT and `/tmp/db.json` as a cache. This architecture is prone to rate limits, race conditions, and requires complex synchronous HTTP calls during mutative operations.
**CURRENT STATE**: `syncDbWithAppsScript` manages data persistence.
**TARGET STATE**: Direct connection to a managed Cloud SQL instance using an ORM like Drizzle, completely removing Apps Script dependency for core transactional operations.
**AFFECTED FILES**: All engines, `server.ts`, `db.json`.
**DEPENDENCIES**: Provisioning of Cloud SQL instance.
**ACCEPTANCE CRITERIA**: CRUD operations bypass Apps Script and persist directly to a relational database.

### ID: P2-3
**TITLE**: Eliminate UTILITY_ACTIONS Manual Whitelist
**STATUS**: NEWLY IDENTIFIED
**PROBLEM**: Middleware proxy di `server.ts` menggunakan whitelist manual (`UTILITY_ACTIONS`, 129 entri) untuk menentukan apakah sebuah request diproses lokal oleh Express atau di-forward ke Google Apps Script. Setiap route lokal baru HARUS didaftarkan secara manual. Commit 4908d90 menambahkan 4 route handler Promo Review Validation tetapi lupa mendaftarkannya di UTILITY_ACTIONS, menyebabkan production fallback ke Apps Script dan error "Aksi tidak dikenali".
**CURRENT STATE**: 129 whitelist entries, 108 local routes, 21 legacy orphan entries, 1 duplicate entry (`getKeuanganOutlet`).
**TARGET STATE**: Route lokal didaftarkan SEBELUM proxy middleware, atau implementasi `hasLocalRoute()` yang auto-detect dari router registry Express.
**AFFECTED FILES**: `server.ts` (middleware + UTILITY_ACTIONS array).
**DEPENDENCIES**: None.
**ACCEPTANCE CRITERIA**: 
- Tidak ada lagi whitelist manual di `server.ts`.
- Setiap route lokal otomatis di-exempt dari proxy ke Apps Script.
- Ada automated test yang gagal jika ada route lokal tanpa whitelist (guard test terhadap regresi).

## P3 — UX & Operational Improvements

### ID: P3-1
**TITLE**: Move Remaining Local File Uploads to Cloud Storage
**STATUS**: IN PROGRESS
**PROBLEM**: Route API `/api/uploadFile` still saves some files to a local `./uploads` directory, which is ephemeral in Cloud Run / Vercel.
**CURRENT STATE**: Local `fs.writeFileSync` is used.
**TARGET STATE**: Implementation of Google Cloud Storage bucket or AWS S3 for all binary assets.
**AFFECTED FILES**: `server.ts` (upload routes).
**DEPENDENCIES**: None.
**ACCEPTANCE CRITERIA**: Image uploads survive container restarts.

## Completed Tasks (Archived)
- **DONE**: Extraction of business logic into isolated Engine files (`financialEngine.ts`, `settlementEngine.ts`, etc.).
- **DONE**: Migration from internal `currentView` state routing to `react-router-dom`.
- **DONE**: Implementation of Financial Close Certification with 10-point integrity checks.
- **DONE**: Implementation of Apps Script synchronization layer for persistence.
