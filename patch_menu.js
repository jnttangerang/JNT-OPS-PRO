import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Ensure that "dashboard" route resolves to DashboardPage (Owner) and "admin-dashboard" resolves to AdminDashboardPage.
// Wait, for ADMIN, the menu item id is "admin-dashboard", label is "Dashboard".
// That works perfectly.

fs.writeFileSync('src/App.tsx', code);
