const fs = require("fs");
let code = fs.readFileSync("server.ts", "utf8");

code = code.replace(
  `model: "gemini-3.7-flash",`,
  `model: "gemini-flash-latest",`
);

fs.writeFileSync("server.ts", code);
console.log("Model patched to gemini-flash-latest in server.ts");
