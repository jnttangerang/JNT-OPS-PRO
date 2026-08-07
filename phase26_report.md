==========================================
   PHASE 26 — AUDIT ENGINE REPORT & EVIDENCE
==========================================

## 1. FILE YANG DIUBAH / DIBUAT
- `src/lib/auditEngine.ts` (BARU — Single Source of Truth untuk Evaluasi Kualitas & Audit Transaksi)
- `server.ts` (Import & endpoint integration `/api/auditTransaction` & `/api/getAuditData`)
- `test_phase26_audit_engine.ts` (Automated Unit & Batch Test Suite untuk Phase 26)
- `phase26-report.md` (Laporan Bukti Audit Engine)

## 2. AUDIT ENGINE YANG DIBUAT
Modul terpusat `src/lib/auditEngine.ts` bertindak sebagai satu-satunya pusat evaluasi kualitas, konsistensi data, kelayakan finansial/dashboard, serta skor dan rekomendasi operasional.

## 3. SEMUA AUDIT RULES (PART 1 - PART 10)
- **PART 1 (Transaction Audit)**: Memastikan ketersediaan `transaksi_id`, `outlet_id`, `admin_id`, `tanggal`, `no_resi`. Jika ada yang kosong -> **ERROR**.
- **PART 2 (Customer Audit)**: Memastikan `pengirim_id` & `penerima_id` valid dan terdaftar di Master Pelanggan, serta ketersediaan snapshot customer. Jika tidak ditemukan -> **CRITICAL**.
- **PART 3 (Shipment Audit)**: Memastikan ketersediaan baris di `MASTER_PENGIRIMAN` dengan `transaksi_id` yang sesuai. Jika hilang -> **WARNING**. Jika ditemukan record tanpa `transaksi_id` -> **ERROR**.
- **PART 4 (Financial Audit)**: Memanggil `calculateFinancialSummary()`. Memvalidasi `owner_deposit`, `customer_payment`, `outlet_cash`, dan `rounding`. Jika `NaN`, `undefined`, atau negatif -> **ERROR**.
- **PART 5 (Lifecycle Audit)**: Menggunakan Operational Engine (`validateLifecycle`). Jika status melanggar aturan progresi status -> **ERROR**.
- **PART 6 (Duplicate Audit)**: Menggunakan Operational Engine (`checkDuplicateResi`, `checkDuplicateCustomer`, `checkDuplicateTransaction`, `checkDuplicateImport`). Jika duplikat ditemukan -> **CRITICAL**.
- **PART 7 (Photo Audit)**: Memvalidasi ketersediaan `foto_barang` & `foto_resi`. Jika belum diunggah -> **WARNING**.
- **PART 8 (Sync Audit)**: Jika `status_sync === 'FAILED'` -> **ERROR**. Jika `status_sync === 'PENDING'` -> **WARNING**.
- **PART 9 (Approval / Settlement Audit)**: Jika `PAID`/`SELESAI` tetapi setoran outlet masih `PENDING` -> **WARNING**. Jika status setoran `DITOLAK`/`REJECTED` -> **ERROR**.
- **PART 10 (Dashboard & Finance Eligibility)**: Menentukan boolean flags secara deterministik tanpa duplikasi logika:
  - `countedInDashboard`
  - `countedInFinance`
  - `countedInTarget`
  - `countedInAudit`
  - `countedInReport`

## 4. SEMUA HELPER
- `auditTransaction(db, txIdOrObj)` -> Mengevaluasi single transaksi.
- `auditDaily(db, dateStr, outletId)` -> Batch audit harian per outlet/semua outlet.
- `auditOutlet(db, outletId)` -> Batch audit seluruh transaksi outlet tertentu.
- `auditAdmin(db, adminId)` -> Batch audit transaksi per admin/petugas.
- `auditImport(db, importId)` -> Batch audit transaksi per sesi import.

## 5. ENGINE YANG DIREUSE
- **Financial Engine** (`src/lib/financialEngine.ts`):
  - `calculateFinancialSummary(tx)`
  - `isTransactionValidForFinance(tx)`
