import { 
  logAuditEvent, 
  recordAuditEvent, 
  getAuditTrail, 
  reconstructTransactionHistory,
  redactSensitiveData 
} from "./src/lib/auditTrailEngine";
import { autoUpsertMasterTransaksiAndPengiriman, autoUpsertCustomerAndAddressBook } from "./server";

function runTests() {
  console.log("=========================================");
  console.log("RUNNING PHASE 27 AUDIT TRAIL TEST SUITE");
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

  // Mock DB state
  const mockDb: any = {
    MASTER_CUSTOMER: [],
    MASTER_PENGIRIM: [],
    MASTER_PENERIMA: [],
    MASTER_TRANSAKSI: [],
    MASTER_PENGIRIMAN: [],
    Master_Setoran: [],
    AuditLogs: []
  };

  // TEST 1: Create transaction -> audit event created
  const txId1 = "TRX-P27-001";
  const res1 = autoUpsertMasterTransaksiAndPengiriman(mockDb, {
    transaksi_id: txId1,
    status_transaksi: "DRAFT",
    admin_id: "ADM-001",
    admin_name: "Admin Alpha",
    outlet_id: "OUT-001",
    correlation_id: "CORR-001"
  });
  const auditTx1 = getAuditTrail(mockDb, { transaksi_id: txId1 });
  assert(auditTx1.length > 0 && auditTx1.some(a => a.event_type === "TRANSACTION_CREATED" || a.action === "UPSERT"), "TEST 1: Create transaction -> audit event created");

  // TEST 2: Update transaction -> BEFORE/AFTER recorded
  logAuditEvent(mockDb, {
    actor_id: "ADM-001",
    event_type: "TRANSACTION_UPDATED",
    entity_type: "TRANSACTION",
    transaksi_id: txId1,
    action: "UPDATE_TRANSACTION",
    before: { ongkir_customer: 10000, status: "DRAFT" },
    after: { ongkir_customer: 15000, status: "DRAFT" },
    result: "SUCCESS",
    correlation_id: "CORR-002"
  });
  const auditTx2 = getAuditTrail(mockDb, { correlation_id: "CORR-002" });
  assert(auditTx2.length > 0 && auditTx2[0].before?.ongkir_customer === 10000 && auditTx2[0].after?.ongkir_customer === 15000, "TEST 2: Update transaction -> BEFORE/AFTER recorded");

  // TEST 3: Lifecycle transition valid -> event SUCCESS
  const res3 = autoUpsertMasterTransaksiAndPengiriman(mockDb, {
    transaksi_id: txId1,
    status_transaksi: "WAITING_PAYMENT",
    admin_id: "ADM-001",
    correlation_id: "CORR-003"
  });
  const auditTx3 = getAuditTrail(mockDb, { correlation_id: "CORR-003" });
  assert(auditTx3.length > 0 && auditTx3.some(a => a.event_type === "LIFECYCLE_TRANSITION" && a.result === "SUCCESS"), "TEST 3: Lifecycle transition valid -> event SUCCESS");

  // TEST 4: Lifecycle transition invalid -> event REJECTED
  const res4 = autoUpsertMasterTransaksiAndPengiriman(mockDb, {
    transaksi_id: txId1,
    status_transaksi: "DRAFT", // Invalid transition back from WAITING_PAYMENT to DRAFT
    admin_id: "ADM-001",
    correlation_id: "CORR-004"
  });
  const auditTx4 = getAuditTrail(mockDb, { correlation_id: "CORR-004" });
  assert(!res4.success && auditTx4.some(a => a.event_type === "LIFECYCLE_REJECTED" && a.result === "REJECTED"), "TEST 4: Lifecycle transition invalid -> event REJECTED");

  // TEST 5: Transaction cancelled -> event CANCELLED
  logAuditEvent(mockDb, {
    actor_id: "ADM-001",
    event_type: "TRANSACTION_CANCELLED",
    entity_type: "TRANSACTION",
    transaksi_id: txId1,
    action: "CANCEL_TRANSACTION",
    previous_status: "WAITING_PAYMENT",
    new_status: "CANCELLED",
    result: "SUCCESS",
    reason: "User requested cancellation"
  });
  const auditTx5 = getAuditTrail(mockDb, { transaksi_id: txId1, event_type: "TRANSACTION_CANCELLED" });
  assert(auditTx5.length > 0 && auditTx5[0].result === "SUCCESS", "TEST 5: Transaction cancelled -> event CANCELLED");

  // TEST 6: Customer created -> CUSTOMER_CREATED
  autoUpsertCustomerAndAddressBook(mockDb, {
    nama_pengirim: "Budi Santoso",
    hp_pengirim: "081234567890",
    alamat_pengirim: "Jl. Merdeka 10",
    nama_penerima: "Siti Rahma",
    hp_penerima: "089876543210",
    alamat_penerima: "Jl. Sudirman 20",
    correlation_id: "CORR-CUST-001"
  });
  const auditCust6 = getAuditTrail(mockDb, { correlation_id: "CORR-CUST-001", event_type: "CUSTOMER_CREATED" });
  assert(auditCust6.length > 0, "TEST 6: Customer created -> CUSTOMER_CREATED");

  // TEST 7: Customer updated -> BEFORE/AFTER
  logAuditEvent(mockDb, {
    actor_id: "ADM-001",
    event_type: "CUSTOMER_UPDATED",
    entity_type: "CUSTOMER",
    entity_id: "CUS000001",
    action: "UPDATE_CUSTOMER",
    before: { nama: "Budi Santoso", hp: "081234567890" },
    after: { nama: "Budi Santoso updated", hp: "081234567890" },
    result: "SUCCESS"
  });
  const auditCust7 = getAuditTrail(mockDb, { event_type: "CUSTOMER_UPDATED" });
  assert(auditCust7.length > 0 && auditCust7[0].before?.nama === "Budi Santoso", "TEST 7: Customer updated -> BEFORE/AFTER");

  // TEST 8: Import preview -> IMPORT_PREVIEW
  logAuditEvent(mockDb, {
    actor_id: "ADM-001",
    event_type: "IMPORT_PREVIEW",
    entity_type: "IMPORT",
    import_id: "IMP-2026-001",
    action: "PREVIEW_IMPORT",
    result: "SUCCESS",
    metadata: { total_rows: 50 }
  });
  const auditImp8 = getAuditTrail(mockDb, { import_id: "IMP-2026-001", event_type: "IMPORT_PREVIEW" });
  assert(auditImp8.length > 0, "TEST 8: Import preview -> IMPORT_PREVIEW");

  // TEST 9: Import completed -> IMPORT_COMPLETED
  logAuditEvent(mockDb, {
    actor_id: "ADM-001",
    event_type: "IMPORT_COMPLETED",
    entity_type: "IMPORT",
    import_id: "IMP-2026-001",
    action: "COMPLETE_IMPORT",
    result: "SUCCESS",
    metadata: { imported_count: 50 }
  });
  const auditImp9 = getAuditTrail(mockDb, { import_id: "IMP-2026-001", event_type: "IMPORT_COMPLETED" });
  assert(auditImp9.length > 0, "TEST 9: Import completed -> IMPORT_COMPLETED");

  // TEST 10: Import failed -> IMPORT_FAILED
  logAuditEvent(mockDb, {
    actor_id: "ADM-001",
    event_type: "IMPORT_FAILED",
    entity_type: "IMPORT",
    import_id: "IMP-2026-002",
    action: "FAIL_IMPORT",
    result: "FAILED",
    reason: "Invalid file header format",
    error_code: "HEADER_MISMATCH"
  });
  const auditImp10 = getAuditTrail(mockDb, { import_id: "IMP-2026-002", event_type: "IMPORT_FAILED" });
  assert(auditImp10.length > 0 && auditImp10[0].result === "FAILED", "TEST 10: Import failed -> IMPORT_FAILED");

  // TEST 11: Shipment created -> SHIPMENT_CREATED
  logAuditEvent(mockDb, {
    actor_id: "ADM-001",
    event_type: "SHIPMENT_CREATED",
    entity_type: "SHIPMENT",
    entity_id: "SHP-000001",
    transaksi_id: txId1,
    action: "CREATE_SHIPMENT",
    result: "SUCCESS",
    after: { ekspedisi: "J&T Express", status: "READY_PICKUP" }
  });
  const auditShip11 = getAuditTrail(mockDb, { transaksi_id: txId1, event_type: "SHIPMENT_CREATED" });
  assert(auditShip11.length > 0, "TEST 11: Shipment created -> SHIPMENT_CREATED");

  // TEST 12: Setoran created -> SETORAN_CREATED
  logAuditEvent(mockDb, {
    actor_id: "ADM-001",
    event_type: "SETORAN_CREATED",
    entity_type: "SETORAN",
    entity_id: "SET-1001",
    action: "CREATE_SETORAN",
    result: "SUCCESS",
    after: { total: 500000 }
  });
  const auditSet12 = getAuditTrail(mockDb, { entity_id: "SET-1001", event_type: "SETORAN_CREATED" });
  assert(auditSet12.length > 0, "TEST 12: Setoran created -> SETORAN_CREATED");

  // TEST 13: Setoran approved -> SETORAN_APPROVED
  logAuditEvent(mockDb, {
    actor_id: "OWNER-001",
    actor_role: "OWNER",
    event_type: "SETORAN_APPROVED",
    entity_type: "SETORAN",
    entity_id: "SET-1001",
    action: "APPROVE_SETORAN",
    result: "SUCCESS"
  });
  const auditSet13 = getAuditTrail(mockDb, { entity_id: "SET-1001", event_type: "SETORAN_APPROVED" });
  assert(auditSet13.length > 0 && auditSet13[0].actor_role === "OWNER", "TEST 13: Setoran approved -> SETORAN_APPROVED");

  // TEST 14: Audit Engine execution -> AUDIT_EXECUTED
  logAuditEvent(mockDb, {
    actor_id: "SYSTEM",
    event_type: "AUDIT_EXECUTED",
    entity_type: "TRANSACTION",
    transaksi_id: txId1,
    action: "RUN_AUDIT_ENGINE",
    result: "SUCCESS",
    metadata: { score: 100, status: "VALID" }
  });
  const auditEng14 = getAuditTrail(mockDb, { transaksi_id: txId1, event_type: "AUDIT_EXECUTED" });
  assert(auditEng14.length > 0, "TEST 14: Audit Engine execution -> AUDIT_EXECUTED");

  // TEST 15: Failed operation -> FAILED audit event
  logAuditEvent(mockDb, {
    actor_id: "ADM-001",
    event_type: "TRANSACTION_UPDATED",
    entity_type: "TRANSACTION",
    transaksi_id: txId1,
    action: "UPDATE_TRANSACTION",
    result: "FAILED",
    error_code: "DB_WRITE_ERROR",
    reason: "Disk quota exceeded"
  });
  const auditFail15 = getAuditTrail(mockDb, { transaksi_id: txId1, result: "FAILED" });
  assert(auditFail15.length > 0 && auditFail15[0].error_code === "DB_WRITE_ERROR", "TEST 15: Failed operation -> FAILED audit event");

  // TEST 16: Duplicate request -> no duplicate audit event
  const countBefore = mockDb.AuditLogs.length;
  logAuditEvent(mockDb, {
    actor_id: "ADM-001",
    event_type: "DUPLICATE_TEST_EVENT",
    entity_type: "TEST",
    action: "TEST_ACTION",
    result: "SUCCESS",
    correlation_id: "UNIQUE-CORR-123"
  });
  const countMiddle = mockDb.AuditLogs.length;
  // Re-submit identical event
  logAuditEvent(mockDb, {
    actor_id: "ADM-001",
    event_type: "DUPLICATE_TEST_EVENT",
    entity_type: "TEST",
    action: "TEST_ACTION",
    result: "SUCCESS",
    correlation_id: "UNIQUE-CORR-123"
  });
  const countAfter = mockDb.AuditLogs.length;
  assert(countMiddle === countBefore + 1 && countAfter === countMiddle, "TEST 16: Duplicate request -> no duplicate audit event");

  // TEST 17: Sensitive data redaction
  const sanitized = redactSensitiveData({
    username: "admin",
    password: "secret_password123",
    api_key: "KEY-999",
    nested: {
      access_token: "TOKEN-XYZ",
      public_field: "allowed_value"
    }
  });
  assert(
    sanitized.password === "[REDACTED]" && 
    sanitized.api_key === "[REDACTED]" && 
    sanitized.nested.access_token === "[REDACTED]" && 
    sanitized.nested.public_field === "allowed_value",
    "TEST 17: Sensitive data redaction"
  );

  // TEST 18: Transaction timeline reconstruction
  const history = reconstructTransactionHistory(mockDb, txId1);
  assert(Array.isArray(history) && history.length > 0, "TEST 18: Transaction timeline reconstruction");

  // TEST 19: Audit query by transaksi_id
  const qTx = getAuditTrail(mockDb, { transaksi_id: txId1 });
  assert(qTx.length > 0 && qTx.every(l => l.transaksi_id === txId1 || l.entity_id === txId1), "TEST 19: Audit query by transaksi_id");

  // TEST 20: Audit query by import_id
  const qImp = getAuditTrail(mockDb, { import_id: "IMP-2026-001" });
  assert(qImp.length > 0 && qImp.every(l => l.import_id === "IMP-2026-001" || l.entity_id === "IMP-2026-001"), "TEST 20: Audit query by import_id");

  console.log("\n=========================================");
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=========================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
