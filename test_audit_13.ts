import { calculateFinancialSummary, isTransactionValidForFinance } from "./src/lib/financialEngine";
import { getOwnerClosingSummary, validateDailyClosing } from "./src/lib/dailyClosingEngine";

console.log("=== AUDIT 13 SCRIPT START ===");

// 1. PRIMARY ROUNDING TEST
const txRounding = {
  transaksi_id: "TX-ROUND-001",
  ongkir_dasar: 7700,
  biaya_lain: 1000,
  amplop: 2000,
  total_dibayar_customer: 11000,
  metode_bayar: "CASH"
};

const resRounding = calculateFinancialSummary(txRounding);
console.log("ROUNDING TEST:");
console.log(JSON.stringify(resRounding, null, 2));


// 2. CRITICAL REGRESSION - JD0583653897
const txJD = {
  admin_id: "USR-003",
  outlet_id: "OUT-001",
  tanggal_transaksi: "2026-08-26",
  owner_audit_status: "PENDING",
  status_transaksi: "OK",
  ongkir_dasar: 7700,
  biaya_lain: 1000,
  amplop: 2000,
  total_dibayar_customer: 10700,
  metode_bayar: "CASH"
};

const resJD = calculateFinancialSummary(txJD);
console.log("REGRESSION JD0583653897:");
console.log(JSON.stringify(resJD, null, 2));

// Check if PENDING audit status affects validity
console.log("isTransactionValidForFinance(txJD):", isTransactionValidForFinance(txJD));

// 3. DAILY CLOSING ADMIN & OWNER CALCULATION
const mockDb = {
  MASTER_TRANSAKSI: [
    {
      ...txJD,
      tanggal_transaksi: undefined,
      timestamp: "2026-08-26T10:00:00Z"
    }
  ],
  Master_Setoran: [],
  Users: [{ user_id: "USR-003", nama_lengkap: "Test Admin", role: "ADMIN" }],
  Outlets: [{ outlet_id: "OUT-001", nama_outlet: "Test Outlet" }],
  DailyClosing: []
};

// Admin validating their own closing
const adminClosing = validateDailyClosing(mockDb, {
  outlet_id: "OUT-001",
  tanggal: "2026-08-26",
  actor: { actor_id: "USR-003", actor_name: "Test Admin", actor_role: "ADMIN" }
});
console.log("ADMIN DAILY CLOSING:");
console.log("setoran_required (Expected Cash):", adminClosing.data?.setoran_required);
console.log("setoran_status:", adminClosing.data?.setoran_status);
console.log("closing status:", adminClosing.status);

// Owner viewing all
const ownerSummary = getOwnerClosingSummary(mockDb, { date_start: "2026-08-26", date_end: "2026-08-26" });
console.log("OWNER SUMMARY AGGREGATION:");
console.log(JSON.stringify(ownerSummary.data?.summary, null, 2));
console.log(JSON.stringify(ownerSummary.data?.rows, null, 2));

console.log("=== AUDIT 13 SCRIPT END ===");
