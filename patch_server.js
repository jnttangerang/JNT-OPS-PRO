import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

// 1. Remove filterAdmin from destructuring in getAdminDashboardData
code = code.replace(
  'const { user_id, role, filterOutlet, filterAdmin, dateStart, dateEnd } = req.body;',
  'const { user_id, role, filterOutlet, dateStart, dateEnd } = req.body;'
);

// 2. Remove the application of filterAdmin
code = code.replace(
  `  if (filterAdmin && filterAdmin !== "ALL") {\n    filtered = filtered.filter((r: any) => r.admin_id_pencatat === filterAdmin);\n  }\n`,
  ''
);

fs.writeFileSync('server.ts', code);
