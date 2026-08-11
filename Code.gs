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
 * 6. Jalankan fungsi 'initializeDatabase' sekali untuk membuat seluruh sheet & header otomatis
 *    (aman dijalankan berulang kali — kolom yang kurang ditambahkan, data lama tidak disentuh).
 * 7. Deploy sebagai Web App: New Deployment > Select type: Web App > Execute as: Me > Who has access: Anyone.
 * 8. Salin URL Web App hasil deploy untuk diakses oleh tim Anda.
 */

// Konstanta Instruksi Gem "Pakar Alamat J&T"
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
    case "getPreInputDrafts":
      return apiGetPreInputDrafts(params);
    case "updatePreInputStatus":
      return apiUpdatePreInputStatus(params);
    case "checkDuplicateResi":
      return apiCheckDuplicateResi(params);
    case "saveDataPreInput":
      return apiSaveDataPreInput(params);
    case "saveTransaksi":
      return apiSaveTransaksi(params);
    case "updateTransaksi":
      return apiUpdateTransaksi(params);
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
    case "createSetoran":
      return apiCreateSetoran(params);
    case "approveSetoran":
      return apiApproveSetoran(params);
    case "rejectSetoran":
      return apiRejectSetoran(params);
    case "getAuditData":
      return apiGetAuditData(params);
    case "updateAuditDecision":
      return apiUpdateAuditDecision(params);
    case "validateClosing":
      return apiValidateClosing(params);
    case "executeClosing":
      return apiExecuteClosing(params);
    case "getSetoranList":
      return apiGetSetoranList(params);
    case "getSetoranDetail":
      return apiGetSetoranDetail(params);
    case "getReportingSummary":
      return apiGetReportingSummary(params);
    case "getReportingTransactions":
      return apiGetReportingTransactions(params);
    case "getReportingSettlement":
      return apiGetReportingSettlement(params);
    case "getReportingAudit":
      return apiGetReportingAudit(params);
    case "getKategoriKeuangan":
      return apiGetKategoriKeuangan();
    case "saveKategoriKeuangan":
      return apiSaveKategoriKeuangan(params);
    case "updateKategoriKeuangan":
      return apiUpdateKategoriKeuangan(params);
    case "setKategoriAktif":
      return apiSetKategoriAktif(params);
    case "getKeuanganOutlet":
      return apiGetKeuanganOutlet(params);
    case "saveKeuanganOutlet":
      return apiSaveKeuanganOutlet(params);
    case "updateKeuanganOutlet":
      return apiUpdateKeuanganOutlet(params);
    case "deleteKeuanganOutlet":
      return apiDeleteKeuanganOutlet(params);
    case "apiDailySummary":
    case "dailySummary":
      return apiDailySummaryGAS(params);
    case "apiDetectAnomalies":
    case "detectAnomalies":
      return apiDetectAnomaliesGAS(params);
    case "apiAskAssistant":
    case "askAssistant":
      return apiAskAssistantGAS(params);
    case "testSchemaIntegrity":
      return testSchemaIntegrity();
    case "testDriveConnection":
      return apiTestDriveConnection(params);
    case "getUsers":
      return apiGetUsers();
    case "getCustomers":
    case "getCustomersMaster":
    case "getBukuPengirim":
    case "getBukuPenerima":
      return apiGetCustomers(params);
    case "getCustomerHistory":
    case "getCustomerDetailFull":
      return apiGetCustomerHistory(params);
    case "getAllSettings":
      return apiGetAllSettings();
    case "saveAllSettings":
      return apiSaveAllSettings(params);
    case "changePassword":
      return apiChangePassword(params);
    case "getDashboardData":
    case "getAdminDashboardData":
      return apiGetDashboardData(params);
    case "ping":
      return { status: "success", message: "PONG" };
    case "debugLoginVersion":
      return apiDebugLoginVersion();
    case "debugSpreadsheet":
      return apiDebugSpreadsheet();
    case "importCustomerFromSheet":
      return apiImportCustomerFromSheet(params);
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
 * Pakai rowToObject_ (bukan row[N] hardcoded) & mengembalikan role apa adanya
 * (termasuk role "PICKUP" yang ada di Users, bukan cuma ADMIN/OWNER).
 */
function apiLogin(params) {
  var username = (params.username || "").trim();
  var password = (params.password || "").trim();
  var usersData = DatabaseService.getSheetData("Users");
  var headers = usersData[0];
  var inputHash = password ? "hash_" + password : "";
  
  for (var i = 1; i < usersData.length; i++) {
    var row = usersData[i];
    var userData = rowToObject_(headers, row);
    
    if (userData.username && userData.username.toString().toLowerCase() === username.toLowerCase()) {
      var passMatch = (userData.password_hash === inputHash || userData.password_hash === password);
      if (passMatch) {
        var statusStr = (userData.status_aktif || "").toString().toUpperCase();
        if (statusStr !== "AKTIF") {
          return { status: "error", message: "Akun ini sudah tidak aktif." };
        }
        writeAuditLog(userData.user_id, "LOGIN", "Pengguna '" + userData.nama_lengkap + "' berhasil login.", userData.outlet_id_home);
        return {
          status: "success",
          data: {
            user_id: userData.user_id,
            username: userData.username,
            role: userData.role,
            outlet_id_home: userData.outlet_id_home,
            nama_lengkap: userData.nama_lengkap
          }
        };
      }
    }
  }
  return { status: "error", message: "Username atau password salah!" };
}

/**
 * Ambil Daftar Outlet — sekarang ikut kembalikan target_resi_harian & target_resi_bulanan
 */
function ensureDefaultOutlets_() {
  try {
    var sheet = getSheetByName("Outlets");
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      var defaultOutlets = [
        {
          outlet_id: "OUT-001",
          nama_outlet: "J&T Express - Tangerang Karawaci",
          kode_outlet: "TGR01",
          no_wa_outlet: "081234567890",
          alamat_outlet: "Jl. Karawaci Raya No.12, Karawaci, Tangerang",
          latitude: -6.2088,
          longitude: 106.634,
          radius_operasional: 50,
          status_aktif: "AKTIF",
          target_express: 25,
          target_cargo: 15,
          target_resi_harian: 50,
          target_resi_bulanan: 1500
        },
        {
          outlet_id: "OUT-002",
          nama_outlet: "J&T Express - Tangerang Cikokol",
          kode_outlet: "TGR02",
          no_wa_outlet: "081234567891",
          alamat_outlet: "Jl. M.H. Thamrin No.88, Cikokol, Tangerang",
          latitude: -6.1895,
          longitude: 106.645,
          radius_operasional: 50,
          status_aktif: "AKTIF",
          target_express: 20,
          target_cargo: 10,
          target_resi_harian: 40,
          target_resi_bulanan: 1200
        }
      ];
      defaultOutlets.forEach(function(item) {
        DatabaseService.appendRow("Outlets", item);
      });
    }
  } catch (e) {
    Logger.log("ensureDefaultOutlets_ error: " + e.toString());
  }
}

