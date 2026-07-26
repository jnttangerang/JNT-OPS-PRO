const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

const rejectRegex = /var updateData = \{\s*status: "DITOLAK",\s*catatan_owner: catatan,\s*approved_by: adminId \|\| "OWNER"\s*\};/;
code = code.replace(rejectRegex, `var updateData = {
    status: "DITOLAK",
    catatan_owner: catatan,
    approved_at: new Date().toISOString(),
    approved_by: adminId || "OWNER"
  };`);
fs.writeFileSync('Code.gs', code);
console.log("Patched reject");
