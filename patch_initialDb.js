import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(
  /"alamat_outlet": "Jl. Karawaci Raya No.12, Karawaci, Tangerang"\n    \},/g,
  `"alamat_outlet": "Jl. Karawaci Raya No.12, Karawaci, Tangerang",\n      "target_resi_harian": 50,\n      "target_resi_bulanan": 1500\n    },`
);

code = code.replace(
  /"alamat_outlet": "Jl. M.H. Thamrin No.8, Cikokol, Tangerang"\n    \},/g,
  `"alamat_outlet": "Jl. M.H. Thamrin No.8, Cikokol, Tangerang",\n      "target_resi_harian": 50,\n      "target_resi_bulanan": 1500\n    },`
);

code = code.replace(
  /"alamat_outlet": "Jl. Raya Serang Km 24, Balaraja, Tangerang"\n    \}/g,
  `"alamat_outlet": "Jl. Raya Serang Km 24, Balaraja, Tangerang",\n      "target_resi_harian": 50,\n      "target_resi_bulanan": 1500\n    }`
);

fs.writeFileSync('server.ts', code);
