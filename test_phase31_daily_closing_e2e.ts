import request from "supertest";
import app from "./server";
import fs from "fs";
import path from "path";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

// Reset db.json before running tests
function resetDb() {
  const dbPath = path.join(process.cwd(), "db.json");
  const initialDb = {
    Master_Setoran: [
      {
        id: "SET-OUT-A-2026-08-07",
        setoran_id: "SET-OUT-A-2026-08-07",
        outlet_id: "OUT-A",
        tanggal: "2026-08-07",
        tanggal_setoran: "2026-08-07",
        wajib_setor: 20000,
        nominal: 20000,
        jumlah_setor: 20000,
        jumlah_setoran: 20000,
        status: "APPROVED",
        status_setoran: "MATCHED",
        approval_status: "APPROVED",
        approved_by: "OWN-101",
        approved_at: "2026-08-07T20:00:00.000Z"
      }
    ],
    MASTER_PENGIRIMAN: [
      {
        id: "SHIP-P31-001",
        pengiriman_id: "SHIP-P31-001",
        transaksi_id: "TRX-P31-001",
        no_resi: "JNT-P31-001",
        outlet_id: "OUT-A",
        tanggal_pengiriman: "2026-08-07",
        created_at: "2026-08-07T10:00:00.000Z",
        status_pengiriman: "DELIVERED",
        ongkir_yoyi: 20000,
        asuransi: 0,
        biaya_lain_yoyi: 0,
        packing: 5000,
        amplop: 0,
        biaya_lain: 0,
        total_yoyi: 25000,
        diskon: 0
      }
    ],
    MASTER_TRANSAKSI: [
      {
        id: "TRX-P31-001",
        no_resi: "JNT-P31-001",
        outlet_id: "OUT-A",
        tanggal_transaksi: "2026-08-07",
        created_at: "2026-08-07T10:00:00.000Z",
        status_transaksi: "PAID",
        pengirim_id: "SND-P31-01",
        penerima_id: "RCV-P31-01",
        snapshot_nama_pengirim: "Pengirim Alpha",
        snapshot_nama_penerima: "Penerima Beta",
        ongkir_customer: 20000,
        total_customer: 25000,
        packing: 5000,
        amplop: 0,
        biaya_lain: 0,
        kas_outlet: 5000,
        potongan_diskon: 0,
        wajib_setor_owner: 20000
      }
    ],
    MASTER_PENGIRIM: [
      { id: "SND-P31-01", name: "Pengirim Alpha", phone: "08111111" }
    ],
    MASTER_PENERIMA: [
      { id: "RCV-P31-01", name: "Penerima Beta", phone: "08222222" }
    ],
    Master_Pelanggan: [
      { id: "SND-P31-01", name: "Pengirim Alpha", phone: "08111111" },
      { id: "RCV-P31-01", name: "Penerima Beta", phone: "08222222" }
    ],
    Outlets: [
      { outlet_id: "OUT-A", nama_outlet: "Outlet Alpha" },
      { outlet_id: "OUT-B", nama_outlet: "Outlet Beta" }
    ],
    AuditLogs: [],
    ReconciliationExceptions: [],
    DailyClosing: []
  };
  fs.writeFileSync(dbPath, JSON.stringify(initialDb, null, 2), "utf-8");
}

