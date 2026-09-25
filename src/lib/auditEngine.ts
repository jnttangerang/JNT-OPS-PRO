/**
 * PHASE 26 — AUDIT ENGINE
 * Single Source of Truth for evaluating transaction quality, consistency, eligibility, and risk.
 *
 * - Does NOT calculate money (delegates strictly to financialEngine.ts).
 * - Does NOT modify database (pure evaluation functions, no persistence side-effects).
 * - Reuses Operational Engine & Financial Engine.
 */

import {
  calculateFinancialSummary,
  isTransactionValidForFinance
} from "./financialEngine";
import { extractBusinessDate, getWIBDate } from "../utils/dateUtils";

import {
  normalizeLifecycleStatus,
  validateLifecycle,
  checkDuplicateResi,
  checkDuplicateCustomer,
  checkDuplicateTransaction,
  checkDuplicateImport
} from "./operationalEngine";

export type AuditStatus = "VALID" | "WARNING" | "ERROR" | "CRITICAL";

export type ExceptionDomain = "FINANCIAL" | "OPERATIONAL" | "COMPLIANCE" | "NONE";

export interface AuditEligibility {
  countedInDashboard: boolean;
  countedInFinance: boolean;
  countedInTarget: boolean;
  countedInAudit: boolean;
  countedInReport: boolean;
}

export interface AuditResult {
  status: AuditStatus;
  exception_domain: ExceptionDomain;
  score: number;
  issues: string[];
  warnings: string[];
  errors: string[];
  recommendations: string[];
  eligibility: AuditEligibility;
}

// ==========================================
// SINGLE TRANSACTION AUDIT ENGINE
// ==========================================

