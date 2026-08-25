import { parseYoYiText } from "./src/utils/yoyiParser";

const text = `
No. Pesanan:
ID26080125112295

No. Resi:
JD0578077660

Sumber Order:
YoYi-WEB

Status paket:
Diserahkan

Nama outlet:
YZ_ MDP JAYANTI CIKANDE

Kode outlet:
ID29000873

Metode perhitungan:
DFOD

Tipe Produk:
EZ

Nilai barang:
100000

Pengirim:
BADROWI

No. Telepon Pengirim:
087741440961

Kode Pos:
15611

Wilayah:
BANTEN BALARAJA

Detail Alamat Pengirim:
KP. JAYANTI RT.015 RW 003 DS CIKANDE KEC. JAYANTI TANGERANG BANTEN

Penerima:
BOBI

No. HP Penerima:
082116966354

Kode Pos:
45413

Wilayah:
JAWA BARAT MAJALENGKA CIGASONG

Detail Alamat Penerima:
BLOK LAMEJAJAR RT 17 RW 6 KEL. CICENANG KEC. CIGASONG KAB. MAJALENGKA RUMAH NO. 51 JABAR

Nama Barang:
AKSESORIS

Berat:
1.00 KG

Ongkir Dasar:
16000

Biaya Asuransi:
200

Biaya lain:
0

Perhitungan Biaya Pengiriman:
16200

Riwayat operasi:
Buat pesanan baru; RISKA AMUDIA; 2026-08-01 09:43:38
Cetak resi; RISKA AMUDIA; 2026-08-01 09:43:39
`;

console.log(JSON.stringify(parseYoYiText(text), null, 2));
