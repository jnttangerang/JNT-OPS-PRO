==========================================
   PHASE 25 — OPERATIONAL ENGINE AUDIT & EVIDENCE REPORT
==========================================

## 1. FILE YANG DIUBAH / DIBUAT
- `src/lib/operationalEngine.ts` (BARU — Single Source of Truth untuk Aturan Operasional)
- `src/lib/financialEngine.ts` (Murni pemilik rumus keuangan & kalkulasi)
- `server.ts` (Refactored controller, proxy error handler fallback, & route handlers)

## 2. ENGINE BARU YANG DIBUAT
`src/lib/operationalEngine.ts` (`OperationalEngine` / `BusinessRulesEngine`)
Menggabungkan seluruh aturan bisnis operasional ke dalam satu modul terpusat.

## 3. BUSINESS RULES YANG DIPINDAHKAN KE OPERATIONAL ENGINE
1. **State Transition Rules Matrix**:
   - Status transitions (`DRAFT` -> `WAITING_PAYMENT` -> `PAID` -> `READY_PICKUP` -> `PICKED_UP` -> `IN_TRANSIT` -> `DELIVERED` / `CANCELLED`)
   - Normalisasi status (`normalizeLifecycleStatus`) & penolakan status mundur/tidak sah (`validateLifecycleTransition`, `validateStateTransition`).
2. **Validasi Input**:
   - Validasi Resi (`validateResiFormat`)
   - Validasi Pelanggan (`validateCustomerData`)
   - Validasi Outlet & Admin (`validateOutletData`, `validateAdminData`)
   - Validasi Ekspedisi & Barang (`validateEkspedisi`, `validateBarangData`)
   - Validasi Batal / Hapus (`validateCancel`, `validateDelete`)
3. **Duplicate Protection Engine**:
   - `checkDuplicateResi`
   - `checkDuplicateCustomer`
   - `checkDuplicateTransaction`
   - `checkDuplicateImport`
4. **Snapshot Rules Engine**:
   - `createCustomerSnapshot`
   - `createBarangSnapshot`
   - `createOutletSnapshot`
   - `createAdminSnapshot`
5. **Shipment Rules Mapper**:
   - `buildShipmentObject` (Pemetaan dari `MASTER_TRANSAKSI` ke `MASTER_PENGIRIMAN`).
6. **Customer Rules Engine**:
   - `processCustomerRules` (Lookup, auto-upsert, dan penautan `pengirim_id` & `penerima_id`).
7. **Domain Assembler**:
   - `assembleTransactionDomain` (Memandu alur: Validasi -> Customer Rules -> Snapshots -> Financial Calculation -> Domain Assembly).

## 4. ENDPOINT YANG SEKARANG HANYA MENJADI CONTROLLER
- `/api/saveDataPreInput`
- `/api/saveTransaksi`
- `/api/checkDuplicateResi`
- `/api/deleteTransaksi`
- `/api/getDashboardData`
- `/api/getAdminDashboardData`
- `/api/getSetoranList`
- `/api/getReportingSummary`
- Express Proxy Middleware (`/api/:action`)

## 5. BUKTI FINANCIAL ENGINE TETAP MENJADI PEMILIK SELURUH RUMUS
`src/lib/financialEngine.ts` mendefinisikan:
- `calculateFinancialSummary(tx)`
- `calculateDailyFinancial(transactions)`
- `calculateAdminFinancial(transactions)`
- `calculateOutletFinancial(transactions)`
- `isTransactionValidForFinance(tx)`

Operational Engine mengimpor `calculateFinancialSummary` dari `financialEngine.ts` dan **TIDAK** menghitung ulang uang.

## 6. BUKTI OPERATIONAL ENGINE TIDAK MENGHITUNG UANG
`OperationalEngine` hanya menangani:
- Validasi & Alur Progresi Status
- Pengecekan Duplikat
- Pembuatan Snapshot Imutabel
- Penautan Pelanggan
- Pemetaan Objek Pengiriman

Setiap kalkulasi nilai rupiah diserahkan sepenuhnya kepada `calculateFinancialSummary()`.

## 7. BUKTI DATABASE HANYA DITULIS DARI LAYER PERSISTENCE
`OperationalEngine` dan `FinancialEngine` adalah murni *pure functions/classes* tanpa efek samping (side-effects) dan tidak memanggil `fs.writeFileSync` atau `writeDb()`. Persistence murni dilakukan oleh controller di `server.ts`.

## 8. DIAGRAM RUNTIME
Controller (Express Route Handler)
      │
      ▼
OperationalEngine (src/lib/operationalEngine.ts)
  - Validations
  - State Transitions
  - Duplicate Checking
  - Customer Linking
  - Snapshots
  - Shipment Mapping
      │
      ▼
FinancialEngine (src/lib/financialEngine.ts)
  - calculateFinancialSummary()
  - calculateDailyFinancial()
  - calculateAdminFinancial()
  - calculateOutletFinancial()
      │
      ▼
Persistence Layer (writeDb / JSON Storage)
      │
      ▼
Database (db.json)

## 9. HASIL PENGUJIAN & REGRESI
- Build Status: PASS (`compile_applet` BERHASIL)
- End-To-End Runtime Validation: PASS (`npx tsx run_all_tests.ts` 100% PASS)
- Apps Script Proxy Error Fallback: Handled (Gagal Google Spreadsheet otomatis fallback ke local DB handler).
