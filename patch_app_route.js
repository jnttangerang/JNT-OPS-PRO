import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const targetStr = `        {session && currentView === "dashboard" && (
          <DashboardPage
            session={session}
            outlets={outlets}
          />
        )}`;
        
const replaceStr = `        {session && currentView === "dashboard" && (
          <DashboardPage
            session={session}
            outlets={outlets}
          />
        )}
        
        {session && currentView === "admin-dashboard" && (
          <AdminDashboardPage
            session={session}
            activeOutletId={activeOutletId}
            outlets={outlets}
            onNavigate={setCurrentView}
            onChangeActiveOutlet={handleActiveOutletChange}
          />
        )}`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/App.tsx', code);
