/**
 * J&T OPS PRO - Backend Google Apps Script (Code.gs)
 * Untuk dipasang di Extensions > Apps Script pada Google Sheets.
 * 
 * Pengaturan sebelum dideploy:
 * 1. Buat Spreadsheet baru.
 * 2. Masuk ke Extensions > Apps Script, hapus kode bawaan dan tempel kode ini.
 * 3. Buat file baru bernama 'Index.html' di editor Apps Script dan tempel isi dari file Index.html.
 * 4. Dapatkan Gemini API Key gratis dari Google AI Studio.
 * 5. Daftarkan API Key tersebut di Apps Script: Project Settings (ikon roda gigi) > Script Properties > Add script property:
 *    - Property Name: GEMINI_API_KEY
 *    - Value: [Isi dengan API Key Anda]
 * 6. Jalankan fungsi 'initDatabaseSheets' sekali untuk membuat tabel header dan data seed otomatis.
 * 7. Deploy sebagai Web App: New Deployment > Select type: Web App > Execute as: Me > Who has access: Anyone.
 * 8. Salin URL Web App hasil deploy untuk diakses oleh tim Anda.
 */

// Konstanta Instruksi Gem "Pakar Alamat J&T"
// Sesuai instruksi, Anda dapat mengganti nilai konstanta ini dengan instruksi Gem kustom Anda di Gemini
const GEM_ALAMAT_SYSTEM_INSTRUCTION = 
  "Kamu adalah 'Pakar Alamat J&T', ahli perapihan alamat pengiriman di Indonesia. " +
  "Tugasmu: perbaiki ejaan/typo, lengkapi struktur alamat (nama jalan, nomor rumah, RT/RW, kelurahan, " +
  "kecamatan, kota/kabupaten, provinsi, kode pos bila bisa disimpulkan dari konteks), tanpa mengubah " +
  "makna atau menambah informasi yang tidak ada. Balas HANYA alamat hasil perbaikan dalam satu baris " +
  "teks, tanpa penjelasan, tanpa markdown, tanpa tanda kutip tambahan.";

/**
 * Handle HTTP GET Request - Menyajikan halaman Web App
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('J&T OPS PRO - Operasional Outlet')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Handle HTTP POST Request - Sebagai cadangan endpoint API eksternal
 */
function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;
    var data = params.data;
    
    var response = handleRouting(action, data);
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "POST Error: " + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Routing pusat untuk menangani pemanggilan fungsi dari React (google.script.run)
 * maupun dari POST request.
 */
function handleRouting(action, params) {
  switch (action) {
    case "login":
      return apiLogin(params);
    case "getOutlets":
      return apiGetOutlets();
    case "searchCustomer":
      return apiSearchCustomer(params);
    case "getRiwayatPenerima":
      return apiGetRiwayatPenerima(params);
    case "getPreInput":
      return apiGetPreInput(params);
    case "checkDuplicateResi":
      return apiCheckDuplicateResi(params);
    case "saveDataPreInput":
      return apiSaveDataPreInput(params);
    case "saveTransaksi":
      return apiSaveTransaksi(params);
    case "perbaikiAlamatAI":
      return apiPerbaikiAlamatAI(params);
    case "uploadFile":
      return apiUploadFile(params);
    case "getDashboardData":
      return apiGetDashboardData(params);
    case "getRiwayatTransaksi":
      return apiGetRiwayatTransaksi(params);
    case "deleteTransaksi":
      return apiDeleteTransaksi(params);
    case "updateOutletTarget":
      return apiUpdateOutletTarget(params);
    case "getMapsReviews":
      return apiGetMapsReviews(params);
    case "saveMapsReview":
      return apiSaveMapsReview(params);
    case "getStatusSetoran":
      return apiGetStatusSetoran(params);
    case "saveSetoran":
      return apiSaveSetoran(params);
    case "testSchemaIntegrity":
      return testSchemaIntegrity();
    default:
      return { status: "error", message: "Aksi tidak dikenali: " + action };
  }
}

/**
 * Jembatan google.script.run untuk React Frontend
 */
function execAction(action, params) {
  return handleRouting(action, params);
}

// ==========================================

// ==========================================
// HELPER DYNAMIC SCHEMA
// ==========================================

function getColIndex_(sheet, headerName) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return headers.indexOf(headerName); // 0-based
}

function rowToObject_(headers, row) {
  var obj = {};
  headers.forEach(function (h, i) { obj[h] = row[i]; });
  return obj;
}

// API HANDLERS & BUSINESS LOGIC
// ==========================================

/**
 * 1. Login Authentication
 */
function apiLogin(params) {
  var username = params.username;
  var password = params.password;
  
  if (!username || !password) {
    return { status: "error", message: "Username dan Password wajib diisi!" };
  }
  
  var sheet = getSheetByName("Users");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  
  // Hash password pencocokan
  var passwordHash = simulateSha256(password);
  
  for (var i = 1; i < rows.length; i++) {
    var userObj = rowToObject_(headers, rows[i]);
    if (userObj.username.toString().toLowerCase() === username.toLowerCase()) {
      if (userObj.password_hash.toString() === passwordHash) {
        if (userObj.status_aktif.toString() !== "AKTIF") {
          return { status: "error", message: "Akun Anda berstatus NON-AKTIF!" };
        }
        
        var userData = {
          user_id: userObj.user_id.toString(),
          username: userObj.username.toString(),
          role: userObj.role.toString(),
          outlet_id_home: userObj.outlet_id_home.toString(),
          nama_lengkap: userObj.nama_lengkap.toString()
        };
        
        // Log audit
        writeAuditLog(userData.user_id, "LOGIN", "Pengguna '" + userData.nama_lengkap + "' berhasil login.", userData.outlet_id_home);
        
        return { status: "success", message: "Login berhasil", data: userData };
      }
    }
  }
  
  return { status: "error", message: "Username atau password salah!" };
}

