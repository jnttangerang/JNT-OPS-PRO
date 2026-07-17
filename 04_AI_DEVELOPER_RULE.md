# AI Developer Rules (Project Constitution)

Dokumen ini adalah aturan wajib dan panduan etika coding bagi AI Developer (Agent) yang bekerja di dalam codebase ini. Setiap request perubahan dari User harus diverifikasi silang dengan dokumen ini.

## 1. Aturan Modifikasi Code (Surgical Edits)
- **Do Not Break Existent Behavior:** Sebelum memodifikasi, baca dan pahami _flow_ aslinya. Jangan hapus kode yang sedang berfungsi kecuali User memintanya (atau sedang melakukan migrasi refaktor secara sadar).
- **Keep Variable Consistency:** Gunakan nama tabel/tata bahasa yang konsisten. Jangan mencampur variabel Inggris (misal `recipient_history`) jika file asli menggunakan `Riwayat_Penerima`.
- **Preserve Security (API Keys):** Jangan pernah merender, console.log, atau memasukkan token rahasia/API KEY ke dalam layer klien (React). Semua third-party service (Gemini, Google Places) **WAJIB** dieksekusi melalui Express API Server di `server.ts`.

## 2. Aturan Kualitas UI/UX
- **Desain Intensional:** Teruskan styling Tailwind CSS (mengacu pada pedoman _"Design Philosophy"_). Gunakan visual yang rapi, margin yang lapang, dan responsivitas seluler.
- **Zero Tech-Slop:** Jangan tambahkan elemen UI bohongan yang menampilkan "Terminal Logs", "Ping/MS", dsb., kecuali User dengan eksplisit meminta dashboard bergaya Hacker. 
- **Graceful Error Handling:** Setiap *fetch* wajib dilengkapi blok `try/catch`. Tangani error API (misal 403 Google API atau 429 Gemini API) dengan toast/alert pesan berbahasa Indonesia yang bersahabat kepada kasir/admin. 

## 3. Aturan Resolusi Konflik (Source of Truth)
- Jika instruksi User bertentangan dengan struktur database saat ini, sampaikan secara objektif melalui komentar (atau perbaiki skema jika diinstruksikan). 
- Referensi arsitektur dan tabel ada di `01_SYSTEM_CONTEXT.md` dan `02_DATABASE_ARCHITECTURE.md`.
- Rencana perbaikan _technical debt_ ada di `03_REFACTOR_TASK.md`. Jangan melakukan refaktor radikal tanpa instruksi, gunakan pendekatan gradual/step-by-step.

## 4. Pola Pengembangan Full-Stack
- **Server:** Gunakan struktur Express standar. Jangan ubah script `dev`, `build`, atau `start` dalam `package.json` yang dapat memecahkan konfigurasi infrastruktur port (port statis: 3000). 
- **Frontend:** Gunakan `import` dari `lucide-react` untuk ikon. Hindari library baru jika kapabilitas bawaan yang ada di repository (seperti HTML5-QRCode, Recharts, dll.) masih cukup.
- **Dependensi Tambahan:** Jika perlu menginstal module Node tambahan, pikirkan dampaknya ke bundle size. Utamakan _native capabilities_.
