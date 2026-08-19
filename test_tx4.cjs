const fs = require("fs");
const db = JSON.parse(fs.readFileSync("./db.json", "utf-8"));
const tx = db.MASTER_TRANSAKSI.find(t => t.no_resi === "TEST-9999");
console.log(tx);