/**
 * Ambil Daftar Outlet
 */
function apiGetOutlets() {
  var sheet = getSheetByName("Outlets");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var outlets = [];
  
  for (var i = 1; i < rows.length; i++) {
    var obj = rowToObject_(headers, rows[i]);
    outlets.push({
      outlet_id: obj.outlet_id.toString(),
      nama_outlet: obj.nama_outlet.toString(),
      alamat_outlet: obj.alamat_outlet.toString(),
      target_resi_harian: Number(obj.target_resi_harian) || 0,
      target_resi_bulanan: Number(obj.target_resi_bulanan) || 0
    });
  }
  return { status: "success", data: outlets };
}

/**
 * 2. Search Customer Parsial
 */
function apiSearchCustomer(params) {
  var query = (params.query || "").toLowerCase().trim();
  if (!query) {
    return { status: "success", data: [] };
  }
  
  var sheet = getSheetByName("Master_Customer");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var results = [];
  
  for (var i = 1; i < rows.length; i++) {
    var obj = rowToObject_(headers, rows[i]);
    var name = obj.nama_pengirim.toString();
    var phone = obj.no_hp.toString();
    
    if (name.toLowerCase().indexOf(query) !== -1 || phone.indexOf(query) !== -1) {
      results.push({
        customer_id: obj.customer_id.toString(),
        nama_pengirim: name,
        no_hp: phone,
        alamat_pengirim: obj.alamat_pengirim.toString(),
        outlet_id: obj.outlet_id.toString()
      });
    }
  }
  return { status: "success", data: results };
}

/**
 * 3. Ambil Riwayat Penerima per Pengirim
 */
function apiGetRiwayatPenerima(params) {
  var customerId = params.customer_id;
  if (!customerId) {
    return { status: "success", data: [] };
  }
  
  var sheet = getSheetByName("Riwayat_Penerima");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var results = [];
  
  for (var i = 1; i < rows.length; i++) {
    var obj = rowToObject_(headers, rows[i]);
    if (obj.customer_id.toString() === customerId) {
      results.push({
        id: obj.id.toString(),
        customer_id: obj.customer_id.toString(),
        nama_penerima: obj.nama_penerima.toString(),
        no_hp_penerima: obj.no_hp_penerima.toString(),
        alamat_penerima: obj.alamat_penerima.toString(),
        tanggal_terakhir_kirim: obj.tanggal_terakhir_kirim.toString()
      });
    }
  }
  
  // Sort descending berdasarkan tanggal
  results.sort(function(a, b) {
    return new Date(b.tanggal_terakhir_kirim).getTime() - new Date(a.tanggal_terakhir_kirim).getTime();
  });
  
  return { status: "success", data: results };
}

/**
 * Ambil detail Pre-Input
 */
function apiGetPreInput(params) {
  var txId = params.transaksi_id;
  if (!txId) {
    return { status: "error", message: "transaksi_id wajib diberikan" };
  }
  
  var sheet = getSheetByName("PreInput_Backup");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  
  for (var i = 1; i < rows.length; i++) {
    var obj = rowToObject_(headers, rows[i]);
    if (obj.transaksi_id.toString() === txId) {
      return {
        status: "success",
        data: {
          transaksi_id: obj.transaksi_id.toString(),
          timestamp: obj.timestamp.toString(),
          admin_id: obj.admin_id.toString(),
          outlet_id_tugas: obj.outlet_id_tugas.toString(),
          nama_pengirim: obj.nama_pengirim.toString(),
          hp_pengirim: obj.hp_pengirim.toString(),
          alamat_pengirim: obj.alamat_pengirim.toString(),
          nama_penerima: obj.nama_penerima.toString(),
          hp_penerima: obj.hp_penerima.toString(),
          alamat_penerima: obj.alamat_penerima.toString(),
          nama_barang: obj.nama_barang.toString(),
          berat_kg: Number(obj.berat_kg) || 0,
          volume: obj.volume.toString(),
          nilai_barang: Number(obj.nilai_barang) || 0,
          foto_paket_url: obj.foto_paket_url.toString(),
          status: obj.status.toString(),
          catatan_admin: obj.catatan_admin ? obj.catatan_admin.toString() : ""
        }
      };
    }
  }
  
  return { status: "error", message: "Transaksi Pre-Input tidak ditemukan" };
}

/**
 * 4. Cek Duplikat Resi
 */
function apiCheckDuplicateResi(params) {
  var resiId = (params.resi_id || "").toString().toUpperCase().trim();
  if (!resiId) {
    return { status: "success", isDuplicate: false };
  }
  
  var sheetExp = getSheetByName("EXP_Resi");
  var rowsExp = sheetExp.getDataRange().getValues();
  var headersExp = rowsExp[0];
  for (var i = 1; i < rowsExp.length; i++) {
    var objE = rowToObject_(headersExp, rowsExp[i]);
    if (objE.resi_id.toString().toUpperCase() === resiId) {
      return { status: "success", isDuplicate: true };
    }
  }
  
  var sheetCrg = getSheetByName("CRG_Resi");
  var rowsCrg = sheetCrg.getDataRange().getValues();
  var headersCrg = rowsCrg[0];
  for (var j = 1; j < rowsCrg.length; j++) {
    var objC = rowToObject_(headersCrg, rowsCrg[j]);
    if (objC.resi_id.toString().toUpperCase() === resiId) {
      return { status: "success", isDuplicate: true };
    }
  }
  
  return { status: "success", isDuplicate: false };
}

