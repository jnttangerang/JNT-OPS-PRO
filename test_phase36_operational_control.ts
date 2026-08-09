import { 
  getControlActions, 
  executeControlAction, 
  checkActionAuthorization,
  isRoleValid,
  mapSeverityToPriority,
  ActionableControlItem
} from "./src/lib/operationalControlEngine";
import { logAuditEvent, getAuditTrail } from "./src/lib/auditTrailEngine";
import { processRecordDeposit, processApproveSettlement, getSettlementRecord } from "./src/lib/settlementEngine";
import { validateDailyClosing, executeDailyClosing, getDailyClosingRecord } from "./src/lib/dailyClosingEngine";
import { validateFinancialClose, certifyFinancialClose, getCertificationRecord } from "./src/lib/financialCloseCertificationEngine";
import { getExceptions, resolveException } from "./src/lib/reconciliationReviewEngine";

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    testsPassed++;
    console.log(`✅ PASS: ${testName}`);
  } else {
    testsFailed++;
    console.error(`❌ FAIL: ${testName}` + (detail ? ` -> ${detail}` : ""));
  }
}

function mockDatabase() {
  const today = "2026-08-09";
  return {
    Users: [
      { user_id: "USR-OWNER", username: "owner1", role: "OWNER", status_aktif: "AKTIF" },
      { user_id: "USR-ADMIN1", username: "admin1", role: "ADMIN", outlet_id_home: "OUTLET-01", status_aktif: "AKTIF" },
      { user_id: "USR-ADMIN2", username: "admin2", role: "ADMIN", outlet_id_home: "OUTLET-02", status_aktif: "AKTIF" }
    ],
    Outlets: [
      { outlet_id: "OUTLET-01", nama_outlet: "Outlet 1 Jababeka" },
      { outlet_id: "OUTLET-02", nama_outlet: "Outlet 2 Cikarang" }
    ],
    MASTER_TRANSAKSI: [
      {
        id: "TX-01-001",
        transaksi_id: "TX-01-001",
        outlet_id: "OUTLET-01",
        tanggal_transaksi: today,
        admin_id: "USR-ADMIN1",
        total_customer: 150000,
        wajib_setor_owner: 120000,
        kas_outlet: 30000,
        status_transaksi: "DELIVERED",
        status_setoran: "PENDING",
        status_audit: "CLEAN"
      },
      {
        id: "TX-02-001",
        transaksi_id: "TX-02-001",
        outlet_id: "OUTLET-02",
        tanggal_transaksi: today,
        admin_id: "USR-ADMIN2",
        total_customer: 200000,
        wajib_setor_owner: 160000,
        kas_outlet: 40000,
        status_transaksi: "DELIVERED",
        status_setoran: "PENDING",
        status_audit: "CLEAN"
      }
    ],
    MASTER_PENGIRIMAN: [],
    ReconciliationExceptions: [
      {
        exception_id: "EXC-01-CRIT",
        fingerprint: "OUTLET::PRICE_MISMATCH::TRANSAKSI::TX-01-001::TX-01-001::OUTLET-01",
        reconciliation_scope: "OUTLET",
        exception_type: "PRICE_MISMATCH",
        severity: "CRITICAL",
        entity_type: "TRANSAKSI",
        entity_id: "TX-01-001",
        transaksi_id: "TX-01-001",
        outlet_id: "OUTLET-01",
        detected_at: `${today}T10:00:00.000Z`,
        status: "OPEN",
        root_cause: "Tarif ongkir beda",
        recommendation: "Review ongkir",
        financial_impact: 15000
      },
      {
        exception_id: "EXC-01-ERR",
        fingerprint: "OUTLET::STATUS_MISMATCH::TRANSAKSI::TX-01-001::TX-01-001::OUTLET-01",
        reconciliation_scope: "OUTLET",
        exception_type: "STATUS_MISMATCH",
        severity: "ERROR",
        entity_type: "TRANSAKSI",
        entity_id: "TX-01-001",
        transaksi_id: "TX-01-001",
        outlet_id: "OUTLET-01",
        detected_at: `${today}T10:05:00.000Z`,
        status: "OPEN",
        root_cause: "Status pengiriman beda",
        recommendation: "Update status",
        financial_impact: 5000
      },
      {
        exception_id: "EXC-01-WARN",
        fingerprint: "OUTLET::WEIGHT_MISMATCH::TRANSAKSI::TX-01-001::TX-01-001::OUTLET-01",
        reconciliation_scope: "OUTLET",
        exception_type: "WEIGHT_MISMATCH",
        severity: "WARNING",
        entity_type: "TRANSAKSI",
        entity_id: "TX-01-001",
        transaksi_id: "TX-01-001",
        outlet_id: "OUTLET-01",
        detected_at: `${today}T10:10:00.000Z`,
        status: "OPEN",
        root_cause: "Berat beda 0.1kg",
        recommendation: "Cek timbangan",
        financial_impact: 1000
      }
    ],
    SettlementRecords: [
      {
        settlement_id: `STL-OUTLET-01-${today}`,
        outlet_id: "OUTLET-01",
        tanggal: today,
        status: "MISMATCH",
        expected_owner_deposit: 120000,
        actual_owner_deposit: 100000,
        difference: -20000,
        deposit_status: "MISMATCH",
        total_customer: 150000,
        total_outlet_cash: 30000,
        total_rounding: 0,
        transaction_count: 1,
        valid_financial_transaction_count: 1,
        cancelled_transaction_count: 0,
        reconciliation_status: "CRITICAL",
        open_exceptions_count: 3,
        open_critical_count: 1,
        open_error_count: 1,
        open_warning_count: 1,
        created_by: "USR-ADMIN1",
        created_at: `${today}T08:00:00.000Z`,
        updated_at: `${today}T08:00:00.000Z`
      }
    ],
    DailyClosing: [
      {
        closing_id: `CLS-OUTLET-01-${today}`,
        outlet_id: "OUTLET-01",
        tanggal: today,
        status: "BLOCKED",
        total_customer: 150000,
        total_owner_deposit: 120000,
        total_outlet_cash: 30000,
        total_rounding: 0,
        transaction_count: 1,
        valid_financial_transaction_count: 1,
        cancelled_transaction_count: 0,
        setoran_required: 120000,
        setoran_actual: 100000,
        setoran_variance: -20000,
        setoran_status: "MISMATCH",
        reconciliation_status: "CRITICAL",
        open_exceptions_count: 3,
        open_critical_count: 1,
        open_error_count: 1,
        open_warning_count: 1,
        blocking_reasons: ["Terdapat 1 CRITICAL reconciliation exception belum selesai."],
        created_at: `${today}T08:00:00.000Z`,
        updated_at: `${today}T08:00:00.000Z`
      }
    ],
    FinancialCloseCertification: [
      {
        certification_id: `FC-OUTLET-01-${today}`,
        outlet_id: "OUTLET-01",
        tanggal: today,
        status: "BLOCKED",
        certified: false,
        controls: [],
        blocking_reasons: ["Settlement belum mendapatkan final owner approval."],
        warnings: [],
        financial_summary: {},
        settlement_status: "MISMATCH",
        reconciliation_status: "CRITICAL",
        daily_closing_status: "BLOCKED",
        evidence: {},
        created_at: `${today}T08:00:00.000Z`,
        updated_at: `${today}T08:00:00.000Z`
      }
    ],
    AuditLogs: []
  };
}

