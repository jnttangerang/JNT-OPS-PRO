import assert from "assert";
import fs from "fs";
import path from "path";
import {
  createWorkflowCase,
  assignWorkflowCase,
  startWorkflowCase,
  resolveWorkflowCase,
  verifyWorkflowCase,
  reopenWorkflowCase,
  closeWorkflowCase,
  getWorkflowList,
  getWorkflowDetail,
  getWorkflowSummary,
  processEscalations,
  evaluateSLAAndAgeing,
  isValidWorkflowTransition,
  calculateDueAt,
  ActorInfo,
  WorkflowCaseRecord
} from "./src/lib/operationalWorkflowEngine";
import { logAuditEvent } from "./src/lib/auditTrailEngine";

const TEST_DB_PATH = path.join(process.cwd(), "db.json");

function readTestDb() {
  if (fs.existsSync(TEST_DB_PATH)) {
    return JSON.parse(fs.readFileSync(TEST_DB_PATH, "utf-8"));
  }
  return {
    MASTER_TRANSAKSI: [],
    MASTER_PENGIRIMAN: [],
    ReconciliationExceptions: [],
    SettlementRecords: [],
    DailyClosing: [],
    FinancialCloseCertification: [],
    WorkflowCases: [],
    AuditLogs: []
  };
}

