import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

// Also remove it from getDashboardData filterOutlet check
code = code.replace(
  `  if (filterOutlet && filterOutlet !== "ALL") {\n    filtered = filtered.filter((r: any) => r.outlet_id_input === filterOutlet);\n  }`,
  `  if (filterOutlet) {\n    filtered = filtered.filter((r: any) => r.outlet_id_input === filterOutlet);\n  }`
);

// target harian
code = code.replace(
  `const targetTotal = (filterOutlet && filterOutlet !== "ALL") ? targetPerOutlet : db.Outlets.length * targetPerOutlet;`,
  `const targetTotal = targetPerOutlet;`
);

fs.writeFileSync('server.ts', code);
