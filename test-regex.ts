const line = "Detail Alamat Pengirim:";
const m = line.match(/Alamat\s*Pengirim[:\s]*([^\n\r]+)/i);
console.log(m);

const line2 = "Nama Barang:";
const m2 = line2.match(/Nama\s*Barang[:\s]*([^\n\r]+)/i);
console.log(m2);

const resiText = "No. Pesanan:\nID2608\nNo. Resi:\nJD0578077660";
const resiExplicit = resiText.match(/(?:No\.?\s*(?:Resi|Waybill|Tracking|Connote|Awb)|Resi|Waybill|Nomor\s*Resi)[:\s]*([A-Z0-9]{8,24})/i);
console.log(resiExplicit);
