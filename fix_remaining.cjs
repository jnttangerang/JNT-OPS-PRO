const fs = require('fs');

let uiCode = fs.readFileSync('src/components/owner/ManagementControlTowerPage.tsx', 'utf8');
uiCode = uiCode.replace(/import \{ Card \} from "\.\.\/ui\/card";/g, '');
uiCode = uiCode.replace(/import \{ Card \} from "\.\.\/ui\/Card";/g, '');
uiCode = uiCode.replace(/import \{ Skeleton \} from "\.\.\/ui\/skeleton";/g, '');
fs.writeFileSync('src/components/owner/ManagementControlTowerPage.tsx', uiCode);

// Fix getEvidenceStatus
let ctlCode = fs.readFileSync('src/lib/controlTowerEngine.ts', 'utf8');
ctlCode = ctlCode.replace(
  'import { getEvidenceStatus } from "./financialCloseEvidenceEngine";',
  ''
);
fs.writeFileSync('src/lib/controlTowerEngine.ts', ctlCode);

// Fix App.tsx missing import
let appCode = fs.readFileSync('src/App.tsx', 'utf8');
if (!appCode.includes('import ManagementControlTowerPage from "./components/owner/ManagementControlTowerPage";')) {
    appCode = `import ManagementControlTowerPage from "./components/owner/ManagementControlTowerPage";\n` + appCode;
    fs.writeFileSync('src/App.tsx', appCode);
}
