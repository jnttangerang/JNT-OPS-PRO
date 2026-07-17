# Database Architecture

## 1. Konsep Penyimpanan Saat Ini
Sistem saat ini menggunakan **Local JSON Database** (`db.json`) sebagai persistent storage. Setiap kali sistem menyala (atau jika file tidak ditemukan), backend akan men-generate data dari konstanta `initialDb`.

Mekanisme read/write:
- Seluruh isi `db.json` di-load ke dalam memori aplikasi menggunakan `fs.readFileSync`.
- Setiap ada perubahan/penambahan (POST), aplikasi melakukan modifikasi pada objek di memori, lalu menulis ulang seluruh objek tersebut kembali ke disk menggunakan `fs.writeFileSync`.

## 2. Struktur Tabel / Koleksi Data
Berikut adalah skema tabel (Array of Objects) yang terdapat di dalam struktur database:

1. **`Users`**: Menyimpan kredensial sistem.
   - Kolom: `user_id`, `username`, `password_hash`, `role` (ADMIN/OWNER), `outlet_id_home`, `status_aktif`.
2. **`Outlets`**: Cabang pengiriman J&T.
   - Kolom: `outlet_id`, `nama_outlet`, `alamat_outlet`.
3. **`Master_Customer`**: Buku alamat untuk identitas pengirim (Sender).
   - Kolom: `customer_id`, `nama_pengirim`, `no_hp`, `alamat_pengirim`, `last_updated`.
4. **`Riwayat_Penerima`**: Buku alamat penerima (Recipient), terkait erat (linked) dengan pengirim tertentu.
   - Kolom: `id`, `customer_id` (Relasi ke Master_Customer), `nama_penerima`, `no_hp_penerima`, `alamat_penerima`.
5. **`PreInput_Backup`**: Data temporer draft paket (mengamankan data jika sistem terputus/refresh).
   - Kolom: `id` (biasanya mengacu pada Session/TxID), `data` (JSON).
6. **`EXP_Resi`**: Transaksi resi jalur Express.
   - Kolom: Menyimpan informasi resi, pengirim, penerima, dimensi, tarif, diskon, net total, dll.
7. **`CRG_Resi`**: Transaksi resi jalur Cargo (Reguler & Motor).
   - Kolom: Identik dengan Express namun memiliki properti tambahan kendaraan (jika Cargo Motor).
8. **`AuditLogs`**: Catatan riwayat aktivitas di sistem.
   - Kolom: `id`, `timestamp`, `user_id`, `action`, `target`, `details`.
9. **`MapsReviews`**: Data sinkronisasi review asli dari Google Places / Data Simulasi AI.
   - Kolom: `id`, `outlet_id`, `nama_outlet`, `reviewer`, `stars`, `text`, `status_analisis`, `analisis`.

## 3. Limitasi & Risiko Arsitektur Saat Ini
- **Kinerja Blocking:** Penggunaan `fs.readFileSync` dan `writeFileSync` akan memblokir thread Node.js. Jika traffic tinggi, ini sangat berbahaya dan membuat aplikasi melambat drastis.
- **Race Conditions:** Tidak ada skema lock concurrency. Transaksi bersamaan dapat menyebabkan data saling tertimpa (Data loss).
- **In-Memory Scale:** Saat data riwayat transaksi mencapai puluhan ribu baris, stringifikasi JSON menjadi sangat mahal secara CPU/Memory.
- **Ephemeral Storage Cloud:** Pada environment Cloud Run / Serverless, sistem file (`/`) adalah _ephemeral_ (sementara). Ketika container ter-restart, file `db.json` akan kembali ke state awal kecuali volume dipasang (persistent disk).
