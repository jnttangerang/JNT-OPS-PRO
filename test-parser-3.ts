import { parseYoYiText } from "./src/utils/yoyiParser";
console.log(parseYoYiText(`
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
Riwayat operasi
Buat pesanan baru; RISKA AMUDIA; 2026-08-26 00:08:45
`));
