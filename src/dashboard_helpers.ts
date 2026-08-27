// Reusable Dashboard Services for JNT OPS PRO
import { getWIBDate, getTodayWIB, shiftWIBDays, extractBusinessDate } from "./utils/dateUtils";
import { calculateFinancialSummary } from "./lib/financialEngine";

export function getCombinedTransactions(db: any) {
  const combined: any[] = [];
  
  (db.EXP_Resi || []).forEach((r: any) => {
    if (r.status !== "BATAL") {
      combined.push({
        ...r,
        tipe_layanan: "Express",
        pengirim: db.PreInput_Backup?.find((p: any) => p.transaksi_id === r.transaksi_id)?.nama_pengirim || "Umum",
        penerima: db.PreInput_Backup?.find((p: any) => p.transaksi_id === r.transaksi_id)?.nama_penerima || "Umum",
      });
    }
  });

  (db.CRG_Resi || []).forEach((r: any) => {
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

export function filterTransactions(combined: any[], filterOutlet: string, dateStart?: string, dateEnd?: string, filterTipeLayanan?: string) {
  let filtered = combined;
  if (filterOutlet && filterOutlet !== "ALL") {
    filtered = filtered.filter((r: any) => (r.outlet_id_input || r.outlet_id) === filterOutlet);
  }
  if (filterTipeLayanan && filterTipeLayanan !== "ALL") {
    filtered = filtered.filter((r: any) => (r.tipe_layanan || r.ekspedisi || "").toUpperCase() === filterTipeLayanan.toUpperCase());
  }
  if (dateStart) {
    filtered = filtered.filter((r: any) => extractBusinessDate(r) >= dateStart);
  }
  if (dateEnd) {
    filtered = filtered.filter((r: any) => extractBusinessDate(r) <= dateEnd);
  }
  return filtered;
}

export function calculateDashboardSummary(filtered: any[]) {
  const totalTransaksi = filtered.length;
  const totalResiExpress = filtered.filter((r: any) => (r.tipe_layanan || r.ekspedisi || "Express") === "Express").length;
  const totalResiCargo = filtered.filter((r: any) => (r.tipe_layanan || r.ekspedisi || "") === "Cargo").length;
  
  let totalOmsetGlobal = 0;
  let totalSetoranOwner = 0;
  let totalKasOperasional = 0;

  for (const r of filtered) {
    const sum = calculateFinancialSummary(r);
    totalOmsetGlobal += sum.customer_payment;
    totalSetoranOwner += sum.owner_deposit;
    totalKasOperasional += sum.outlet_cash;
  }
  
  return {
    totalTransaksi,
    totalResiExpress,
    totalResiCargo,
    grandTotalCustomer: totalOmsetGlobal, // Also aliases for Owner Dashboard
    total_omset: totalOmsetGlobal,
    totalWajibSetorOwner: totalSetoranOwner,
    total_setoran_owner: totalSetoranOwner,
    totalKasOutlet: totalKasOperasional,
    total_kas_operasional: totalKasOperasional
  };
}

export function calculateByAdmin(filtered: any[], users: any[]) {
  const adminMap: Record<string, any> = {};
  filtered.forEach(r => {
    const admin = r.admin_id_pencatat || r.admin_id;
    if (!adminMap[admin]) {
      const user = (users || []).find((u: any) => u.user_id === admin);
      adminMap[admin] = {
        admin_id: admin,
        nama: user ? (user.nama_lengkap || user.username) : admin,
        express: 0,
        cargo: 0,
        totalResi: 0,
        totalSetoranOwner: 0,
        kasOutlet: 0
      };
    }
    const sum = calculateFinancialSummary(r);
    const tipe = (r.tipe_layanan || r.ekspedisi || "Express").toLowerCase();
    if (tipe === "express") adminMap[admin].express++;
    if (tipe === "cargo") adminMap[admin].cargo++;
    adminMap[admin].totalResi++;
    adminMap[admin].totalSetoranOwner += sum.owner_deposit;
    adminMap[admin].kasOutlet += sum.outlet_cash;
  });
  return Object.values(adminMap).sort((a: any, b: any) => b.totalResi - a.totalResi);
}

export function calculateByEkspedisi(filtered: any[]) {
  let expressResi = 0;
  let expressOmset = 0;
  let expressSetoran = 0;
  let cargoResi = 0;
  let cargoOmset = 0;
  let cargoSetoran = 0;

  for (const r of filtered) {
    const sum = calculateFinancialSummary(r);
    const isCargo = (r.tipe_layanan || r.ekspedisi || "").toLowerCase() === "cargo";
    if (isCargo) {
      cargoResi++;
      cargoOmset += sum.customer_payment;
      cargoSetoran += sum.owner_deposit;
    } else {
      expressResi++;
      expressOmset += sum.customer_payment;
      expressSetoran += sum.owner_deposit;
    }
  }

  return {
    Express: {
      resi: expressResi,
      omset: expressOmset,
      setoran: expressSetoran,
    },
    Cargo: {
      resi: cargoResi,
      omset: cargoOmset,
      setoran: cargoSetoran,
    }
  };
}

export function calculateGrafik(combined: any[], filterOutlet: string) {
  const last7Days: any[] = [];
  const today = getTodayWIB();
  for (let i = 6; i >= 0; i--) {
    const dateStr = shiftWIBDays(today, -i);
    let dayTotalResi = 0;
    let daySetoran = 0;
    combined.forEach(r => {
      const rDate = extractBusinessDate(r);
      if (rDate === dateStr && (!filterOutlet || filterOutlet === "ALL" || (r.outlet_id_input || r.outlet_id) === filterOutlet)) {
        dayTotalResi++;
        daySetoran += r.setoran_ke_owner || r.wajib_setor_owner || 0;
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

export function calculateStatusSetoran(filtered: any[], dbSetoranData: any[], filterOutlet: string) {
  const setoranMap: Record<string, any> = {};
  filtered.forEach(r => {
    const dateStr = extractBusinessDate(r);
    if (!dateStr) return;
    if (!setoranMap[dateStr]) {
      const existing = (dbSetoranData || []).find((s: any) => (extractBusinessDate(s) === dateStr) && (!filterOutlet || filterOutlet === "ALL" || (s.outlet_id || s.kode_outlet) === (r.outlet_id_input || r.outlet_id) || (s.outlet_id || s.kode_outlet) === filterOutlet));
      setoranMap[dateStr] = {
        date: dateStr,
        total_setoran: 0,
        status: existing ? existing.status : "Belum Disetor",
        transaksi: []
      };
    }
    setoranMap[dateStr].total_setoran += r.setoran_ke_owner || r.wajib_setor_owner || 0;
    setoranMap[dateStr].transaksi.push(r.resi_id || r.no_resi);
  });
  return Object.values(setoranMap).sort((a: any, b: any) => b.date.localeCompare(a.date));
}

export function calculateTargetHarian(combined: any[], filterOutlet: string, outlets: any[]) {
  const todayStr = getTodayWIB();
  const currentResiToday = combined.filter((r: any) => extractBusinessDate(r) === todayStr && (!filterOutlet || filterOutlet === "ALL" || (r.outlet_id_input || r.outlet_id) === filterOutlet)).length;
  
  let targetTotal = 0;
  if (filterOutlet && filterOutlet !== "ALL") {
    const outlet = (outlets || []).find((o: any) => o.outlet_id === filterOutlet);
    targetTotal = outlet?.target_resi_harian || 50;
  } else {
    targetTotal = (outlets || []).reduce((sum: number, o: any) => sum + (o.target_resi_harian || 50), 0);
  }

  return {
    target: targetTotal,
    current: currentResiToday
  };
}