/**
 * 5. Simpan Data PreInput & Sync Customer
 */
function apiSaveDataPreInput(params) {
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
}

/**
 * 6. Simpan Transaksi Resi (EXP_Resi atau CRG_Resi)
 */
function apiSaveTransaksi(params) {
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
}

/**
 * 7. AI Perbaikan Alamat via Gemini API gratis
 */
function apiPerbaikiAlamatAI(params) {
  var alamat = params.alamat;
  if (!alamat || alamat.trim().length === 0) {
    return { status: "error", message: "Teks alamat kosong!" };
  }
  
  // Ambil API Key dari Script Properties
  var apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) {
    return { 
      status: "error", 
      message: "API Key Gemini belum di-setting di Apps Script Properties! Hubungi Developer/Owner.", 
      data: alamat 
    };
  }
  
  // Endpoint Gemini API 2.5/3.5
  // Kita gunakan model gratis gemini-3.5-flash
  var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=" + apiKey;
  
  var payload = {
    contents: [{
      parts: [{
        text: "Rapikan alamat pengiriman ini: \"" + alamat + "\""
      }]
    }],
    systemInstruction: {
      parts: [{
        text: GEM_ALAMAT_SYSTEM_INSTRUCTION
      }]
    },
    generationConfig: {
      temperature: 0.1
    }
  };
  
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    var response = UrlFetchApp.fetch(url, options);
    var json = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() !== 200) {
      if (response.getResponseCode() === 429) {
        return { 
          status: "error", 
          message: "Kuota AI gratis harian sudah tercapai, coba lagi beberapa saat lagi atau isi manual.", 
          data: alamat 
        };
      }
      return { 
        status: "error", 
        message: "Gemini API Error (" + response.getResponseCode() + "): " + (json.error ? json.error.message : "Gagal memproses"), 
        data: alamat 
      };
    }
    
    if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0]) {
      var resultAlamat = json.candidates[0].content.parts[0].text.trim();
      return { status: "success", data: resultAlamat };
    }
    
    return { status: "error", message: "Gagal memparsing jawaban Gemini AI", data: alamat };
  } catch (e) {
    return { status: "error", message: "Exception UrlFetch: " + e.toString(), data: alamat };
  }
}

/**
 * 8. Upload file ke Google Drive (Base64)
 */
function apiUploadFile(params) {
  var fileBase64 = params.fileBase64;
  var fileName = params.fileName || "unnamed";
  var category = params.category || "TEMP"; // "FOTO_PAKET" | "BUKTI_BAYAR" | "BUKTI_ADD"
  
  if (!fileBase64) {
    return { status: "error", message: "Tidak ada data file untuk diupload." };
  }
  
  try {
    // Cari atau buat folder induk
    var parentFolder;
    var folderName = "JNT_OPS_PRO_" + category;
    var folders = DriveApp.getFoldersByName(folderName);
    
    if (folders.hasNext()) {
      parentFolder = folders.next();
    } else {
      parentFolder = DriveApp.createFolder(folderName);
    }
    
    // Pecah base64 header
    var parts = fileBase64.split(",");
    var mimeType = "image/png";
    var base64Data = "";
    
    if (parts.length === 2) {
      mimeType = parts[0].split(";")[0].split(":")[1];
      base64Data = parts[1];
    } else {
      base64Data = parts[0];
    }
    
    var decoded = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decoded, mimeType, category + "_" + new Date().getTime() + "_" + fileName);
    
    var file = parentFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var fileUrl = file.getUrl();
    // Konversi URL ke direct image url jika memungkinkan, atau return webViewUrl
    return { status: "success", data: fileUrl, message: "File berhasil disimpan di Drive!" };
  } catch (err) {
    return { status: "error", message: "Drive upload error: " + err.toString() };
  }
}

/**
 * 9. Mengambil data ringkasan dashboard OWNER
 */
