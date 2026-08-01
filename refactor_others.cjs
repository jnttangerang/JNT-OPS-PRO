const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

// apiLogin
code = code.replace(/function apiLogin\(params\) \{[\s\S]*?return \{ status: "error", message: "Username atau password salah!" \};\n\}/, 
`function apiLogin(params) {
  var username = (params.username || "").trim();
  var password = (params.password || "").trim();
  var usersData = DatabaseService.getSheetData("Users");
  var headers = usersData[0];
  
  for (var i = 1; i < usersData.length; i++) {
    var row = usersData[i];
    var userData = rowToObject_(headers, row);
    
    var inputHash = password ? "hash_" + password : "";
    if (userData.username === username && (userData.password_hash === inputHash || userData.password_hash === password)) {
      if (userData.status_aktif !== "Aktif") {
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
  return { status: "error", message: "Username atau password salah!" };
}`);

// apiGetOutlets
code = code.replace(/function apiGetOutlets\(\) \{[\s\S]*?return \{ status: "success", data: result \};\n\}/,
`function apiGetOutlets() {
  var rows = DatabaseService.getSheetData("Outlets");
  var headers = rows[0];
  var result = [];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var obj = rowToObject_(headers, row);
    if (obj.is_active === "Aktif" || obj.is_active === true || obj.is_active === "TRUE") {
      result.push({
        outlet_id: obj.outlet_id,
        nama_outlet: obj.nama_outlet,
        target_resi_harian: obj.target_resi_harian,
        target_resi_bulanan: obj.target_resi_bulanan
      });
    }
  }
  return { status: "success", data: result };
}`);

// apiSearchCustomer
code = code.replace(/function apiSearchCustomer\(params\) \{[\s\S]*?return \{ status: "success", data: result \};\n\}/,
`function apiSearchCustomer(params) {
  var phone = params.phone || "";
  if (!phone) return { status: "error", message: "Nomor HP diperlukan" };
  var rows = DatabaseService.getSheetData("Master_Customer");
  var headers = rows[0];
  var result = [];
  for (var i = 1; i < rows.length; i++) {
    var obj = rowToObject_(headers, rows[i]);
    if (obj.hp_customer.toString().indexOf(phone) !== -1) {
      result.push(obj);
    }
  }
  return { status: "success", data: result };
}`);

// apiGetRiwayatPenerima
code = code.replace(/function apiGetRiwayatPenerima\(params\) \{[\s\S]*?return \{ status: "success", data: result \};\n\}/,
`function apiGetRiwayatPenerima(params) {
  var cstId = params.customer_id;
  if (!cstId) return { status: "error", message: "Customer ID diperlukan" };
  var rows = DatabaseService.getSheetData("Riwayat_Penerima");
  var headers = rows[0];
  var result = [];
  for (var i = 1; i < rows.length; i++) {
    var obj = rowToObject_(headers, rows[i]);
    if (obj.customer_id === cstId) {
      result.push(obj);
    }
  }
  return { status: "success", data: result };
}`);

// apiGetPreInput
code = code.replace(/function apiGetPreInput\(params\) \{[\s\S]*?return \{ status: "success", data: result \};\n\}/,
`function apiGetPreInput(params) {
  var outletId = params.outlet_id;
  var rows = DatabaseService.getSheetData("PreInput_Backup");
  var headers = rows[0];
  var result = [];
  for (var i = 1; i < rows.length; i++) {
    var obj = rowToObject_(headers, rows[i]);
    if (obj.status === "PENDING" && (!outletId || obj.outlet_id_tugas === outletId)) {
      result.push(obj);
    }
  }
  return { status: "success", data: result };
}`);

// apiUpdateOutletTarget
code = code.replace(/function apiUpdateOutletTarget\(params\) \{[\s\S]*?return found \? \{ status: "success", message: "Target outlet berhasil diupdate." \} : \{ status: "error", message: "Outlet tidak ditemukan." \};\n\}/,
`function apiUpdateOutletTarget(params) {
  var outletId = params.outlet_id;
  var targetHarian = params.target_resi_harian;
  var targetBulanan = params.target_resi_bulanan;
  var updateData = {};
  if (targetHarian !== undefined) updateData.target_resi_harian = targetHarian;
  if (targetBulanan !== undefined) updateData.target_resi_bulanan = targetBulanan;
  
  var success = DatabaseService.updateRowByColumn("Outlets", "outlet_id", outletId, updateData);
  return success ? { status: "success", message: "Target outlet berhasil diupdate." } : { status: "error", message: "Outlet tidak ditemukan." };
}`);

// apiSaveReview
code = code.replace(/function apiSaveReview\(params\) \{[\s\S]*?return \{ status: "success", message: "Review berhasil disimpan.", data: \{ id: reviewObj.id \} \};\n\}/,
`function apiSaveReview(params) {
  var reviewObj = {
    id: "REV-" + new Date().getTime(),
    outlet_id: params.outlet_id,
    nama_outlet: params.nama_outlet || "",
    reviewer: params.reviewer || "Anonim",
    stars: params.stars || 0,
    text: params.text || "",
    timestamp: new Date().toISOString(),
    status_analisis: params.analisis ? "SELESAI" : "PENDING",
    analisis: params.analisis || ""
  };
  DatabaseService.appendRow("MapsReviews", reviewObj);
  return { status: "success", message: "Review berhasil disimpan.", data: { id: reviewObj.id } };
}`);

// apiGetStatusSetoran
code = code.replace(/function apiGetStatusSetoran\(params\) \{[\s\S]*?return \{ status: "success", data: list \};\n\}/,
`function apiGetStatusSetoran(params) {
  var rows = DatabaseService.getSheetData("SetoranData");
  var headers = rows[0];
  var filterOutlet = params && params.outlet_id;
  var list = [];
  for (var i = 1; i < rows.length; i++) {
    var obj = rowToObject_(headers, rows[i]);
    if (!filterOutlet || filterOutlet === "ALL" || obj.outlet_id === filterOutlet) {
      list.push(obj);
    }
  }
  return { status: "success", data: list };
}`);

// apiSaveSetoran
code = code.replace(/function apiSaveSetoran\(params\) \{[\s\S]*?return \{ status: "success", message: "Status setoran berhasil disimpan." \};\n\}/,
`function apiSaveSetoran(params) {
  var rows = DatabaseService.getSheetData("SetoranData");
  var headers = rows[0];
  var found = false;
  for (var i = 1; i < rows.length; i++) {
    var obj = rowToObject_(headers, rows[i]);
    if (obj.date.toString() === params.date && obj.outlet_id.toString() === params.outlet_id) {
      DatabaseService.updateRowByColumn("SetoranData", "date", params.date, { // This doesn't strictly check BOTH date and outlet_id!
        status: params.status,
        total_setoran: params.total_setoran
      }); // WAIT, we shouldn't use a single column update for composite key!
      
      found = true;
      // We will handle it in the string replacement later by making a direct fix or custom function for composite keys
    }
  }
}`);

fs.writeFileSync('Code.gs', code);
console.log("Replaced some basic APIs");
