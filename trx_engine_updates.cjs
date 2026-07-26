const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

const regex = /deleteTransaction: function\(resiId, userId, outletId, tipeLayanan\) \{/;

const updates = `
  updateTransaction: function(jenisLayanan, data) {
    if (!jenisLayanan || !data || !data.resi_id) {
      throw new Error("Data transaksi tidak lengkap untuk update");
    }
    
    var resiId = data.resi_id.trim().toUpperCase();
    var sheet = getSheetByName(jenisLayanan === "Cargo" ? "CRG_Resi" : "EXP_Resi");
    var dataRows = sheet.getDataRange().getValues();
    var colResi = getColIndex_(sheet, "resi_id");
    
    if (colResi === -1) throw new Error("Schema error: kolom resi_id tidak ada");
    
    var foundIdx = -1;
    for (var i = 1; i < dataRows.length; i++) {
      if (dataRows[i][colResi].toString().toUpperCase() === resiId) {
        foundIdx = i + 1;
        break;
      }
    }
    
    if (foundIdx === -1) {
      throw new Error("Transaksi tidak ditemukan untuk diupdate");
    }
    
    var fin = this.calculateFinancial(data, jenisLayanan);
    var rowObj = {
      resi_id: resiId,
      transaksi_id: data.transaksi_id || "",
      timestamp: new Date().toISOString(), // update timestamp? Atau biarkan?
      admin_id_pencatat: data.admin_id_pencatat,
      outlet_id_input: data.outlet_id_input,
      tipe_produk: data.tipe_produk,
      metode_bayar: data.metode_bayar,
      bukti_bayar_url: data.bukti_bayar_url || "",
      metode_bayar_tambahan: data.metode_bayar_tambahan || "",
      bukti_tambahan_url: data.bukti_tambahan_url || "",
      foto_paket_url: data.foto_paket_url || "",
      foto_resi_url: data.foto_resi_url || "",
      status_resi: "AKTIF"
    };

    for (var k in fin) { rowObj[k] = fin[k]; }
    
    if (jenisLayanan === "Cargo") {
      rowObj.merk_motor = data.merk_motor || "";
      rowObj.cc_motor = Number(data.cc_motor) || 0;
      rowObj.tahun_motor = Number(data.tahun_motor) || 0;
      rowObj.kelengkapan_motor = data.kelengkapan_motor || "";
      var newRowCrg = DB_SCHEMA.CRG_Resi.map(function(col) { return rowObj[col] !== undefined ? rowObj[col] : ""; });
      sheet.getRange(foundIdx, 1, 1, newRowCrg.length).setValues([newRowCrg]);
    } else {
      var newRowExp = DB_SCHEMA.EXP_Resi.map(function(col) { return rowObj[col] !== undefined ? rowObj[col] : ""; });
      sheet.getRange(foundIdx, 1, 1, newRowExp.length).setValues([newRowExp]);
    }
    
    this.writeAuditLog(
      data.admin_id_pencatat,
      "TRANSAKSI_UPDATE",
      "Update resi " + jenisLayanan + " '" + resiId + "'",
      data.outlet_id_input
    );
    
    return { resi_id: resiId };
  },

  cancelTransaction: function(resiId, userId, outletId, tipeLayanan) {
    return this.deleteTransaction(resiId, userId, outletId, tipeLayanan);
  },

  deleteTransaction: function(resiId, userId, outletId, tipeLayanan) {`;

code = code.replace(regex, updates);
fs.writeFileSync('Code.gs', code);
