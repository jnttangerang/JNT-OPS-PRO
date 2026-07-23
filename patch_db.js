import fs from 'fs';
if (fs.existsSync('db.json')) {
  let db = JSON.parse(fs.readFileSync('db.json', 'utf-8'));
  db.Outlets = db.Outlets.map(o => ({
    ...o,
    target_resi_harian: o.target_resi_harian || 50,
    target_resi_bulanan: o.target_resi_bulanan || 1500
  }));
  fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
}
