const fs = require("fs");
let code = fs.readFileSync("src/hooks/useAppsScript.ts", "utf8");

if (!code.includes('"parseYoYiOrder"')) {
  code = code.replace(`        "perbaikiAlamatAI",`, `        "perbaikiAlamatAI",\n        "parseYoYiOrder",`);
  fs.writeFileSync("src/hooks/useAppsScript.ts", code);
  console.log("useAppsScript.ts patched");
}
