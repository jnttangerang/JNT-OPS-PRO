# AI Developer Rules (Project Constitution)

Dokumen ini adalah aturan wajib dan panduan etika coding bagi AI Developer (Agent) yang bekerja di dalam codebase ini. Setiap request perubahan dari User harus diverifikasi silang dengan dokumen ini.

## A. SOURCE OF TRUTH (Prioritas Tertinggi)
`Source code > runtime evidence > tests > documentation > assumptions`
- Jangan pernah mengubah arsitektur berdasarkan asumsi dari dokumentasi lama. 
- Jika dokumentasi (terutama `01_SYSTEM_CONTEXT.md` atau `02_DATABASE_ARCHITECTURE.md`) bertentangan dengan *code* aktual, lakukan audit (grep/trace) ke source code, karena source code adalah pemegang kebenaran absolut.

## B. FINANCIAL & DOMAIN RULE (Strict Backend-Authoritative)
- **TIDAK BOLEH** memindahkan kalkulasi finansial, perhitungan komisi, penentuan total setoran, atau status *approval* ke frontend (React).
- Semua kalkulasi dan manipulasi data harus berasal dari `src/lib/*Engine.ts` di backend. Frontend hanya bertugas menampilkan (render) data.

## C. DATABASE & PERSISTENCE RULE
- Database utama (SSOT) adalah **Google Spreadsheet via Apps Script**. File `db.json` hanyalah cache ephemeral (tersimpan di `/tmp` jika di Vercel).
- **JANGAN** pernah melakukan `fs.writeFileSync` tanpa memikirkan siklus `syncDbWithAppsScript`. Mutasi harus berhasil di Apps Script terlebih dahulu agar tersimpan permanen.
- **JANGAN** membuat koleksi/tabel JSON baru tanpa alasan kuat. Cari domain data eksisting terlebih dahulu (misal: jangan buat `KeuanganBaru` jika `KeuanganOutlet` sudah mencukupi).

## D. NO DUPLICATE BUSINESS LOGIC
Jangan menulis fungsi perhitungan baru (seperti menghitung total transaksi) jika `financialEngine.ts` atau `settlementEngine.ts` sudah memilikinya. Lakukan `import` dan panggil fungsi tersebut (contoh: `calculateDailyFinancial()`).

## E. DATA FLOW & TRACING FIRST
Sebelum memperbaiki bug data, kamu **WAJIB** menelusuri alurnya (Trace):
`UI Caller -> Express API -> Domain Engine -> Storage Sync -> Database Cache`
Memperbaiki *symptom* (seperti melempar error di UI saja tanpa memblokir di backend API) dilarang keras! Lakukan *Hard Lock* di backend API.

## F. MINIMAL & SURGICAL CHANGE
Gunakan perubahan terkecil (shortest diff) yang menuntaskan akar masalah (*Root Cause*). Jangan membongkar ulang satu modul besar hanya untuk memperbaiki satu validasi. Hindari menghapus *fallback/legacy compatibility layer* secara membabi buta tanpa mengecek konsumennya.

## G. ROLE & SECURITY (RBAC)
Saat mengedit alur *Approval* (Setoran, Settlement, Certification):
- Pastikan pengecekan *role* (`actor_role === 'OWNER'`) dilakukan secara ketat di backend, bukan sekadar menghilangkan tombol di UI frontend.
- Jangan mengekspos token rahasia, API Keys (Google Maps/Gemini) ke layer client React. Selalu proxy via Express.

## H. NO ASSUMPTION
Jika tidak menemukan bukti kuat di source code saat diminta mengubah suatu bagian, sebutkan `UNKNOWN / REQUIRES VERIFICATION` ke User. Lebih baik bertanya daripada merusak arsitektur data.

## I. TESTING & VERIFICATION
Setiap perubahan logic yang non-trivial (khususnya finansial) **WAJIB**:
1. Dicek tipe TypeScript-nya (`npm run lint` atau `tsc`).
2. Dipastikan dapat di-*build* (`npm run build`).
3. Dilakukan verifikasi dengan membaca log/hasil dari file *route* yang terimbas.
