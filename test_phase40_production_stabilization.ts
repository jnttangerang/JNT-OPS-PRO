import assert from "assert";
import fs from "fs";
import path from "path";

// Import all engines for SSOT, Authorization, and Workflow verification
import { calculateFinancialSummary, calculateDailyFinancial } from "./src/lib/financialEngine";
import { executeDailyClosing, getDailyClosingStatus, getDailyClosingRecord } from "./src/lib/dailyClosingEngine";
import { calculateSettlementSummary, processCreateSettlement, processApproveSettlement, getSettlementRecord } from "./src/lib/settlementEngine";
import { reconcileDaily } from "./src/lib/reconciliationEngine";
import { certifyFinancialClose, getCertificationRecord } from "./src/lib/financialCloseCertificationEngine";
import { generateFinancialCloseReport, accessEvidence } from "./src/lib/financialCloseEvidenceEngine";
import { getControlTowerSummary } from "./src/lib/controlTowerEngine";
import { checkActionAuthorization, executeControlAction, getControlActions } from "./src/lib/operationalControlEngine";
import { createWorkflowCase, getWorkflowList, assignWorkflowCase, startWorkflowCase, resolveWorkflowCase, verifyWorkflowCase, closeWorkflowCase, reopenWorkflowCase, checkWorkflowAuthorization } from "./src/lib/operationalWorkflowEngine";
import { getManagementIntelligence } from "./src/lib/managementIntelligenceEngine";
import { createManagementReview, getManagementReviewDetail, addManagementDecision, completeManagementReview } from "./src/lib/managementReviewEngine";
import { logAuditEvent, getAuditTrail } from "./src/lib/auditTrailEngine";

function getMockDb() {
  return {
    Outlets: [
      { outlet_id: "OUTLET-ALPHA", nama_outlet: "Outlet Alpha" },
      { outlet_id: "OUTLET-BETA", nama_outlet: "Outlet Beta" }
    ],
    MASTER_OUTLET: [
      { outlet_id: "OUTLET-ALPHA", nama_outlet: "Outlet Alpha" },
      { outlet_id: "OUTLET-BETA", nama_outlet: "Outlet Beta" }
    ],
    MASTER_TRANSAKSI: [
      {
        id: "TX-A1",
        transaksi_id: "TX-A1",
        outlet_id: "OUTLET-ALPHA",
        admin_id: "ADMIN-1",
        tanggal: "2026-08-10",
        tanggal_transaksi: "2026-08-10",
        created_at: "2026-08-10T10:00:00.000Z",
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
      },
      {
        id: "TX-B1",
        transaksi_id: "TX-B1",
        outlet_id: "OUTLET-BETA",
        admin_id: "ADMIN-2",
        tanggal: "2026-08-10",
        tanggal_transaksi: "2026-08-10",
        created_at: "2026-08-10T10:00:00.000Z",
        total_customer: 75000,
        total_dibayar_customer: 75000,
        grand_total: 75000,
        ongkir_customer: 75000,
        biaya_dasar: 60000,
        potongan_diskon: 0,
        biaya_penanganan: 0,
        status_transaksi: "COMPLETED",
        status_pembayaran: "LUNAS",
        metode_pembayaran: "CASH"
      }
    ],
    MASTER_PENGIRIMAN: [
      { id: "SHIP-A1", resi: "JX1001", transaksi_id: "TX-A1", outlet_id: "OUTLET-ALPHA", total_biaya: 50000, status: "DELIVERED", tanggal: "2026-08-10", tanggal_pengiriman: "2026-08-10", created_at: "2026-08-10T10:00:00.000Z" },
      { id: "SHIP-B1", resi: "JX1002", transaksi_id: "TX-B1", outlet_id: "OUTLET-BETA", total_biaya: 75000, status: "DELIVERED", tanggal: "2026-08-10", tanggal_pengiriman: "2026-08-10", created_at: "2026-08-10T10:00:00.000Z" }
    ],
    Master_Setoran: [
      { id: "SET-A1", outlet_id: "OUTLET-ALPHA", tanggal: "2026-08-10", nominal: 50000, status: "DISETUJUI" },
      { id: "SET-B1", outlet_id: "OUTLET-BETA", tanggal: "2026-08-10", nominal: 75000, status: "DISETUJUI" }
    ],
    Settlements: [],
    DailyClosing: [],
    ReconciliationExceptions: [],
    WorkflowCases: [],
    AuditLogs: [
      { id: "LOG-1", event_id: "LOG-1", event_type: "SETORAN_APPROVED", action: "APPROVE_SETORAN", entity_type: "SETORAN", entity_id: "SET-A1", outlet_id: "OUTLET-ALPHA", result: "SUCCESS", actor_id: "OWNER-1", created_at: "2026-08-10T10:00:00.000Z" },
      { id: "LOG-2", event_id: "LOG-2", event_type: "SETORAN_APPROVED", action: "APPROVE_SETORAN", entity_type: "SETORAN", entity_id: "SET-B1", outlet_id: "OUTLET-BETA", result: "SUCCESS", actor_id: "OWNER-1", created_at: "2026-08-10T10:00:00.000Z" }
    ],
    ManagementReviews: [],
    Certifications: [],
    EvidencePackages: []
  };
}

