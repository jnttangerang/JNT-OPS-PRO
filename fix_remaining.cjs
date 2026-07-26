const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

// apiSearchCustomer
code = code.replace(/function apiSearchCustomer\(params\) \{[\s\S]*?return \{ status: "success", data: results \};\n\}/,
`function apiSearchCustomer(params) {
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
}`);

// apiGetRiwayatPenerima
code = code.replace(/function apiGetRiwayatPenerima\(params\) \{[\s\S]*?return \{ status: "success", data: results \};\n\}/,
`function apiGetRiwayatPenerima(params) {
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
}`);

// apiGetPreInput
code = code.replace(/function apiGetPreInput\(params\) \{[\s\S]*?return \{ status: "success", data: results \};\n\}/,
`function apiGetPreInput(params) {
  var outletId = params.outlet_id;
  var rows = DatabaseService.getSheetData("PreInput_Backup");
  var results = [];
  var statusIdx = DB_SCHEMA.PreInput_Backup.indexOf("status");
  var outletIdx = DB_SCHEMA.PreInput_Backup.indexOf("outlet_id_tugas");
  for (var i = 1; i < rows.length; i++) {
    var stat = rows[i][statusIdx].toString();
    var out = rows[i][outletIdx].toString();
    if (stat === "PENDING" && (!outletId || out === outletId)) {
      var obj = rowToObject_(DB_SCHEMA.PreInput_Backup, rows[i]);
      results.push(obj);
    }
  }
  return { status: "success", data: results };
}`);

// apiGetMapsReviews and apiUpdateReviewAnalysis
code = code.replace(/var sheet = getSheetByName\("MapsReviews"\);\n  var rows = sheet\.getDataRange\(\)\.getValues\(\);/g, `var rows = DatabaseService.getSheetData("MapsReviews");`);
code = code.replace(/var colAnalysis = getColIndex_\(sheet, "analisis"\);/g, `var colAnalysis = getColIndex_(getSheetByName("MapsReviews"), "analisis"); // We can use DatabaseService instead of getSheetByName but wait, I can just use DatabaseService.updateRowByColumn`);

// Actually let's just manually replace apiUpdateReviewAnalysis since it might be easier
code = code.replace(/function apiUpdateReviewAnalysis\(params\) \{[\s\S]*?return \{ status: "error", message: "Review tidak ditemukan." \};\n\}/, 
`function apiUpdateReviewAnalysis(params) {
  var reviewId = params.review_id;
  var analisis = params.analisis;
  if (!reviewId || !analisis) return { status: "error", message: "Data tidak lengkap" };
  
  var success = DatabaseService.updateRowByColumn("MapsReviews", "id", reviewId, {
    status_analisis: "SELESAI",
    analisis: analisis
  });
  
  if (success) {
    return { status: "success", message: "Analisis review berhasil diupdate." };
  } else {
    return { status: "error", message: "Review tidak ditemukan." };
  }
}`);

fs.writeFileSync('Code.gs', code);
console.log("Fixed more");