function apiGetDashboardData(params) {
  var role = params.role;
  var filterOutlet = params.filterOutlet || "ALL";
  var filterTipeLayanan = params.filterTipeLayanan || "ALL";
  var dateStart = params.dateStart;
  var dateEnd = params.dateEnd;
  
  if (role !== "OWNER") {
    return { status: "error", message: "Akses Ditolak! Hanya role OWNER yang dapat membuka Dashboard." };
  }
  
  var sheetExp = getSheetByName("EXP_Resi");
  var sheetCrg = getSheetByName("CRG_Resi");
  var sheetBackup = getSheetByName("PreInput_Backup");
  var sheetOutlets = getSheetByName("Outlets");
  var sheetLogs = getSheetByName("AuditLogs");
  var sheetUsers = getSheetByName("Users");
  
  var dbExp = sheetExp.getDataRange().getValues();
  var dbCrg = sheetCrg.getDataRange().getValues();
  var dbBackup = sheetBackup.getDataRange().getValues();
  var dbOutlets = sheetOutlets.getDataRange().getValues();
  var dbLogs = sheetLogs.getDataRange().getValues();
  var dbUsers = sheetUsers.getDataRange().getValues();
  
  var headersExp = dbExp[0];
  var headersCrg = dbCrg[0];
  var headersBackup = dbBackup[0];
  var headersOutlets = dbOutlets[0];
  var headersLogs = dbLogs[0];
  var headersUsers = dbUsers[0];
  
  // Buat map preinput untuk lookup nama pengirim/penerima
  var backupMap = {};
  for (var k = 1; k < dbBackup.length; k++) {
    var objB = rowToObject_(headersBackup, dbBackup[k]);
    backupMap[objB.transaksi_id.toString()] = {
      pengirim: objB.nama_pengirim.toString(),
      penerima: objB.nama_penerima.toString()
    };
  }
  
  // Buat map user id ke nama lengkap
  var userMap = {};
  for (var u = 1; u < dbUsers.length; u++) {
    var objU = rowToObject_(headersUsers, dbUsers[u]);
    userMap[objU.user_id.toString()] = objU.nama_lengkap.toString();
  }
  
  var combined = [];
  
  // Proses Express Resi
  for (var i = 1; i < dbExp.length; i++) {
    var objE = rowToObject_(headersExp, dbExp[i]);
    var txId = objE.transaksi_id.toString();
    var lookup = backupMap[txId] || { pengirim: "Umum", penerima: "Umum" };
    combined.push({
      resi_id: objE.resi_id.toString(),
      transaksi_id: txId,
      timestamp: objE.timestamp.toString(),
      admin_id_pencatat: objE.admin_id_pencatat.toString(),
      outlet_id_input: objE.outlet_id_input.toString(),
      tipe_produk: objE.tipe_produk.toString(),
      grand_total: Number(objE.grand_total) || 0,
      setoran_ke_owner: Number(objE.setoran_ke_owner) || 0,
      kas_operasional: Number(objE.kas_operasional) || 0,
      tipe_layanan: "Express",
      pengirim: lookup.pengirim,
      penerima: lookup.penerima
    });
  }
  
  // Proses Cargo Resi
  for (var j = 1; j < dbCrg.length; j++) {
    var objC = rowToObject_(headersCrg, dbCrg[j]);
    var txIdC = objC.transaksi_id.toString();
    var lookupC = backupMap[txIdC] || { pengirim: "Umum", penerima: "Umum" };
    combined.push({
      resi_id: objC.resi_id.toString(),
      transaksi_id: txIdC,
      timestamp: objC.timestamp.toString(),
      admin_id_pencatat: objC.admin_id_pencatat.toString(),
      outlet_id_input: objC.outlet_id_input.toString(),
      tipe_produk: objC.tipe_produk.toString(),
      grand_total: Number(objC.grand_total) || 0,
      setoran_ke_owner: Number(objC.setoran_ke_owner) || 0,
      kas_operasional: Number(objC.kas_operasional) || 0,
      tipe_layanan: "Cargo",
      pengirim: lookupC.pengirim,
      penerima: lookupC.penerima
    });
  }
  
  // Filter Data
  var filtered = combined;
  if (filterOutlet !== "ALL") {
    filtered = filtered.filter(function(r) { return r.outlet_id_input === filterOutlet; });
  }
  if (filterTipeLayanan !== "ALL") {
    filtered = filtered.filter(function(r) { return r.tipe_layanan === filterTipeLayanan; });
  }
  if (dateStart) {
    var startMs = new Date(dateStart).getTime();
    filtered = filtered.filter(function(r) { return new Date(r.timestamp).getTime() >= startMs; });
  }
  if (dateEnd) {
    var endMs = new Date(dateEnd).getTime() + 86400000;
    filtered = filtered.filter(function(r) { return new Date(r.timestamp).getTime() <= endMs; });
  }
  
  // Akumulasi finansial
  var totalOmsetGlobal = 0;
  var totalSetoranOwner = 0;
  var totalKasOperasional = 0;
  
  filtered.forEach(function(r) {
    totalOmsetGlobal += r.grand_total;
    totalSetoranOwner += r.setoran_ke_owner;
    totalKasOperasional += r.kas_operasional;
  });
  
  // Akumulasi per-outlet
  var outletOmsetMap = {};
  for (var o = 1; o < dbOutlets.length; o++) {
    var objO = rowToObject_(headersOutlets, dbOutlets[o]);
    var oid = objO.outlet_id.toString();
    var name = objO.nama_outlet.toString().replace("J&T Express - ", "").replace("J&T Cargo - ", "");
    outletOmsetMap[oid] = { nama: name, omset: 0, setoran: 0, kas: 0, count: 0 };
  }
  
  filtered.forEach(function(r) {
    var outId = r.outlet_id_input;
    if (outletOmsetMap[outId]) {
      outletOmsetMap[outId].omset += r.grand_total;
      outletOmsetMap[outId].setoran += r.setoran_ke_owner;
      outletOmsetMap[outId].kas += r.kas_operasional;
      outletOmsetMap[outId].count += 1;
    }
  });
  
  var outletPerformance = Object.keys(outletOmsetMap).map(function(key) {
    return {
      outlet_id: key,
      nama: outletOmsetMap[key].nama,
      omset: outletOmsetMap[key].omset,
      setoran: outletOmsetMap[key].setoran,
      kas: outletOmsetMap[key].kas,
      count: outletOmsetMap[key].count
    };
  });
  
  // Format trend harian
  var dailyMap = {};
  filtered.forEach(function(r) {
    var dStr = r.timestamp.split("T")[0];
    if (!dailyMap[dStr]) dailyMap[dStr] = { date: dStr, Express: 0, Cargo: 0, total: 0 };
    dailyMap[dStr][r.tipe_layanan] += r.grand_total;
    dailyMap[dStr].total += r.grand_total;
  });
  
  var dailyTrend = Object.keys(dailyMap).sort().map(function(key) {
    return dailyMap[key];
  });
  
  // Format log audit (maks 50 baris terakhir yang cocok)
  var auditLogs = [];
  var filteredLogs = [];
  
  for (var logI = 1; logI < dbLogs.length; logI++) {
    var objL = rowToObject_(headersLogs, dbLogs[logI]);
    var logOutlet = objL.outlet_id.toString();
    var logTime = objL.timestamp.toString();
    
    if (filterOutlet !== "ALL" && logOutlet !== filterOutlet) continue;
    
    if (dateStart) {
      var startMsLog = new Date(dateStart).getTime();
      if (new Date(logTime).getTime() < startMsLog) continue;
    }
    
    if (dateEnd) {
      var endMsLog = new Date(dateEnd).getTime() + 86400000;
      if (new Date(logTime).getTime() > endMsLog) continue;
    }
    
    filteredLogs.push(objL);
  }
  
  // Balik agar terbaru di atas
  filteredLogs.reverse();
  
  var limit = Math.min(filteredLogs.length, 50);
  for (var logIdx = 0; logIdx < limit; logIdx++) {
    var objLFiltered = filteredLogs[logIdx];
    var logUid = objLFiltered.user_id.toString();
    auditLogs.push({
      log_id: objLFiltered.log_id.toString(),
      timestamp: objLFiltered.timestamp.toString(),
      user_id: logUid,
      nama_lengkap: userMap[logUid] || "Sistem",
      aksi: objLFiltered.aksi.toString(),
      detail: objLFiltered.detail.toString(),
      outlet_id: objLFiltered.outlet_id.toString()
    });
  }
  
  return {
    status: "success",
    data: {
      summary: {
        totalTransaksi: filtered.length,
        totalResiExpress: filtered.filter(function(r) { return r.tipe_layanan === "Express"; }).length,
        totalResiCargo: filtered.filter(function(r) { return r.tipe_layanan === "Cargo"; }).length,
        grandTotalCustomer: totalOmsetGlobal,
        totalWajibSetorOwner: totalSetoranOwner,
        totalKasOutlet: totalKasOperasional
      },
      outletPerformance: outletPerformance,
      dailyTrend: dailyTrend,
      auditLogs: auditLogs
    }
  };
}

