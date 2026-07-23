import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  '            onNavigate={setCurrentView}\n          />\n        )}\n        \n        {session && currentView === "admin-dashboard"',
  '            onNavigate={setCurrentView}\n          />\n        )}\n        \n        {session && currentView === "admin-dashboard"'
);

code = code.replace(
  '<AdminDashboardPage\n            session={session}\n            activeOutletId={activeOutletId}\n            outlets={outlets}\n            onNavigate={setCurrentView}\n          />',
  '<AdminDashboardPage\n            session={session}\n            activeOutletId={activeOutletId}\n            outlets={outlets}\n            onNavigate={setCurrentView}\n            onChangeActiveOutlet={handleActiveOutletChange}\n          />'
);

fs.writeFileSync('src/App.tsx', code);
