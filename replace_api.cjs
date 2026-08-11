const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

// apiGetOutlets
code = code.replace(/function apiGetOutlets\(\) \{[\s\S]*?return \{ status: "success", data: outlets \};\n\}/,
`function apiGetOutlets() {
  var rows = DatabaseService.getSheetData("Outlets");
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

// apiGetMapsReviews
code = code.replace(/function apiGetMapsReviews\(params\) \{[\s\S]*?return \{ status: "success", data: result \};\n\}/,
`function apiGetMapsReviews(params) {
  var outletId = params.outlet_id;
  if (!outletId) return { status: "error", message: "Parameter outlet_id diperlukan" };
  var rows = DatabaseService.getSheetData("MapsReviews");
  var headers = rows[0];
  var result = [];
  for (var i = 1; i < rows.length; i++) {
    var obj = rowToObject_(headers, rows[i]);
    if (obj.outlet_id === outletId) result.push(obj);
  }
  return { status: "success", data: result };
}`);

// apiUpdateReviewAnalysis
code = code.replace(/function apiUpdateReviewAnalysis\(params\) \{[\s\S]*?return \{ status: "success", message: "Analisis review berhasil diupdate." \};\n\}/,
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
console.log("Fixed more APIs");
