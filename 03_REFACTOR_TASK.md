# Refactoring Tasks & Rekomendasi Arsitektur

Dokumen ini mendata kelemahan sistem dari implementasi yang ada (berdasarkan Source of Truth) dan merekomendasikan roadmap perbaikan untuk kestabilan jangka panjang.

## Prioritas 1: Migrasi Database Cloud-Native
- **Masalah:** Aplikasi berjalan dengan `db.json` yang di-write secara sinkronus. Dalam arsitektur containerized (seperti Google Cloud Run), local file akan reset/hilang ketika instance scale-down ke 0 atau di-restart.
- **Tugas (Refactor):** 
  - Ganti JSON file driver dengan koneksi ke layanan Database Production Cloud (Misalnya **Google Cloud SQL PostgreSQL** menggunakan ORM seperti Prisma/Drizzle, atau **Firebase Firestore** untuk NoSQL).
  - Tulis ulang API call untuk menggunakan database instance secara *asynchronous* (non-blocking).

## Prioritas 2: Migrasi File Upload ke Cloud Storage
- **Masalah:** Route API `/api/uploadFile` menyimpan gambar di folder lokal `./uploads`. Ini menghadapi masalah persistensi (hilang jika container mati) dan keamanan path traversal.
- **Tugas (Refactor):**
  - Implementasikan upload ke Bucket Cloud Storage (misal: **Google Cloud Storage**).
  - Simpan hanya URL absolut (atau ID object) di dalam database, bukan path absolut OS.

## Prioritas 3: Modularisasi `server.ts`
- **Masalah:** File `server.ts` telah mencapai ~1500 baris. Semua rute (Auth, Transaksi, Master Data, Eksternal API) dan skema dummy-nya disatukan pada file yang sama.
- **Tugas (Refactor):**
  - Buat folder `src/server/routes/` atau `src/server/controllers/`.
  - Pisahkan setiap domain (misal: `auth.ts`, `transaction.ts`, `customer.ts`, `maps.ts`).

## Prioritas 4: Standardisasi Struktur State & Komponen
- **Masalah:** Semua navigasi global berada di 1 state `currentView` dalam `App.tsx` (lebih dari 400 baris). State form pre-input juga teramat panjang.
- **Tugas (Refactor):**
  - Implementasikan **React Router** untuk manajemen path URL yang proper. Hal ini memungkinkan User untuk merespon klik Back Button browser tanpa harus logout atau kehilangan sesi navigasinya.

## Prioritas 5: Optimalisasi API Polling & Network Request
- **Masalah:** Pada integrasi Gemini & Places API, call dilakukan sinkron saat hit endpoint. Jika Places API gagal atau Gemini limit (Rate Limit), User Experience (UX) akan ter-block.
- **Tugas (Refactor):**
  - Pastikan loading UI handle timeout dengan baik.
  - Untuk Gemini AI, batasi pengulangan retry, simpan fallback error yang graceful ke dalam database, jangan return error HTTP 500 langsung.
