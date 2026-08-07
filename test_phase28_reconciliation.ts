import { 
  reconcileTransaction, 
  reconcileDaily, 
  reconcileOutlet, 
  calculateReconciliationSummary,
  logReconciliationExecution
} from "./src/lib/reconciliationEngine";
import { getAuditTrail, reconstructTransactionHistory } from "./src/lib/auditTrailEngine";

function runPhase28Tests() {
  console.log("=========================================");
  console.log("RUNNING PHASE 28 RECONCILIATION TEST SUITE");
  console.log("=========================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? " - " + detail : ""}`);
      failed++;
    }
  }

  // Create clean initial mock DB
  const createMockDb = () => ({
    MASTER_CUSTOMER: [],
    MASTER_PENGIRIM: [
      { id: "SND-101", nama: "Pengirim A", hp: "08111" }
    ],
    MASTER_PENERIMA: [
      { id: "RCV-201", nama: "Penerima B", hp: "08222" }
    ],
    MASTER_TRANSAKSI: [
      {
        id: "TRX-P28-001",
        no_resi: "JNT-P28-001",
        outlet_id: "OUT-01",
        tanggal_transaksi: "2026-08-07",
        created_at: "2026-08-07T10:00:00.000Z",
        status_transaksi: "PAID",
        pengirim_id: "SND-101",
        penerima_id: "RCV-201",
        snapshot_nama_pengirim: "Pengirim A",
        snapshot_nama_penerima: "Penerima B",
        ongkir_customer: 20000,
        total_customer: 20000,
        packing: 5000,
        amplop: 0,
        biaya_lain: 0,
        kas_outlet: 5000,
        wajib_setor_owner: 20000,
        potongan_diskon: 0
      }
    ],
    MASTER_PENGIRIMAN: [
      {
        id: "SHP-P28-001",
        transaksi_id: "TRX-P28-001",
        no_resi: "JNT-P28-001",
        outlet_id: "OUT-01",
        tanggal_pengiriman: "2026-08-07",
        created_at: "2026-08-07T10:00:00.000Z",
        status_pengiriman: "PAID",
        snapshot_nama_pengirim: "Pengirim A",
        snapshot_nama_penerima: "Penerima B"
      }
    ],
    Master_Setoran: [
      {
        setoran_id: "SET-2026-001",
        tanggal: "2026-08-07",
        outlet_id: "OUT-01",
        total_setoran_owner: 20000,
        status: "DISETUJUI"
      }
    ],
    AuditLogs: [
      {
        audit_id: "AUD-SET-001",
        entity_id: "SET-2026-001",
        entity_type: "SETORAN",
        event_type: "SETORAN_APPROVED",
        result: "SUCCESS",
        created_at: "2026-08-07T11:00:00.000Z"
      }
    ]
  });

  // TEST 1: Perfect transaction reconciliation -> MATCHED
  const db1 = createMockDb();
  const res1 = reconcileTransaction(db1, "TRX-P28-001");
  assert(res1.status === "MATCHED" && res1.exceptions.length === 0, "TEST 1: Perfect transaction reconciliation -> MATCHED");

  // TEST 2: Transaction without shipment -> ERROR
  const db2 = createMockDb();
  db2.MASTER_PENGIRIMAN = []; // Remove shipment
  const res2 = reconcileTransaction(db2, "TRX-P28-001");
  assert(res2.status === "MISMATCH" && res2.exceptions.some(e => e.type === "TRANSACTION_WITHOUT_SHIPMENT"), "TEST 2: Transaction without shipment -> ERROR");

  // TEST 3: Shipment without transaction -> ERROR
  const db3 = createMockDb();
  db3.MASTER_TRANSAKSI = []; // Remove transaction
  const res3 = reconcileTransaction(db3, "TRX-P28-001");
  assert(res3.status === "MISMATCH" && res3.exceptions.some(e => e.type === "SHIPMENT_WITHOUT_TRANSACTION"), "TEST 3: Shipment without transaction -> ERROR");

  // TEST 4: Duplicate transaction_id -> CRITICAL
  const db4 = createMockDb();
  db4.MASTER_TRANSAKSI.push({ ...db4.MASTER_TRANSAKSI[0] }); // Push duplicate row
  const res4 = reconcileTransaction(db4, "TRX-P28-001");
  assert(res4.status === "CRITICAL" && res4.exceptions.some(e => e.type === "DUPLICATE_TRANSACTION_ID"), "TEST 4: Duplicate transaction_id -> CRITICAL");

  // TEST 5: Missing sender FK -> ERROR
  const db5 = createMockDb();
  db5.MASTER_PENGIRIM = []; // Clear senders
  const res5 = reconcileTransaction(db5, "TRX-P28-001");
  assert(res5.status === "MISMATCH" && res5.exceptions.some(e => e.type === "MISSING_SENDER"), "TEST 5: Missing sender FK -> ERROR");

  // TEST 6: Missing receiver FK -> ERROR
  const db6 = createMockDb();
  db6.MASTER_PENERIMA = []; // Clear receivers
  const res6 = reconcileTransaction(db6, "TRX-P28-001");
  assert(res6.status === "MISMATCH" && res6.exceptions.some(e => e.type === "MISSING_RECEIVER"), "TEST 6: Missing receiver FK -> ERROR");

  // TEST 7: Snapshot mismatch -> ERROR
  const db7 = createMockDb();
  db7.MASTER_PENGIRIMAN[0].snapshot_nama_pengirim = "Different Name";
  const res7 = reconcileTransaction(db7, "TRX-P28-001");
  assert(res7.status === "MISMATCH" && res7.exceptions.some(e => e.type === "SNAPSHOT_MISMATCH"), "TEST 7: Snapshot mismatch -> ERROR");

  // TEST 8: Financial Engine result matches stored values -> MATCHED
  const db8 = createMockDb();
  const res8 = reconcileTransaction(db8, "TRX-P28-001");
  assert(res8.status === "MATCHED" && res8.exceptions.length === 0, "TEST 8: Financial Engine result matches stored values -> MATCHED");

  // TEST 9: Financial stored value differs from Financial Engine -> CRITICAL/ERROR
  const db9 = createMockDb();
  db9.MASTER_TRANSAKSI[0].wajib_setor_owner = 10000; // Wrong stored value vs expected 20000
  const res9 = reconcileTransaction(db9, "TRX-P28-001");
  assert(res9.exceptions.some(e => e.type === "FINANCIAL_CALCULATION_MISMATCH"), "TEST 9: Financial stored value differs from Financial Engine -> CRITICAL/ERROR");

  // TEST 10: Rounding verification against Financial Engine -> MATCHED
  const db10 = createMockDb();
  const res10 = reconcileTransaction(db10, "TRX-P28-001");
  assert(!res10.exceptions.some(e => e.field === "rounding"), "TEST 10: Rounding verification against Financial Engine -> MATCHED");

  // TEST 11: Owner deposit missing -> WARNING/ERROR
  const db11 = createMockDb();
  db11.Master_Setoran = []; // Remove setoran
  const res11 = reconcileTransaction(db11, "TRX-P28-001");
  assert(res11.exceptions.some(e => e.type === "OWNER_DEPOSIT_MISSING"), "TEST 11: Owner deposit missing -> WARNING/ERROR");

  // TEST 12: Outlet cash mismatch -> ERROR
  const db12 = createMockDb();
  db12.MASTER_TRANSAKSI[0].kas_outlet = 12345; // Mismatch with packing + amplop + biaya_lain (5000)
  const res12 = reconcileTransaction(db12, "TRX-P28-001");
  assert(res12.exceptions.some(e => e.type === "OUTLET_CASH_MISMATCH" || e.type === "FINANCIAL_CALCULATION_MISMATCH"), "TEST 12: Outlet cash mismatch -> ERROR");

  // TEST 13: CANCELLED transaction excluded from finance -> PASS
  const db13 = createMockDb();
  db13.MASTER_TRANSAKSI[0].status_transaksi = "CANCELLED";
  db13.MASTER_TRANSAKSI[0].total_customer = 0;
  db13.MASTER_TRANSAKSI[0].wajib_setor_owner = 0;
  db13.MASTER_PENGIRIMAN[0].status_pengiriman = "CANCELLED";
  const res13 = reconcileTransaction(db13, "TRX-P28-001");
  assert(!res13.exceptions.some(e => e.type === "INVALID_TRANSACTION_INCLUDED"), "TEST 13: CANCELLED transaction excluded from finance -> PASS");

  // TEST 14: CANCELLED transaction incorrectly included in approved setoran -> CRITICAL
  const db14 = createMockDb();
  db14.MASTER_TRANSAKSI[0].status_transaksi = "CANCELLED";
  db14.MASTER_TRANSAKSI[0].total_customer = 20000;
  db14.MASTER_TRANSAKSI[0].wajib_setor_owner = 20000;
  db14.Master_Setoran[0].status = "DISETUJUI";
  const res14 = reconcileTransaction(db14, "TRX-P28-001");
  assert(res14.status === "CRITICAL" && res14.exceptions.some(e => e.type === "INVALID_TRANSACTION_INCLUDED"), "TEST 14: CANCELLED transaction incorrectly included -> CRITICAL");

  // TEST 15: Invalid lifecycle -> ERROR
  const db15 = createMockDb();
  db15.MASTER_TRANSAKSI[0].status_transaksi = "CANCELLED";
  db15.MASTER_PENGIRIMAN[0].status_pengiriman = "DELIVERED"; // Mismatch
  const res15 = reconcileTransaction(db15, "TRX-P28-001");
  assert(res15.exceptions.some(e => e.type === "TRANSACTION_STATUS_MISMATCH"), "TEST 15: Invalid lifecycle -> ERROR");

  // TEST 16: Approval without audit evidence -> ERROR
  const db16 = createMockDb();
  db16.Master_Setoran[0].status = "DISETUJUI";
  db16.AuditLogs = []; // Remove approval audit log
  const res16 = reconcileTransaction(db16, "TRX-P28-001");
  assert(res16.exceptions.some(e => e.type === "APPROVAL_EVIDENCE_MISSING"), "TEST 16: Approval without audit evidence -> ERROR");

  // TEST 17: Audit approval check -> PASS
  const db17 = createMockDb();
  const res17 = reconcileTransaction(db17, "TRX-P28-001");
  assert(!res17.exceptions.some(e => e.type === "APPROVAL_EVIDENCE_MISSING"), "TEST 17: Audit approval check -> PASS");

  // TEST 18: Cross-outlet transaction contamination -> CRITICAL
  const db18 = createMockDb();
  db18.MASTER_TRANSAKSI[0].outlet_id = "OUT-02"; // Cross-outlet transaction
  const res18 = reconcileDaily(db18, "2026-08-07", "OUT-01");
  assert(res18.status === "CRITICAL" && res18.exceptions.some(e => e.type === "CROSS_OUTLET_DATA_LEAK"), "TEST 18: Cross-outlet transaction contamination -> CRITICAL");

  // TEST 19: Duplicate active resi -> CRITICAL
  const db19 = createMockDb();
  db19.MASTER_TRANSAKSI.push({
    ...db19.MASTER_TRANSAKSI[0],
    id: "TRX-P28-002",
    no_resi: "JNT-P28-001" // Same active resi
  });
  const res19 = reconcileTransaction(db19, "TRX-P28-001");
  assert(res19.status === "CRITICAL" && res19.exceptions.some(e => e.type === "DUPLICATE_ACTIVE_RESI"), "TEST 19: Duplicate active resi -> CRITICAL");

  // TEST 20: Daily reconciliation aggregate -> PASS
  const db20 = createMockDb();
  const res20 = reconcileDaily(db20, "2026-08-07", "OUT-01");
  assert(res20.scope === "DAILY" && res20.status === "MATCHED", "TEST 20: Daily reconciliation aggregate -> PASS");

  // TEST 21: Outlet reconciliation -> PASS
  const db21 = createMockDb();
  const res21 = reconcileOutlet(db21, "OUT-01");
  assert(res21.scope === "OUTLET" && res21.status === "MATCHED", "TEST 21: Outlet reconciliation -> PASS");

  // TEST 22: Transaction timeline reconciliation -> PASS
  const db22 = createMockDb();
  db22.AuditLogs.push({
    audit_id: "AUD-TX-001",
    entity_id: "TRX-P28-001",
    entity_type: "TRANSACTION",
    event_type: "TRANSACTION_CREATED",
    result: "SUCCESS",
    created_at: "2026-08-07T10:00:00.000Z"
  });
  const history = reconstructTransactionHistory(db22, "TRX-P28-001");
  assert(Array.isArray(history) && history.length > 0, "TEST 22: Transaction timeline reconciliation -> PASS");

  // TEST 23: Critical exception generates Audit Trail -> PASS
  const db23 = createMockDb();
  const criticalRes = reconcileDaily(db23, "2026-08-07", "OUT-99");
  logReconciliationExecution(db23, criticalRes, "ADM-001");
  const auditLogs23 = getAuditTrail(db23, { entity_type: "RECONCILIATION" });
  assert(
    auditLogs23.length > 0 && 
    (auditLogs23[0].event_type === "RECONCILIATION_EXECUTED" || auditLogs23[0].event_type === "RECONCILIATION_CRITICAL"), 
    "TEST 23: Critical exception generates Audit Trail -> PASS"
  );

  // TEST 24: No auto-correction occurs -> PASS
  const db24 = createMockDb();
  const snapshotBefore = JSON.stringify(db24);
  reconcileTransaction(db24, "TRX-P28-001");
  reconcileDaily(db24, "2026-08-07", "OUT-01");
  reconcileOutlet(db24, "OUT-01");
  const snapshotAfter = JSON.stringify(db24);
  assert(snapshotBefore === snapshotAfter, "TEST 24: No auto-correction occurs -> PASS");

  // TEST 25: Null/NaN financial values handled safely -> PASS
  const db25 = createMockDb();
  db25.MASTER_TRANSAKSI[0].total_customer = null;
  (db25.MASTER_TRANSAKSI[0] as any).wajib_setor_owner = "invalid_number";
  db25.MASTER_TRANSAKSI[0].kas_outlet = undefined;
  const res25 = reconcileTransaction(db25, "TRX-P28-001");
  assert(typeof res25.expected_total === "number" && !isNaN(res25.expected_total), "TEST 25: Null/NaN financial values handled safely -> PASS");

  console.log("\n=========================================");
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=========================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase28Tests();
