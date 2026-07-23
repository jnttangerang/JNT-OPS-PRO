import fs from 'fs';
let code = fs.readFileSync('src/types.ts', 'utf-8');

code = code.replace(
  /export interface Outlet \{\n  outlet_id: string;\n  nama_outlet: string;\n  alamat_outlet: string;\n\}/g,
  `export interface Outlet {\n  outlet_id: string;\n  nama_outlet: string;\n  alamat_outlet: string;\n  target_resi_harian?: number;\n  target_resi_bulanan?: number;\n}`
);
fs.writeFileSync('src/types.ts', code);
