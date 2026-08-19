const fs = require("fs");
let code = fs.readFileSync("Code.gs", "utf8");

code = code.replace(
  `// 4. Panggil apiSaveTransaksi dengan data yang sudah dimapping`,
  `// 4. Buat PreInput Backup agar terbaca di Riwayat
    const txId = TransactionService.generateTransactionId();
    const backupObj = {
      transaksi_id: txId,
      timestamp: new Date().toISOString(),
      admin_id: input.admin_id,
      outlet_id_tugas: input.outlet_id,
      nama_pengirim: parsed.nama_pengirim || "YoYi Import",
      hp_pengirim: parsed.no_hp_pengirim || "",
      alamat_pengirim: parsed.alamat_pengirim || "",
      nama_penerima: parsed.nama_penerima || "Customer",
      hp_penerima: parsed.no_hp_penerima || "",
      alamat_penerima: parsed.alamat_penerima || "",
      nama_barang: parsed.nama_barang || "",
      berat_kg: parsed.berat_kg || 0,
      volume: "0",
      nilai_barang: 0,
      foto_paket_url: "",
      status: "SELESAI",
      catatan_admin: "Auto Import YoYi"
    };
    DatabaseService.insertRow("PreInput_Backup", backupObj);
    
    // Panggil apiSaveTransaksi dengan data yang sudah dimapping`
);

code = code.replace(
  `const transactionData = {`,
  `const transactionData = {
      transaksi_id: txId,`
);

fs.writeFileSync("Code.gs", code);
console.log("Code.gs patched to include PreInput_Backup");
