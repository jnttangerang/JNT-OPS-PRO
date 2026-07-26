const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const importRegex = /import OwnerAuditPage from "\.\/components\/owner\/OwnerAuditPage";/;
const importReplacement = `import OwnerAuditPage from "./components/owner/OwnerAuditPage";
import DailyClosingPage from "./components/owner/DailyClosingPage";
import { Lock } from "lucide-react";`;
code = code.replace(importRegex, importReplacement);

const navRegex = /\{ id: "owner-audit", label: "Audit Engine", icon: Shield \},/;
const navReplacement = `{ id: "owner-audit", label: "Audit Engine", icon: Shield },
        { id: "daily-closing", label: "Daily Closing", icon: Lock },`;
code = code.replace(navRegex, navReplacement);

const routeRegex = /\{session && currentView === "owner-audit" && \([\s\S]*?\)\}/;
const match = code.match(routeRegex);
if (match) {
  const routeReplacement = `${match[0]}

        {session && currentView === "daily-closing" && (
          <DailyClosingPage
            session={session}
            outlets={outlets}
          />
        )}`;
  code = code.replace(routeRegex, routeReplacement);
}

fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx with DailyClosingPage");
