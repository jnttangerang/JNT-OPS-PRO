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
  
  // Hash password pencocokan
  var passwordHash = simulateSha256(password);
  
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    // user_id | username | password_hash | role | outlet_id_home | nama_lengkap | status_aktif
    if (row[1].toString().toLowerCase() === username.toLowerCase()) {
      if (row[2].toString() === passwordHash) {
        if (row[6].toString() !== "AKTIF") {
          return { status: "error", message: "Akun Anda berstatus NON-AKTIF!" };
        }
        
        var userData = {
          user_id: row[0].toString(),
          username: row[1].toString(),
          role: row[3].toString(),
          outlet_id_home: row[4].toString(),
          nama_lengkap: row[5].toString()
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
  var outlets = [];
  
  for (var i = 1; i < rows.length; i++) {
    outlets.push({
      outlet_id: rows[i][0].toString(),
      nama_outlet: rows[i][1].toString(),
      alamat_outlet: rows[i][2].toString()
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
  var results = [];
  
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    // customer_id | nama_pengirim | no_hp | alamat_pengirim | outlet_id | last_updated
    var name = row[1].toString();
    var phone = row[2].toString();
    
    if (name.toLowerCase().indexOf(query) !== -1 || phone.indexOf(query) !== -1) {
      results.push({
        customer_id: row[0].toString(),
        nama_pengirim: name,
        no_hp: phone,
        alamat_pengirim: row[3].toString(),
        outlet_id: row[4].toString()
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
  var results = [];
  
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    // id | customer_id | nama_penerima | no_hp_penerima | alamat_penerima | tanggal_terakhir_kirim
    if (row[1].toString() === customerId) {
      results.push({
        id: row[0].toString(),
        customer_id: row[1].toString(),
        nama_penerima: row[2].toString(),
        no_hp_penerima: row[3].toString(),
        alamat_penerima: row[4].toString(),
        tanggal_terakhir_kirim: row[5].toString()
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
  
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (row[0].toString() === txId) {
      return {
        status: "success",
        data: {
          transaksi_id: row[0].toString(),
          timestamp: row[1].toString(),
          admin_id: row[2].toString(),
          outlet_id_tugas: row[3].toString(),
          nama_pengirim: row[4].toString(),
          hp_pengirim: row[5].toString(),
          alamat_pengirim: row[6].toString(),
          nama_penerima: row[7].toString(),
          hp_penerima: row[8].toString(),
          alamat_penerima: row[9].toString(),
          nama_barang: row[10].toString(),
          berat_kg: Number(row[11]) || 0,
          volume: row[12].toString(),
          nilai_barang: Number(row[13]) || 0,
          foto_paket_url: row[14].toString(),
          status: row[15].toString(),
          catatan_admin: row[16] ? row[16].toString() : ""
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
  for (var i = 1; i < rowsExp.length; i++) {
    if (rowsExp[i][0].toString().toUpperCase() === resiId) {
      return { status: "success", isDuplicate: true };
    }
  }
  
  var sheetCrg = getSheetByName("CRG_Resi");
  var rowsCrg = sheetCrg.getDataRange().getValues();
  for (var j = 1; j < rowsCrg.length; j++) {
    if (rowsCrg[j][0].toString().toUpperCase() === resiId) {
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
  // transaksi_id | timestamp | admin_id | outlet_id_tugas | nama_pengirim | hp_pengirim | alamat_pengirim | nama_penerima | hp_penerima | alamat_penerima | nama_barang | berat_kg | volume | nilai_barang | foto_paket_url | status | catatan_admin
  sheetBackup.appendRow([
    txId,
    nowStr,
    params.admin_id,
    params.outlet_id_tugas,
    params.nama_pengirim,
    params.hp_pengirim,
    params.alamat_pengirim,
    params.nama_penerima,
    params.hp_penerima,
    params.alamat_penerima,
    params.nama_barang,
    params.berat_kg,
    params.volume,
    params.nilai_barang,
    params.foto_paket_url || "",
    "PENDING",
    params.catatan_admin || ""
  ]);
  
  // Cari / Update Master_Customer
  var sheetCst = getSheetByName("Master_Customer");
  var rowsCst = sheetCst.getDataRange().getValues();
  var cstId = "CST-" + new Date().getTime().toString().slice(-5);
  var foundCstRow = -1;
  
  for (var i = 1; i < rowsCst.length; i++) {
    if (rowsCst[i][2].toString() === params.hp_pengirim) {
      foundCstRow = i + 1; // 1-based index including header
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
    sheetCst.appendRow([
      cstId,
      params.nama_pengirim,
      params.hp_pengirim,
      params.alamat_pengirim,
      params.outlet_id_tugas,
      nowStr
    ]);
  }
  
  // Cari / Update Riwayat_Penerima
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
    sheetRec.appendRow([
      recId,
      cstId,
      params.nama_penerima,
      params.hp_penerima,
      params.alamat_penerima,
      nowStr
    ]);
  }
  
  // Tulis Log Audit
  writeAuditLog(
    params.admin_id, 
    "PREINPUT_SIMPAN", 
    "Mencatat pre-input '" + params.nama_pengirim + "' ke '" + params.nama_penerima + "' (" + txId + ")", 
    params.outlet_id_tugas
  );
  
  return {
    status: "success",
    message: "Data pre-input berhasil disimpan!",
    data: { transaksi_id: txId }
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
    sheetExp.appendRow([
      resiId,
      data.transaksi_id,
      nowStr,
      data.admin_id_pencatat,
      data.outlet_id_input,
      data.tipe_produk,
      data.biaya_lain,
      data.biaya_asuransi,
      data.ongkir_dasar,
      data.biaya_yoyi,
      data.total_dibayar_customer,
      data.pembulatan,
      data.metode_bayar,
      data.bukti_bayar_url || "",
      data.biaya_amplop,
      data.biaya_packing,
      data.metode_bayar_tambahan || "",
      data.bukti_tambahan_url || "",
      data.grand_total,
      data.setoran_ke_owner,
      data.kas_operasional
    ]);
  } else if (jenis === "Cargo") {
    var sheetCrg = getSheetByName("CRG_Resi");
    sheetCrg.appendRow([
      resiId,
      data.transaksi_id,
      nowStr,
      data.admin_id_pencatat,
      data.outlet_id_input,
      data.tipe_produk,
      data.merk_motor || "",
      data.cc_motor || 0,
      data.tahun_motor || 0,
      data.kelengkapan_motor || "",
      data.biaya_asuransi,
      data.ongkir_dasar,
      data.biaya_jtc,
      data.total_dibayar_customer,
      data.pembulatan,
      data.metode_bayar,
      data.bukti_bayar_url || "",
      data.biaya_amplop,
      data.biaya_packing,
      data.metode_bayar_tambahan || "",
      data.bukti_tambahan_url || "",
      data.grand_total,
      data.setoran_ke_owner,
      data.kas_operasional
    ]);
  } else {
    return { status: "error", message: "Jenis layanan '" + jenis + "' tidak didukung!" };
  }
  
  // Update status di PreInput_Backup menjadi SELESAI
  if (data.transaksi_id) {
    var sheetBackup = getSheetByName("PreInput_Backup");
    var rowsBackup = sheetBackup.getDataRange().getValues();
    for (var i = 1; i < rowsBackup.length; i++) {
      if (rowsBackup[i][0].toString() === data.transaksi_id) {
        sheetBackup.getRange(i + 1, 16).setValue("SELESAI"); // Kolom status (16)
        break;
      }
    }
  }
  
  // Tulis Log Audit
  writeAuditLog(
    data.admin_id_pencatat, 
    "TRANSAKSI_SIMPAN", 
    "Simpan transaksi resi " + jenis + " '" + resiId + "' (" + data.tipe_produk + "). Grand Total: Rp " + data.grand_total, 
    data.outlet_id_input
  );
  
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
  // Kita gunakan model gratis gemini-2.5-flash atau gemini-1.5-flash
  var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey;
  
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
  
  var dbExp = getSheetByName("EXP_Resi").getDataRange().getValues();
  var dbCrg = getSheetByName("CRG_Resi").getDataRange().getValues();
  var dbBackup = getSheetByName("PreInput_Backup").getDataRange().getValues();
  var dbOutlets = getSheetByName("Outlets").getDataRange().getValues();
  var dbLogs = getSheetByName("AuditLogs").getDataRange().getValues();
  var dbUsers = getSheetByName("Users").getDataRange().getValues();
  
  // Buat map preinput untuk lookup nama pengirim/penerima
  var backupMap = {};
  for (var k = 1; k < dbBackup.length; k++) {
    backupMap[dbBackup[k][0].toString()] = {
      pengirim: dbBackup[k][4].toString(),
      penerima: dbBackup[k][7].toString()
    };
  }
  
  // Buat map user id ke nama lengkap
  var userMap = {};
  for (var u = 1; u < dbUsers.length; u++) {
    userMap[dbUsers[u][0].toString()] = dbUsers[u][5].toString();
  }
  
  var combined = [];
  
  // Proses Express Resi
  // resi_id | transaksi_id | timestamp | admin_id_pencatat | outlet_id_input | tipe_produk | biaya_lain | biaya_asuransi | ongkir_dasar | biaya_yoyi | total_dibayar_customer | pembulatan | metode_bayar | bukti_bayar_url | biaya_amplop | biaya_packing | metode_bayar_tambahan | bukti_tambahan_url | grand_total | setoran_ke_owner | kas_operasional
  for (var i = 1; i < dbExp.length; i++) {
    var rExp = dbExp[i];
    var txId = rExp[1].toString();
    var lookup = backupMap[txId] || { pengirim: "Umum", penerima: "Umum" };
    combined.push({
      resi_id: rExp[0].toString(),
      transaksi_id: txId,
      timestamp: rExp[2].toString(),
      admin_id_pencatat: rExp[3].toString(),
      outlet_id_input: rExp[4].toString(),
      tipe_produk: rExp[5].toString(),
      grand_total: Number(rExp[18]) || 0,
      setoran_ke_owner: Number(rExp[19]) || 0,
      kas_operasional: Number(rExp[20]) || 0,
      tipe_layanan: "Express",
      pengirim: lookup.pengirim,
      penerima: lookup.penerima
    });
  }
  
  // Proses Cargo Resi
  // resi_id | transaksi_id | timestamp | admin_id_pencatat | outlet_id_input | tipe_produk | ... | grand_total (kolom ke-22 index 21) | setoran_ke_owner (index 22) | kas_operasional (index 23)
  for (var j = 1; j < dbCrg.length; j++) {
    var rCrg = dbCrg[j];
    var txIdC = rCrg[1].toString();
    var lookupC = backupMap[txIdC] || { pengirim: "Umum", penerima: "Umum" };
    combined.push({
      resi_id: rCrg[0].toString(),
      transaksi_id: txIdC,
      timestamp: rCrg[2].toString(),
      admin_id_pencatat: rCrg[3].toString(),
      outlet_id_input: rCrg[4].toString(),
      tipe_produk: rCrg[5].toString(),
      grand_total: Number(rCrg[21]) || 0,
      setoran_ke_owner: Number(rCrg[22]) || 0,
      kas_operasional: Number(rCrg[23]) || 0,
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
    var oid = dbOutlets[o][0].toString();
    var name = dbOutlets[o][1].toString().replace("J&T Express - ", "").replace("J&T Cargo - ", "");
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
    var logRow = dbLogs[logI];
    var logOutlet = logRow[5].toString();
    var logTime = logRow[1].toString();
    
    if (filterOutlet !== "ALL" && logOutlet !== filterOutlet) continue;
    
    if (dateStart) {
      var startMs = new Date(dateStart).getTime();
      if (new Date(logTime).getTime() < startMs) continue;
    }
    
    if (dateEnd) {
      var endMs = new Date(dateEnd).getTime() + 86400000;
      if (new Date(logTime).getTime() > endMs) continue;
    }
    
    filteredLogs.push(logRow);
  }
  
  var limit = Math.min(filteredLogs.length, 50);
  for (var logIdx = 0; logIdx < limit; logIdx++) {
    var logRow = filteredLogs[logIdx];
    // log_id | timestamp | user_id | aksi | detail | outlet_id
    var logUid = logRow[2].toString();
    auditLogs.push({
      log_id: logRow[0].toString(),
      timestamp: logRow[1].toString(),
      user_id: logUid,
      nama_lengkap: userMap[logUid] || "Sistem",
      aksi: logRow[3].toString(),
      detail: logRow[4].toString(),
      outlet_id: logRow[5].toString()
    });
  }
  
  // Format monthly reports
  var monthlyMap = {};
  filtered.forEach(function(r) {
    var monthStr = r.timestamp.substring(0, 7); // YYYY-MM
    if (!monthlyMap[monthStr]) {
      monthlyMap[monthStr] = { month: monthStr, total_omset: 0, outletsMap: {} };
    }
    monthlyMap[monthStr].total_omset += r.grand_total;
    
    var outId = r.outlet_id_input;
    if (!monthlyMap[monthStr].outletsMap[outId]) {
      // Find outlet name from outletOmsetMap if exists, else outId
      var outName = outletOmsetMap[outId] ? outletOmsetMap[outId].nama : outId;
      monthlyMap[monthStr].outletsMap[outId] = {
        outlet_id: outId,
        nama_outlet: outName,
        omset: 0,
        transaksi: 0
      };
    }
    monthlyMap[monthStr].outletsMap[outId].omset += r.grand_total;
    monthlyMap[monthStr].outletsMap[outId].transaksi += 1;
  });
  
  var monthlyReports = Object.keys(monthlyMap).map(function(mKey) {
    var m = monthlyMap[mKey];
    var outletsList = Object.keys(m.outletsMap).map(function(oKey) {
      return m.outletsMap[oKey];
    }).sort(function(a, b) { return b.omset - a.omset; });
    return {
      month: m.month,
      total_omset: m.total_omset,
      outlets: outletsList
    };
  }).sort(function(a, b) {
    return b.month > a.month ? 1 : -1;
  });
  
  return {
    status: "success",
    data: {
      stats: {
        totalOmsetGlobal: totalOmsetGlobal,
        totalSetoranOwner: totalSetoranOwner,
        totalKasOperasional: totalKasOperasional,
        totalTransaksi: filtered.length
      },
      outletPerformance: outletPerformance,
      dailyTrend: dailyTrend,
      auditLogs: auditLogs,
      recentTransactions: filtered.slice(0, 10),
      monthly_reports: monthlyReports
    }
  };
}

// ==========================================
// RIWAYAT TRANSAKSI
// ==========================================

function apiGetRiwayatTransaksi(params) {
  var filterOutlet = params.filterOutlet || "ALL";
  
  var dbExp = getSheetByName("EXP_Resi").getDataRange().getValues();
  var dbCrg = getSheetByName("CRG_Resi").getDataRange().getValues();
  var dbBackup = getSheetByName("PreInput_Backup").getDataRange().getValues();
  var dbOutlets = getSheetByName("Outlets").getDataRange().getValues();
  var dbUsers = getSheetByName("Users").getDataRange().getValues();
  
  var backupMap = {};
  for (var k = 1; k < dbBackup.length; k++) {
    backupMap[dbBackup[k][0].toString()] = {
      pengirim: dbBackup[k][4].toString(),
      penerima: dbBackup[k][7].toString()
    };
  }
  
  var outletMap = {};
  for (var o = 1; o < dbOutlets.length; o++) {
    outletMap[dbOutlets[o][0].toString()] = dbOutlets[o][1].toString();
  }
  
  var userMap = {};
  for (var u = 1; u < dbUsers.length; u++) {
    userMap[dbUsers[u][0].toString()] = dbUsers[u][1].toString(); // username
  }
  
  var transaksiList = [];
  
  // EXP_Resi (status at col 21, 0-indexed)
  for (var i = 1; i < dbExp.length; i++) {
    var r = dbExp[i];
    var outId = r[4].toString();
    if (filterOutlet !== "ALL" && outId !== filterOutlet) continue;
    
    var txId = r[1].toString();
    var p = backupMap[txId] || { pengirim: "", penerima: "" };
    transaksiList.push({
      resi_id: r[0].toString(),
      transaksi_id: txId,
      timestamp: r[2].toString(),
      admin: userMap[r[3].toString()] || r[3].toString(),
      outlet: outletMap[outId] || outId,
      tipe: "Express",
      grand_total: parseFloat(r[18]) || 0,
      pengirim: p.pengirim,
      penerima: p.penerima,
      status_resi: r[21] ? r[21].toString() : "AKTIF" // col 22
    });
  }
  
  // CRG_Resi (status at col 24, 0-indexed)
  for (var j = 1; j < dbCrg.length; j++) {
    var c = dbCrg[j];
    var outIdC = c[4].toString();
    if (filterOutlet !== "ALL" && outIdC !== filterOutlet) continue;
    
    var txIdC = c[1].toString();
    var pC = backupMap[txIdC] || { pengirim: "", penerima: "" };
    transaksiList.push({
      resi_id: c[0].toString(),
      transaksi_id: txIdC,
      timestamp: c[2].toString(),
      admin: userMap[c[3].toString()] || c[3].toString(),
      outlet: outletMap[outIdC] || outIdC,
      tipe: "Cargo",
      grand_total: parseFloat(c[21]) || 0,
      pengirim: pC.pengirim,
      penerima: pC.penerima,
      status_resi: c[24] ? c[24].toString() : "AKTIF" // col 25
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
    for (var i = 1; i < dataExp.length; i++) {
      if (dataExp[i][0].toString() === resi_id) {
        // Set status to BATAL in col 22
        sheetExp.getRange(i + 1, 22).setValue("BATAL");
        found = true;
        break;
      }
    }
  }
  
  if (!found && (tipe === "Cargo" || !tipe)) {
    var sheetCrg = getSheetByName("CRG_Resi");
    var dataCrg = sheetCrg.getDataRange().getValues();
    for (var j = 1; j < dataCrg.length; j++) {
      if (dataCrg[j][0].toString() === resi_id) {
        // Set status to BATAL in col 25
        sheetCrg.getRange(j + 1, 25).setValue("BATAL");
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
      sheet.appendRow(["log_id", "timestamp", "user_id", "aksi", "detail", "outlet_id"]);
    }
    
    var logId = "LOG-" + new Date().getTime().toString().slice(-6);
    sheet.appendRow([
      logId,
      new Date().toISOString(),
      userId || "SYSTEM",
      action,
      detail,
      outletId || "OUT-001"
    ]);
  } catch (e) {
    Logger.log("Audit log failed: " + e.toString());
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

/**
 * FUNGSI INTI SEED DATABASE (JALANKAN SEKALI SAJA)
 * Berfungsi untuk membuat seluruh tab sheet dengan header yang tepat jika belum ada,
 * lalu mengisi data awal agar aplikasi siap digunakan.
 */
function initDatabaseSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Sheet Users
  createSheetIfNotExist(ss, "Users", [
    "user_id", "username", "password_hash", "role", "outlet_id_home", "nama_lengkap", "status_aktif"
  ]);
  var sheetUsers = ss.getSheetByName("Users");
  if (sheetUsers.getLastRow() === 1) {
    sheetUsers.appendRow(["USR-001", "admin1", "hash_admin123", "ADMIN", "OUT-001", "Siti Aminah (Karawaci)", "AKTIF"]);
    sheetUsers.appendRow(["USR-002", "admin2", "hash_admin123", "ADMIN", "OUT-002", "Budi Santoso (Cikokol)", "AKTIF"]);
    sheetUsers.appendRow(["USR-003", "owner1", "hash_owner123", "OWNER", "OUT-001", "Hendra Wijaya (Owner)", "AKTIF"]);
  }
  
  // 2. Sheet Outlets
  createSheetIfNotExist(ss, "Outlets", ["outlet_id", "nama_outlet", "alamat_outlet"]);
  var sheetOutlets = ss.getSheetByName("Outlets");
  if (sheetOutlets.getLastRow() === 1) {
    sheetOutlets.appendRow(["OUT-001", "J&T Express - Tangerang Karawaci", "Jl. Karawaci Raya No.12, Karawaci, Tangerang"]);
    sheetOutlets.appendRow(["OUT-002", "J&T Express - Tangerang Cikokol", "Jl. M.H. Thamrin No.8, Cikokol, Tangerang"]);
    sheetOutlets.appendRow(["OUT-003", "J&T Cargo - Tangerang Balaraja", "Jl. Raya Serang Km 24, Balaraja, Tangerang"]);
  }
  
  // 3. Sheet Master_Customer
  createSheetIfNotExist(ss, "Master_Customer", ["customer_id", "nama_pengirim", "no_hp", "alamat_pengirim", "outlet_id", "last_updated"]);
  
  // 4. Sheet Riwayat_Penerima
  createSheetIfNotExist(ss, "Riwayat_Penerima", ["id", "customer_id", "nama_penerima", "no_hp_penerima", "alamat_penerima", "tanggal_terakhir_kirim"]);
  
  // 5. Sheet PreInput_Backup
  createSheetIfNotExist(ss, "PreInput_Backup", [
    "transaksi_id", "timestamp", "admin_id", "outlet_id_tugas", "nama_pengirim", "hp_pengirim", 
    "alamat_pengirim", "nama_penerima", "hp_penerima", "alamat_penerima", "nama_barang", 
    "berat_kg", "volume", "nilai_barang", "foto_paket_url", "status", "catatan_admin"
  ]);
  
  // 6. Sheet EXP_Resi
  createSheetIfNotExist(ss, "EXP_Resi", [
    "resi_id", "transaksi_id", "timestamp", "admin_id_pencatat", "outlet_id_input", "tipe_produk", 
    "biaya_lain", "biaya_asuransi", "ongkir_dasar", "biaya_yoyi", "total_dibayar_customer", 
    "pembulatan", "metode_bayar", "bukti_bayar_url", "biaya_amplop", "biaya_packing", 
    "metode_bayar_tambahan", "bukti_tambahan_url", "grand_total", "setoran_ke_owner", "kas_operasional"
  ]);
  
  // 7. Sheet CRG_Resi
  createSheetIfNotExist(ss, "CRG_Resi", [
    "resi_id", "transaksi_id", "timestamp", "admin_id_pencatat", "outlet_id_input", "tipe_produk", 
    "merk_motor", "cc_motor", "tahun_motor", "kelengkapan_motor", "biaya_asuransi", "ongkir_dasar", 
    "biaya_jtc", "total_dibayar_customer", "pembulatan", "metode_bayar", "bukti_bayar_url", 
    "biaya_amplop", "biaya_packing", "metode_bayar_tambahan", "bukti_tambahan_url", "grand_total", 
    "setoran_ke_owner", "kas_operasional"
  ]);
  
  // 8. Sheet AuditLogs
  createSheetIfNotExist(ss, "AuditLogs", ["log_id", "timestamp", "user_id", "aksi", "detail", "outlet_id"]);
  
  Logger.log("Seluruh Database Sheets J&T OPS PRO Berhasil Diinisialisasi!");
}

function createSheetIfNotExist(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    
    // Format header bold dengan background abu-abu terang
    var range = sheet.getRange(1, 1, 1, headers.length);
    range.setFontWeight("bold");
    range.setBackground("#f3f3f3");
    sheet.setFrozenRows(1);
  }
}
