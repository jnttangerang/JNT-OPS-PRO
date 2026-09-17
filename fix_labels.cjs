const fs = require('fs');

let code = fs.readFileSync('src/components/admin/LengkapiYoYiPage.tsx', 'utf8');

code = code.replace(
  'Wajib Setor Cash',
  'Wajib Setor ADMIN → OWNER'
);

code = code.replace(
  'Kas Outlet',
  'KAS OUTLET'
);

fs.writeFileSync('src/components/admin/LengkapiYoYiPage.tsx', code);
console.log("Fixed labels");
