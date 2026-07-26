const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const importReplacement = `import SetoranOwnerPage from "./components/owner/SetoranOwnerPage";
import OwnerAuditPage from "./components/owner/OwnerAuditPage";
import { Shield } from "lucide-react";`;
code = code.replace(/import SetoranOwnerPage from "\.\/components\/owner\/SetoranOwnerPage";/, importReplacement);

const navReplacement = `{ id: "setoran-owner", label: "Persetujuan Setoran", icon: Clipboard },
        { id: "owner-audit", label: "Audit Engine", icon: Shield },`;
code = code.replace(/\{ id: "setoran-owner", label: "Persetujuan Setoran", icon: Clipboard \},/, navReplacement);

const routeReplacement = `{session && currentView === "setoran-owner" && (
          <SetoranOwnerPage
            session={session}
            outlets={outlets}
          />
        )}

        {session && currentView === "owner-audit" && (
          <OwnerAuditPage
            session={session}
            outlets={outlets}
          />
        )}`;
code = code.replace(/\{session && currentView === "setoran-owner" && \([\s\S]*?\)\}/, routeReplacement);

fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx for audit");
