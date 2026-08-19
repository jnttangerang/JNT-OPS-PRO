const fs = require("fs");
let code = fs.readFileSync("src/components/TransaksiPage.tsx", "utf8");

// Fix duplicate imports
code = code.replace(
  `import AddressBookDrawer from "./AddressBookDrawer";\nimport ImportYoYiModal, { YoYiImportQueueItem } from "./ImportYoYiModal";\nimport { Layers, Download, Check, RefreshCw } from "lucide-react";`,
  `import AddressBookDrawer from "./AddressBookDrawer";\nimport ImportYoYiModal, { YoYiImportQueueItem } from "./ImportYoYiModal";\nimport { Download } from "lucide-react";`
);

// Fix toast.warning
code = code.replace(`toast.warning(`, `toast.info(`);

fs.writeFileSync("src/components/TransaksiPage.tsx", code);
console.log("TS errors fixed");
