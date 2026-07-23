import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

// Remove ALL support for getAdminDashboardData
code = code.replace(
  `  if (filterOutlet && filterOutlet !== "ALL") {\n    filtered = filtered.filter((r: any) => r.outlet_id_input === filterOutlet);\n  }`,
  `  if (filterOutlet) {\n    filtered = filtered.filter((r: any) => r.outlet_id_input === filterOutlet);\n  }`
);

// Also remove it from currentResiToday
code = code.replace(
  `const currentResiToday = combined.filter((r:any) => r.timestamp.startsWith(todayStr) && (filterOutlet === "ALL" || r.outlet_id_input === filterOutlet)).length;`,
  `const currentResiToday = combined.filter((r:any) => r.timestamp.startsWith(todayStr) && r.outlet_id_input === filterOutlet).length;`
);

// Also remove it from targetHarian
code = code.replace(
  `const targetHarian = 50 * (filterOutlet === "ALL" ? db.Outlets.length : 1);`,
  `const targetHarian = 50;`
);

// Also remove it from cancelLogs
code = code.replace(
  `const cancelLogs = db.AuditLogs.filter((l: any) => l.aksi === "BATAL_TRANSAKSI" && (filterOutlet === "ALL" || l.outlet_id === filterOutlet));`,
  `const cancelLogs = db.AuditLogs.filter((l: any) => l.aksi === "BATAL_TRANSAKSI" && l.outlet_id === filterOutlet);`
);

fs.writeFileSync('server.ts', code);
