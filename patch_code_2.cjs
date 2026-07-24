const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf-8');

// Function replacement utility
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

const apiLoginImpl = `function apiLogin(params) {
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
}`;

const apiGetOutletsImpl = `function apiGetOutlets() {
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
}`;

const apiSearchCustomerImpl = `function apiSearchCustomer(params) {
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
}`;

const apiGetRiwayatPenerimaImpl = `function apiGetRiwayatPenerima(params) {
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
}`;

const apiGetPreInputImpl = `function apiGetPreInput(params) {
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
}`;

const apiCheckDuplicateResiImpl = `function apiCheckDuplicateResi(params) {
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
}`;

code = replaceFunction(code, 'apiLogin', apiLoginImpl);
code = replaceFunction(code, 'apiGetOutlets', apiGetOutletsImpl);
code = replaceFunction(code, 'apiSearchCustomer', apiSearchCustomerImpl);
code = replaceFunction(code, 'apiGetRiwayatPenerima', apiGetRiwayatPenerimaImpl);
code = replaceFunction(code, 'apiGetPreInput', apiGetPreInputImpl);
code = replaceFunction(code, 'apiCheckDuplicateResi', apiCheckDuplicateResiImpl);

fs.writeFileSync('Code.gs', code);
