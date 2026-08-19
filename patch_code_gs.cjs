const fs = require("fs");
let code = fs.readFileSync("Code.gs", "utf8");

code = code.replace(
  `admin_id: input.admin_id,`,
  `admin_id_pencatat: input.admin_id,`
);

fs.writeFileSync("Code.gs", code);
console.log("Code.gs patched admin_id_pencatat");
