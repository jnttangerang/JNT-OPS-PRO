const fs = require('fs');

let uiCode = fs.readFileSync('src/components/owner/ManagementControlTowerPage.tsx', 'utf8');
uiCode = uiCode.replace(/import \{ Skeleton \} from "\.\.\/ui\/skeleton";/g, '');
uiCode = uiCode.replace(/import \{ Skeleton \} from '..\/ui\/skeleton';/g, '');
uiCode = uiCode.replace(/<Skeleton /g, '<div className="animate-pulse bg-gray-200" ');
uiCode = uiCode.replace(/<\/Skeleton>/g, '</div>');
fs.writeFileSync('src/components/owner/ManagementControlTowerPage.tsx', uiCode);
