# 🏗️ Architecture Review Report: Transaction Engine (Phase 1)

Berdasarkan audit terhadap file **Code.gs** pada Phase 1, ditemukan beberapa pelanggaran prinsip arsitektur yang perlu diperbaiki sebelum melangkah ke Phase 2 (Setoran Engine).

Berikut adalah detail temuan dan rekomendasi refactor:

## 1. Ketergantungan Langsung pada SpreadsheetApp (Pelanggaran Prinsip 1)
- **Lokasi File:** `Code.gs`
- **Fungsi:** `TransactionService.saveTransaction`, `updateTransaction`, `deleteTransaction`, `savePreInput`
- **Alasan:** `TransactionService` masih berinteraksi langsung dengan Spreadsheet menggunakan `getSheetByName()`, `getDataRange()`, dll. Ini mencampuradukkan *Business Logic* dengan *Data Access Layer*.
- **Rekomendasi Refactor:** Buat layer `DatabaseService` khusus untuk menangani operasi pembacaan dan penulisan Spreadsheet.

## 2. Business Logic Masih Berada di Controller API (Pelanggaran Prinsip 3 & 8)
- **Lokasi File:** `Code.gs`
- **Fungsi:** `apiCheckDuplicateResi`
- **Alasan:** Endpoint ini masih membaca Spreadsheet secara langsung dan melakukan pencarian resi di dalam layer API controller.
- **Rekomendasi Refactor:** Pindahkan logika pengecekan duplikasi ke dalam `TransactionService`.

## 3. Timestamp dan Transaction ID Berubah Saat Update (Pelanggaran Prinsip 6)
- **Lokasi File:** `Code.gs`
- **Fungsi:** `TransactionService.updateTransaction`
- **Alasan:** Saat melakukan update, nilai `timestamp` selalu ditimpa dengan `new Date().toISOString()`. Selain itu, `transaksi_id` diatur secara paksa yang bisa menimpa data aslinya.
- **Rekomendasi Refactor:** Pada proses update, lakukan pencarian data *existing* terlebih dahulu. Pertahankan nilai `timestamp` dan `transaksi_id` dari data asli.

## 4. Tidak Ada Proteksi (Lock) untuk Transaksi yang Sudah Disetor (Pelanggaran Prinsip 7)
- **Lokasi File:** `Code.gs`
- **Fungsi:** `TransactionService.updateTransaction`, `TransactionService.deleteTransaction`
- **Alasan:** Belum ada mekanisme untuk mencegah update/delete pada transaksi yang sudah masuk ke proses Setoran.
- **Rekomendasi Refactor:** Tambahkan mekanisme pengecekan `SetoranData`. Jika status setoran bukan "Belum Disetor" atau "Ditolak", tolak update (LOCKED).

## 5. Audit Log (Prinsip 5)
- **Lokasi File:** `Code.gs`
- **Fungsi:** `TransactionService.updateTransaction`
- **Alasan:** Belum menyimpan snapshot before/after.
- **Rekomendasi Refactor:** Sesuai Task 5, fitur ini dapat ditunda (keep it simple untuk sekarang dengan struktur yang ada), tetapi pemanggilan audit log harus dipindahkan ke `DatabaseService`.

---

## 🛠️ Rencana Refactor Phase 1.1

1. **Membuat struktur DatabaseService.**
2. **Membersihkan TransactionService dari semua pemanggilan `SpreadsheetApp`.**
3. **Menerapkan mekanisme Transaction Lock sebelum Update/Delete.**
4. **Memperbaiki `updateTransaction` agar tidak overwrite timestamp.**
5. **Membersihkan controller `apiCheckDuplicateResi`.**