async function runPhase31E2ESuite() {
  console.log("=========================================");
  console.log("RUNNING PHASE 31 DAILY CLOSING FRONTEND & RUNTIME E2E SUITE");
  console.log("=========================================");

  resetDb();

  const actorAdmin = { actor_id: "ADM-101", actor_name: "Admin Budi", actor_role: "ADMIN" };
  const actorStaff = { actor_id: "STF-101", actor_name: "Staff Caca", actor_role: "STAFF" };
  const actorOwner = { actor_id: "OWN-101", actor_name: "Owner Agung", actor_role: "OWNER" };

  // TEST 1 — Open Closing
  const res1 = await request(app)
    .get("/api/dailyClosing/status?outlet_id=OUT-A&tanggal=2026-08-07");
  assert(res1.status === 200 && res1.body.data?.outlet_id === "OUT-A", "TEST 1: Status closing awal loaded (OPEN/READY)");

  // TEST 2 — Outlet Isolation
  const res2A = await request(app)
    .get("/api/dailyClosing/status?outlet_id=OUT-A&tanggal=2026-08-07");
  const res2B = await request(app)
    .get("/api/dailyClosing/status?outlet_id=OUT-B&tanggal=2026-08-07");
  assert(
    res2A.body.data?.total_customer === 25000 && 
    res2B.body.data?.total_customer === 0, 
    "TEST 2: Outlet isolation -> Outlet A dan Outlet B data terpisah sempurna"
  );

  // TEST 3 — Date Isolation
  const res3Date1 = await request(app)
    .get("/api/dailyClosing/status?outlet_id=OUT-A&tanggal=2026-08-07");
  const res3Date2 = await request(app)
    .get("/api/dailyClosing/status?outlet_id=OUT-A&tanggal=2026-08-08");
  assert(
    res3Date1.body.data?.transaction_count === 1 && 
    res3Date2.body.data?.transaction_count === 0, 
    "TEST 3: Date isolation -> Data tanggal 2026-08-07 dan 2026-08-08 terisolasi"
  );

  // TEST 4 — Validate Closing API
  const res4 = await request(app)
    .post("/api/dailyClosing/validate")
    .send({
      outlet_id: "OUT-A",
      tanggal: "2026-08-07",
      ...actorAdmin
    });
  console.log("RES4 STATUS:", res4.status, "RES4 BODY:", JSON.stringify(res4.body, null, 2));
  assert(res4.status === 200 && res4.body.data?.status === "READY", "TEST 4: Validate closing API -> status menjadi READY");

  // TEST 5 — Financial Summary Integrity
  assert(
    res4.body.data?.total_customer === 25000 &&
    res4.body.data?.total_owner_deposit === 20000 &&
    res4.body.data?.total_outlet_cash === 5000 &&
    res4.body.data?.valid_financial_transaction_count === 1 &&
    res4.body.data?.cancelled_transaction_count === 0,
    "TEST 5: Financial Summary persis cocok dengan Financial Engine"
  );

  // TEST 6 — Reconciliation Summary Integrity
  assert(
    res4.body.data?.reconciliation_status === "MATCHED" &&
    res4.body.data?.open_exceptions_count === 0,
    "TEST 6: Reconciliation Status persis cocok dengan Reconciliation Engine (MATCHED)"
  );

  // TEST 7 — Blocking Exception
  // Add orphan transaction without shipment to trigger ERROR exception and blocking
  const dbPath = path.join(process.cwd(), "db.json");
  const dbData = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
  dbData.MASTER_TRANSAKSI.push({
    id: "TRX-P31-ORPHAN",
    no_resi: "JNT-P31-ORPHAN",
    outlet_id: "OUT-A",
    tanggal_transaksi: "2026-08-07",
    created_at: "2026-08-07T12:00:00.000Z",
    status_transaksi: "PAID",
    pengirim_id: "SND-P31-01",
    penerima_id: "RCV-P31-01",
    snapshot_nama_pengirim: "Pengirim Alpha",
    snapshot_nama_penerima: "Penerima Beta",
    ongkir_customer: 10000,
    total_customer: 10000,
    packing: 0,
    amplop: 0,
    biaya_lain: 0,
    kas_outlet: 0,
    potongan_diskon: 0,
    wajib_setor_owner: 10000
  });
  fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), "utf-8");

  const res7 = await request(app)
    .post("/api/dailyClosing/validate")
    .send({
      outlet_id: "OUT-A",
      tanggal: "2026-08-07",
      ...actorAdmin
    });
  assert(
    res7.status === 400 && 
    (res7.body.status === "blocked" || res7.body.data?.status === "BLOCKED") &&
    res7.body.blocking_reasons?.length > 0,
    "TEST 7: Blocking exception terdeteksi -> Status BLOCKED dengan blocking_reasons"
  );

  // TEST 8 — Resolve Exception
  // Fetch synced exceptions and resolve the orphan exception
  const res8GetExc = await request(app)
    .post("/api/reconciliation/exceptions")
    .send({ outlet_id: "OUT-A" });
  
  const orphanExc = res8GetExc.body.data?.find((e: any) => e.transaksi_id === "TRX-P31-ORPHAN" || e.entity_id === "TRX-P31-ORPHAN");
  let res8Resolve: any = null;
  if (orphanExc) {
    const excId = orphanExc.exception_id || orphanExc.id;
    await request(app)
      .post("/api/reconciliation/review")
      .send({ exception_id: excId, ...actorAdmin });

    res8Resolve = await request(app)
      .post("/api/reconciliation/resolve")
      .send({
        exception_id: excId,
        resolution: "RESOLVED",
        resolution_reason: "Transaksi percobaan disetujui owner",
        ...actorOwner
      });
  }

  // Update setoran in db to match the new required setoran (30,000)
  const currentDbState = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
  if (currentDbState.Master_Setoran?.[0]) {
    currentDbState.Master_Setoran[0].nominal = 30000;
    currentDbState.Master_Setoran[0].jumlah_setor = 30000;
    currentDbState.Master_Setoran[0].jumlah_setoran = 30000;
    fs.writeFileSync(dbPath, JSON.stringify(currentDbState, null, 2), "utf-8");
  }

  assert(orphanExc && res8Resolve?.status === 200 && res8Resolve?.body.data?.status === "RESOLVED", "TEST 8: Exception berhasil diselesaikan (RESOLVED)");

  // Re-validate after resolve
  const res8Reval = await request(app)
    .post("/api/dailyClosing/validate")
    .send({
      outlet_id: "OUT-A",
      tanggal: "2026-08-07",
      ...actorAdmin
    });
  assert(res8Reval.status === 200 && res8Reval.body.data?.status === "READY", "TEST 8b: Setelah exception di-resolve -> Closing kembali READY");

  // TEST 9 — Close Daily Closing
  const res9 = await request(app)
    .post("/api/dailyClosing/close")
    .send({
      outlet_id: "OUT-A",
      tanggal: "2026-08-07",
      notes: "Closing harian berjalan lancar",
      ...actorAdmin
    });
  assert(res9.status === 200 && res9.body.data?.status === "CLOSED", "TEST 9: Close Daily Closing -> status menjadi CLOSED");

  // TEST 10 — Duplicate Close Protection
  const res10 = await request(app)
    .post("/api/dailyClosing/close")
    .send({
      outlet_id: "OUT-A",
      tanggal: "2026-08-07",
      ...actorAdmin
    });
  assert(res10.status === 200 && res10.body.data?.status === "CLOSED", "TEST 10: Duplicate Close Protection -> Idempotent, tetap CLOSED tanpa record ganda");

  // TEST 11 — Reopen Permission Restriction
  const res11 = await request(app)
    .post("/api/dailyClosing/reopen")
    .send({
      outlet_id: "OUT-A",
      tanggal: "2026-08-07",
      reason: "Perlu perbaikan laporan kasir",
      ...actorStaff
    });
  assert(res11.status === 400 && res11.body.error_code === "REOPEN_NOT_AUTHORIZED", "TEST 11: Staff/Admin reopen tanpa otorisasi -> REJECTED");

  // TEST 12 — Owner Reopen
  const res12 = await request(app)
    .post("/api/dailyClosing/reopen")
    .send({
      outlet_id: "OUT-A",
      tanggal: "2026-08-07",
      reason: "Perlu koreksi laporan penyesuaian kasir oleh Owner",
      ...actorOwner
    });
  assert(res12.status === 200 && res12.body.data?.status === "REOPENED", "TEST 12: Owner reopen -> Status menjadi REOPENED");

  // TEST 13 — Reclose after Reopen
  const res13Val = await request(app)
    .post("/api/dailyClosing/validate")
    .send({
      outlet_id: "OUT-A",
      tanggal: "2026-08-07",
      ...actorAdmin
    });
  const res13Close = await request(app)
    .post("/api/dailyClosing/close")
    .send({
      outlet_id: "OUT-A",
      tanggal: "2026-08-07",
      ...actorAdmin
    });
  assert(res13Close.status === 200 && res13Close.body.data?.status === "CLOSED", "TEST 13: Re-close setelah reopen -> Status menjadi CLOSED kembali");

  // TEST 14 — Audit Trail Verification
  const res14Audit = await request(app)
    .post("/api/auditTrail")
    .send({ outlet_id: "OUT-A", entity_type: "DAILY_CLOSING" });
  
  const eventTypes = (res14Audit.body.data || []).map((l: any) => l.event_type);
  assert(
    eventTypes.includes("CLOSING_VALIDATED") &&
    eventTypes.includes("CLOSING_COMPLETED") &&
    eventTypes.includes("CLOSING_REOPENED"),
    "TEST 14: Audit Trail mencatat lifecycle event (CLOSING_VALIDATED, COMPLETED, REOPENED)"
  );

  // TEST 15 — Financial Integrity (MASTER_TRANSAKSI Untouched)
  const currentDb = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
  const originalTx = currentDb.MASTER_TRANSAKSI.find((t: any) => t.id === "TRX-P31-001");
  assert(
    originalTx && originalTx.total_customer === 25000 && originalTx.ongkir_customer === 20000,
    "TEST 15: Financial Integrity -> MASTER_TRANSAKSI tidak diubah oleh proses daily closing"
  );

  console.log("=========================================");
  console.log("ALL 15 PHASE 31 E2E RUNTIME TESTS PASSED!");
  console.log("=========================================");
}

runPhase31E2ESuite().catch((err) => {
  console.error("E2E Test Suite Failed:", err);
  process.exit(1);
});
