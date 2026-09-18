import fs from "fs";
const db = JSON.parse(fs.readFileSync(".data/db.json", "utf-8"));
const tx = db.EXP_Resi[db.EXP_Resi.length - 1];
console.log(tx.resi_id, tx.metode_bayar);
