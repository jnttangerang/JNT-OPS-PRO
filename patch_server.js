const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const importStatement = `import {
  generateFinancialCloseReport,
  accessEvidence
} from "./src/lib/financialCloseEvidenceEngine";`;

code = code.replace(
  'import {',
  importStatement + '\nimport {'
);

const newEndpoints = `
// === PHASE 34 FINANCIAL CLOSE EVIDENCE & REPORTING ENDPOINTS ===

app.get("/api/financial-close/report", (req, res) => {
  const db = readDb();
  const { outlet_id, tanggal, actor_id, actor_name, actor_role } = req.query as any;
  const actor = {
    actor_id: actor_id || "SYS-01",
    actor_name: actor_name || "System",
    actor_role: actor_role || "SYSTEM"
  };
  const result = generateFinancialCloseReport(db, { outlet_id, tanggal, actor });
  if (result.status === "success" || result.data) writeDb(db);
  return res.json(result);
});

app.post("/api/financial-close/report", (req, res) => {
  const db = readDb();
  const { outlet_id, tanggal, actor_id, actor_name, actor_role } = req.body || {};
  const actor = {
    actor_id: actor_id || "SYS-01",
    actor_name: actor_name || "System",
    actor_role: actor_role || "SYSTEM"
  };
  const result = generateFinancialCloseReport(db, { outlet_id, tanggal, actor });
  if (result.status === "success" || result.data) writeDb(db);
  return res.json(result);
});

app.get("/api/financial-close/evidence/:id", (req, res) => {
  const db = readDb();
  const parts = req.params.id.split("-");
  if (parts.length < 3) return res.status(400).json({ status: "error", message: "Invalid ID format" });
  const outlet_id = parts[1];
  const tanggal = parts.slice(2).join("-");
  const { actor_id, actor_name, actor_role } = req.query as any;
  const actor = {
    actor_id: actor_id || "SYS-01",
    actor_name: actor_name || "System",
    actor_role: actor_role || "SYSTEM"
  };
  const result = accessEvidence(db, { outlet_id, tanggal, actor });
  if (result.status === "success" || result.data) writeDb(db);
  return res.json(result);
});

app.get("/api/financial-close/evidence/:id/transactions", (req, res) => {
  const db = readDb();
  const parts = req.params.id.split("-");
  if (parts.length < 3) return res.status(400).json({ status: "error", message: "Invalid ID format" });
  const outlet_id = parts[1];
  const tanggal = parts.slice(2).join("-");
  const allTxs = (db.MASTER_TRANSAKSI || []).filter((tx: any) => tx.outlet_id === outlet_id && tx.tanggal_transaksi === tanggal);
  return res.json({ status: "success", data: allTxs });
});

app.get("/api/financial-close/evidence/:id/audit", (req, res) => {
  const db = readDb();
  const parts = req.params.id.split("-");
  if (parts.length < 3) return res.status(400).json({ status: "error", message: "Invalid ID format" });
  const outlet_id = parts[1];
  const tanggal = parts.slice(2).join("-");
  const auditLogs = db.AuditLogs || [];
  const periodLogs = auditLogs.filter((log: any) => log.outlet_id === outlet_id && (log.tanggal === tanggal || log.entity_id?.includes(tanggal)));
  return res.json({ status: "success", data: periodLogs });
});

// === PRODUCTION STANDALONE INTEGRATION ===
`;

code = code.replace('// === PRODUCTION STANDALONE INTEGRATION ===', newEndpoints);

fs.writeFileSync('server.ts', code);
