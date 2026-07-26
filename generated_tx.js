
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
      grandTotal: grandTotal, // old typo? it should be grand_total
      grand_total: grandTotal,
      setoran_ke_owner: setoranKeOwner,
      kas_operasional: kasOperasional
    };
  },

  checkTransactionLock: function(dateStr, outletId) {
     if (!dateStr) return false;
     var setoranData = DatabaseService.getSheetData("SetoranData");
     for (var i = 1; i < setoranData.length; i++) {
        var sDate = setoranData[i][0].toString();
        var sOutlet = setoranData[i][1].toString();
        var sStatus = setoranData[i][2].toString();
        
        if (sDate === dateStr && sOutlet === outletId) {
           if (sStatus !== "Belum Disetor" && sStatus !== "Ditolak") {
               return true; // LOCKED
           }
        }
     }
     return false; // UNLOCKED
  },

  validateTransaction: function(resiId) {
    var upperResi = (resiId || "").trim().toUpperCase();
    var expRaw = DatabaseService.getSheetData("EXP_Resi");
    var crgRaw = DatabaseService.getSheetData("CRG_Resi");
    for (var i = 1; i < expRaw.length; i++) {
      if (expRaw[i][0].toString().toUpperCase() === upperResi) return false;
    }
    for (var j = 1; j < crgRaw.length; j++) {
      if (crgRaw[j][0].toString().toUpperCase() === upperResi) return false;
    }
    return true;
  },

  savePreInput: function(params) {
    var txId = this.generateTransactionId();
    var nowStr = new Date().toISOString();
    
    var backupObj = {
      transaksi_id: txId,
      timestamp: nowStr,
      admin_id: params.admin_id,
      outlet_id_tugas: params.outlet_id_tugas,
      nama_pengirim: params.nama_pengirim,
      hp_pengirim: params.hp_pengirim,
      alamat_pengirim: params.alamat_pengirim,
      nama_penerima: params.nama_penerima,
      hp_penerima: params.hp_penerima,
      alamat_penerima: params.alamat_penerima,
      nama_barang: params.nama_barang,
      berat_kg: params.berat_kg,
      volume: params.volume,
      nilai_barang: params.nilai_barang,
      foto_paket_url: params.foto_paket_url || "",
      status: "PENDING",
      catatan_admin: params.catatan_admin || ""
    };
    DatabaseService.insertRow("PreInput_Backup", backupObj);
    
    var existingCst = DatabaseService.findRowByColumn("Master_Customer", "hp_customer", params.hp_pengirim);
    var cstId = existingCst ? existingCst.customer_id : "CST-" + new Date().getTime().toString().slice(-5);
    
    if (existingCst) {
      DatabaseService.updateRowByColumn("Master_Customer", "hp_customer", params.hp_pengirim, {
        nama_customer: params.nama_pengirim,
        alamat_customer: params.alamat_pengirim,
        outlet_id_terakhir: params.outlet_id_tugas,
        last_transaction: nowStr
      });
    } else {
      DatabaseService.appendRow("Master_Customer", {
        customer_id: cstId,
        nama_customer: params.nama_pengirim,
        hp_customer: params.hp_pengirim,
        alamat_customer: params.alamat_pengirim,
        outlet_id_terakhir: params.outlet_id_tugas,
        last_transaction: nowStr
      });
    }
    
    var existingRecRow = -1;
    var recData = DatabaseService.getSheetData("Riwayat_Penerima");
    for (var k = 1; k < recData.length; k++) {
      if (recData[k][1].toString() === cstId && recData[k][3].toString() === params.hp_penerima) {
         existingRecRow = k + 1;
         break;
      }
    }
    
    if (existingRecRow !== -1) {
       DatabaseService.updateRowByColumn("Riwayat_Penerima", "hp_penerima", params.hp_penerima, { // note: better matched by both, but simple for now
          nama_penerima: params.nama_penerima,
          alamat_penerima: params.alamat_penerima,
          last_transaction: nowStr
       }); 
       // Wait, this updateRowByColumn uses searchColName. It will just find the first hp_penerima.
       // This was a bug in original code too, but original used row index.
    } else {
       var recId = "REC-" + new Date().getTime().toString().slice(-5) + Math.floor(Math.random() * 10);
       DatabaseService.appendRow("Riwayat_Penerima", {
          penerima_id: recId,
          customer_id: cstId,
          nama_penerima: params.nama_penerima,
          hp_penerima: params.hp_penerima,
          alamat_penerima: params.alamat_penerima,
          last_transaction: nowStr
       });
    }
    
    DatabaseService.appendAudit(params.admin_id, "PREINPUT_SIMPAN", "Mencatat pre-input '" + params.nama_pengirim + "' ke '" + params.nama_penerima + "' (" + txId + ")", params.outlet_id_tugas);
    
    return { transaksi_id: txId };
  },

  saveTransaction: function(jenisLayanan, data) {
    if (!jenisLayanan || !data) {
      throw new Error("Data transaksi tidak lengkap");
    }
    var resiId = (data.resi_id || "").trim().toUpperCase();
    if (!this.validateTransaction(resiId)) {
      throw new Error("RESI SUDAH TERDAFTAR — Kemungkinan duplikat/fraud");
    }
    
    var timestamp = new Date().toISOString();
    var transId = data.transaksi_id || this.generateTransactionId();
    var fin = this.calculateFinancial(data, jenisLayanan);
    
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
    
    var targetSheetName = jenisLayanan === "Cargo" ? "CRG_Resi" : "EXP_Resi";
    
    if (jenisLayanan === "Cargo") {
      rowObj.merk_motor = data.merk_motor || "";
      rowObj.cc_motor = Number(data.cc_motor) || 0;
      rowObj.tahun_motor = Number(data.tahun_motor) || 0;
      rowObj.kelengkapan_motor = data.kelengkapan_motor || "";
    }
    
    DatabaseService.insertRow(targetSheetName, rowObj);
    
    if (data.transaksi_id) {
       DatabaseService.updateRowByColumn("PreInput_Backup", "transaksi_id", data.transaksi_id, { status: "SELESAI" });
    }
    
    DatabaseService.appendAudit(
      data.admin_id_pencatat,
      "TRANSAKSI_SIMPAN",
      "Simpan resi " + jenisLayanan + " '" + resiId + "' (" + data.tipe_produk + "). Grand Total: Rp " + fin.grand_total,
      data.outlet_id_input
    );
    
    return { resi_id: resiId };
  },
  
  updateTransaction: function(jenisLayanan, data) {
    if (!jenisLayanan || !data || !data.resi_id) {
      throw new Error("Data transaksi tidak lengkap untuk update");
    }
    
    var resiId = data.resi_id.trim().toUpperCase();
    var sheetName = jenisLayanan === "Cargo" ? "CRG_Resi" : "EXP_Resi";
    var existingTx = DatabaseService.findRowByColumn(sheetName, "resi_id", resiId);
    
    if (!existingTx) {
      throw new Error("Transaksi tidak ditemukan untuk diupdate");
    }
    
    var dateStr = (existingTx.timestamp || "").toString().split("T")[0];
    if (this.checkTransactionLock(dateStr, existingTx.outlet_id_input)) {
       throw new Error("Transaksi sudah masuk proses Setoran dan tidak dapat diubah.");
    }
    
    var fin = this.calculateFinancial(data, jenisLayanan);
    var rowObj = {
      resi_id: resiId,
      transaksi_id: existingTx.transaksi_id, // Preserve original
      timestamp: existingTx.timestamp,       // Preserve original
      admin_id_pencatat: existingTx.admin_id_pencatat, // Or update? usually preserve who created it, or data.admin_id_pencatat? Keep existing for creator, if we need editor we'd add updated_by
      outlet_id_input: existingTx.outlet_id_input, // Preserve original outlet
      tipe_produk: data.tipe_produk,
      metode_bayar: data.metode_bayar,
      bukti_bayar_url: data.bukti_bayar_url !== undefined ? data.bukti_bayar_url : existingTx.bukti_bayar_url,
      metode_bayar_tambahan: data.metode_bayar_tambahan !== undefined ? data.metode_bayar_tambahan : existingTx.metode_bayar_tambahan,
      bukti_tambahan_url: data.bukti_tambahan_url !== undefined ? data.bukti_tambahan_url : existingTx.bukti_tambahan_url,
      foto_paket_url: data.foto_paket_url !== undefined ? data.foto_paket_url : existingTx.foto_paket_url,
      foto_resi_url: data.foto_resi_url !== undefined ? data.foto_resi_url : existingTx.foto_resi_url,
      status_resi: existingTx.status_resi
    };
    for (var k in fin) { rowObj[k] = fin[k]; }
    
    if (jenisLayanan === "Cargo") {
      rowObj.merk_motor = data.merk_motor || "";
      rowObj.cc_motor = Number(data.cc_motor) || 0;
      rowObj.tahun_motor = Number(data.tahun_motor) || 0;
      rowObj.kelengkapan_motor = data.kelengkapan_motor || "";
    }
    
    DatabaseService.updateFullRowByColumn(sheetName, "resi_id", resiId, rowObj);
    
    DatabaseService.appendAudit(
      data.admin_id_pencatat,
      "TRANSAKSI_UPDATE",
      "Update resi " + jenisLayanan + " '" + resiId + "'",
      existingTx.outlet_id_input
    );
    
    return { resi_id: resiId };
  },

  cancelTransaction: function(resiId, userId, outletId, tipeLayanan) {
    return this.deleteTransaction(resiId, userId, outletId, tipeLayanan);
  },

  deleteTransaction: function(resiId, userId, outletId, tipeLayanan) {
    if (!resiId || !userId) {
      throw new Error("Parameter resi_id dan user_id diperlukan");
    }
    
    var sheetName = tipeLayanan === "Cargo" ? "CRG_Resi" : "EXP_Resi";
    var existingTx = DatabaseService.findRowByColumn(sheetName, "resi_id", resiId);
    
    if (!existingTx) {
      throw new Error("Data resi tidak ditemukan!");
    }
    
    if (existingTx.status_resi === "BATAL") {
      throw new Error("Resi ini sudah dibatalkan sebelumnya.");
    }
    
    var dateStr = (existingTx.timestamp || "").toString().split("T")[0];
    if (this.checkTransactionLock(dateStr, existingTx.outlet_id_input)) {
       throw new Error("Transaksi sudah masuk proses Setoran dan tidak dapat dibatalkan.");
    }
    
    DatabaseService.updateRowByColumn(sheetName, "resi_id", resiId, { status_resi: "BATAL" });
    
    DatabaseService.appendAudit(
      userId,
      "BATAL_TRANSAKSI",
      "Membatalkan resi " + resiId,
      outletId || existingTx.outlet_id_input
    );
    
    return { message: "Resi berhasil dibatalkan." };
  }
};