function apiGetOutlets() {
  ensureDefaultOutlets_();
  var rows = DatabaseService.getSheetData("Outlets");
  var headers = rows[0];
  var outlets = [];
  for (var i = 1; i < rows.length; i++) {
    var obj = rowToObject_(headers, rows[i]);
    if (!obj.outlet_id) continue;
    outlets.push({
      outlet_id: (obj.outlet_id || "").toString(),
      nama_outlet: (obj.nama_outlet || "").toString(),
      alamat_outlet: (obj.alamat_outlet || "").toString(),
      kode_outlet: (obj.kode_outlet || "").toString(),
      no_wa_outlet: (obj.no_wa_outlet || "").toString(),
      latitude: Number(obj.latitude) || 0,
      longitude: Number(obj.longitude) || 0,
      radius_operasional: Number(obj.radius_operasional) || 50,
      status_aktif: (obj.status_aktif || "AKTIF").toString(),
      target_express: Number(obj.target_express) || 0,
      target_cargo: Number(obj.target_cargo) || 0,
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
  var rows = DatabaseService.getSheetData("Master_Customer");
  var results = [];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
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
  var hp_pengirim = params.hp_pengirim;
  if (!hp_pengirim) {
    return { status: "success", data: [] };
  }
  var cstRows = DatabaseService.getSheetData("Master_Customer");
  var cstId = null;
  for (var i = 1; i < cstRows.length; i++) {
    if (cstRows[i][2].toString() === hp_pengirim) {
      cstId = cstRows[i][0].toString();
      break;
    }
  }
  if (!cstId) return { status: "success", data: [] };
  
  var recRows = DatabaseService.getSheetData("Riwayat_Penerima");
  var results = [];
  for (var j = 1; j < recRows.length; j++) {
    if (recRows[j][1].toString() === cstId) {
      results.push({
        nama_penerima: recRows[j][2].toString(),
        no_hp_penerima: recRows[j][3].toString(),
        alamat_penerima: recRows[j][4].toString()
      });
    }
  }
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
  var tx = DatabaseService.findRowByColumn("PreInput_Backup", "transaksi_id", txId);
  if (tx) {
    // Typecast some fields
    tx.berat_kg = Number(tx.berat_kg) || 0;
    tx.nilai_barang = Number(tx.nilai_barang) || 0;
    return { status: "success", data: tx };
  }
  return { status: "success", data: null, message: "Transaksi Pre-Input tidak ditemukan" };
}

/**
 * Ambil semua Draft Pre-Input untuk workspace
 */
function apiGetPreInputDrafts(params) {
  try {
    var data = DatabaseService.getSheetData("PreInput_Backup");
    var headers = data ? data[0] : [];
    var drafts = [];
    if (data && data.length > 1) {
      for (var i = 1; i < data.length; i++) {
        var rowObj = rowToObject_(headers, data[i]);
        if (rowObj) {
          drafts.push(rowObj);
        }
      }
    }
    return { status: "success", data: drafts };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

/**
 * Update Status Pre-Input
 */
function apiUpdatePreInputStatus(params) {
  try {
    var txId = params.transaksi_id;
    var status = params.status;
    if (!txId || !status) {
      return { status: "error", message: "transaksi_id dan status wajib!" };
    }
    var updateObj = { status: status };
    if (params.no_resi) {
      updateObj.no_resi = params.no_resi;
    }
    DatabaseService.updateRowByColumn("PreInput_Backup", "transaksi_id", txId, updateObj);
    return { status: "success", message: "Status Pre-Input berhasil diperbarui!" };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

/**
 * 4. Cek Duplikat Resi
 */
function apiCheckDuplicateResi(params) {
  try {
    var resiId = (params.resi_id || "").toString().trim();
    if (!resiId) {
      return { status: "success", isDuplicate: false };
    }
    var isValid = TransactionService.validateTransaction(resiId);
    return { status: "success", isDuplicate: !isValid };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

/**
 * 5. Simpan Data PreInput & Sync Customer
 * appendRow disusun lewat DB_SCHEMA.PreInput_Backup (termasuk catatan_admin),
 * bukan array literal manual.
 */
function apiSaveDataPreInput(params) {
  try {
    var result = TransactionService.savePreInput(params);
    return { status: "success", message: "Data pre-input berhasil disimpan!", data: result };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

/**
 * 6. Simpan Transaksi Resi (EXP_Resi atau CRG_Resi)
 * appendRow disusun lewat DB_SCHEMA.EXP_Resi / DB_SCHEMA.CRG_Resi,
 * status_resi ditulis eksplisit "AKTIF" untuk setiap transaksi baru.
 */
function apiSaveTransaksi(params) {
  try {
    var result = TransactionService.saveTransaction(params.jenis_layanan, params.data);
    return { status: "success", message: "Transaksi berhasil disimpan!", data: result };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

/**
 * 7. AI Perbaikan Alamat via Gemini API gratis
 */
function apiPerbaikiAlamatAI(params) {
  var alamat = params.alamat;
  if (!alamat || alamat.trim().length === 0) {
    return { status: "error", message: "Teks alamat kosong!" };
  }

  var apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) {
    return {
      status: "error",
      message: "API Key Gemini belum di-setting di Apps Script Properties! Hubungi Developer/Owner.",
      data: alamat
    };
  }

  var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" + apiKey;

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
  var category = params.category || "TEMP";

  if (!fileBase64) {
    return { status: "error", message: "Tidak ada data file untuk diupload." };
  }

  try {
    var parentFolder;
    var folderName = "JNT_OPS_PRO_" + category;
    var folders = DriveApp.getFoldersByName(folderName);

    if (folders.hasNext()) {
      parentFolder = folders.next();
    } else {
      parentFolder = DriveApp.createFolder(folderName);
    }

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
    return { status: "success", data: fileUrl, message: "File berhasil disimpan di Drive!" };
  } catch (err) {
    return { status: "error", message: "Drive upload error: " + err.toString() };
  }
}

/**
 * 9. Mengambil data ringkasan dashboard OWNER
 */
function apiGetDashboardData(params) {
  params = params || {};
  var role = (params.role || params.user_role || "").toString().toUpperCase();
  var filterOutlet = params.filterOutlet || "ALL";
  var filterTipeLayanan = params.filterTipeLayanan || "ALL";
  var dateStart = params.dateStart;
  var dateEnd = params.dateEnd;

  if (role !== "ADMIN" && role !== "OWNER") {
    return { status: "error", message: "Akses Ditolak! Hanya role ADMIN dan OWNER yang dapat membuka Dashboard." };
  }

  var dbExp = DatabaseService.getSheetData("EXP_Resi");
  var dbCrg = DatabaseService.getSheetData("CRG_Resi");
  var dbBackup = DatabaseService.getSheetData("PreInput_Backup");
  var dbOutlets = DatabaseService.getSheetData("Outlets");
  var dbLogs = DatabaseService.getSheetData("AuditLogs");
  var dbUsers = DatabaseService.getSheetData("Users");

  var backupMap = {};
  for (var k = 1; k < dbBackup.length; k++) {
    backupMap[dbBackup[k][0].toString()] = {
      pengirim: dbBackup[k][4].toString(),
      penerima: dbBackup[k][7].toString()
    };
  }

  var userMap = {};
  for (var u = 1; u < dbUsers.length; u++) {
    userMap[dbUsers[u][0].toString()] = dbUsers[u][5].toString();
  }

  var combined = [];

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

  var filtered = combined;
  if (filterOutlet !== "ALL") {
    filtered = filtered.filter(function (r) { return r.outlet_id_input === filterOutlet; });
  }
  if (filterTipeLayanan !== "ALL") {
    filtered = filtered.filter(function (r) { return r.tipe_layanan === filterTipeLayanan; });
  }
  if (dateStart) {
    var startMs = new Date(dateStart).getTime();
    filtered = filtered.filter(function (r) { return new Date(r.timestamp).getTime() >= startMs; });
  }
  if (dateEnd) {
    var endMs = new Date(dateEnd).getTime() + 86400000;
    filtered = filtered.filter(function (r) { return new Date(r.timestamp).getTime() <= endMs; });
  }

  var totalOmsetGlobal = 0;
  var totalSetoranOwner = 0;
  var totalKasOperasional = 0;

  filtered.forEach(function (r) {
    totalOmsetGlobal += r.grand_total;
    totalSetoranOwner += r.setoran_ke_owner;
    totalKasOperasional += r.kas_operasional;
  });

  var outletOmsetMap = {};
  for (var o = 1; o < dbOutlets.length; o++) {
    var oid = dbOutlets[o][0].toString();
    var name = dbOutlets[o][1].toString().replace("J&T Express - ", "").replace("J&T Cargo - ", "");
    outletOmsetMap[oid] = { nama: name, omset: 0, setoran: 0, kas: 0, count: 0 };
  }

  filtered.forEach(function (r) {
    var outId = r.outlet_id_input;
    if (outletOmsetMap[outId]) {
      outletOmsetMap[outId].omset += r.grand_total;
      outletOmsetMap[outId].setoran += r.setoran_ke_owner;
      outletOmsetMap[outId].kas += r.kas_operasional;
      outletOmsetMap[outId].count += 1;
    }
  });

  var outletPerformance = Object.keys(outletOmsetMap).map(function (key) {
    return {
      outlet_id: key,
      nama: outletOmsetMap[key].nama,
      omset: outletOmsetMap[key].omset,
      setoran: outletOmsetMap[key].setoran,
      kas: outletOmsetMap[key].kas,
      count: outletOmsetMap[key].count
    };
  });

  var dailyMap = {};
  filtered.forEach(function (r) {
    var dStr = r.timestamp.split("T")[0];
    if (!dailyMap[dStr]) dailyMap[dStr] = { date: dStr, Express: 0, Cargo: 0, total: 0 };
    dailyMap[dStr][r.tipe_layanan] += r.grand_total;
    dailyMap[dStr].total += r.grand_total;
  });

  var dailyTrend = Object.keys(dailyMap).sort().map(function (key) {
    return dailyMap[key];
  });

  var auditLogs = [];
  var filteredLogs = [];

  for (var logI = 1; logI < dbLogs.length; logI++) {
    var logRow = dbLogs[logI];
    var logOutlet = logRow[5].toString();
    var logTime = logRow[1].toString();

    if (filterOutlet !== "ALL" && logOutlet !== filterOutlet) continue;

    if (dateStart) {
      var startMsLog = new Date(dateStart).getTime();
      if (new Date(logTime).getTime() < startMsLog) continue;
    }

    if (dateEnd) {
      var endMsLog = new Date(dateEnd).getTime() + 86400000;
      if (new Date(logTime).getTime() > endMsLog) continue;
    }

    filteredLogs.push(logRow);
  }

  var limit = Math.min(filteredLogs.length, 50);
  for (var logIdx = 0; logIdx < limit; logIdx++) {
    var logRowF = filteredLogs[logIdx];
    var logUid = logRowF[2].toString();
    auditLogs.push({
      log_id: logRowF[0].toString(),
      timestamp: logRowF[1].toString(),
      user_id: logUid,
      nama_lengkap: userMap[logUid] || "Sistem",
      aksi: logRowF[3].toString(),
      detail: logRowF[4].toString(),
      outlet_id: logRowF[5].toString()
    });
  }

  var monthlyMap = {};
  filtered.forEach(function (r) {
    var monthStr = r.timestamp.substring(0, 7);
    if (!monthlyMap[monthStr]) {
      monthlyMap[monthStr] = { month: monthStr, total_omset: 0, outletsMap: {} };
    }
    monthlyMap[monthStr].total_omset += r.grand_total;

    var outId = r.outlet_id_input;
    if (!monthlyMap[monthStr].outletsMap[outId]) {
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

  var monthlyReports = Object.keys(monthlyMap).map(function (mKey) {
    var m = monthlyMap[mKey];
    var outletsList = Object.keys(m.outletsMap).map(function (oKey) {
      return m.outletsMap[oKey];
    }).sort(function (a, b) { return b.omset - a.omset; });
    return {
      month: m.month,
      total_omset: m.total_omset,
      outlets: outletsList
    };
  }).sort(function (a, b) {
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

/**
 * status_resi & grand_total dicari lewat getColIndex_ (nama header),
 * bukan lagi r[21]/c[24]/r[18]/c[21] hardcoded posisi.
 */
function apiGetRiwayatTransaksi(params) {
  var filterOutlet = params.filterOutlet || "ALL";

  var dbExp = DatabaseService.getSheetData("EXP_Resi");
  var dbCrg = DatabaseService.getSheetData("CRG_Resi");
  var dbBackup = DatabaseService.getSheetData("PreInput_Backup");
  var dbOutlets = DatabaseService.getSheetData("Outlets");
  var dbUsers = DatabaseService.getSheetData("Users");

  var expStatusCol = (dbExp && dbExp[0]) ? dbExp[0].indexOf("status_resi") : -1;
  var expTotalCol = (dbExp && dbExp[0]) ? dbExp[0].indexOf("grand_total") : -1;
  var crgStatusCol = (dbCrg && dbCrg[0]) ? dbCrg[0].indexOf("status_resi") : -1;
  var crgTotalCol = (dbCrg && dbCrg[0]) ? dbCrg[0].indexOf("grand_total") : -1;

  var backupMap = {};
  for (var k = 1; k < dbBackup.length; k++) {
    backupMap[dbBackup[k][0].toString()] = { pengirim: dbBackup[k][4].toString(), penerima: dbBackup[k][7].toString() };
  }

  var outletMap = {};
  for (var o = 1; o < dbOutlets.length; o++) outletMap[dbOutlets[o][0].toString()] = dbOutlets[o][1].toString();

  var userMap = {};
  for (var u = 1; u < dbUsers.length; u++) userMap[dbUsers[u][0].toString()] = dbUsers[u][1].toString();

  var transaksiList = [];

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
      grand_total: parseFloat((expTotalCol !== -1 && r[expTotalCol] !== undefined) ? r[expTotalCol] : (r[8] || 0)) || 0,
      pengirim: p.pengirim,
      penerima: p.penerima,
      status_resi: (expStatusCol !== -1 && r[expStatusCol]) ? r[expStatusCol].toString() : "AKTIF"
    });
  }

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
      grand_total: parseFloat((crgTotalCol !== -1 && c[crgTotalCol] !== undefined) ? c[crgTotalCol] : (c[8] || 0)) || 0,
      pengirim: pC.pengirim,
      penerima: pC.penerima,
      status_resi: (crgStatusCol !== -1 && c[crgStatusCol]) ? c[crgStatusCol].toString() : "AKTIF"
    });
  }

  transaksiList.sort(function (a, b) {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return { status: "success", data: transaksiList };
}

/**
 * Menghapus transaksi menggunakan TransactionService
 */
function apiDeleteTransaksi(params) {
  try {
    var result = TransactionService.deleteTransaction(params.resi_id, params.user_id, params.outlet_id, params.tipe);
    return { status: "success", message: result.message };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

// ==========================================
// ENDPOINT BARU: Target Outlet, Maps Reviews, Setoran Data
// ==========================================

function apiUpdateOutletTarget(params) {
  var outletId = params.outlet_id;
  var targetHarian = params.target_resi_harian;
  var targetBulanan = params.target_resi_bulanan;
  var updateData = {};
  if (targetHarian !== undefined) updateData.target_resi_harian = targetHarian;
  if (targetBulanan !== undefined) updateData.target_resi_bulanan = targetBulanan;
  
  var success = DatabaseService.updateRowByColumn("Outlets", "outlet_id", outletId, updateData);
  return success ? { status: "success", message: "Target outlet berhasil diupdate." } : { status: "error", message: "Outlet tidak ditemukan." };
}

function apiGetMapsReviews(params) {
  var rows = DatabaseService.getSheetData("MapsReviews");
  var headers = rows[0];
  var filterOutlet = params && params.outlet_id;

  var reviews = [];
  for (var i = 1; i < rows.length; i++) {
    var obj = rowToObject_(headers, rows[i]);
    if (filterOutlet && obj.outlet_id.toString() !== filterOutlet) continue;
    reviews.push(obj);
  }
  return { status: "success", data: reviews };
}

function apiSaveMapsReview(params) {
  var reviewObj = {
    id: "REV-" + new Date().getTime(),
    outlet_id: params.outlet_id,
    nama_outlet: params.nama_outlet,
    reviewer: params.reviewer,
    stars: params.stars,
    text: params.text,
    timestamp: new Date().toISOString(),
    status_analisis: params.analisis ? "SELESAI" : "PENDING",
    analisis: params.analisis || ""
  };
  DatabaseService.appendRow("MapsReviews", reviewObj);
  return { status: "success", message: "Review berhasil disimpan.", data: { id: reviewObj.id } };
}

/* NEW SETORAN ENGINE APIS */

function apiCreateSetoran(params) {
  var outletId = params.outlet_id;
  var tanggal = params.tanggal;
  var adminPembuat = params.admin_id || "SYSTEM";
  
  if (!outletId || !tanggal) {
    return { status: "error", message: "Parameter outlet_id dan tanggal diperlukan." };
  }
  
  // Prevent duplicate setoran for the same date and outlet that is not DITOLAK
  var existing = DatabaseService.getSheetData("Master_Setoran");
  var headers = existing[0];
  if (headers) {
    for (var i = 1; i < existing.length; i++) {
      var row = rowToObject_(headers, existing[i]);
      if (row.tanggal === tanggal && row.outlet_id === outletId && row.status !== "DITOLAK") {
        return { status: "error", message: "Setoran untuk tanggal ini sudah ada dan tidak dalam status DITOLAK." };
      }
    }
  }

  // Gather transactions
  var txDetail = getSetoranTransactions(tanggal, outletId);
  var data = txDetail.data;
  
  if (data.length === 0) {
    return { status: "error", message: "Tidak ada transaksi valid untuk disetor pada tanggal ini." };
  }
  
  var setoranId = "SET-" + new Date().getTime();
  var setoranObj = {
    setoran_id: setoranId,
    tanggal: tanggal,
    outlet_id: outletId,
    outlet_name: txDetail.outlet_name || outletId,
    admin_pembuat: adminPembuat,
    jumlah_resi: txDetail.jumlah_resi,
    total_setoran_owner: txDetail.total_setoran_owner,
    total_kas_outlet: txDetail.total_kas_outlet,
    status: "MENUNGGU_APPROVAL",
    created_at: new Date().toISOString(),
    approved_at: "",
    approved_by: "",
    catatan_owner: ""
  };
  
  DatabaseService.insertRow("Master_Setoran", setoranObj);
  
  DatabaseService.appendAudit(
    adminPembuat, 
    "SETORAN_CREATE", 
    "Membuat setoran harian untuk " + tanggal + " (Rp " + txDetail.total_setoran_owner + ")", 
    outletId
  );
  
  return { status: "success", message: "Setoran berhasil dibuat dan menunggu persetujuan.", data: setoranObj };
}

function apiApproveSetoran(params) {
  var setoranId = params.setoran_id;
  var adminId = params.admin_id; // The owner
  
  if (!setoranId) return { status: "error", message: "setoran_id diperlukan" };
  
  var existing = DatabaseService.findRowByColumn("Master_Setoran", "setoran_id", setoranId);
  if (!existing) return { status: "error", message: "Data setoran tidak ditemukan" };
  
  if (existing.status === "DISETUJUI") {
    return { status: "error", message: "Setoran ini sudah disetujui sebelumnya." };
  }
  
  var updateData = {
    status: "DISETUJUI",
    approved_at: new Date().toISOString(),
    approved_by: adminId || "OWNER"
  };
  
  DatabaseService.updateRowByColumn("Master_Setoran", "setoran_id", setoranId, updateData);
  
  DatabaseService.appendAudit(
    updateData.approved_by,
    "SETORAN_APPROVE",
    "Menyetujui setoran " + setoranId + " tanggal " + existing.tanggal,
    existing.outlet_id
  );
  
  return { status: "success", message: "Setoran berhasil disetujui." };
}

function apiRejectSetoran(params) {
  var setoranId = params.setoran_id;
  var adminId = params.admin_id; // The owner
  var catatan = params.catatan || "";
  
  if (!setoranId) return { status: "error", message: "setoran_id diperlukan" };
  
  var existing = DatabaseService.findRowByColumn("Master_Setoran", "setoran_id", setoranId);
  if (!existing) return { status: "error", message: "Data setoran tidak ditemukan" };
  
  if (existing.status === "DISETUJUI") {
    return { status: "error", message: "Setoran yang sudah disetujui tidak dapat ditolak." };
  }
  
  var updateData = {
    status: "DITOLAK",
    catatan_owner: catatan,
    approved_at: new Date().toISOString(),
    approved_by: adminId || "OWNER"
  };
  
  DatabaseService.updateRowByColumn("Master_Setoran", "setoran_id", setoranId, updateData);
  
  DatabaseService.appendAudit(
    updateData.approved_by,
    "SETORAN_REJECT",
    "Menolak setoran " + setoranId + " tanggal " + existing.tanggal + " (" + catatan + ")",
    existing.outlet_id
  );
  
  return { status: "success", message: "Setoran berhasil ditolak." };
}

function apiGetSetoranList(params) {
  var outletId = params.outlet_id;
  var status = params.status;
  var dateStart = params.date_start;
  var dateEnd = params.date_end;
  
  var rows = DatabaseService.getSheetData("Master_Setoran");
  if (!rows || rows.length < 2) return { status: "success", data: [] };
  
  var headers = rows[0];
  var list = [];
  
  for (var i = 1; i < rows.length; i++) {
    var obj = rowToObject_(headers, rows[i]);
    if (outletId && outletId !== "ALL" && obj.outlet_id !== outletId) continue;
    if (status && status !== "ALL" && obj.status !== status) continue;
    
    if (dateStart && obj.tanggal < dateStart) continue;
    if (dateEnd && obj.tanggal > dateEnd) continue;
    
    list.push(obj);
  }
  
  return { status: "success", data: list.reverse() }; // newest first
}

function apiGetSetoranDetail(params) {
  var setoranId = params.setoran_id;
  var header = null;
  
  if (setoranId) {
    header = DatabaseService.findRowByColumn("Master_Setoran", "setoran_id", setoranId);
  } else {
    var tanggal = params.tanggal;
    var outletId = params.outlet_id;
    if (!tanggal || !outletId) {
      return { status: "error", message: "Parameter setoran_id atau (tanggal dan outlet_id) diperlukan." };
    }
    
    var rows = DatabaseService.getSheetData("Master_Setoran");
    var headers = rows[0];
    for (var i = 1; i < rows.length; i++) {
       var rowObj = rowToObject_(headers, rows[i]);
       if (rowObj.tanggal === tanggal && rowObj.outlet_id === outletId && rowObj.status !== "DITOLAK") {
          header = rowObj;
          break;
       }
    }
    // If not found active, try finding any
    if (!header) {
       for (var j = 1; j < rows.length; j++) {
         var rObj = rowToObject_(headers, rows[j]);
         if (rObj.tanggal === tanggal && rObj.outlet_id === outletId) {
            header = rObj;
            break;
         }
       }
    }
  }
  
  if (!header) {
    return { status: "error", message: "Data setoran tidak ditemukan." };
  }
  
  var detail = getSetoranTransactions(header.tanggal, header.outlet_id);
  
  return { 
    status: "success", 
    data: {
      header: header,
      summary: {
        outlet_name: detail.outlet_name,
        jumlah_resi: detail.jumlah_resi,
        total_setoran_owner: detail.total_setoran_owner,
        total_kas_outlet: detail.total_kas_outlet
      },
      transactions: detail.data
    } 
  };
}

function getSetoranTransactions(tanggal, outletId) {
  var expData = DatabaseService.getSheetData("EXP_Resi");
  var crgData = DatabaseService.getSheetData("CRG_Resi");
  var outletData = DatabaseService.getSheetData("Outlets");
  
  var outletName = outletId;
  if (outletData && outletData.length > 0) {
    for (var o = 1; o < outletData.length; o++) {
      if (outletData[o][0].toString() === outletId) {
        outletName = outletData[o][1].toString();
        break;
      }
    }
  }
  
  var expHeaders = expData[0];
  var crgHeaders = crgData[0];
  
  var list = [];
  var totalSetoranOwner = 0;
  var totalKasOutlet = 0;
  
  // Exclude BATAL status
  if (expHeaders) {
    for (var i = 1; i < expData.length; i++) {
      var rExp = rowToObject_(expHeaders, expData[i]);
      if (rExp.outlet_id_input === outletId && rExp.status_resi !== "BATAL") {
        var txDate = rExp.timestamp ? rExp.timestamp.toString().split("T")[0] : "";
        if (txDate === tanggal) {
           rExp.tipe_layanan = "Express";
           list.push(rExp);
           totalSetoranOwner += Number(rExp.setoran_ke_owner) || 0;
           totalKasOutlet += Number(rExp.kas_operasional) || 0;
        }
      }
    }
  }
  
  if (crgHeaders) {
    for (var j = 1; j < crgData.length; j++) {
      var rCrg = rowToObject_(crgHeaders, crgData[j]);
      if (rCrg.outlet_id_input === outletId && rCrg.status_resi !== "BATAL") {
        var txDateC = rCrg.timestamp ? rCrg.timestamp.toString().split("T")[0] : "";
        if (txDateC === tanggal) {
           rCrg.tipe_layanan = "Cargo";
           list.push(rCrg);
           totalSetoranOwner += Number(rCrg.setoran_ke_owner) || 0;
           totalKasOutlet += Number(rCrg.kas_operasional) || 0;
        }
      }
    }
  }
  
  return {
    outlet_name: outletName,
    jumlah_resi: list.length,
    total_setoran_owner: totalSetoranOwner,
    total_kas_outlet: totalKasOutlet,
    data: list
  };
}

/* PHASE 8 — REPORTING & ANALYTICS APIS */

function apiGetReportingRawTransactions_() {
  var expData = DatabaseService.getSheetData("EXP_Resi");
  var crgData = DatabaseService.getSheetData("CRG_Resi");
  var backupData = DatabaseService.getSheetData("PreInput_Backup");
  var userData = DatabaseService.getSheetData("Users");
  var outletData = DatabaseService.getSheetData("Outlets");
  var setoranData = DatabaseService.getSheetData("Master_Setoran");

  var backupMap = {};
  if (backupData && backupData.length > 1) {
    var bHeaders = backupData[0];
    for (var b = 1; b < backupData.length; b++) {
      var bObj = rowToObject_(bHeaders, backupData[b]);
      backupMap[bObj.transaksi_id] = bObj;
    }
  }

  var userMap = {};
  if (userData && userData.length > 1) {
    var uHeaders = userData[0];
    for (var u = 1; u < userData.length; u++) {
      var uObj = rowToObject_(uHeaders, userData[u]);
      userMap[uObj.user_id] = uObj.nama_lengkap || uObj.username;
    }
  }

  var outletMap = {};
  if (outletData && outletData.length > 1) {
    var oHeaders = outletData[0];
    for (var o = 1; o < outletData.length; o++) {
      var oObj = rowToObject_(oHeaders, outletData[o]);
      outletMap[oObj.outlet_id] = oObj.nama_outlet;
    }
  }

  var setoranMap = {};
  if (setoranData && setoranData.length > 1) {
    var sHeaders = setoranData[0];
    for (var s = 1; s < setoranData.length; s++) {
      var sObj = rowToObject_(sHeaders, setoranData[s]);
      if (sObj.status !== "DITOLAK") {
        setoranMap[sObj.tanggal + "_" + sObj.outlet_id] = sObj.status;
      }
    }
  }

  var raw = [];

  if (expData && expData.length > 1) {
    var expHeaders = expData[0];
    for (var i = 1; i < expData.length; i++) {
      var r = rowToObject_(expHeaders, expData[i]);
      if (r.status_resi !== "BATAL" && r.status !== "BATAL") {
        var txDate = r.timestamp ? r.timestamp.toString().split("T")[0] : "";
        var pre = backupMap[r.transaksi_id] || {};
        var custPay = Number(r.total_dibayar_customer) || Number(r.grand_total) || 0;
        var yoyi = Number(r.biaya_yoyi) || 0;
        var selisih = custPay - yoyi;
        var setoranOwner = Number(r.setoran_ke_owner) || 0;
        var kasOperasional = Number(r.kas_operasional) || 0;
        var settlementStatus = setoranMap[txDate + "_" + r.outlet_id_input] || "BELUM_ADA_SETORAN";

        var auditStatus = "BELUM_DIAUDIT";
        if (r.owner_audit_status) {
          auditStatus = r.owner_audit_status;
        } else if (settlementStatus === "DISETUJUI") {
          if (custPay === 0) auditStatus = "PERLU_REVIEW";
          else if (selisih < 0) auditStatus = "SELISIH";
          else auditStatus = "SESUAI";
        }

        raw.push({
          resi_id: r.resi_id.toString(),
          transaksi_id: (r.transaksi_id || "").toString(),
          timestamp: (r.timestamp || "").toString(),
          tanggal: txDate,
          admin_id: (r.admin_id_pencatat || "").toString(),
          admin_nama: userMap[r.admin_id_pencatat] || r.admin_id_pencatat || "System",
          outlet_id: (r.outlet_id_input || "").toString(),
          outlet_nama: outletMap[r.outlet_id_input] || r.outlet_id_input || "Outlet",
          tipe_layanan: "Express",
          tipe_produk: (r.tipe_produk || "EXPRESS").toString(),
          total_customer: custPay,
          total_yoyi: yoyi,
          selisih: selisih,
          setoran_owner: setoranOwner,
          kas_operasional: kasOperasional,
          settlement_status: settlementStatus,
          audit_status: auditStatus,
          pengirim: pre.nama_pengirim || "Umum",
          penerima: pre.nama_penerima || "Umum",
          metode_bayar: (r.metode_bayar || "Tunai").toString()
        });
      }
    }
  }

  if (crgData && crgData.length > 1) {
    var crgHeaders = crgData[0];
    for (var j = 1; j < crgData.length; j++) {
      var c = rowToObject_(crgHeaders, crgData[j]);
      if (c.status_resi !== "BATAL" && c.status !== "BATAL") {
        var txDateC = c.timestamp ? c.timestamp.toString().split("T")[0] : "";
        var preC = backupMap[c.transaksi_id] || {};
        var custPayC = Number(c.total_dibayar_customer) || Number(c.grand_total) || 0;
        var yoyiC = Number(c.biaya_jtc) || 0;
        var selisihC = custPayC - yoyiC;
        var setoranOwnerC = Number(c.setoran_ke_owner) || 0;
        var kasOperasionalC = Number(c.kas_operasional) || 0;
        var settlementStatusC = setoranMap[txDateC + "_" + c.outlet_id_input] || "BELUM_ADA_SETORAN";

        var auditStatusC = "BELUM_DIAUDIT";
        if (c.owner_audit_status) {
          auditStatusC = c.owner_audit_status;
        } else if (settlementStatusC === "DISETUJUI") {
          if (custPayC === 0) auditStatusC = "PERLU_REVIEW";
          else if (selisihC < 0) auditStatusC = "SELISIH";
          else auditStatusC = "SESUAI";
        }

        raw.push({
          resi_id: c.resi_id.toString(),
          transaksi_id: (c.transaksi_id || "").toString(),
          timestamp: (c.timestamp || "").toString(),
          tanggal: txDateC,
          admin_id: (c.admin_id_pencatat || "").toString(),
          admin_nama: userMap[c.admin_id_pencatat] || c.admin_id_pencatat || "System",
          outlet_id: (c.outlet_id_input || "").toString(),
          outlet_nama: outletMap[c.outlet_id_input] || c.outlet_id_input || "Outlet",
          tipe_layanan: "Cargo",
          tipe_produk: (c.tipe_produk || "CARGO").toString(),
          total_customer: custPayC,
          total_yoyi: yoyiC,
          selisih: selisihC,
          setoran_owner: setoranOwnerC,
          kas_operasional: kasOperasionalC,
          settlement_status: settlementStatusC,
          audit_status: auditStatusC,
          pengirim: preC.nama_pengirim || "Umum",
          penerima: preC.nama_penerima || "Umum",
          metode_bayar: (c.metode_bayar || "Tunai").toString()
        });
      }
    }
  }

  raw.sort(function (a, b) {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return raw;
}

function filterReportingTransactions_(raw, params) {
  params = params || {};
  var start = params.date_start || params.dateStart || "";
  var end = params.date_end || params.dateEnd || "";
  var out = params.outlet_id || params.filterOutlet || "ALL";
  var op = params.operator_id || params.filterOperator || "ALL";
  var sType = params.service_type || params.filterServiceType || "ALL";
  var setStat = params.settlement_status || params.filterSettlementStatus || "ALL";
  var audStat = params.audit_status || params.filterAuditStatus || "ALL";

  return raw.filter(function (r) {
    if (out !== "ALL" && r.outlet_id !== out) return false;
    if (op !== "ALL" && r.admin_id !== op && r.admin_nama.toLowerCase().indexOf(op.toLowerCase()) === -1) return false;
    if (sType !== "ALL" && r.tipe_layanan !== sType) return false;
    if (setStat !== "ALL" && r.settlement_status !== setStat) return false;
    if (audStat !== "ALL" && r.audit_status !== audStat) return false;
    if (start && r.tanggal < start) return false;
    if (end && r.tanggal > end) return false;
    return true;
  });
}

function apiGetReportingSummary(params) {
  var raw = apiGetReportingRawTransactions_();
  var filtered = filterReportingTransactions_(raw, params);

  var total_transaksi = filtered.length;
  var total_express = 0;
  var total_cargo = 0;
  var total_customer_payment = 0;
  var total_yoyi = 0;
  var total_setoran_owner = 0;
  var total_kas_operasional = 0;

  var dailyMap = {};
  var outletMap = {};
  var operatorMap = {};
  var dateRevenueMap = {};
  var dailyChartMap = {};

  for (var i = 0; i < filtered.length; i++) {
    var r = filtered[i];
    if (r.tipe_layanan === "Express") total_express++;
    if (r.tipe_layanan === "Cargo") total_cargo++;

    total_customer_payment += r.total_customer;
    total_yoyi += r.total_yoyi;
    total_setoran_owner += r.setoran_owner;
    total_kas_operasional += r.kas_operasional;

    // Daily report
    var dKey = r.tanggal + "_" + r.outlet_id;
    if (!dailyMap[dKey]) {
      dailyMap[dKey] = {
        tanggal: r.tanggal,
        outlet_id: r.outlet_id,
        nama_outlet: r.outlet_nama,
        total_transaksi: 0,
        express: 0,
        cargo: 0,
        total_customer_payment: 0,
        total_yoyi: 0,
        total_setoran_owner: 0,
        total_kas_operasional: 0,
        total_selisih: 0
      };
    }
    dailyMap[dKey].total_transaksi++;
    if (r.tipe_layanan === "Express") dailyMap[dKey].express++;
    if (r.tipe_layanan === "Cargo") dailyMap[dKey].cargo++;
    dailyMap[dKey].total_customer_payment += r.total_customer;
    dailyMap[dKey].total_yoyi += r.total_yoyi;
    dailyMap[dKey].total_setoran_owner += r.setoran_owner;
    dailyMap[dKey].total_kas_operasional += r.kas_operasional;
    dailyMap[dKey].total_selisih += r.selisih;

    // Outlet report
    if (!outletMap[r.outlet_id]) {
      outletMap[r.outlet_id] = {
        outlet_id: r.outlet_id,
        nama_outlet: r.outlet_nama,
        total_transaksi: 0,
        omset: 0,
        setoran: 0,
        kas_outlet: 0,
        selisih: 0
      };
    }
    outletMap[r.outlet_id].total_transaksi++;
    outletMap[r.outlet_id].omset += r.total_customer;
    outletMap[r.outlet_id].setoran += r.setoran_owner;
    outletMap[r.outlet_id].kas_outlet += r.kas_operasional;
    outletMap[r.outlet_id].selisih += r.selisih;

    // Operator report
    if (!operatorMap[r.admin_id]) {
      operatorMap[r.admin_id] = {
        admin_id: r.admin_id,
        nama_operator: r.admin_nama,
        total_transaksi: 0,
        express: 0,
        cargo: 0,
        omset: 0,
        kas_operasional: 0
      };
    }
    operatorMap[r.admin_id].total_transaksi++;
    if (r.tipe_layanan === "Express") operatorMap[r.admin_id].express++;
    if (r.tipe_layanan === "Cargo") operatorMap[r.admin_id].cargo++;
    operatorMap[r.admin_id].omset += r.total_customer;
    operatorMap[r.admin_id].kas_operasional += r.kas_operasional;

    // Revenue per date
    dateRevenueMap[r.tanggal] = (dateRevenueMap[r.tanggal] || 0) + r.total_customer;

    // Daily chart map
    if (!dailyChartMap[r.tanggal]) {
      dailyChartMap[r.tanggal] = { date: r.tanggal, total: 0, express: 0, cargo: 0, omset: 0, setoran: 0, kas: 0 };
    }
    dailyChartMap[r.tanggal].total++;
    if (r.tipe_layanan === "Express") dailyChartMap[r.tanggal].express++;
    if (r.tipe_layanan === "Cargo") dailyChartMap[r.tanggal].cargo++;
    dailyChartMap[r.tanggal].omset += r.total_customer;
    dailyChartMap[r.tanggal].setoran += r.setoran_owner;
    dailyChartMap[r.tanggal].kas += r.kas_operasional;
  }

  var daily_report = Object.keys(dailyMap).map(function(k) { return dailyMap[k]; }).sort(function(a,b) { return b.tanggal.localeCompare(a.tanggal); });
  var outlet_report = Object.keys(outletMap).map(function(k) { return outletMap[k]; }).sort(function(a,b) { return b.omset - a.omset; });
  var operator_report = Object.keys(operatorMap).map(function(k) { return operatorMap[k]; }).sort(function(a,b) { return b.total_transaksi - a.total_transaksi; });

  var highest_outlet = outlet_report.length > 0 ? outlet_report[0] : null;
  var highest_operator = operator_report.length > 0 ? operator_report[0] : null;

  var highest_revenue_date = null;
  Object.keys(dateRevenueMap).forEach(function(d) {
    if (!highest_revenue_date || dateRevenueMap[d] > highest_revenue_date.omset) {
      highest_revenue_date = { tanggal: d, omset: dateRevenueMap[d] };
    }
  });

  var uniqueDays = Object.keys(dateRevenueMap).length;
  var avg_transactions_per_day = uniqueDays > 0 ? Math.round((total_transaksi / uniqueDays) * 10) / 10 : 0;
  var avg_customer_payment = total_transaksi > 0 ? Math.round(total_customer_payment / total_transaksi) : 0;

  var setoranSheetData = DatabaseService.getSheetData("Master_Setoran");
  var avg_settlement = 0;
  if (setoranSheetData && setoranSheetData.length > 1) {
    var sHead = setoranSheetData[0];
    var validSetCount = 0;
    var validSetSum = 0;
    for (var sIdx = 1; sIdx < setoranSheetData.length; sIdx++) {
      var sRow = rowToObject_(sHead, setoranSheetData[sIdx]);
      if (sRow.status !== "DITOLAK") {
        validSetCount++;
        validSetSum += Number(sRow.total_setoran_owner) || 0;
      }
    }
    if (validSetCount > 0) avg_settlement = Math.round(validSetSum / validSetCount);
  }

  var chartDates = Object.keys(dailyChartMap).sort();
  var daily_transactions = chartDates.map(function(d) {
    return { date: d, total: dailyChartMap[d].total, express: dailyChartMap[d].express, cargo: dailyChartMap[d].cargo };
  });
  var daily_revenue = chartDates.map(function(d) {
    return { date: d, omset: dailyChartMap[d].omset, setoran: dailyChartMap[d].setoran, kas: dailyChartMap[d].kas };
  });

  var express_vs_cargo = [
    { name: "Express", value: total_express },
    { name: "Cargo", value: total_cargo }
  ];

  var setDistMap = { "DISETUJUI": 0, "MENUNGGU_APPROVAL": 0, "DITOLAK": 0, "BELUM_ADA_SETORAN": 0 };
  filtered.forEach(function(r) {
    setDistMap[r.settlement_status] = (setDistMap[r.settlement_status] || 0) + 1;
  });
  var settlement_status_chart = [
    { name: "Disetujui", value: setDistMap["DISETUJUI"] },
    { name: "Menunggu Approval", value: setDistMap["MENUNGGU_APPROVAL"] },
    { name: "Ditolak", value: setDistMap["DITOLAK"] },
    { name: "Belum Ada Setoran", value: setDistMap["BELUM_ADA_SETORAN"] }
  ];

  return {
    status: "success",
    data: {
      summary: {
        total_transaksi: total_transaksi,
        total_express: total_express,
        total_cargo: total_cargo,
        total_customer_payment: total_customer_payment,
        total_yoyi: total_yoyi,
        total_setoran_owner: total_setoran_owner,
        total_kas_operasional: total_kas_operasional,
        total_selisih: total_customer_payment - total_yoyi
      },
      daily_report: daily_report,
      outlet_report: outlet_report,
      operator_report: operator_report,
      audit_summary: {
        total_transaksi: total_transaksi,
        total_audited: filtered.filter(function(r){ return r.audit_status !== "BELUM_DIAUDIT"; }).length,
        sesuai: filtered.filter(function(r){ return r.audit_status === "SESUAI"; }).length,
        selisih: filtered.filter(function(r){ return r.audit_status === "SELISIH"; }).length,
        perlu_review: filtered.filter(function(r){ return r.audit_status === "PERLU_REVIEW"; }).length,
        belum_diaudit: filtered.filter(function(r){ return r.audit_status === "BELUM_DIAUDIT"; }).length
      },
      analytics: {
        highest_outlet: highest_outlet,
        highest_operator: highest_operator,
        highest_revenue_date: highest_revenue_date,
        avg_transactions_per_day: avg_transactions_per_day,
        avg_customer_payment: avg_customer_payment,
        avg_settlement: avg_settlement
      },
      charts: {
        daily_transactions: daily_transactions,
        daily_revenue: daily_revenue,
        express_vs_cargo: express_vs_cargo,
        settlement_status: settlement_status_chart
      }
    }
  };
}

function apiGetReportingTransactions(params) {
  var raw = apiGetReportingRawTransactions_();
  var filtered = filterReportingTransactions_(raw, params);
  return { status: "success", data: filtered };
}

function apiGetReportingSettlement(params) {
  params = params || {};
  var start = params.date_start || params.dateStart || "";
  var end = params.date_end || params.dateEnd || "";
  var out = params.outlet_id || params.filterOutlet || "ALL";
  var stat = params.settlement_status || params.filterSettlementStatus || "ALL";

  var rows = DatabaseService.getSheetData("Master_Setoran");
  if (!rows || rows.length < 2) {
    return { status: "success", data: { summary: { total_records: 0, total_disetujui: 0, total_menunggu: 0, total_ditolak: 0, total_amount_disetujui: 0, total_amount_menunggu: 0 }, detail: [] } };
  }

  var headers = rows[0];
  var list = [];
  for (var i = 1; i < rows.length; i++) {
    var obj = rowToObject_(headers, rows[i]);
    if (out !== "ALL" && obj.outlet_id !== out) continue;
    if (stat !== "ALL" && obj.status !== stat) continue;
    if (start && obj.tanggal < start) continue;
    if (end && obj.tanggal > end) continue;
    list.push(obj);
  }

  var total_records = list.length;
  var total_disetujui = list.filter(function(s){ return s.status === "DISETUJUI"; }).length;
  var total_menunggu = list.filter(function(s){ return s.status === "MENUNGGU_APPROVAL"; }).length;
  var total_ditolak = list.filter(function(s){ return s.status === "DITOLAK"; }).length;
  var total_amount_disetujui = list.filter(function(s){ return s.status === "DISETUJUI"; }).reduce(function(acc, s){ return acc + (Number(s.total_setoran_owner) || 0); }, 0);
  var total_amount_menunggu = list.filter(function(s){ return s.status === "MENUNGGU_APPROVAL"; }).reduce(function(acc, s){ return acc + (Number(s.total_setoran_owner) || 0); }, 0);

  return {
    status: "success",
    data: {
      summary: {
        total_records: total_records,
        total_disetujui: total_disetujui,
        total_menunggu: total_menunggu,
        total_ditolak: total_ditolak,
        total_amount_disetujui: total_amount_disetujui,
        total_amount_menunggu: total_amount_menunggu
      },
      detail: list.reverse()
    }
  };
}

function apiGetReportingAudit(params) {
  var raw = apiGetReportingRawTransactions_();
  var filtered = filterReportingTransactions_(raw, params);

  var total_transaksi = filtered.length;
  var total_audited = filtered.filter(function(r){ return r.audit_status !== "BELUM_DIAUDIT"; }).length;
  var sesuai = filtered.filter(function(r){ return r.audit_status === "SESUAI"; }).length;
  var selisih = filtered.filter(function(r){ return r.audit_status === "SELISIH"; }).length;
  var perlu_review = filtered.filter(function(r){ return r.audit_status === "PERLU_REVIEW"; }).length;
  var belum_diaudit = filtered.filter(function(r){ return r.audit_status === "BELUM_DIAUDIT"; }).length;

  return {
    status: "success",
    data: {
      summary: {
        total_transaksi: total_transaksi,
        total_audited: total_audited,
        sesuai: sesuai,
        selisih: selisih,
        perlu_review: perlu_review,
        belum_diaudit: belum_diaudit
      },
      detail: filtered
    }
  };
}


// ==========================================
// UTILITIES & SYSTEM FUNCTIONS
// ==========================================

function findSheetCaseInsensitive_(ss, name) {
  if (!ss || !name) return null;
  var exactSheet = ss.getSheetByName(name);
  if (exactSheet) return exactSheet;

  var targetLower = name.toString().trim().toLowerCase();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sName = sheets[i].getName().toString().trim().toLowerCase();
    if (sName === targetLower) {
      try {
        sheets[i].setName(name);
      } catch (e) {
        Logger.log("Rename sheet error: " + e.toString());
      }
      return sheets[i];
    }
  }
  return null;
}

function getSpreadsheet_() {
  var ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    Logger.log("getActiveSpreadsheet error: " + e.toString());
  }
  if (!ss) {
    try {
      var propId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
      if (propId && propId.trim() !== "") {
        ss = SpreadsheetApp.openById(propId.trim());
      }
    } catch (e) {
      Logger.log("openById error: " + e.toString());
    }
  }
  if (!ss) {
    throw new Error(
      "Spreadsheet tidak terhubung! Pastikan Anda membuka Apps Script melalui menu Ekstensi > Apps Script di Google Sheets Anda. " +
      "Atau jika menggunakan Standalone Script (script.google.com), tambahkan 'SPREADSHEET_ID' di Project Settings > Script Properties."
    );
  }
  return ss;
}

/**
 * Mendapatkan sheet berdasarkan nama atau melempar error jika tidak ditemukan
 */
function getSheetByName(name) {
  var ss = getSpreadsheet_();
  var sheet = findSheetCaseInsensitive_(ss, name);
  if (!sheet) {
    initDatabaseSheets();
    sheet = findSheetCaseInsensitive_(ss, name);
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
    DatabaseService.appendAudit(userId, action, detail, outletId);
  } catch (e) {
    Logger.log("Audit log failed: " + e.toString());
  }
}

/**
 * Simulasi Hashing Password SHA-256 Sederhana di Apps Script
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
  return "hash_" + input; // Disamakan format hash simulasinya agar konsisten dengan server pre-seed
}

// ==========================================
// DATABASE SCHEMA — satu-satunya sumber kebenaran struktur sheet.
// Tambah kolom baru = tambah string ke array di bawah + naikkan DB_SCHEMA_VERSION.
// Jangan hapus/reorder kolom existing di sini — itu mengubah posisi index yang
// sudah dipakai kode lain (mis. getRange(row, N)).
// ==========================================
var DB_SCHEMA_VERSION = 11; // v11: tambah MASTER_PENGIRIMAN (Foundation Operasional Aktivitas Pengiriman)

var DB_SCHEMA = {
  // Kolom lama TIDAK BOLEH dihapus/direorder — hanya tambah di ujung kanan.
  Users: ["user_id", "username", "password_hash", "role", "outlet_id_home", "nama_lengkap", "status_aktif",
    "no_wa"],
  Outlets: ["outlet_id", "nama_outlet", "alamat_outlet", "target_resi_harian", "target_resi_bulanan",
    "kode_outlet", "no_wa_outlet", "latitude", "longitude", "radius_operasional", "status_aktif",
    "target_express", "target_cargo"],
  // Master_Customer: kolom lama dipertahankan (legacy fallback), kolom baru ditambah di kanan.
  Master_Customer: ["customer_id", "nama_pengirim", "no_hp", "alamat_pengirim", "outlet_id", "last_updated",
    "nama", "telepon", "created_at", "updated_at", "status"],
  Riwayat_Penerima: ["id", "customer_id", "nama_penerima", "no_hp_penerima", "alamat_penerima", "tanggal_terakhir_kirim"],
  PreInput_Backup: ["transaksi_id", "timestamp", "admin_id", "outlet_id_tugas", "nama_pengirim", "hp_pengirim",
    "alamat_pengirim", "nama_penerima", "hp_penerima", "alamat_penerima", "nama_barang", "berat_kg", "volume",
    "nilai_barang", "foto_paket_url", "status", "catatan_admin",
    "ekspedisi", "berat_timbangan", "panjang_cm", "lebar_cm", "tinggi_cm", "berat_volume", "dasar_berat",
    "foto_resi_url", "alamat_penerima_asli", "alamat_asli"],
  EXP_Resi: ["resi_id", "transaksi_id", "timestamp", "admin_id_pencatat", "outlet_id_input", "tipe_produk",
    "biaya_lain", "biaya_asuransi", "ongkir_dasar", "biaya_yoyi", "total_dibayar_customer", "pembulatan",
    "metode_bayar", "bukti_bayar_url", "biaya_amplop", "biaya_packing", "metode_bayar_tambahan",
    "bukti_tambahan_url", "grand_total", "setoran_ke_owner", "kas_operasional", "status_resi",
    "owner_audit_status", "owner_audit_note", "owner_audited_by", "owner_audited_at",
    "ekspedisi", "berat_timbangan", "panjang_cm", "lebar_cm", "tinggi_cm", "berat_volume", "dasar_berat", "berat_kg"],
  CRG_Resi: ["resi_id", "transaksi_id", "timestamp", "admin_id_pencatat", "outlet_id_input", "tipe_produk",
    "merk_motor", "cc_motor", "tahun_motor", "kelengkapan_motor", "biaya_asuransi", "ongkir_dasar", "biaya_jtc",
    "total_dibayar_customer", "pembulatan", "metode_bayar", "bukti_bayar_url", "biaya_amplop", "biaya_packing",
    "metode_bayar_tambahan", "bukti_tambahan_url", "grand_total", "setoran_ke_owner", "kas_operasional",
    "status_resi", "owner_audit_status", "owner_audit_note", "owner_audited_by", "owner_audited_at",
    "ekspedisi", "berat_timbangan", "panjang_cm", "lebar_cm", "tinggi_cm", "berat_volume", "dasar_berat", "berat_kg"],
  AuditLogs: ["log_id", "timestamp", "user_id", "aksi", "detail", "outlet_id"],
  MapsReviews: ["id", "outlet_id", "nama_outlet", "reviewer", "stars", "text", "timestamp", "status_analisis", "analisis"],
  Master_Setoran: ["setoran_id", "tanggal", "outlet_id", "outlet_name", "admin_pembuat", "jumlah_resi",
    "total_setoran_owner", "total_kas_outlet", "status", "created_at", "approved_at", "approved_by",
    "catatan_owner", "closing_status", "closing_at", "closing_by"],
  MASTER_KATEGORI_KEUANGAN: ["id", "jenis", "nama", "aktif", "urutan", "created_at", "updated_at", "created_by"],
  KEUANGAN_OUTLET: ["id", "tanggal", "outlet_id", "jenis", "kategori_id", "nominal", "deskripsi", "bukti_url",
    "dibuat_oleh", "created_at", "aktif"],
  // Sheet baru — belum ada di spreadsheet, akan dibuat oleh initializeDatabase().
  IMPORT_LOG: ["id", "created_at", "owner", "outlet_id", "outlet_name", "spreadsheet_id", "spreadsheet_name", "sheet_name",
    "total_preview", "total_new", "total_update", "total_skipped", "status", "completed_at", "frontend_version", "backend_version", "db_schema_version", "app_version"],
  MASTER_PENGIRIM: ["id", "customer_id", "nama", "telepon", "provinsi", "kabupaten", "kecamatan", "kelurahan",
    "kode_pos", "alamat", "jumlah_pengiriman", "tanggal_pertama", "tanggal_terakhir", "status",
    "created_at", "updated_at", "outlet_id_asal", "telepon_alternatif", "import_id"],
  MASTER_PENERIMA: ["id", "customer_id", "nama", "telepon", "provinsi", "kabupaten", "kecamatan", "kelurahan",
    "kode_pos", "alamat", "jumlah_diterima", "tanggal_pertama", "tanggal_terakhir", "status",
    "created_at", "updated_at", "outlet_id_asal", "telepon_alternatif", "import_id"],
  MASTER_TRANSAKSI: [
    "id", "created_at", "updated_at", "import_id", "outlet_id", "outlet_name",
    "admin_id", "admin_name", "tanggal_transaksi", "jam_transaksi", "no_resi",
    "ekspedisi", "tipe_produk", "pengirim_id", "penerima_id",
    "snapshot_nama_pengirim", "snapshot_hp_pengirim", "snapshot_alamat_pengirim",
    "snapshot_nama_penerima", "snapshot_hp_penerima", "snapshot_alamat_penerima",
    "nama_barang", "berat_barang", "volume_barang", "nilai_barang", "jumlah_paket",
    "metode_bayar", "ongkir_customer", "packing", "amplop", "biaya_lain",
    "total_customer", "ongkir_yoyi", "asuransi", "biaya_lain_yoyi",
    "wajib_setor_owner", "kas_outlet", "status_transaksi", "status_setoran",
    "status_audit", "status_sync", "sumber_data", "catatan"
  ],
  MASTER_PENGIRIMAN: [
    "id", "created_at", "updated_at", "transaksi_id", "import_id", "outlet_id", "outlet_name",
    "admin_id", "admin_name", "tanggal_pengiriman", "jam_pengiriman", "no_resi",
    "ekspedisi", "tipe_produk", "pengirim_id", "penerima_id",
    "snapshot_nama_pengirim", "snapshot_hp_pengirim", "snapshot_alamat_pengirim",
    "snapshot_nama_penerima", "snapshot_hp_penerima", "snapshot_alamat_penerima",
    "nama_barang", "berat_barang", "volume_barang", "nilai_barang", "jumlah_paket",
    "foto_barang", "foto_resi", "status_pengiriman", "status_pickup", "status_delivery",
    "status_sync", "sumber_data", "catatan"
  ],
  SystemSettings: ["key", "value"]
};


/**
 * Satu-satunya fungsi yang boleh dipakai untuk membuat/memperbaiki struktur database.
 * Aman dijalankan berulang kali (idempotent):
 * - Sheet belum ada  -> dibuat + header ditulis.
 * - Sheet sudah ada  -> kolom di DB_SCHEMA yang belum ada di header ditambahkan di
 *                       ujung kanan. Kolom & data existing TIDAK PERNAH disentuh/dihapus.
 * JALANKAN FUNGSI INI SEKALI dari editor Apps Script setelah deploy/update schema.
 */
function initializeDatabase() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    Logger.log("initializeDatabase lock wait failed: " + e.toString());
  }

  try {
    var ss = getSpreadsheet_();
    var versionSheet = getOrCreateVersionSheet_(ss);

    Object.keys(DB_SCHEMA).forEach(function (name) {
      syncSheetSchema_(ss, name, DB_SCHEMA[name]);
    });

    versionSheet.getRange(2, 1, 1, 2).setValues([[DB_SCHEMA_VERSION, new Date().toISOString()]]);
    Logger.log("initializeDatabase selesai. Schema version: " + DB_SCHEMA_VERSION);
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

// Alias supaya kode lama (getSheetByName -> initDatabaseSheets()) tetap jalan tanpa diubah.
function initDatabaseSheets() {
  initializeDatabase();
}

function getOrCreateVersionSheet_(ss) {
  var sheet = findSheetCaseInsensitive_(ss, "_SchemaVersion");
  if (!sheet) {
    try {
      sheet = ss.insertSheet("_SchemaVersion");
      sheet.appendRow(["schema_version", "last_migrated_at"]);
      sheet.appendRow([0, ""]);
      formatHeader_(sheet, 2);
    } catch (e) {
      sheet = findSheetCaseInsensitive_(ss, "_SchemaVersion");
      if (!sheet) throw e;
    }
  }
  return sheet;
}

function syncSheetSchema_(ss, name, headers) {
  var sheet = findSheetCaseInsensitive_(ss, name);
  if (!sheet) {
    try {
      sheet = ss.insertSheet(name);
      sheet.appendRow(headers);
      formatHeader_(sheet, headers.length);
      return;
    } catch (e) {
      Logger.log("syncSheetSchema_ insertSheet error for " + name + ": " + e.toString());
      sheet = findSheetCaseInsensitive_(ss, name);
      if (!sheet) return;
    }
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

function getColIndex_(sheet, headerName) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return headers.indexOf(headerName); // 0-based
}

function rowToObject_(headers, row) {
  var obj = {};
  headers.forEach(function (h, i) { obj[h] = row[i]; });
  return obj;
}

/**
 * Tester manual: pastikan semua sheet sama persis strukturnya dengan DB_SCHEMA.
 * Jalankan dari editor Apps Script, cek hasil di Logger.log / return value.
 */
function testSchemaIntegrity() {
  var ss = getSpreadsheet_();
  var pass = true;

  for (var key in DB_SCHEMA) {
    var sheet = findSheetCaseInsensitive_(ss, key);
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
        Logger.log("FAIL: Sheet '" + key + "' kolom ke-" + (i + 1) + " tidak cocok. Harap: " + expectedHeaders[i] + ", Aktual: " + actualHeaders[i]);
        match = false;
        pass = false;
        break;
      }
    }

    if (match) Logger.log("PASS: Sheet '" + key + "' OK.");
  }
  return pass ? "ALL PASS" : "SOME FAIL";
}
// ============================================================================
// PHASE 0: BUSINESS LAYER - REUSABLE HELPERS
// ============================================================================

/**
 * Helper to convert 2D sheet data to list of objects
 */
function sheetToObjects(sheetData2D) {
  if (!sheetData2D || sheetData2D.length < 2) return [];
  var headers = sheetData2D[0];
  var list = [];
  for (var i = 1; i < sheetData2D.length; i++) {
    list.push(rowToObject_(headers, sheetData2D[i]));
  }
  return list;
}

/**
 * Calculates generic dashboard summaries for any list of transactions.
 */
function calculateDashboardSummary(filteredTx) {
  var totalResiExpress = 0;
  var totalResiCargo = 0;
  var totalOmsetGlobal = 0;
  var totalSetoranOwner = 0;
  var totalKasOperasional = 0;

  for (var i = 0; i < filteredTx.length; i++) {
    var r = filteredTx[i];
    if (r.tipe_layanan === "Express") totalResiExpress++;
    if (r.tipe_layanan === "Cargo") totalResiCargo++;
    totalOmsetGlobal += Number(r.grand_total) || 0;
    totalSetoranOwner += Number(r.setoran_ke_owner) || 0;
    totalKasOperasional += Number(r.kas_operasional) || 0;
  }

  return {
    totalTransaksi: filteredTx.length,
    totalResiExpress: totalResiExpress,
    totalResiCargo: totalResiCargo,
    grandTotalCustomer: totalOmsetGlobal,
    total_omset: totalOmsetGlobal,
    totalWajibSetorOwner: totalSetoranOwner,
    total_setoran_owner: totalSetoranOwner,
    totalKasOutlet: totalKasOperasional,
    total_kas_operasional: totalKasOperasional
  };
}

/**
 * Aggregates transactions by Admin (Kasir).
 */
function calculateAdminSummary(filteredTx, dbUsersObjList) {
  var adminMap = {};
  for (var i = 0; i < filteredTx.length; i++) {
    var r = filteredTx[i];
    var adminId = r.admin_id_pencatat;
    if (!adminMap[adminId]) {
      var userName = adminId;
      for (var u = 0; u < dbUsersObjList.length; u++) {
        if (dbUsersObjList[u].user_id === adminId) {
          userName = dbUsersObjList[u].nama_lengkap;
          break;
        }
      }
      adminMap[adminId] = {
        admin_id: adminId,
        nama: userName,
        express: 0,
        cargo: 0,
        totalResi: 0,
        totalSetoranOwner: 0,
        kasOutlet: 0
      };
    }
    
    if (r.tipe_layanan === "Express") adminMap[adminId].express++;
    if (r.tipe_layanan === "Cargo") adminMap[adminId].cargo++;
    adminMap[adminId].totalResi++;
    adminMap[adminId].totalSetoranOwner += Number(r.setoran_ke_owner) || 0;
    adminMap[adminId].kasOutlet += Number(r.kas_operasional) || 0;
  }

  var list = [];
  for (var k in adminMap) {
    list.push(adminMap[k]);
  }
  list.sort(function(a, b) { return b.totalResi - a.totalResi; });
  return list;
}

/**
 * Aggregates transactions by Ekspedisi (Express vs Cargo).
 */
function calculateEkspedisiSummary(filteredTx) {
  var expressResi = 0, expressOmset = 0, expressSetoran = 0;
  var cargoResi = 0, cargoOmset = 0, cargoSetoran = 0;

  for (var i = 0; i < filteredTx.length; i++) {
    var r = filteredTx[i];
    if (r.tipe_layanan === "Express") {
      expressResi++;
      expressOmset += Number(r.grand_total) || 0;
      expressSetoran += Number(r.setoran_ke_owner) || 0;
    } else if (r.tipe_layanan === "Cargo") {
      cargoResi++;
      cargoOmset += Number(r.grand_total) || 0;
      cargoSetoran += Number(r.setoran_ke_owner) || 0;
    }
  }

  return {
    Express: { resi: expressResi, omset: expressOmset, setoran: expressSetoran },
    Cargo: { resi: cargoResi, omset: cargoOmset, setoran: cargoSetoran }
  };
}

/**
 * Calculates current daily target vs total target for an outlet or all outlets.
 */
function calculateTargetSummary(combinedTx, filterOutlet, dbOutletsObjList) {
  var todayStr = new Date().toISOString().split("T")[0];
  var currentResiToday = 0;
  
  for (var i = 0; i < combinedTx.length; i++) {
    var r = combinedTx[i];
    if (r.timestamp && r.timestamp.indexOf(todayStr) === 0) {
      if (!filterOutlet || filterOutlet === "ALL" || r.outlet_id_input === filterOutlet) {
        currentResiToday++;
      }
    }
  }

  var targetTotal = 0;
  if (filterOutlet && filterOutlet !== "ALL") {
    for (var j = 0; j < dbOutletsObjList.length; j++) {
      if (dbOutletsObjList[j].outlet_id === filterOutlet) {
        targetTotal = Number(dbOutletsObjList[j].target_resi_harian) || 50;
        break;
      }
    }
  } else {
    for (var k = 0; k < dbOutletsObjList.length; k++) {
      targetTotal += Number(dbOutletsObjList[k].target_resi_harian) || 50;
    }
  }

  return {
    target: targetTotal,
    current: currentResiToday
  };
}

/**
 * Validates a transaction for duplication.
 */
function validateTransaction(resiId, dbExpRaw, dbCrgRaw) {
  var upperResi = (resiId || "").trim().toUpperCase();
  for (var i = 1; i < dbExpRaw.length; i++) {
    if (dbExpRaw[i][0].toString().toUpperCase() === upperResi) return false;
  }
  for (var j = 1; j < dbCrgRaw.length; j++) {
    if (dbCrgRaw[j][0].toString().toUpperCase() === upperResi) return false;
  }
  return true;
}

/**
 * Filter transactions based on various criteria.
 */
function filterTransactions(combinedTx, filterOutlet, dateStart, dateEnd, filterTipeLayanan) {
  var filtered = [];
  var start = dateStart ? new Date(dateStart).getTime() : null;
  var end = dateEnd ? new Date(dateEnd).getTime() + 86400000 : null; // include the whole end day

  for (var i = 0; i < combinedTx.length; i++) {
    var r = combinedTx[i];
    var include = true;
    if (filterOutlet && filterOutlet !== "ALL" && r.outlet_id_input !== filterOutlet) include = false;
    if (filterTipeLayanan && filterTipeLayanan !== "ALL" && r.tipe_layanan !== filterTipeLayanan) include = false;
    if (start && new Date(r.timestamp).getTime() < start) include = false;
    if (end && new Date(r.timestamp).getTime() > end) include = false;

    if (include) {
      filtered.push(r);
    }
  }
  return filtered;
}

/**
 * Calculates 7-day graphic data.
 */
function calculateGrafik(combinedTx, filterOutlet) {
  var last7Days = [];
  for (var i = 6; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    var dateStr = d.toISOString().split("T")[0];
    var dayTotalResi = 0;
    var daySetoran = 0;
    
    for (var j = 0; j < combinedTx.length; j++) {
      var r = combinedTx[j];
      if (r.timestamp && r.timestamp.indexOf(dateStr) === 0) {
        if (!filterOutlet || filterOutlet === "ALL" || r.outlet_id_input === filterOutlet) {
          dayTotalResi++;
          daySetoran += Number(r.setoran_ke_owner) || 0;
        }
      }
    }
    last7Days.push({
      date: dateStr,
      resi: dayTotalResi,
      setoran: daySetoran
    });
  }
  return last7Days;
}

/**
 * Calculates setoran status.
 */
function calculateStatusSetoran(filteredTx, dbSetoranObjList, filterOutlet) {
  var setoranMap = {};
  for (var i = 0; i < filteredTx.length; i++) {
    var r = filteredTx[i];
    if (!r.timestamp) continue;
    var dateStr = r.timestamp.split("T")[0];
    
    if (!setoranMap[dateStr]) {
      var existingStatus = "Belum Disetor";
      for (var s = 0; s < dbSetoranObjList.length; s++) {
        var setoranObj = dbSetoranObjList[s];
        if (setoranObj.date === dateStr) {
          if (!filterOutlet || filterOutlet === "ALL" || setoranObj.outlet_id === r.outlet_id_input || setoranObj.outlet_id === filterOutlet) {
            existingStatus = setoranObj.status;
            break;
          }
        }
      }
      setoranMap[dateStr] = {
        date: dateStr,
        total_setoran: 0,
        status: existingStatus,
        transaksi: []
      };
    }
    
    setoranMap[dateStr].total_setoran += Number(r.setoran_ke_owner) || 0;
    setoranMap[dateStr].transaksi.push(r.resi_id);
  }
  
  var list = [];
  for (var k in setoranMap) {
    list.push(setoranMap[k]);
  }
  list.sort(function(a, b) { return new Date(b.date).getTime() - new Date(a.date).getTime(); });
  return list;
}


/**
 * Combines Express and Cargo transactions into one list and injects pengirim/penerima.
 */
function getCombinedTransactions(dbExpObjList, dbCrgObjList, dbPreInputObjList) {
  var combined = [];
  
  // Create a map for fast lookup of PreInput
  var preInputMap = {};
  for (var p = 0; p < dbPreInputObjList.length; p++) {
    preInputMap[dbPreInputObjList[p].transaksi_id] = dbPreInputObjList[p];
  }

  for (var i = 0; i < dbExpObjList.length; i++) {
    var r = dbExpObjList[i];
    if (r.status !== "BATAL" && r.status_resi !== "BATAL") {
      var pre = preInputMap[r.transaksi_id];
      r.tipe_layanan = "Express";
      r.pengirim = pre ? pre.nama_pengirim : "Umum";
      r.penerima = pre ? pre.nama_penerima : "Umum";
      combined.push(r);
    }
  }

  for (var j = 0; j < dbCrgObjList.length; j++) {
    var r2 = dbCrgObjList[j];
    if (r2.status !== "BATAL" && r2.status_resi !== "BATAL") {
      var pre2 = preInputMap[r2.transaksi_id];
      r2.tipe_layanan = "Cargo";
      r2.pengirim = pre2 ? pre2.nama_pengirim : "Umum";
      r2.penerima = pre2 ? pre2.nama_penerima : "Umum";
      combined.push(r2);
    }
  }

  return combined;
}

// ============================================================================
// PHASE 1: TRANSACTION ENGINE
// ============================================================================



/**
 * Mengupdate transaksi menggunakan TransactionService
 */
function apiUpdateTransaksi(params) {
  try {
    var result = TransactionService.updateTransaction(params.jenis_layanan, params.data);
    return { status: "success", message: "Transaksi berhasil diupdate!", data: result };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}


var DatabaseService = {
  getSheetData: function(sheetName) {
    return getSheetByName(sheetName).getDataRange().getValues();
  },
  
  updateRowByMultipleColumns: function(sheetName, searchCriteriaMap, updateDataMap) {
    var sheet = getSheetByName(sheetName);
    var data = sheet.getDataRange().getValues();
    
    // Find column indexes
    var keys = Object.keys(searchCriteriaMap);
    var colIdxs = {};
    for (var k = 0; k < keys.length; k++) {
       var idx = getColIndex_(sheet, keys[k]);
       if (idx === -1) return false;
       colIdxs[keys[k]] = idx;
    }
    
    var foundRow = -1;
    for (var i = 1; i < data.length; i++) {
      var match = true;
      for (var k = 0; k < keys.length; k++) {
         if (data[i][colIdxs[keys[k]]].toString() !== searchCriteriaMap[keys[k]].toString()) {
            match = false;
            break;
         }
      }
      if (match) {
        foundRow = i + 1;
        break;
      }
    }
    
    if (foundRow === -1) return false;
    
    var colUpdates = Object.keys(updateDataMap);
    for (var j = 0; j < colUpdates.length; j++) {
      var cName = colUpdates[j];
      var cIdx = getColIndex_(sheet, cName);
      if (cIdx !== -1) {
        sheet.getRange(foundRow, cIdx + 1).setValue(updateDataMap[cName]);
      }
    }
    return true;
  },
  insertRow: function(sheetName, rowDataMap) {
    var sheet = getSheetByName(sheetName);
    var schema = DB_SCHEMA[sheetName];
    var row = schema.map(function(col) { return rowDataMap[col] !== undefined ? rowDataMap[col] : ""; });
    sheet.insertRowAfter(1);
    sheet.getRange(2, 1, 1, row.length).setValues([row]);
  },
  
  appendRow: function(sheetName, rowDataMap) {
    var sheet = getSheetByName(sheetName);
    var schema = DB_SCHEMA[sheetName];
    var row = schema.map(function(col) { return rowDataMap[col] !== undefined ? rowDataMap[col] : ""; });
    sheet.appendRow(row);
  },
  
  updateRowByColumn: function(sheetName, searchColName, searchValue, updateDataMap) {
    var sheet = getSheetByName(sheetName);
    var data = sheet.getDataRange().getValues();
    var colIdx = getColIndex_(sheet, searchColName);
    if (colIdx === -1) return false;
    
    var foundRow = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][colIdx].toString().toUpperCase() === searchValue.toString().toUpperCase()) {
        foundRow = i + 1;
        break;
      }
    }
    
    if (foundRow === -1) return false;
    
    var colUpdates = Object.keys(updateDataMap);
    for (var j = 0; j < colUpdates.length; j++) {
      var cName = colUpdates[j];
      var cIdx = getColIndex_(sheet, cName);
      if (cIdx !== -1) {
        sheet.getRange(foundRow, cIdx + 1).setValue(updateDataMap[cName]);
      }
    }
    return true;
  },

  updateFullRowByColumn: function(sheetName, searchColName, searchValue, rowDataMap) {
     var sheet = getSheetByName(sheetName);
     var schema = DB_SCHEMA[sheetName];
     var data = sheet.getDataRange().getValues();
     var colIdx = getColIndex_(sheet, searchColName);
     if (colIdx === -1) return null;
     
     var foundRow = -1;
     var existingRowData = null;
     for (var i = 1; i < data.length; i++) {
       if (data[i][colIdx].toString().toUpperCase() === searchValue.toString().toUpperCase()) {
         foundRow = i + 1;
         existingRowData = data[i];
         break;
       }
     }
     if (foundRow === -1) return null;
     
     var mergedMap = {};
     schema.forEach(function(col, idx) {
       mergedMap[col] = existingRowData[idx];
     });
     for (var key in rowDataMap) {
       mergedMap[key] = rowDataMap[key];
     }
     
     var row = schema.map(function(col) { return mergedMap[col] !== undefined ? mergedMap[col] : ""; });
     sheet.getRange(foundRow, 1, 1, row.length).setValues([row]);
     return mergedMap;
  },
  
  findRowByColumn: function(sheetName, searchColName, searchValue) {
    var sheet = getSheetByName(sheetName);
    var schema = DB_SCHEMA[sheetName];
    var data = sheet.getDataRange().getValues();
    var colIdx = getColIndex_(sheet, searchColName);
    if (colIdx === -1) return null;
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][colIdx].toString().toUpperCase() === searchValue.toString().toUpperCase()) {
        var obj = {};
        for (var j = 0; j < schema.length; j++) {
           obj[schema[j]] = data[i][j];
        }
        return obj;
      }
    }
    return null;
  },
  
  appendAudit: function(userId, action, detail, outletId) {
    var logObj = {
      log_id: "LOG-" + new Date().getTime().toString().slice(-6),
      timestamp: new Date().toISOString(),
      user_id: userId || "SYSTEM",
      aksi: action,
      detail: detail,
      outlet_id: outletId || "OUT-001"
    };
    this.appendRow("AuditLogs", logObj);
  }
};

var LIFECYCLE_ORDER = {
  DRAFT: 10,
  WAITING_PAYMENT: 20,
  PAID: 30,
  READY_PICKUP: 40,
  PICKED_UP: 50,
  IN_TRANSIT: 60,
  DELIVERED: 70,
  CANCELLED: 99
};

function normalizeLifecycleStatus(statusStr) {
  if (!statusStr) return "DRAFT";
  var s = String(statusStr).trim().toUpperCase();
  if (s === "DRAFT" || s === "DRAFT (BELUM BAYAR)" || s === "PENCATATAN" || s === "PRE INPUT" || s === "PENDING") return "DRAFT";
  if (s === "WAITING_PAYMENT" || s === "SIAP DIBAYAR" || s === "SIAP BAYAR" || s === "BELUM BAYAR") return "WAITING_PAYMENT";
  if (s === "PAID" || s === "LUNAS" || s === "SELESAI" || s === "RESI & BAYAR") return "PAID";
  if (s === "READY_PICKUP" || s === "SIAP_PICKUP" || s === "MENUNGGU_PICKUP" || s === "SCANNER") return "READY_PICKUP";
  if (s === "PICKED_UP" || s === "SUDAH_PICKUP" || s === "PICKUP") return "PICKED_UP";
  if (s === "IN_TRANSIT" || s === "DALAM_PROSES" || s === "PROSES_KIRIM") return "IN_TRANSIT";
  if (s === "DELIVERED" || s === "SUDAH_DIKIRIM" || s === "SELESAI_DIKIRIM") return "DELIVERED";
  if (s === "CANCELLED" || s === "BATAL" || s === "FAILED") return "CANCELLED";
  return s;
}

function validateLifecycleTransition(currentStatus, targetStatus) {
  var curr = normalizeLifecycleStatus(currentStatus);
  var target = normalizeLifecycleStatus(targetStatus);

  if (curr === target) {
    return { valid: true, sameStatus: true };
  }

  if (curr === "DELIVERED") {
    return { valid: false, reason: "Transaksi yang sudah DELIVERED tidak dapat diubah lagi." };
  }

  if (curr === "CANCELLED") {
    return { valid: false, reason: "Transaksi yang sudah CANCELLED tidak dapat diubah lagi." };
  }

  if (target === "CANCELLED") {
    return { valid: true };
  }

  var currLvl = LIFECYCLE_ORDER[curr] || 10;
  var targetLvl = LIFECYCLE_ORDER[target] || 10;

  if (targetLvl < currLvl) {
    return { valid: false, reason: "Mundur status dari " + curr + " ke " + target + " tidak diperbolehkan." };
  }

  if (targetLvl - currLvl > 20) {
    return { valid: false, reason: "Transisi status dari " + curr + " ke " + target + " tidak valid! Harus mengikuti urutan progresif lifecycle." };
  }

  return { valid: true };
}

function autoUpsertMasterTransaksiAndPengiriman(params) {
  var txId = (params.transaksi_id || "").toString().trim();
  if (!txId) return { success: false, message: "transaksi_id wajib diisi" };

  var nowIso = new Date().toISOString();
  var dateStr = params.tanggal_transaksi || nowIso.split("T")[0];
  var timeStr = params.jam_transaksi || (nowIso.split("T")[1] ? nowIso.split("T")[1].slice(0, 8) : "00:00:00");

  var targetStatus = normalizeLifecycleStatus(params.status_transaksi || "DRAFT");

  var existingTx = DatabaseService.findRowByColumn("MASTER_TRANSAKSI", "id", txId);

  if (existingTx) {
    var transitionCheck = validateLifecycleTransition(existingTx.status_transaksi, targetStatus);
    if (!transitionCheck.valid) {
      Logger.log("[LIFECYCLE REJECTED] " + txId + ": " + transitionCheck.reason);
      return { success: false, message: transitionCheck.reason };
    }

    existingTx.updated_at = nowIso;
    if (!transitionCheck.sameStatus) {
      existingTx.status_transaksi = targetStatus;
    }

    if (params.no_resi) existingTx.no_resi = params.no_resi;
    if (params.ekspedisi) existingTx.ekspedisi = params.ekspedisi;
    if (params.tipe_produk) existingTx.tipe_produk = params.tipe_produk;
    if (params.pengirim_id) existingTx.pengirim_id = params.pengirim_id;
    if (params.penerima_id) existingTx.penerima_id = params.penerima_id;
    if (params.snapshot_nama_pengirim && !existingTx.snapshot_nama_pengirim) existingTx.snapshot_nama_pengirim = params.snapshot_nama_pengirim;
    if (params.snapshot_hp_pengirim && !existingTx.snapshot_hp_pengirim) existingTx.snapshot_hp_pengirim = params.snapshot_hp_pengirim;
    if (params.snapshot_alamat_pengirim && !existingTx.snapshot_alamat_pengirim) existingTx.snapshot_alamat_pengirim = params.snapshot_alamat_pengirim;
    if (params.snapshot_nama_penerima && !existingTx.snapshot_nama_penerima) existingTx.snapshot_nama_penerima = params.snapshot_nama_penerima;
    if (params.snapshot_hp_penerima && !existingTx.snapshot_hp_penerima) existingTx.snapshot_hp_penerima = params.snapshot_hp_penerima;
    if (params.snapshot_alamat_penerima && !existingTx.snapshot_alamat_penerima) existingTx.snapshot_alamat_penerima = params.snapshot_alamat_penerima;
    if (params.nama_barang) existingTx.nama_barang = params.nama_barang;
    if (params.berat_barang !== undefined) existingTx.berat_barang = Number(params.berat_barang);
    if (params.volume_barang) existingTx.volume_barang = params.volume_barang;
    if (params.nilai_barang !== undefined) existingTx.nilai_barang = Number(params.nilai_barang);
    if (params.metode_bayar) existingTx.metode_bayar = params.metode_bayar;
    if (params.ongkir_customer !== undefined) existingTx.ongkir_customer = Number(params.ongkir_customer);
    if (params.packing !== undefined) existingTx.packing = Number(params.packing);
    if (params.amplop !== undefined) existingTx.amplop = Number(params.amplop);
    if (params.biaya_lain !== undefined) existingTx.biaya_lain = Number(params.biaya_lain);
    if (params.total_customer !== undefined) existingTx.total_customer = Number(params.total_customer);
    if (params.ongkir_yoyi !== undefined) existingTx.ongkir_yoyi = Number(params.ongkir_yoyi);
    if (params.asuransi !== undefined) existingTx.asuransi = Number(params.asuransi);
    if (params.biaya_lain_yoyi !== undefined) existingTx.biaya_lain_yoyi = Number(params.biaya_lain_yoyi);
    if (params.wajib_setor_owner !== undefined) existingTx.wajib_setor_owner = Number(params.wajib_setor_owner);
    if (params.kas_outlet !== undefined) existingTx.kas_outlet = Number(params.kas_outlet);
    if (params.status_setoran) existingTx.status_setoran = params.status_setoran;
    if (params.status_audit) existingTx.status_audit = params.status_audit;
    if (params.sumber_data) existingTx.sumber_data = params.sumber_data;
    if (params.catatan) existingTx.catatan = params.catatan;

    DatabaseService.updateRowByColumn("MASTER_TRANSAKSI", "id", txId, existingTx);
  } else {
    var txObj = {
      id: txId,
      created_at: nowIso,
      updated_at: nowIso,
      import_id: params.import_id || "",
      outlet_id: params.outlet_id || "OUT-001",
      outlet_name: params.outlet_name || "",
      admin_id: params.admin_id || "SYSTEM",
      admin_name: params.admin_name || "",
      tanggal_transaksi: dateStr,
      jam_transaksi: timeStr,
      no_resi: params.no_resi || "",
      ekspedisi: params.ekspedisi || "Express",
      tipe_produk: params.tipe_produk || "",
      pengirim_id: params.pengirim_id || "",
      penerima_id: params.penerima_id || "",
      snapshot_nama_pengirim: params.snapshot_nama_pengirim || "",
      snapshot_hp_pengirim: params.snapshot_hp_pengirim || "",
      snapshot_alamat_pengirim: params.snapshot_alamat_pengirim || "",
      snapshot_nama_penerima: params.snapshot_nama_penerima || "",
      snapshot_hp_penerima: params.snapshot_hp_penerima || "",
      snapshot_alamat_penerima: params.snapshot_alamat_penerima || "",
      nama_barang: params.nama_barang || "",
      berat_barang: Number(params.berat_barang) || 0,
      volume_barang: params.volume_barang || "0 x 0 x 0",
      nilai_barang: Number(params.nilai_barang) || 0,
      jumlah_paket: Number(params.jumlah_paket) || 1,
      metode_bayar: params.metode_bayar || "",
      ongkir_customer: Number(params.ongkir_customer) || 0,
      packing: Number(params.packing) || 0,
      amplop: Number(params.amplop) || 0,
      biaya_lain: Number(params.biaya_lain) || 0,
      total_customer: Number(params.total_customer) || 0,
      ongkir_yoyi: Number(params.ongkir_yoyi) || 0,
      asuransi: Number(params.asuransi) || 0,
      biaya_lain_yoyi: Number(params.biaya_lain_yoyi) || 0,
      wajib_setor_owner: Number(params.wajib_setor_owner) || 0,
      kas_outlet: Number(params.kas_outlet) || 0,
      status_transaksi: targetStatus,
      status_setoran: params.status_setoran || "PENDING",
      status_audit: params.status_audit || "PENDING",
      status_sync: params.status_sync || "LOCAL",
      sumber_data: params.sumber_data || "Pre Input",
      catatan: params.catatan || ""
    };
    DatabaseService.appendRow("MASTER_TRANSAKSI", txObj);
  }

  var shipStatus = targetStatus;
  var pickupStatus = "BELUM_PICKUP";
  var deliveryStatus = "BELUM_DIKIRIM";

  if (targetStatus === "READY_PICKUP") {
    pickupStatus = "SIAP_PICKUP";
  } else if (targetStatus === "PICKED_UP") {
    pickupStatus = "PICKED_UP";
  } else if (targetStatus === "IN_TRANSIT") {
    pickupStatus = "PICKED_UP";
    deliveryStatus = "DALAM_PROSES";
  } else if (targetStatus === "DELIVERED") {
    pickupStatus = "PICKED_UP";
    deliveryStatus = "DELIVERED";
  } else if (targetStatus === "CANCELLED") {
    pickupStatus = "BATAL";
    deliveryStatus = "BATAL";
  }

  if (params.status_pengiriman) shipStatus = params.status_pengiriman;
  if (params.status_pickup) pickupStatus = params.status_pickup;
  if (params.status_delivery) deliveryStatus = params.status_delivery;

  // DUPLICATE PROTECTION: 1 transaksi = 1 row in MASTER_PENGIRIMAN
  try {
    var existingShip = DatabaseService.findRowByColumn("MASTER_PENGIRIMAN", "transaksi_id", txId);
    if (existingShip) {
      existingShip.updated_at = nowIso;
      existingShip.status_pengiriman = shipStatus;
      existingShip.status_pickup = pickupStatus;
      existingShip.status_delivery = deliveryStatus;

      if (params.no_resi) existingShip.no_resi = params.no_resi;
      if (params.ekspedisi) existingShip.ekspedisi = params.ekspedisi;
      if (params.tipe_produk) existingShip.tipe_produk = params.tipe_produk;
      if (params.pengirim_id) existingShip.pengirim_id = params.pengirim_id;
      if (params.penerima_id) existingShip.penerima_id = params.penerima_id;
      if (params.nama_barang) existingShip.nama_barang = params.nama_barang;
      if (params.berat_barang !== undefined) existingShip.berat_barang = Number(params.berat_barang);
      if (params.volume_barang) existingShip.volume_barang = params.volume_barang;
      if (params.nilai_barang !== undefined) existingShip.nilai_barang = Number(params.nilai_barang);
      if (params.foto_barang !== undefined) existingShip.foto_barang = params.foto_barang || "";
      if (params.foto_resi !== undefined) existingShip.foto_resi = params.foto_resi || "";
      if (params.catatan) existingShip.catatan = params.catatan;

      DatabaseService.updateRowByColumn("MASTER_PENGIRIMAN", "transaksi_id", txId, existingShip);
    } else {
      var shipObj = {
        id: "SHIP-" + new Date().getTime(),
        created_at: nowIso,
        updated_at: nowIso,
        transaksi_id: txId,
        import_id: params.import_id || "",
        outlet_id: params.outlet_id || "OUT-001",
        outlet_name: params.outlet_name || "",
        admin_id: params.admin_id || "SYSTEM",
        admin_name: params.admin_name || "",
        tanggal_pengiriman: dateStr,
        jam_pengiriman: timeStr,
        no_resi: params.no_resi || "",
        ekspedisi: params.ekspedisi || "Express",
        tipe_produk: params.tipe_produk || "",
        pengirim_id: params.pengirim_id || "",
        penerima_id: params.penerima_id || "",
        snapshot_nama_pengirim: params.snapshot_nama_pengirim || "",
        snapshot_hp_pengirim: params.snapshot_hp_pengirim || "",
        snapshot_alamat_pengirim: params.snapshot_alamat_pengirim || "",
        snapshot_nama_penerima: params.snapshot_nama_penerima || "",
        snapshot_hp_penerima: params.snapshot_hp_penerima || "",
        snapshot_alamat_penerima: params.snapshot_alamat_penerima || "",
        nama_barang: params.nama_barang || "",
        berat_barang: Number(params.berat_barang) || 0,
        volume_barang: params.volume_barang || "0 x 0 x 0",
        nilai_barang: Number(params.nilai_barang) || 0,
        jumlah_paket: Number(params.jumlah_paket) || 1,
        foto_barang: params.foto_barang || "",
        foto_resi: params.foto_resi || "",
        status_pengiriman: shipStatus,
        status_pickup: pickupStatus,
        status_delivery: deliveryStatus,
        status_sync: "LOCAL",
        sumber_data: params.sumber_data || "Pre Input",
        catatan: params.catatan || ""
      };
      DatabaseService.appendRow("MASTER_PENGIRIMAN", shipObj);
    }
  } catch (err) {
    var txRow = DatabaseService.findRowByColumn("MASTER_TRANSAKSI", "id", txId);
    if (txRow) {
      txRow.status_sync = "FAILED";
      txRow.catatan = (txRow.catatan ? txRow.catatan + " | " : "") + "ROLLBACK: OPERATIONAL_CREATION_FAILED";
      DatabaseService.updateRowByColumn("MASTER_TRANSAKSI", "id", txId, txRow);
    }
    return { success: false, message: "Gagal memperbarui MASTER_PENGIRIMAN. Rollback status_sync = FAILED." };
  }

  return { success: true, transaksi_id: txId };
}

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
     var setoranData = DatabaseService.getSheetData("Master_Setoran");
     if (!setoranData || setoranData.length < 2) return false;
     var headers = setoranData[0];
     var dateIdx = headers.indexOf("tanggal");
     var outletIdx = headers.indexOf("outlet_id");
     var statusIdx = headers.indexOf("status");
     
     if (dateIdx === -1 || outletIdx === -1 || statusIdx === -1) return false;
     
     for (var i = 1; i < setoranData.length; i++) {
        var sDate = setoranData[i][dateIdx].toString();
        var sOutlet = setoranData[i][outletIdx].toString();
        var sStatus = setoranData[i][statusIdx].toString();
        
        if (sDate === dateStr && sOutlet === outletId) {
           if (sStatus === "DISETUJUI" || sStatus === "MENUNGGU_APPROVAL") {
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
    
    var existingCst = params.hp_pengirim ? DatabaseService.findRowByColumn("Master_Customer", "no_hp", params.hp_pengirim) : null;
    var cstId = existingCst ? existingCst.customer_id : "CST-" + new Date().getTime().toString().slice(-5);
    
    if (params.hp_pengirim) {
      if (existingCst) {
        DatabaseService.updateRowByColumn("Master_Customer", "no_hp", params.hp_pengirim, {
          nama_pengirim: params.nama_pengirim,
          alamat_pengirim: params.alamat_pengirim,
          outlet_id: params.outlet_id_tugas,
          last_updated: nowStr,
          nama: params.nama_pengirim,
          telepon: params.hp_pengirim,
          updated_at: nowStr
        });
      } else {
        DatabaseService.appendRow("Master_Customer", {
          customer_id: cstId,
          nama_pengirim: params.nama_pengirim,
          no_hp: params.hp_pengirim,
          alamat_pengirim: params.alamat_pengirim,
          outlet_id: params.outlet_id_tugas,
          last_updated: nowStr,
          nama: params.nama_pengirim,
          telepon: params.hp_pengirim,
          created_at: nowStr,
          updated_at: nowStr,
          status: "AKTIF"
        });
      }
    }
    
    if (params.hp_penerima) {
      var existingRec = DatabaseService.findRowByColumn("Riwayat_Penerima", "no_hp_penerima", params.hp_penerima);
      if (existingRec) {
        DatabaseService.updateRowByColumn("Riwayat_Penerima", "no_hp_penerima", params.hp_penerima, {
          nama_penerima: params.nama_penerima,
          alamat_penerima: params.alamat_penerima,
          tanggal_terakhir_kirim: nowStr
        });
      } else {
        var recId = "REC-" + new Date().getTime().toString().slice(-5) + Math.floor(Math.random() * 10);
        DatabaseService.appendRow("Riwayat_Penerima", {
          id: recId,
          customer_id: cstId,
          nama_penerima: params.nama_penerima,
          no_hp_penerima: params.hp_penerima,
          alamat_penerima: params.alamat_penerima,
          tanggal_terakhir_kirim: nowStr
        });
      }
    }
    
    DatabaseService.appendAudit(params.admin_id, "PREINPUT_SIMPAN", "Mencatat pre-input '" + params.nama_pengirim + "' ke '" + params.nama_penerima + "' (" + txId + ")", params.outlet_id_tugas);

    autoUpsertMasterTransaksiAndPengiriman({
      transaksi_id: txId,
      outlet_id: params.outlet_id_tugas,
      admin_id: params.admin_id,
      tanggal_transaksi: nowStr.split("T")[0],
      jam_transaksi: nowStr.split("T")[1] ? nowStr.split("T")[1].slice(0, 8) : "00:00:00",
      ekspedisi: params.ekspedisi,
      snapshot_nama_pengirim: params.nama_pengirim,
      snapshot_hp_pengirim: params.hp_pengirim,
      snapshot_alamat_pengirim: params.alamat_pengirim,
      snapshot_nama_penerima: params.nama_penerima,
      snapshot_hp_penerima: params.hp_penerima,
      snapshot_alamat_penerima: params.alamat_penerima,
      nama_barang: params.nama_barang,
      berat_barang: params.berat_kg,
      volume_barang: params.volume,
      nilai_barang: params.nilai_barang,
      foto_barang: params.foto_paket_url || "",
      status_transaksi: "PENDING",
      sumber_data: "Pre Input",
      catatan: params.catatan_admin
    });
    
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
    var txDate = timestamp.split("T")[0];
    
    if (this.checkTransactionLock(txDate, data.outlet_id_input)) {
      throw new Error("Setoran harian untuk tanggal ini sudah dibuat. Hubungi Owner apabila transaksi tersebut memang harus dimasukkan ke dalam setoran.");
    }

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

    autoUpsertMasterTransaksiAndPengiriman({
      transaksi_id: transId,
      outlet_id: data.outlet_id_input,
      admin_id: data.admin_id_pencatat,
      tanggal_transaksi: txDate,
      jam_transaksi: timestamp.split("T")[1] ? timestamp.split("T")[1].slice(0, 8) : "00:00:00",
      no_resi: resiId,
      ekspedisi: data.ekspedisi || jenisLayanan,
      tipe_produk: data.tipe_produk,
      snapshot_nama_pengirim: data.nama_pengirim,
      snapshot_hp_pengirim: data.hp_pengirim,
      snapshot_alamat_pengirim: data.alamat_pengirim,
      snapshot_nama_penerima: data.nama_penerima,
      snapshot_hp_penerima: data.hp_penerima,
      snapshot_alamat_penerima: data.alamat_penerima,
      nama_barang: data.nama_barang,
      berat_barang: Number(data.berat_kg) || 0,
      volume_barang: data.volume || "0 x 0 x 0",
      nilai_barang: Number(data.nilai_barang) || 0,
      metode_bayar: data.metode_bayar,
      ongkir_customer: Number(data.ongkir_dasar) || 0,
      packing: Number(data.biaya_packing) || 0,
      amplop: Number(data.biaya_amplop) || 0,
      biaya_lain: Number(data.biaya_lain) || 0,
      total_customer: Number(data.total_dibayar_customer) || Number(fin.grand_total) || 0,
      ongkir_yoyi: Number(data.biaya_yoyi) || 0,
      asuransi: Number(data.biaya_asuransi) || 0,
      biaya_lain_yoyi: Number(data.biaya_jtc) || 0,
      wajib_setor_owner: Number(fin.setoran_ke_owner) || 0,
      kas_outlet: Number(fin.kas_operasional) || 0,
      foto_barang: data.foto_paket_url || "",
      foto_resi: data.foto_resi_url || "",
      status_transaksi: "SELESAI",
      sumber_data: "Resi & Bayar"
    });
    
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



function apiGetAuditData(params) {
  var outletId = params.outlet_id;
  var dateStart = params.date_start;
  var dateEnd = params.date_end;
  
  var expData = DatabaseService.getSheetData("EXP_Resi");
  var crgData = DatabaseService.getSheetData("CRG_Resi");
  var outData = DatabaseService.getSheetData("Outlets");
  var usrData = DatabaseService.getSheetData("Users");
  var setoranData = DatabaseService.getSheetData("Master_Setoran");
  
  var outMap = {};
  if (outData && outData.length > 0) {
    for (var o = 1; o < outData.length; o++) outMap[outData[o][0].toString()] = outData[o][1].toString();
  }
  var usrMap = {};
  if (usrData && usrData.length > 0) {
    for (var u = 1; u < usrData.length; u++) usrMap[usrData[u][0].toString()] = usrData[u][1].toString();
  }
  
  // Build map of tx date + outlet -> setoran status
  var setoranStatusMap = {}; // key: "YYYY-MM-DD_OUTLET", value: status
  if (setoranData && setoranData.length > 0) {
    var sHeaders = setoranData[0];
    for (var s = 1; s < setoranData.length; s++) {
      var sObj = rowToObject_(sHeaders, setoranData[s]);
      if (sObj.status !== "DITOLAK") {
        setoranStatusMap[sObj.tanggal + "_" + sObj.outlet_id] = sObj.status;
      }
    }
  }

  var list = [];
  
  if (expData && expData.length > 1) {
    var hExp = expData[0];
    for (var i = 1; i < expData.length; i++) {
      var tx = rowToObject_(hExp, expData[i]);
      if (tx.status_resi === "BATAL") continue;
      
      var txDate = tx.timestamp.split("T")[0];
      if (outletId && outletId !== "ALL" && tx.outlet_id_input !== outletId) continue;
      if (dateStart && txDate < dateStart) continue;
      if (dateEnd && txDate > dateEnd) continue;
      
      var sStatus = setoranStatusMap[txDate + "_" + tx.outlet_id_input] || "BELUM_SETORAN";
      
      var totalCust = Number(tx.total_dibayar_customer) || 0;
      var yoyi = Number(tx.biaya_yoyi) || 0;
      var selisih = totalCust - yoyi;
      
      var auditStatus = "BELUM_DIAUDIT";
      if (tx.owner_audit_status) {
         auditStatus = tx.owner_audit_status;
      } else if (sStatus === "DISETUJUI") {
         if (totalCust === 0) auditStatus = "PERLU_REVIEW";
         else if (selisih < 0) auditStatus = "SELISIH";
         else auditStatus = "SESUAI";
      }
      
      list.push({
        resi_id: tx.resi_id,
        outlet_id: tx.outlet_id_input,
        outlet_name: outMap[tx.outlet_id_input] || tx.outlet_id_input,
        admin: usrMap[tx.admin_id_pencatat] || tx.admin_id_pencatat,
        customer: tx.transaksi_id, // we use transaksi_id as proxy for customer
        tipe: "Express",
        total_customer: totalCust,
        total_yoyi: yoyi,
        setoran_owner: Number(tx.setoran_ke_owner) || 0,
        kas_operasional: Number(tx.kas_operasional) || 0,
        selisih: selisih,
        audit_status: auditStatus,
        audit_note: tx.owner_audit_note || "",
        audited_by: tx.owner_audited_by || "",
        timestamp: tx.timestamp
      });
    }
  }
  
  if (crgData && crgData.length > 1) {
    var hCrg = crgData[0];
    for (var j = 1; j < crgData.length; j++) {
      var tc = rowToObject_(hCrg, crgData[j]);
      if (tc.status_resi === "BATAL") continue;
      
      var tcDate = tc.timestamp.split("T")[0];
      if (outletId && outletId !== "ALL" && tc.outlet_id_input !== outletId) continue;
      if (dateStart && tcDate < dateStart) continue;
      if (dateEnd && tcDate > dateEnd) continue;
      
      var sStatusC = setoranStatusMap[tcDate + "_" + tc.outlet_id_input] || "BELUM_SETORAN";
      
      var cTotalCust = Number(tc.total_dibayar_customer) || 0;
      var jtc = Number(tc.biaya_jtc) || 0;
      var cSelisih = cTotalCust - jtc;
      
      var cAuditStatus = "BELUM_DIAUDIT";
      if (tc.owner_audit_status) {
         cAuditStatus = tc.owner_audit_status;
      } else if (sStatusC === "DISETUJUI") {
         if (cTotalCust === 0) cAuditStatus = "PERLU_REVIEW";
         else if (cSelisih < 0) cAuditStatus = "SELISIH";
         else cAuditStatus = "SESUAI";
      }
      
      list.push({
        resi_id: tc.resi_id,
        outlet_id: tc.outlet_id_input,
        outlet_name: outMap[tc.outlet_id_input] || tc.outlet_id_input,
        admin: usrMap[tc.admin_id_pencatat] || tc.admin_id_pencatat,
        customer: tc.transaksi_id,
        tipe: "Cargo",
        total_customer: cTotalCust,
        total_yoyi: jtc,
        setoran_owner: Number(tc.setoran_ke_owner) || 0,
        kas_operasional: Number(tc.kas_operasional) || 0,
        selisih: cSelisih,
        audit_status: cAuditStatus,
        audit_note: tc.owner_audit_note || "",
        audited_by: tc.owner_audited_by || "",
        timestamp: tc.timestamp
      });
    }
  }
  
  list.sort(function(a, b) {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  
  var summary = {
    total_transaksi: list.length,
    total_express: list.filter(function(x) { return x.tipe === "Express"; }).length,
    total_cargo: list.filter(function(x) { return x.tipe === "Cargo"; }).length,
    total_setoran_owner: list.reduce(function(acc, val) { return acc + val.setoran_owner; }, 0),
    total_kas_operasional: list.reduce(function(acc, val) { return acc + val.kas_operasional; }, 0),
    total_customer_payment: list.reduce(function(acc, val) { return acc + val.total_customer; }, 0),
    total_yoyi: list.reduce(function(acc, val) { return acc + val.total_yoyi; }, 0),
    total_selisih: list.reduce(function(acc, val) { return acc + val.selisih; }, 0)
  };

  return { status: "success", data: { summary: summary, detail: list } };
}



function apiUpdateAuditDecision(params) {
  var resiId = params.resi_id;
  var auditStatus = params.audit_status;
  var auditNote = params.audit_note || "";
  var ownerId = params.owner_id || "OWNER";
  
  if (!resiId || !auditStatus) {
    return { status: "error", message: "resi_id dan audit_status diperlukan" };
  }
  
  var expRow = DatabaseService.findRowByColumn("EXP_Resi", "resi_id", resiId);
  var crgRow = DatabaseService.findRowByColumn("CRG_Resi", "resi_id", resiId);
  
  var targetSheet = expRow ? "EXP_Resi" : (crgRow ? "CRG_Resi" : null);
  var existingTx = expRow || crgRow;
  
  if (!targetSheet) {
    return { status: "error", message: "Data transaksi tidak ditemukan" };
  }
  
  var sheet = getSheetByName(targetSheet);
  var headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  if (headers.indexOf("owner_audit_status") === -1) {
    sheet.getRange(1, headers.length + 1).setValue("owner_audit_status");
    sheet.getRange(1, headers.length + 2).setValue("owner_audit_note");
    sheet.getRange(1, headers.length + 3).setValue("owner_audited_by");
    sheet.getRange(1, headers.length + 4).setValue("owner_audited_at");
  }
  
  var updateData = {
    owner_audit_status: auditStatus,
    owner_audit_note: auditNote,
    owner_audited_by: ownerId,
    owner_audited_at: new Date().toISOString()
  };
  
  DatabaseService.updateRowByColumn(targetSheet, "resi_id", resiId, updateData);
  
  DatabaseService.appendAudit(
    ownerId,
    "AUDIT_DECISION",
    "Audit " + resiId + ": " + auditStatus,
    existingTx.outlet_id_input
  );
  
  return { status: "success", message: "Keputusan audit berhasil disimpan" };
}



function apiValidateClosing(params) {
  var closingDate = params.closing_date;
  var outletId = params.outlet_id;
  
  if (!closingDate || !outletId) {
    return { status: "error", message: "closing_date dan outlet_id diperlukan" };
  }
  
  var validations = [];
  var isSuccess = true;
  
  // Gather Setoran for this date and outlet
  var setoranData = DatabaseService.getSheetData("Master_Setoran");
  var setoranHeaders = setoranData[0];
  var relatedSetorans = [];
  var activeSetoran = null;
  
  if (setoranHeaders) {
    for (var i = 1; i < setoranData.length; i++) {
      var row = rowToObject_(setoranHeaders, setoranData[i]);
      if (row.tanggal === closingDate && row.outlet_id === outletId) {
        relatedSetorans.push(row);
        if (row.status !== "DITOLAK") {
          activeSetoran = row;
        }
      }
    }
  }
  
  // 1. Check if already closed
  if (activeSetoran && activeSetoran.closing_status === "CLOSED") {
    activeSetoran.total_transactions = activeSetoran.jumlah_resi;
    return { 
      status: "success", 
      is_valid: true,
      is_closed: true,
      message: "Hari ini sudah di-closing",
      data: activeSetoran
    };
  }
  
  var setoranDisetujui = relatedSetorans.filter(function(s) { return s.status === "DISETUJUI"; });
  var setoranMenunggu = relatedSetorans.filter(function(s) { return s.status === "MENUNGGU_APPROVAL"; });
  var setoranDitolak = relatedSetorans.filter(function(s) { return s.status === "DITOLAK"; });
  
  var expData = DatabaseService.getSheetData("EXP_Resi");
  var crgData = DatabaseService.getSheetData("CRG_Resi");
  var preInputData = DatabaseService.getSheetData("PreInput_Backup");
  var expHeaders = expData[0];
  var crgHeaders = crgData[0];
  var preHeaders = preInputData ? preInputData[0] : [];
  
  var activeTransactions = [];
  var resiSet = {};
  var duplicateResiCount = 0;
  
  var summary = {
    total_transactions: 0,
    total_customer_payment: 0,
    total_setoran_owner: 0,
    total_kas_operasional: 0,
    total_yoyi: 0,
    total_selisih: 0
  };

  var processTx = function(tx, tipe) {
    var txDate = tx.timestamp ? tx.timestamp.toString().split("T")[0] : "";
    if (txDate === closingDate && tx.outlet_id_input === outletId && tx.status_resi !== "BATAL") {
      activeTransactions.push(tx);
      
      summary.total_transactions++;
      summary.total_customer_payment += (Number(tx.total_dibayar_customer) || 0);
      summary.total_setoran_owner += (Number(tx.setoran_ke_owner) || 0);
      summary.total_kas_operasional += (Number(tx.kas_operasional) || 0);
      
      var yoyi = tipe === "EXP" ? (Number(tx.biaya_yoyi) || 0) : (Number(tx.biaya_jtc) || 0);
      summary.total_yoyi += yoyi;
      
      if (resiSet[tx.resi_id]) {
        duplicateResiCount++;
      } else {
        resiSet[tx.resi_id] = true;
      }
    }
  };

  if (expHeaders) {
    for (var i = 1; i < expData.length; i++) processTx(rowToObject_(expHeaders, expData[i]), "EXP");
  }
  if (crgHeaders) {
    for (var i = 1; i < crgData.length; i++) processTx(rowToObject_(crgHeaders, crgData[i]), "CRG");
  }
  
  summary.total_selisih = summary.total_customer_payment - summary.total_yoyi;

  if (activeTransactions.length > 0) {
    if (setoranDisetujui.length === 0 && setoranMenunggu.length === 0 && setoranDitolak.length === 0) {
      isSuccess = false;
      validations.push({ error: "Belum ada setoran yang dibuat untuk hari ini." });
    }
    if (setoranMenunggu.length > 0) {
      isSuccess = false;
      validations.push({ error: "Ada " + setoranMenunggu.length + " setoran yang masih menunggu approval owner." });
    }
    if (setoranDitolak.length > 0) {
      isSuccess = false;
      validations.push({ error: "Ada " + setoranDitolak.length + " setoran yang ditolak owner dan belum diselesaikan." });
    }
    // ensure active setoran is DISETUJUI
    if (activeSetoran && activeSetoran.status !== "DISETUJUI") {
       isSuccess = false;
       validations.push({ error: "Setoran untuk hari ini harus disetujui (DISETUJUI) sebelum closing." });
    }
  }

  if (duplicateResiCount > 0) {
    isSuccess = false;
    validations.push({ error: "Ditemukan " + duplicateResiCount + " resi ganda." });
  }

  var missingOp = 0, missingOutlet = 0, missingPayment = 0, missingCust = 0, invalidCalc = 0, invalidStatus = 0;

  for (var i = 0; i < activeTransactions.length; i++) {
    var tx = activeTransactions[i];
    if (!tx.admin_id_pencatat) missingOp++;
    if (!tx.outlet_id_input) missingOutlet++;
    if (!tx.metode_bayar) missingPayment++;
    if (!tx.status_resi) invalidStatus++;
    
    // valid calc check
    var bayar = Number(tx.total_dibayar_customer);
    var setoran = Number(tx.setoran_ke_owner);
    if (isNaN(bayar) || isNaN(setoran) || typeof tx.total_dibayar_customer === "undefined") {
      invalidCalc++;
    }
    
    // check customer info via PreInput
    var foundCust = false;
    if (preHeaders) {
      for (var p = 1; p < preInputData.length; p++) {
        var pre = rowToObject_(preHeaders, preInputData[p]);
        if (pre.transaksi_id === tx.transaksi_id) {
          if (!pre.nama_pengirim || !pre.nama_penerima) missingCust++;
          foundCust = true;
          break;
        }
      }
    }
    if (!foundCust) missingCust++; // if no preinput found, count as missing
  }

  if (missingOp > 0) { isSuccess = false; validations.push({ error: "Ditemukan " + missingOp + " transaksi tanpa operator." }); }
  if (missingOutlet > 0) { isSuccess = false; validations.push({ error: "Ditemukan " + missingOutlet + " transaksi tanpa outlet." }); }
  if (missingPayment > 0) { isSuccess = false; validations.push({ error: "Ditemukan " + missingPayment + " transaksi tanpa metode bayar." }); }
  if (missingCust > 0) { isSuccess = false; validations.push({ error: "Ditemukan " + missingCust + " transaksi tanpa data pelanggan (pengirim/penerima)." }); }
  if (invalidCalc > 0) { isSuccess = false; validations.push({ error: "Ditemukan " + invalidCalc + " transaksi dengan kalkulasi finansial tidak valid." }); }
  if (invalidStatus > 0) { isSuccess = false; validations.push({ error: "Ditemukan " + invalidStatus + " transaksi dengan status tidak valid." }); }

  return {
    status: "success",
    is_valid: isSuccess,
    is_closed: false,
    validations: validations,
    summary: summary,
    active_setoran_id: activeSetoran ? activeSetoran.setoran_id : null
  };
}

function apiExecuteClosing(params) {
  var ownerId = params.owner_id || "SYSTEM";
  var closingDate = params.closing_date;
  var outletId = params.outlet_id;
  
  if (!closingDate || !outletId) {
    return { status: "error", message: "closing_date dan outlet_id diperlukan" };
  }
  
  var valResult = apiValidateClosing(params);
  
  if (valResult.is_closed) {
    return { status: "error", message: "Hari ini sudah di-closing." };
  }
  
  if (!valResult.is_valid) {
    return { status: "error", message: "Validasi gagal. Selesaikan semua masalah sebelum closing." };
  }
  
  var activeSetoranId = valResult.active_setoran_id;
  if (!activeSetoranId) {
    return { status: "error", message: "Tidak ada setoran yang bisa di-closing." };
  }
  
  var updateData = {
    closing_status: "CLOSED",
    closing_at: new Date().toISOString(),
    closing_by: ownerId
  };
  
  DatabaseService.updateRowByColumn("Master_Setoran", "setoran_id", activeSetoranId, updateData);
  
  DatabaseService.appendAudit(
    ownerId,
    "DAILY_CLOSING",
    "Melakukan closing untuk tanggal " + closingDate + " pada setoran " + activeSetoranId,
    outletId
  );
  
  return { status: "success", message: "Closing harian berhasil diselesaikan.", data: Object.assign({ setoran_id: activeSetoranId }, updateData) };
}

// ==========================================
// PHASE 9 — AI AUDIT ASSISTANT (GAS ENGINE)
// ==========================================

function apiDailySummaryGAS(params) {
  var reportData = apiGetReportingSummary(params || {});
  var summary = reportData.data ? reportData.data.summary : {};
  
  var targetDate = (params && params.date) ? params.date : new Date().toISOString().split("T")[0];
  var omset = summary.total_omset_customer || 0;
  var setoran = summary.total_setoran_owner || 0;
  var count = summary.total_transaksi || 0;

  var text = "📊 **Ringkasan Operasional Hari Ini (" + targetDate + ")**:\n" +
    "• **Total Transaksi**: " + count + " resi (" + (summary.total_express || 0) + " Express, " + (summary.total_cargo || 0) + " Cargo)\n" +
    "• **Total Omset Customer**: Rp " + Number(omset).toLocaleString("id-ID") + "\n" +
    "• **Total Setoran Owner**: Rp " + Number(setoran).toLocaleString("id-ID") + "\n" +
    "• **Total Kas Operasional**: Rp " + Number(summary.total_kas_operasional || 0).toLocaleString("id-ID");

  return {
    status: "success",
    data: {
      date: targetDate,
      summary_text: text,
      metrics: {
        total_transaksi: count,
        express: summary.total_express || 0,
        cargo: summary.total_cargo || 0,
        omset: omset,
        setoran_owner: setoran,
        pending_settlements: 0,
        audit_review_count: 0
      },
      timestamp: new Date().toISOString()
    }
  };
}

function apiDetectAnomaliesGAS(params) {
  var setoranRaw = DatabaseService.getSheetData("Master_Setoran") || [];
  var setorans = sheetToObjects(setoranRaw);
  var pendingList = setorans.filter(function(s) { return s.status === "MENUNGGU_APPROVAL"; });
  var rejectedList = setorans.filter(function(s) { return s.status === "DITOLAK"; });

  var anomalies = [];
  var recommendations = [];

  if (rejectedList.length > 0) {
    anomalies.push({
      type: "SETORAN_DITOLAK",
      severity: "HIGH",
      title: rejectedList.length + " Setoran Ditolak Owner",
      description: "Terdapat setoran outlet yang telah ditolak oleh owner dan membutuhkan revisi ulang oleh kasir.",
      items: rejectedList.map(function(s) { return { setoran_id: s.setoran_id, outlet: s.outlet_name || s.outlet_id, total: s.total_setoran_owner, alasan: s.alasan_penolakan }; })
    });
    recommendations.push("Instruksikan kasir outlet untuk memperbaiki setoran yang ditolak.");
  }

  if (pendingList.length > 0) {
    anomalies.push({
      type: "SETORAN_PENDING",
      severity: "MEDIUM",
      title: pendingList.length + " Setoran Menunggu Approval",
      description: "Ada setoran harian outlet yang belum diverifikasi dan disetujui owner.",
      items: pendingList.map(function(s) { return { setoran_id: s.setoran_id, outlet: s.outlet_name || s.outlet_id, total: s.total_setoran_owner }; })
    });
    recommendations.push("Segera verifikasi setoran pending pada menu Persetujuan Setoran.");
  }

  if (recommendations.length === 0) {
    recommendations.push("Seluruh operasional berjalan normal. Tidak ditemukan anomali signifikan.");
  }

  return {
    status: "success",
    data: {
      anomalies: anomalies,
      recommendations: recommendations,
      timestamp: new Date().toISOString()
    }
  };
}

function apiAskAssistantGAS(params) {
  var question = (params && params.question) ? params.question.trim() : "";
  if (!question) {
    return { status: "error", message: "Pertanyaan tidak boleh kosong." };
  }

  var reportData = apiGetReportingSummary({});
  var summary = reportData.data ? reportData.data.summary : {};
  var qLower = question.toLowerCase();
  var answer = "";

  if (qLower.indexOf("omset") !== -1) {
    answer = "Total omset customer terdaftar saat ini adalah Rp " + Number(summary.total_omset_customer || 0).toLocaleString("id-ID") + ". (Dihitung dari seluruh resi Express & Cargo aktif).";
  } else if (qLower.indexOf("transaksi") !== -1 || qLower.indexOf("resi") !== -1) {
    answer = "Total transaksi terdaftar: " + (summary.total_transaksi || 0) + " resi (" + (summary.total_express || 0) + " Express, " + (summary.total_cargo || 0) + " Cargo).";
  } else if (qLower.indexOf("setoran") !== -1) {
    answer = "Total setoran owner terakumulasi: Rp " + Number(summary.total_setoran_owner || 0).toLocaleString("id-ID") + ".";
  } else {
    answer = "Berdasarkan data operasional: Total transaksi " + (summary.total_transaksi || 0) + " resi dengan total omset Rp " + Number(summary.total_omset_customer || 0).toLocaleString("id-ID") + ".";
  }

  return {
    status: "success",
    data: {
      question: question,
      answer: answer,
      timestamp: new Date().toISOString(),
      suggested_questions: [
        "Berapa total omset hari ini?",
        "Siapa operator paling aktif minggu ini?",
        "Outlet mana yang memiliki omset tertinggi?",
        "Apakah ada setoran yang belum disetujui?"
      ]
    }
  };
}

// ==========================================
// MASTER KATEGORI KEUANGAN
// ==========================================

function apiGetKategoriKeuangan() {
  try {
    ensureDefaultKategoriKeuangan_();
    var rows = DatabaseService.getSheetData("MASTER_KATEGORI_KEUANGAN");
    if (!rows || rows.length < 2) {
      return { status: "success", data: [] };
    }
    var headers = rows[0];
    var list = [];
    var seenIds = {};
    for (var i = 1; i < rows.length; i++) {
      var obj = rowToObject_(headers, rows[i]);
      if (!obj.id) continue;
      var idStr = obj.id.toString().trim();
      if (seenIds[idStr]) continue;
      seenIds[idStr] = true;
      var isAktif = obj.aktif === true || obj.aktif === "TRUE" || obj.aktif === "true" || obj.aktif === "Aktif";
      list.push({
        id: idStr,
        jenis: obj.jenis.toString(),
        nama: obj.nama.toString(),
        aktif: isAktif,
        urutan: Number(obj.urutan) || i,
        created_at: obj.created_at ? obj.created_at.toString() : "",
        updated_at: obj.updated_at ? obj.updated_at.toString() : "",
        created_by: obj.created_by ? obj.created_by.toString() : ""
      });
    }
    list.sort(function(a, b) { return a.urutan - b.urutan; });
    return { status: "success", data: list };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

function apiSaveKategoriKeuangan(params) {
  try {
    ensureDefaultKategoriKeuangan_();
    var nama = (params.nama || "").trim();
    var jenis = (params.jenis || "").trim().toUpperCase();
    var urutan = parseInt(params.urutan, 10);
    var createdBy = params.created_by || "OWNER";

    if (!nama) return { status: "error", message: "Nama kategori wajib diisi." };
    if (jenis !== "PEMASUKAN" && jenis !== "PENGELUARAN") {
      return { status: "error", message: "Jenis kategori harus PEMASUKAN atau PENGELUARAN." };
    }
    if (jenis === "PEMASUKAN" && (nama.toLowerCase() === "packing" || nama.toLowerCase() === "amplop")) {
      return { status: "error", message: "Kategori 'Packing' & 'Amplop' berasal dari transaksi paket dan tidak boleh dijadikan Pemasukan manual." };
    }

    var existingRes = apiGetKategoriKeuangan();
    var existingList = existingRes.data || [];

    var isDuplicate = existingList.some(function(item) {
      return item.jenis.toUpperCase() === jenis && item.nama.toLowerCase() === nama.toLowerCase();
    });
    if (isDuplicate) {
      return { status: "error", message: "Kategori '" + nama + "' sudah ada untuk " + jenis + "." };
    }

    if (isNaN(urutan)) {
      var sameJenisItems = existingList.filter(function(x) { return x.jenis.toUpperCase() === jenis; });
      urutan = sameJenisItems.length + 1;
    }

    var newId = "KAT-" + new Date().getTime().toString().slice(-6) + Math.floor(Math.random() * 100);
    var nowStr = new Date().toISOString();

    var rowObj = {
      id: newId,
      jenis: jenis,
      nama: nama,
      aktif: "TRUE",
      urutan: urutan,
      created_at: nowStr,
      updated_at: nowStr,
      created_by: createdBy
    };

    DatabaseService.appendRow("MASTER_KATEGORI_KEUANGAN", rowObj);
    return { status: "success", message: "Kategori berhasil ditambahkan.", data: rowObj };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

function apiUpdateKategoriKeuangan(params) {
  try {
    ensureDefaultKategoriKeuangan_();
    var id = (params.id || "").trim();
    var nama = (params.nama || "").trim();
    var urutan = parseInt(params.urutan, 10);
    var aktifVal = params.aktif;

    if (!id) return { status: "error", message: "ID kategori tidak ditemukan." };
    if (!nama) return { status: "error", message: "Nama kategori tidak boleh kosong." };

    var existingRes = apiGetKategoriKeuangan();
    var existingList = existingRes.data || [];
    var target = existingList.find(function(x) { return x.id === id; });

    if (!target) return { status: "error", message: "Kategori tidak ditemukan." };

    var targetJenis = (params.jenis || target.jenis || "").toString().toUpperCase();

    if ((nama.toLowerCase() === "packing" || nama.toLowerCase() === "amplop") && target.jenis) {
      if (target.jenis.toString().toUpperCase() === "PENGELUARAN") {
        targetJenis = "PENGELUARAN";
      }
    }

    var isChangingToRestrictedPemasukan = 
      targetJenis === "PEMASUKAN" &&
      (nama.toLowerCase() === "packing" || nama.toLowerCase() === "amplop") &&
      target.nama.toLowerCase() !== nama.toLowerCase();

    if (isChangingToRestrictedPemasukan) {
      return { status: "error", message: "Kategori 'Packing' & 'Amplop' berasal dari transaksi paket dan tidak boleh dijadikan Pemasukan manual." };
    }

    var isDuplicate = existingList.some(function(item) {
      return item.id !== id && item.jenis.toUpperCase() === targetJenis && item.nama.toLowerCase() === nama.toLowerCase();
    });
    if (isDuplicate) {
      return { status: "error", message: "Kategori '" + nama + "' sudah ada untuk " + targetJenis + "." };
    }

    var isAktif = aktifVal === true || aktifVal === "TRUE" || aktifVal === "true" || aktifVal === "Aktif";
    var updateData = {
      nama: nama,
      jenis: targetJenis,
      urutan: isNaN(urutan) ? target.urutan : urutan,
      aktif: isAktif ? "TRUE" : "FALSE",
      updated_at: new Date().toISOString()
    };

    DatabaseService.updateRowByColumn("MASTER_KATEGORI_KEUANGAN", "id", id, updateData);
    return { status: "success", message: "Kategori berhasil diperbarui." };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

function apiSetKategoriAktif(params) {
  try {
    ensureDefaultKategoriKeuangan_();
    var id = (params.id || "").trim();
    if (!id) return { status: "error", message: "ID kategori tidak ditemukan." };

    var existingRes = apiGetKategoriKeuangan();
    var existingList = existingRes.data || [];
    var target = existingList.find(function(x) { return x.id === id; });

    if (!target) return { status: "error", message: "Kategori tidak ditemukan." };

    var newAktif = params.aktif !== undefined ? (params.aktif === true || params.aktif === "TRUE" || params.aktif === "true") : !target.aktif;

    var updateData = {
      aktif: newAktif ? "TRUE" : "FALSE",
      updated_at: new Date().toISOString()
    };

    DatabaseService.updateRowByColumn("MASTER_KATEGORI_KEUANGAN", "id", id, updateData);
    return { status: "success", message: "Status kategori berhasil diubah." };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

function deduplicateMasterKategoriKeuangan_() {
  try {
    var sheet = getSheetByName("MASTER_KATEGORI_KEUANGAN");
    var data = sheet.getDataRange().getValues();
    if (!data || data.length <= 1) return;

    var headers = data[0];
    var idColIdx = -1;
    for (var c = 0; c < headers.length; c++) {
      if (headers[c].toString().trim().toLowerCase() === "id") {
        idColIdx = c;
        break;
      }
    }
    if (idColIdx === -1) idColIdx = 0;

    var seenIds = {};
    var uniqueRows = [headers];
    var hasDuplicate = false;

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var idVal = (row[idColIdx] || "").toString().trim();
      if (!idVal) continue;

      if (seenIds[idVal]) {
        hasDuplicate = true;
      } else {
        seenIds[idVal] = true;
        uniqueRows.push(row);
      }
    }

    if (hasDuplicate) {
      sheet.clearContents();
      sheet.getRange(1, 1, uniqueRows.length, headers.length).setValues(uniqueRows);
    }
  } catch (e) {
    Logger.log("deduplicateMasterKategoriKeuangan_ error: " + e.toString());
  }
}

function ensureDefaultKategoriKeuangan_() {
  try {
    deduplicateMasterKategoriKeuangan_();
    var sheet = getSheetByName("MASTER_KATEGORI_KEUANGAN");
    var data = sheet.getDataRange().getValues();
    var headers = (data && data.length > 0) ? data[0] : ["id", "jenis", "nama", "aktif", "urutan", "created_at", "updated_at", "created_by"];
    
    var existingIds = {};
    if (data && data.length > 1) {
      var idIdx = -1;
      for (var c = 0; c < headers.length; c++) {
        if (headers[c].toString().trim().toLowerCase() === "id") {
          idIdx = c;
          break;
        }
      }
      if (idIdx === -1) idIdx = 0;
      for (var i = 1; i < data.length; i++) {
        var val = (data[i][idIdx] || "").toString().trim();
        if (val) existingIds[val] = true;
      }
    }

    var defaultData = [
      // PENGELUARAN
      { id: "KAT-101", jenis: "PENGELUARAN", nama: "ATK", aktif: "TRUE", urutan: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: "SYSTEM" },
      { id: "KAT-102", jenis: "PENGELUARAN", nama: "Packing", aktif: "TRUE", urutan: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: "SYSTEM" },
      { id: "KAT-103", jenis: "PENGELUARAN", nama: "BBM", aktif: "TRUE", urutan: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: "SYSTEM" },
      { id: "KAT-104", jenis: "PENGELUARAN", nama: "Transport", aktif: "TRUE", urutan: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: "SYSTEM" },
      { id: "KAT-105", jenis: "PENGELUARAN", nama: "Parkir", aktif: "TRUE", urutan: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: "SYSTEM" },
      { id: "KAT-106", jenis: "PENGELUARAN", nama: "Listrik", aktif: "TRUE", urutan: 6, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: "SYSTEM" },
      { id: "KAT-107", jenis: "PENGELUARAN", nama: "Internet", aktif: "TRUE", urutan: 7, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: "SYSTEM" },
      { id: "KAT-108", jenis: "PENGELUARAN", nama: "Air Minum", aktif: "TRUE", urutan: 8, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: "SYSTEM" },
      { id: "KAT-109", jenis: "PENGELUARAN", nama: "Konsumsi", aktif: "TRUE", urutan: 9, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: "SYSTEM" },
      { id: "KAT-110", jenis: "PENGELUARAN", nama: "Maintenance", aktif: "TRUE", urutan: 10, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: "SYSTEM" },
      { id: "KAT-111", jenis: "PENGELUARAN", nama: "Lainnya", aktif: "TRUE", urutan: 11, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: "SYSTEM" },
      // PEMASUKAN
      { id: "KAT-201", jenis: "PEMASUKAN", nama: "Modal Owner", aktif: "TRUE", urutan: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: "SYSTEM" },
      { id: "KAT-202", jenis: "PEMASUKAN", nama: "Reward Pusat", aktif: "TRUE", urutan: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: "SYSTEM" },
      { id: "KAT-203", jenis: "PEMASUKAN", nama: "Insentif", aktif: "TRUE", urutan: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: "SYSTEM" },
      { id: "KAT-204", jenis: "PEMASUKAN", nama: "Cashback", aktif: "TRUE", urutan: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: "SYSTEM" },
      { id: "KAT-205", jenis: "PEMASUKAN", nama: "Pendapatan Lain", aktif: "TRUE", urutan: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: "SYSTEM" },
      { id: "KAT-206", jenis: "PEMASUKAN", nama: "Lainnya", aktif: "TRUE", urutan: 6, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: "SYSTEM" }
    ];

    defaultData.forEach(function(item) {
      if (!existingIds[item.id]) {
        DatabaseService.appendRow("MASTER_KATEGORI_KEUANGAN", item);
        existingIds[item.id] = true;
      }
    });
  } catch (e) {
    Logger.log("ensureDefaultKategoriKeuangan_ error: " + e.toString());
  }
}

// ==========================================
// KEUANGAN OUTLET (LEDGER)
// ==========================================

function apiGetKeuanganOutlet(params) {
  try {
    params = params || {};
    var rows = DatabaseService.getSheetData("KEUANGAN_OUTLET");
    if (!rows || rows.length < 2) {
      return { status: "success", data: [] };
    }

    var headers = rows[0];

    // Load category map for lookup
    var categoryRes = apiGetKategoriKeuangan();
    var catMap = {};
    if (categoryRes.data && Array.isArray(categoryRes.data)) {
      categoryRes.data.forEach(function(c) {
        catMap[c.id] = c;
      });
    }

    // Load outlet map for lookup
    var outletRows = DatabaseService.getSheetData("Outlets");
    var outletMap = {};
    if (outletRows && outletRows.length >= 2) {
      var oHeaders = outletRows[0];
      for (var j = 1; j < outletRows.length; j++) {
        var oObj = rowToObject_(oHeaders, outletRows[j]);
        if (oObj.outlet_id) {
          outletMap[oObj.outlet_id] = oObj.nama_outlet || oObj.outlet_id;
        }
      }
    }

    var list = [];
    for (var i = 1; i < rows.length; i++) {
      var obj = rowToObject_(headers, rows[i]);
      if (!obj.id) continue;

      var isAktif = obj.aktif === true || obj.aktif === "TRUE" || obj.aktif === "true" || obj.aktif === undefined || obj.aktif === "";
      if (!isAktif && !params.include_inactive) {
        continue;
      }

      var itemTanggal = (obj.tanggal || "").toString().slice(0, 10);
      if (params.tanggal_awal && itemTanggal < params.tanggal_awal) continue;
      if (params.tanggal_akhir && itemTanggal > params.tanggal_akhir) continue;

      if (params.outlet_id && params.outlet_id !== "ALL" && obj.outlet_id !== params.outlet_id) continue;
      if (params.jenis && params.jenis !== "ALL" && (obj.jenis || "").toString().toUpperCase() !== params.jenis.toUpperCase()) continue;
      if (params.kategori_id && params.kategori_id !== "ALL" && obj.kategori_id !== params.kategori_id) continue;

      var catInfo = catMap[obj.kategori_id] || {};
      list.push({
        id: obj.id.toString(),
        tanggal: itemTanggal,
        outlet_id: (obj.outlet_id || "").toString(),
        nama_outlet: outletMap[obj.outlet_id] || obj.outlet_id || "",
        jenis: (obj.jenis || catInfo.jenis || "PENGELUARAN").toString().toUpperCase(),
        kategori_id: (obj.kategori_id || "").toString(),
        kategori_nama: catInfo.nama || obj.kategori_id || "-",
        nominal: Number(obj.nominal) || 0,
        deskripsi: (obj.deskripsi || "").toString(),
        bukti_url: (obj.bukti_url || "").toString(),
        dibuat_oleh: (obj.dibuat_oleh || "").toString(),
        created_at: (obj.created_at || "").toString(),
        aktif: isAktif
      });
    }

    // Newest first by created_at or tanggal
    list.sort(function(a, b) {
      if (a.created_at && b.created_at) {
        return b.created_at.localeCompare(a.created_at);
      }
      return b.tanggal.localeCompare(a.tanggal);
    });

    return { status: "success", data: list };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

function isOutletDateClosed_(outletId, tanggal) {
  if (!outletId || !tanggal) return false;
  try {
    var rows = DatabaseService.getSheetData("Master_Setoran");
    if (!rows || rows.length < 2) return false;
    var headers = rows[0];
    for (var i = 1; i < rows.length; i++) {
      var obj = rowToObject_(headers, rows[i]);
      if (obj.outlet_id === outletId && (obj.tanggal || "").toString().slice(0, 10) === tanggal && obj.closing_status === "CLOSED") {
        return true;
      }
    }
  } catch (e) {
    Logger.log("isOutletDateClosed_ error: " + e.toString());
  }
  return false;
}

function apiSaveKeuanganOutlet(params) {
  try {
    params = params || {};
    var currentRole = (params.user_role || params.role || "").toString().toUpperCase();
    if (currentRole && currentRole !== "OWNER" && currentRole !== "ADMIN") {
      return { status: "error", message: "Akses ditolak. Perlu wewenang Owner atau Admin." };
    }

    var kategoriId = (params.kategori_id || "").trim();
    var nominal = Number(params.nominal) || 0;
    var tanggal = (params.tanggal || "").trim().slice(0, 10);
    var outletId = (params.outlet_id || "").trim();
    var dibuatOleh = params.dibuat_oleh || params.user_id || currentRole || "SYSTEM";

    if (!kategoriId) return { status: "error", message: "Kategori wajib dipilih." };
    if (!tanggal) return { status: "error", message: "Tanggal wajib diisi (YYYY-MM-DD)." };
    if (!outletId) return { status: "error", message: "Outlet wajib dipilih." };
    if (nominal <= 0) return { status: "error", message: "Nominal harus lebih besar dari 0." };

    if (isOutletDateClosed_(outletId, tanggal)) {
      return { status: "error", message: "Kas outlet hari tersebut sudah ditutup." };
    }

    // Lookup category
    var catRes = apiGetKategoriKeuangan();
    var catList = catRes.data || [];
    var catObj = catList.find(function(c) { return c.id === kategoriId; });

    if (!catObj) {
      return { status: "error", message: "Kategori tidak ditemukan." };
    }
    if (!catObj.aktif) {
      return { status: "error", message: "Kategori '" + catObj.nama + "' sedang tidak aktif." };
    }

    var jenis = catObj.jenis.toUpperCase();

    var newId = "KNG-" + new Date().getTime().toString().slice(-6) + Math.floor(Math.random() * 100);
    var nowStr = new Date().toISOString();

    var rowObj = {
      id: newId,
      tanggal: tanggal,
      outlet_id: outletId,
      jenis: jenis,
      kategori_id: kategoriId,
      nominal: nominal,
      deskripsi: (params.deskripsi || "").trim(),
      bukti_url: (params.bukti_url || "").trim(),
      dibuat_oleh: dibuatOleh,
      created_at: nowStr,
      aktif: "TRUE"
    };

    DatabaseService.appendRow("KEUANGAN_OUTLET", rowObj);
    return { status: "success", message: "Catatan keuangan berhasil disimpan.", data: rowObj };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

function apiUpdateKeuanganOutlet(params) {
  try {
    params = params || {};
    var currentRole = (params.user_role || params.role || "").toString().toUpperCase();
    if (currentRole && currentRole !== "OWNER" && currentRole !== "ADMIN") {
      return { status: "error", message: "Akses ditolak. Perlu wewenang Owner atau Admin." };
    }

    var id = (params.id || "").trim();
    var kategoriId = (params.kategori_id || "").trim();
    var nominal = Number(params.nominal) || 0;
    var tanggal = (params.tanggal || "").trim().slice(0, 10);
    var outletId = (params.outlet_id || "").trim();

    if (!id) return { status: "error", message: "ID transaksi keuangan tidak ditemukan." };
    if (!kategoriId) return { status: "error", message: "Kategori wajib dipilih." };
    if (!tanggal) return { status: "error", message: "Tanggal wajib diisi (YYYY-MM-DD)." };
    if (nominal <= 0) return { status: "error", message: "Nominal harus lebih besar dari 0." };

    var existingRows = DatabaseService.getSheetData("KEUANGAN_OUTLET");
    if (existingRows && existingRows.length >= 2) {
      var eHeaders = existingRows[0];
      for (var k = 1; k < existingRows.length; k++) {
        var eObj = rowToObject_(eHeaders, existingRows[k]);
        if (eObj.id === id) {
          var oldTgl = (eObj.tanggal || "").toString().slice(0, 10);
          var oldOutlet = eObj.outlet_id;
          if (isOutletDateClosed_(oldOutlet, oldTgl) || isOutletDateClosed_(outletId || oldOutlet, tanggal)) {
            return { status: "error", message: "Kas outlet hari tersebut sudah ditutup." };
          }
          break;
        }
      }
    }

    var catRes = apiGetKategoriKeuangan();
    var catList = catRes.data || [];
    var catObj = catList.find(function(c) { return c.id === kategoriId; });

    if (!catObj) {
      return { status: "error", message: "Kategori tidak ditemukan." };
    }
    if (!catObj.aktif) {
      return { status: "error", message: "Kategori '" + catObj.nama + "' sedang tidak aktif." };
    }

    var updateData = {
      tanggal: tanggal,
      jenis: catObj.jenis.toUpperCase(),
      kategori_id: kategoriId,
      nominal: nominal,
      deskripsi: (params.deskripsi || "").trim(),
      bukti_url: (params.bukti_url || "").trim()
    };
    if (outletId) {
      updateData.outlet_id = outletId;
    }

    DatabaseService.updateRowByColumn("KEUANGAN_OUTLET", "id", id, updateData);
    return { status: "success", message: "Catatan keuangan berhasil diperbarui." };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

function apiDeleteKeuanganOutlet(params) {
  try {
    params = params || {};
    var currentRole = (params.user_role || params.role || "").toString().toUpperCase();
    if (currentRole && currentRole !== "OWNER" && currentRole !== "ADMIN") {
      return { status: "error", message: "Akses ditolak. Perlu wewenang Owner atau Admin." };
    }

    var id = (params.id || "").trim();
    if (!id) return { status: "error", message: "ID transaksi keuangan tidak ditemukan." };

    var existingRows = DatabaseService.getSheetData("KEUANGAN_OUTLET");
    if (existingRows && existingRows.length >= 2) {
      var eHeaders = existingRows[0];
      for (var k = 1; k < existingRows.length; k++) {
        var eObj = rowToObject_(eHeaders, existingRows[k]);
        if (eObj.id === id) {
          var oldTgl = (eObj.tanggal || "").toString().slice(0, 10);
          if (isOutletDateClosed_(eObj.outlet_id, oldTgl)) {
            return { status: "error", message: "Kas outlet hari tersebut sudah ditutup." };
          }
          break;
        }
      }
    }

    DatabaseService.updateRowByColumn("KEUANGAN_OUTLET", "id", id, { aktif: "FALSE" });
    return { status: "success", message: "Catatan keuangan berhasil dinonaktifkan." };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}


function apiTestDriveConnection(params) {
  var folderId = params.folderId;
  if (!folderId) return { status: "error", message: "Folder ID kosong" };
  try {
    var folder = DriveApp.getFolderById(folderId);
    var name = folder.getName();
    return { status: "success", message: "Folder ditemukan: " + name };
  } catch(e) {
    return { status: "error", message: "Folder tidak ditemukan atau akses ditolak" };
  }
}

function apiGetUsers() {
  try {
    var rows = DatabaseService.getSheetData("Users");
    if (!rows || rows.length < 2) return { status: "success", data: [] };
    var headers = rows[0];
    var list = [];
    for (var i = 1; i < rows.length; i++) {
      var obj = rowToObject_(headers, rows[i]);
      if (obj.user_id || obj.username) list.push(obj);
    }
    return { status: "success", data: list };
  } catch(e) {
    return { status: "error", message: e.message };
  }
}

function sanitizeString_(str) {
  if (str === null || str === undefined) return "";
  var s = String(str).trim();
  if (s === "-") return "";
  return s;
}

function parsePhoneNumbers_(rawPhone) {
  var str = String(rawPhone || "");
  var parts = str.split(/[\/\,\;\|\&]/);
  var primary = "";
  var alternate = "";
  for (var i = 0; i < parts.length; i++) {
    var norm = normalizePhone_(parts[i]);
    if (norm) {
      if (!primary) {
        primary = norm;
      } else if (!alternate && norm !== primary) {
        alternate = norm;
      }
    }
  }
  return {
    primaryPhone: primary,
    alternatePhone: alternate
  };
}

function normalizePhone_(phone) {
  if (!phone) return "";
  var digits = String(phone).replace(/\D/g, "");
  if (digits.indexOf("62") === 0) digits = digits.substring(2);
  else if (digits.indexOf("0") === 0) digits = digits.substring(1);
  return digits;
}

function apiImportCustomerFromSheet(params) {
  try {
    var sheetName = params.sheetName;
    var outletId = params.outletId;
    var spreadsheetId = params.spreadsheetId;
    var isPreview = params.preview === true;
    var useEditedRows = !isPreview && params.editedRows !== undefined;
    var importSessionId = params.importSessionId;
    var userId = params.user_id || "Unknown";
    
    var frontendVersion = params.frontend_version || "";
    var appVersion = params.app_version || "";

    if (!importSessionId) throw new Error("importSessionId is required.");
    if (!sheetName && !useEditedRows) throw new Error("sheetName wajib diisi");

    var rawData;
    var headers;
    var idxSndName = -1, idxSndPhone = -1, idxSndAddr = -1, idxSndZip = -1;
    var idxRcvName = -1, idxRcvPhone = -1, idxRcvAddr = -1, idxRcvZip = -1;
    var idxItemName = -1, idxItemWeight = -1, idxItemVol = -1, idxItemValue = -1, idxItemQty = -1;

    if (!useEditedRows) {
      if (spreadsheetId) {
        var match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
        var id = match ? match[1] : spreadsheetId;
        var extSs = SpreadsheetApp.openById(id);
        var extSheet = extSs.getSheetByName(sheetName);
        if (!extSheet) throw new Error("Sheet '" + sheetName + "' tidak ditemukan di Spreadsheet target.");
        rawData = extSheet.getDataRange().getValues();
      } else {
        rawData = DatabaseService.getSheetData(sheetName);
      }

      if (!rawData || rawData.length < 2) {
        throw new Error("Sheet kosong atau tidak ditemukan.");
      }

      headers = rawData[0];
      
      // Cari index kolom
      for (var i = 0; i < headers.length; i++) {
        var h = headers[i].toString().trim().toLowerCase();
        if (h === "nama pengirim" && idxSndName === -1) idxSndName = i;
        else if (h === "no. hp" && idxSndPhone === -1) idxSndPhone = i;
        else if (h === "alamat pengirim" && idxSndAddr === -1) idxSndAddr = i;
        else if (h === "kode pos" && idxSndZip === -1) idxSndZip = i;
        
        else if (h === "nama penerima" && idxRcvName === -1) idxRcvName = i;
        else if (h === "no. hp" && idxSndPhone !== -1 && idxRcvPhone === -1) idxRcvPhone = i;
        else if (h === "alamat penerima" && idxRcvAddr === -1) idxRcvAddr = i;
        else if (h === "kode pos" && idxSndZip !== -1 && idxRcvZip === -1) idxRcvZip = i;
        
        else if (h === "nama barang" && idxItemName === -1) idxItemName = i;
        else if (h === "berat barang" && idxItemWeight === -1) idxItemWeight = i;
        else if (h === "volume (pxlxt)" && idxItemVol === -1) idxItemVol = i;
        else if (h === "nilai barang (rp)" && idxItemValue === -1) idxItemValue = i;
        else if (h === "jumlah paket" && idxItemQty === -1) idxItemQty = i;
      }
    }

    // Ambil database existing untuk checking
    var dbPengirim = DatabaseService.getSheetData("MASTER_PENGIRIM") || [];
    var dbPenerima = DatabaseService.getSheetData("MASTER_PENERIMA") || [];
    var dbCustomer = DatabaseService.getSheetData("Master_Customer") || [];
    
    var headPengirim = dbPengirim[0] || DB_SCHEMA.MASTER_PENGIRIM;
    var headPenerima = dbPenerima[0] || DB_SCHEMA.MASTER_PENERIMA;
    var headCustomer = dbCustomer[0] || DB_SCHEMA.Master_Customer;

    var hpPengirimMap = {};
    var nameAddrPengirimMap = {};
    for (var r = 1; r < dbPengirim.length; r++) {
      var row = rowToObject_(headPengirim, dbPengirim[r]);
      var hpNorm = normalizePhone_(row.telepon);
      if (hpNorm) {
        row._rowIndex = r; // 0-based array index in memory
        hpPengirimMap[hpNorm] = row;
      }
      var nameAddrKey = sanitizeString_(row.nama) + "|||" + sanitizeString_(row.alamat);
      nameAddrPengirimMap[nameAddrKey] = row;
    }

    var hpPenerimaMap = {};
    var nameAddrPenerimaMap = {};
    for (var r = 1; r < dbPenerima.length; r++) {
      var row = rowToObject_(headPenerima, dbPenerima[r]);
      var hpNorm = normalizePhone_(row.telepon);
      if (hpNorm) {
        row._rowIndex = r;
        hpPenerimaMap[hpNorm] = row;
      }
      var nameAddrKey = sanitizeString_(row.nama) + "|||" + sanitizeString_(row.alamat);
      nameAddrPenerimaMap[nameAddrKey] = row;
    }

    var hpCustomerMap = {};
    for (var r = 1; r < dbCustomer.length; r++) {
      var row = rowToObject_(headCustomer, dbCustomer[r]);
      var hpNorm = normalizePhone_(row.no_hp || row.telepon);
      if (hpNorm) {
        row._rowIndex = r;
        hpCustomerMap[hpNorm] = row;
      }
    }

    var stats = {
      importSessionId: importSessionId,
      frontendVersion: frontendVersion,
      backendVersion: "1.0",
      dbSchemaVersion: DB_SCHEMA_VERSION,
      appVersion: appVersion,
      total: 0,
      insertPengirim: 0,
      updatePengirim: 0,
      insertPenerima: 0,
      updatePenerima: 0,
      failed: 0,
      errors: [],
      previewRows: []
    };

    var nowStr = new Date().toISOString();

    // Mapping cache col indices
    var mapColPengirim = {};
    for (var c = 0; c < headPengirim.length; c++) mapColPengirim[headPengirim[c]] = c;
    
    var mapColPenerima = {};
    for (var c = 0; c < headPenerima.length; c++) mapColPenerima[headPenerima[c]] = c;
    
    var mapColCustomer = {};
    for (var c = 0; c < headCustomer.length; c++) mapColCustomer[headCustomer[c]] = c;
    
    var rowCount = useEditedRows ? params.editedRows.length : (rawData ? rawData.length : 0);
    var startIdx = useEditedRows ? 0 : 1;

    for (var r = startIdx; r < rowCount; r++) {
      try {
        var sName = "", sPhone = "", sAddr = "", sZip = "";
        var rName = "", rPhone = "", rAddr = "", rZip = "";
        
        if (useEditedRows) {
          var ed = params.editedRows[r];
          sName = sanitizeString_(ed.namaPengirim);
          sPhone = sanitizeString_(ed.noHpPengirim);
          rName = sanitizeString_(ed.namaPenerima);
          rPhone = sanitizeString_(ed.noHpPenerima);
          sAddr = sanitizeString_(ed.alamatPengirim || ed.alamat); // Fallback to ed.alamat if UI is not updated
          rAddr = sanitizeString_(ed.alamatPenerima || ed.alamat);
        } else {
          var dr = rawData[r];
          sName = sanitizeString_(idxSndName !== -1 ? dr[idxSndName] : "");
          sPhone = sanitizeString_(idxSndPhone !== -1 ? dr[idxSndPhone] : "");
          sAddr = sanitizeString_(idxSndAddr !== -1 ? dr[idxSndAddr] : "");
          sZip = sanitizeString_(idxSndZip !== -1 ? dr[idxSndZip] : "");

          rName = sanitizeString_(idxRcvName !== -1 ? dr[idxRcvName] : "");
          rPhone = sanitizeString_(idxRcvPhone !== -1 ? dr[idxRcvPhone] : "");
          rAddr = sanitizeString_(idxRcvAddr !== -1 ? dr[idxRcvAddr] : "");
          rZip = sanitizeString_(idxRcvZip !== -1 ? dr[idxRcvZip] : "");
        }

        var parsedSPhone = parsePhoneNumbers_(sPhone);
        var sPhoneNorm = parsedSPhone.primaryPhone;
        var sPhoneAlt = parsedSPhone.alternatePhone;

        var parsedRPhone = parsePhoneNumbers_(rPhone);
        var rPhoneNorm = parsedRPhone.primaryPhone;
        var rPhoneAlt = parsedRPhone.alternatePhone;

        // If useEditedRows is true and we got alternative phones from the UI edit directly
        if (useEditedRows) {
           var ed = params.editedRows[r];
           // If UI sends noHpPengirimAlt explicitly, use it, overriding the parsed one
           if (ed.noHpPengirimAlt !== undefined) sPhoneAlt = sanitizeString_(ed.noHpPengirimAlt);
           if (ed.noHpPenerimaAlt !== undefined) rPhoneAlt = sanitizeString_(ed.noHpPenerimaAlt);
        }

        if (!sName && !sPhoneNorm && !rName && !rPhoneNorm) {
          continue;
        }
        
        var pStatus = "UPDATE";
        var isNewSnd = false;
        var isNewRcv = false;

        if (sName || sPhoneNorm) {
          var pengirimMatch = null;
          if (sPhoneNorm && hpPengirimMap[sPhoneNorm]) {
            pengirimMatch = hpPengirimMap[sPhoneNorm];
          } else if (!sPhoneNorm && sName) {
            var sKey = sName + "|||" + sAddr;
            if (nameAddrPengirimMap[sKey]) {
              pengirimMatch = nameAddrPengirimMap[sKey];
            }
          }

          if (pengirimMatch) {
            // Update
            var existingIdx = pengirimMatch._rowIndex;
            if (mapColPengirim["nama"] !== undefined && sName) dbPengirim[existingIdx][mapColPengirim["nama"]] = sName;
            if (mapColPengirim["alamat"] !== undefined && sAddr) dbPengirim[existingIdx][mapColPengirim["alamat"]] = sAddr;
            if (mapColPengirim["kode_pos"] !== undefined && sZip) dbPengirim[existingIdx][mapColPengirim["kode_pos"]] = sZip;
            if (mapColPengirim["telepon_alternatif"] !== undefined && sPhoneAlt) dbPengirim[existingIdx][mapColPengirim["telepon_alternatif"]] = sPhoneAlt;
            if (mapColPengirim["updated_at"] !== undefined) dbPengirim[existingIdx][mapColPengirim["updated_at"]] = nowStr;
            stats.updatePengirim++;
          } else {
            isNewSnd = true;
            // Insert
            var newId = "SND-" + new Date().getTime().toString().slice(-5) + Math.floor(Math.random() * 10) + r;
            var rowObj = {
              id: newId,
              customer_id: "",
              nama: sName,
              telepon: sPhoneNorm,
              telepon_alternatif: sPhoneAlt,
              alamat: sAddr,
              kode_pos: sZip,
              status: "AKTIF",
              created_at: nowStr,
              updated_at: nowStr,
              outlet_id_asal: outletId || ""
            };
            var newRow = headPengirim.map(function(col) { return rowObj[col] !== undefined ? rowObj[col] : ""; });
            dbPengirim.push(newRow);
            
            rowObj._rowIndex = dbPengirim.length - 1;
            if (sPhoneNorm) hpPengirimMap[sPhoneNorm] = rowObj;
            stats.insertPengirim++;
          }
          
          // Sync Master Customer if exists
          if (sPhoneNorm && hpCustomerMap[sPhoneNorm]) {
            var exCstIdx = hpCustomerMap[sPhoneNorm]._rowIndex;
            if (mapColCustomer["last_updated"] !== undefined) dbCustomer[exCstIdx][mapColCustomer["last_updated"]] = nowStr;
            if (mapColCustomer["tanggal_terakhir_kirim"] !== undefined) dbCustomer[exCstIdx][mapColCustomer["tanggal_terakhir_kirim"]] = nowStr;
          }
        }

        if (rName || rPhoneNorm) {
          var penerimaMatch = null;
          if (rPhoneNorm && hpPenerimaMap[rPhoneNorm]) {
            penerimaMatch = hpPenerimaMap[rPhoneNorm];
          } else if (!rPhoneNorm && rName) {
            var rKey = rName + "|||" + rAddr;
            if (nameAddrPenerimaMap[rKey]) {
              penerimaMatch = nameAddrPenerimaMap[rKey];
            }
          }

          if (penerimaMatch) {
            var existingRIdx = penerimaMatch._rowIndex;
            if (mapColPenerima["nama"] !== undefined && rName) dbPenerima[existingRIdx][mapColPenerima["nama"]] = rName;
            if (mapColPenerima["alamat"] !== undefined && rAddr) dbPenerima[existingRIdx][mapColPenerima["alamat"]] = rAddr;
            if (mapColPenerima["kode_pos"] !== undefined && rZip) dbPenerima[existingRIdx][mapColPenerima["kode_pos"]] = rZip;
            if (mapColPenerima["telepon_alternatif"] !== undefined && rPhoneAlt) dbPenerima[existingRIdx][mapColPenerima["telepon_alternatif"]] = rPhoneAlt;
            if (mapColPenerima["updated_at"] !== undefined) dbPenerima[existingRIdx][mapColPenerima["updated_at"]] = nowStr;
            stats.updatePenerima++;
          } else {
            isNewRcv = true;
            var newIdR = "RCV-" + new Date().getTime().toString().slice(-5) + Math.floor(Math.random() * 10) + r;
            var rowObjR = {
              id: newIdR,
              customer_id: "",
              nama: rName,
              telepon: rPhoneNorm,
              telepon_alternatif: rPhoneAlt,
              alamat: rAddr,
              kode_pos: rZip,
              status: "AKTIF",
              created_at: nowStr,
              updated_at: nowStr,
              outlet_id_asal: outletId || ""
            };
            var newRowR = headPenerima.map(function(col) { return rowObjR[col] !== undefined ? rowObjR[col] : ""; });
            dbPenerima.push(newRowR);
            
            rowObjR._rowIndex = dbPenerima.length - 1;
            if (rPhoneNorm) hpPenerimaMap[rPhoneNorm] = rowObjR;
            stats.insertPenerima++;
          }
        }
        
        if (isNewSnd || isNewRcv) {
            pStatus = "NEW";
        }
        
        stats.total++;

        if (isPreview) {
          stats.previewRows.push({
            status: pStatus,
            namaPengirim: sName,
            noHpPengirim: sPhoneNorm, // Use parsed phone in preview
            noHpPengirimAlt: sPhoneAlt,
            namaPenerima: rName,
            noHpPenerima: rPhoneNorm,
            noHpPenerimaAlt: rPhoneAlt,
            alamatPengirim: sAddr,
            alamatPenerima: rAddr,
            alamat: sAddr || rAddr,
            outlet: outletId || ""
          });
        }
      } catch (err) {
        stats.failed++;
        stats.errors.push("Row " + (r+1) + ": " + err.message);
      }
    }

    // Write back batch to sheets
    if (!isPreview) {
      if (dbPengirim.length > 1) {
        var sheetPengirim = getSheetByName("MASTER_PENGIRIM");
        sheetPengirim.getRange(1, 1, dbPengirim.length, dbPengirim[0].length).setValues(dbPengirim);
      }
      
      if (dbPenerima.length > 1) {
        var sheetPenerima = getSheetByName("MASTER_PENERIMA");
        sheetPenerima.getRange(1, 1, dbPenerima.length, dbPenerima[0].length).setValues(dbPenerima);
      }
      
      if (dbCustomer.length > 1) {
        var sheetCustomer = getSheetByName("Master_Customer");
        sheetCustomer.getRange(1, 1, dbCustomer.length, dbCustomer[0].length).setValues(dbCustomer);
      }
    }

    // Write to IMPORT_LOG
    try {
      var statusLog = isPreview ? "PREVIEW" : "IMPORTED";
      var logData = {
        id: importSessionId,
        created_at: nowStr,
        owner: userId,
        outlet_id: outletId || "",
        outlet_name: "", // can be mapped if needed
        spreadsheet_id: spreadsheetId || "",
        spreadsheet_name: "", // optional
        sheet_name: sheetName || "",
        total_preview: stats.total,
        total_new: stats.insertPengirim + stats.insertPenerima,
        total_update: stats.updatePengirim + stats.updatePenerima,
        total_skipped: stats.total - (stats.insertPengirim + stats.insertPenerima + stats.updatePengirim + stats.updatePenerima),
        status: statusLog,
        completed_at: isPreview ? "" : nowStr,
        frontend_version: frontendVersion,
        backend_version: "1.0",
        db_schema_version: String(DB_SCHEMA_VERSION),
        app_version: appVersion
      };
      
      var existingLog = DatabaseService.findRowByColumn("IMPORT_LOG", "id", importSessionId);
      if (existingLog) {
         // PREVIEW was generated, so we keep created_at, update the rest
         logData.created_at = existingLog.created_at;
         DatabaseService.updateRowByColumn("IMPORT_LOG", "id", importSessionId, logData);
      } else {
         DatabaseService.appendRow("IMPORT_LOG", logData);
      }
    } catch(logErr) {
      Logger.log("Failed to write IMPORT_LOG: " + logErr);
    }

    return {
      status: "success",
      message: "Import selesai.",
      data: stats
    };
  } catch (e) {
    try {
      if (typeof importSessionId !== "undefined") {
        var failLog = {
          id: importSessionId,
          status: "FAILED",
          completed_at: new Date().toISOString()
        };
        var existingLog = DatabaseService.findRowByColumn("IMPORT_LOG", "id", importSessionId);
        if (existingLog) {
           DatabaseService.updateRowByColumn("IMPORT_LOG", "id", importSessionId, failLog);
        } else {
           failLog.created_at = new Date().toISOString();
           DatabaseService.appendRow("IMPORT_LOG", failLog);
        }
      }
    } catch(e2) {}
    return { status: "error", message: e.toString() };
  }
}

function apiGetCustomers(params) {
  try {
    params = params || {};
    var query = (params.query || params.keyword || "").toString().toLowerCase().trim();
    var rows = DatabaseService.getSheetData("MASTER_PENGIRIM");
    if (!rows || rows.length < 2) return { status: "success", data: [] };
    var headers = rows[0];
    var list = [];
    for (var i = 1; i < rows.length; i++) {
      var obj = rowToObject_(headers, rows[i]);
      if (!obj.id && !obj.telepon && !obj.nama) continue;
      if (query) {
        var str = ((obj.nama || "") + " " + (obj.telepon || "") + " " + (obj.alamat || "") + " " + (obj.id || "")).toLowerCase();
        if (str.indexOf(query) === -1) continue;
      }
      list.push(obj);
    }
    return { status: "success", data: list };
  } catch(e) {
    return { status: "error", message: e.message };
  }
}

function apiGetCustomerHistory(params) {
  try {
    params = params || {};
    var customerId = (params.customer_id || params.id || params.telepon || "").toString();
    var txRows = DatabaseService.getSheetData("Transaksi");
    if (!txRows || txRows.length < 2) return { status: "success", data: [] };
    var headers = txRows[0];
    var list = [];
    for (var i = 1; i < txRows.length; i++) {
      var obj = rowToObject_(headers, txRows[i]);
      if (customerId && obj.pengirim_telepon !== customerId && obj.pengirim_nama !== customerId && obj.transaksi_id !== customerId) {
        continue;
      }
      list.push(obj);
    }
    return { status: "success", data: list };
  } catch(e) {
    return { status: "error", message: e.message };
  }
}

function convertSystemSettingsToVertical_() {
  try {
    var sheet = getSheetByName("SystemSettings");
    if (!sheet) return;
    var data = sheet.getDataRange().getValues();
    if (!data || data.length < 1) return;

    if (data[0].length > 2) {
      var headers = data[0];
      var values = data[1] || [];
      var verticalRows = [["key", "value"]];

      for (var c = 0; c < headers.length; c++) {
        var k = (headers[c] || "").toString().trim();
        if (k) {
          var v = values[c] !== undefined ? values[c] : "";
          verticalRows.push([k, v]);
        }
      }

      sheet.clearContents();
      sheet.getRange(1, 1, verticalRows.length, 2).setValues(verticalRows);
      formatHeader_(sheet, 2);
      sheet.setColumnWidth(1, 280);
      sheet.setColumnWidth(2, 500);
    }
  } catch (e) {
    Logger.log("convertSystemSettingsToVertical_ error: " + e.toString());
  }
}

function convertSystemSettingsToVertical() {
  convertSystemSettingsToVertical_();
  ensureDefaultSystemSettings_();
  Logger.log("Penyimpanan SystemSettings berhasil diubah menjadi format vertikal (2 kolom: key & value).");
  return "SystemSettings berhasil dikonversi ke format vertikal.";
}

function ensureDefaultSystemSettings_() {
  try {
    convertSystemSettingsToVertical_();
    var sheet = getSheetByName("SystemSettings");
    if (!sheet) return;
    var data = sheet.getDataRange().getValues();

    if (!data || data.length <= 1) {
      var defaultSettings = [
        ["key", "value"],
        ["id", "SYS-1"],
        ["apps_script_url", ""],
        ["spreadsheet_id", ""],
        ["divisor_express", 6000],
        ["divisor_cargo", 4000],
        ["folder_bukti_bayar_customer", ""],
        ["folder_foto_paket", ""],
        ["folder_foto_resi", ""],
        ["folder_bukti_kas_masuk", ""],
        ["folder_bukti_kas_keluar", ""],
        ["folder_bukti_transfer_admin_owner", ""],
        ["folder_bukti_transfer_owner_dp", ""]
      ];
      sheet.clearContents();
      sheet.getRange(1, 1, defaultSettings.length, 2).setValues(defaultSettings);
      formatHeader_(sheet, 2);
      sheet.setColumnWidth(1, 280);
      sheet.setColumnWidth(2, 500);
    }
  } catch (e) {
    Logger.log("ensureDefaultSystemSettings_ error: " + e.toString());
  }
}

function getSystemSettingsObject_() {
  ensureDefaultSystemSettings_();
  var sysRows = DatabaseService.getSheetData("SystemSettings");
  var sysObj = {};
  if (!sysRows || sysRows.length === 0) return sysObj;

  var isVertical = false;
  if (sysRows[0].length <= 2) {
    isVertical = true;
  } else {
    var firstColLower = (sysRows[0][0] || "").toString().toLowerCase();
    if (firstColLower === "key" || firstColLower === "parameter" || firstColLower === "setting") {
      isVertical = true;
    }
  }

  if (isVertical) {
    for (var i = 0; i < sysRows.length; i++) {
      var k = (sysRows[i][0] || "").toString().trim();
      var v = sysRows[i][1] !== undefined ? sysRows[i][1] : "";
      if (!k) continue;
      var kLower = k.toLowerCase();
      if (kLower === "key" || kLower === "setting" || kLower === "parameter" || kLower === "nama_setting" || kLower === "setting_key" || kLower === "property") {
        continue;
      }
      sysObj[k] = v;
    }
  } else if (sysRows.length >= 2) {
    sysObj = rowToObject_(sysRows[0], sysRows[1]);
  }
  return sysObj;
}

function saveSystemSettings_(sysObj) {
  if (!sysObj || typeof sysObj !== "object") return;
  var sheet = getSheetByName("SystemSettings");
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();

  var isVertical = false;
  if (!data || data.length === 0 || data[0].length <= 2) {
    isVertical = true;
  } else {
    var firstColLower = (data[0][0] || "").toString().toLowerCase();
    if (firstColLower === "key" || firstColLower === "parameter" || firstColLower === "setting") {
      isVertical = true;
    }
  }

  if (isVertical) {
    var existingKeysMap = {};
    if (data && data.length > 0) {
      for (var r = 0; r < data.length; r++) {
        var k = (data[r][0] || "").toString().trim();
        if (k) existingKeysMap[k] = r + 1; // 1-based row index
      }
    } else {
      sheet.appendRow(["key", "value"]);
      formatHeader_(sheet, 2);
      existingKeysMap["key"] = 1;
    }

    var keysToSave = Object.keys(sysObj);
    keysToSave.forEach(function(keyName) {
      var val = sysObj[keyName];
      if (val === undefined || val === null) val = "";
      if (existingKeysMap[keyName]) {
        var rowIdx = existingKeysMap[keyName];
        sheet.getRange(rowIdx, 2).setValue(val);
      } else {
        sheet.appendRow([keyName, val]);
        existingKeysMap[keyName] = sheet.getLastRow();
      }
    });
  } else {
    if (data && data.length >= 2) {
      DatabaseService.updateRowByColumn("SystemSettings", "id", sysObj.id || data[1][0], sysObj);
    } else {
      DatabaseService.appendRow("SystemSettings", sysObj);
    }
  }
}

function apiGetAllSettings() {
  try {
    var sysObj = getSystemSettingsObject_();
    var outletsRes = apiGetOutlets();
    var usersRes = apiGetUsers();
    return {
      status: "success",
      data: {
        outlets: outletsRes.data || [],
        users: usersRes.data || [],
        systemSettings: sysObj
      }
    };
  } catch(e) {
    return { status: "error", message: e.message };
  }
}

function apiSaveAllSettings(params) {
  try {
    params = params || {};

    if (params.outlets && Array.isArray(params.outlets)) {
      params.outlets.forEach(function(o) {
        if (!o.outlet_id) return;
        var existing = DatabaseService.findRowByColumn("Outlets", "outlet_id", o.outlet_id);
        if (existing) {
          DatabaseService.updateRowByColumn("Outlets", "outlet_id", o.outlet_id, o);
        } else {
          DatabaseService.appendRow("Outlets", o);
        }
      });
    }

    if (params.users && Array.isArray(params.users)) {
      params.users.forEach(function(u) {
        if (!u.user_id) return;
        var existing = DatabaseService.findRowByColumn("Users", "user_id", u.user_id);
        if (existing) {
          DatabaseService.updateRowByColumn("Users", "user_id", u.user_id, u);
        } else {
          DatabaseService.appendRow("Users", u);
        }
      });
    }

    if (params.systemSettings) {
      saveSystemSettings_(params.systemSettings);
    }

    return { status: "success", message: "Pengaturan berhasil disimpan." };
  } catch(e) {
    return { status: "error", message: e.message };
  }
}

function apiChangePassword(params) {
  try {
    params = params || {};
    var userId = (params.user_id || "").toString();
    var oldPass = (params.old_password || "").toString();
    var newPass = (params.new_password || "").toString();

    if (!userId || !oldPass || !newPass) {
      return { status: "error", message: "Parameter user_id, old_password, dan new_password wajib diisi." };
    }

    var user = DatabaseService.findRowByColumn("Users", "user_id", userId);
    if (!user) {
      return { status: "error", message: "User tidak ditemukan" };
    }

    var oldHash = oldPass.indexOf("hash_") === 0 ? oldPass : "hash_" + oldPass;
    if (user.password_hash !== oldHash && user.password_hash !== oldPass) {
      return { status: "error", message: "Kata sandi lama salah" };
    }

    var newHash = "hash_" + newPass;
    DatabaseService.updateRowByColumn("Users", "user_id", userId, { password_hash: newHash });
    return { status: "success", message: "Kata sandi berhasil diubah" };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

function apiDebugLoginVersion() {
  return {
    status: "success",
    version: "v1.0-debug",
    loginFunction: apiLogin.toString(),
    hasMockHash: typeof mockHashPassword_,
    timestamp: new Date().toISOString()
  };
}

function apiDebugSpreadsheet() {
  try {
    var ss = getSpreadsheet_();
    var sheets = ss.getSheets();
    var sheetsInfo = [];
    
    for (var i = 0; i < sheets.length; i++) {
      var sheet = sheets[i];
      var name = sheet.getName();
      var lastRow = sheet.getLastRow();
      var lastColumn = sheet.getLastColumn();
      var data = [];
      
      if (lastRow > 0 && lastColumn > 0) {
        data = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
      }
      
      sheetsInfo.push({
        sheetName: name,
        lastRow: lastRow,
        lastColumn: lastColumn,
        jumlahData: data.length,
        first5Rows: data.slice(0, 5)
      });
    }

    return {
      status: "success",
      spreadsheetId: ss.getId(),
      spreadsheetName: ss.getName(),
      spreadsheetUrl: ss.getUrl(),
      sheetsInfo: sheetsInfo
    };
  } catch (err) {
    return { status: "error", message: err.message || err.toString() };
  }
}
