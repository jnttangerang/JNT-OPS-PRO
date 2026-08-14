const fs = require('fs');
let code = fs.readFileSync('src/components/PreInputPage.tsx', 'utf8');

const importTarget = /import \{([^}]+)\} from "lucide-react";/;
const match = code.match(importTarget);
if (match) {
  let imports = match[1];
  if (!imports.includes("Trash2")) imports += ", Trash2";
  if (!imports.includes("ChevronLeft")) imports += ", ChevronLeft";
  if (!imports.includes("ChevronRight")) imports += ", ChevronRight";
  code = code.replace(importTarget, "import {" + imports + "} from 'lucide-react';");
  fs.writeFileSync('src/components/PreInputPage.tsx', code);
  console.log("Imports patched");
}