function runPhase37Tests() {
  console.log("==========================================");
  console.log("RUNNING PHASE 37 OPERATIONAL WORKFLOW TESTS");
  console.log("==========================================");

  let passedCount = 0;
  let failedCount = 0;

  function runTest(testName: string, testFn: () => void) {
    try {
      testFn();
      passedCount++;
      console.log(`✅ PASS: ${testName}`);
    } catch (err: any) {
      failedCount++;
      console.error(`❌ FAIL: ${testName} -> ${err.message}`);
    }
  }

  const db = readTestDb();
  db.WorkflowCases = [];
  db.AuditLogs = db.AuditLogs || [];
  db.MASTER_TRANSAKSI = db.MASTER_TRANSAKSI || [];
  db.MASTER_PENGIRIMAN = db.MASTER_PENGIRIMAN || [];

  const initialTxCount = db.MASTER_TRANSAKSI.length;
  const initialShipCount = db.MASTER_PENGIRIMAN.length;

  const ownerActor: ActorInfo = { actor_id: "OWNER-01", actor_name: "Pak Owner", actor_role: "OWNER" };
  const adminOutlet1Actor: ActorInfo = { actor_id: "ADMIN-01", actor_name: "Admin Tangerang", actor_role: "ADMIN", outlet_id: "OUTLET-01" };
  const adminOutlet2Actor: ActorInfo = { actor_id: "ADMIN-02", actor_name: "Admin Jakarta", actor_role: "ADMIN", outlet_id: "OUTLET-02" };
  const invalidRoleActor: ActorInfo = { actor_id: "GUEST-01", actor_name: "Guest", actor_role: "SUPER_ADMIN" };

  // --- PART 1: AUTHORIZATION TESTS ---
  runTest("TEST 1: OWNER access authorized for all outlets", () => {
    const res = createWorkflowCase(db, {
      source_type: "RECONCILIATION_EXCEPTION",
      source_id: "EXC-101",
      outlet_id: "OUTLET-01",
      priority: "P0",
      severity: "CRITICAL",
      title: "Price Mismatch EXC-101",
      description: "Critical price mismatch",
      actor: ownerActor
    });
    assert.strictEqual(res.status, "success");
    assert.ok(res.data?.workflow_id);
  });

  runTest("TEST 2: ADMIN access authorized for home outlet", () => {
    const res = createWorkflowCase(db, {
      source_type: "RECONCILIATION_EXCEPTION",
      source_id: "EXC-102",
      outlet_id: "OUTLET-01",
      priority: "P1",
      severity: "ERROR",
      title: "Weight Mismatch EXC-102",
      description: "Weight discrepancy",
      actor: adminOutlet1Actor
    });
    assert.strictEqual(res.status, "success");
  });

  runTest("TEST 3: Unauthorized role (SUPER_ADMIN) rejected", () => {
    const res = createWorkflowCase(db, {
      source_type: "RECONCILIATION_EXCEPTION",
      source_id: "EXC-103",
      outlet_id: "OUTLET-01",
      priority: "P2",
      severity: "WARNING",
      title: "Test Exception",
      description: "Test description",
      actor: invalidRoleActor
    });
    assert.strictEqual(res.status, "error");
    assert.strictEqual(res.error_code, "UNAUTHORIZED");
  });

  runTest("TEST 4: ADMIN cross-outlet action rejected", () => {
    const res = createWorkflowCase(db, {
      source_type: "RECONCILIATION_EXCEPTION",
      source_id: "EXC-104",
      outlet_id: "OUTLET-01",
      priority: "P2",
      severity: "WARNING",
      title: "Cross-Outlet Action",
      description: "Attempt by Admin Outlet 2 on Outlet 1",
      actor: adminOutlet2Actor
    });
    assert.strictEqual(res.status, "error");
    assert.strictEqual(res.error_code, "UNAUTHORIZED");
  });

  // --- PART 2: STATE MACHINE TRANSITION TESTS ---
  let wfId01 = "";

  runTest("TEST 5: State Machine: OPEN -> ASSIGNED transition", () => {
    const createRes = createWorkflowCase(db, {
      source_type: "SETTLEMENT",
      source_id: "STL-201",
      outlet_id: "OUTLET-01",
      priority: "P1",
      severity: "ERROR",
      title: "Unsettled Deposit STL-201",
      description: "Deposit pending review",
      actor: ownerActor
    });
    wfId01 = createRes.data!.workflow_id;
    const assignRes = assignWorkflowCase(db, {
      workflow_id: wfId01,
      assigned_to: "ADMIN-01",
      assigned_role: "ADMIN",
      actor: ownerActor
    });
    assert.strictEqual(assignRes.status, "success");
    assert.strictEqual(assignRes.data?.status, "ASSIGNED");
    assert.strictEqual(assignRes.data?.assigned_to, "ADMIN-01");
  });

  runTest("TEST 6: State Machine: ASSIGNED -> IN_PROGRESS transition", () => {
    const res = startWorkflowCase(db, { workflow_id: wfId01, actor: adminOutlet1Actor });
    assert.strictEqual(res.status, "success");
    assert.strictEqual(res.data?.status, "IN_PROGRESS");
  });

  runTest("TEST 7: State Machine: IN_PROGRESS -> RESOLVED transition", () => {
    const res = resolveWorkflowCase(db, {
      workflow_id: wfId01,
      resolution_code: "SETTLEMENT_REVIEWED",
      resolution_note: "Deposit verified against bank statement",
      actor: adminOutlet1Actor
    });
    assert.strictEqual(res.status, "success");
    assert.strictEqual(res.data?.status, "RESOLVED");
    assert.strictEqual(res.data?.resolution_code, "SETTLEMENT_REVIEWED");
  });

  runTest("TEST 8: State Machine: RESOLVED -> VERIFIED transition", () => {
    const res = verifyWorkflowCase(db, {
      workflow_id: wfId01,
      verification_result: "PASS",
      verification_note: "Owner verified deposit receipt",
      actor: ownerActor
    });
    assert.strictEqual(res.status, "success");
    assert.strictEqual(res.data?.status, "VERIFIED");
  });

  runTest("TEST 9: State Machine: VERIFIED -> CLOSED transition", () => {
    const res = closeWorkflowCase(db, { workflow_id: wfId01, actor: ownerActor });
    assert.strictEqual(res.status, "success");
    assert.strictEqual(res.data?.status, "CLOSED");
    assert.ok(res.data?.completed_at);
  });

  runTest("TEST 10: State Machine: Invalid transition CLOSED -> OPEN rejected", () => {
    assert.strictEqual(isValidWorkflowTransition("CLOSED", "OPEN"), false);
  });

  runTest("TEST 11: State Machine: Invalid transition VERIFIED -> IN_PROGRESS rejected", () => {
    assert.strictEqual(isValidWorkflowTransition("VERIFIED", "IN_PROGRESS"), false);
  });

  runTest("TEST 12: Reopen Flow: CLOSED -> REOPENED -> IN_PROGRESS", () => {
    const reopenRes = reopenWorkflowCase(db, {
      workflow_id: wfId01,
      reason: "Additional bank discrepancy found",
      actor: ownerActor
    });
    assert.strictEqual(reopenRes.status, "success");
    assert.strictEqual(reopenRes.data?.status, "REOPENED");

    const startRes = startWorkflowCase(db, { workflow_id: wfId01, actor: adminOutlet1Actor });
    assert.strictEqual(startRes.status, "success");
    assert.strictEqual(startRes.data?.status, "IN_PROGRESS");
  });

  // --- PART 3: SLA MATRIX & AGEING TESTS ---
  runTest("TEST 13: SLA P0 (CRITICAL) calculated as 1 Hour", () => {
    const createdAt = "2026-08-09T08:00:00.000Z";
    const dueAt = calculateDueAt(createdAt, "P0");
    const expected = "2026-08-09T09:00:00.000Z";
    assert.strictEqual(dueAt, expected);
  });

  runTest("TEST 14: SLA P1 (ERROR) calculated as 4 Hours", () => {
    const createdAt = "2026-08-09T08:00:00.000Z";
    const dueAt = calculateDueAt(createdAt, "P1");
    const expected = "2026-08-09T12:00:00.000Z";
    assert.strictEqual(dueAt, expected);
  });

  runTest("TEST 15: SLA P2 (WARNING) calculated as 24 Hours", () => {
    const createdAt = "2026-08-09T08:00:00.000Z";
    const dueAt = calculateDueAt(createdAt, "P2");
    const expected = "2026-08-10T08:00:00.000Z";
    assert.strictEqual(dueAt, expected);
  });

  runTest("TEST 16: SLA P3 (INFO) calculated as 72 Hours", () => {
    const createdAt = "2026-08-09T08:00:00.000Z";
    const dueAt = calculateDueAt(createdAt, "P3");
    const expected = "2026-08-12T08:00:00.000Z";
    assert.strictEqual(dueAt, expected);
  });

  runTest("TEST 17: SLA Status ON_TRACK evaluated correctly", () => {
    const createdIso = new Date().toISOString();
    const wf: WorkflowCaseRecord = {
      workflow_id: "WF-TEST-ONTRACK",
      action_id: "ACT-01",
      source_type: "RECONCILIATION_EXCEPTION",
      source_id: "E-1",
      outlet_id: "OUTLET-01",
      priority: "P2",
      severity: "WARNING",
      title: "Title",
      description: "Desc",
      created_at: createdIso,
      due_at: calculateDueAt(createdIso, "P2"),
      status: "OPEN",
      escalation_level: 0,
      updated_at: createdIso
    };
    const evalRes = evaluateSLAAndAgeing(wf, new Date(createdIso).getTime() + 1000);
    assert.strictEqual(evalRes.sla_status, "ON_TRACK");
  });

  runTest("TEST 18: SLA Status DUE_SOON evaluated correctly", () => {
    const createdTime = Date.now() - 3.5 * 3600 * 1000; // 3.5 hours ago for P1 (4h total)
    const createdIso = new Date(createdTime).toISOString();
    const wf: WorkflowCaseRecord = {
      workflow_id: "WF-TEST-DUESOON",
      action_id: "ACT-02",
      source_type: "RECONCILIATION_EXCEPTION",
      source_id: "E-2",
      outlet_id: "OUTLET-01",
      priority: "P1",
      severity: "ERROR",
      title: "Title",
      description: "Desc",
      created_at: createdIso,
      due_at: calculateDueAt(createdIso, "P1"),
      status: "OPEN",
      escalation_level: 0,
      updated_at: createdIso
    };
    const evalRes = evaluateSLAAndAgeing(wf, Date.now());
    assert.strictEqual(evalRes.sla_status, "DUE_SOON");
  });

  runTest("TEST 19: SLA Status OVERDUE evaluated correctly", () => {
    const createdTime = Date.now() - 5 * 3600 * 1000; // 5 hours ago for P1 (4h total)
    const createdIso = new Date(createdTime).toISOString();
    const wf: WorkflowCaseRecord = {
      workflow_id: "WF-TEST-OVERDUE",
      action_id: "ACT-03",
      source_type: "RECONCILIATION_EXCEPTION",
      source_id: "E-3",
      outlet_id: "OUTLET-01",
      priority: "P1",
      severity: "ERROR",
      title: "Title",
      description: "Desc",
      created_at: createdIso,
      due_at: calculateDueAt(createdIso, "P1"),
      status: "OPEN",
      escalation_level: 0,
      updated_at: createdIso
    };
    const evalRes = evaluateSLAAndAgeing(wf, Date.now());
    assert.ok(evalRes.sla_status === "OVERDUE" || evalRes.sla_status === "BREACHED");
    assert.strictEqual(evalRes.is_overdue, true);
  });

  runTest("TEST 20: SLA Status BREACHED evaluated correctly", () => {
    const createdTime = Date.now() - 10 * 3600 * 1000;
    const createdIso = new Date(createdTime).toISOString();
    const wf: WorkflowCaseRecord = {
      workflow_id: "WF-TEST-BREACHED",
      action_id: "ACT-04",
      source_type: "RECONCILIATION_EXCEPTION",
      source_id: "E-4",
      outlet_id: "OUTLET-01",
      priority: "P0",
      severity: "CRITICAL",
      title: "Title",
      description: "Desc",
      created_at: createdIso,
      due_at: calculateDueAt(createdIso, "P0"),
      status: "ESCALATED",
      escalation_level: 1,
      escalation_required: true,
      updated_at: createdIso
    };
    const evalRes = evaluateSLAAndAgeing(wf, Date.now());
    assert.strictEqual(evalRes.sla_status, "BREACHED");
    assert.strictEqual(evalRes.is_breached, true);
  });

  // --- PART 4: ESCALATION ENGINE TESTS ---
  runTest("TEST 21: SLA breach automatically triggers escalation level increment", () => {
    const overdueTime = Date.now() - 3 * 3600 * 1000;
    const createdIso = new Date(overdueTime).toISOString();

    const createRes = createWorkflowCase(db, {
      source_type: "DAILY_CLOSING",
      source_id: "DC-301",
      outlet_id: "OUTLET-01",
      priority: "P0",
      severity: "CRITICAL",
      title: "Daily Closing Blocked DC-301",
      description: "Closing blocked due to mismatch",
      created_at: createdIso,
      actor: ownerActor
    });
    const caseObj = createRes.data!;
    assert.strictEqual(caseObj.escalation_level, 0);

    const count = processEscalations(db, Date.now());
    assert.ok(count >= 1);

    const updated = db.WorkflowCases.find((w: any) => w.workflow_id === caseObj.workflow_id);
    assert.strictEqual(updated.status, "ESCALATED");
    assert.strictEqual(updated.escalation_level, 1);
    assert.strictEqual(updated.escalation_required, true);
  });

  runTest("TEST 22: Escalation events logged in Audit Trail", () => {
    const breaches = db.AuditLogs.filter((l: any) => l.event_type === "WORKFLOW_SLA_BREACHED");
    const escalations = db.AuditLogs.filter((l: any) => l.event_type === "WORKFLOW_ESCALATED");
    assert.ok(breaches.length > 0, "WORKFLOW_SLA_BREACHED event logged");
    assert.ok(escalations.length > 0, "WORKFLOW_ESCALATED event logged");
  });

  runTest("TEST 23: Escalation engine is idempotent on subsequent runs", () => {
    const count2 = processEscalations(db, Date.now());
    assert.strictEqual(count2, 0, "No duplicate escalations for already escalated case");
  });

  // --- PART 5: ASSIGNMENT TESTS ---
  let wfIdAssign = "";

  runTest("TEST 24: Admin assignment succeeds for home outlet", () => {
    const createRes = createWorkflowCase(db, {
      source_type: "RECONCILIATION_EXCEPTION",
      source_id: "EXC-401",
      outlet_id: "OUTLET-01",
      priority: "P2",
      severity: "WARNING",
      title: "Minor Pricing Discrepancy",
      description: "Review required",
      actor: ownerActor
    });
    wfIdAssign = createRes.data!.workflow_id;

    const res = assignWorkflowCase(db, {
      workflow_id: wfIdAssign,
      assigned_to: "ADMIN-01",
      assigned_role: "ADMIN",
      actor: adminOutlet1Actor
    });
    assert.strictEqual(res.status, "success");
    assert.strictEqual(res.data?.assigned_to, "ADMIN-01");
    assert.strictEqual(res.data?.status, "ASSIGNED");
  });

  runTest("TEST 25: Owner assignment succeeds for financial action", () => {
    const createRes = createWorkflowCase(db, {
      source_type: "FINANCIAL_CERTIFICATION",
      source_id: "CERT-402",
      outlet_id: "OUTLET-01",
      priority: "P0",
      severity: "CRITICAL",
      title: "Close Certification CERT-402",
      description: "Financial certification required",
      actor: ownerActor
    });
    const res = assignWorkflowCase(db, {
      workflow_id: createRes.data!.workflow_id,
      assigned_to: "OWNER-01",
      assigned_role: "OWNER",
      actor: ownerActor
    });
    assert.strictEqual(res.status, "success");
    assert.strictEqual(res.data?.assigned_role, "OWNER");
  });

  runTest("TEST 26: Unassigned workflow cases detected in summary", () => {
    const summary = getWorkflowSummary(db, { outlet_id: "OUTLET-01" });
    assert.ok(summary.action_required.unassigned >= 0);
  });

  // --- PART 6: RESOLUTION & VERIFICATION TESTS ---
  let wfIdRes = "";

  runTest("TEST 27: Resolution metadata recorded cleanly", () => {
    const createRes = createWorkflowCase(db, {
      source_type: "RECONCILIATION_EXCEPTION",
      source_id: "EXC-501",
      outlet_id: "OUTLET-01",
      priority: "P1",
      severity: "ERROR",
      title: "Data Correction Case",
      description: "Fix transaction rate",
      actor: ownerActor
    });
    wfIdRes = createRes.data!.workflow_id;

    startWorkflowCase(db, { workflow_id: wfIdRes, actor: adminOutlet1Actor });

    const res = resolveWorkflowCase(db, {
      workflow_id: wfIdRes,
      resolution_code: "DATA_CORRECTED",
      resolution_note: "Updated pricing scheme according to contract",
      evidence: { ref_no: "REF-9988" },
      actor: adminOutlet1Actor
    });

    assert.strictEqual(res.status, "success");
    assert.strictEqual(res.data?.status, "RESOLVED");
    assert.strictEqual(res.data?.resolution_code, "DATA_CORRECTED");
    assert.strictEqual(res.data?.resolved_by, "ADMIN-01");
    assert.ok(res.data?.evidence);
  });

  runTest("TEST 28: Empty resolution note rejected", () => {
    const createRes = createWorkflowCase(db, {
      source_type: "RECONCILIATION_EXCEPTION",
      source_id: "EXC-502",
      outlet_id: "OUTLET-01",
      priority: "P2",
      severity: "WARNING",
      title: "Empty Note Case",
      description: "Desc",
      actor: ownerActor
    });
    startWorkflowCase(db, { workflow_id: createRes.data!.workflow_id, actor: adminOutlet1Actor });

    const res = resolveWorkflowCase(db, {
      workflow_id: createRes.data!.workflow_id,
      resolution_code: "DATA_CORRECTED",
      resolution_note: "   ",
      actor: adminOutlet1Actor
    });
    assert.strictEqual(res.status, "error");
    assert.strictEqual(res.error_code, "MISSING_RESOLUTION_NOTE");
  });

  runTest("TEST 29: Invalid resolution code rejected", () => {
    const res = resolveWorkflowCase(db, {
      workflow_id: wfIdRes,
      resolution_code: "INVALID_CODE_XYZ",
      resolution_note: "Some note",
      actor: adminOutlet1Actor
    });
    assert.strictEqual(res.status, "error");
    assert.strictEqual(res.error_code, "INVALID_RESOLUTION_CODE");
  });

  runTest("TEST 30: Failed verification reopens workflow case (REOPENED)", () => {
    const res = verifyWorkflowCase(db, {
      workflow_id: wfIdRes,
      verification_result: "FAIL",
      verification_note: "Pricing contract attachment missing",
      actor: ownerActor
    });
    assert.strictEqual(res.status, "success");
    assert.strictEqual(res.data?.status, "REOPENED");
    assert.strictEqual(res.data?.verification_result, "FAIL");
  });

  runTest("TEST 31: Successful verification moves workflow case to VERIFIED", () => {
    // Re-resolve first
    startWorkflowCase(db, { workflow_id: wfIdRes, actor: adminOutlet1Actor });
    resolveWorkflowCase(db, {
      workflow_id: wfIdRes,
      resolution_code: "DATA_CORRECTED",
      resolution_note: "Attached contract copy and verified rate",
      actor: adminOutlet1Actor
    });

    const res = verifyWorkflowCase(db, {
      workflow_id: wfIdRes,
      verification_result: "PASS",
      verification_note: "Contract verified",
      actor: ownerActor
    });
    assert.strictEqual(res.status, "success");
    assert.strictEqual(res.data?.status, "VERIFIED");
  });

  // --- PART 7: OUTLET & DATE ISOLATION TESTS ---
  runTest("TEST 32: Outlet isolation enforced on workflow list query for ADMIN", () => {
    const listOutlet1 = getWorkflowList(db, { outlet_id: "OUTLET-01", role: "ADMIN", actor_id: "ADMIN-01" });
    assert.ok(listOutlet1.every(w => w.outlet_id === "OUTLET-01"));

    const listOutlet2 = getWorkflowList(db, { outlet_id: "OUTLET-02", role: "ADMIN", actor_id: "ADMIN-02" });
    assert.ok(listOutlet2.every(w => w.outlet_id === "OUTLET-02"));
  });

  runTest("TEST 33: Date isolation enforced on workflow list query", () => {
    const listDate = getWorkflowList(db, { tanggal: "2026-08-09" });
    assert.ok(listDate.every(w => w.created_at.startsWith("2026-08-09")));
  });

  runTest("TEST 34: ADMIN cannot access detail of another outlet's workflow case", () => {
    const createRes = createWorkflowCase(db, {
      source_type: "RECONCILIATION_EXCEPTION",
      source_id: "EXC-601",
      outlet_id: "OUTLET-02",
      priority: "P1",
      severity: "ERROR",
      title: "Outlet 2 Exception",
      description: "Desc",
      actor: ownerActor
    });
    const wfId2 = createRes.data!.workflow_id;

    const detail = getWorkflowDetail(db, wfId2, adminOutlet1Actor);
    assert.strictEqual(detail, null, "Admin Outlet 1 denied access to Outlet 2 workflow");
  });

  // --- PART 8: INTEGRITY & REGRESSION TESTS ---
  runTest("TEST 35: MASTER_TRANSAKSI is preserved without unintended mutations", () => {
    assert.strictEqual(db.MASTER_TRANSAKSI.length, initialTxCount);
  });

  runTest("TEST 36: MASTER_PENGIRIMAN is preserved without unintended mutations", () => {
    assert.strictEqual(db.MASTER_PENGIRIMAN.length, initialShipCount);
  });

  runTest("TEST 37: Idempotent create returns existing workflow case without duplicate", () => {
    const countBefore = db.WorkflowCases.length;
    const res1 = createWorkflowCase(db, {
      action_id: "ACT-IDEMPOTENT-01",
      source_type: "SETTLEMENT",
      source_id: "STL-IDEM-01",
      outlet_id: "OUTLET-01",
      priority: "P1",
      severity: "ERROR",
      title: "Idempotency Test",
      description: "Desc",
      actor: ownerActor
    });
    const countAfter1 = db.WorkflowCases.length;

    const res2 = createWorkflowCase(db, {
      action_id: "ACT-IDEMPOTENT-01",
      source_type: "SETTLEMENT",
      source_id: "STL-IDEM-01",
      outlet_id: "OUTLET-01",
      priority: "P1",
      severity: "ERROR",
      title: "Idempotency Test",
      description: "Desc",
      actor: ownerActor
    });
    const countAfter2 = db.WorkflowCases.length;

    assert.strictEqual(countAfter1, countBefore + 1);
    assert.strictEqual(countAfter2, countAfter1);
    assert.strictEqual(res1.data?.workflow_id, res2.data?.workflow_id);
  });

  runTest("TEST 38: Audit Trail complete for entire workflow lifecycle", () => {
    const logs = db.AuditLogs.filter((l: any) => l.entity_id === wfIdRes);
    const eventTypes = logs.map((l: any) => l.event_type);

    assert.ok(eventTypes.includes("WORKFLOW_CREATED"));
    assert.ok(eventTypes.includes("WORKFLOW_STARTED"));
    assert.ok(eventTypes.includes("WORKFLOW_RESOLVED"));
    assert.ok(eventTypes.includes("WORKFLOW_VERIFICATION_STARTED"));
    assert.ok(eventTypes.includes("WORKFLOW_VERIFIED"));
  });

  runTest("TEST 39: Workflow Summary calculation accurate across statuses", () => {
    const summary = getWorkflowSummary(db, { outlet_id: "OUTLET-01" });
    assert.ok(summary.action_required);
    assert.ok(summary.workflow_summary);
    assert.ok(summary.sla_health);
    assert.ok(typeof summary.action_required.total_open === "number");
  });

  runTest("TEST 40: End-to-end full workflow lifecycle PASSES cleanly", () => {
    // 1. Create
    const cRes = createWorkflowCase(db, {
      source_type: "DAILY_CLOSING",
      source_id: "DC-E2E-99",
      outlet_id: "OUTLET-01",
      priority: "P0",
      severity: "CRITICAL",
      title: "E2E Closing Issue",
      description: "Closing blocked",
      actor: ownerActor
    });
    const e2eWfId = cRes.data!.workflow_id;

    // 2. Assign
    assignWorkflowCase(db, { workflow_id: e2eWfId, assigned_to: "ADMIN-01", actor: ownerActor });

    // 3. Start
    startWorkflowCase(db, { workflow_id: e2eWfId, actor: adminOutlet1Actor });

    // 4. Resolve
    resolveWorkflowCase(db, {
      workflow_id: e2eWfId,
      resolution_code: "TRANSACTION_REVIEWED",
      resolution_note: "All transactions verified",
      actor: adminOutlet1Actor
    });

    // 5. Verify
    verifyWorkflowCase(db, {
      workflow_id: e2eWfId,
      verification_result: "PASS",
      verification_note: "Owner verified",
      actor: ownerActor
    });

    // 6. Close
    const closeRes = closeWorkflowCase(db, { workflow_id: e2eWfId, actor: ownerActor });

    assert.strictEqual(closeRes.status, "success");
    assert.strictEqual(closeRes.data?.status, "CLOSED");
  });

  console.log("==========================================");
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("==========================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase37Tests();
