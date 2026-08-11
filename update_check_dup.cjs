const fs = require('fs');

const code = `
function apiCheckDuplicateResi(params) {
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
}
`;
fs.writeFileSync('new_apiCheckDuplicate.js', code);
console.log("done");
