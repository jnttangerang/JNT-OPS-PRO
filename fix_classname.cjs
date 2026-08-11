const fs = require('fs');

let uiCode = fs.readFileSync('src/components/owner/ManagementControlTowerPage.tsx', 'utf8');
uiCode = uiCode.replace(
  '<div className="animate-pulse bg-gray-200" key={i} className="h-28 w-full rounded-xl" />',
  '<div key={i} className="animate-pulse bg-gray-200 h-28 w-full rounded-xl" />'
);
fs.writeFileSync('src/components/owner/ManagementControlTowerPage.tsx', uiCode);
