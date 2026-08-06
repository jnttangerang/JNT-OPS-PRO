# PHASE 23 — FINANCIAL ENGINE REPORT

## 1. File yang diubah
- `server.ts` (Ditambahkan logika utilitas Financial Engine pada layer core Backend Node/Express).

## 2. Financial Engine yang dibuat
- `safeNum(val)`: Sanitasi data numerik menjadi 0 jika null/NaN/undefined/kosong.
- `calculateRounding(tx)`: Menghitung selisih pembayaran customer vs total tagihan dasar.
- `calculateOutletCash(tx)`: Menghitung total hak outlet.
- `calculateOwnerDeposit(tx)`: Menghitung total yang wajib disetor ke owner.
- `calculateCustomerPayment(tx)`: Mengambil total uang dari customer.
- `isTransactionValidForFinance(tx)`: Filter status transaksi valid.
- `calculateFinancialSummary(tx)`: Method agregasi per 1 row transaksi.

## 3. Helper yang direuse
- Tidak membuat struktur data baru, menggunakan payload/schema standard dari array `MASTER_TRANSAKSI` (`tx.total_customer`, `tx.ongkir_yoyi`, `tx.packing`, `tx.amplop`, `tx.biaya_lain`, dll).
- Fungsi engine dibuat terisolasi sehingga endpoint dashboard mana pun yang menggunakan `MASTER_TRANSAKSI` dapat memanggil utilitas ini.

## 4. Rumus Owner Deposit
```typescript
const baseOwner = safeNum(tx.ongkir_yoyi) + safeNum(tx.asuransi) + safeNum(tx.biaya_lain_yoyi);
const rounding = calculateRounding(tx);
return baseOwner + rounding;
```
> Pembulatan customer otomatis ditambahkan ke total wajib setor owner.

## 5. Rumus Outlet Cash
```typescript
return safeNum(tx.packing) + safeNum(tx.amplop) + safeNum(tx.biaya_lain);
```
> Kas outlet murni dari biaya packing, amplop, dan biaya tambahan lainnya. Tidak terpengaruh pembulatan resi customer.

## 6. Rumus Customer Payment
```typescript
return safeNum(tx.total_customer || tx.total_dibayar_customer);
```
> Mengambil langsung total pembayaran yang diinput/direkam di resi.

## 7. Cara menangani CANCELLED
Fungsi `isTransactionValidForFinance(tx)` secara otomatis me-return `false` apabila `status_transaksi` merupakan salah satu dari `"CANCELLED"`, `"BATAL"`, `"REVISED"`, atau `"FAILED"`. Helper agregasi (`calculateDailyFinancial`, dll) akan men-skip (`continue`) baris transaksi tersebut.

## 8. Cara menangani NaN
Seluruh field dilewatkan ke fungsi `safeNum(val)` yang melakukan sanitasi. Jika `val` bernilai `null`, `undefined`, atau hasil parsing Number mereturn `NaN`, nilai tersebut otomatis dikonversi menjadi `0`.

## 9. Cara aggregation bekerja
Fungsi agregasi seperti `calculateDailyFinancial(transactions)`, `calculateAdminFinancial(transactions)`, dan `calculateOutletFinancial(transactions)` melakukan looping terhadap array transaksi (parameter `transactions` dari MASTER_TRANSAKSI).
- Melakukan verifikasi filter via `isTransactionValidForFinance()`.
- Memanggil `calculateFinancialSummary(tx)` untuk setiap baris.
- Mengakumulasi hasilnya ke dalam total (contoh: `total_customer`, `total_owner`, `total_outlet`) secara global, per-admin, atau per-outlet tanpa redundancy logic perhitungan.

## 10. Bukti seluruh perhitungan hanya membaca MASTER_TRANSAKSI
Fungsi-fungsi (`calculateDailyFinancial`, `calculateAdminFinancial`, `calculateOutletFinancial`) mengambil argument `transactions` (yang merujuk pada array dari tabel `MASTER_TRANSAKSI`). Parameter objek transaksi tersebut (`tx`) memiliki mapping kunci yang murni dari schema MASTER_TRANSAKSI, tanpa join ke tabel `MASTER_PENGIRIM`, `MASTER_PENERIMA`, `MASTER_PENGIRIMAN`, ataupun `IMPORT_LOG`.

## 11. Build Validation
Build dan kompilasi tipe TypeScript (`npm run build` & `npx tsc --noEmit`) berhasil dieksekusi bersih tanpa error maupun peringatan.
