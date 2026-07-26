const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

const apiString = `
function apiValidateClosing(params) {
  var closingDate = params.closing_date;
  var outletId = params.outlet_id;
  
  if (!closingDate || !outletId) {
    return { status: "error", message: "closing_date dan outlet_id diperlukan" };
  }
  
  // 1. Check if already closed
  var closingData = DatabaseService.getSheetData("Daily_Closing");
  if (closingData && closingData.length > 0) {
    var cHeaders = closingData[0];
    for (var c = 1; c < closingData.length; c++) {
      var cr = rowToObject_(cHeaders, closingData[c]);
      if (cr.closing_date === closingDate && cr.outlet_id === outletId && cr.status === "CLOSED") {
        return { 
          status: "success", 
          is_valid: true,
          is_closed: true,
          message: "Hari ini sudah di-closing",
          data: cr
        };
      }
    }
  }

  var validations = [];
  var isSuccess = true;
  
  // Gather Setoran for this date and outlet
  var setoranData = DatabaseService.getSheetData("Master_Setoran");
  var setoranHeaders = setoranData[0];
  var relatedSetorans = [];
  if (setoranHeaders) {
    for (var i = 1; i < setoranData.length; i++) {
      var row = rowToObject_(setoranHeaders, setoranData[i]);
      if (row.tanggal === closingDate && row.outlet_id === outletId) {
        relatedSetorans.push(row);
      }
    }
  }
  
  // Check Setoran status
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
    summary: summary
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
  
  var s = valResult.summary;
  
  var closingObj = {
    closing_date: closingDate,
    outlet_id: outletId,
    closed_by: ownerId,
    closed_at: new Date().toISOString(),
    total_transactions: s.total_transactions,
    total_customer_payment: s.total_customer_payment,
    total_setoran_owner: s.total_setoran_owner,
    total_kas_operasional: s.total_kas_operasional,
    total_yoyi: s.total_yoyi,
    total_selisih: s.total_selisih,
    status: "CLOSED"
  };
  
  DatabaseService.insertRow("Daily_Closing", closingObj);
  
  DatabaseService.appendAudit(
    ownerId,
    "DAILY_CLOSING",
    "Melakukan closing untuk tanggal " + closingDate,
    outletId
  );
  
  return { status: "success", message: "Closing harian berhasil diselesaikan.", data: closingObj };
}
`;

code += "\n\n" + apiString;

const switchReplacement = `case "updateAuditDecision":
      return apiUpdateAuditDecision(params);
    case "validateClosing":
      return apiValidateClosing(params);
    case "executeClosing":
      return apiExecuteClosing(params);`;
      
code = code.replace(/case "updateAuditDecision":\s*return apiUpdateAuditDecision\(params\);/, switchReplacement);

fs.writeFileSync('Code.gs', code);
console.log("Patched Code.gs with Closing API");
