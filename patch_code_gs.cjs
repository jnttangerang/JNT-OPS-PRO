const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

const target1 = `    var existingIndex = -1;
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === transaksiId) {
        existingIndex = i;
        break;
      }
    }`;

const replacement1 = `    var existingIndex = -1;
    var hpNormInput = (params.hp_pengirim || "").toString().replace(/\\D/g, "");
    
    for (var i = 1; i < rows.length; i++) {
      if (transaksiId && rows[i][0] === transaksiId) {
        existingIndex = i;
        break;
      }
    }
    
    // Check duplication if not explicitly found by ID
    if (existingIndex === -1 && hpNormInput) {
      var hpIndex = headers.indexOf("hp_pengirim");
      var statusIndex = headers.indexOf("status");
      for (var i = 1; i < rows.length; i++) {
        var rowHp = hpIndex !== -1 ? (rows[i][hpIndex] || "").toString().replace(/\\D/g, "") : "";
        var rowStatus = statusIndex !== -1 ? rows[i][statusIndex] : "";
        if (rowHp === hpNormInput && (rowStatus === "Draft" || rowStatus === "INPUT_YOYI")) {
          existingIndex = i;
          transaksiId = rows[i][0]; // Re-use the existing transaction ID
          break;
        }
      }
    }
`;

code = code.replace(target1, replacement1);

const deleteDraftCode = `
function apiDeletePreInputDraft(params) {
  try {
    var txId = params.transaksi_id;
    if (!txId) return { status: "error", message: "ID Transaksi diperlukan." };
    
    var sheet = getSheetByName("PreInput_Backup");
    if (!sheet) return { status: "error", message: "Sheet tidak ditemukan" };
    
    var data = sheet.getDataRange().getValues();
    var deleted = false;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === txId) {
        sheet.deleteRow(i + 1);
        deleted = true;
        break;
      }
    }
    
    if (deleted) {
      logAudit(params.admin_id || "System", "DELETE_DRAFT", "Menghapus draft " + txId);
      return { status: "success", message: "Draft berhasil dihapus." };
    }
    return { status: "error", message: "Draft tidak ditemukan." };
  } catch(e) {
    return { status: "error", message: e.message };
  }
}
`;

code = code.replace(`function apiSaveDataPreInput(params) {`, deleteDraftCode + `\nfunction apiSaveDataPreInput(params) {`);

code = code.replace(`case "saveDataPreInput":
      return apiSaveDataPreInput(params);`, `case "saveDataPreInput":
      return apiSaveDataPreInput(params);
    case "deletePreInputDraft":
      return apiDeletePreInputDraft(params);`);

fs.writeFileSync('Code.gs', code);
console.log("Code.gs patched!");
