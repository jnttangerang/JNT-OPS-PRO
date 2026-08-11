const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add import
if (!code.includes('ManagementControlTowerPage')) {
  code = code.replace(
    "import KeuanganOutletPage from './components/owner/KeuanganOutletPage';",
    "import KeuanganOutletPage from './components/owner/KeuanganOutletPage';\nimport ManagementControlTowerPage from './components/owner/ManagementControlTowerPage';"
  );
}

// 2. Add navigation link
if (!code.includes('currentView === "control-tower"')) {
  code = code.replace(
    '{session && currentView === "dashboard" && (',
    `{session && currentView === "control-tower" && (
          <ManagementControlTowerPage
            session={session}
            outlets={outlets}
            activeOutletId={activeOutletId}
            onChangeActiveOutlet={handleActiveOutletChange}
            onNavigate={setCurrentView}
          />
        )}
        {session && currentView === "dashboard" && (`
  );
}

// 3. Add to renderNavLinks
if (!code.includes("onClick={() => { setCurrentView(\"control-tower\");")) {
  code = code.replace(
    'return (<>\n        {/* OWNER Links */}\n        {session?.role === "OWNER" && (',
    `return (<>\n        {/* OWNER Links */}\n        {session?.role === "OWNER" && (\n          <>\n            <button\n              onClick={() => { setCurrentView("control-tower"); if(closeMobile) closeMobile(); }}\n              className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 \${currentView === "control-tower" ? "bg-red-50 text-red-600 shadow-sm border border-red-100/50" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}\`}\n            >\n              <div className={\`p-1.5 rounded-lg \${currentView === "control-tower" ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-400"}\`}>\n                <Activity className="h-4 w-4" />\n              </div>\n              <span>Control Tower</span>\n            </button>`
  );
}

fs.writeFileSync('src/App.tsx', code);
