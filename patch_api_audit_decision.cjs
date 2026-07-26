const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

const apiString = `
function apiUpdateAuditDecision(params) {
  var resiId = params.resi_id;
  var auditStatus = params.audit_status;
  var auditNote = params.audit_note || "";
  var ownerId = params.owner_id || "OWNER";
  
  if (!resiId || !auditStatus) {
    return { status: "error", message: "resi_id dan audit_status diperlukan" };
  }
  
  var expRow = DatabaseService.findRowByColumn("EXP_Resi", "resi_id", resiId);
  var crgRow = DatabaseService.findRowByColumn("CRG_Resi", "resi_id", resiId);
  
  var targetSheet = expRow ? "EXP_Resi" : (crgRow ? "CRG_Resi" : null);
  var existingTx = expRow || crgRow;
  
  if (!targetSheet) {
    return { status: "error", message: "Data transaksi tidak ditemukan" };
  }
  
  var sheet = getSheetByName(targetSheet);
  var headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  if (headers.indexOf("owner_audit_status") === -1) {
    sheet.getRange(1, headers.length + 1).setValue("owner_audit_status");
    sheet.getRange(1, headers.length + 2).setValue("owner_audit_note");
    sheet.getRange(1, headers.length + 3).setValue("owner_audited_by");
    sheet.getRange(1, headers.length + 4).setValue("owner_audited_at");
  }
  
  var updateData = {
    owner_audit_status: auditStatus,
    owner_audit_note: auditNote,
    owner_audited_by: ownerId,
    owner_audited_at: new Date().toISOString()
  };
  
  DatabaseService.updateRowByColumn(targetSheet, "resi_id", resiId, updateData);
  
  DatabaseService.appendAudit(
    ownerId,
    "AUDIT_DECISION",
    "Audit " + resiId + ": " + auditStatus,
    existingTx.outlet_id_input
  );
  
  return { status: "success", message: "Keputusan audit berhasil disimpan" };
}
`;

code += "\n\n" + apiString;

const replacement = `case "getAuditData":
      return apiGetAuditData(params);
    case "updateAuditDecision":
      return apiUpdateAuditDecision(params);`;
code = code.replace(/case "getAuditData":\s*return apiGetAuditData\(params\);/, replacement);

fs.writeFileSync('Code.gs', code);
console.log("Patched Code.gs with apiUpdateAuditDecision");
