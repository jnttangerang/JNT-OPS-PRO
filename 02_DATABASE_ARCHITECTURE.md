# Database Architecture

## 1. Database Architecture Overview
The system relies on a two-layer persistence architecture:
1. **Google Apps Script / Google Spreadsheet (SSOT)**: The ultimate authoritative data store (`Code.gs`).
2. **Local Cache (`db.json`)**: An ephemeral local representation stored on the Express server (`/tmp/db.json` on serverless environments like Vercel or Cloud Run), providing fast local queries while synchronizing mutations to the Google Spreadsheet.

## 2. Source of Truth
The Source of Truth for all operational and financial data is **Google Apps Script & Google Spreadsheet**. 
Because the application runs in a containerized serverless environment, `db.json` acts as an accelerated cache and fallback store.

| Domain | SSOT | Read By | Write By |
| ------ | ---- | ------- | -------- |
| Transactions | Google Apps Script (`MASTER_TRANSAKSI`) | Express API (via cache) | Express API (synchronous push to Apps Script) |
| Settlements | Google Apps Script (`Settlements`) | Express API (via cache) | Express API (synchronous push to Apps Script) |
| Petty Cash & Outlet Finances | Google Apps Script (`KEUANGAN_OUTLET`) | Express API / UI | Express API (`/api/saveKeuanganOutlet` / `updateKeuanganOutlet`) |
| Categories | Google Apps Script (`MasterKategoriKeuangan`) | Express API / UI | Express API |
| Financials | Backend Calculation (`financialEngine.ts`) | Frontend | Express API |
| Certifications | Google Apps Script (`FinancialCloseCertifications`) | Express API / UI | Express API (`financialCloseCertificationEngine.ts`) |

## 3. Sync Architecture
The system uses `syncDbWithAppsScript` (in `server.ts`) and direct mutative API handlers to bridge the two layers.
- **Write Path**: When a mutation occurs (e.g., `saveTransaksi`, `saveKeuanganOutlet`, `updateKeuanganOutlet`):
  1. The Express backend performs validation and constructs the standardized payload.
  2. The backend makes an HTTP POST request to the Google Apps Script Web App URL with defensive text/JSON parsing.
  3. If Apps Script confirms success, the new/updated record is merged into the local `db.json` cache and returned to the client.
  4. If Apps Script fails or returns an error, the operation returns an error to prevent silent data desynchronization between the spreadsheet and local cache.
- **Read Path**: Fast local queries use `db.json`. Periodic sync checks (`syncDbWithAppsScript`) pull updated data from Google Spreadsheet to keep local cache warm and accurate.
- **Proxy Resilience**: The Express middleware proxy checks `UTILITY_ACTIONS` and prefix patterns (`dailyClosing`, `reconciliation`, `settlement`, `financial-close`, `control`, `workflow`, `management`, `intelligence`, `promo`). If Apps Script returns HTML or unrecognized action errors, the request automatically falls back to local Express route handlers.

## 4. Active Data Domains & Collections
Below are the active data domains and their representations in `db.json` and Google Spreadsheet:
- **`MASTER_TRANSAKSI`**: Central repository for all active packages and shipments.
- **`KEUANGAN_OUTLET`**: Granular tracking for petty cash, operational expenses, cash-in injections, and fee deductions.
- **`MasterKategoriKeuangan`**: Reference categories for income (`KAT-201`, etc.) and expenses (`KAT-101` Gaji, `KAT-103` BBM, `KAT-104` Transport, `KAT-105` ATK, etc.).
- **`MASTER_CUSTOMER`, `MASTER_PENGIRIM`, `MASTER_PENERIMA`**: Normalized address and contact books.
- **`MASTER_PENGIRIMAN`**: Shipment metadata and courier assignments.
- **`Users`**: Internal system credentials and role configurations (`ADMIN` / `OWNER`).
- **`PreInput_Backup`**: Unfinished drafted packages.
- **`SetoranData` (Master_Setoran)**: Cash deposits submitted by cashiers.
- **`Settlements`**: Daily reconciliation and approval workflow records (`STL-${outlet_id}-${tanggal}`).
- **`DailyClosing`**: Procedural daily closing locks per outlet per date.
- **`Exceptions`**: Discrepancy flags detected during reconciliation (shortfalls, overages).
- **`FinancialCloseCertifications`**: Owner-level 10-point certification records locking financial periods.
- **`AuditLogs` / `AuditTrails`**: Immutable operational activity logs.

