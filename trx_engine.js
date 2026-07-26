// ============================================================================
// PHASE 1: TRANSACTION ENGINE
// ============================================================================

var TransactionService = {
  generateTransactionId: function() {
    return "TRX-" + new Date().getTime() + "-" + Math.floor(Math.random() * 1000);
  },

  calculateFinancial: function(data, jenisLayanan) {
    var biayaLain = jenisLayanan === "Express" ? (Number(data.biaya_lain) || 0) : 0;
    var biayaAsuransi = Number(data.biaya_asuransi) || 0;
    var ongkirDasar = Number(data.ongkir_dasar) || 0;
    
    var biayaDasarLayanan = biayaLain + biayaAsuransi + ongkirDasar;
    var totalUangDibayarCustomer = Number(data.total_dibayar_customer) || 0;
    var pembulatan = totalUangDibayarCustomer > 0 ? (totalUangDibayarCustomer - biayaDasarLayanan) : 0;
    
    var biayaAmplop = Number(data.biaya_amplop) || 0;
    var biayaPacking = Number(data.biaya_packing) || 0;
    var biayaTambahan = biayaAmplop + biayaPacking;
    
    var grandTotal = biayaDasarLayanan + pembulatan + biayaTambahan;
    var setoranKeOwner = biayaDasarLayanan + pembulatan;
    var kasOperasional = biayaTambahan;

    return {
      biaya_lain: biayaLain,
      biaya_asuransi: biayaAsuransi,
      ongkir_dasar: ongkirDasar,
      biaya_yoyi: jenisLayanan === "Express" ? biayaDasarLayanan : 0,
      biaya_jtc: jenisLayanan === "Cargo" ? biayaDasarLayanan : 0,
      total_dibayar_customer: totalUangDibayarCustomer,
      pembulatan: pembulatan,
      biaya_amplop: biayaAmplop,
      biaya_packing: biayaPacking,
      grand_total: grandTotal,
      setoran_ke_owner: setoranKeOwner,
      kas_operasional: kasOperasional
    };
  },

  writeAuditLog: function(userId, action, details, outletId) {
    var sheet = getSheetByName("AuditLogs");
    var logObj = {
      id: "LOG-" + new Date().getTime(),
      timestamp: new Date().toISOString(),
      user_id: userId,
      aksi: action,
      detail: details,
      outlet_id: outletId || ""
    };
    sheet.appendRow(DB_SCHEMA.AuditLogs.map(function(col) {
      return logObj[col] !== undefined ? logObj[col] : "";
    }));
  },

  saveTransaction: function(jenisLayanan, data) {
    if (!jenisLayanan || !data) {
      throw new Error("Data transaksi tidak lengkap");
    }

    var resiId = (data.resi_id || "").trim().toUpperCase();
    var sheetExp = getSheetByName("EXP_Resi");
    var sheetCrg = getSheetByName("CRG_Resi");
    var dbExpRaw = sheetExp.getDataRange().getValues();
    var dbCrgRaw = sheetCrg.getDataRange().getValues();

    if (!validateTransaction(resiId, dbExpRaw, dbCrgRaw)) {
      throw new Error("RESI SUDAH TERDAFTAR — Kemungkinan duplikat/fraud");
    }

    var timestamp = new Date().toISOString();
    var transId = data.transaksi_id || this.generateTransactionId();
    var fin = this.calculateFinancial(data, jenisLayanan);

    var targetSheet;
    var rowObj = {
      resi_id: resiId,
      transaksi_id: transId,
      timestamp: timestamp,
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

    if (jenisLayanan === "Express") {
      targetSheet = sheetExp;
      var newRow = DB_SCHEMA.EXP_Resi.map(function(col) { return rowObj[col] !== undefined ? rowObj[col] : ""; });
      targetSheet.insertRowAfter(1);
      targetSheet.getRange(2, 1, 1, newRow.length).setValues([newRow]);
    } else if (jenisLayanan === "Cargo") {
      targetSheet = sheetCrg;
      rowObj.merk_motor = data.merk_motor || "";
      rowObj.cc_motor = Number(data.cc_motor) || 0;
      rowObj.tahun_motor = Number(data.tahun_motor) || 0;
      rowObj.kelengkapan_motor = data.kelengkapan_motor || "";
      var newRowCrg = DB_SCHEMA.CRG_Resi.map(function(col) { return rowObj[col] !== undefined ? rowObj[col] : ""; });
      targetSheet.insertRowAfter(1);
      targetSheet.getRange(2, 1, 1, newRowCrg.length).setValues([newRowCrg]);
    } else {
      throw new Error("Jenis layanan tidak valid");
    }

    if (data.transaksi_id) {
      var preSheet = getSheetByName("PreInput_Backup");
      var preRows = preSheet.getDataRange().getValues();
      var preColStatus = getColIndex_(preSheet, "status");
      if (preColStatus !== -1) {
        for (var i = 1; i < preRows.length; i++) {
          if (preRows[i][0].toString() === data.transaksi_id) {
            preSheet.getRange(i + 1, preColStatus + 1).setValue("SELESAI");
            break;
          }
        }
      }
    }

    this.writeAuditLog(
      data.admin_id_pencatat,
      "TRANSAKSI_SIMPAN",
      "Simpan resi " + jenisLayanan + " '" + resiId + "' (" + data.tipe_produk + "). Grand Total: Rp " + fin.grand_total,
      data.outlet_id_input
    );

    return { resi_id: resiId };
  },

  deleteTransaction: function(resiId, userId, outletId, tipeLayanan) {
    if (!resiId || !userId) {
      throw new Error("Parameter resi_id dan user_id diperlukan");
    }
    
    var sheet = getSheetByName(tipeLayanan === "Cargo" ? "CRG_Resi" : "EXP_Resi");
    var dataRows = sheet.getDataRange().getValues();
    var colStatus = getColIndex_(sheet, "status_resi");
    if (colStatus === -1) throw new Error("Kolom status_resi tidak ditemukan pada tabel.");

    var found = false;
    for (var i = 1; i < dataRows.length; i++) {
      if (dataRows[i][0].toString() === resiId) {
        if (dataRows[i][colStatus].toString() === "BATAL") {
          throw new Error("Resi ini sudah dibatalkan sebelumnya.");
        }
        sheet.getRange(i + 1, colStatus + 1).setValue("BATAL");
        found = true;
        break;
      }
    }

    if (!found) {
      throw new Error("Data resi tidak ditemukan!");
    }

    this.writeAuditLog(
      userId,
      "BATAL_TRANSAKSI",
      "Membatalkan resi " + resiId,
      outletId
    );

    return { message: "Resi berhasil dibatalkan." };
  }
};
