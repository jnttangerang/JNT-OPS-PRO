# System Context

## 1. Overview
J&T OPS PRO is an integrated operational and financial control web application for J&T branch management. It provides end-to-end tracking for branch operations, including transaction drafting, daily closing, reconciliation, petty cash & outlet finances (`KeuanganOutlet`), financial settlements, operational workflows, and strict owner-level certification controls.

## 2. Technical Architecture
- **Frontend**: React 18+ with Vite, Tailwind CSS, Lucide-React, Recharts. Routing is handled via `react-router-dom`.
- **Backend**: Node.js + Express.js (`server.ts`), running on port 3000.
- **Database/Storage**: The true Source of Truth (SSOT) is **Google Spreadsheet accessed via Google Apps Script (`Code.gs`)**. The Express server maintains an ephemeral local cache (`db.json` / `/tmp/db.json` on Vercel/Cloud Run), synchronized with Apps Script via `syncDbWithAppsScript()` and direct endpoint forwarders with defensive JSON/text parsing and local fallback.
- **Domain Engines**: Complex business and operational rules are strictly isolated in `src/lib/*Engine.ts` (16 domain engines) and run **authoritatively on the backend**.

## 3. Operational Control Scope
The system tracks shipments from Pre-Input (draft) to full transaction (Express/Cargo), capturing pricing, weights, and metadata. It includes:
- AI-based Address Optimizations (via Gemini API server-side proxy).
- Automated Google Maps review analysis & sentiment tracking.
- Operational workflow validation and exception tracking (`operationalWorkflowEngine.ts`, `operationalControlEngine.ts`).
- Cross-outlet management control tower and executive decision support (`controlTowerEngine.ts`, `decisionEngine.ts`, `managementIntelligenceEngine.ts`).

## 4. Financial Control Scope
The system enforces strict financial integrity through:
1. **Financial Engine (`financialEngine.ts`)**: Calculates expected cash based on transactions (`calculateDailyFinancial`).
2. **Reconciliation Engine (`reconciliationEngine.ts`, `reconciliationReviewEngine.ts`)**: Validates expected vs. actual deposits, capturing shortfalls or overages as Exceptions.
3. **Settlement Engine (`settlementEngine.ts`)**: Manages the lifecycle of daily settlements (UNSETTLED → IN_REVIEW → APPROVED/REJECTED).
4. **Daily Closing Engine (`dailyClosingEngine.ts`)**: Enforces procedural boundaries to lock a day's operations.
5. **Financial Close Certification Engine (`financialCloseCertificationEngine.ts`, `financialCloseEvidenceEngine.ts`)**: Provides the highest level of owner-only control, running 10 stringent integrity checks before allowing a day to be "CERTIFIED", effectively locking all related records.
6. **Outlet Cash & Expense Management (`KeuanganOutlet`)**: Manages daily petty cash, operational expenses (BBM, ATK, Transport, etc.), and owner injections, with strict dual-pocket segregation (`lokasi_uang`: `ADMIN` vs `OWNER`) synchronized directly with the Google Spreadsheet `KEUANGAN_OUTLET` sheet.

## 5. System Components Flow
```
USER (UI / React 18)
   ↓
REACT FRONTEND (Displays data, dispatches actions via hooks/useAppsScript)
   ↓
EXPRESS API (`server.ts` endpoints with defensive proxy & local fallback)
   ↓
DOMAIN ENGINES (`src/lib/*Engine.ts` - Business Logic, Verification, Calculation)
   ↓
SYNC & PERSISTENCE LAYER (`syncDbWithAppsScript()` & direct API handlers)
   ↓
GOOGLE APPS SCRIPT / GOOGLE SPREADSHEET (SSOT: `Code.gs`)
```

## 6. Authentication & Roles
- **Roles**: `ADMIN` (Staff/Cashier) and `OWNER` (Branch Owner).
- **Security**: Hard role checks are enforced in the backend engines (e.g., only OWNER can approve settlements, certify financial close, or resolve critical exceptions).
- **Storage of Credentials**: Managed securely in the `Users` sheet with salted hash passwords and login audit logging.

## 7. Outlet Model
Data is partitioned by `outlet_id`. Transactions, daily closings, petty cash records, and settlements are strictly isolated per outlet per date.

## 8. Transaction Lifecycle
`Draft (Pre-Input) -> Active Transaction (Saved) -> Locked (Daily Closing) -> Certified (Financial Close)`

## 9. Financial Lifecycle
`Expected Revenue (Financial Summary) -> Actual Deposit (Setoran) -> Petty Cash / Mutasi Kas (Keuangan Outlet) -> Reconciliation (Exceptions) -> Settlement Approval -> Financial Close Certification`

## 10. Settlement Lifecycle
1. Cashier creates deposit (Setoran).
2. Settlement Engine compares Deposit vs Expected Revenue.
3. Status moves to `IN_REVIEW`.
4. Owner Reviews & Approves (`APPROVED`) or Rejects (`REJECTED`).
5. If Approved, day can proceed to Financial Close Certification.

## 11. Audit & Control Architecture
All mutative actions are tracked via `auditEngine.ts` and `auditTrailEngine.ts`, which log events (e.g., `TRANSACTION_UPSERT`, `SETTLEMENT_APPROVED`, `FINANCIAL_CERTIFICATION_COMPLETED`, `KEUANGAN_OUTLET_SAVED`) to ensure complete accountability.

## 12. Deployment & Runtime
- **Frontend & Backend** run together on a Serverless Container environment (Cloud Run / Vercel).
- **Ephemeral Storage**: `/tmp/db.json` is used due to the serverless container lifecycle. Persistence is guaranteed by direct push to Apps Script for critical mutations, and periodic pulls for cache refreshing.
- **Proxy Resilience**: Express proxy middleware intercepts `/api/:action`, bypassing known local routes and auto-falling back to Express route handlers if Apps Script returns non-JSON or unhandled action errors.

## 13. Current Architecture Status
The system has matured from a monolithic Express file to a layered architecture. All domain logic is decoupled into 16 engine files in `src/lib/`. The Express backend securely mediates between the React frontend and the Google Apps Script persistence layer.

## 14. Legacy & Transition Areas
- `db.json` is maintained as a high-performance local read cache.
- `server.ts` is ~9,800 lines because API routes are still declared in a single file rather than modular router files (`src/server/routes/`).

## 15. Known Technical Debt
- **Route Extraction**: `server.ts` routing definitions need to be split into modular route files.
- **Transaction Hard-Locking**: `updateTransaksi` mutative endpoint needs server-level hard blocking against `CERTIFIED` dates.
- **Storage Scalability**: Migration to Cloud SQL (PostgreSQL) remains the long-term target for enterprise scale.