## 5. KEUANGAN_OUTLET Schema & Multi-Pocket Tracking
The `KEUANGAN_OUTLET` sheet tracks all outlet-level cash movements with 13 columns:
```
Col 1:  id (e.g., KNG-xxxxxxx)
Col 2:  tanggal (YYYY-MM-DD)
Col 3:  outlet_id (e.g., OUT-002)
Col 4:  jenis (PEMASUKAN | PENGELUARAN)
Col 5:  kategori_id (e.g., KAT-103)
Col 6:  nominal (Number)
Col 7:  deskripsi (String)
Col 8:  bukti_url (String URL / Base64 attachment)
Col 9:  dibuat_oleh (User display name)
Col 10: created_at (ISO timestamp)
Col 11: aktif (Boolean)
Col 12: resi_id (Optional tracking number)
Col 13: lokasi_uang ("ADMIN" | "OWNER")
```
- **Two-Pocket Segregation (`lokasi_uang`)**:
  - `ADMIN`: Physical cash held by branch cashier / outlet cash drawer (used for daily operational expenses like BBM and petty cash).
  - `OWNER`: Funds handled directly by the branch owner (e.g., owner capital injections, major equipment, or owner-retained balances).

## 6. MASTER_TRANSAKSI
- **Purpose**: Tracks every physical package/receipt processed.
- **Key Fields**: `transaksi_id`, `no_resi`, `outlet_id`, `tanggal_transaksi`, `grand_total`, `status_transaksi`.
- **Financial Role**: Base input for all financial calculations. Revenue is derived dynamically by summing `grand_total` of non-cancelled records.

## 7. Financial Data Flow
```
MASTER_TRANSAKSI + KEUANGAN_OUTLET
        ↓
Financial Engine (`calculateDailyFinancial`) - Calculates theoretical expected cash and expense deductions.
        ↓
Daily Closing Engine - Secures the day's operations from routine cashier edits.
        ↓
Reconciliation Engine - Compares Expected Cash vs. Actual Deposit (`SetoranData`).
        ↓
Settlement Engine - Packages the day into a `SettlementRecord`.
        ↓
Financial Close Certification Engine - Final Owner approval ensuring absolute integrity across 10 checklist gates.
```

## 8. Settlement Storage
- **Schema**: `SettlementRecord`.
- **ID Strategy**: Deterministic: `STL-${outlet_id}-${tanggal}`. This prevents duplicate settlements for the same day.
- **Lifecycle**: `UNSETTLED` -> `IN_REVIEW` -> `APPROVED` / `REJECTED`.
- **Persistence**: Synced with Google Spreadsheet `Settlements` sheet.

## 9. Seed / Initial Data
`initialDb` exists in `server.ts` as a **Bootstrap/Fallback** if the environment boots with an empty local filesystem before initial synchronization with Apps Script succeeds.

## 10. Persistence Risk & Mitigations
- **Ephemeral Filesystem**: Handled by pushing mutative actions directly to Google Apps Script before writing local cache.
- **Apps Script Response Variations**: Handled with defensive response parsing (`asText` -> try `JSON.parse`) to prevent server crashes when Google Apps Script returns HTML errors or redirect pages.
- **Stale Cache**: Controlled via short TTL and cache invalidation on mutations.

## 11. Database Migration Status
- **CURRENT**: Google Apps Script (SSOT) + Ephemeral Local JSON Cache (`db.json`).
- **TARGET (Future)**: Cloud SQL (PostgreSQL) using ORM (e.g., Drizzle). Domain engines are already decoupled from raw HTTP/spreadsheet logic to allow clean migration.
