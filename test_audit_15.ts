import { validateDailyClosing, getOwnerClosingSummary } from "./src/lib/dailyClosingEngine";

console.log("=== AUDIT 15 SCRIPT START ===");

const tx1 = {
  admin_id: "FITRI",
  outlet_id: "OUT-002",
  tanggal_transaksi: "2026-08-28",
  status_transaksi: "OK",
  ongkir_dasar: 10000,
  biaya_lain: 0,
  amplop: 0,
  total_dibayar_customer: 10000,
  metode_bayar: "CASH"
};

const tx2 = {
  admin_id: "RISKA",
  outlet_id: "OUT-002",
  tanggal_transaksi: "2026-08-28",
  status_transaksi: "OK",
  ongkir_dasar: 15000,
  biaya_lain: 0,
  amplop: 0,
  total_dibayar_customer: 15000,
  metode_bayar: "CASH"
};

const mockDb = {
  MASTER_TRANSAKSI: [
    { ...tx1, timestamp: "2026-08-28T10:00:00Z" },
    { ...tx2, timestamp: "2026-08-28T11:00:00Z" }
  ],
  Master_Setoran: [
    {
      setoran_id: "SET-FITRI",
      tanggal: "2026-08-28",
      outlet_id: "OUT-002",
      admin_pembuat: "FITRI",
      expected_cash: 10000,
      actual_cash: 10000,
      status: "MENUNGGU_APPROVAL"
    }
  ],
  Users: [
    { user_id: "FITRI", nama_lengkap: "Fitri" },
    { user_id: "RISKA", nama_lengkap: "Riska" }
  ],
  Outlets: [{ outlet_id: "OUT-002", nama_outlet: "Jayanti" }],
  DailyClosing: []
};

// 1. Check validateDailyClosing (what Admin sees via getDailyClosingStatus which uses SYSTEM actor initially, but wait, the API passes something else?)
// Let's test validateDailyClosing with FITRI actor.
const adminClosing = validateDailyClosing(mockDb, {
  outlet_id: "OUT-002",
  tanggal: "2026-08-28",
  actor: { actor_id: "FITRI", actor_name: "Fitri", actor_role: "ADMIN" }
});

console.log("ADMIN FITRI CLOSING (validateDailyClosing):");
console.log("Total Setoran Required:", adminClosing.data?.setoran_required);
console.log("Admin Breakdown:", JSON.stringify(adminClosing.data?.admin_breakdown, null, 2));


// 2. Check getOwnerClosingSummary
const ownerSummary = getOwnerClosingSummary(mockDb, { outlet_id: "OUT-002", date_start: "2026-08-28", date_end: "2026-08-28" });
console.log("\nOWNER SUMMARY:");
console.log("Total Expected:", ownerSummary.data?.summary.total_expected_cash);
console.log("Total Actual:", ownerSummary.data?.summary.total_actual_cash);
console.log("Rows:", JSON.stringify(ownerSummary.data?.rows.map((r:any) => ({
  admin: r.admin_id,
  expected: r.expected_cash,
  actual: r.actual_cash,
  status: r.setoran_status,
  variance_status: r.variance_status
})), null, 2));

console.log("=== AUDIT 15 SCRIPT END ===");
