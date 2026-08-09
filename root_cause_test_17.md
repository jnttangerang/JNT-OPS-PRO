# ROOT CAUSE INVESTIGATION & RESOLUTION: TEST 17

## 1. Dari mana data Admin Performance diambil?
Data Admin Performance diambil di `src/lib/controlTowerEngine.ts` melalui function `getControlTowerSummary`. Pada Control Tower, data bersumber murni dari collection (array) `db.MASTER_TRANSAKSI`.

## 2. Filter apa yang digunakan?
Terdapat _strict pre-filtering_ terhadap collection `db.MASTER_TRANSAKSI` dengan kondisi filter yang sangat eksplisit:
```typescript
const allTxs = (db.MASTER_TRANSAKSI || []).filter((tx: any) => 
  tx.outlet_id === outlet_id && tx.tanggal_transaksi === tanggal
);
```

## 3. Apakah masih menggunakan seluruh transaksi global?
**TIDAK.** Transaksi yang diteruskan ke `calculateAdminFinancial(allTxs)` sudah difilter di awal. Variabel `allTxs` dijamin hanya memuat transaksi yang identik dengan parameter `outlet_id` dan `tanggal` yang sedang diminta.

## 4. Apakah Outlet Aktif benar-benar diterapkan?
**YA.** 
- Di tingkat Front-End (`ManagementControlTowerPage.tsx`), komponen secara eksplisit mengirimkan `activeOutletId` via query parameter: `/api/control-tower/summary?outlet_id=${activeOutletId}`.
- Di tingkat Back-End (`server.ts` & `controlTowerEngine.ts`), parameter `outlet_id` dari request query langsung digunakan untuk mem-filter keseluruhan source data.

## 5. Apakah terjadi data leakage antar outlet?
**TIDAK.** Root cause kegagalan `TEST 17` pada iterasi audit sebelumnya BUKAN karena adanya _data leakage_, melainkan murni **TYPE & DATA STRUCTURE MISMATCH** antara return value dari Financial Engine dan ekspektasi pada Test Script:
- **Ekspektasi Lama (Test Script):** Menganggap `adminPerformance` adalah _object literal / hash map_ dengan _key_ Admin ID (contoh: `sumA.data?.adminPerformance?.["ADM-1"]`).
- **Realita Implementasi (Financial Engine):** `calculateAdminFinancial` selalu mengembalikan array of objects, di mana Admin ID berada dalam properti objek (contoh: `[{ admin_id: "ADM-1", jumlah_resi: 1 }]`).

## Penyelesaian
Test Script telah diperbaiki (di-patch) menggunakan fungsi pencarian elemen array, dan tidak ada logic engine yang perlu di-bypass.
```typescript
sumA.data?.adminPerformance?.find((a:any)=>a.admin_id==="ADM-1")?.jumlah_resi === 1
```

**STATUS: TEST 17 PASSED.**

---

# BUKTI PENGHAPUSAN SUPER_ADMIN
Sudah dilakukan global search (grep) dan _hard cleanup_ terhadap keyword `SUPER_ADMIN`, `superAdmin`, atau `SUPERADMIN`. Seluruh bypass atau check conditional di UI dan layer permission kini hanya menggunakan `OWNER`.
