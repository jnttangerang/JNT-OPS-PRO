import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

if (!code.includes('import SettingOutletPage')) {
  code = code.replace(
    'import UlasanMapsPage from "./components/UlasanMapsPage";',
    'import UlasanMapsPage from "./components/UlasanMapsPage";\nimport SettingOutletPage from "./components/owner/SettingOutletPage";'
  );
}

const navItem = `
      { id: "setting-outlet", label: "Setting Outlet", icon: <Settings size={18} /> },`;
      
if (!code.includes('id: "setting-outlet"')) {
  code = code.replace(
    '      { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },',
    '      { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },' + navItem
  );
}

const route = `
        {session && currentView === "setting-outlet" && (
          <SettingOutletPage
            session={session}
            outlets={outlets}
          />
        )}`;

if (!code.includes('currentView === "setting-outlet"')) {
  code = code.replace(
    '{session && currentView === "ulasan" && (',
    route + '\n\n        {session && currentView === "ulasan" && ('
  );
}

fs.writeFileSync('src/App.tsx', code);
