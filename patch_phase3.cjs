const fs = require('fs');

let code = fs.readFileSync('Code.gs', 'utf8');

// 1. Update apiGetSetoranList to support date range
const listRegex = /function apiGetSetoranList\(params\) \{[\s\S]*?return \{ status: "success", data: list\.reverse\(\) \}; \/\/ newest first\n\}/;
code = code.replace(listRegex, `function apiGetSetoranList(params) {
  var outletId = params.outlet_id;
  var status = params.status;
  var dateStart = params.date_start;
  var dateEnd = params.date_end;
  
  var rows = DatabaseService.getSheetData("Master_Setoran");
  if (!rows || rows.length < 2) return { status: "success", data: [] };
  
  var headers = rows[0];
  var list = [];
  
  for (var i = 1; i < rows.length; i++) {
    var obj = rowToObject_(headers, rows[i]);
    if (outletId && outletId !== "ALL" && obj.outlet_id !== outletId) continue;
    if (status && status !== "ALL" && obj.status !== status) continue;
    
    if (dateStart && obj.tanggal < dateStart) continue;
    if (dateEnd && obj.tanggal > dateEnd) continue;
    
    list.push(obj);
  }
  
  return { status: "success", data: list.reverse() }; // newest first
}`);

// 2. Update apiGetSetoranDetail to include Settlement Header
const detailRegex = /function apiGetSetoranDetail\(params\) \{[\s\S]*?return \{ status: "success", data: detail \};\n\}/;
code = code.replace(detailRegex, `function apiGetSetoranDetail(params) {
  var setoranId = params.setoran_id;
  var header = null;
  
  if (setoranId) {
    header = DatabaseService.findRowByColumn("Master_Setoran", "setoran_id", setoranId);
  } else {
    var tanggal = params.tanggal;
    var outletId = params.outlet_id;
    if (!tanggal || !outletId) {
      return { status: "error", message: "Parameter setoran_id atau (tanggal dan outlet_id) diperlukan." };
    }
    
    var rows = DatabaseService.getSheetData("Master_Setoran");
    var headers = rows[0];
    for (var i = 1; i < rows.length; i++) {
       var rowObj = rowToObject_(headers, rows[i]);
       if (rowObj.tanggal === tanggal && rowObj.outlet_id === outletId && rowObj.status !== "DITOLAK") {
          header = rowObj;
          break;
       }
    }
    // If not found active, try finding any
    if (!header) {
       for (var j = 1; j < rows.length; j++) {
         var rObj = rowToObject_(headers, rows[j]);
         if (rObj.tanggal === tanggal && rObj.outlet_id === outletId) {
            header = rObj;
            break;
         }
       }
    }
  }
  
  if (!header) {
    return { status: "error", message: "Data setoran tidak ditemukan." };
  }
  
  var detail = getSetoranTransactions(header.tanggal, header.outlet_id);
  
  return { 
    status: "success", 
    data: {
      header: header,
      summary: {
        outlet_name: detail.outlet_name,
        jumlah_resi: detail.jumlah_resi,
        total_setoran_owner: detail.total_setoran_owner,
        total_kas_outlet: detail.total_kas_outlet
      },
      transactions: detail.data
    } 
  };
}`);

fs.writeFileSync('Code.gs', code);
console.log("Patched Phase 3");
