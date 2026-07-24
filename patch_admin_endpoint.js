import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

const regex = /app\.post\("\/api\/getAdminDashboardData", \(req, res\) => \{[\s\S]*?\n\}\);\n/g;

const newAdmin = `app.post("/api/getAdminDashboardData", (req, res) => {
  const { user_id, role, filterOutlet, dateStart, dateEnd } = req.body;

  if (role !== "ADMIN" && role !== "OWNER") {
    return res.status(403).json({ status: "error", message: "Akses ditolak." });
  }

  const db = readDb();
  const combined = getCombinedTransactions(db);
  const filtered = filterTransactions(combined, filterOutlet, dateStart, dateEnd);

  const summary = calculateDashboardSummary(filtered);
  const byAdmin = calculateByAdmin(filtered, db.Users);
  const byEkspedisi = calculateByEkspedisi(filtered);
  const grafik = calculateGrafik(combined, filterOutlet);
  const statusSetoranList = calculateStatusSetoran(filtered, db.SetoranData || [], filterOutlet);
  const targetHarian = calculateTargetHarian(combined, filterOutlet, db.Outlets);

  // Aktivitas Terakhir (Audit Logs)
  let logs = db.AuditLogs;
  if (filterOutlet && filterOutlet !== "ALL") {
    logs = logs.filter((log: any) => log.outlet_id === filterOutlet);
  }
  if (dateStart) {
    const start = new Date(dateStart).getTime();
    logs = logs.filter((log: any) => new Date(log.timestamp).getTime() >= start);
  }
  if (dateEnd) {
    const end = new Date(dateEnd).getTime() + 86400000;
    logs = logs.filter((log: any) => new Date(log.timestamp).getTime() <= end);
  }
  
  const userMap: Record<string, string> = {};
  db.Users.forEach((u: any) => userMap[u.user_id] = u.nama_lengkap);
  const aktivitasLogs = logs.slice(0, 50).map((log: any) => ({
    ...log,
    nama_lengkap: userMap[log.user_id] || "Sistem"
  }));

  // Riwayat Pembatalan
  const cancelLogs = db.AuditLogs.filter((l: any) => l.aksi === "BATAL_TRANSAKSI" && l.outlet_id === filterOutlet);
  const pembatalanLogs = cancelLogs.map((l:any) => ({
    ...l,
    nama_lengkap: userMap[l.user_id] || "Sistem"
  }));

  // Alert Operasional
  const alerts: string[] = [];
  if (statusSetoranList.some((s:any) => s.status === "Belum Disetor" && s.total_setoran > 0)) {
    alerts.push("Belum setor owner");
  }

  return res.json({
    status: "success",
    data: {
      summary,
      byAdmin,
      byEkspedisi,
      statusSetoranList,
      aktivitasLogs,
      grafik,
      pembatalanLogs,
      alerts,
      targetHarian,
      recentTransactions: filtered.sort((a:any, b:any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10)
    }
  });
});\n`;

code = code.replace(regex, newAdmin);
fs.writeFileSync('server.ts', code);
