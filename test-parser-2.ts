import { parseYoYiText } from "./src/utils/yoyiParser";

const text = `
Rincian Pesanan
Informasi Pesanan
No. Pesanan
ID26080125647213
Sumber Order
YoYi-WEB
No. Resi
JD0578173593
Status paket
Diserahkan
Nama outlet
YZ_ MDP JAYANTI CIKANDE
Kode outlet
ID29000873
Ekspedisi
JT_EXPRESS
Metode perhitungan
Biaya oleh pengirim
Tipe Produk
DOC
Nilai barang（IDR）
0
Tipe asuransi（IDR）
DOC Default
Kupon
--
Nilai COD(IDR)
--
Status waybill
Sudah pickup
ID Customer VIP
--
Informasi pengirim
Pengirim
RIAN
No. Telepon Pengirim
08211759720
Kode Pos
15611
Wilayah
BANTEN BALARAJA
Detail Alamat
KP. JAYANTI RT.015 RW 003 DS CIKANDE KEC. JAYANTI TANGERANG BANTEN
Informasi penerima
Penerima
PT. SWI LOGISTICS
No. HP Penerima
082321326204
Kode Pos
13910
Wilayah
DKI JAKARTA JAKARTA CAKUNG
Detail Alamat
JLN. GREEN 8A NO. 28 RT 11 RW 6 CAKUNG TIMUR KEC. CAKUNG JAKARTA TIMUR
Informasi Barang
Jenis Barang
DOKUMEN
Nama barang
DOKUMEN
Berat（KG）
0.30
Total Volume（cm³）
--
koefisiensi lemparan ringan
6000
Berat Ditagih (KG)
0.30
Kategori Barang
--
Informasi Biaya
Ongkir Dasar（IDR）
6.300
Biaya Asuransi（IDR）
0
Biaya lain-lain（IDR）
1.000
Biaya diskon(IDR)
0
Harga promo（IDR）
0
Perhitungan Biaya pengiriman(IDR)
7.300
Riwayat operasi
Buat pesanan baru; RISKA AMUDIA; 2026-08-26 00:08:45
`;

console.log(JSON.stringify(parseYoYiText(text), null, 2));
