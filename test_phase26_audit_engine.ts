import { auditTransaction, auditDaily, auditOutlet, auditAdmin, auditImport } from "./src/lib/auditEngine";
import { calculateFinancialSummary } from "./src/lib/financialEngine";

console.log("==========================================");
console.log("   PHASE 26 — AUDIT ENGINE TEST SUITE");
console.log("==========================================");

// Helper for fresh DB
function createFreshDb(): any {
  return {
    MASTER_TRANSAKSI: [],
    MASTER_PENGIRIMAN: [],
    Master_Pelanggan: [
      { id: "SND-001", pelanggan_id: "SND-001", nama: "Alice", no_hp: "08123456789" },
      { id: "RCV-001", pelanggan_id: "RCV-001", nama: "Bob", no_hp: "08987654321" }
    ]
  };
}

const validTx: any = {
  id: "TRX-1001",
  transaksi_id: "TRX-1001",
  outlet_id: "OUT-001",
  admin_id: "ADM-001",
  tanggal_transaksi: "2026-08-06",
  created_at: "2026-08-06T10:00:00.000Z",
  no_resi: "EXP-1001",
  pengirim_id: "SND-001",
  penerima_id: "RCV-001",
  snapshot_nama_pengirim: "Alice",
  snapshot_nama_penerima: "Bob",
  status_transaksi: "PAID",
  status: "PAID",
  ongkir_customer: 50000,
  packing: 5000,
  amplop: 2000,
  biaya_lain: 0,
  total_customer: 57000,
  ongkir_yoyi: 40000,
  asuransi: 1000,
  biaya_lain_yoyi: 0,
  foto_barang: "http://example.com/paket.jpg",
  foto_resi: "http://example.com/resi.jpg",
  status_sync: "SYNCED",
  status_setoran: "DISETUJUI"
};

console.log("\n--- TEST 1: VALID TRANSACTION ---");
const db1 = createFreshDb();
db1.MASTER_TRANSAKSI.push(validTx);
db1.MASTER_PENGIRIMAN.push({
  transaksi_id: "TRX-1001",
  no_resi: "EXP-1001",
  status_pengiriman: "READY_PICKUP"
});

const resValid = auditTransaction(db1, "TRX-1001");
console.log("Status:", resValid.status);
console.log("Score:", resValid.score);
console.log("Eligibility:", resValid.eligibility);
if (resValid.status === "VALID" && resValid.score === 100 && resValid.eligibility.countedInFinance) {
  console.log("Result: PASS");
} else {
  console.error("Result: FAIL", resValid);
  process.exit(1);
}

console.log("\n--- TEST 2: MISSING PHOTO & SETORAN PENDING (WARNING) ---");
const db2 = createFreshDb();
const warningTx: any = {
  ...validTx,
  id: "TRX-1002",
  transaksi_id: "TRX-1002",
  no_resi: "EXP-1002",
  foto_barang: "",
  foto_resi: "",
  status_setoran: "PENDING"
};
db2.MASTER_TRANSAKSI.push(warningTx);
db2.MASTER_PENGIRIMAN.push({ transaksi_id: "TRX-1002", no_resi: "EXP-1002" });

const resWarn = auditTransaction(db2, "TRX-1002");
console.log("Status:", resWarn.status);
console.log("Score:", resWarn.score);
console.log("Warnings:", resWarn.warnings);
console.log("Recommendations:", resWarn.recommendations);
if (resWarn.status === "WARNING" && resWarn.warnings.length >= 2 && resWarn.recommendations.includes("Upload Foto Paket & Resi")) {
  console.log("Result: PASS");
} else {
  console.error("Result: FAIL", resWarn);
  process.exit(1);
}

console.log("\n--- TEST 3: CUSTOMER MISSING (CRITICAL) ---");
const db3 = createFreshDb();
const criticalTx: any = {
  ...validTx,
  id: "TRX-1003",
  transaksi_id: "TRX-1003",
  no_resi: "EXP-1003",
  pengirim_id: "NON_EXISTENT"
};
db3.MASTER_TRANSAKSI.push(criticalTx);

const resCrit = auditTransaction(db3, "TRX-1003");
console.log("Status:", resCrit.status);
console.log("Score:", resCrit.score);
console.log("Errors:", resCrit.errors);
if (resCrit.status === "CRITICAL" && resCrit.score === 0) {
  console.log("Result: PASS");
} else {
  console.error("Result: FAIL", resCrit);
  process.exit(1);
}

console.log("\n--- TEST 4: DUPLICATE RESI (CRITICAL) ---");
const db4 = createFreshDb();
db4.MASTER_TRANSAKSI.push(validTx);
const dupTx: any = {
  ...validTx,
  id: "TRX-1004",
  transaksi_id: "TRX-1004",
  no_resi: "EXP-1001" // Duplicate of TRX-1001
};
db4.MASTER_TRANSAKSI.push(dupTx);

const resDup = auditTransaction(db4, "TRX-1004");
console.log("Status:", resDup.status);
console.log("Score:", resDup.score);
console.log("Errors:", resDup.errors);
if (resDup.status === "CRITICAL" && resDup.errors.some(e => e.includes("DUPLICATE DETECTED"))) {
  console.log("Result: PASS");
} else {
  console.error("Result: FAIL", resDup);
  process.exit(1);
}

console.log("\n--- TEST 5: BATCH AUDIT HELPERS ---");
const dbBatch = createFreshDb();
// TRX-1: Valid
dbBatch.MASTER_TRANSAKSI.push(validTx);
dbBatch.MASTER_PENGIRIMAN.push({ transaksi_id: "TRX-1001", no_resi: "EXP-1001" });

// TRX-2: Warning
dbBatch.MASTER_TRANSAKSI.push(warningTx);
dbBatch.MASTER_PENGIRIMAN.push({ transaksi_id: "TRX-1002", no_resi: "EXP-1002" });

// TRX-3: Critical (Missing customer)
dbBatch.MASTER_TRANSAKSI.push(criticalTx);

const dailyRes = auditDaily(dbBatch, "2026-08-06", "OUT-001");
console.log("Daily Audit Summary:", {
  total: dailyRes.total,
  validCount: dailyRes.validCount,
  warningCount: dailyRes.warningCount,
  errorCount: dailyRes.errorCount,
  criticalCount: dailyRes.criticalCount,
  avgScore: dailyRes.averageScore
});

if (dailyRes.total === 3 && dailyRes.validCount === 1 && dailyRes.warningCount === 1 && dailyRes.criticalCount === 1) {
  console.log("Result: PASS");
} else {
  console.error("Result: FAIL", dailyRes);
  process.exit(1);
}

console.log("\n==========================================");
console.log("   ALL AUDIT ENGINE TESTS PASSED SUCCESSFULLY");
console.log("==========================================");
