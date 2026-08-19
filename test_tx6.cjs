const fs = require("fs");
const db = JSON.parse(fs.readFileSync("./db.json", "utf-8"));
db.MASTER_TRANSAKSI.forEach(t => console.log(t.no_resi, t.id));
