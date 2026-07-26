const fs = require('fs');

let code = fs.readFileSync('Code.gs', 'utf8');

// 1. Update DB_SCHEMA
code = code.replace(
  /SetoranData: \["date", "outlet_id", "status", "total_setoran"\]/g,
  'Master_Setoran: ["setoran_id", "tanggal", "outlet_id", "outlet_name", "admin_pembuat", "jumlah_resi", "total_setoran_owner", "total_kas_outlet", "status", "created_at", "approved_at", "approved_by", "catatan_owner"]'
);

// 2. Add initDatabaseSheets fallback modification? No need, it iterates DB_SCHEMA.

// 3. Replace handleRouting's setoran actions
code = code.replace(
  /case "getStatusSetoran":\n      return apiGetStatusSetoran\(params\);\n    case "saveSetoran":\n      return apiSaveSetoran\(params\);/g,
  `case "createSetoran":
      return apiCreateSetoran(params);
    case "approveSetoran":
      return apiApproveSetoran(params);
    case "rejectSetoran":
      return apiRejectSetoran(params);
    case "getSetoranList":
      return apiGetSetoranList(params);
    case "getSetoranDetail":
      return apiGetSetoranDetail(params);`
);

// 4. Find where apiGetStatusSetoran is defined and replace it and apiSaveSetoran with the new APIs.
// Wait, I can just append them, but replacing the old ones avoids orphaned code.
const setoranRegex = /function apiGetStatusSetoran\(params\) \{[\s\S]*?return \{ status: "success", message: "Status setoran berhasil disimpan\." \};\n\}/;
code = code.replace(setoranRegex, `/* NEW SETORAN ENGINE APIS */

function apiCreateSetoran(params) {
  var outletId = params.outlet_id;
  var tanggal = params.tanggal;
  var adminPembuat = params.admin_id || "SYSTEM";
  
  if (!outletId || !tanggal) {
    return { status: "error", message: "Parameter outlet_id dan tanggal diperlukan." };
  }
  
  // Prevent duplicate setoran for the same date and outlet that is not DITOLAK
  var existing = DatabaseService.getSheetData("Master_Setoran");
  var headers = existing[0];
  if (headers) {
    for (var i = 1; i < existing.length; i++) {
      var row = rowToObject_(headers, existing[i]);
      if (row.tanggal === tanggal && row.outlet_id === outletId && row.status !== "DITOLAK") {
        return { status: "error", message: "Setoran untuk tanggal ini sudah ada dan tidak dalam status DITOLAK." };
      }
    }
  }

  // Gather transactions
  var txDetail = getSetoranTransactions(tanggal, outletId);
  var data = txDetail.data;
  
  if (data.length === 0) {
    return { status: "error", message: "Tidak ada transaksi valid untuk disetor pada tanggal ini." };
  }
  
  var setoranId = "SET-" + new Date().getTime();
  var setoranObj = {
    setoran_id: setoranId,
    tanggal: tanggal,
    outlet_id: outletId,
    outlet_name: txDetail.outlet_name || outletId,
    admin_pembuat: adminPembuat,
    jumlah_resi: txDetail.jumlah_resi,
    total_setoran_owner: txDetail.total_setoran_owner,
    total_kas_outlet: txDetail.total_kas_outlet,
    status: "MENUNGGU_APPROVAL",
    created_at: new Date().toISOString(),
    approved_at: "",
    approved_by: "",
    catatan_owner: ""
  };
  
  DatabaseService.insertRow("Master_Setoran", setoranObj);
  
  DatabaseService.appendAudit(
    adminPembuat, 
    "SETORAN_CREATE", 
    "Membuat setoran harian untuk " + tanggal + " (Rp " + txDetail.total_setoran_owner + ")", 
    outletId
  );
  
  return { status: "success", message: "Setoran berhasil dibuat dan menunggu persetujuan.", data: setoranObj };
}

function apiApproveSetoran(params) {
  var setoranId = params.setoran_id;
  var adminId = params.admin_id; // The owner
  
  if (!setoranId) return { status: "error", message: "setoran_id diperlukan" };
  
  var existing = DatabaseService.findRowByColumn("Master_Setoran", "setoran_id", setoranId);
  if (!existing) return { status: "error", message: "Data setoran tidak ditemukan" };
  
  if (existing.status === "DISETUJUI") {
    return { status: "error", message: "Setoran ini sudah disetujui sebelumnya." };
  }
  
  var updateData = {
    status: "DISETUJUI",
    approved_at: new Date().toISOString(),
    approved_by: adminId || "OWNER"
  };
  
  DatabaseService.updateRowByColumn("Master_Setoran", "setoran_id", setoranId, updateData);
  
  DatabaseService.appendAudit(
    updateData.approved_by,
    "SETORAN_APPROVE",
    "Menyetujui setoran " + setoranId + " tanggal " + existing.tanggal,
    existing.outlet_id
  );
  
  return { status: "success", message: "Setoran berhasil disetujui." };
}

function apiRejectSetoran(params) {
  var setoranId = params.setoran_id;
  var adminId = params.admin_id; // The owner
  var catatan = params.catatan || "";
  
  if (!setoranId) return { status: "error", message: "setoran_id diperlukan" };
  
  var existing = DatabaseService.findRowByColumn("Master_Setoran", "setoran_id", setoranId);
  if (!existing) return { status: "error", message: "Data setoran tidak ditemukan" };
  
  if (existing.status === "DISETUJUI") {
    return { status: "error", message: "Setoran yang sudah disetujui tidak dapat ditolak." };
  }
  
  var updateData = {
    status: "DITOLAK",
    catatan_owner: catatan,
    approved_by: adminId || "OWNER"
  };
  
  DatabaseService.updateRowByColumn("Master_Setoran", "setoran_id", setoranId, updateData);
  
  DatabaseService.appendAudit(
    updateData.approved_by,
    "SETORAN_REJECT",
    "Menolak setoran " + setoranId + " tanggal " + existing.tanggal + " (" + catatan + ")",
    existing.outlet_id
  );
  
  return { status: "success", message: "Setoran berhasil ditolak." };
}

function apiGetSetoranList(params) {
  var outletId = params.outlet_id;
  var status = params.status;
  
  var rows = DatabaseService.getSheetData("Master_Setoran");
  var headers = rows[0];
  var list = [];
  
  for (var i = 1; i < rows.length; i++) {
    var obj = rowToObject_(headers, rows[i]);
    if (outletId && outletId !== "ALL" && obj.outlet_id !== outletId) continue;
    if (status && status !== "ALL" && obj.status !== status) continue;
    list.push(obj);
  }
  
  return { status: "success", data: list.reverse() }; // newest first
}

function apiGetSetoranDetail(params) {
  var tanggal = params.tanggal;
  var outletId = params.outlet_id;
  
  if (!tanggal || !outletId) {
    return { status: "error", message: "Parameter tanggal dan outlet_id diperlukan." };
  }
  
  var detail = getSetoranTransactions(tanggal, outletId);
  return { status: "success", data: detail };
}

function getSetoranTransactions(tanggal, outletId) {
  var expData = DatabaseService.getSheetData("EXP_Resi");
  var crgData = DatabaseService.getSheetData("CRG_Resi");
  var outletData = DatabaseService.getSheetData("Outlets");
  
  var outletName = outletId;
  if (outletData && outletData.length > 0) {
    for (var o = 1; o < outletData.length; o++) {
      if (outletData[o][0].toString() === outletId) {
        outletName = outletData[o][1].toString();
        break;
      }
    }
  }
  
  var expHeaders = expData[0];
  var crgHeaders = crgData[0];
  
  var list = [];
  var totalSetoranOwner = 0;
  var totalKasOutlet = 0;
  
  // Exclude BATAL status
  if (expHeaders) {
    for (var i = 1; i < expData.length; i++) {
      var rExp = rowToObject_(expHeaders, expData[i]);
      if (rExp.outlet_id_input === outletId && rExp.status_resi !== "BATAL") {
        var txDate = rExp.timestamp ? rExp.timestamp.toString().split("T")[0] : "";
        if (txDate === tanggal) {
           rExp.tipe_layanan = "Express";
           list.push(rExp);
           totalSetoranOwner += Number(rExp.setoran_ke_owner) || 0;
           totalKasOutlet += Number(rExp.kas_operasional) || 0;
        }
      }
    }
  }
  
  if (crgHeaders) {
    for (var j = 1; j < crgData.length; j++) {
      var rCrg = rowToObject_(crgHeaders, crgData[j]);
      if (rCrg.outlet_id_input === outletId && rCrg.status_resi !== "BATAL") {
        var txDateC = rCrg.timestamp ? rCrg.timestamp.toString().split("T")[0] : "";
        if (txDateC === tanggal) {
           rCrg.tipe_layanan = "Cargo";
           list.push(rCrg);
           totalSetoranOwner += Number(rCrg.setoran_ke_owner) || 0;
           totalKasOutlet += Number(rCrg.kas_operasional) || 0;
        }
      }
    }
  }
  
  return {
    outlet_name: outletName,
    jumlah_resi: list.length,
    total_setoran_owner: totalSetoranOwner,
    total_kas_outlet: totalKasOutlet,
    data: list
  };
}
`);

// 5. Transaction Lock
const txLockRegex = /checkTransactionLock: function\(dateStr, outletId\) \{[\s\S]*?return false; \/\/ UNLOCKED\n  \},/;
code = code.replace(txLockRegex, `checkTransactionLock: function(dateStr, outletId) {
     if (!dateStr) return false;
     var setoranData = DatabaseService.getSheetData("Master_Setoran");
     for (var i = 1; i < setoranData.length; i++) {
        var sDate = setoranData[i][1].toString();
        var sOutlet = setoranData[i][2].toString();
        var sStatus = setoranData[i][8].toString();
        
        if (sDate === dateStr && sOutlet === outletId) {
           if (sStatus === "DISETUJUI" || sStatus === "MENUNGGU_APPROVAL") {
               return true; // LOCKED
           }
        }
     }
     return false; // UNLOCKED
  },`);

fs.writeFileSync('Code.gs', code);
console.log("Patched Code.gs");
