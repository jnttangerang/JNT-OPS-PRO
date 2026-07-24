const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf-8');

function replaceFunction(code, funcName, newImpl) {
  const regex = new RegExp(`function ${funcName}\\s*\\([^{]*\\)\\s*\\{`);
  const match = code.match(regex);
  if (!match) return code;
  
  let startIndex = match.index;
  let braceCount = 0;
  let endIndex = -1;
  let started = false;
  
  for (let i = startIndex; i < code.length; i++) {
    if (code[i] === '{') {
      braceCount++;
      started = true;
    } else if (code[i] === '}') {
      braceCount--;
    }
    
    if (started && braceCount === 0) {
      endIndex = i;
      break;
    }
  }
  
  if (endIndex !== -1) {
    return code.substring(0, startIndex) + newImpl + code.substring(endIndex + 1);
  }
  return code;
}

const apiSaveDataPreInputImpl = `function apiSaveDataPreInput(params) {
  var txId = "TRX-" + new Date().getTime();
  var now = new Date();
  var nowStr = now.toISOString();
  
  var sheetBackup = getSheetByName("PreInput_Backup");
  var inputObj = {
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
  
  var rowData = DB_SCHEMA.PreInput_Backup.map(function(col) { return inputObj[col] !== undefined ? inputObj[col] : ""; });
  sheetBackup.appendRow(rowData);
  
  // Cari / Update Master_Customer
  var sheetCst = getSheetByName("Master_Customer");
  var rowsCst = sheetCst.getDataRange().getValues();
  var headersCst = rowsCst[0];
  var foundCst = false;
  var customerId = "";
  
  for (var c = 1; c < rowsCst.length; c++) {
    var cObj = rowToObject_(headersCst, rowsCst[c]);
    if (cObj.no_hp.toString() === params.hp_pengirim) {
      customerId = cObj.customer_id.toString();
      foundCst = true;
      sheetCst.getRange(c + 1, getColIndex_(sheetCst, "nama_pengirim") + 1).setValue(params.nama_pengirim);
      sheetCst.getRange(c + 1, getColIndex_(sheetCst, "alamat_pengirim") + 1).setValue(params.alamat_pengirim);
      sheetCst.getRange(c + 1, getColIndex_(sheetCst, "last_updated") + 1).setValue(nowStr);
      break;
    }
  }
  
  if (!foundCst) {
    customerId = "CST-" + new Date().getTime();
    var cstObj = {
      customer_id: customerId,
      nama_pengirim: params.nama_pengirim,
      no_hp: params.hp_pengirim,
      alamat_pengirim: params.alamat_pengirim,
      outlet_id: params.outlet_id_tugas,
      last_updated: nowStr
    };
    var cstRow = DB_SCHEMA.Master_Customer.map(function(col) { return cstObj[col] !== undefined ? cstObj[col] : ""; });
    sheetCst.appendRow(cstRow);
  }
  
  // Simpan Riwayat Penerima
  var sheetRcv = getSheetByName("Riwayat_Penerima");
  var rcvObj = {
    id: "RCV-" + new Date().getTime(),
    customer_id: customerId,
    nama_penerima: params.nama_penerima,
    no_hp_penerima: params.hp_penerima,
    alamat_penerima: params.alamat_penerima,
    tanggal_terakhir_kirim: nowStr
  };
  var rcvRow = DB_SCHEMA.Riwayat_Penerima.map(function(col) { return rcvObj[col] !== undefined ? rcvObj[col] : ""; });
  sheetRcv.appendRow(rcvRow);
  
  writeAuditLog(params.admin_id, "PREINPUT_SIMPAN", "Menyimpan data awal pre-input untuk pengirim '" + params.nama_pengirim + "' ke penerima '" + params.nama_penerima + "' (" + txId + ")", params.outlet_id_tugas);
  
  return {
    status: "success",
    message: "Data pre-input berhasil disimpan.",
    data: {
      transaksi_id: txId,
      customer_id: customerId
    }
  };
}`;

