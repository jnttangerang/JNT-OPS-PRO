const fs = require("fs");
let code = fs.readFileSync("server.ts", "utf8");

code = code.replace(
  `const models = ["gemini-3.6-flash", "gemini-flash-latest"];`,
  `const models = ["gemini-3.1-flash-lite", "gemini-3.7-flash"];`
);

fs.writeFileSync("server.ts", code);
console.log("Fallback models patched in server.ts");
