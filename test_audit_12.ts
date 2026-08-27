import { calculateFinancialSummary } from "./src/lib/financialEngine";
import { getOwnerClosingSummary } from "./src/lib/dailyClosingEngine";

console.log("=== AUDIT 12 SCRIPT START ===");

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
  ongkir_dasar: 7700,
  biaya_lain: 1000,
  amplop: 2000,
  total_dibayar_customer: 10700,
  metode_bayar: "CASH"
};

const resJD = calculateFinancialSummary(txJD);
console.log("REGRESSION JD0583653897:");
console.log(JSON.stringify(resJD, null, 2));


// 3. PAYMENT REGRESSION
const txCash = { ...txJD, total_dibayar_customer: 10700 };
const resCash = calculateFinancialSummary(txCash);
console.log("CASH TEST:", resCash.cash_payment);

const txCashRounding = { ...txJD, total_dibayar_customer: 11000 };
const resCashRounding = calculateFinancialSummary(txCashRounding);
console.log("CASH + ROUNDING TEST:", resCashRounding.cash_payment);

const txCashNoAmplop = { ...txJD, amplop: 0, total_dibayar_customer: 11000 }; // 7700+1000 = 8700. rounding = 11000 - 8700 = 2300.
const resCashNoAmplop = calculateFinancialSummary(txCashNoAmplop);
console.log("CASH TANPA AMPLOP TEST:", resCashNoAmplop.cash_payment);

const txQris = { ...txJD, total_dibayar_customer: 10700, metode_bayar: "QRIS" };
const resQris = calculateFinancialSummary(txQris);
console.log("QRIS TEST:", resQris.digital_payment, "Cash:", resQris.cash_payment);

const txTransfer = { ...txJD, total_dibayar_customer: 10700, metode_bayar: "TRANSFER" };
const resTransfer = calculateFinancialSummary(txTransfer);
console.log("TRANSFER TEST:", resTransfer.digital_payment, "Cash:", resTransfer.cash_payment);

const txDfod = { ...txJD, total_dibayar_customer: 10700, metode_bayar: "DFOD" };
const resDfod = calculateFinancialSummary(txDfod);
console.log("DFOD TEST:", resDfod.dfod_outstanding, "Cash:", resDfod.cash_payment);


// 4. OWNER SUMMARY CALCULATION
const mockDb = {
  MASTER_TRANSAKSI: [
    {
      ...txJD,
      tanggal_transaksi: undefined,
      timestamp: "2026-08-26T10:00:00Z"
    }
  ],
  Master_Setoran: [],
  Users: [{ user_id: "USR-003", nama_lengkap: "Test Admin" }],
  Outlets: [{ outlet_id: "OUT-001", nama_outlet: "Test Outlet" }]
};

const ownerSummary = getOwnerClosingSummary(mockDb, { date_start: "2026-08-26", date_end: "2026-08-26" });
console.log("OWNER SUMMARY AGGREGATION:");
console.log(JSON.stringify(ownerSummary.data?.summary, null, 2));
console.log(JSON.stringify(ownerSummary.data?.rows, null, 2));

console.log("=== AUDIT 12 SCRIPT END ===");
