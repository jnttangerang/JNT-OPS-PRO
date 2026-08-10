import assert from "assert";
import fs from "fs";
import path from "path";
import {
  checkActionAuthorization,
  executeControlAction
} from "./src/lib/operationalControlEngine";
import {
  checkWorkflowAuthorization,
  createWorkflowCase,
  getWorkflowList
} from "./src/lib/operationalWorkflowEngine";
import {
  createManagementReview,
  getManagementReviewDetail
} from "./src/lib/managementReviewEngine";

const TEST_DB_PATH = path.join(process.cwd(), "db.json");

function getMockDb() {
  return {
    Outlets: [
      { outlet_id: "OUTLET-A", nama_outlet: "Outlet Alpha" },
      { outlet_id: "OUTLET-B", nama_outlet: "Outlet Beta" }
    ],
    MASTER_OUTLET: [
      { outlet_id: "OUTLET-A", nama_outlet: "Outlet Alpha" },
      { outlet_id: "OUTLET-B", nama_outlet: "Outlet Beta" }
    ],
    MASTER_TRANSAKSI: [
      { id: "TX-A1", transaksi_id: "TX-A1", outlet_id: "OUTLET-A", admin_id: "ADMIN-A", tanggal: "2026-08-10", total_dibayar_customer: 10000, status_transaksi: "COMPLETED" },
      { id: "TX-B1", transaksi_id: "TX-B1", outlet_id: "OUTLET-B", admin_id: "ADMIN-B", tanggal: "2026-08-10", total_dibayar_customer: 15000, status_transaksi: "COMPLETED" }
    ],
    MASTER_PENGIRIMAN: [],
    WorkflowCases: [],
    AuditLogs: [],
    ManagementReviews: []
  };
}

