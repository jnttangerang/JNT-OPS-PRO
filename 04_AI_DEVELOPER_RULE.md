# AI Developer Rules (Project Constitution)

Dokumen ini adalah aturan wajib dan panduan etika coding bagi AI Developer (Agent) yang bekerja di dalam codebase ini. Setiap request perubahan dari User harus diverifikasi silang dengan dokumen ini.

## A. SOURCE OF TRUTH (Prioritas Tertinggi)
`Source code > runtime evidence > tests > documentation > assumptions`
- Jangan pernah mengubah arsitektur berdasarkan asumsi dari dokumentasi lama. 
- Jika dokumentasi (termasuk `01_SYSTEM_CONTEXT.md` atau `02_DATABASE_ARCHITECTURE.md`) bertentangan dengan *code* aktual, lakukan audit (grep/trace) ke source code, karena source code adalah pemegang kebenaran absolut.

## B. FINANCIAL & DOMAIN RULE (Strict Backend-Authoritative)
- **TIDAK BOLEH** memindahkan kalkulasi finansial, perhitungan komisi, penentuan total setoran, atau status *approval* ke frontend (React).
- Semua kalkulasi dan manipulasi data harus berasal dari 16 domain engine di `src/lib/*Engine.ts` di backend. Frontend hanya bertugas menampilkan (render) data dan mengirim aksi.
- Untuk transaksi kas/petty cash (`KeuanganOutlet`), selalu pertahankan pemisahan dua kantong (`lokasi_uang`: `"ADMIN"` untuk kas laci operasional harian kasir vs `"OWNER"` untuk dana/injeksi owner).

## C. DATABASE & PERSISTENCE RULE
- Database utama (SSOT) adalah **Google Spreadsheet via Apps Script (`Code.gs`)**. File `db.json` hanyalah cache ephemeral (tersimpan di `/tmp` pada container serverless).
- **JANGAN** pernah melakukan `fs.writeFileSync` tanpa memikirkan siklus sinkronisasi Google Apps Script. Mutasi data penting harus dipastikan tersimpan di Google Spreadsheet terlebih dahulu.
- **DEFENSIVE NETWORK PARSING**: Apps Script web apps dapat mengembalikan HTML error page, 302 redirects, atau non-JSON text saat timeout/crash. Handler komunikasi ke Apps Script WAJIB membaca response sebagai teks (`await res.text()`) lalu melakukan safe `JSON.parse` di dalam try-catch block untuk mencegah fatal crash process.
- **JANGAN** membuat koleksi/tabel JSON baru tanpa alasan kuat. Manfaatkan domain data eksisting (`MASTER_TRANSAKSI`, `KEUANGAN_OUTLET`, `SetoranData`, `Settlements`, `DailyClosing`, `Exceptions`, dll.).

## D. NO DUPLICATE BUSINESS LOGIC
Jangan menulis fungsi perhitungan baru jika `src/lib/*Engine.ts` sudah memilikinya. Lakukan `import` dan panggil fungsi terkait (misal: `calculateDailyFinancial()`, `validateDailyClosing()`, `reconcileDaily()`, `certifyFinancialClose()`).

## E. DATA FLOW & TRACING FIRST
Sebelum memperbaiki bug data, kamu **WAJIB** menelusuri alurnya (Trace):
`UI Caller -> Express API / Proxy -> Domain Engine -> Storage Sync Layer -> Google Apps Script (SSOT)`
Memperbaiki *symptom* (seperti melempar error di UI saja tanpa memblokir di backend API) dilarang keras! Lakukan *Hard Lock* di backend API.

## F. MINIMAL & SURGICAL CHANGE (Lazy Senior Dev Principle)
- Gunakan perubahan terkecil (shortest diff) yang menuntaskan akar masalah (*Root Cause*).
- Jangan membongkar ulang modul besar hanya untuk memperbaiki satu validasi.
- Hindari membuat boilerplate, unrequested abstractions, atau dependensi baru jika built-in library / codebase sudah memadai.

## G. ROLE & SECURITY (RBAC)
Saat mengedit alur *Approval* (Setoran, Settlement, Certification, Keuangan Outlet):
- Pastikan pengecekan *role* (`actor_role === 'OWNER'`) dilakukan secara ketat di backend, bukan sekadar menyembunyikan tombol di UI frontend.
- Jangan mengekspos token rahasia atau API Keys (Google Maps/Gemini) ke layer client React. Selalu proxy via Express (`server.ts`).

## H. NO ASSUMPTION
Jika tidak menemukan bukti kuat di source code saat diminta mengubah suatu bagian, sebutkan fakta yang ditemukan secara objektif. Lebih baik memverifikasi langsung daripada merusak arsitektur data.

## I. TESTING & VERIFICATION
Setiap perubahan logic yang non-trivial (khususnya finansial dan sinkronisasi):
1. Wajib dicek tipe TypeScript-nya (`npm run lint` atau `tsc`).
2. Wajib dipastikan build lulus 100% (`npm run build`).
3. Dilakukan verifikasi fungsional langsung terhadap API endpoint dan persistensi data.
