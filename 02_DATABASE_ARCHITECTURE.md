# Database Architecture

## 1. Database Architecture Overview
The system relies on a two-layer persistence architecture:
1. **Google Apps Script / Google Spreadsheet (SSOT)**: The ultimate authoritative data store.
2. **Local Cache (`db.json`)**: An ephemeral local representation stored on the Express server. On Vercel, this is written to `/tmp/db.json` which resets when the container goes cold.

## 2. Source of Truth
The Source of Truth for all operational and financial data is **Google Apps Script**. 
Because the application runs in a serverless environment (Vercel), `db.json` acts merely as a volatile cache.

| Domain | SSOT | Read By | Write By |
| ------ | ---- | ------- | -------- |
| Transactions | Google Apps Script | Express API (via cache) | Express API (via Apps Script sync) |
| Settlements | Google Apps Script | Express API (via cache) | Express API (via Apps Script sync) |
| Financials | Backend Calculation | Frontend | Express API |

## 3. Sync Architecture
The system uses `syncDbWithAppsScript` (in `server.ts`) to bridge the two layers.
- **Write Path**: When a mutation occurs (e.g., `saveTransaksi`), the backend makes a synchronous HTTP POST to the Apps Script URL. If it succeeds, the data is updated in the local cache. If Apps Script fails, the transaction is rejected to prevent local vs. remote drift.
- **Read Path**: The local cache is heavily utilized for fast reads. `syncDbWithAppsScript` executes periodic pulls from Apps Script based on a TTL cache expiry (e.g., pulling latest transactions, deposits, financial records) and merges them into the local state.
- **Sync Method**: The sync mechanism primarily performs an **upsert/replace** of targeted subsets of data (e.g., transactions for a given date/outlet) to keep the cache fresh.

## 4. Data Domains
Below are the active data tables/collections (Arrays of Objects in the JSON schema):
- **`MASTER_TRANSAKSI`**: Central repository for all active packages.
- **`MASTER_CUSTOMER`, `MASTER_PENGIRIM`, `MASTER_PENERIMA`**: Normalized address and contact books.
- **`MASTER_PENGIRIMAN`**: Shipment specific metadata.
- **`Users`**: Internal system credentials.
- **`PreInput_Backup`**: Unfinished drafted packages.
- **`SetoranData` (Master_Setoran)**: Represents actual cash deposited by cashiers.
- **`KeuanganOutlet`**: Daily outlet financial state snapshots.
- **`Settlements`**: Daily reconciliation and approval workflow records.
- **`DailyClosing`**: Records representing a locked operational day.
- **`Exceptions`**: Detected anomalies during reconciliation (e.g., missing money).
- **`FinancialCloseCertifications`**: The highest tier records marking an owner's absolute certification of a day's finances.
- **`AuditLogs`**: Immutable operational action history.

## 5. MASTER_TRANSAKSI
- **Purpose**: Tracks every physical package/receipt processed.
- **Key Fields**: `transaksi_id`, `no_resi`, `outlet_id`, `tanggal_transaksi`, `grand_total`, `status_transaksi`.
- **Financial Role**: This is the base input for all financial calculations. Revenue is derived dynamically by summing `grand_total` of non-cancelled records.

## 6. Financial Data Flow
```
MASTER_TRANSAKSI
        ↓
Financial Engine (`calculateDailyFinancial`) - Calculates theoretical expected cash.
        ↓
Daily Closing Engine - Secures the day's transactions from casual edits.
        ↓
Reconciliation Engine - Compares Expected Cash vs. Actual Deposit (`SetoranData`).
        ↓
Settlement Engine - Packages the day into a `SettlementRecord`.
        ↓
Financial Close Certification Engine - Final Owner approval ensuring absolute integrity.
```

## 7. Settlement Storage
- **Schema**: `SettlementRecord`.
- **ID Strategy**: Deterministic. `STL-${outlet_id}-${tanggal}`. This prevents duplicate settlements for the same day.
- **Lifecycle**: `UNSETTLED` -> `IN_REVIEW` -> `APPROVED` / `REJECTED`.
- **Persistence**: Managed by `ensureSettlementTable` and synced with Apps Script.

## 8. Seed / Initial Data
`initialDb` exists in `server.ts` but is now used purely for **Bootstrap/Fallback** if the environment is entirely empty and unable to reach Apps Script. It provides hardcoded admin/owner users and outlet master data to allow the system to boot, but operational data will instantly be overwritten once a successful `syncDbWithAppsScript` resolves.

## 9. Persistence Risk
- **Ephemeral Filesystem**: Vercel's `/tmp` guarantees that `db.json` will be lost when the container sleeps.
- **Stale Cache**: Fast consecutive reads might hit the cache before Apps Script sync finishes, though the system limits this via TTL.
- **Partial Writes**: If a backend engine completes a mutative operation but the process dies right before syncing to Apps Script, data loss will occur.

## 10. Database Migration Status
- **CURRENT**: Google Apps Script + Ephemeral Local JSON Cache.
- **TARGET (Future)**: Cloud SQL (PostgreSQL) using ORM (e.g., Drizzle). The domain engines are structured to easily accept a real DB driver injection once the JSON filesystem logic is phased out.
