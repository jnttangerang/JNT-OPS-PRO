const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf-8');

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

const apiGetRiwayatTransaksiImpl = `function apiGetRiwayatTransaksi(params) {
  var filterOutlet = params.filterOutlet || "ALL";
  
  var sheetExp = getSheetByName("EXP_Resi");
  var sheetCrg = getSheetByName("CRG_Resi");
  var sheetBackup = getSheetByName("PreInput_Backup");
  var sheetOutlets = getSheetByName("Outlets");
  var sheetUsers = getSheetByName("Users");
  
  var dbExp = sheetExp.getDataRange().getValues();
  var dbCrg = sheetCrg.getDataRange().getValues();
  var dbBackup = sheetBackup.getDataRange().getValues();
  var dbOutlets = sheetOutlets.getDataRange().getValues();
  var dbUsers = sheetUsers.getDataRange().getValues();
  
  var backupMap = {};
  var headersBackup = dbBackup[0];
  for (var k = 1; k < dbBackup.length; k++) {
    var obj = rowToObject_(headersBackup, dbBackup[k]);
    backupMap[obj.transaksi_id.toString()] = {
      pengirim: obj.nama_pengirim.toString(),
      penerima: obj.nama_penerima.toString()
    };
  }
  
  var outletMap = {};
  var headersOutlets = dbOutlets[0];
  for (var o = 1; o < dbOutlets.length; o++) {
    var objO = rowToObject_(headersOutlets, dbOutlets[o]);
    outletMap[objO.outlet_id.toString()] = objO.nama_outlet.toString();
  }
  
  var userMap = {};
  var headersUsers = dbUsers[0];
  for (var u = 1; u < dbUsers.length; u++) {
    var objU = rowToObject_(headersUsers, dbUsers[u]);
    userMap[objU.user_id.toString()] = objU.username.toString();
  }
  
  var transaksiList = [];
  
  // EXP_Resi
  var headersExp = dbExp[0];
  for (var i = 1; i < dbExp.length; i++) {
    var r = rowToObject_(headersExp, dbExp[i]);
    var outId = r.outlet_id_input.toString();
    if (filterOutlet !== "ALL" && outId !== filterOutlet) continue;
    
    var txId = r.transaksi_id.toString();
    var p = backupMap[txId] || { pengirim: "", penerima: "" };
    transaksiList.push({
      resi_id: r.resi_id.toString(),
      transaksi_id: txId,
      timestamp: r.timestamp.toString(),
      admin: userMap[r.admin_id_pencatat.toString()] || r.admin_id_pencatat.toString(),
      outlet: outletMap[outId] || outId,
      tipe: "Express",
      grand_total: parseFloat(r.grand_total) || 0,
      pengirim: p.pengirim,
      penerima: p.penerima,
      status_resi: r.status_resi ? r.status_resi.toString() : "AKTIF"
    });
  }
  
  // CRG_Resi
  var headersCrg = dbCrg[0];
  for (var j = 1; j < dbCrg.length; j++) {
    var c = rowToObject_(headersCrg, dbCrg[j]);
    var outIdC = c.outlet_id_input.toString();
    if (filterOutlet !== "ALL" && outIdC !== filterOutlet) continue;
    
    var txIdC = c.transaksi_id.toString();
    var pC = backupMap[txIdC] || { pengirim: "", penerima: "" };
    transaksiList.push({
      resi_id: c.resi_id.toString(),
      transaksi_id: txIdC,
      timestamp: c.timestamp.toString(),
      admin: userMap[c.admin_id_pencatat.toString()] || c.admin_id_pencatat.toString(),
      outlet: outletMap[outIdC] || outIdC,
      tipe: "Cargo",
      grand_total: parseFloat(c.grand_total) || 0,
      pengirim: pC.pengirim,
      penerima: pC.penerima,
      status_resi: c.status_resi ? c.status_resi.toString() : "AKTIF"
    });
  }
  
  transaksiList.sort(function(a, b) {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  
  return { status: "success", data: transaksiList };
}`;

const apiDeleteTransaksiImpl = `function apiDeleteTransaksi(params) {
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
    var colIdx = getColIndex_(sheetExp, "status_resi");
    
    for (var i = 1; i < dataExp.length; i++) {
      if (dataExp[i][0].toString() === resi_id) {
        if (colIdx !== -1) {
          sheetExp.getRange(i + 1, colIdx + 1).setValue("BATAL");
        }
        found = true;
        break;
      }
    }
  }
  
  if (!found && (tipe === "Cargo" || !tipe)) {
    var sheetCrg = getSheetByName("CRG_Resi");
    var dataCrg = sheetCrg.getDataRange().getValues();
    var colIdxCrg = getColIndex_(sheetCrg, "status_resi");
    
    for (var j = 1; j < dataCrg.length; j++) {
      if (dataCrg[j][0].toString() === resi_id) {
        if (colIdxCrg !== -1) {
          sheetCrg.getRange(j + 1, colIdxCrg + 1).setValue("BATAL");
        }
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
}`;

code = replaceFunction(code, 'apiGetRiwayatTransaksi', apiGetRiwayatTransaksiImpl);
code = replaceFunction(code, 'apiDeleteTransaksi', apiDeleteTransaksiImpl);

fs.writeFileSync('Code.gs', code);
