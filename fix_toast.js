import fs from 'fs';
let code = fs.readFileSync('src/components/owner/SettingOutletPage.tsx', 'utf-8');

code = code.replace(
  'import { toast } from "react-toastify";',
  'import { toast } from "../../utils/toast";'
);

fs.writeFileSync('src/components/owner/SettingOutletPage.tsx', code);
