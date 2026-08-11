const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

const auditApi = `
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
      if (sStatus === "DISETUJUI") {
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
      if (sStatusC === "DISETUJUI") {
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
`;

// Insert the new API at the end of the file
code += "\n\n" + auditApi;
fs.writeFileSync('Code.gs', code);
console.log("Added apiGetAuditData to Code.gs");
