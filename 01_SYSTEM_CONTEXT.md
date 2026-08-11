# System Context

## 1. Ikhtisar Proyek
Aplikasi J&T OPS PRO merupakan sistem berbasis web terpadu untuk mengelola alur operasional pencatatan pengiriman J&T (Express & Cargo). Aplikasi ini menggunakan arsitektur Monolith Full-Stack dengan React.js untuk frontend dan Express.js untuk backend dalam satu repository.

## 2. Arsitektur Teknis
- **Frontend Framework:** React 18+ (dengan Vite)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Iconography:** Lucide-React
- **Charts:** Recharts
- **Backend Framework:** Node.js + Express.js
- **Database:** Local JSON File (`db.json`)
- **Third-Party Integrations:** 
  - Google Gemini API (Untuk fitur Perbaiki Alamat AI & Analisis Ulasan)
  - Google Places API (Untuk sinkronisasi otomatis ulasan Maps outlet)

## 3. Struktur Modul Utama (Frontend)
Routing tidak menggunakan React Router, melainkan di-manage menggunakan state internal `currentView` di `src/App.tsx`.
Modul/View yang tersedia:
- `login`: Halaman autentikasi.
- `pre-input`: Form pencatatan awal pengirim dan penerima (dilengkapi AI Address Optimizer).
- `transaksi`: Form input detail paket dan pembayaran (Express / Cargo).
- `riwayat-transaksi`: Daftar transaksi historis.
- `dashboard`: Ringkasan statistik pendapatan & performa (khusus peran OWNER).
- `ulasan-maps`: Integrasi API Google untuk analisis ulasan pelanggan outlet.
- `guide`: Halaman petunjuk penggunaan.

## 4. Endpoint Backend (server.ts)
Backend menyediakan RESTful API sebagai layer perantara antara UI dan local database. Beberapa route utamanya:
- `/api/login` (Autentikasi User)
- `/api/searchCustomer`, `/api/getRiwayatPenerima` (Master Data Pencarian)
- `/api/saveDataPreInput`, `/api/getPreInput` (Draft Pre-Input)
- `/api/saveTransaksi`, `/api/getRiwayatTransaksi`, `/api/deleteTransaksi` (Manajemen Resi/Transaksi)
- `/api/perbaikiAlamatAI`, `/api/analyzeReview` (Integrasi AI Gemini)
- `/api/syncGoogleReviews` (Integrasi Google Places API)

## 5. Alur Operasional Sistem
1. **Autentikasi:** Karyawan (ADMIN) atau Pemilik (OWNER) login.
2. **Pre-Input (Drafting):** Karyawan mencatat pengirim dan penerima. Sistem menggunakan NLP Gemini AI untuk mengoreksi penulisan alamat. Data di-save sementara.
3. **Transaksi Utama:** Meneruskan Pre-Input menjadi resi jadi (Express/Cargo) dengan detail biaya dan berat paket, termasuk scan barcode/QR.
4. **Analisis Sentimen:** Memonitor otomatis kepuasan pelanggan lewat ulasan Google Maps cabang.
5. **Monitoring (Owner):** Pemilik dapat mengakses dashboard analitik.