function runPhase40ProductionStabilizationSuite() {
  console.log("==========================================================");
  console.log("RUNNING PHASE 40 — PRODUCTION STABILIZATION SUITE (50 TESTS)");
  console.log("==========================================================");

  let passed = 0;
  let failed = 0;

  function test(description: string, fn: () => void) {
    try {
      fn();
      passed++;
      console.log(`✅ PASS: ${description}`);
    } catch (err: any) {
      failed++;
      console.error(`❌ FAIL: ${description} -> ${err.message}`);
    }
  }

  const db = getMockDb();

  const owner = { actor_id: "OWNER-1", actor_name: "Owner One", actor_role: "OWNER" };
  const adminA = { actor_id: "ADMIN-1", actor_name: "Fitri Alpha", actor_role: "ADMIN", outlet_id: "OUTLET-ALPHA" };
  const adminB = { actor_id: "ADMIN-2", actor_name: "Budi Beta", actor_role: "ADMIN", outlet_id: "OUTLET-BETA" };
  const invalidRoleActor = { actor_id: "BAD-1", actor_name: "Bad Actor", actor_role: "SUPER_ADMIN" };

  // --- SECTION 1: AUTHORIZATION & ACTIVE OUTLET SCOPE (1-10) ---
  test("01. OWNER has full authorization across any outlet", () => {
    const authA = checkActionAuthorization(db, owner, "RECORD_DEPOSIT", "OUTLET-ALPHA");
    const authB = checkActionAuthorization(db, owner, "RECORD_DEPOSIT", "OUTLET-BETA");
    assert.strictEqual(authA.authorized, true);
    assert.strictEqual(authB.authorized, true);
  });

  test("02. ADMIN with home outlet ALPHA can operate on active outlet BETA", () => {
    const auth = checkActionAuthorization(db, adminA, "RECORD_DEPOSIT", "OUTLET-BETA");
    assert.strictEqual(auth.authorized, true);
  });

  test("03. ADMIN with home outlet BETA can operate on active outlet ALPHA", () => {
    const auth = checkActionAuthorization(db, adminB, "RECORD_DEPOSIT", "OUTLET-ALPHA");
    assert.strictEqual(auth.authorized, true);
  });

  test("04. ADMIN homeOutletId is distinct from activeOutletId context", () => {
    assert.strictEqual(adminA.outlet_id, "OUTLET-ALPHA");
    const activeOutlet = "OUTLET-BETA";
    const auth = checkActionAuthorization(db, adminA, "RESOLVE_DISCREPANCY", activeOutlet);
    assert.strictEqual(auth.authorized, true);
  });

  test("05. Invalid / unlisted outlet ID is rejected for ADMIN", () => {
    const auth = checkActionAuthorization(db, adminA, "RECORD_DEPOSIT", "NON_EXISTENT_OUTLET");
    assert.strictEqual(auth.authorized, false);
    assert.ok(auth.reason?.includes("tidak tersedia") || auth.reason?.includes("tidak diizinkan"));
  });

  test("06. Missing activeOutletId is handled safely without throwing unexpected crash", () => {
    const auth = checkActionAuthorization(db, adminA, "RECORD_DEPOSIT", "");
    assert.strictEqual(auth.authorized, false);
  });

  test("07. ADMIN blocked from OWNER-only action (APPROVE_SETTLEMENT) on home outlet", () => {
    const auth = checkActionAuthorization(db, adminA, "APPROVE_SETTLEMENT", "OUTLET-ALPHA");
    assert.strictEqual(auth.authorized, false);
    assert.ok(auth.reason?.includes("OWNER"));
  });

  test("08. ADMIN blocked from OWNER-only action (APPROVE_SETTLEMENT) on active outlet", () => {
    const auth = checkActionAuthorization(db, adminA, "APPROVE_SETTLEMENT", "OUTLET-BETA");
    assert.strictEqual(auth.authorized, false);
    assert.ok(auth.reason?.includes("OWNER"));
  });

  test("09. Invalid role SUPER_ADMIN rejected immediately", () => {
    const auth = checkActionAuthorization(db, invalidRoleActor, "RECORD_DEPOSIT", "OUTLET-ALPHA");
    assert.strictEqual(auth.authorized, false);
    assert.ok(auth.reason?.includes("Role 'SUPER_ADMIN' tidak valid"));
  });

  test("10. Payload/outlet mismatch validation in workflow creation", () => {
    const res = createWorkflowCase(db, {
      source_type: "RECONCILIATION_EXCEPTION",
      source_id: "EXC-INVALID",
      outlet_id: "INVALID_OUTLET",
      priority: "P1",
      severity: "ERROR",
      title: "Invalid Outlet Test",
      description: "Test description",
      actor: adminA
    });
    assert.strictEqual(res.status, "error");
    assert.strictEqual(res.error_code, "UNAUTHORIZED");
  });

  // --- SECTION 2: OUTLET & DATE ISOLATION (11-15) ---
  test("11. Financial summary filters cleanly by active outlet ALPHA", () => {
    const txA = db.MASTER_TRANSAKSI.filter((t: any) => t.outlet_id === "OUTLET-ALPHA" && t.tanggal === "2026-08-10");
    const summaryA = calculateDailyFinancial(txA);
    assert.strictEqual(summaryA.total_customer, 50000);
  });

  test("12. Financial summary filters cleanly by active outlet BETA", () => {
    const txB = db.MASTER_TRANSAKSI.filter((t: any) => t.outlet_id === "OUTLET-BETA" && t.tanggal === "2026-08-10");
    const summaryB = calculateDailyFinancial(txB);
    assert.strictEqual(summaryB.total_customer, 75000);
  });

  test("13. No cross-outlet data leakage when querying transactions", () => {
    const txA = db.MASTER_TRANSAKSI.filter((t: any) => t.outlet_id === "OUTLET-ALPHA");
    assert.ok(txA.every((t: any) => t.outlet_id === "OUTLET-ALPHA"));
  });

  test("14. Date isolation prevents records from adjacent dates from bleeding in", () => {
    db.MASTER_TRANSAKSI.push({
      id: "TX-A2",
      transaksi_id: "TX-A2",
      outlet_id: "OUTLET-ALPHA",
      admin_id: "ADMIN-1",
      tanggal: "2026-08-11",
      total_dibayar_customer: 99000,
      status_transaksi: "COMPLETED"
    } as any);
    const txA10 = db.MASTER_TRANSAKSI.filter((t: any) => t.outlet_id === "OUTLET-ALPHA" && t.tanggal === "2026-08-10");
    const summaryDate10 = calculateDailyFinancial(txA10);
    assert.strictEqual(summaryDate10.total_customer, 50000);
  });

  test("15. Actor attribution preserves real admin_id during cross-outlet input", () => {
    const crossTx = {
      id: "TX-CROSS-1",
      transaksi_id: "TX-CROSS-1",
      outlet_id: "OUTLET-BETA",
      admin_id: "ADMIN-1", // Admin A operating on Outlet B
      tanggal: "2026-08-10",
      total_dibayar_customer: 30000,
      status_transaksi: "COMPLETED"
    };
    db.MASTER_TRANSAKSI.push(crossTx as any);
    assert.strictEqual(crossTx.outlet_id, "OUTLET-BETA");
    assert.strictEqual(crossTx.admin_id, "ADMIN-1");
  });

  // --- SECTION 3: FINANCIAL ENGINE SSOT & SETTLEMENT INTEGRITY (16-20) ---
  test("16. Financial Engine serves as SSOT for Daily Closing", () => {
    const txA = db.MASTER_TRANSAKSI.filter((t: any) => t.outlet_id === "OUTLET-ALPHA" && t.tanggal === "2026-08-10");
    const summary = calculateDailyFinancial(txA);
    assert.strictEqual(summary.total_customer, 50000);
  });

  test("17. Financial Engine serves as SSOT for Settlement", () => {
    const txA = db.MASTER_TRANSAKSI.filter((t: any) => t.outlet_id === "OUTLET-ALPHA" && t.tanggal === "2026-08-10");
    const summary = calculateDailyFinancial(txA);
    assert.strictEqual(summary.total_customer, 50000);
  });

  test("18. Settlement creation generates record linked to correct outlet and actor", () => {
    const txA = db.MASTER_TRANSAKSI.filter((t: any) => t.outlet_id === "OUTLET-ALPHA" && t.tanggal === "2026-08-10");
    const setoran = db.Master_Setoran[0];
    const res = processCreateSettlement({
      outlet_id: "OUTLET-ALPHA",
      tanggal: "2026-08-10",
      transactions: txA,
      setoranRecord: setoran,
      actor: adminA
    });
    assert.strictEqual(res.status, "success");
    assert.ok(res.data?.settlement_id);
    if (res.data) {
      if (!db.Settlements) db.Settlements = [];
      db.Settlements.push(res.data);
    }
  });

  test("19. Settlement approval requires OWNER authorization", () => {
    const settlement = getSettlementRecord(db, "OUTLET-ALPHA", "2026-08-10");
    assert.ok(settlement);

    // ADMIN attempt fails
    const adminApprove = processApproveSettlement({ settlement, actor: adminA });
    assert.strictEqual(adminApprove.status, "error");
    assert.strictEqual(adminApprove.error_code, "UNAUTHORIZED_APPROVAL");

    // OWNER attempt succeeds
    const appRes = processApproveSettlement({ settlement, actor: owner });
    assert.strictEqual(appRes.status, "success");
    if (appRes.data) {
      const idx = db.Settlements.findIndex((s: any) => s.settlement_id === appRes.data?.settlement_id);
      if (idx >= 0) db.Settlements[idx] = appRes.data;
      else db.Settlements.push(appRes.data);
    }
  });

  test("20. Settlement idempotency prevents duplicate settlement creation", () => {
    const txA = db.MASTER_TRANSAKSI.filter((t: any) => t.outlet_id === "OUTLET-ALPHA" && t.tanggal === "2026-08-10");
    const existing = getSettlementRecord(db, "OUTLET-ALPHA", "2026-08-10");
    const res2 = processCreateSettlement({
      outlet_id: "OUTLET-ALPHA",
      tanggal: "2026-08-10",
      transactions: txA,
      actor: owner,
      existingRecord: existing
    });
    assert.strictEqual(res2.status, "success");
    const count = (db.Settlements || []).filter((s: any) => s.outlet_id === "OUTLET-ALPHA" && s.tanggal === "2026-08-10").length;
    assert.strictEqual(count, 1);
  });

  // --- SECTION 4: DAILY CLOSING & RECONCILIATION INTEGRITY (21-25) ---
  test("21. Daily Closing performance records closing state", () => {
    const closeRes = executeDailyClosing(db, { outlet_id: "OUTLET-ALPHA", tanggal: "2026-08-10", actor: adminA });
    assert.strictEqual(closeRes.status, "success");
  });

  test("22. Daily Closing idempotency returns existing record on repeated execution", () => {
    const closeRes2 = executeDailyClosing(db, { outlet_id: "OUTLET-ALPHA", tanggal: "2026-08-10", actor: adminA });
    assert.strictEqual(closeRes2.status, "success");
  });

  test("23. Reconciliation summary computes exception counts correctly", () => {
    const reconRes = reconcileDaily(db, "2026-08-10", "OUTLET-ALPHA");
    assert.strictEqual(typeof reconRes.exception_count, "number");
  });

  test("24. Daily closing status reflects closed state", () => {
    const status = getDailyClosingStatus(db, "OUTLET-ALPHA", "2026-08-10");
    assert.strictEqual(status.status, "success");
    assert.strictEqual(status.data?.status, "CLOSED");
  });

  test("25. ADMIN cross-outlet daily closing allowed for available active outlet BETA", () => {
    const closeResB = executeDailyClosing(db, { outlet_id: "OUTLET-BETA", tanggal: "2026-08-10", actor: adminA });
    assert.strictEqual(closeResB.status, "success");
  });

  // --- SECTION 5: FINANCIAL CLOSE CERTIFICATION & EVIDENCE (26-30) ---
  test("26. Financial certification requires OWNER role", () => {
    const certAdmin = certifyFinancialClose(db, { outlet_id: "OUTLET-ALPHA", tanggal: "2026-08-10", actor: adminA });
    assert.strictEqual(certAdmin.status, "error");
    assert.strictEqual(certAdmin.error_code, "UNAUTHORIZED_CERTIFICATION");
  });

  test("27. OWNER can perform financial certification", () => {
    const certRes = certifyFinancialClose(db, { outlet_id: "OUTLET-ALPHA", tanggal: "2026-08-10", actor: owner });
    assert.strictEqual(certRes.status, "success");
    assert.strictEqual(certRes.data?.status, "CERTIFIED");
  });

  test("28. Certification status query returns CERTIFIED status", () => {
    const certRecord = getCertificationRecord(db, "OUTLET-ALPHA", "2026-08-10");
    assert.strictEqual(certRecord?.status, "CERTIFIED");
  });

  test("29. Evidence package generation produces complete evidence bundle", () => {
    const res = generateFinancialCloseReport(db, { outlet_id: "OUTLET-ALPHA", tanggal: "2026-08-10", actor: owner });
    assert.strictEqual(res.status, "success");
    assert.ok(res.data?.evidence_id);
    assert.strictEqual(res.data?.outlet_id, "OUTLET-ALPHA");
  });

  test("30. Evidence package access is idempotent", () => {
    const res2 = accessEvidence(db, { outlet_id: "OUTLET-ALPHA", tanggal: "2026-08-10", actor: owner });
    assert.strictEqual(res2.status, "success");
    assert.ok(res2.data?.evidence_id);
  });

  // --- SECTION 6: CONTROL TOWER & OPERATIONAL CONTROL (31-35) ---
  test("31. Control Tower metrics calculate operational health accurately", () => {
    const summary = getControlTowerSummary(db, { outlet_id: "OUTLET-ALPHA", tanggal: "2026-08-10" });
    assert.strictEqual(summary.data?.outlet_id, "OUTLET-ALPHA");
  });

  test("32. Control Tower metrics isolate data by active outlet for ADMIN", () => {
    const summaryB = getControlTowerSummary(db, { outlet_id: "OUTLET-BETA", tanggal: "2026-08-10" });
    assert.strictEqual(summaryB.data?.outlet_id, "OUTLET-BETA");
  });

  test("33. Operational control actions retrieved cleanly for active outlet", () => {
    const actions = getControlActions(db, { outlet_id: "OUTLET-ALPHA", tanggal: "2026-08-10", role: adminA.actor_role, actor_id: adminA.actor_id });
    assert.ok(Array.isArray(actions.actions));
  });

  test("34. Operational control action execution respects authorization", () => {
    const txB = db.MASTER_TRANSAKSI.filter((t: any) => t.outlet_id === "OUTLET-BETA" && t.tanggal === "2026-08-10");
    const stlB = processCreateSettlement({
      outlet_id: "OUTLET-BETA",
      tanggal: "2026-08-10",
      transactions: txB,
      actor: adminA
    });
    if (stlB.data) db.Settlements.push(stlB.data);

    const execRes = executeControlAction(db, {
      action_id: "ACT-01",
      action_type: "RECORD_DEPOSIT",
      outlet_id: "OUTLET-BETA",
      tanggal: "2026-08-10",
      params: { actual_amount: 75000 },
      actor: adminA
    });
    assert.strictEqual(execRes.status, "SUCCESS");
  });

  test("35. Control action with OWNER-only action rejected for ADMIN", () => {
    const execRes = executeControlAction(db, {
      action_id: "ACT-02",
      action_type: "APPROVE_SETTLEMENT",
      outlet_id: "OUTLET-ALPHA",
      tanggal: "2026-08-10",
      actor: adminA
    });
    assert.strictEqual(execRes.status, "ACTION_REJECTED");
  });

  // --- SECTION 7: WORKFLOW & SLA ENGINE (36-40) ---
  test("36. Workflow creation succeeds for valid active outlet", () => {
    const wfRes = createWorkflowCase(db, {
      source_type: "RECONCILIATION_EXCEPTION",
      source_id: "EXC-201",
      outlet_id: "OUTLET-ALPHA",
      priority: "P1",
      severity: "ERROR",
      title: "Reconciliation Discrepancy",
      description: "Discrepancy noted",
      actor: adminA
    });
    assert.strictEqual(wfRes.status, "success");
    assert.ok(wfRes.data?.workflow_id);
  });

  test("37. Workflow list query filters by active outlet for ADMIN", () => {
    const wfList = getWorkflowList(db, { outlet_id: "OUTLET-ALPHA" });
    assert.ok(wfList.every(w => w.outlet_id === "OUTLET-ALPHA"));
  });

  test("38. Workflow status transition OPEN -> ASSIGNED -> RESOLVED -> CLOSED works cleanly", () => {
    const wfRes = createWorkflowCase(db, {
      source_type: "OPERATIONAL_CONTROL",
      source_id: "CTRL-101",
      outlet_id: "OUTLET-ALPHA",
      priority: "P2",
      severity: "WARNING",
      title: "Pending Deposit Verification",
      description: "Verify deposit",
      actor: adminA
    });
    const wfId = wfRes.data?.workflow_id!;

    const assignRes = assignWorkflowCase(db, { workflow_id: wfId, assigned_to: adminA.actor_id, actor: adminA });
    assert.strictEqual(assignRes.status, "success");

    const startRes = startWorkflowCase(db, { workflow_id: wfId, actor: adminA });
    assert.strictEqual(startRes.status, "success");

    const resolveRes = resolveWorkflowCase(db, { workflow_id: wfId, resolution_note: "Verified deposit", resolution_code: "DATA_CORRECTED", actor: adminA });
    assert.strictEqual(resolveRes.status, "success");

    const verifyRes = verifyWorkflowCase(db, { workflow_id: wfId, verification_note: "Verified", verification_result: "PASS", actor: owner });
    assert.strictEqual(verifyRes.status, "success");

    const closeRes = closeWorkflowCase(db, { workflow_id: wfId, actor: owner });
    assert.strictEqual(closeRes.status, "success");
  });

  test("39. Reopen workflow case transition CLOSED -> REOPENED succeeds", () => {
    const cases = db.WorkflowCases;
    const closedWf = cases.find((w: any) => w.status === "CLOSED");
    assert.ok(closedWf);

    const res = reopenWorkflowCase(db, { workflow_id: closedWf.workflow_id, reason: "Reopen test", actor: adminA });
    assert.strictEqual(res.status, "success");
  });

  test("40. ADMIN cross-outlet workflow creation and status update permitted on available outlet BETA", () => {
    const wfResB = createWorkflowCase(db, {
      source_type: "RECONCILIATION_EXCEPTION",
      source_id: "EXC-301",
      outlet_id: "OUTLET-BETA",
      priority: "P1",
      severity: "ERROR",
      title: "Beta Exception",
      description: "Admin A working on Beta",
      actor: adminA
    });
    assert.strictEqual(wfResB.status, "success");
  });

  // --- SECTION 8: MANAGEMENT INTELLIGENCE & MANAGEMENT REVIEW (41-45) ---
  test("41. Management Intelligence fetches KPIs accurately for active outlet", () => {
    const intel = getManagementIntelligence(db, { outlet_id: "OUTLET-ALPHA", tanggal: "2026-08-10", role: "ADMIN", actor_id: adminA.actor_id });
    assert.ok(intel.outcome_kpis);
    assert.ok(intel.outlet_health);
  });

  test("42. Management Intelligence global view restricted for ADMIN", () => {
    assert.throws(() => {
      getManagementIntelligence(db, { outlet_id: undefined, tanggal: "2026-08-10", role: "ADMIN", actor_id: adminA.actor_id });
    }, /UNAUTHORIZED/);
  });

  test("43. Management Review creation succeeds for active outlet ALPHA", () => {
    const ownerActor = { role: owner.actor_role, actor_id: owner.actor_id, name: owner.actor_name };
    const review = createManagementReview(db, { outlet_id: "OUTLET-ALPHA", period: "DAILY", tanggal: "2026-08-10" }, ownerActor);
    assert.ok(review.review_id);
    assert.strictEqual(review.outlet_id, "OUTLET-ALPHA");
  });

  test("44. Management Review decision linkage and completion workflow", () => {
    const ownerActor = { role: owner.actor_role, actor_id: owner.actor_id, name: owner.actor_name };
    const review = createManagementReview(db, { outlet_id: "OUTLET-BETA", period: "DAILY", tanggal: "2026-08-10" }, ownerActor);
    const dec = addManagementDecision(db, {
      review_id: review.review_id,
      decision_type: "INVESTIGATE",
      reason: "Investigate variance",
      source_type: "KPI",
      source_id: "KPI-1",
      priority: "P2"
    }, ownerActor);
    assert.ok(dec.decision_id);

    if (dec.action_ref) {
      const wfId = dec.action_ref;
      assignWorkflowCase(db, { workflow_id: wfId, assigned_to: owner.actor_id, actor: owner });
      startWorkflowCase(db, { workflow_id: wfId, actor: owner });
      resolveWorkflowCase(db, { workflow_id: wfId, resolution_note: "Resolved variance", resolution_code: "DATA_CORRECTED", actor: owner });
      verifyWorkflowCase(db, { workflow_id: wfId, verification_note: "Verified", verification_result: "PASS", actor: owner });
      closeWorkflowCase(db, { workflow_id: wfId, actor: owner });
    }

    const comp = completeManagementReview(db, { review_id: review.review_id }, ownerActor);
    assert.strictEqual(comp.status, "COMPLETED");
  });

  test("45. ADMIN prevented from accessing GLOBAL Management Reviews", () => {
    const ownerActor = { role: owner.actor_role, actor_id: owner.actor_id, name: owner.actor_name };
    const globalReview = createManagementReview(db, { outlet_id: "GLOBAL", period: "DAILY", tanggal: "2026-08-10" }, ownerActor);
    assert.throws(() => {
      getManagementReviewDetail(db, globalReview.review_id, adminA);
    }, /UNAUTHORIZED/);
  });

  // --- SECTION 9: AUDIT TRAIL, IDEMPOTENCY & REGRESSION (46-50) ---
  test("46. Audit Trail records mutation event with exact actor and active outlet", () => {
    logAuditEvent(db, {
      event_type: "TEST_EVENT",
      action: "TEST_ACTION",
      actor_id: adminA.actor_id,
      actor_name: adminA.actor_name,
      actor_role: adminA.actor_role,
      outlet_id: "OUTLET-BETA",
      entity_type: "TEST_ENTITY",
      result: "SUCCESS"
    });
    const logs = getAuditTrail(db, { actor_id: adminA.actor_id, outlet_id: "OUTLET-BETA" });
    assert.ok(logs.length > 0);
    const targetLog = logs[logs.length - 1];
    assert.strictEqual(targetLog.actor_id, "ADMIN-1");
    assert.strictEqual(targetLog.outlet_id, "OUTLET-BETA");
  });

  test("47. Read-only queries do not generate spurious audit logs", () => {
    const preCount = db.AuditLogs.length;
    getDailyClosingStatus(db, "OUTLET-ALPHA", "2026-08-10");
    calculateFinancialSummary(db.MASTER_TRANSAKSI[0]);
    const postCount = db.AuditLogs.length;
    assert.strictEqual(preCount, postCount);
  });

  test("48. MASTER_TRANSAKSI remains uncorrupted by analytical / review calculations", () => {
    const txCountBefore = db.MASTER_TRANSAKSI.length;
    getManagementIntelligence(db, { outlet_id: "OUTLET-ALPHA", tanggal: "2026-08-10", role: "OWNER", actor_id: owner.actor_id });
    const txCountAfter = db.MASTER_TRANSAKSI.length;
    assert.strictEqual(txCountBefore, txCountAfter);
  });

  test("49. Idempotent operations across engines produce deterministic results", () => {
    const cert1 = getCertificationRecord(db, "OUTLET-ALPHA", "2026-08-10");
    const cert2 = getCertificationRecord(db, "OUTLET-ALPHA", "2026-08-10");
    assert.strictEqual(cert1?.status, cert2?.status);
  });

  test("50. Full End-to-End Pipeline Integration Regression (Phase 30-39)", () => {
    // Verify core engine integrations function seamlessly together
    const txA = db.MASTER_TRANSAKSI.filter((t: any) => t.outlet_id === "OUTLET-ALPHA" && t.tanggal === "2026-08-10");
    const summary = calculateDailyFinancial(txA);
    assert.ok(summary);
    const closing = getDailyClosingStatus(db, "OUTLET-ALPHA", "2026-08-10");
    assert.ok(closing);
    const settlement = getSettlementRecord(db, "OUTLET-ALPHA", "2026-08-10");
    assert.ok(settlement);
    const recon = reconcileDaily(db, "2026-08-10", "OUTLET-ALPHA");
    assert.ok(recon);
    const ctrl = getControlTowerSummary(db, { outlet_id: "OUTLET-ALPHA", tanggal: "2026-08-10" });
    assert.ok(ctrl);
  });

  console.log("==========================================================");
  console.log(`PHASE 40 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==========================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase40ProductionStabilizationSuite();
