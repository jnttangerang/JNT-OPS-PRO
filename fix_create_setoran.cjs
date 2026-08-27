const fs = require("fs");
const file = "server.ts";
let code = fs.readFileSync(file, "utf8");

code = code.replace(/const expectedCash = totalPhysicalCash;[\s\S]*?const submittedCash = actual_cash !== undefined[\s\S]*?\? Number\(actual_cash\)[\s\S]*?\? Number\(nominal_setor\)[\s\S]*?\: expectedCash;/g, 
  `const expectedCash = totalPhysicalCash;
  
  if (actual_cash === undefined && nominal_setor === undefined) {
    return res.json({ status: "error", message: "Nominal setoran (actual_cash) harus diisi." });
  }

  const submittedCash = actual_cash !== undefined 
    ? Number(actual_cash) 
    : Number(nominal_setor);`);

fs.writeFileSync(file, code);