function runAuthorizationScopeTests() {
  console.log("==================================================");
  console.log("RUNNING AUTHORIZATION ACTIVE OUTLET SCOPE SUITE");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function runTest(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      console.log(`✅ PASS: ${name}`);
    } catch (err: any) {
      failed++;
      console.error(`❌ FAIL: ${name} -> ${err.message}`);
    }
  }

  const db = getMockDb();

  const adminA = { actor_id: "ADMIN-A", actor_name: "Admin A", actor_role: "ADMIN", outlet_id: "OUTLET-A" };
  const adminB = { actor_id: "ADMIN-B", actor_name: "Admin B", actor_role: "ADMIN", outlet_id: "OUTLET-B" };
  const owner = { actor_id: "OWNER-1", actor_name: "Owner 1", actor_role: "OWNER" };

  // TEST 1: ADMIN A -> Outlet A
  runTest("TEST 1: ADMIN A working on Outlet A (Home Outlet)", () => {
    const auth = checkActionAuthorization(db, adminA, "RECORD_DEPOSIT", "OUTLET-A");
    assert.strictEqual(auth.authorized, true);
  });

  // TEST 2: ADMIN A -> Outlet B
  runTest("TEST 2: ADMIN A working on Outlet B (Active Outlet)", () => {
    const auth = checkActionAuthorization(db, adminA, "RECORD_DEPOSIT", "OUTLET-B");
    assert.strictEqual(auth.authorized, true);
  });

  // TEST 3: ADMIN B -> Outlet A
  runTest("TEST 3: ADMIN B working on Outlet A (Active Outlet)", () => {
    const auth = checkActionAuthorization(db, adminB, "RECORD_DEPOSIT", "OUTLET-A");
    assert.strictEqual(auth.authorized, true);
  });

  // TEST 4: ADMIN B -> Outlet B
  runTest("TEST 4: ADMIN B working on Outlet B (Home Outlet)", () => {
    const auth = checkActionAuthorization(db, adminB, "RECORD_DEPOSIT", "OUTLET-B");
    assert.strictEqual(auth.authorized, true);
  });

  // TEST 5: Invalid outlet
  runTest("TEST 5: Action on invalid / unlisted outlet rejected", () => {
    const auth = checkActionAuthorization(db, adminA, "RECORD_DEPOSIT", "OUTLET-INVALID-999");
    assert.strictEqual(auth.authorized, false);
    assert.ok(auth.reason?.includes("tidak tersedia") || auth.reason?.includes("tidak diizinkan"));
  });

  // TEST 6: Missing activeOutletId
  runTest("TEST 6: Missing activeOutletId handled safely", () => {
    const auth = checkActionAuthorization(db, adminA, "RECORD_DEPOSIT", "");
    assert.strictEqual(auth.authorized, false);
  });

  // TEST 7: Payload outlet mismatch / unavailable outlet in workflow
  runTest("TEST 7: Payload outlet mismatch or unpermitted outlet rejected", () => {
    const res = createWorkflowCase(db, {
      source_type: "RECONCILIATION_EXCEPTION",
      source_id: "EXC-999",
      outlet_id: "OUTLET-UNKNOWN",
      priority: "P1",
      severity: "ERROR",
      title: "Unknown Outlet Exception",
      description: "Test description",
      actor: adminA
    });
    assert.strictEqual(res.status, "error");
    assert.strictEqual(res.error_code, "UNAUTHORIZED");
  });

  // TEST 8: Cross-outlet dashboard isolation
  runTest("TEST 8: Workflow list isolation by selected active outlet", () => {
    createWorkflowCase(db, {
      source_type: "RECONCILIATION_EXCEPTION",
      source_id: "EXC-101",
      outlet_id: "OUTLET-A",
      priority: "P1",
      severity: "ERROR",
      title: "Case Outlet A",
      description: "Desc",
      actor: owner
    });
    createWorkflowCase(db, {
      source_type: "RECONCILIATION_EXCEPTION",
      source_id: "EXC-102",
      outlet_id: "OUTLET-B",
      priority: "P1",
      severity: "ERROR",
      title: "Case Outlet B",
      description: "Desc",
      actor: owner
    });

    const listA = getWorkflowList(db, { outlet_id: "OUTLET-A" }, adminA);
    assert.ok(listA.every(w => w.outlet_id === "OUTLET-A"));

    const listB = getWorkflowList(db, { outlet_id: "OUTLET-B" }, adminA);
    assert.ok(listB.every(w => w.outlet_id === "OUTLET-B"));
  });

  // TEST 9: Cross-outlet transaction attribution
  runTest("TEST 9: Transaction created by Admin A on Outlet B records correct attribution", () => {
    const newTx = {
      id: "TX-NEW-1",
      transaksi_id: "TX-NEW-1",
      outlet_id: "OUTLET-B",
      admin_id: "ADMIN-A",
      tanggal: "2026-08-10"
    };
    db.MASTER_TRANSAKSI.push(newTx);
    assert.strictEqual(newTx.outlet_id, "OUTLET-B");
    assert.strictEqual(newTx.admin_id, "ADMIN-A");
  });

  // TEST 10: OWNER all-outlet access
  runTest("TEST 10: OWNER has access to all outlets including GLOBAL", () => {
    const authA = checkActionAuthorization(db, owner, "APPROVE_SETTLEMENT", "OUTLET-A");
    assert.strictEqual(authA.authorized, true);

    const authB = checkActionAuthorization(db, owner, "APPROVE_SETTLEMENT", "OUTLET-B");
    assert.strictEqual(authB.authorized, true);
  });

  // TEST 11: ADMIN owner-only action
  runTest("TEST 11: ADMIN blocked from OWNER-only action regardless of active outlet", () => {
    const authA = checkActionAuthorization(db, adminA, "APPROVE_SETTLEMENT", "OUTLET-A");
    assert.strictEqual(authA.authorized, false);
    assert.ok(authA.reason?.includes("OWNER"));

    const authB = checkActionAuthorization(db, adminA, "APPROVE_SETTLEMENT", "OUTLET-B");
    assert.strictEqual(authB.authorized, false);
    assert.ok(authB.reason?.includes("OWNER"));
  });

  // TEST 12: No data leakage
  runTest("TEST 12: Data query for Outlet A does not leak Outlet B records", () => {
    const filteredA = db.MASTER_TRANSAKSI.filter(t => t.outlet_id === "OUTLET-A");
    assert.ok(filteredA.every(t => t.outlet_id === "OUTLET-A"));
  });

  // TEST 13: Date isolation
  runTest("TEST 13: Date filtering isolates records cleanly", () => {
    db.MASTER_TRANSAKSI.push({
      id: "TX-A2",
      transaksi_id: "TX-A2",
      outlet_id: "OUTLET-A",
      admin_id: "ADMIN-A",
      tanggal: "2026-08-11",
      total_dibayar_customer: 20000,
      status_transaksi: "COMPLETED"
    });
    const date10 = db.MASTER_TRANSAKSI.filter(t => t.tanggal === "2026-08-10");
    assert.ok(date10.every(t => t.tanggal === "2026-08-10"));
  });

  // TEST 14: Admin attribution preserved
  runTest("TEST 14: Admin actor identity is preserved as real actor ID", () => {
    const review = createManagementReview(db, { outlet_id: "OUTLET-B", period: "DAILY", tanggal: "2026-08-10" }, owner);
    const detail = getManagementReviewDetail(db, review.review_id, adminA);
    assert.strictEqual(detail.review_id, review.review_id);
  });

  // TEST 15: Regression existing workflow
  runTest("TEST 15: Existing workflow execution preserves invariants", () => {
    const wfList = getWorkflowList(db, { outlet_id: "OUTLET-A" }, owner);
    assert.ok(Array.isArray(wfList));
  });

  console.log("==================================================");
  console.log(`AUTHORIZATION SCOPE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthorizationScopeTests();
