import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  '        { id: "dashboard", label: "Dashboard", icon: Landmark },\n        { id: "admin-dashboard", label: "Admin Dashboard", icon: LayoutDashboard },',
  '        { id: "dashboard", label: "Dashboard", icon: Landmark },'
);

fs.writeFileSync('src/App.tsx', code);
