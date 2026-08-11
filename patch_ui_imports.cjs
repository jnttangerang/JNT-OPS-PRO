const fs = require('fs');

// src/components/owner/ManagementControlTowerPage.tsx
let uiCode = fs.readFileSync('src/components/owner/ManagementControlTowerPage.tsx', 'utf8');
uiCode = uiCode.replace(
  /import \{ Card \} from "\.\.\/ui\/card";/g,
  'import { Card } from "../ui/Card";'
);
uiCode = uiCode.replace(
  /import \{ Skeleton \} from "\.\.\/ui\/skeleton";/g,
  '' // Not used anyway, let's just remove it if we don't have it.
);
fs.writeFileSync('src/components/owner/ManagementControlTowerPage.tsx', uiCode);

// src/App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf8');
// 'ManagementControlTowerPage' is missing? Let's check how it was imported.
// If it is in src/components/owner/ManagementControlTowerPage.tsx, we need to export it and import it in App.tsx.
// Wait, looking at the error: src/App.tsx(476,12): error TS2304: Cannot find name 'ManagementControlTowerPage'.
// This implies it was there before but maybe not imported?
if (!appCode.includes('import ManagementControlTowerPage')) {
   appCode = appCode.replace(
     'import FinancialSettlementPanel from "./components/settlement/FinancialSettlementPanel";',
     'import FinancialSettlementPanel from "./components/settlement/FinancialSettlementPanel";\nimport ManagementControlTowerPage from "./components/owner/ManagementControlTowerPage";'
   );
   fs.writeFileSync('src/App.tsx', appCode);
}