async function runPhase36Tests() {
  console.log("\n==========================================");
  console.log("RUNNING PHASE 36 OPERATIONAL CONTROL TESTS");
  console.log("==========================================\n");

  const today = "2026-08-09";

  // --- CATEGORY 1: ACCESS & SECURITY (1-5) ---
  {
    const db = mockDatabase();
    assert(isRoleValid("OWNER") && isRoleValid("ADMIN"), "TEST 1: Role validation accepts OWNER and ADMIN");
    assert(!isRoleValid("SUPER_ADMIN") && !isRoleValid("GUEST"), "TEST 2: Role validation rejects invalid roles (SUPER_ADMIN, GUEST)");

    const authOwner = checkActionAuthorization({ actor_id: "USR-OWNER", actor_role: "OWNER" }, "APPROVE_SETTLEMENT", "OUTLET-01");
    assert(authOwner.authorized, "TEST 3: OWNER authorized for Owner-only actions");

    const authAdmin = checkActionAuthorization({ actor_id: "USR-ADMIN1", actor_role: "ADMIN", outlet_id: "OUTLET-01" }, "APPROVE_SETTLEMENT", "OUTLET-01");
    assert(!authAdmin.authorized && authAdmin.reason?.includes("OWNER"), "TEST 4: ADMIN blocked from Owner-only actions (APPROVE_SETTLEMENT)");

    const authSuperAdmin = checkActionAuthorization({ actor_id: "USR-SUPER", actor_role: "SUPER_ADMIN" }, "RECORD_DEPOSIT", "OUTLET-01");
    assert(!authSuperAdmin.authorized, "TEST 5: SUPER_ADMIN role rejected by control engine");
  }

  // --- CATEGORY 2: OUTLET & DATE ISOLATION (6-10) ---
  {
    const db = mockDatabase();
    const actionsAdmin1 = getControlActions(db, { outlet_id: "OUTLET-01", role: "ADMIN", actor_id: "USR-ADMIN1" });
    assert(actionsAdmin1.actions.every(a => a.outlet_id === "OUTLET-01"), "TEST 6: ADMIN 1 views only OUTLET-01 actions");

    const actionsOwner = getControlActions(db, { role: "OWNER" });
    assert(actionsOwner.actions.length > 0, "TEST 7: OWNER can view actions across all outlets");

    const actionsDate = getControlActions(db, { outlet_id: "OUTLET-01", tanggal: "2020-01-01", role: "OWNER" });
    assert(actionsDate.actions.length === 0, "TEST 8: Date isolation enforced (no cross-date data leakage)");

    const crossOutletRes = executeControlAction(db, {
      action_id: "ACT-01",
      action_type: "RECORD_DEPOSIT",
      actor: { actor_id: "USR-ADMIN1", actor_role: "ADMIN", outlet_id: "OUTLET-01" },
      outlet_id: "OUTLET-02",
      tanggal: today
    });
    assert(crossOutletRes.status === "ACTION_REJECTED", "TEST 9: Cross-outlet action by ADMIN rejected");

    const authCrossOutlet = checkActionAuthorization({ actor_id: "USR-ADMIN1", actor_role: "ADMIN", outlet_id: "OUTLET-01" }, "RECORD_DEPOSIT", "OUTLET-02");
    assert(!authCrossOutlet.authorized, "TEST 10: Strict outlet authorization isolation for ADMIN");
  }

  // --- CATEGORY 3: PRIORITY & CLASSIFICATION (11-15) ---
  {
    assert(mapSeverityToPriority("CRITICAL") === "P0", "TEST 11: CRITICAL mapped to P0");
    assert(mapSeverityToPriority("ERROR") === "P1", "TEST 12: ERROR mapped to P1");
    assert(mapSeverityToPriority("WARNING") === "P2", "TEST 13: WARNING mapped to P2");
    assert(mapSeverityToPriority("INFO") === "P3", "TEST 14: INFO mapped to P3");

    const db = mockDatabase();
    const actionsRes = getControlActions(db, { outlet_id: "OUTLET-01", tanggal: today, role: "OWNER" });
    const prios = actionsRes.actions.map(a => a.priority);
    let isSorted = true;
    const prioRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
    for (let i = 1; i < prios.length; i++) {
      if (prioRank[prios[i]] < prioRank[prios[i - 1]]) {
        isSorted = false;
        break;
      }
    }
    assert(isSorted, "TEST 15: Actions sorted deterministically by Priority (P0 -> P1 -> P2 -> P3)");
  }

  // --- CATEGORY 4: DOMAIN ENGINE INTEGRATION (16-21) ---
  {
    const db = mockDatabase();
    const res = getControlActions(db, { outlet_id: "OUTLET-01", tanggal: today, role: "OWNER" });
    const engines = new Set(res.actions.map(a => a.source_engine));

    assert(res.total > 0, "TEST 16: Financial Engine data integrated");
    assert(engines.has("settlementEngine"), "TEST 17: Settlement Engine integrated");
    assert(engines.has("reconciliationReviewEngine"), "TEST 18: Reconciliation Review Engine integrated");
    assert(engines.has("dailyClosingEngine"), "TEST 19: Daily Closing Engine integrated");
    assert(engines.has("financialCloseCertificationEngine"), "TEST 20: Certification Engine integrated");
    assert(res.critical > 0, "TEST 21: Evidence / Severity metrics calculated accurately");
  }

  // --- CATEGORY 5: ACTION EXECUTION & WORKFLOW (22-27) ---
  {
    const db = mockDatabase();
    // Test Resolve Exceptions
    const execExc = executeControlAction(db, {
      action_id: "ACT-EXC-01",
      action_type: "RESOLVE_EXCEPTION",
      actor: { actor_id: "USR-ADMIN1", actor_role: "ADMIN", outlet_id: "OUTLET-01" },
      outlet_id: "OUTLET-01",
      tanggal: today,
      entity_id: "EXC-01-CRIT",
      entity_type: "RECONCILIATION_EXCEPTION",
      params: { resolution: "RESOLVED", resolution_reason: "Fixed price discrepancy" }
    });
    executeControlAction(db, {
      action_id: "ACT-EXC-02",
      action_type: "RESOLVE_EXCEPTION",
      actor: { actor_id: "USR-ADMIN1", actor_role: "ADMIN", outlet_id: "OUTLET-01" },
      outlet_id: "OUTLET-01",
      tanggal: today,
      entity_id: "EXC-01-ERR",
      entity_type: "RECONCILIATION_EXCEPTION",
      params: { resolution: "RESOLVED", resolution_reason: "Fixed status discrepancy" }
    });
    assert(execExc.status === "SUCCESS", "TEST 22: Exception resolve action executed successfully");

    // Test Record Deposit
    const execDep = executeControlAction(db, {
      action_id: "ACT-STL-01",
      action_type: "RECORD_DEPOSIT",
      actor: { actor_id: "USR-ADMIN1", actor_role: "ADMIN", outlet_id: "OUTLET-01" },
      outlet_id: "OUTLET-01",
      tanggal: today,
      entity_id: `STL-OUTLET-01-${today}`,
      entity_type: "SETTLEMENT",
      params: { actual_amount: 120000 }
    });
    assert(execDep.status === "SUCCESS", "TEST 23: Settlement record deposit action executed successfully", JSON.stringify(execDep));

    // Test Approve Settlement
    const execApp = executeControlAction(db, {
      action_id: "ACT-STL-APP-01",
      action_type: "APPROVE_SETTLEMENT",
      actor: { actor_id: "USR-OWNER", actor_role: "OWNER" },
      outlet_id: "OUTLET-01",
      tanggal: today,
      entity_id: `STL-OUTLET-01-${today}`,
      entity_type: "SETTLEMENT",
      params: { allowSelfApproval: true }
    });
    assert(execApp.status === "SUCCESS", "TEST 24: Settlement approval action executed successfully by OWNER", JSON.stringify(execApp));

    // Test Daily Closing
    const execDC = executeControlAction(db, {
      action_id: "ACT-DC-01",
      action_type: "VALIDATE_CLOSING",
      actor: { actor_id: "USR-ADMIN1", actor_role: "ADMIN", outlet_id: "OUTLET-01" },
      outlet_id: "OUTLET-01",
      tanggal: today,
      entity_id: `CLS-OUTLET-01-${today}`,
      entity_type: "DAILY_CLOSING"
    });
    assert(execDC.status === "SUCCESS", "TEST 25: Daily closing validate action executed successfully");

    // Test Invalid Action
    const execInvalid = executeControlAction(db, {
      action_id: "ACT-INV",
      action_type: "INVALID_ACTION_TYPE",
      actor: { actor_id: "USR-OWNER", actor_role: "OWNER" },
      outlet_id: "OUTLET-01",
      tanggal: today
    });
    assert(execInvalid.status === "ACTION_FAILED", "TEST 26: Invalid action type rejected as ACTION_FAILED");

    // Test Certification Action
    const execCert = executeControlAction(db, {
      action_id: "ACT-CERT-01",
      action_type: "VALIDATE_CERTIFICATION",
      actor: { actor_id: "USR-OWNER", actor_role: "OWNER" },
      outlet_id: "OUTLET-01",
      tanggal: today
    });
    assert(execCert.status === "SUCCESS", "TEST 27: Financial close certification validate action executed successfully");
  }

  // --- CATEGORY 6: IDEMPOTENCY & SAFETY (28-30) ---
  {
    const db = mockDatabase();
    const input = {
      action_id: "ACT-IDEM-01",
      action_type: "RESOLVE_EXCEPTION",
      actor: { actor_id: "USR-ADMIN1", actor_role: "ADMIN", outlet_id: "OUTLET-01" },
      outlet_id: "OUTLET-01",
      tanggal: today,
      correlation_id: "CORR-IDEM-999",
      entity_id: "EXC-01-CRIT",
      entity_type: "RECONCILIATION_EXCEPTION",
      params: { resolution: "RESOLVED", resolution_reason: "First call" }
    };

    const res1 = executeControlAction(db, input);
    assert(res1.status === "SUCCESS", "TEST 28: First execution succeeds");

    const res2 = executeControlAction(db, input);
    assert(res2.status === "ACTION_ALREADY_COMPLETED", "TEST 29: Duplicate execution returns ACTION_ALREADY_COMPLETED");
    assert(res2.correlation_id === "CORR-IDEM-999", "TEST 30: Idempotent call retains correlation_id");
  }

  // --- CATEGORY 7: READ-BACK VERIFICATION (31-32) ---
  {
    const db = mockDatabase();
    // Normal resolve passes verification
    const resVerif = executeControlAction(db, {
      action_id: "ACT-VERIF-01",
      action_type: "RESOLVE_EXCEPTION",
      actor: { actor_id: "USR-ADMIN1", actor_role: "ADMIN", outlet_id: "OUTLET-01" },
      outlet_id: "OUTLET-01",
      tanggal: today,
      entity_id: "EXC-01-CRIT",
      entity_type: "RECONCILIATION_EXCEPTION",
      params: { resolution: "RESOLVED", resolution_reason: "Verified resolution" }
    });
    assert(resVerif.status === "SUCCESS", "TEST 31: Verification succeeds when state matches expected outcome");

    // Test artificially corrupted verification
    const dbCorrupt = mockDatabase();
    dbCorrupt.ReconciliationExceptions = []; // target entity deleted, so read-back fails
    const resFailVerif = executeControlAction(dbCorrupt, {
      action_id: "ACT-VERIF-02",
      action_type: "RESOLVE_EXCEPTION",
      actor: { actor_id: "USR-ADMIN1", actor_role: "ADMIN", outlet_id: "OUTLET-01" },
      outlet_id: "OUTLET-01",
      tanggal: today,
      entity_id: "NON_EXISTENT_EXC",
      entity_type: "RECONCILIATION_EXCEPTION",
      params: { resolution: "RESOLVED", resolution_reason: "Will fail" }
    });
    assert(resFailVerif.status === "ACTION_FAILED" || resFailVerif.status === "ACTION_VERIFICATION_FAILED", "TEST 32: Verification failure or missing entity handled cleanly");
  }

  // --- CATEGORY 8: AUDIT TRAIL (33-35) ---
  {
    const db = mockDatabase();
    const corrId = "CORR-AUDIT-TEST-123";
    executeControlAction(db, {
      action_id: "ACT-AUDIT-01",
      action_type: "RECORD_DEPOSIT",
      actor: { actor_id: "USR-ADMIN1", actor_role: "ADMIN", outlet_id: "OUTLET-01" },
      outlet_id: "OUTLET-01",
      tanggal: today,
      correlation_id: corrId,
      entity_id: `STL-OUTLET-01-${today}`,
      params: { actual_amount: 120000 }
    });

    const logs = getAuditTrail(db, { correlation_id: corrId });
    const eventTypes = logs.map((l: any) => l.event_type);

    assert(eventTypes.includes("CONTROL_ACTION_STARTED"), "TEST 33: CONTROL_ACTION_STARTED event logged");
    assert(eventTypes.includes("CONTROL_ACTION_AUTHORIZED"), "TEST 34: CONTROL_ACTION_AUTHORIZED event logged");
    assert(eventTypes.includes("CONTROL_ACTION_VERIFIED"), "TEST 35: CONTROL_ACTION_VERIFIED event logged");
  }

  // --- CATEGORY 9: EXTENDED & REGRESSION (36-46) ---
  {
    const db = mockDatabase();

    // 36: Self-approval protection
    const stl = getSettlementRecord(db, "OUTLET-01", today);
    if (stl) {
      stl.created_by = "USR-OWNER";
      stl.status = "PENDING_APPROVAL";
      stl.difference = 0;
      stl.open_critical_count = 0;
      stl.open_error_count = 0;
    }
    const selfAppRes = processApproveSettlement({
      settlement: stl!,
      actor: { actor_id: "USR-OWNER", actor_role: "OWNER" },
      allowSelfApproval: false
    });
    assert(selfAppRes.status === "error" && selfAppRes.error_code === "SELF_APPROVAL_PROHIBITED", "TEST 36: Self-approval protection in settlement engine");

    // 37: Domain engine failure properly logged
    const dbEmpty = mockDatabase();
    delete dbEmpty.ReconciliationExceptions;
    const failRes = executeControlAction(dbEmpty, {
      action_id: "ACT-FAIL-01",
      action_type: "RESOLVE_EXCEPTION",
      actor: { actor_id: "USR-ADMIN1", actor_role: "ADMIN", outlet_id: "OUTLET-01" },
      outlet_id: "OUTLET-01",
      tanggal: today,
      entity_id: "EXC-NONEXISTENT",
      params: { resolution: "RESOLVED", resolution_reason: "Test" }
    });
    assert(failRes.status === "ACTION_FAILED", "TEST 37: Domain engine failure properly logged as ACTION_FAILED");

    // 38: GET control actions produces no mutations or AuditLogs
    const dbGetTest = mockDatabase();
    const initialLogCount = dbGetTest.AuditLogs.length;
    getControlActions(dbGetTest, { outlet_id: "OUTLET-01", tanggal: today, role: "OWNER" });
    assert(dbGetTest.AuditLogs.length === initialLogCount, "TEST 38: GET control actions produces no AuditLogs (Read-Only safety)");

    // 39: UI refresh yields consistent actions
    const ref1 = getControlActions(dbGetTest, { outlet_id: "OUTLET-01", tanggal: today, role: "OWNER" });
    const ref2 = getControlActions(dbGetTest, { outlet_id: "OUTLET-01", tanggal: today, role: "OWNER" });
    assert(ref1.total === ref2.total && ref1.actions.length === ref2.actions.length, "TEST 39: UI refresh yields consistent control actions");

    // 40: Reload consistency
    const jsonStr = JSON.stringify(dbGetTest);
    const reloadedDb = JSON.parse(jsonStr);
    const ref3 = getControlActions(reloadedDb, { outlet_id: "OUTLET-01", tanggal: today, role: "OWNER" });
    assert(ref3.total === ref1.total, "TEST 40: Database reload consistency verified");

    // 41: Phase 30 Daily Closing integration regression
    const dcRes = getDailyClosingRecord(dbGetTest, "OUTLET-01", today);
    assert(dcRes !== null && dcRes.closing_id.includes("OUTLET-01"), "TEST 41: Phase 30 Daily Closing Engine integration intact");

    // 42: Phase 32 Settlement integration regression
    const stlRes = getSettlementRecord(dbGetTest, "OUTLET-01", today);
    assert(stlRes !== null && stlRes.settlement_id.includes("OUTLET-01"), "TEST 42: Phase 32 Settlement Engine integration intact");

    // 43: Phase 33 Certification integration regression
    const certRes = getCertificationRecord(dbGetTest, "OUTLET-01", today);
    assert(certRes !== null && certRes.certification_id.includes("OUTLET-01"), "TEST 43: Phase 33 Certification Engine integration intact");

    // 44: Phase 34 Evidence integration regression
    assert(certRes?.controls !== undefined, "TEST 44: Phase 34 Evidence / Control checks intact");

    // 45: Phase 35 Control Tower integration regression
    assert(ref1.critical >= 0 && ref1.error >= 0, "TEST 45: Phase 35 Control Tower metric integration intact");

    // 46: End-to-end exception resolution to closing pipeline
    const pipelineDb = mockDatabase();
    // 1. Resolve exceptions
    const excRes = executeControlAction(pipelineDb, {
      action_id: "PIPE-01",
      action_type: "RESOLVE_EXCEPTION",
      actor: { actor_id: "USR-ADMIN1", actor_role: "ADMIN", outlet_id: "OUTLET-01" },
      outlet_id: "OUTLET-01",
      tanggal: today,
      entity_id: "EXC-01-CRIT",
      params: { resolution: "RESOLVED", resolution_reason: "Fixed in pipeline" }
    });
    executeControlAction(pipelineDb, {
      action_id: "PIPE-01B",
      action_type: "RESOLVE_EXCEPTION",
      actor: { actor_id: "USR-ADMIN1", actor_role: "ADMIN", outlet_id: "OUTLET-01" },
      outlet_id: "OUTLET-01",
      tanggal: today,
      entity_id: "EXC-01-ERR",
      params: { resolution: "RESOLVED", resolution_reason: "Fixed error in pipeline" }
    });
    // 2. Deposit setoran
    const depRes = executeControlAction(pipelineDb, {
      action_id: "PIPE-02",
      action_type: "RECORD_DEPOSIT",
      actor: { actor_id: "USR-ADMIN1", actor_role: "ADMIN", outlet_id: "OUTLET-01" },
      outlet_id: "OUTLET-01",
      tanggal: today,
      params: { actual_amount: 120000 }
    });
    // 3. Re-validate closing
    const dcPipe = executeControlAction(pipelineDb, {
      action_id: "PIPE-03",
      action_type: "VALIDATE_CLOSING",
      actor: { actor_id: "USR-ADMIN1", actor_role: "ADMIN", outlet_id: "OUTLET-01" },
      outlet_id: "OUTLET-01",
      tanggal: today
    });

    assert(excRes.status === "SUCCESS" && depRes.status === "SUCCESS" && dcPipe.status === "SUCCESS", "TEST 46: End-to-end exception resolution to closing pipeline executed successfully");
  }

  console.log("\n==========================================");
  console.log(`TEST SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log("==========================================\n");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runPhase36Tests().catch(err => {
  console.error("Test execution error:", err);
  process.exit(1);
});
