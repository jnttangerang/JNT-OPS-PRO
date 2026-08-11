const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

// apiGetPreInput
code = code.replace(/function apiGetPreInput\(params\) \{[\s\S]*?return \{ status: "error", message: "Transaksi Pre-Input tidak ditemukan" \};\n\}/,
`function apiGetPreInput(params) {
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
  return { status: "error", message: "Transaksi Pre-Input tidak ditemukan" };
}`);

// apiSaveMapsReview
code = code.replace(/function apiSaveMapsReview\(params\) \{[\s\S]*?return \{ status: "success", message: "Review berhasil disimpan.", data: \{ id: reviewObj.id \} \};\n\}/,
`function apiSaveMapsReview(params) {
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
}`);

fs.writeFileSync('Code.gs', code);
console.log("Fixed two more");
