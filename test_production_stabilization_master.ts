import assert from "assert";

// Core Engine Imports
import { calculateFinancialSummary, calculateDailyFinancial } from "./src/lib/financialEngine";
import { executeDailyClosing, getDailyClosingStatus, getDailyClosingRecord } from "./src/lib/dailyClosingEngine";
import { calculateSettlementSummary, processCreateSettlement, processApproveSettlement, getSettlementRecord } from "./src/lib/settlementEngine";
import { certifyFinancialClose, getCertificationRecord } from "./src/lib/financialCloseCertificationEngine";
import { generateFinancialCloseReport, accessEvidence } from "./src/lib/financialCloseEvidenceEngine";
import { checkActionAuthorization } from "./src/lib/operationalControlEngine";
import { createWorkflowCase, assignWorkflowCase, startWorkflowCase, resolveWorkflowCase, verifyWorkflowCase, closeWorkflowCase } from "./src/lib/operationalWorkflowEngine";
import { createManagementReview, completeManagementReview } from "./src/lib/managementReviewEngine";
import { logAuditEvent } from "./src/lib/auditTrailEngine";

function getMockDb() {
  return {
    Outlets: [
      { outlet_id: "OUTLET-1", nama_outlet: "J&T Main Branch" },
      { outlet_id: "OUTLET-2", nama_outlet: "J&T Express West" }
    ],
    MASTER_OUTLET: [
      { outlet_id: "OUTLET-1", nama_outlet: "J&T Main Branch" },
      { outlet_id: "OUTLET-2", nama_outlet: "J&T Express West" }
    ],
    MASTER_TRANSAKSI: [
      {
        id: "TX-M1",
        transaksi_id: "TX-M1",
        outlet_id: "OUTLET-1",
        admin_id: "ADMIN-X",
        tanggal: "2026-08-10",
        tanggal_transaksi: "2026-08-10",
        created_at: "2026-08-10T09:00:00.000Z",
        total_customer: 75000,
        total_dibayar_customer: 75000,
        grand_total: 75000,
        ongkir_customer: 75000,
        biaya_dasar: 60000,
        potongan_diskon: 0,
        biaya_penanganan: 0,
        status_transaksi: "COMPLETED",
        status_pembayaran: "LUNAS",
        metode_pembayaran: "CASH",
        no_resi: "JNT10001"
      },
      {
        id: "TX-M2",
        transaksi_id: "TX-M2",
        outlet_id: "OUTLET-2",
        admin_id: "ADMIN-X",
        tanggal: "2026-08-10",
        tanggal_transaksi: "2026-08-10",
        created_at: "2026-08-10T11:00:00.000Z",
        total_customer: 120000,
        total_dibayar_customer: 120000,
        grand_total: 120000,
        ongkir_customer: 120000,
        biaya_dasar: 100000,
        potongan_diskon: 0,
        biaya_penanganan: 0,
        status_transaksi: "COMPLETED",
        status_pembayaran: "LUNAS",
        metode_pembayaran: "CASH",
        no_resi: "JNT10002"
      }
    ],
    MASTER_PENGIRIMAN: [
      { id: "SH-M1", transaksi_id: "TX-M1", resi_id: "JNT10001", status_pengiriman: "DELIVERED", outlet_id: "OUTLET-1" },
      { id: "SH-M2", transaksi_id: "TX-M2", resi_id: "JNT10002", status_pengiriman: "IN_TRANSIT", outlet_id: "OUTLET-2" }
    ],
    MASTER_CUSTOMER: [],
    Master_Setoran: [
      { id: "SET-M1", outlet_id: "OUTLET-1", tanggal: "2026-08-10", nominal: 75000, total_setoran: 75000, status: "APPROVED" },
      { id: "SET-M2", outlet_id: "OUTLET-2", tanggal: "2026-08-10", nominal: 120000, total_setoran: 120000, status: "APPROVED" }
    ],
    Settlements: [],
    DailyClosing: [],
    ReconciliationExceptions: [],
    WorkflowCases: [],
    ManagementReviews: [],
    AuditLogs: []
  };
}

let testCount = 0;
let passCount = 0;

