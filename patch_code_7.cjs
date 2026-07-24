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

const apiGetDashboardDataImpl = `function apiGetDashboardData(params) {
  var role = params.role;
  var filterOutlet = params.filterOutlet || "ALL";
  var filterTipeLayanan = params.filterTipeLayanan || "ALL";
  var dateStart = params.dateStart;
  var dateEnd = params.dateEnd;
  
  if (role !== "OWNER") {
    return { status: "error", message: "Akses Ditolak! Hanya role OWNER yang dapat membuka Dashboard." };
  }
  
  var sheetExp = getSheetByName("EXP_Resi");
  var sheetCrg = getSheetByName("CRG_Resi");
  var sheetBackup = getSheetByName("PreInput_Backup");
  var sheetOutlets = getSheetByName("Outlets");
  var sheetLogs = getSheetByName("AuditLogs");
  var sheetUsers = getSheetByName("Users");
  
  var dbExp = sheetExp.getDataRange().getValues();
  var dbCrg = sheetCrg.getDataRange().getValues();
  var dbBackup = sheetBackup.getDataRange().getValues();
  var dbOutlets = sheetOutlets.getDataRange().getValues();
  var dbLogs = sheetLogs.getDataRange().getValues();
  var dbUsers = sheetUsers.getDataRange().getValues();
  
  var headersExp = dbExp[0];
  var headersCrg = dbCrg[0];
  var headersBackup = dbBackup[0];
  var headersOutlets = dbOutlets[0];
  var headersLogs = dbLogs[0];
  var headersUsers = dbUsers[0];
  
  // Buat map preinput untuk lookup nama pengirim/penerima
  var backupMap = {};
  for (var k = 1; k < dbBackup.length; k++) {
    var objB = rowToObject_(headersBackup, dbBackup[k]);
    backupMap[objB.transaksi_id.toString()] = {
      pengirim: objB.nama_pengirim.toString(),
      penerima: objB.nama_penerima.toString()
    };
  }
  
  // Buat map user id ke nama lengkap
  var userMap = {};
  for (var u = 1; u < dbUsers.length; u++) {
    var objU = rowToObject_(headersUsers, dbUsers[u]);
    userMap[objU.user_id.toString()] = objU.nama_lengkap.toString();
  }
  
  var combined = [];
  
  // Proses Express Resi
  for (var i = 1; i < dbExp.length; i++) {
    var objE = rowToObject_(headersExp, dbExp[i]);
    var txId = objE.transaksi_id.toString();
    var lookup = backupMap[txId] || { pengirim: "Umum", penerima: "Umum" };
    combined.push({
      resi_id: objE.resi_id.toString(),
      transaksi_id: txId,
      timestamp: objE.timestamp.toString(),
      admin_id_pencatat: objE.admin_id_pencatat.toString(),
      outlet_id_input: objE.outlet_id_input.toString(),
      tipe_produk: objE.tipe_produk.toString(),
      grand_total: Number(objE.grand_total) || 0,
      setoran_ke_owner: Number(objE.setoran_ke_owner) || 0,
      kas_operasional: Number(objE.kas_operasional) || 0,
      tipe_layanan: "Express",
      pengirim: lookup.pengirim,
      penerima: lookup.penerima
    });
  }
  
  // Proses Cargo Resi
  for (var j = 1; j < dbCrg.length; j++) {
    var objC = rowToObject_(headersCrg, dbCrg[j]);
    var txIdC = objC.transaksi_id.toString();
    var lookupC = backupMap[txIdC] || { pengirim: "Umum", penerima: "Umum" };
    combined.push({
      resi_id: objC.resi_id.toString(),
      transaksi_id: txIdC,
      timestamp: objC.timestamp.toString(),
      admin_id_pencatat: objC.admin_id_pencatat.toString(),
      outlet_id_input: objC.outlet_id_input.toString(),
      tipe_produk: objC.tipe_produk.toString(),
      grand_total: Number(objC.grand_total) || 0,
      setoran_ke_owner: Number(objC.setoran_ke_owner) || 0,
      kas_operasional: Number(objC.kas_operasional) || 0,
      tipe_layanan: "Cargo",
      pengirim: lookupC.pengirim,
      penerima: lookupC.penerima
    });
  }
  
  // Filter Data
  var filtered = combined;
  if (filterOutlet !== "ALL") {
    filtered = filtered.filter(function(r) { return r.outlet_id_input === filterOutlet; });
  }
  if (filterTipeLayanan !== "ALL") {
    filtered = filtered.filter(function(r) { return r.tipe_layanan === filterTipeLayanan; });
  }
  if (dateStart) {
    var startMs = new Date(dateStart).getTime();
    filtered = filtered.filter(function(r) { return new Date(r.timestamp).getTime() >= startMs; });
  }
  if (dateEnd) {
    var endMs = new Date(dateEnd).getTime() + 86400000;
    filtered = filtered.filter(function(r) { return new Date(r.timestamp).getTime() <= endMs; });
  }
  
  // Akumulasi finansial
  var totalOmsetGlobal = 0;
  var totalSetoranOwner = 0;
  var totalKasOperasional = 0;
  
  filtered.forEach(function(r) {
    totalOmsetGlobal += r.grand_total;
    totalSetoranOwner += r.setoran_ke_owner;
    totalKasOperasional += r.kas_operasional;
  });
  
  // Akumulasi per-outlet
  var outletOmsetMap = {};
  for (var o = 1; o < dbOutlets.length; o++) {
    var objO = rowToObject_(headersOutlets, dbOutlets[o]);
    var oid = objO.outlet_id.toString();
    var name = objO.nama_outlet.toString().replace("J&T Express - ", "").replace("J&T Cargo - ", "");
    outletOmsetMap[oid] = { nama: name, omset: 0, setoran: 0, kas: 0, count: 0 };
  }
  
  filtered.forEach(function(r) {
    var outId = r.outlet_id_input;
    if (outletOmsetMap[outId]) {
      outletOmsetMap[outId].omset += r.grand_total;
      outletOmsetMap[outId].setoran += r.setoran_ke_owner;
      outletOmsetMap[outId].kas += r.kas_operasional;
      outletOmsetMap[outId].count += 1;
    }
  });
  
  var outletPerformance = Object.keys(outletOmsetMap).map(function(key) {
    return {
      outlet_id: key,
      nama: outletOmsetMap[key].nama,
      omset: outletOmsetMap[key].omset,
      setoran: outletOmsetMap[key].setoran,
      kas: outletOmsetMap[key].kas,
      count: outletOmsetMap[key].count
    };
  });
  
  // Format trend harian
  var dailyMap = {};
  filtered.forEach(function(r) {
    var dStr = r.timestamp.split("T")[0];
    if (!dailyMap[dStr]) dailyMap[dStr] = { date: dStr, Express: 0, Cargo: 0, total: 0 };
    dailyMap[dStr][r.tipe_layanan] += r.grand_total;
    dailyMap[dStr].total += r.grand_total;
  });
  
  var dailyTrend = Object.keys(dailyMap).sort().map(function(key) {
    return dailyMap[key];
  });
  
  // Format log audit (maks 50 baris terakhir yang cocok)
  var auditLogs = [];
  var filteredLogs = [];
  
  for (var logI = 1; logI < dbLogs.length; logI++) {
    var objL = rowToObject_(headersLogs, dbLogs[logI]);
    var logOutlet = objL.outlet_id.toString();
    var logTime = objL.timestamp.toString();
    
    if (filterOutlet !== "ALL" && logOutlet !== filterOutlet) continue;
    
    if (dateStart) {
      var startMsLog = new Date(dateStart).getTime();
      if (new Date(logTime).getTime() < startMsLog) continue;
    }
    
    if (dateEnd) {
      var endMsLog = new Date(dateEnd).getTime() + 86400000;
      if (new Date(logTime).getTime() > endMsLog) continue;
    }
    
    filteredLogs.push(objL);
  }
  
  // Balik agar terbaru di atas
  filteredLogs.reverse();
  
  var limit = Math.min(filteredLogs.length, 50);
  for (var logIdx = 0; logIdx < limit; logIdx++) {
    var objLFiltered = filteredLogs[logIdx];
    var logUid = objLFiltered.user_id.toString();
    auditLogs.push({
      log_id: objLFiltered.log_id.toString(),
      timestamp: objLFiltered.timestamp.toString(),
      user_id: logUid,
      nama_lengkap: userMap[logUid] || "Sistem",
      aksi: objLFiltered.aksi.toString(),
      detail: objLFiltered.detail.toString(),
      outlet_id: objLFiltered.outlet_id.toString()
    });
  }
  
  return {
    status: "success",
    data: {
      summary: {
        totalTransaksi: filtered.length,
        totalResiExpress: filtered.filter(function(r) { return r.tipe_layanan === "Express"; }).length,
        totalResiCargo: filtered.filter(function(r) { return r.tipe_layanan === "Cargo"; }).length,
        grandTotalCustomer: totalOmsetGlobal,
        totalWajibSetorOwner: totalSetoranOwner,
        totalKasOutlet: totalKasOperasional
      },
      outletPerformance: outletPerformance,
      dailyTrend: dailyTrend,
      auditLogs: auditLogs
    }
  };
}`;

code = replaceFunction(code, 'apiGetDashboardData', apiGetDashboardDataImpl);
fs.writeFileSync('Code.gs', code);