export function auditTransaction(db: any, txIdOrObj: any): AuditResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const recommendations: string[] = [];

  // Resolve transaction object
  let tx: any = null;
  if (typeof txIdOrObj === "string") {
    tx = (db.MASTER_TRANSAKSI || []).find(
      (t: any) => t.id === txIdOrObj || t.transaksi_id === txIdOrObj || t.no_resi === txIdOrObj
    );
  } else if (txIdOrObj && typeof txIdOrObj === "object") {
    tx = txIdOrObj;
  }

  if (!tx) {
    return {
      status: "CRITICAL",
      exception_domain: "OPERATIONAL",
      score: 0,
      issues: ["Transaksi tidak ditemukan dalam database"],
      warnings: [],
      errors: ["Transaksi tidak ditemukan dalam database"],
      recommendations: ["Pastikan ID transaksi atau nomor resi terdaftar di MASTER_TRANSAKSI"],
      eligibility: {
        countedInDashboard: false,
        countedInFinance: false,
        countedInTarget: false,
        countedInAudit: false,
        countedInReport: false
      }
    };
  }

  const txId = tx.id || tx.transaksi_id || "";

  // ------------------------------------------
  // PART 1: Audit Transaction (Required Fields)
  // ------------------------------------------
  const missingTxFields: string[] = [];
  if (!txId) missingTxFields.push("transaksi_id");
  if (!tx.outlet_id && !tx.outlet) missingTxFields.push("outlet");
  if (!tx.admin_id && !tx.admin) missingTxFields.push("admin");
  if (!tx.tanggal_transaksi && !tx.tanggal && !tx.created_at) missingTxFields.push("tanggal");
  if (!tx.no_resi && !tx.resi_id) missingTxFields.push("resi");

  if (missingTxFields.length > 0) {
    errors.push(`Field transaksi wajib belum lengkap: ${missingTxFields.join(", ")}`);
    recommendations.push("Lengkapi Data Transaksi (Outlet/Admin/Tanggal/Resi)");
  }

  // ------------------------------------------
  // PART 2: Audit Customer
  // ------------------------------------------
  const customers = db.Master_Pelanggan || db.Customers || [];
  const pengirimId = tx.pengirim_id || "";
  const penerimaId = tx.penerima_id || "";

  const senderName = (tx.snapshot_nama_pengirim || tx.nama_pengirim || tx.pengirim || "").toString().trim();
  const recipientName = (tx.snapshot_nama_penerima || tx.nama_penerima || tx.penerima || "").toString().trim();
  const senderPhone = (tx.snapshot_hp_pengirim || tx.hp_pengirim || tx.telepon_pengirim || "").toString().trim();
  const recipientPhone = (tx.snapshot_hp_penerima || tx.hp_penerima || tx.telepon_penerima || "").toString().trim();

  const pengirimExists = pengirimId
    ? customers.some((c: any) => c.id === pengirimId || c.pelanggan_id === pengirimId)
    : (!!senderName || !!senderPhone);

  const penerimaExists = penerimaId
    ? customers.some((c: any) => c.id === penerimaId || c.pelanggan_id === penerimaId)
    : (!!recipientName || !!recipientPhone);

  const hasSenderSnap = !!senderName;
  const hasRecipientSnap = !!recipientName;

  if (pengirimId && !customers.some((c: any) => c.id === pengirimId || c.pelanggan_id === pengirimId)) {
    errors.push(`Pengirim ID ('${pengirimId}') tidak valid atau tidak terdaftar di Master Pelanggan`);
    recommendations.push("Lengkapi Pengirim & Daftarkan di Master Pelanggan");
  } else if (!pengirimId && !senderName && !senderPhone) {
    errors.push("Data identitas pengirim (ID/Nama/Telepon) tidak ditemukan");
    recommendations.push("Lengkapi Data Pengirim");
  } else if (!pengirimId) {
    warnings.push("Pengirim belum memiliki ID terdaftar di Master Pelanggan");
    recommendations.push("Daftarkan Pengirim di Master Pelanggan");
  }

  if (penerimaId && !customers.some((c: any) => c.id === penerimaId || c.pelanggan_id === penerimaId)) {
    errors.push(`Penerima ID ('${penerimaId}') tidak valid atau tidak terdaftar di Master Pelanggan`);
    recommendations.push("Lengkapi Penerima & Daftarkan di Master Pelanggan");
  } else if (!penerimaId && !recipientName && !recipientPhone) {
    errors.push("Data identitas penerima (ID/Nama/Telepon) tidak ditemukan");
    recommendations.push("Lengkapi Data Penerima");
  } else if (!penerimaId) {
    warnings.push("Penerima belum memiliki ID terdaftar di Master Pelanggan");
    recommendations.push("Daftarkan Penerima di Master Pelanggan");
  }

  if (!hasSenderSnap || !hasRecipientSnap) {
    warnings.push("Snapshot data pengirim atau penerima kurang lengkap pada transaksi");
  }

  // ------------------------------------------
  // PART 3: Audit Shipment
  // ------------------------------------------
  const shipments = db.MASTER_PENGIRIMAN || [];
  const shipmentRecord = shipments.find((s: any) => (s.transaksi_id || s.id) === txId);

  // Check if MASTER_PENGIRIMAN contains orphan rows without transaksi_id
  const hasOrphanShipment = shipments.some((s: any) => !s.transaksi_id && !s.id);
  if (hasOrphanShipment) {
    errors.push("Ditemukan record pengiriman tanpa transaksi_id di MASTER_PENGIRIMAN");
  }

  if (!shipmentRecord) {
    warnings.push("Data pengiriman tidak ditemukan di MASTER_PENGIRIMAN");
  }

  // ------------------------------------------
  // PART 4: Audit Financial (Delegated to financialEngine)
  // ------------------------------------------
  const finSummary = calculateFinancialSummary(tx);
  const finIssues: string[] = [];

  if (isNaN(finSummary.customer_payment) || finSummary.customer_payment === undefined || finSummary.customer_payment < 0) {
    finIssues.push(`customer_payment tidak valid: ${finSummary.customer_payment}`);
  }
  if (isNaN(finSummary.owner_deposit) || finSummary.owner_deposit === undefined || finSummary.owner_deposit < 0) {
    finIssues.push(`owner_deposit tidak valid: ${finSummary.owner_deposit}`);
  }
  if (isNaN(finSummary.outlet_cash) || finSummary.outlet_cash === undefined || finSummary.outlet_cash < 0) {
    finIssues.push(`outlet_cash tidak valid: ${finSummary.outlet_cash}`);
  }
  if (isNaN(finSummary.rounding) || finSummary.rounding === undefined) {
    finIssues.push(`rounding tidak valid: ${finSummary.rounding}`);
  }

  if (finIssues.length > 0) {
    errors.push(`Kalkulasi finansial bermasalah: ${finIssues.join("; ")}`);
  }

  // ------------------------------------------
  // PART 5: Audit Lifecycle (Delegated to operationalEngine)
  // ------------------------------------------
  const lifecycleVal = validateLifecycle(tx);
  if (!lifecycleVal.valid) {
    errors.push(`Lifecycle violation: ${lifecycleVal.message}`);
  }

  // ------------------------------------------
  // PART 6: Audit Duplicate (Delegated to operationalEngine)
  // ------------------------------------------
  const noResi = tx.no_resi || tx.resi_id || "";
  if (noResi) {
    const dupResi = checkDuplicateResi(db, noResi, txId);
    if (dupResi.duplicate) {
      errors.push(`DUPLICATE DETECTED: Nomor resi '${noResi}' digunakan oleh transaksi lain (${dupResi.existing?.transaksi_id || dupResi.existing?.id})`);
      recommendations.push("Review Duplicate Resi");
    }
  }

  if (tx.import_id) {
    const dupImp = checkDuplicateImport(db, tx.import_id);
    if (dupImp.duplicate && dupImp.existing?.id !== txId) {
      warnings.push(`Import ID '${tx.import_id}' sudah pernah di-import sebelumnya`);
    }
  }

  // ------------------------------------------
  // PART 7: Audit Photo
  // ------------------------------------------
  const hasFotoPaket = !!(tx.foto_barang || tx.foto_paket_url);
  const hasFotoResi = !!(tx.foto_resi || tx.foto_resi_url);

  if (!hasFotoPaket || !hasFotoResi) {
    const missingPhotos: string[] = [];
    if (!hasFotoPaket) missingPhotos.push("Foto Paket");
    if (!hasFotoResi) missingPhotos.push("Foto Resi");
    warnings.push(`Foto pendukung belum diunggah: ${missingPhotos.join(", ")}`);
    recommendations.push("Upload Foto Paket & Resi");
  }

  // ------------------------------------------
  // PART 8: Audit Sync
  // ------------------------------------------
  const syncStatus = (tx.status_sync || "LOCAL").toUpperCase();
  if (syncStatus === "FAILED") {
    errors.push("Sinkronisasi data gagal (status_sync = FAILED)");
    recommendations.push("Sinkronkan Data Ke Server / Cloud");
  } else if (syncStatus === "PENDING") {
    warnings.push("Sinkronisasi data masih pending (status_sync = PENDING)");
    recommendations.push("Sinkronkan Data Ke Server / Cloud");
  }

  // ------------------------------------------
  // PART 9: Audit Approval / Settlement
  // ------------------------------------------
  const statusTx = normalizeLifecycleStatus(tx.status_transaksi || tx.status);
  const statusSetoran = (tx.status_setoran || "PENDING").toUpperCase();

  if ((statusTx === "PAID" || statusTx === "SELESAI") && statusSetoran === "PENDING") {
    warnings.push("Transaksi Lunas/Selesai tetapi setoran outlet belum di-approve oleh Owner");
    recommendations.push("Approval Setoran oleh Owner");
  } else if (statusSetoran === "DITOLAK" || statusSetoran === "REJECTED") {
    errors.push("Setoran transaksi ditolak oleh Owner");
    recommendations.push("Perbaiki Data Setoran & Ajukan Ulang Approval");
  }

  // ------------------------------------------
  // PART 10: Dashboard & Finance Eligibility
  // ------------------------------------------
  const isCancelled = statusTx === "CANCELLED" || statusTx === "BATAL";
  const isValidFinance = isTransactionValidForFinance(tx);

  const eligibility: AuditEligibility = {
    countedInDashboard: !isCancelled,
    countedInFinance: !isCancelled && isValidFinance,
    countedInTarget: !isCancelled && isValidFinance,
    countedInAudit: true,
    countedInReport: !isCancelled && isValidFinance
  };

  // ------------------------------------------
  // PART 11 & PART 12: Status, Score, Domain & Recommendations
  // ------------------------------------------
  let status: AuditStatus = "VALID";
  let exception_domain: ExceptionDomain = "NONE";
  let score = 100;
  const allIssues = [...errors, ...warnings];

  // Check CRITICAL conditions:
  // - Customer completely missing or invalid non-existent ID provided
  // - Duplicate resi
  const isCritical =
    ((pengirimId && !customers.some((c: any) => c.id === pengirimId || c.pelanggan_id === pengirimId)) ||
     (penerimaId && !customers.some((c: any) => c.id === penerimaId || c.pelanggan_id === penerimaId)) ||
     (!pengirimId && !senderName && !senderPhone) ||
     (!penerimaId && !recipientName && !recipientPhone)) ||
    errors.some((e) => e.includes("DUPLICATE DETECTED"));

  if (isCritical) {
    status = "CRITICAL";
    score = 0;
  } else if (errors.length > 0) {
    status = "ERROR";
    score = Math.max(10, 50 - (errors.length - 1) * 10 - warnings.length * 5);
  } else if (warnings.length > 0) {
    status = "WARNING";
    score = Math.max(60, 100 - warnings.length * 10);
  } else {
    status = "VALID";
    score = 100;
  }
  
  // Determine Exception Domain
  if (status !== "VALID") {
    if (finIssues.length > 0 || errors.some(e => e.includes("DUPLICATE DETECTED")) || errors.some(e => e.includes("setoran outlet belum di-approve") || e.includes("ditolak oleh Owner"))) {
      exception_domain = "FINANCIAL";
    } else if (!hasFotoPaket || !hasFotoResi || warnings.some(w => w.includes("Foto pendukung"))) {
      exception_domain = "COMPLIANCE";
    } else {
      exception_domain = "OPERATIONAL";
    }
  }

  // Deduplicate recommendations
  const uniqueRecs = Array.from(new Set(recommendations));

  return {
    status,
    exception_domain,
    score,
    issues: allIssues,
    warnings,
    errors,
    recommendations: uniqueRecs,
    eligibility
  };
}

