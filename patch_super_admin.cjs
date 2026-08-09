const fs = require('fs');

function removeSuperAdmin(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/ && session\.role !== "SUPER_ADMIN"/g, '');
  content = content.replace(/ \|\| userRole === "SUPER_ADMIN"/g, '');
  content = content.replace(/ \|\| userRole === "SUPER_ADMIN"/g, ''); // just in case
  content = content.replace(/ && actor\.actor_role !== "SUPER_ADMIN"/g, '');
  content = content.replace(/ ATAU SUPER_ADMIN/g, '');
  content = content.replace(/ atau SUPER_ADMIN/g, '');
  content = content.replace(/ \|\| upperRole === "SUPER_ADMIN"/g, '');
  content = content.replace(/ \|\| role === "SUPER_ADMIN" \|\| role === "SUPERADMIN" \|\| role === "OWNER_APPROVAL"/g, '');
  content = content.replace(/ \|\| role === "SUPER_ADMIN" \|\| role === "SUPERADMIN"/g, '');
  content = content.replace(/ && role !== "SUPER_ADMIN"/g, '');
  content = content.replace(/ && role !== "SUPERADMIN"/g, '');
  content = content.replace(/ && role !== "OWNER_APPROVAL"/g, '');
  content = content.replace(/OWNER atau SUPER_ADMIN/g, 'OWNER');
  content = content.replace(/OWNER or SUPER_ADMIN/g, 'OWNER');
  fs.writeFileSync(file, content);
}

removeSuperAdmin('src/components/owner/ManagementControlTowerPage.tsx');
removeSuperAdmin('src/components/settlement/FinancialSettlementPanel.tsx');
removeSuperAdmin('src/lib/financialCloseCertificationEngine.ts');
removeSuperAdmin('src/lib/reconciliationReviewEngine.ts');
removeSuperAdmin('src/lib/settlementEngine.ts');
removeSuperAdmin('src/lib/dailyClosingEngine.ts');
