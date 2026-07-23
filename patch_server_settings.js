import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

const apiCode = `
app.post("/api/updateSettingsOutlet", (req, res) => {
  const { user_id, outlets } = req.body;
  const db = readDb();
  
  const user = db.Users.find((u: any) => u.user_id === user_id);
  if (!user || user.role !== "OWNER") {
    return res.status(403).json({ status: "error", message: "Akses ditolak" });
  }

  if (Array.isArray(outlets)) {
    outlets.forEach(newOutlet => {
      const idx = db.Outlets.findIndex((o: any) => o.outlet_id === newOutlet.outlet_id);
      if (idx !== -1) {
        db.Outlets[idx].target_resi_harian = newOutlet.target_resi_harian;
        db.Outlets[idx].target_resi_bulanan = newOutlet.target_resi_bulanan;
      }
    });
    writeDb(db);
    return res.json({ status: "success", message: "Pengaturan berhasil disimpan" });
  }

  return res.status(400).json({ status: "error", message: "Data tidak valid" });
});
`;

code = code.replace('app.get("/api/getOutlets", (req, res) => {', apiCode + '\napp.get("/api/getOutlets", (req, res) => {');
fs.writeFileSync('server.ts', code);