// ==========================================
// PART 13: BATCH AUDIT HELPERS
// ==========================================

export function auditDaily(db: any, dateStr: string, outletId?: string) {
  const allTxs = db.MASTER_TRANSAKSI || [];
  const filtered = allTxs.filter((tx: any) => {
    const d = extractBusinessDate(tx);
    if (d !== dateStr) return false;
    if (outletId && outletId !== "ALL" && tx.outlet_id !== outletId) return false;
    return true;
  });

  return summarizeAuditBatch(db, filtered, { date: dateStr, outlet_id: outletId || "ALL" });
}

export function auditOutlet(db: any, outletId: string) {
  const allTxs = db.MASTER_TRANSAKSI || [];
  const filtered = allTxs.filter((tx: any) => {
    if (outletId && outletId !== "ALL" && tx.outlet_id !== outletId) return false;
    return true;
  });

  return summarizeAuditBatch(db, filtered, { outlet_id: outletId });
}

export function auditAdmin(db: any, adminId: string) {
  const allTxs = db.MASTER_TRANSAKSI || [];
  const filtered = allTxs.filter((tx: any) => {
    if (adminId && tx.admin_id !== adminId && tx.admin !== adminId) return false;
    return true;
  });

  return summarizeAuditBatch(db, filtered, { admin_id: adminId });
}

