const fs = require('fs');
const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));
const keuangan = db.KEUANGAN ? db.KEUANGAN.filter(k => k.resi_id === 'JD0587979483') : [];
console.log("KEUANGAN:", JSON.stringify(keuangan, null, 2));
