const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

const regexExp = /"kas_operasional", "status_resi"\]/;
const replacementExp = `"kas_operasional", "status_resi", "owner_audit_status", "owner_audit_note", "owner_audited_by", "owner_audited_at"]`;

code = code.replace(regexExp, replacementExp).replace(regexExp, replacementExp);

fs.writeFileSync('Code.gs', code);
console.log("Patched DB_SCHEMA");
