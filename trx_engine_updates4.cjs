const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

const regex = /saveTransaction: function\(jenisLayanan, data\) \{/;

const updates = `savePreInput: function(params) {
    var txId = this.generateTransactionId();
    var nowStr = new Date().toISOString();
    
    var sheetBackup = getSheetByName("PreInput_Backup");
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
    sheetBackup.insertRowAfter(1);
    var newRow = DB_SCHEMA.PreInput_Backup.map(function (col) { return backupObj[col] !== undefined ? backupObj[col] : ""; });
    sheetBackup.getRange(2, 1, 1, newRow.length).setValues([newRow]);
    
    var sheetCst = getSheetByName("Master_Customer");
    var rowsCst = sheetCst.getDataRange().getValues();
    var cstId = "CST-" + new Date().getTime().toString().slice(-5);
    var foundCstRow = -1;
    for (var i = 1; i < rowsCst.length; i++) {
      if (rowsCst[i][2].toString() === params.hp_pengirim) {
        foundCstRow = i + 1;
        cstId = rowsCst[i][0].toString();
        break;
      }
    }
    if (foundCstRow !== -1) {
      sheetCst.getRange(foundCstRow, 2).setValue(params.nama_pengirim);
      sheetCst.getRange(foundCstRow, 4).setValue(params.alamat_pengirim);
      sheetCst.getRange(foundCstRow, 5).setValue(params.outlet_id_tugas);
      sheetCst.getRange(foundCstRow, 6).setValue(nowStr);
    } else {
      sheetCst.appendRow([cstId, params.nama_pengirim, params.hp_pengirim, params.alamat_pengirim, params.outlet_id_tugas, nowStr]);
    }
    
    var sheetRec = getSheetByName("Riwayat_Penerima");
    var rowsRec = sheetRec.getDataRange().getValues();
    var recId = "REC-" + new Date().getTime().toString().slice(-5) + Math.floor(Math.random() * 10);
    var foundRecRow = -1;
    for (var j = 1; j < rowsRec.length; j++) {
      if (rowsRec[j][1].toString() === cstId && rowsRec[j][3].toString() === params.hp_penerima) {
        foundRecRow = j + 1;
        break;
      }
    }
    if (foundRecRow !== -1) {
      sheetRec.getRange(foundRecRow, 3).setValue(params.nama_penerima);
      sheetRec.getRange(foundRecRow, 5).setValue(params.alamat_penerima);
      sheetRec.getRange(foundRecRow, 6).setValue(nowStr);
    } else {
      sheetRec.appendRow([recId, cstId, params.nama_penerima, params.hp_penerima, params.alamat_penerima, nowStr]);
    }
    
    this.writeAuditLog(params.admin_id, "PREINPUT_SIMPAN", "Mencatat pre-input '" + params.nama_pengirim + "' ke '" + params.nama_penerima + "' (" + txId + ")", params.outlet_id_tugas);
    
    return { transaksi_id: txId };
  },

  saveTransaction: function(jenisLayanan, data) {`;

code = code.replace(regex, updates);

const apiPreInputRegex = /function apiSaveDataPreInput\(params\) \{[\s\S]*?return \{ status: "success", message: "Data pre-input berhasil disimpan!", data: \{ transaksi_id: txId \} \};\n\}/;
const newApiPreInput = `function apiSaveDataPreInput(params) {
  try {
    var result = TransactionService.savePreInput(params);
    return { status: "success", message: "Data pre-input berhasil disimpan!", data: result };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}`;

code = code.replace(apiPreInputRegex, newApiPreInput);
fs.writeFileSync('Code.gs', code);