- **Operational Engine** (`src/lib/operationalEngine.ts`):
  - `normalizeLifecycleStatus(status)`
  - `validateLifecycle(tx)`
  - `checkDuplicateResi(db, noResi, excludeTxId)`
  - `checkDuplicateCustomer(db, hp)`
  - `checkDuplicateTransaction(db, txId)`
  - `checkDuplicateImport(db, importId)`

## 6. BUKTI FINANCIAL ENGINE TETAP PEMILIK SELURUH RUMUS
Audit Engine **TIDAK MENGHITUNG UANG**. Untuk evaluasi finansial, Audit Engine murni memanggil `calculateFinancialSummary(tx)` dari `financialEngine.ts` dan memvalidasi apakah hasilnya angka sah (bukan NaN/undefined/negatif).

## 7. BUKTI OPERATIONAL ENGINE TETAP PEMILIK BUSINESS RULES
Audit Engine murni memanggil fungsi validasi progresi lifecycle dan fungsi duplicate checker dari `operationalEngine.ts` tanpa menulis aturan operasional baru secara independen.

## 8. BUKTI AUDIT ENGINE HANYA MEMBACA HASIL KEDUA ENGINE
Audit Engine merupakan *pure evaluation functions* yang membaca `MASTER_TRANSAKSI`, `MASTER_PENGIRIMAN`, dan `Master_Pelanggan`, lalu mereuse hasil kalkulasi dari Financial Engine dan Operational Engine. Audit Engine **TIDAK MENULIS/MENGUBAH DATABASE**.

## 9. DAFTAR SELURUH STATUS AUDIT
1. `VALID`: Transaksi sempurna tanpa error atau warning.
2. `WARNING`: Transaksi sah, tetapi memiliki catatan minor (misal foto belum diunggah, setoran pending).
3. `ERROR`: Transaksi memiliki pelanggaran aturan finansial, sync failed, data wajib kurang, atau setoran ditolak.
4. `CRITICAL`: Transaksi memiliki kecacatan fatal (customer tidak terdaftar / duplikasi resi).

## 10. CARA SCORE DIHITUNG
- Skor dasar = 100.
- Jika `status === "CRITICAL"` -> `score = 0`.
- Jika `status === "ERROR"` -> `score = Math.max(10, 50 - (errors.length - 1) * 10 - warnings.length * 5)`.
- Jika `status === "WARNING"` -> `score = Math.max(60, 100 - warnings.length * 10)`.
- Jika `status === "VALID"` -> `score = 100`.

## 11. CARA RECOMMENDATION DIBUAT
Rekomendasi dihasilkan secara dinamis berdasarkan temuan masalah:
- Foto belum ada -> `"Upload Foto Paket & Resi"`
- Customer missing/invalid -> `"Lengkapi Customer & Master Pelanggan"`
- Setoran pending -> `"Approval Setoran oleh Owner"`
- Sync failed/pending -> `"Sinkronkan Data Ke Server / Cloud"`
- Duplikat -> `"Review Duplicate Resi / Transaksi"`
- Data transaksi kurang -> `"Lengkapi Data Transaksi (Outlet/Admin/Tanggal/Resi)"`

## 12. RUNTIME TRACE
Controller (Express Route Handler)
      │
      ▼
OperationalEngine (src/lib/operationalEngine.ts)
  - Validations, Lifecycle Transition, Duplicate Check
      │
      ▼
FinancialEngine (src/lib/financialEngine.ts)
  - Pure Financial Calculation: calculateFinancialSummary()
      │
      ▼
Audit Engine (src/lib/auditEngine.ts)
  - Evaluation of Quality, Score, Issues, Recommendations, Eligibility
      │
      ▼
Persistence Layer (writeDb / JSON Storage)
      │
      ▼
Database (db.json)

## 13. HASIL VERIFIKASI & PENGUJIAN
- Build Status: PASS (`compile_applet` BERHASIL tanpa error)
- Linting: PASS (`lint_applet` 100% clean, `tsc --noEmit` 0 errors)
- Audit Engine Unit & Batch Test Suite: PASS (`npx tsx test_phase26_audit_engine.ts` 100% PASS)
- End-To-End Regression Test Suite: PASS (`npx tsx run_all_tests.ts` 100% PASS)
