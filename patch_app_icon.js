import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  'import { LayoutDashboard } from "lucide-react";',
  'import { LayoutDashboard, Settings } from "lucide-react";'
);

fs.writeFileSync('src/App.tsx', code);
