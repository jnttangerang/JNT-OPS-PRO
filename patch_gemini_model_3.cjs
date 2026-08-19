const fs = require("fs");
let code = fs.readFileSync("server.ts", "utf8");

code = code.replace(
  `model: "gemini-flash-latest",`,
  `model: "gemini-3.1-flash-lite",`
);

fs.writeFileSync("server.ts", code);
console.log("Model patched to gemini-3.1-flash-lite in server.ts");