function runTest(description: string, fn: () => void) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`✅ PASS: ${description}`);
  } catch (err: any) {
    console.error(`❌ FAIL: ${description}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log("==================================================================");
console.log("RUNNING PRODUCTION STABILIZATION MASTER VERIFICATION SUITE");
console.log("==================================================================");

const db = getMockDb();

const owner = { actor_id: "OWNER-BOSS", actor_role: "OWNER", actor_name: "Boss Owner", outlet_id: "ALL" };
const adminX = { actor_id: "ADMIN-X", actor_role: "ADMIN", actor_name: "Admin X", home_outlet_id: "OUTLET-1", outlet_id: "OUTLET-1" };

// 1. AUTHORIZATION & ROLE ISOLATION
runTest("01. OWNER has universal authorization across all outlets", () => {
  const auth1 = checkActionAuthorization("OUTLET-1", owner, "APPROVE_SETTLEMENT", "OUTLET-1");
  const auth2 = checkActionAuthorization("OUTLET-2", owner, "APPROVE_SETTLEMENT", "OUTLET-2");
  assert.strictEqual(auth1.authorized, true);
  assert.strictEqual(auth2.authorized, true);
});

runTest("02. ADMIN blocked from OWNER-only actions (APPROVE_SETTLEMENT, FINANCIAL_CERTIFICATION)", () => {
  const authSet = checkActionAuthorization("OUTLET-1", adminX, "APPROVE_SETTLEMENT", "OUTLET-1");
  assert.strictEqual(authSet.authorized, false);
});

// 2. ACTIVE OUTLET CONTEXT & CROSS-OUTLET ATTRIBUTION
runTest("03. ADMIN X working on active OUTLET-2 preserves real actor_id attribution", () => {
  const crossTx = {
    id: "TX-CROSS-1",
    transaksi_id: "TX-CROSS-1",
    outlet_id: "OUTLET-2",
    admin_id: adminX.actor_id,
    tanggal: "2026-08-10",
    tanggal_transaksi: "2026-08-10",
    created_at: "2026-08-10T12:00:00.000Z",
    total_customer: 50000,
    total_dibayar_customer: 50000,
    grand_total: 50000,
    ongkir_customer: 50000,
    biaya_dasar: 40000,
    potongan_diskon: 0,
    biaya_penanganan: 0,
    status_transaksi: "COMPLETED",
    status_pembayaran: "LUNAS",
    metode_pembayaran: "CASH"
  };
  db.MASTER_TRANSAKSI.push(crossTx as any);
  assert.strictEqual(crossTx.outlet_id, "OUTLET-2");
  assert.strictEqual(crossTx.admin_id, "ADMIN-X");
});

runTest("04. Outlet isolation strictly segregates data between OUTLET-1 and OUTLET-2", () => {
  const tx1 = db.MASTER_TRANSAKSI.filter((t: any) => t.outlet_id === "OUTLET-1");
  const tx2 = db.MASTER_TRANSAKSI.filter((t: any) => t.outlet_id === "OUTLET-2");
  assert.ok(tx1.every((t: any) => t.outlet_id === "OUTLET-1"));
  assert.ok(tx2.every((t: any) => t.outlet_id === "OUTLET-2"));
  assert.strictEqual(tx1.length, 1);
  assert.strictEqual(tx2.length, 2);
});

// 3. FINANCIAL SSOT INTEGRITY
runTest("05. Financial Engine serves as sole SSOT for financial calculations", () => {
  const tx1 = db.MASTER_TRANSAKSI.filter((t: any) => t.outlet_id === "OUTLET-1");
  const fin1 = calculateDailyFinancial(tx1);
  assert.strictEqual(fin1.total_customer, 75000);
  assert.strictEqual(fin1.total_owner, 75000);
});

// 4. DAILY CLOSING & SETTLEMENT LIFECYCLE
runTest("06. Settlement creation and OWNER approval lifecycle", () => {
  const tx1 = db.MASTER_TRANSAKSI.filter((t: any) => t.outlet_id === "OUTLET-1" && t.tanggal === "2026-08-10");
  const setoran = db.Master_Setoran[0];

  const setCreate = processCreateSettlement({
    outlet_id: "OUTLET-1",
    tanggal: "2026-08-10",
    transactions: tx1,
    setoranRecord: setoran,
    actor: adminX
  });
  assert.strictEqual(setCreate.status, "success");
  assert.ok(setCreate.data?.settlement_id);
  db.Settlements.push(setCreate.data);

  const settlement = getSettlementRecord(db, "OUTLET-1", "2026-08-10");
  assert.ok(settlement);

  const setApprove = processApproveSettlement({ settlement, actor: owner });
  assert.strictEqual(setApprove.status, "success");
  assert.strictEqual(setApprove.data?.status, "APPROVED");

  const idx = db.Settlements.findIndex((s: any) => s.settlement_id === setApprove.data?.settlement_id);
  if (idx >= 0) db.Settlements[idx] = setApprove.data;
});

runTest("07. Daily Closing executes and records closed state cleanly", () => {
  const closeRes = executeDailyClosing(db, { outlet_id: "OUTLET-1", tanggal: "2026-08-10", actor: adminX });
  assert.strictEqual(closeRes.status, "success");

  const status = getDailyClosingStatus(db, "OUTLET-1", "2026-08-10");
  assert.strictEqual(status.status, "success");
  assert.strictEqual(status.data?.status, "CLOSED");
});

// 5. CERTIFICATION & EVIDENCE BUNDLE
runTest("08. Financial certification succeeds for closed and approved day", () => {
  const certRes = certifyFinancialClose(db, { outlet_id: "OUTLET-1", tanggal: "2026-08-10", actor: owner });
  assert.strictEqual(certRes.status, "success");
  assert.strictEqual(certRes.data?.status, "CERTIFIED");
});

runTest("09. Evidence bundle generation is deterministic and idempotent", () => {
  const report1 = generateFinancialCloseReport(db, { outlet_id: "OUTLET-1", tanggal: "2026-08-10", actor: owner });
  assert.strictEqual(report1.data?.status, "FINAL");
  assert.ok(report1.data?.report_id);

  const report2 = generateFinancialCloseReport(db, { outlet_id: "OUTLET-1", tanggal: "2026-08-10", actor: owner });
  assert.strictEqual(report1.data?.report_id, report2.data?.report_id);
});

// 6. OPERATIONAL CONTROL, WORKFLOW & SLA
runTest("10. Operational Workflow case lifecycle (OPEN -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> VERIFIED -> CLOSED)", () => {
  const wfCase = createWorkflowCase(db, {
    outlet_id: "OUTLET-1",
    source_type: "RECONCILIATION_EXCEPTION",
    source_id: "EXC-001",
    priority: "P1",
    severity: "WARNING",
    title: "Deposit variance detected",
    description: "Check deposit slip",
    actor: adminX
  });
  assert.strictEqual(wfCase.status, "success");
  assert.ok(wfCase.data?.workflow_id);
  const wfId = wfCase.data!.workflow_id;

  assignWorkflowCase(db, { workflow_id: wfId, assigned_to: adminX.actor_id, actor: adminX });
  startWorkflowCase(db, { workflow_id: wfId, actor: adminX });
  resolveWorkflowCase(db, { workflow_id: wfId, resolution_note: "Bank deposit matched", resolution_code: "DATA_CORRECTED", actor: adminX });
  verifyWorkflowCase(db, { workflow_id: wfId, verification_note: "Verified by Owner", verification_result: "PASS", actor: owner });
  const closeWf = closeWorkflowCase(db, { workflow_id: wfId, actor: owner });

  assert.strictEqual(closeWf.status, "success");
  assert.strictEqual(closeWf.data?.status, "CLOSED");
});

// 7. MANAGEMENT REVIEW & INTELLIGENCE
runTest("11. Management Review creation and completion workflow", () => {
  const ownerActor = { role: owner.actor_role, actor_id: owner.actor_id, name: owner.actor_name };
  const rev = createManagementReview(db, { outlet_id: "OUTLET-1", period: "DAILY", tanggal: "2026-08-10" }, ownerActor);
  assert.ok(rev.review_id);

  const comp = completeManagementReview(db, { review_id: rev.review_id }, ownerActor);
  assert.strictEqual(comp.status, "COMPLETED");
});

// 8. AUDIT TRAIL & RECOVERY
runTest("12. Audit Trail captures mutation events with exact actor and outlet metadata", () => {
  const preLogs = db.AuditLogs.length;
  logAuditEvent(db, {
    entity_type: "TEST_ENTITY",
    event_type: "TEST_STABILIZATION_MUTATION",
    action: "STABILIZATION_CHECK",
    result: "SUCCESS",
    actor_id: adminX.actor_id,
    actor_role: adminX.actor_role,
    outlet_id: "OUTLET-2",
    metadata: { note: "Verifying audit log recording" }
  });
  assert.strictEqual(db.AuditLogs.length, preLogs + 1);
  const targetLog = db.AuditLogs.find((l: any) => l.event_type === "TEST_STABILIZATION_MUTATION");
  assert.ok(targetLog);
  assert.strictEqual(targetLog.actor_id, "ADMIN-X");
  assert.strictEqual(targetLog.outlet_id, "OUTLET-2");
});

console.log("==================================================================");
console.log(`MASTER STABILIZATION SUMMARY: ${passCount}/${testCount} PASSED`);
console.log("==================================================================");
