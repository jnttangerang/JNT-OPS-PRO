const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  `    if (!parsed.MASTER_CUSTOMER || !Array.isArray(parsed.MASTER_CUSTOMER) || parsed.MASTER_CUSTOMER.length === 0) {
      syncExistingDataToThreeLayers(parsed);
      updated = true;
    }`,
  `    if (!parsed.MASTER_CUSTOMER || !Array.isArray(parsed.MASTER_CUSTOMER) || parsed.MASTER_CUSTOMER.length === 0) {
      syncExistingDataToThreeLayers(parsed);
      updated = true;
    }

    // Ensure all critical arrays exist
    const criticalArrays = [
      "Users", "Outlets", "EXP_Resi", "CRG_Resi", "PreInput_Backup", "MASTER_TRANSAKSI",
      "Master_Setoran", "SetoranData", "AuditLogs", "KeuanganOutlet", "MASTER_CUSTOMER",
      "MASTER_PENGIRIMAN", "DailyClosing", "Exceptions", "SettlementRecords", "FinancialCertifications", "WorkflowCases",
      "ManagementReviews"
    ];
    for (const key of criticalArrays) {
      if (!parsed[key] || !Array.isArray(parsed[key])) {
        parsed[key] = [];
        updated = true;
      }
    }`
);

fs.writeFileSync('server.ts', code);
