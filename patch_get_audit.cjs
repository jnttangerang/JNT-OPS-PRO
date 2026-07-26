const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

const regexExp = /var auditStatus = "BELUM_DIAUDIT";\s*if \(sStatus === "DISETUJUI"\) \{\s*if \(totalCust === 0\) auditStatus = "PERLU_REVIEW";\s*else if \(selisih < 0\) auditStatus = "SELISIH";\s*else auditStatus = "SESUAI";\s*\}/;

const replacementExp = `var auditStatus = "BELUM_DIAUDIT";
      if (tx.owner_audit_status) {
         auditStatus = tx.owner_audit_status;
      } else if (sStatus === "DISETUJUI") {
         if (totalCust === 0) auditStatus = "PERLU_REVIEW";
         else if (selisih < 0) auditStatus = "SELISIH";
         else auditStatus = "SESUAI";
      }`;

code = code.replace(regexExp, replacementExp);

const regexCrg = /var cAuditStatus = "BELUM_DIAUDIT";\s*if \(sStatusC === "DISETUJUI"\) \{\s*if \(cTotalCust === 0\) cAuditStatus = "PERLU_REVIEW";\s*else if \(cSelisih < 0\) cAuditStatus = "SELISIH";\s*else cAuditStatus = "SESUAI";\s*\}/;

const replacementCrg = `var cAuditStatus = "BELUM_DIAUDIT";
      if (tc.owner_audit_status) {
         cAuditStatus = tc.owner_audit_status;
      } else if (sStatusC === "DISETUJUI") {
         if (cTotalCust === 0) cAuditStatus = "PERLU_REVIEW";
         else if (cSelisih < 0) cAuditStatus = "SELISIH";
         else cAuditStatus = "SESUAI";
      }`;

code = code.replace(regexCrg, replacementCrg);

// Also need to push audit_note if present
const regexExpPush = /audit_status: auditStatus,\s*timestamp: tx\.timestamp/;
const repExpPush = `audit_status: auditStatus,
        audit_note: tx.owner_audit_note || "",
        audited_by: tx.owner_audited_by || "",
        timestamp: tx.timestamp`;
code = code.replace(regexExpPush, repExpPush);

const regexCrgPush = /audit_status: cAuditStatus,\s*timestamp: tc\.timestamp/;
const repCrgPush = `audit_status: cAuditStatus,
        audit_note: tc.owner_audit_note || "",
        audited_by: tc.owner_audited_by || "",
        timestamp: tc.timestamp`;
code = code.replace(regexCrgPush, repCrgPush);

fs.writeFileSync('Code.gs', code);
console.log("Patched apiGetAuditData to include owner audit fields");
