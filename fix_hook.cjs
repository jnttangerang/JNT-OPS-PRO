const fs = require('fs');

let code = fs.readFileSync('src/components/admin/LengkapiYoYiPage.tsx', 'utf8');

// Replace import
code = code.replace(
  "import { callBackend } from '../../utils/api';",
  "import { useAppsScript } from '../../hooks/useAppsScript';"
);

// Add to LengkapiYoYiPage
code = code.replace(
  "export default function LengkapiYoYiPage({ session, outlets }: LengkapiYoYiPageProps) {",
  "export default function LengkapiYoYiPage({ session, outlets }: LengkapiYoYiPageProps) {\n  const { callBackend } = useAppsScript();"
);

// Add to YoYiDetailView
code = code.replace(
  "function YoYiDetailView({ tanggal, onBack, session, outlets, onSetoran }: any) {",
  "function YoYiDetailView({ tanggal, onBack, session, outlets, onSetoran }: any) {\n  const { callBackend } = useAppsScript();"
);

// Add to YoYiInlineRow
code = code.replace(
  "function YoYiInlineRow({ tx, onUpdate }: { tx: any, onUpdate: () => void }) {",
  "function YoYiInlineRow({ tx, onUpdate }: { tx: any, onUpdate: () => void }) {\n  const { callBackend, uploadFile } = useAppsScript();"
);

// Fix callBackend in InlineSetoranModal
code = code.replace(
  "function InlineSetoranModal({",
  "function InlineSetoranModal({\n  callBackend, uploadFile, "
);
code = code.replace(
  "<InlineSetoranModal",
  "<InlineSetoranModal callBackend={callBackend} uploadFile={uploadFile}"
);

// Fix actual fetch calls to use standard fetch for GET, because callBackend is usually for RPC to server
// Wait, `callBackend` in useAppsScript makes a POST to `/api/call` or similar. Let's see how `useAppsScript` is defined.
// Actually, I can just change my new endpoints to POST /api/yoyi/summary or use standard fetch.
// Let's rewrite the fetch logic to standard fetch for GET requests, and leave useAppsScript for actions if needed.
// Or just rewrite the callBackend inside LengkapiYoYiPage to standard fetch.

fs.writeFileSync('src/components/admin/LengkapiYoYiPage.tsx', code);
console.log("Hook replaced");