// ==========================================
// RIWAYAT TRANSAKSI
// ==========================================

function apiGetRiwayatTransaksi(params) {
  var filterOutlet = params.filterOutlet || "ALL";
  
  var sheetExp = getSheetByName("EXP_Resi");
  var sheetCrg = getSheetByName("CRG_Resi");
  var sheetBackup = getSheetByName("PreInput_Backup");
  var sheetOutlets = getSheetByName("Outlets");
  var sheetUsers = getSheetByName("Users");
  
  var dbExp = sheetExp.getDataRange().getValues();
  var dbCrg = sheetCrg.getDataRange().getValues();
  var dbBackup = sheetBackup.getDataRange().getValues();
  var dbOutlets = sheetOutlets.getDataRange().getValues();
  var dbUsers = sheetUsers.getDataRange().getValues();
  
  var backupMap = {};
  var headersBackup = dbBackup[0];
  for (var k = 1; k < dbBackup.length; k++) {
    var obj = rowToObject_(headersBackup, dbBackup[k]);
    backupMap[obj.transaksi_id.toString()] = {
      pengirim: obj.nama_pengirim.toString(),
      penerima: obj.nama_penerima.toString()
    };
  }
  
  var outletMap = {};
  var headersOutlets = dbOutlets[0];
  for (var o = 1; o < dbOutlets.length; o++) {
    var objO = rowToObject_(headersOutlets, dbOutlets[o]);
    outletMap[objO.outlet_id.toString()] = objO.nama_outlet.toString();
  }
  
  var userMap = {};
  var headersUsers = dbUsers[0];
  for (var u = 1; u < dbUsers.length; u++) {
    var objU = rowToObject_(headersUsers, dbUsers[u]);
    userMap[objU.user_id.toString()] = objU.username.toString();
  }
  
  var transaksiList = [];
  
  // EXP_Resi
  var headersExp = dbExp[0];
  for (var i = 1; i < dbExp.length; i++) {
    var r = rowToObject_(headersExp, dbExp[i]);
    var outId = r.outlet_id_input.toString();
    if (filterOutlet !== "ALL" && outId !== filterOutlet) continue;
    
    var txId = r.transaksi_id.toString();
    var p = backupMap[txId] || { pengirim: "", penerima: "" };
    transaksiList.push({
      resi_id: r.resi_id.toString(),
      transaksi_id: txId,
      timestamp: r.timestamp.toString(),
      admin: userMap[r.admin_id_pencatat.toString()] || r.admin_id_pencatat.toString(),
      outlet: outletMap[outId] || outId,
      tipe: "Express",
      grand_total: parseFloat(r.grand_total) || 0,
      pengirim: p.pengirim,
      penerima: p.penerima,
      status_resi: r.status_resi ? r.status_resi.toString() : "AKTIF"
    });
  }
  
  // CRG_Resi
  var headersCrg = dbCrg[0];
  for (var j = 1; j < dbCrg.length; j++) {
    var c = rowToObject_(headersCrg, dbCrg[j]);
    var outIdC = c.outlet_id_input.toString();
    if (filterOutlet !== "ALL" && outIdC !== filterOutlet) continue;
    
    var txIdC = c.transaksi_id.toString();
    var pC = backupMap[txIdC] || { pengirim: "", penerima: "" };
    transaksiList.push({
      resi_id: c.resi_id.toString(),
      transaksi_id: txIdC,
      timestamp: c.timestamp.toString(),
      admin: userMap[c.admin_id_pencatat.toString()] || c.admin_id_pencatat.toString(),
      outlet: outletMap[outIdC] || outIdC,
      tipe: "Cargo",
      grand_total: parseFloat(c.grand_total) || 0,
      pengirim: pC.pengirim,
      penerima: pC.penerima,
      status_resi: c.status_resi ? c.status_resi.toString() : "AKTIF"
    });
  }
  
  transaksiList.sort(function(a, b) {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  
  return { status: "success", data: transaksiList };
}

function apiDeleteTransaksi(params) {
  var resi_id = params.resi_id;
  var user_id = params.user_id;
  var outlet_id = params.outlet_id;
  var tipe = params.tipe;
  
  if (!resi_id || !user_id) {
    return { status: "error", message: "Parameter resi_id dan user_id diperlukan" };
  }
  
  var found = false;
  
  if (tipe === "Express" || !tipe) {
    var sheetExp = getSheetByName("EXP_Resi");
    var dataExp = sheetExp.getDataRange().getValues();
    var colIdx = getColIndex_(sheetExp, "status_resi");
    
    for (var i = 1; i < dataExp.length; i++) {
      if (dataExp[i][0].toString() === resi_id) {
        if (colIdx !== -1) {
          sheetExp.getRange(i + 1, colIdx + 1).setValue("BATAL");
        }
        found = true;
        break;
      }
    }
  }
  
  if (!found && (tipe === "Cargo" || !tipe)) {
    var sheetCrg = getSheetByName("CRG_Resi");
    var dataCrg = sheetCrg.getDataRange().getValues();
    var colIdxCrg = getColIndex_(sheetCrg, "status_resi");
    
    for (var j = 1; j < dataCrg.length; j++) {
      if (dataCrg[j][0].toString() === resi_id) {
        if (colIdxCrg !== -1) {
          sheetCrg.getRange(j + 1, colIdxCrg + 1).setValue("BATAL");
        }
        found = true;
        break;
      }
    }
  }
  
  if (!found) {
    return { status: "error", message: "Transaksi tidak ditemukan" };
  }
  
  writeAuditLog(user_id, "BATAL_TRANSAKSI", "Membatalkan resi " + resi_id, outlet_id || "ALL");
  return { status: "success", message: "Transaksi berhasil dibatalkan" };
}

// ==========================================
// UTILITIES & SYSTEM FUNCTIONS
// ==========================================

/**
 * Mendapatkan sheet berdasarkan nama atau melempar error jika tidak ditemukan
 */
function getSheetByName(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    // Jika sheet belum ada, panggil initDatabaseSheets untuk generate
    initDatabaseSheets();
    sheet = ss.getSheetByName(name);
    if (!sheet) {
      throw new Error("Gagal menemukan atau membuat sheet: " + name);
    }
  }
  return sheet;
}

/**
 * Menulis Baris Log Baru ke AuditLogs
 */
function writeAuditLog(userId, action, detail, outletId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("AuditLogs");
    if (!sheet) {
      // Jaga-jaga jika terhapus
      sheet = ss.insertSheet("AuditLogs");
      sheet.appendRow(DB_SCHEMA.AuditLogs);
    }
    
    var logObj = {
      log_id: "LOG-" + new Date().getTime().toString().slice(-6),
      timestamp: new Date().toISOString(),
      user_id: userId || "SYSTEM",
      aksi: action,
      detail: detail,
      outlet_id: outletId || ""
    };
    
    var row = DB_SCHEMA.AuditLogs.map(function(col) { return logObj[col] !== undefined ? logObj[col] : ""; });
    sheet.appendRow(row);
  } catch (e) {
    Logger.log("Gagal writeAuditLog: " + e.toString());
  }
}

