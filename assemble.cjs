const fs = require('fs');

const dbServiceCode = fs.readFileSync('test_refactor.cjs', 'utf8').match(/var DatabaseService = \{[\s\S]*?\};\n/)[0];
const txServiceCode = fs.readFileSync('generated_tx.js', 'utf8');

let code = fs.readFileSync('Code.gs', 'utf8');

// Replace writeAuditLog
const writeAuditRegex = /\/\*\*\n \* Menulis Baris Log Baru ke AuditLogs\n \*\/\nfunction writeAuditLog[\s\S]*?Logger\.log\("Audit log failed: " \+ e\.toString\(\)\);\n  \}\n\}/;
code = code.replace(writeAuditRegex, `/**
 * Menulis Baris Log Baru ke AuditLogs
 */
function writeAuditLog(userId, action, detail, outletId) {
  try {
    DatabaseService.appendAudit(userId, action, detail, outletId);
  } catch (e) {
    Logger.log("Audit log failed: " + e.toString());
  }
}`);

// Replace TransactionService
const txServiceRegex = /var TransactionService = \{[\s\S]*?deleteTransaction: function\(resiId, userId, outletId, tipeLayanan\) \{[\s\S]*?\}\n\};\n/;
code = code.replace(txServiceRegex, "");

// Add DB Service and TX Service at the end
code += "\n\n" + dbServiceCode + "\n\n" + txServiceCode;

// Replace apiCheckDuplicateResi
const apiDupRegex = /function apiCheckDuplicateResi\(params\) \{[\s\S]*?return \{ status: "success", isDuplicate: false \};\n\}/;
const newApiDup = `function apiCheckDuplicateResi(params) {
  try {
    var resiId = (params.resi_id || "").toString().trim();
    if (!resiId) {
      return { status: "success", isDuplicate: false };
    }
    var isValid = TransactionService.validateTransaction(resiId);
    return { status: "success", isDuplicate: !isValid };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}`;
code = code.replace(apiDupRegex, newApiDup);

fs.writeFileSync('Code.gs', code);
