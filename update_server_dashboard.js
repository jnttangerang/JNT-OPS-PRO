import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

const helpers = `
// --- DASHBOARD HELPERS ---
function getCombinedTransactions(db: any) {
  const combined: any[] = [];
  db.EXP_Resi.forEach((r: any) => {
    if (r.status !== "BATAL") {
      combined.push({
        ...r,
        tipe_layanan: "Express",
        pengirim: db.PreInput_Backup?.find((p: any) => p.transaksi_id === r.transaksi_id)?.nama_pengirim || "Umum",
        penerima: db.PreInput_Backup?.find((p: any) => p.transaksi_id === r.transaksi_id)?.nama_penerima || "Umum",
      });
    }
  });
  db.CRG_Resi.forEach((r: any) => {
    if (r.status !== "BATAL") {
      combined.push({
        ...r,
        tipe_layanan: "Cargo",
        pengirim: db.PreInput_Backup?.find((p: any) => p.transaksi_id === r.transaksi_id)?.nama_pengirim || "Umum",
        penerima: db.PreInput_Backup?.find((p: any) => p.transaksi_id === r.transaksi_id)?.nama_penerima || "Umum",
      });
    }
  });
  return combined;
}

function filterTransactions(combined: any[], filterOutlet: string, dateStart?: string, dateEnd?: string, filterTipeLayanan?: string) {
  let filtered = combined;
  if (filterOutlet && filterOutlet !== "ALL") {
    filtered = filtered.filter((r: any) => r.outlet_id_input === filterOutlet);
  }
  if (filterTipeLayanan && filterTipeLayanan !== "ALL") {
    filtered = filtered.filter((r: any) => r.tipe_layanan === filterTipeLayanan);
  }
  if (dateStart) {
    const start = new Date(dateStart).getTime();
    filtered = filtered.filter((r: any) => new Date(r.timestamp).getTime() >= start);
  }
  if (dateEnd) {
    const end = new Date(dateEnd).getTime() + 86400000;
    filtered = filtered.filter((r: any) => new Date(r.timestamp).getTime() <= end);
  }
  return filtered;
}

function calculateDashboardSummary(filtered: any[]) {
  const totalTransaksi = filtered.length;
  const totalResiExpress = filtered.filter((r: any) => r.tipe_layanan === "Express").length;
  const totalResiCargo = filtered.filter((r: any) => r.tipe_layanan === "Cargo").length;
  const totalOmsetGlobal = filtered.reduce((sum: number, r: any) => sum + (r.grand_total || 0), 0);
  const totalSetoranOwner = filtered.reduce((sum: number, r: any) => sum + (r.setoran_ke_owner || 0), 0);
  const totalKasOperasional = filtered.reduce((sum: number, r: any) => sum + (r.kas_operasional || 0), 0);
  
  return {
    totalTransaksi,
    totalResiExpress,
    totalResiCargo,
    grandTotalCustomer: totalOmsetGlobal,
    total_omset: totalOmsetGlobal,
    totalWajibSetorOwner: totalSetoranOwner,
    total_setoran_owner: totalSetoranOwner,
    totalKasOutlet: totalKasOperasional,
    total_kas_operasional: totalKasOperasional
  };
}

function calculateByAdmin(filtered: any[], users: any[]) {
  const adminMap: Record<string, any> = {};
  filtered.forEach((r: any) => {
    const admin = r.admin_id_pencatat;
    if (!adminMap[admin]) {
      const user = users.find((u: any) => u.user_id === admin);
      adminMap[admin] = {
        admin_id: admin,
        nama: user ? user.nama_lengkap : admin,
        express: 0,
        cargo: 0,
        totalResi: 0,
        totalSetoranOwner: 0,
        kasOutlet: 0
      };
    }
    if (r.tipe_layanan === "Express") adminMap[admin].express++;
    if (r.tipe_layanan === "Cargo") adminMap[admin].cargo++;
    adminMap[admin].totalResi++;
    adminMap[admin].totalSetoranOwner += r.setoran_ke_owner || 0;
    adminMap[admin].kasOutlet += r.kas_operasional || 0;
  });
  return Object.values(adminMap).sort((a: any, b: any) => b.totalResi - a.totalResi);
}

function calculateByEkspedisi(filtered: any[]) {
  const totalResiExpress = filtered.filter((r: any) => r.tipe_layanan === "Express").length;
  const totalResiCargo = filtered.filter((r: any) => r.tipe_layanan === "Cargo").length;
  return {
    Express: {
      resi: totalResiExpress,
      omset: filtered.filter((r: any) => r.tipe_layanan === "Express").reduce((sum: number, r: any) => sum + (r.grand_total || 0), 0),
      setoran: filtered.filter((r: any) => r.tipe_layanan === "Express").reduce((sum: number, r: any) => sum + (r.setoran_ke_owner || 0), 0),
    },
    Cargo: {
      resi: totalResiCargo,
      omset: filtered.filter((r: any) => r.tipe_layanan === "Cargo").reduce((sum: number, r: any) => sum + (r.grand_total || 0), 0),
      setoran: filtered.filter((r: any) => r.tipe_layanan === "Cargo").reduce((sum: number, r: any) => sum + (r.setoran_ke_owner || 0), 0),
    }
  };
}

function calculateGrafik(combined: any[], filterOutlet: string) {
  const last7Days: any[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    let dayTotalResi = 0;
    let daySetoran = 0;
    combined.forEach((r: any) => {
      if (r.timestamp.startsWith(dateStr) && (!filterOutlet || filterOutlet === "ALL" || r.outlet_id_input === filterOutlet)) {
        dayTotalResi++;
        daySetoran += r.setoran_ke_owner || 0;
      }
    });
    last7Days.push({
      date: dateStr,
      resi: dayTotalResi,
      setoran: daySetoran
    });
  }
  return last7Days;
}

function calculateStatusSetoran(filtered: any[], dbSetoranData: any[], filterOutlet: string) {
  const setoranMap: Record<string, any> = {};
  filtered.forEach((r: any) => {
    const dateStr = r.timestamp.split("T")[0];
    if (!setoranMap[dateStr]) {
      const existing = (dbSetoranData || []).find((s:any) => s.date === dateStr && (!filterOutlet || filterOutlet === "ALL" || s.outlet_id === r.outlet_id_input || s.outlet_id === filterOutlet));
      setoranMap[dateStr] = {
        date: dateStr,
        total_setoran: 0,
        status: existing ? existing.status : "Belum Disetor",
        transaksi: []
      };
    }
    setoranMap[dateStr].total_setoran += r.setoran_ke_owner || 0;
    setoranMap[dateStr].transaksi.push(r.resi_id);
  });
  return Object.values(setoranMap).sort((a:any, b:any) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function calculateTargetHarian(combined: any[], filterOutlet: string, outlets: any[]) {
  const todayStr = new Date().toISOString().split("T")[0];
  const currentResiToday = combined.filter((r:any) => r.timestamp.startsWith(todayStr) && (!filterOutlet || filterOutlet === "ALL" || r.outlet_id_input === filterOutlet)).length;
  
  let targetTotal = 0;
  if (filterOutlet && filterOutlet !== "ALL") {
    const outlet = outlets.find((o: any) => o.outlet_id === filterOutlet);
    targetTotal = outlet?.target_resi_harian || 50;
  } else {
    targetTotal = outlets.reduce((sum: number, o: any) => sum + (o.target_resi_harian || 50), 0);
  }

  return {
    target: targetTotal,
    current: currentResiToday
  };
}
// --- END DASHBOARD HELPERS ---

`;

// Insert the helpers just before getAdminDashboardData
const insertIdx = code.indexOf('app.post("/api/getAdminDashboardData"');
code = code.substring(0, insertIdx) + helpers + code.substring(insertIdx);

fs.writeFileSync('server.ts', code);