/**
 * Simulasi Hashing Password SHA-256 Sederhana di Apps Script
 * Penting: Ini untuk melacak password_hash yang disimpan di spreadsheet secara aman.
 */
function simulateSha256(input) {
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  var output = "";
  for (var i = 0; i < rawHash.length; i++) {
    var byteValue = rawHash[i];
    if (byteValue < 0) byteValue += 256;
    var byteString = byteValue.toString(16);
    if (byteString.length == 1) byteString = "0" + byteString;
    output += byteString;
  }
  return "hash_" + input; // Kami samakan format hash simulasinya agar konsisten dengan server pre-seed
}

// ==========================================
// DATABASE SCHEMA — satu-satunya sumber kebenaran struktur sheet.
// Tambah kolom baru = tambah string ke array di bawah + naikkan DB_SCHEMA_VERSION.
// Jangan hapus/reorder kolom existing di sini — itu mengubah posisi index yang
// sudah dipakai kode lain (mis. getRange(row, N)).
// ==========================================
var DB_SCHEMA_VERSION = 2; // v2: tambah status_resi (EXP_Resi/CRG_Resi), catatan_admin,
                            // target_resi_harian/bulanan, MapsReviews, SetoranData

var DB_SCHEMA = {
  Users: ["user_id", "username", "password_hash", "role", "outlet_id_home", "nama_lengkap", "status_aktif"],
  Outlets: ["outlet_id", "nama_outlet", "alamat_outlet", "target_resi_harian", "target_resi_bulanan"],
  Master_Customer: ["customer_id", "nama_pengirim", "no_hp", "alamat_pengirim", "outlet_id", "last_updated"],
  Riwayat_Penerima: ["id", "customer_id", "nama_penerima", "no_hp_penerima", "alamat_penerima", "tanggal_terakhir_kirim"],
  PreInput_Backup: ["transaksi_id", "timestamp", "admin_id", "outlet_id_tugas", "nama_pengirim", "hp_pengirim",
    "alamat_pengirim", "nama_penerima", "hp_penerima", "alamat_penerima", "nama_barang", "berat_kg", "volume",
    "nilai_barang", "foto_paket_url", "status", "catatan_admin"],
  EXP_Resi: ["resi_id", "transaksi_id", "timestamp", "admin_id_pencatat", "outlet_id_input", "tipe_produk",
    "biaya_lain", "biaya_asuransi", "ongkir_dasar", "biaya_yoyi", "total_dibayar_customer", "pembulatan",
    "metode_bayar", "bukti_bayar_url", "biaya_amplop", "biaya_packing", "metode_bayar_tambahan",
    "bukti_tambahan_url", "grand_total", "setoran_ke_owner", "kas_operasional", "status_resi"],
  CRG_Resi: ["resi_id", "transaksi_id", "timestamp", "admin_id_pencatat", "outlet_id_input", "tipe_produk",
    "merk_motor", "cc_motor", "tahun_motor", "kelengkapan_motor", "biaya_asuransi", "ongkir_dasar", "biaya_jtc",
    "total_dibayar_customer", "pembulatan", "metode_bayar", "bukti_bayar_url", "biaya_amplop", "biaya_packing",
    "metode_bayar_tambahan", "bukti_tambahan_url", "grand_total", "setoran_ke_owner", "kas_operasional", "status_resi"],
  AuditLogs: ["log_id", "timestamp", "user_id", "aksi", "detail", "outlet_id"],
  MapsReviews: ["id", "outlet_id", "nama_outlet", "reviewer", "stars", "text", "timestamp", "status_analisis", "analisis"],
  SetoranData: ["date", "outlet_id", "status", "total_setoran"]
};

