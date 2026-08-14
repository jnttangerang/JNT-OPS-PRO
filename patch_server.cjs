const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target1 = `  let existing = transaksi_id ? db.PreInput_Backup.find((p: any) => p.transaksi_id === transaksi_id) : null;`;

const replacement1 = `  let existing = transaksi_id ? db.PreInput_Backup.find((p: any) => p.transaksi_id === transaksi_id) : null;
  
  if (!existing && hp_pengirim) {
    const hpNorm = hp_pengirim.replace(/\\D/g, "");
    existing = db.PreInput_Backup.find((p: any) => 
      p.hp_pengirim && 
      p.hp_pengirim.replace(/\\D/g, "") === hpNorm && 
      (p.status === "Draft" || p.status === "INPUT_YOYI")
    );
  }
`;

code = code.replace(target1, replacement1);

const deleteDraftCode = `
app.post("/api/deletePreInputDraft", (req, res) => {
  const { transaksi_id } = req.body;
  if (!transaksi_id) return res.status(400).json({ status: "error", message: "ID Transaksi diperlukan." });
  
  const db = readDb();
  if (!db.PreInput_Backup) db.PreInput_Backup = [];
  
  const index = db.PreInput_Backup.findIndex((p: any) => p.transaksi_id === transaksi_id);
  if (index !== -1) {
    db.PreInput_Backup.splice(index, 1);
    
    if (!db.AuditLogs) db.AuditLogs = [];
    db.AuditLogs.push({
      id: \`AUD-\${Date.now()}\`,
      timestamp: new Date().toISOString(),
      user: "System", // Or admin_id if available
      action: "DELETE_DRAFT",
      details: \`Menghapus draft transaksi \${transaksi_id}\`,
      target: "PreInput_Backup"
    });
    
    writeDb(db);
    return res.json({ status: "success", message: "Draft berhasil dihapus." });
  }
  
  return res.status(404).json({ status: "error", message: "Draft tidak ditemukan." });
});
`;

code = code.replace(`app.post("/api/saveDataPreInput", (req, res) => {`, deleteDraftCode + `\napp.post("/api/saveDataPreInput", (req, res) => {`);

fs.writeFileSync('server.ts', code);
console.log("server.ts patched!");