const apiSaveTransaksiImpl = `function apiSaveTransaksi(params) {
  var jenis = params.jenis_layanan; // Express atau Cargo
  var data = params.data;
  var nowStr = new Date().toISOString();
  
  var resiId = (data.resi_id || "").toString().toUpperCase().trim();
  
  // Validasi anti-fraud duplikat sekali lagi di server
  var checkDup = apiCheckDuplicateResi({ resi_id: resiId });
  if (checkDup.isDuplicate) {
    return { status: "error", message: "RESI SUDAH TERDAFTAR — Kemungkinan duplikat/fraud!" };
  }
  
  if (jenis === "Express") {
    var sheetExp = getSheetByName("EXP_Resi");
    var expObj = {
      resi_id: resiId,
      transaksi_id: data.transaksi_id,
      timestamp: nowStr,
      admin_id_pencatat: data.admin_id_pencatat,
      outlet_id_input: data.outlet_id_input,
      tipe_produk: data.tipe_produk,
      biaya_lain: data.biaya_lain,
      biaya_asuransi: data.biaya_asuransi,
      ongkir_dasar: data.ongkir_dasar,
      biaya_yoyi: data.biaya_yoyi,
      total_dibayar_customer: data.total_dibayar_customer,
      pembulatan: data.pembulatan,
      metode_bayar: data.metode_bayar,
      bukti_bayar_url: data.bukti_bayar_url || "",
      biaya_amplop: data.biaya_amplop,
      biaya_packing: data.biaya_packing,
      metode_bayar_tambahan: data.metode_bayar_tambahan || "",
      bukti_tambahan_url: data.bukti_tambahan_url || "",
      grand_total: data.grand_total,
      setoran_ke_owner: data.setoran_ke_owner,
      kas_operasional: data.kas_operasional,
      status_resi: "AKTIF"
    };
    var expRow = DB_SCHEMA.EXP_Resi.map(function(col) { return expObj[col] !== undefined ? expObj[col] : ""; });
    sheetExp.appendRow(expRow);
  } else if (jenis === "Cargo") {
    var sheetCrg = getSheetByName("CRG_Resi");
    var crgObj = {
      resi_id: resiId,
      transaksi_id: data.transaksi_id,
      timestamp: nowStr,
      admin_id_pencatat: data.admin_id_pencatat,
      outlet_id_input: data.outlet_id_input,
      tipe_produk: data.tipe_produk,
      merk_motor: data.merk_motor || "",
      cc_motor: data.cc_motor || 0,
      tahun_motor: data.tahun_motor || 0,
      kelengkapan_motor: data.kelengkapan_motor || "",
      biaya_asuransi: data.biaya_asuransi,
      ongkir_dasar: data.ongkir_dasar,
      biaya_jtc: data.biaya_jtc,
      total_dibayar_customer: data.total_dibayar_customer,
      pembulatan: data.pembulatan,
      metode_bayar: data.metode_bayar,
      bukti_bayar_url: data.bukti_bayar_url || "",
      biaya_amplop: data.biaya_amplop,
      biaya_packing: data.biaya_packing,
      metode_bayar_tambahan: data.metode_bayar_tambahan || "",
      bukti_tambahan_url: data.bukti_tambahan_url || "",
      grand_total: data.grand_total,
      setoran_ke_owner: data.setoran_ke_owner,
      kas_operasional: data.kas_operasional,
      status_resi: "AKTIF"
    };
    var crgRow = DB_SCHEMA.CRG_Resi.map(function(col) { return crgObj[col] !== undefined ? crgObj[col] : ""; });
    sheetCrg.appendRow(crgRow);
  } else {
    return { status: "error", message: "Jenis layanan tidak valid (harus Express atau Cargo)" };
  }
  
  // Update status PreInput jika dari PreInput
  if (data.transaksi_id) {
    var sheetBackup = getSheetByName("PreInput_Backup");
    var rowsB = sheetBackup.getDataRange().getValues();
    var headersB = rowsB[0];
    for (var b = 1; b < rowsB.length; b++) {
      var objB = rowToObject_(headersB, rowsB[b]);
      if (objB.transaksi_id.toString() === data.transaksi_id) {
        sheetBackup.getRange(b + 1, getColIndex_(sheetBackup, "status") + 1).setValue("SELESAI");
        break;
      }
    }
  }
  
  writeAuditLog(data.admin_id_pencatat, "TRANSAKSI_SIMPAN", "Menyimpan resi " + jenis + " '" + resiId + "' (" + data.tipe_produk + ") untuk " + data.transaksi_id + ". Grand Total: Rp " + data.grand_total, data.outlet_id_input);
  
  return {
    status: "success",
    message: "Transaksi " + jenis + " berhasil disimpan!"
  };
}`;

code = replaceFunction(code, 'apiSaveDataPreInput', apiSaveDataPreInputImpl);
code = replaceFunction(code, 'apiSaveTransaksi', apiSaveTransaksiImpl);

fs.writeFileSync('Code.gs', code);
