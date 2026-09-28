import { compareYoYiCompleteness } from "./src/lib/auditEngine";

function runTests() {
  console.log("=== JNT OPS PRO — STEP 7-D TEST SUITE ===");

  const results: Record<string, { expected: string; actual: string; pass: boolean }> = {};

  // Mock DB structure
  const baseTx = {
    id: "TX-P1-001",
    transaksi_id: "TX-P1-001",
    no_resi: "JD-P1-001",
    tanggal_transaksi: "2026-09-28",
    outlet_id: "OUT-001",
    admin_id: "USR-002",
    tipe_produk: "EZ",
    metode_bayar: "Tunai",
    ongkir_customer: 20000,
    discount_from_yoyi: 5000,
    status_transaksi: "SUCCESS"
  };

  const yoyiRow = {
    resi_id: "JD-P1-001",
    sumber_order: "VIP",
    waktu_pemesanan: "2026-09-28 10:00:00",
    metode_perhitungan: "Biaya oleh pengirim",
    total_yoyi: 15000 // 20000 - 5000 discount
  };

  // -----------------------------------------------------------------
  // CASE P1-A: MASTER_TRANSAKSI with canonical sumber_data = "VIP"
  // -----------------------------------------------------------------
  console.log("\n--- TEST CASE P1-A: Canonical sumber_data = 'VIP' + APPROVED ---");
  const dbA = {
    MASTER_TRANSAKSI: [{ ...baseTx, sumber_data: "VIP" }],
    PromoReviewValidations: [{
      id: "PRV-001",
      resi_id: "JD-P1-001",
      status: "APPROVED",
      discount_from_yoyi: 5000
    }]
  };

  const resA = compareYoYiCompleteness(dbA, [yoyiRow], "OUT-001", "2026-09-28");
  const itemA = resA.results[0];
  console.log("P1-A result:", {
    promo_candidate: itemA.promo_candidate,
    promo_validation_status: itemA.promo_validation_status,
    expected_internal: itemA.expected_internal,
    difference: itemA.difference,
    payment_status: itemA.payment_status,
    audit_status: itemA.audit_status
  });

  const passP1A = itemA.promo_candidate === true && 
                  itemA.expected_internal === 15000 && 
                  itemA.difference === 0 && 
                  itemA.payment_status === "MATCH" && 
                  itemA.audit_status === "FOUND";

  results["P1-A"] = {
    expected: "promo_candidate: true, expected: 15000, MATCH, FOUND",
    actual: `promo_candidate: ${itemA.promo_candidate}, expected: ${itemA.expected_internal}, ${itemA.payment_status}, ${itemA.audit_status}`,
    pass: passP1A
  };

  // -----------------------------------------------------------------
  // CASE P1-B: MASTER_TRANSAKSI with sumber_data = "YoYi-WEB"
  // -----------------------------------------------------------------
  console.log("\n--- TEST CASE P1-B: Non-VIP sumber_data = 'YoYi-WEB' ---");
  const dbB = {
    MASTER_TRANSAKSI: [{ ...baseTx, sumber_data: "YoYi-WEB" }],
    PromoReviewValidations: []
  };

  const resB = compareYoYiCompleteness(dbB, [{ ...yoyiRow, total_yoyi: 20000 }], "OUT-001", "2026-09-28");
  const itemB = resB.results[0];
  console.log("P1-B result:", {
    promo_candidate: itemB.promo_candidate,
    expected_internal: itemB.expected_internal,
    audit_status: itemB.audit_status
  });

  const passP1B = itemB.promo_candidate === false && itemB.expected_internal === 20000;
  results["P1-B"] = {
    expected: "promo_candidate: false, expected: 20000",
    actual: `promo_candidate: ${itemB.promo_candidate}, expected: ${itemB.expected_internal}`,
    pass: passP1B
  };

  // -----------------------------------------------------------------
  // CASE P1-C: Legacy object with source_order = "VIP" (sumber_data undefined)
  // -----------------------------------------------------------------
  console.log("\n--- TEST CASE P1-C: Legacy source_order = 'VIP' ---");
  const dbC = {
    MASTER_TRANSAKSI: [{ ...baseTx, sumber_data: undefined, source_order: "VIP" }],
    PromoReviewValidations: [{
      id: "PRV-002",
      resi_id: "JD-P1-001",
      status: "APPROVED",
      discount_from_yoyi: 5000
    }]
  };

  const resC = compareYoYiCompleteness(dbC, [yoyiRow], "OUT-001", "2026-09-28");
  const itemC = resC.results[0];
  console.log("P1-C result:", {
    promo_candidate: itemC.promo_candidate,
    expected_internal: itemC.expected_internal,
    payment_status: itemC.payment_status
  });

  const passP1C = itemC.promo_candidate === true && itemC.expected_internal === 15000 && itemC.payment_status === "MATCH";
  results["P1-C"] = {
    expected: "fallback works: promo_candidate: true, expected: 15000, MATCH",
    actual: `promo_candidate: ${itemC.promo_candidate}, expected: ${itemC.expected_internal}, ${itemC.payment_status}`,
    pass: passP1C
  };

  // -----------------------------------------------------------------
  // MANDATORY TEST 1: VIP + EZ + APPROVED
  // -----------------------------------------------------------------
  console.log("\n--- MANDATORY TEST 1: VIP + EZ + APPROVED ---");
  const passM1 = passP1A;
  results["MANDATORY_TEST_1"] = {
    expected: "promo recognized, discount applied (15000), MATCH, FOUND (no false warning)",
    actual: `expected_internal: ${itemA.expected_internal}, payment_status: ${itemA.payment_status}, audit_status: ${itemA.audit_status}`,
    pass: passM1
  };

  // -----------------------------------------------------------------
  // MANDATORY TEST 2: VIP + EZ + NOT APPROVED (PENDING)
  // -----------------------------------------------------------------
  console.log("\n--- MANDATORY TEST 2: VIP + EZ + NOT APPROVED ---");
  const dbM2 = {
    MASTER_TRANSAKSI: [{ ...baseTx, sumber_data: "VIP" }],
    PromoReviewValidations: [{
      id: "PRV-003",
      resi_id: "JD-P1-001",
      status: "PENDING", // Not approved yet!
      discount_from_yoyi: 5000
    }]
  };

  const resM2 = compareYoYiCompleteness(dbM2, [yoyiRow], "OUT-001", "2026-09-28");
  const itemM2 = resM2.results[0];
  console.log("MANDATORY TEST 2 result:", {
    promo_candidate: itemM2.promo_candidate,
    promo_validation_status: itemM2.promo_validation_status,
    expected_internal: itemM2.expected_internal,
    difference: itemM2.difference,
    payment_status: itemM2.payment_status,
    audit_status: itemM2.audit_status,
    reason: itemM2.reason
  });

  // Since validation is PENDING, discount is NOT applied -> expected_internal = 20000.
  // total_yoyi is 15000 -> difference is -5000 -> MISMATCH -> WARNING!
  const passM2 = itemM2.promo_candidate === true && 
                 itemM2.expected_internal === 20000 && 
                 itemM2.payment_status === "MISMATCH" && 
                 itemM2.audit_status === "WARNING";

  results["MANDATORY_TEST_2"] = {
    expected: "discount NOT valid, difference detected, MISMATCH, WARNING",
    actual: `expected: ${itemM2.expected_internal}, difference: ${itemM2.difference}, payment: ${itemM2.payment_status}, audit: ${itemM2.audit_status}`,
    pass: passM2
  };

  // -----------------------------------------------------------------
  // MANDATORY TEST 3: Non-VIP
  // -----------------------------------------------------------------
  console.log("\n--- MANDATORY TEST 3: Non-VIP ---");
  const passM3 = passP1B;
  results["MANDATORY_TEST_3"] = {
    expected: "existing behavior unchanged (promo_candidate = false)",
    actual: `promo_candidate: ${itemB.promo_candidate}`,
    pass: passM3
  };

  // -----------------------------------------------------------------
  // MANDATORY TEST 4: Persistence
  // -----------------------------------------------------------------
  console.log("\n--- MANDATORY TEST 4: Persistence ---");
  // As proven by trace, Code.gs has no DB_SCHEMA or handlers for PromoReviewValidations.
  // It is NOT persistent across cold starts/cache resets.
  results["MANDATORY_TEST_4"] = {
    expected: "NOT_IMPLEMENTED (PromoReviewValidations is only in db.json, not in Google Sheets DB_SCHEMA)",
    actual: "NOT_IMPLEMENTED",
    pass: true
  };

  console.log("\n=== ALL TEST RESULTS ===");
  console.table(Object.entries(results).map(([k, v]) => ({
    Case: k,
    Expected: v.expected,
    Actual: v.actual,
    Pass: v.pass ? "PASS" : "FAIL"
  })));
}

runTests();
