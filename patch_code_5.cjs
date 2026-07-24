const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf-8');

const newFunctions = `
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
`;

fs.appendFileSync('Code.gs', newFunctions);
