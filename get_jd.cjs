const fs = require('fs');
const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));
const tx = db.MASTER_TRANSAKSI.find(t => t.no_resi === 'JD0587979483');
console.log("MASTER_TRANSAKSI:", JSON.stringify(tx, null, 2));

const exp = db.EXP_Resi ? db.EXP_Resi.find(e => e.resi_id === 'JD0587979483') : null;
console.log("EXP_Resi:", exp ? JSON.stringify(exp, null, 2) : "Not found");

const keuangan = db.KEUANGAN_OUTLET.filter(k => k.resi_id === 'JD0587979483');
console.log("KEUANGAN_OUTLET:", JSON.stringify(keuangan, null, 2));

