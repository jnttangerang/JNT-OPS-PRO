# System Context

## 1. Overview
J&T OPS PRO is an integrated operational and financial control web application for J&T branch management. It provides end-to-end tracking for branch operations, including transaction drafting, daily closing, reconciliation, financial settlements, and strict owner-level certification controls.

## 2. Technical Architecture
- **Frontend**: React 18+ with Vite, Tailwind CSS, Lucide-React, Recharts. Routing is handled via `react-router-dom` (recently migrated from internal state).
- **Backend**: Node.js + Express.js (`server.ts`).
- **Database/Storage**: The true Source of Truth (SSOT) is **Google Spreadsheet accessed via Google Apps Script**. The Express server maintains an ephemeral local cache (`db.json` / `/tmp/db.json` on Vercel), which is heavily synchronized with Apps Script via `syncDbWithAppsScript()`. 
- **Domain Engines**: Complex business rules (Financial, Settlement, Reconciliation, Daily Closing) are strictly isolated in `src/lib/*Engine.ts` and run **authoritatively on the backend**.

## 3. Operational Control Scope
The system tracks shipments from Pre-Input (draft) to full transaction (Express/Cargo), capturing pricing, weights, and metadata. It includes AI-based Address Optimizations (via Gemini) and automated Google Maps review analysis.

## 4. Financial Control Scope
The system enforces strict financial integrity through:
1. **Financial Engine**: Calculates expected cash based on transactions (`calculateDailyFinancial`).
2. **Reconciliation Engine**: Validates expected vs. actual deposits, capturing shortfalls or overages as Exceptions.
3. **Settlement Engine**: Manages the lifecycle of daily settlements (UNSETTLED → IN_REVIEW → APPROVED/REJECTED).
4. **Daily Closing Engine**: Enforces procedural boundaries to lock a day's operations.
5. **Financial Close Certification Engine**: Provides the highest level of owner-only control, running 10 stringent integrity checks before allowing a day to be "CERTIFIED", effectively locking all related records.

## 5. System Components Flow
```
USER (UI)
   ↓
REACT FRONTEND (Displays data, dispatches actions)
   ↓
EXPRESS API (`server.ts` endpoints)
   ↓
DOMAIN ENGINES (`src/lib/*Engine.ts` - Business Logic, Verification, Calculation)
   ↓
SYNC LAYER (`syncDbWithAppsScript()`)
   ↓
GOOGLE APPS SCRIPT (SSOT)
```

## 6. Authentication & Roles
- **Roles**: `ADMIN` (Staff/Cashier) and `OWNER` (Branch Owner).
- **Security**: Hard role checks are enforced in the backend engines (e.g., only OWNER can approve settlements or certify financial close).

## 7. Outlet Model
Data is partitioned by `outlet_id`. Transactions, daily closings, and settlements are strictly isolated per outlet per date.

## 8. Transaction Lifecycle
`Draft (Pre-Input) -> Active Transaction (Saved) -> Locked (Daily Closing) -> Certified (Financial Close)`

## 9. Financial Lifecycle
`Expected Revenue (Financial Summary) -> Actual Deposit (Setoran) -> Reconciliation (Exceptions) -> Settlement Approval`

## 10. Settlement Lifecycle
1. Cashier creates deposit (Setoran)
2. Settlement Engine compares Deposit vs Expected Revenue
3. Status moves to `IN_REVIEW`
4. Owner Reviews & Approves (`APPROVED`) or Rejects (`REJECTED`)
5. If Approved, day can proceed to Financial Close Certification.

## 11. Audit & Control Architecture
All mutative actions are tracked via `auditEngine.ts`, which logs events (e.g., `TRANSACTION_UPSERT`, `SETTLEMENT_APPROVED`, `FINANCIAL_CERTIFICATION_COMPLETED`) to ensure complete accountability.

## 12. Deployment & Runtime
- **Frontend & Backend** run together on a Serverless Container environment (e.g., Cloud Run / Vercel).
- **Ephemeral Storage**: `/tmp/db.json` is used due to the serverless nature. Persistence is guaranteed by synchronous push to Apps Script for critical mutations, and periodic pulls for cache refreshing.

## 13. Current Architecture Status
The system has matured from a monolithic Express file to a layered architecture. Domain logic is successfully decoupled into `src/lib/*Engine.ts`. 

## 14. Legacy & Transition Areas
- `db.json` is still used as a local cache.
- `server.ts` is still quite large (~9000 lines) because API routes have not yet been fully extracted into a `src/server/routes/` structure.

## 15. Known Technical Debt
- **Route Extraction**: `server.ts` routing needs to be modularized.
- **Transaction Hard-Locking**: `updateTransaksi` does not yet structurally block edits after a day is "CERTIFIED" (currently relies on UI blocks and some backend warnings, but needs absolute mutative blocking at the endpoint level).
- **Storage Strategy**: The reliance on Google Apps Script as SSOT may face rate-limiting or concurrency bottlenecks under high scale, necessitating a future migration to Cloud SQL.