export function auditImport(db: any, importId: string) {
  const allTxs = db.MASTER_TRANSAKSI || [];
  const filtered = allTxs.filter((tx: any) => tx.import_id === importId);

  return summarizeAuditBatch(db, filtered, { import_id: importId });
}

function summarizeAuditBatch(db: any, transactions: any[], scopeMeta: Record<string, any>) {
  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let criticalCount = 0;
  let totalScore = 0;

  const items = transactions.map((tx: any) => {
    const res = auditTransaction(db, tx);
    totalScore += res.score;

    if (res.status === "VALID") validCount++;
    else if (res.status === "WARNING") warningCount++;
    else if (res.status === "ERROR") errorCount++;
    else if (res.status === "CRITICAL") criticalCount++;

    return {
      transaction_id: tx.id || tx.transaksi_id,
      no_resi: tx.no_resi || tx.resi_id || "-",
      result: res
    };
  });

  const total = transactions.length;
  const averageScore = total > 0 ? Math.round(totalScore / total) : 100;

  return {
    ...scopeMeta,
    total,
    validCount,
    warningCount,
    errorCount,
    criticalCount,
    averageScore,
    items
  };
}

// ==========================================
// PART 14: AUDIT YOYI COMPLETENESS COMPARATOR
// ==========================================

export interface YoyiCompletenessResult {
  resi_id: string;
  audit_status: "FOUND" | "WARNING" | "CRITICAL" | "ECOMMERCE_SKIP" | "SCOPE_MISMATCH";
  reason: string | null;
  sumber_order: string | null;
  total_yoyi: number | null;
  expected_internal?: number | null;
  difference?: number | null;
  payment_status?: "MATCH" | "MISMATCH" | null;
  metode_yoyi?: string | null;
  metode_internal?: string | null;
  method_status?: "MATCH" | "MISMATCH" | "WARNING" | null;
  transaksi_id: string | null;
  tanggal_transaksi: string | null;
  admin_id: string | null;
  outlet_id: string | null;
  promo_candidate?: boolean;
  promo_validation_status?: string | null;
  discount_from_yoyi?: number;
}

