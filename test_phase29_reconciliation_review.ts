import { 
  reconcileTransaction, 
  reconcileDaily 
} from "./src/lib/reconciliationEngine";
import { 
  syncReconciliationExceptions, 
  startExceptionReview, 
  resolveException, 
  reopenException, 
  getExceptions, 
  getClosingReconciliationStatus,
  generateExceptionFingerprint,
  normalizeEntityType
} from "./src/lib/reconciliationReviewEngine";
import { getAuditTrail } from "./src/lib/auditTrailEngine";

function runPhase29Tests() {
  console.log("=========================================");
  console.log("RUNNING PHASE 29 RECONCILIATION REVIEW TEST SUITE");
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
        id: "TRX-P29-001",
        no_resi: "JNT-P29-001",
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
        wajib_setor_owner: 10000, // Mismatch (expected 20000) -> FINANCIAL_CALCULATION_MISMATCH
        potongan_diskon: 0
      }
    ],
    MASTER_PENGIRIMAN: [
      {
        id: "SHP-P29-001",
        transaksi_id: "TRX-P29-001",
        no_resi: "JNT-P29-001",
        outlet_id: "OUT-01",
        tanggal_pengiriman: "2026-08-07",
        created_at: "2026-08-07T10:00:00.000Z",
        status_pengiriman: "PAID",
        snapshot_nama_pengirim: "Pengirim A",
        snapshot_nama_penerima: "Penerima B"
      }
    ],
    Master_Setoran: [],
    AuditLogs: [],
    ReconciliationExceptions: []
  });

  // TEST 1: Entity type normalization & Fingerprint generation
  const norm1 = normalizeEntityType("TRANSACTION", "MISSING_SENDER");
  const norm2 = normalizeEntityType("SHIPPING", "SHIPMENT_WITHOUT_TRANSACTION");
  const fp1 = generateExceptionFingerprint("TRANSACTION", "FINANCIAL_MISMATCH", "TRANSAKSI", "TRX-P29-001", "TRX-P29-001", "OUT-01");
  assert(norm1 === "FOREIGN_KEY" && norm2 === "SHIPPING" && fp1.includes("FINANCIAL_MISMATCH"), "TEST 1: Entity type normalization & Fingerprint generation");

  // TEST 2: Sync raw exceptions from Phase 28 reconciliation into DB
  const db1 = createMockDb();
  const recRes1 = reconcileTransaction(db1, "TRX-P29-001");
  const synced1 = syncReconciliationExceptions(db1, recRes1);
  assert(synced1.length > 0 && db1.ReconciliationExceptions.length > 0 && db1.ReconciliationExceptions[0].status === "OPEN", "TEST 2: Sync raw exceptions from Phase 28 reconciliation into DB");

  // TEST 3: Sync idempotency - multiple sync calls do not duplicate exception records
  syncReconciliationExceptions(db1, recRes1);
  syncReconciliationExceptions(db1, recRes1);
  assert(db1.ReconciliationExceptions.length === synced1.length, "TEST 3: Sync idempotency - no duplicates created on repeat sync");

  // TEST 4: Start Exception Review (OPEN -> IN_REVIEW)
  const excId1 = db1.ReconciliationExceptions[0].exception_id;
  const revRes1 = startExceptionReview(db1, excId1, { actor_id: "ADM-001", actor_name: "Admin Budi", actor_role: "ADMIN" });
  assert(revRes1.status === "success" && db1.ReconciliationExceptions[0].status === "IN_REVIEW", "TEST 4: Start Exception Review (OPEN -> IN_REVIEW)");

  // TEST 5: Start Review Idempotency
  const revRes1B = startExceptionReview(db1, excId1, { actor_id: "ADM-001", actor_name: "Admin Budi", actor_role: "ADMIN" });
  assert(revRes1B.status === "success" && revRes1B.message?.includes("IN_REVIEW"), "TEST 5: Start Review Idempotency");

  // TEST 6: Resolve Exception without reason -> REJECTED
  const resErr = resolveException(db1, {
    exception_id: excId1,
    resolution: "RESOLVED",
    resolution_reason: "   ", // Empty string
    actor: { actor_id: "ADM-001", actor_role: "ADMIN" }
  });
  assert(resErr.status === "error" && resErr.message?.includes("wajib diisi"), "TEST 6: Resolve Exception without reason -> REJECTED");

  // TEST 7: Resolve Exception with valid decision & reason -> RESOLVED
  const resSuccess = resolveException(db1, {
    exception_id: excId1,
    resolution: "RESOLVED",
    resolution_reason: "Koreksi selisih setoran telah diverifikasi dengan kwitansi kasir.",
    evidence: { source: "KWITANSI", reference: "KW-9001", note: "Verified physically" },
    actor: { actor_id: "ADM-001", actor_name: "Admin Budi", actor_role: "ADMIN" }
  });
  assert(
    resSuccess.status === "success" && 
    db1.ReconciliationExceptions[0].status === "RESOLVED" && 
    db1.ReconciliationExceptions[0].resolution_reason?.includes("verifikasi"), 
    "TEST 7: Resolve Exception with valid decision & reason -> RESOLVED"
  );

  // TEST 8: Audit Trail logging for review events
  const auditLogs1 = getAuditTrail(db1, { entity_type: "RECONCILIATION_EXCEPTION" });
  assert(
    auditLogs1.length >= 2 && 
    auditLogs1.some(a => a.event_type === "RECONCILIATION_EXCEPTION_REVIEW_STARTED") &&
    auditLogs1.some(a => a.event_type === "RECONCILIATION_EXCEPTION_RESOLVED"), 
    "TEST 8: Audit Trail logging for review events"
  );

  // TEST 9: Manual Reopen Exception by Owner -> REOPENED
  const reopenRes = reopenException(db1, {
    exception_id: excId1,
    reason: "Ditemukan perbedaan kembali pada laporan fisik.",
    actor: { actor_id: "OWN-001", actor_name: "Owner Ahmad", actor_role: "OWNER" }
  });
  assert(
    reopenRes.status === "success" && 
    db1.ReconciliationExceptions[0].status === "REOPENED", 
    "TEST 9: Manual Reopen Exception by Owner -> REOPENED"
  );

  // TEST 10: Manual Reopen Exception permission restriction for Staff/Non-Owner
  // First re-resolve it
  resolveException(db1, {
    exception_id: excId1,
    resolution: "ACCEPTED",
    resolution_reason: "Diakui sebagai selisih pembulatan wajar.",
    actor: { actor_id: "ADM-001", actor_role: "ADMIN" }
  });
  const reopenForbidden = reopenException(db1, {
    exception_id: excId1,
    reason: "Attempt reopen by staff",
    actor: { actor_id: "STF-001", actor_name: "Staff", actor_role: "STAFF" }
  });
  assert(reopenForbidden.status === "error" && reopenForbidden.message?.includes("Akses ditolak"), "TEST 10: Reopen Exception permission restriction for Staff/Non-Owner");

  // TEST 11: Auto Re-open on Reconciliation Re-run
  // Current status is ACCEPTED or RESOLVED, but discrepancy still exists in DB!
  const recResReRun = reconcileTransaction(db1, "TRX-P29-001");
  syncReconciliationExceptions(db1, recResReRun);
  assert(
    db1.ReconciliationExceptions[0].status === "REOPENED", 
    "TEST 11: Auto Re-open on Reconciliation Re-run when discrepancy persists"
  );

  // TEST 12: Financial Data Safety - Master tables untampered during review
  const db2 = createMockDb();
  const txBefore = JSON.stringify(db2.MASTER_TRANSAKSI);
  const recRes2 = reconcileTransaction(db2, "TRX-P29-001");
  syncReconciliationExceptions(db2, recRes2);
  const excId2 = db2.ReconciliationExceptions[0].exception_id;
  startExceptionReview(db2, excId2, { actor_id: "ADM-001", actor_role: "ADMIN" });
  resolveException(db2, {
    exception_id: excId2,
    resolution: "ACCEPTED",
    resolution_reason: "Diterima tanpa mengubah transaksi dasar.",
    actor: { actor_id: "ADM-001", actor_role: "ADMIN" }
  });
  const txAfter = JSON.stringify(db2.MASTER_TRANSAKSI);
  assert(txBefore === txAfter, "TEST 12: Financial Data Safety - Master tables untampered during review");

  // TEST 13: Closing Module Reconciliation Status - CRITICAL Exception Open
  const db3 = createMockDb();
  const recRes3 = reconcileDaily(db3, "2026-08-07", "OUT-01");
  syncReconciliationExceptions(db3, recRes3);
  const closingStatus1 = getClosingReconciliationStatus(db3, "OUT-01", "2026-08-07");
  assert(
    closingStatus1.closing_eligibility === "BLOCKED" || closingStatus1.closing_eligibility === "NEEDS_REVIEW", 
    "TEST 13: Closing Module Reconciliation Status - Unresolved exception restricts closing"
  );

  // TEST 14: Closing Module Reconciliation Status - All Exceptions Resolved
  for (const exc of db3.ReconciliationExceptions) {
    resolveException(db3, {
      exception_id: exc.exception_id,
      resolution: "RESOLVED",
      resolution_reason: "Telah diselesaikan secara manual oleh Owner.",
      actor: { actor_id: "OWN-001", actor_role: "OWNER" }
    });
  }
  const closingStatus2 = getClosingReconciliationStatus(db3, "OUT-01", "2026-08-07");
  assert(
    closingStatus2.closing_eligibility === "ELIGIBLE" && closingStatus2.status_code === "NO_OPEN_EXCEPTION", 
    "TEST 14: Closing Module Reconciliation Status - All Exceptions Resolved -> ELIGIBLE"
  );

  // TEST 15: Exceptions Query & Filtering
  const filteredList = getExceptions(db3, { status: "RESOLVED" });
  assert(filteredList.length > 0 && filteredList.every(e => e.status === "RESOLVED"), "TEST 15: Exceptions Query & Filtering");

  console.log("\n=========================================");
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=========================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase29Tests();
