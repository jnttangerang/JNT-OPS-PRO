const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const importStatement = `import {
  getControlTowerSummary,
  getControlTowerMatrix,
  getControlTowerTrend
} from "./src/lib/controlTowerEngine";`;

code = code.replace(
  'import {',
  importStatement + '\nimport {'
);

const newEndpoints = `
// === PHASE 35 MANAGEMENT CONTROL TOWER ENDPOINTS ===

app.get("/api/control-tower/summary", (req, res) => {
  const db = readDb();
  const { outlet_id, tanggal } = req.query;
  const result = getControlTowerSummary(db, { outlet_id, tanggal });
  return res.json(result);
});

app.get("/api/control-tower/matrix", (req, res) => {
  const db = readDb();
  const { tanggal } = req.query;
  const result = getControlTowerMatrix(db, { tanggal });
  return res.json(result);
});

app.get("/api/control-tower/trend", (req, res) => {
  const db = readDb();
  const { outlet_id, end_date, days } = req.query;
  const result = getControlTowerTrend(db, { outlet_id, end_date, days: parseInt(days || "7", 10) });
  return res.json(result);
});

// === PRODUCTION STANDALONE INTEGRATION ===
`;

code = code.replace('// === PRODUCTION STANDALONE INTEGRATION ===', newEndpoints);

fs.writeFileSync('server.ts', code);