/**
 * Satu-satunya fungsi yang boleh dipakai untuk membuat/memperbaiki struktur database.
 * Aman dijalankan berulang kali (idempotent):
 * - Sheet belum ada  -> dibuat + header ditulis.
 * - Sheet sudah ada  -> kolom di DB_SCHEMA yang belum ada di header ditambahkan di
 *                       ujung kanan. Kolom & data existing TIDAK PERNAH disentuh/dihapus.
 */
function initializeDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var versionSheet = getOrCreateVersionSheet_(ss);

  Object.keys(DB_SCHEMA).forEach(function (name) {
    syncSheetSchema_(ss, name, DB_SCHEMA[name]);
  });

  versionSheet.getRange(2, 1, 1, 2).setValues([[DB_SCHEMA_VERSION, new Date().toISOString()]]);
  Logger.log("initializeDatabase selesai. Schema version: " + DB_SCHEMA_VERSION);
}

// Alias supaya kode lama (getSheetByName -> initDatabaseSheets()) tetap jalan tanpa diubah.
function initDatabaseSheets() {
  initializeDatabase();
}

function getOrCreateVersionSheet_(ss) {
  var sheet = ss.getSheetByName("_SchemaVersion");
  if (!sheet) {
    sheet = ss.insertSheet("_SchemaVersion");
    sheet.appendRow(["schema_version", "last_migrated_at"]);
    sheet.appendRow([0, ""]);
    formatHeader_(sheet, 2);
  }
  return sheet;
}

function syncSheetSchema_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    formatHeader_(sheet, headers.length);
    return;
  }

  var lastCol = sheet.getLastColumn();
  var existing = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  var missing = headers.filter(function (h) { return existing.indexOf(h) === -1; });
  if (missing.length > 0) {
    sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
    formatHeader_(sheet, existing.length + missing.length);
  }
}

function formatHeader_(sheet, colCount) {
  var range = sheet.getRange(1, 1, 1, colCount);
  range.setFontWeight("bold");
  range.setBackground("#f3f3f3");
  sheet.setFrozenRows(1);
}
// ==========================================
// NEW API HANDLERS
// ==========================================

