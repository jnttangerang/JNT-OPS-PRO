import { 
  validateDailyClosing, 
  executeDailyClosing, 
  reopenDailyClosing, 
  getDailyClosingStatus, 
  getDailyClosingRecord 
} from "./src/lib/dailyClosingEngine";
import { resolveException } from "./src/lib/reconciliationReviewEngine";
import { getAuditTrail } from "./src/lib/auditTrailEngine";

function runPhase30Tests() {
  console.log("=========================================");
  console.log("RUNNING PHASE 30 DAILY CLOSING TEST SUITE");
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

  // Clean mock database factory
  const createMockDb = () => ({
    MASTER_CUSTOMER: [],
    MASTER_PENGIRIM: [
      { id: "SND-P30-01", nama: "Pengirim Alpha", hp: "08111" }
    ],
    MASTER_PENERIMA: [
      { id: "RCV-P30-01", nama: "Penerima Beta", hp: "08222" }
    ],
    MASTER_TRANSAKSI: [
      {
        id: "TRX-P30-101",
        no_resi: "JNT-P30-101",
        outlet_id: "OUT-A",
        tanggal_transaksi: "2026-08-07",
        created_at: "2026-08-07T10:00:00.000Z",
        status_transaksi: "PAID",
        pengirim_id: "SND-P30-01",
        penerima_id: "RCV-P30-01",
        snapshot_nama_pengirim: "Pengirim Alpha",
        snapshot_nama_penerima: "Penerima Beta",
        ongkir_customer: 20000,
        total_customer: 25000,
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
        id: "SHP-P30-101",
        transaksi_id: "TRX-P30-101",
        no_resi: "JNT-P30-101",
        outlet_id: "OUT-A",
        tanggal_pengiriman: "2026-08-07",
        created_at: "2026-08-07T10:00:00.000Z",
        status_pengiriman: "PAID",
        snapshot_nama_pengirim: "Pengirim Alpha",
        snapshot_nama_penerima: "Penerima Beta"
      }
    ],
    Master_Setoran: [
      {
        setoran_id: "STR-P30-101",
        outlet_id: "OUT-A",
        tanggal: "2026-08-07",
        nominal: 20000,
        status: "DISETUJUI"
      }
    ],
    AuditLogs: [
      {
        audit_id: "AUD-STR-01",
        entity_id: "STR-P30-101",
        entity_type: "SETORAN",
        event_type: "SETORAN_APPROVED",
        result: "SUCCESS",
        created_at: "2026-08-07T11:00:00.000Z"
      }
    ],
    ReconciliationExceptions: [],
    DailyClosing: []
  });

  const actorAdmin = { actor_id: "ADM-101", actor_name: "Admin Susi", actor_role: "ADMIN" };
  const actorStaff = { actor_id: "STF-101", actor_name: "Staff Budi", actor_role: "STAFF" };
  const actorOwner = { actor_id: "OWN-101", actor_name: "Owner Hendra", actor_role: "OWNER" };

  // TEST 1: Closing Normal tanpa exception -> READY -> CLOSED
  const db1 = createMockDb();
  const val1 = validateDailyClosing(db1, { outlet_id: "OUT-A", tanggal: "2026-08-07", actor: actorAdmin });
  const exec1 = executeDailyClosing(db1, { outlet_id: "OUT-A", tanggal: "2026-08-07", actor: actorAdmin });
  assert(
    val1.status === "success" && 
    val1.data?.status === "READY" && 
    exec1.status === "success" && 
    exec1.data?.status === "CLOSED", 
    "TEST 1: Closing Normal tanpa exception -> READY -> CLOSED"
  );

  // TEST 2: Ada CRITICAL exception OPEN -> BLOCKED
  const db2 = createMockDb();
  // Duplicate resi forces a CRITICAL exception
  db2.MASTER_TRANSAKSI.push({
    id: "TRX-P30-102",
    no_resi: "JNT-P30-101", // Duplicate Resi!
    outlet_id: "OUT-A",
    tanggal_transaksi: "2026-08-07",
    created_at: "2026-08-07T11:00:00.000Z",
    status_transaksi: "PAID",
    pengirim_id: "SND-P30-01",
    penerima_id: "RCV-P30-01",
    snapshot_nama_pengirim: "Pengirim Alpha",
    snapshot_nama_penerima: "Penerima Beta",
    ongkir_customer: 20000,
    total_customer: 20000,
    packing: 0,
    amplop: 0,
    biaya_lain: 0,
    kas_outlet: 0,
    potongan_diskon: 0,
    wajib_setor_owner: 20000
  });
  const val2 = validateDailyClosing(db2, { outlet_id: "OUT-A", tanggal: "2026-08-07", actor: actorAdmin });
  const exec2 = executeDailyClosing(db2, { outlet_id: "OUT-A", tanggal: "2026-08-07", actor: actorAdmin });
  assert(
    val2.status === "blocked" && 
    exec2.status === "error" && 
    exec2.data?.status === "BLOCKED", 
    "TEST 2: Ada CRITICAL exception OPEN -> BLOCKED"
  );

  // TEST 3: Ada ERROR exception OPEN -> BLOCKED
  const db3 = createMockDb();
  // Transaction without shipment forces an ERROR exception
  db3.MASTER_TRANSAKSI.push({
    id: "TRX-P30-ORPHAN",
    no_resi: "JNT-P30-ORPHAN",
    outlet_id: "OUT-A",
    tanggal_transaksi: "2026-08-07",
    created_at: "2026-08-07T12:00:00.000Z",
    status_transaksi: "PAID",
    pengirim_id: "SND-P30-01",
    penerima_id: "RCV-P30-01",
    snapshot_nama_pengirim: "Pengirim Alpha",
    snapshot_nama_penerima: "Penerima Beta",
    ongkir_customer: 15000,
    total_customer: 15000,
    packing: 0,
    amplop: 0,
    biaya_lain: 0,
    kas_outlet: 0,
    potongan_diskon: 0,
    wajib_setor_owner: 15000
  });
  const val3 = validateDailyClosing(db3, { outlet_id: "OUT-A", tanggal: "2026-08-07", actor: actorAdmin });
  assert(
    val3.status === "blocked" && 
    val3.blocking_reasons && val3.blocking_reasons.some(r => r.includes("ERROR")), 
    "TEST 3: Ada ERROR exception OPEN -> BLOCKED"
  );

  // TEST 4: Exception sudah RESOLVED -> closing dapat lanjut
  for (const exc of db3.ReconciliationExceptions) {
    resolveException(db3, {
      exception_id: exc.exception_id,
      resolution: "RESOLVED",
      resolution_reason: "Resi telah diinput manual di sistem ekspedisi.",
      actor: actorOwner
    });
  }
  // Add missing shipment row so operational data is consistent
  db3.MASTER_PENGIRIMAN.push({
    id: "SHP-P30-ORPHAN",
    transaksi_id: "TRX-P30-ORPHAN",
    no_resi: "JNT-P30-ORPHAN",
    outlet_id: "OUT-A",
    tanggal_pengiriman: "2026-08-07",
    created_at: "2026-08-07T12:00:00.000Z",
    status_pengiriman: "PAID",
    snapshot_nama_pengirim: "Pengirim Alpha",
    snapshot_nama_penerima: "Penerima Beta"
  });
  // Also update setoran if required
  db3.Master_Setoran[0].nominal = 35000; // Match updated total (20000 + 15000)
  const val4 = validateDailyClosing(db3, { outlet_id: "OUT-A", tanggal: "2026-08-07", actor: actorAdmin }); 
  assert(val4.status === "success" && val4.data?.status === "READY", "TEST 4: Exception sudah RESOLVED -> closing dapat lanjut");

  // TEST 5: Financial discrepancy -> BLOCKED
  const db5 = createMockDb();
  // Stored wajib_setor_owner differs from Financial Engine calculation
  db5.MASTER_TRANSAKSI[0].wajib_setor_owner = 1000; // Mismatch (expected 20000)
  const val5 = validateDailyClosing(db5, { outlet_id: "OUT-A", tanggal: "2026-08-07", actor: actorAdmin });
  assert(val5.status === "blocked", "TEST 5: Financial discrepancy -> BLOCKED");

  // TEST 6: Setoran Owner belum sesuai aturan -> BLOCKED
  const db6 = createMockDb();
  db6.Master_Setoran = []; // No setoran record
  const val6 = validateDailyClosing(db6, { outlet_id: "OUT-A", tanggal: "2026-08-07", actor: actorAdmin });
  assert(val6.status === "blocked" && val6.blocking_reasons?.some(r => r.includes("Setoran Owner")), "TEST 6: Setoran Owner belum sesuai aturan -> BLOCKED");

  // TEST 7: Outlet A tidak mencampur data Outlet B
  const db7 = createMockDb();
  db7.MASTER_TRANSAKSI.push({
    id: "TRX-P30-OUTB",
    no_resi: "JNT-P30-OUTB",
    outlet_id: "OUT-B",
    tanggal_transaksi: "2026-08-07",
    created_at: "2026-08-07T10:00:00.000Z",
    status_transaksi: "PAID",
    pengirim_id: "SND-P30-01",
    penerima_id: "RCV-P30-01",
    snapshot_nama_pengirim: "Pengirim Alpha",
    snapshot_nama_penerima: "Penerima Beta",
    ongkir_customer: 50000,
    total_customer: 50000,
    packing: 0,
    amplop: 0,
    biaya_lain: 0,
    kas_outlet: 0,
    potongan_diskon: 0,
    wajib_setor_owner: 50000
  });
  const val7A = validateDailyClosing(db7, { outlet_id: "OUT-A", tanggal: "2026-08-07", actor: actorAdmin });
  assert(val7A.data?.total_customer === 25000 && val7A.data?.transaction_count === 1, "TEST 7: Outlet A tidak mencampur data Outlet B");

  // TEST 8: Closing dua kali -> 1 logical closing record
  const db8 = createMockDb();
  validateDailyClosing(db8, { outlet_id: "OUT-A", tanggal: "2026-08-07", actor: actorAdmin });
  validateDailyClosing(db8, { outlet_id: "OUT-A", tanggal: "2026-08-07", actor: actorAdmin });
  assert(db8.DailyClosing.length === 1, "TEST 8: Closing dua kali -> 1 logical closing record");

  // TEST 9: Closing periode yang sudah CLOSED -> tidak membuat record baru
  executeDailyClosing(db8, { outlet_id: "OUT-A", tanggal: "2026-08-07", actor: actorAdmin });
  const exec9 = executeDailyClosing(db8, { outlet_id: "OUT-A", tanggal: "2026-08-07", actor: actorAdmin });
  assert(db8.DailyClosing.length === 1 && exec9.status === "success" && exec9.data?.status === "CLOSED", "TEST 9: Closing periode yang sudah CLOSED -> tidak membuat record baru");

  // TEST 10: Reopen oleh Staff / Admin tanpa permission -> REJECTED
  const reopenForbidden = reopenDailyClosing(db8, {
    outlet_id: "OUT-A",
    tanggal: "2026-08-07",
    reason: "Percobaan reopen oleh staff",
    actor: actorStaff
  });
  assert(reopenForbidden.status === "error" && reopenForbidden.error_code === "REOPEN_NOT_AUTHORIZED", "TEST 10: Reopen oleh Staff/Admin tanpa permission -> REJECTED");

  // TEST 11: Reopen oleh Owner -> REOPENED
  const reopenSuccess = reopenDailyClosing(db8, {
    outlet_id: "OUT-A",
    tanggal: "2026-08-07",
    reason: "Perlu koreksi laporan penyesuaian kasir.",
    actor: actorOwner
  });
  assert(reopenSuccess.status === "success" && db8.DailyClosing[0].status === "REOPENED", "TEST 11: Reopen oleh Owner -> REOPENED");

  // TEST 12: Setelah reopen -> closing kembali -> VALIDATING -> READY -> CLOSED
  const val12 = validateDailyClosing(db8, { outlet_id: "OUT-A", tanggal: "2026-08-07", actor: actorAdmin });
  const exec12 = executeDailyClosing(db8, { outlet_id: "OUT-A", tanggal: "2026-08-07", actor: actorAdmin });
  assert(
    val12.status === "success" && 
    val12.data?.status === "READY" && 
    exec12.status === "success" && 
    exec12.data?.status === "CLOSED", 
    "TEST 12: Setelah reopen -> closing kembali -> VALIDATING -> READY -> CLOSED"
  );

  // TEST 13: Audit Trail event logging
  const auditLogs = getAuditTrail(db8, { entity_type: "DAILY_CLOSING" });
  assert(
    auditLogs.some(a => a.event_type === "CLOSING_STARTED") &&
    auditLogs.some(a => a.event_type === "CLOSING_VALIDATED") &&
    auditLogs.some(a => a.event_type === "CLOSING_COMPLETED") &&
    auditLogs.some(a => a.event_type === "CLOSING_REOPENED"),
    "TEST 13: Audit Trail event logging (CLOSING_STARTED, VALIDATED, COMPLETED, REOPENED)"
  );

  // TEST 14: Tidak ada perubahan pada MASTER_TRANSAKSI selama validation
  const db14 = createMockDb();
  const txBefore = JSON.stringify(db14.MASTER_TRANSAKSI);
  validateDailyClosing(db14, { outlet_id: "OUT-A", tanggal: "2026-08-07", actor: actorAdmin });
  const txAfter = JSON.stringify(db14.MASTER_TRANSAKSI);
  assert(txBefore === txAfter, "TEST 14: Tidak ada perubahan pada MASTER_TRANSAKSI selama validation");

  // TEST 15: Financial Engine tetap menjadi satu-satunya sumber perhitungan
  const db15 = createMockDb();
  const val15 = validateDailyClosing(db15, { outlet_id: "OUT-A", tanggal: "2026-08-07", actor: actorAdmin });
  assert(
    val15.data?.total_customer === 25000 && 
    val15.data?.total_owner_deposit === 20000 && 
    val15.data?.total_outlet_cash === 5000, 
    "TEST 15: Financial Engine tetap menjadi satu-satunya sumber perhitungan"
  );

  // TEST 16: Reconciliation Engine tetap menjadi sumber reconciliation
  assert(val15.data?.reconciliation_status === "MATCHED", "TEST 16: Reconciliation Engine tetap menjadi sumber reconciliation");

  // TEST 17: No duplicate closing records
  validateDailyClosing(db15, { outlet_id: "OUT-A", tanggal: "2026-08-07", actor: actorAdmin });
  executeDailyClosing(db15, { outlet_id: "OUT-A", tanggal: "2026-08-07", actor: actorAdmin });
  assert(db15.DailyClosing.length === 1, "TEST 17: No duplicate closing records");

  console.log("\n=========================================");
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=========================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase30Tests();