export interface YoyiAuditSummary {
  status: "success";
  outlet_id: string;
  tanggal: string;
  total_yoyi_resi: number;
  total_ecommerce_skip: number;
  total_found: number;
  total_missing: number;
  total_scope_mismatch: number;
  results: YoyiCompletenessResult[];
}

export function compareYoYiCompleteness(
  db: any,
  yoyiRows: any[],
  outletId: string,
  auditDate: string
): YoyiAuditSummary {
  const targetDate = getWIBDate(auditDate);
  const targetOutlet = String(outletId || "").trim();

  const results: YoyiCompletenessResult[] = [];
  let total_ecommerce_skip = 0;
  let total_found = 0;
  let total_missing = 0;
  let total_scope_mismatch = 0;

  // Deduplicate yoyiRows based on resi_id
  const seenResi = new Set<string>();
  const uniqueYoyiRows: any[] = [];
  for (const row of yoyiRows || []) {
    if (!row || !row.resi_id) continue;
    const resiKey = String(row.resi_id).trim().toUpperCase();
    if (seenResi.has(resiKey)) continue;
    seenResi.add(resiKey);
    uniqueYoyiRows.push(row);
  }

  for (const row of uniqueYoyiRows) {
    const resiId = String(row.resi_id).trim().toUpperCase();
    const sumberOrder = row.sumber_order ? String(row.sumber_order).trim() : "";
    const totalYoyi = row.total_yoyi !== null && row.total_yoyi !== undefined ? Number(row.total_yoyi) : null;

    // 1. Check Ecommerce Skip
    const isEcommerce = ["JY", "JX", "JZ"].some(prefix => sumberOrder.toUpperCase().startsWith(prefix));
    if (isEcommerce) {
      total_ecommerce_skip++;
      results.push({
        resi_id: resiId,
        audit_status: "ECOMMERCE_SKIP",
        reason: null,
        sumber_order: sumberOrder,
        total_yoyi: totalYoyi,
        transaksi_id: null,
        tanggal_transaksi: null,
        admin_id: null,
        outlet_id: null
      });
      continue;
    }

    // 2. Lookup in internal system
    const expRecord = (db.EXP_Resi || []).find((e: any) => String(e.resi_id || "").trim().toUpperCase() === resiId);
    const crgRecord = (db.CRG_Resi || []).find((c: any) => String(c.resi_id || "").trim().toUpperCase() === resiId);
    const resiRecord = expRecord || crgRecord;

    let masterTx = null;
    if (resiRecord && resiRecord.transaksi_id) {
      masterTx = (db.MASTER_TRANSAKSI || []).find(
        (m: any) => m.id === resiRecord.transaksi_id || m.transaksi_id === resiRecord.transaksi_id
      );
    }

    // Fallback direct lookup in MASTER_TRANSAKSI
    if (!masterTx) {
      masterTx = (db.MASTER_TRANSAKSI || []).find(
        (m: any) => String(m.no_resi || m.resi_id || "").trim().toUpperCase() === resiId
      );
    }

    if (!masterTx) {
      // 3. Not found
      total_missing++;
      results.push({
        resi_id: resiId,
        audit_status: "CRITICAL",
        reason: "Resi belum diinput ke sistem",
        sumber_order: sumberOrder,
        total_yoyi: totalYoyi,
        transaksi_id: null,
        tanggal_transaksi: null,
        admin_id: null,
        outlet_id: null
      });
      continue;
    }

    // 4. Found - Validate identity
    const txDate = extractBusinessDate(masterTx);
    const txOutlet = String(masterTx.outlet_id || masterTx.outlet || "").trim();
    const txAdmin = String(masterTx.admin_id || masterTx.admin || "").trim();
    const txId = masterTx.id || masterTx.transaksi_id || null;

    const dateMatches = getWIBDate(txDate) === targetDate;
    const outletMatches = txOutlet === targetOutlet;

    if (dateMatches && outletMatches) {
      total_found++;

      // Perform Detailed Payment Correctness
      const summary = calculateFinancialSummary(masterTx);
      
      const paymentMethod = masterTx.metode_bayar || masterTx.metode_pembayaran_ongkir || masterTx.metode_bayar_ongkir || "";
      const isDfod = String(paymentMethod).trim().toUpperCase().includes("DFOD");
      const expected_base = isDfod ? summary.dfod_outstanding : summary.owner_deposit;

      // Promo Candidate & Validation APPROVED checking
      const normSource = String(masterTx.source_order || "").trim().toUpperCase();
      const normProduct = String(masterTx.tipe_produk || "EZ").trim().toUpperCase();
      const isPotentialVipPromo = normSource === "VIP" && normProduct === "EZ";

      const validationRecord = (db.PromoReviewValidations || []).find(
        (v: any) => String(v.resi_id || "").trim().toUpperCase() === resiId
      );
      const promo_validation_status = validationRecord ? validationRecord.status : null;
      const discount = Number(masterTx.discount_from_yoyi || masterTx.biaya_diskon || (validationRecord ? validationRecord.discount_from_yoyi : 0) || 0);

      let final_expected = expected_base;
      if (isPotentialVipPromo && promo_validation_status === "APPROVED") {
        final_expected = expected_base - discount;
      }

      const difference = totalYoyi !== null ? totalYoyi - final_expected : null;
      const payment_status = totalYoyi !== null ? (difference === 0 ? "MATCH" : "MISMATCH") : null;

      // Method comparison
      const metodeYoyi = row.metode_perhitungan ? String(row.metode_perhitungan).trim() : "";
      const metodeInternal = String(paymentMethod).trim();

      const yoyiIsDfod = metodeYoyi.toUpperCase().includes("DFOD");
      const internalIsDfod = isDfod;
      const yoyiIsMonthly = metodeYoyi.toLowerCase().includes("monthly") || metodeYoyi.toLowerCase().includes("bulanan");

      let method_status: "MATCH" | "MISMATCH" | "WARNING" = "MATCH";
      let method_reason: string | null = null;

      if (yoyiIsMonthly) {
        method_status = "WARNING";
        method_reason = "Metode perhitungan YoYi 'monthly' belum deterministic pada sistem internal";
      } else if (yoyiIsDfod !== internalIsDfod) {
        method_status = "MISMATCH";
      } else {
        method_status = "MATCH";
      }

      // Resolve final audit status severity
      let audit_status: "FOUND" | "WARNING" = "FOUND";
      let reason: string | null = null;

      if (payment_status === "MISMATCH") {
        audit_status = "WARNING";
        reason = "Nominal pembayaran YoYi tidak sesuai dengan sistem internal";
      }
      if (method_status === "MISMATCH") {
        audit_status = "WARNING";
        reason = reason ? `${reason} & Metode pembayaran tidak sesuai` : "Metode pembayaran tidak sesuai";
      } else if (method_status === "WARNING" && method_reason) {
        audit_status = "WARNING";
        reason = reason ? `${reason} & ${method_reason}` : method_reason;
      }

      results.push({
        resi_id: resiId,
        audit_status,
        reason,
        sumber_order: sumberOrder,
        total_yoyi: totalYoyi,
        expected_internal: final_expected,
        difference,
        payment_status,
        metode_yoyi: metodeYoyi || null,
        metode_internal: metodeInternal || null,
        method_status,
        transaksi_id: txId,
        tanggal_transaksi: txDate,
        admin_id: txAdmin,
        outlet_id: txOutlet,
        promo_candidate: isPotentialVipPromo,
        promo_validation_status,
        discount_from_yoyi: discount
      });
    } else {
      total_scope_mismatch++;
      results.push({
        resi_id: resiId,
        audit_status: "SCOPE_MISMATCH",
        reason: "RESI DITEMUKAN TETAPI IDENTITAS TRANSAKSI TIDAK SESUAI SCOPE",
        sumber_order: sumberOrder,
        total_yoyi: totalYoyi,
        transaksi_id: txId,
        tanggal_transaksi: txDate,
        admin_id: txAdmin,
        outlet_id: txOutlet
      });
    }
  }

  return {
    status: "success",
    outlet_id: outletId,
    tanggal: auditDate,
    total_yoyi_resi: uniqueYoyiRows.length,
    total_ecommerce_skip,
    total_found,
    total_missing,
    total_scope_mismatch,
    results
  };
}

