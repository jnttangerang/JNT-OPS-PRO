const fs = require("fs");
let code = fs.readFileSync("Code.gs", "utf8");

if (!code.includes("apiImportYoYi")) {
  code = code.replace(`    case "saveTransaksi":`, `    case "importYoYi":\n      return apiImportYoYi(params);\n    case "saveTransaksi":`);

  const importYoYiStr = `
function apiImportYoYi(params) {
  try {
    const parsed = params.parsed;
    const input = params.input;
    
    // 1. Validasi input
    if (!input.jumlah_dibayar || input.jumlah_dibayar <= 0) {
      return { status: "error", message: "Jumlah dibayar customer wajib diisi dan > 0" };
    }
    
    // 2. Validasi outlet
    if (!input.outlet_id) {
      return { status: "error", message: "Outlet tidak valid" };
    }
    
    // 3. Cek duplicate resi (gunakan existing checker)
    if (!TransactionService.validateTransaction(parsed.nomor_resi)) {
        return { status: "error", message: "RESI SUDAH TERDAFTAR — " + parsed.nomor_resi };
    }
    
    // 4. Panggil apiSaveTransaksi dengan data yang sudah dimapping
    const transactionData = {
      nomor_resi: parsed.nomor_resi,
      nama_pengirim: parsed.nama_pengirim,
      hp_pengirim: parsed.no_hp_pengirim,
      alamat_pengirim: parsed.alamat_pengirim,
      nama_penerima: parsed.nama_penerima,
      hp_penerima: parsed.no_hp_penerima,
      alamat_penerima: parsed.alamat_penerima,
      nama_barang: parsed.nama_barang,
      berat_kg: parsed.berat_kg,
      ongkir_dasar: parsed.ongkir_dasar,
      asuransi: parsed.asuransi,
      biaya_lain: parsed.biaya_lain,
      metode_pembayaran_ongkir: input.metode_bayar_ongkir,
      biaya_amplop: input.biaya_amplop || 0,
      biaya_packing: input.biaya_packing || 0,
      metode_pembayaran_tambahan: input.metode_bayar_tambahan || "Tunai",
      jumlah_dibayar_customer: input.jumlah_dibayar,
      admin_id: input.admin_id,
      outlet_id_input: input.outlet_id,
      status: "SELESAI", // Karena resi sudah ada dari YoYi
      // Map other optional fields
      source_order: "YoYi",
      tipe_produk: parsed.tipe_produk,
      // Map to correct model based on TransactionService
      resi_id: parsed.nomor_resi,
      outlet_id: input.outlet_id
    };
    
    return apiSaveTransaksi({ jenis_layanan: "REGULAR", data: transactionData });
  } catch(e) {
    return { status: "error", message: e.message };
  }
}

function apiSaveTransaksi(params) {`;

  code = code.replace(`function apiSaveTransaksi(params) {`, importYoYiStr);
  fs.writeFileSync("Code.gs", code);
  console.log("Code.gs patched");
}
