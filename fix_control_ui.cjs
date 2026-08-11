const fs = require('fs');

let uiCode = fs.readFileSync('src/components/owner/ManagementControlTowerPage.tsx', 'utf8');
uiCode = uiCode.replace(/import \{ Skeleton \} from "\.\.\/ui\/skeleton";/g, '');
fs.writeFileSync('src/components/owner/ManagementControlTowerPage.tsx', uiCode);
