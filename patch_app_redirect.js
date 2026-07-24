import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  'setCurrentView(parsed.role === "OWNER" ? "dashboard" : "pre-input");',
  'setCurrentView(parsed.role === "OWNER" ? "dashboard" : parsed.role === "ADMIN" ? "admin-dashboard" : "pre-input");'
);

code = code.replace(
  'setCurrentView(userSession.role === "OWNER" ? "dashboard" : "pre-input");',
  'setCurrentView(userSession.role === "OWNER" ? "dashboard" : userSession.role === "ADMIN" ? "admin-dashboard" : "pre-input");'
);

fs.writeFileSync('src/App.tsx', code);
