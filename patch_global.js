import fs from 'fs';
let code = fs.readFileSync('src/components/admin/AdminDashboardPage.tsx', 'utf-8');
code = code.replace('{session.role === "OWNER" && <option value="ALL">Semua Outlet (Global)</option>}', '');
fs.writeFileSync('src/components/admin/AdminDashboardPage.tsx', code);
