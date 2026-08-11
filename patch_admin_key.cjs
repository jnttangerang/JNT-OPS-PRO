const fs = require('fs');
let code = fs.readFileSync('src/components/owner/ManagementControlTowerPage.tsx', 'utf8');

code = code.replace(
  '<tr key={admin}',
  '<tr key={data.admin_id}'
);

fs.writeFileSync('src/components/owner/ManagementControlTowerPage.tsx', code);