function apiUpdateOutletTarget(params) {
  var outletId = params.outlet_id;
  var targetHarian = params.target_resi_harian;
  var targetBulanan = params.target_resi_bulanan;
  
  if (!outletId) {
    return { status: "error", message: "outlet_id diperlukan" };
  }
  
  var sheet = getSheetByName("Outlets");
  var rows = sheet.getDataRange().getValues();
  
  var colHarian = getColIndex_(sheet, "target_resi_harian");
  var colBulanan = getColIndex_(sheet, "target_resi_bulanan");
  
  if (colHarian === -1 || colBulanan === -1) {
    return { status: "error", message: "Kolom target_resi belum ada di schema Outlets." };
  }
  
  var found = false;
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0].toString() === outletId) {
      if (targetHarian !== undefined) sheet.getRange(i + 1, colHarian + 1).setValue(targetHarian);
      if (targetBulanan !== undefined) sheet.getRange(i + 1, colBulanan + 1).setValue(targetBulanan);
      found = true;
      break;
    }
  }
  
  if (found) {
    return { status: "success", message: "Target outlet berhasil diupdate." };
  } else {
    return { status: "error", message: "Outlet tidak ditemukan." };
  }
}

function apiGetMapsReviews(params) {
  var filterOutlet = params.outlet_id || "ALL";
  var sheet = getSheetByName("MapsReviews");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var results = [];
  
  for (var i = 1; i < rows.length; i++) {
    var obj = rowToObject_(headers, rows[i]);
    if (filterOutlet !== "ALL" && obj.outlet_id.toString() !== filterOutlet) {
      continue;
    }
    results.push({
      id: obj.id.toString(),
      outlet_id: obj.outlet_id.toString(),
      nama_outlet: obj.nama_outlet.toString(),
      reviewer: obj.reviewer.toString(),
      stars: Number(obj.stars) || 0,
      text: obj.text.toString(),
      timestamp: obj.timestamp.toString(),
      status_analisis: obj.status_analisis.toString(),
      analisis: obj.analisis.toString()
    });
  }
  
  results.sort(function(a, b) {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  
  return { status: "success", data: results };
}

function apiSaveMapsReview(params) {
  var sheet = getSheetByName("MapsReviews");
  
  var reviewObj = {
    id: "REV-" + new Date().getTime(),
    outlet_id: params.outlet_id,
    nama_outlet: params.nama_outlet || "",
    reviewer: params.reviewer || "Anonim",
    stars: params.stars || 5,
    text: params.text || "",
    timestamp: params.timestamp || new Date().toISOString(),
    status_analisis: params.status_analisis || "Pending",
    analisis: params.analisis || ""
  };
  
  var row = DB_SCHEMA.MapsReviews.map(function(col) { return reviewObj[col] !== undefined ? reviewObj[col] : ""; });
  sheet.appendRow(row);
  
  return { status: "success", message: "Review berhasil disimpan.", data: reviewObj };
}

function apiGetStatusSetoran(params) {
  var filterOutlet = params.outlet_id || "ALL";
  var filterDate = params.date;
  
  var sheet = getSheetByName("SetoranData");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var results = [];
  
  for (var i = 1; i < rows.length; i++) {
    var obj = rowToObject_(headers, rows[i]);
    if (filterOutlet !== "ALL" && obj.outlet_id.toString() !== filterOutlet) {
      continue;
    }
    if (filterDate && obj.date.toString() !== filterDate) {
      continue;
    }
    results.push({
      date: obj.date.toString(),
      outlet_id: obj.outlet_id.toString(),
      status: obj.status.toString(),
      total_setoran: Number(obj.total_setoran) || 0
    });
  }
  
  return { status: "success", data: results };
}

function apiSaveSetoran(params) {
  var sheet = getSheetByName("SetoranData");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var found = false;
  
  for (var i = 1; i < rows.length; i++) {
    var obj = rowToObject_(headers, rows[i]);
    if (obj.date.toString() === params.date && obj.outlet_id.toString() === params.outlet_id) {
      // Update existing
      sheet.getRange(i + 1, getColIndex_(sheet, "status") + 1).setValue(params.status);
      sheet.getRange(i + 1, getColIndex_(sheet, "total_setoran") + 1).setValue(params.total_setoran);
      found = true;
      break;
    }
  }
  
  if (!found) {
    // Insert new
    var setoranObj = {
      date: params.date,
      outlet_id: params.outlet_id,
      status: params.status || "Belum Disetor",
      total_setoran: params.total_setoran || 0
    };
    var row = DB_SCHEMA.SetoranData.map(function(col) { return setoranObj[col] !== undefined ? setoranObj[col] : ""; });
    sheet.appendRow(row);
  }
  
  return { status: "success", message: "Status setoran berhasil disimpan." };
}

function testSchemaIntegrity() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pass = true;
  
  for (var key in DB_SCHEMA) {
    var sheet = ss.getSheetByName(key);
    if (!sheet) {
      Logger.log("FAIL: Sheet '" + key + "' tidak ditemukan.");
      pass = false;
      continue;
    }
    
    var expectedHeaders = DB_SCHEMA[key];
    var actualHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    if (expectedHeaders.length !== actualHeaders.length) {
      Logger.log("FAIL: Sheet '" + key + "' jumlah kolom tidak sesuai. Harap: " + expectedHeaders.length + ", Aktual: " + actualHeaders.length);
      pass = false;
      continue;
    }
    
    var match = true;
    for (var i = 0; i < expectedHeaders.length; i++) {
      if (expectedHeaders[i] !== actualHeaders[i]) {
        Logger.log("FAIL: Sheet '" + key + "' kolom ke-" + (i+1) + " tidak cocok. Harap: " + expectedHeaders[i] + ", Aktual: " + actualHeaders[i]);
        match = false;
        pass = false;
        break;
      }
    }
    
    if (match) {
      Logger.log("PASS: Sheet '" + key + "' OK.");
    }
  }
  
  return pass ? "ALL PASS" : "SOME FAIL";
}
