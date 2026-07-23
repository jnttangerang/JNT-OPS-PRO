import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  '        {session && currentView === "admin-dashboard" && (\n          <AdminDashboardPage\n            session={session}\n            activeOutletId={activeOutletId}\n            outlets={outlets}\n          />\n        )}',
  '        {session && currentView === "admin-dashboard" && (\n          <AdminDashboardPage\n            session={session}\n            activeOutletId={activeOutletId}\n            outlets={outlets}\n            onNavigate={setCurrentView}\n          />\n        )}'
);
fs.writeFileSync('src/App.tsx', code);
