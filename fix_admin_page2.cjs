const fs = require('fs');
let code = fs.readFileSync('src/components/admin/AdminDashboardPage.tsx', 'utf8');
code = code.replace('import { CheckCircle, SessionData, Outlet } from "../../types";', 'import { SessionData, Outlet } from "../../types";');
fs.writeFileSync('src/components/admin/AdminDashboardPage.tsx', code);
