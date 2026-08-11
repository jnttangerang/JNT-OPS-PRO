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

import {
  normalizeLifecycleStatus,
  validateLifecycle,
  checkDuplicateResi,
  checkDuplicateCustomer,
  checkDuplicateTransaction,
  checkDuplicateImport
} from "./operationalEngine";

export type AuditStatus = "VALID" | "WARNING" | "ERROR" | "CRITICAL";

export interface AuditEligibility {
  countedInDashboard: boolean;
  countedInFinance: boolean;
  countedInTarget: boolean;
  countedInAudit: boolean;
  countedInReport: boolean;
}

export interface AuditResult {
  status: AuditStatus;
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

  const pengirimExists = pengirimId
    ? customers.some((c: any) => c.id === pengirimId || c.pelanggan_id === pengirimId)
    : false;
  const penerimaExists = penerimaId
    ? customers.some((c: any) => c.id === penerimaId || c.pelanggan_id === penerimaId)
    : false;

  const hasSenderSnap = !!(tx.snapshot_nama_pengirim || tx.nama_pengirim);
  const hasRecipientSnap = !!(tx.snapshot_nama_penerima || tx.nama_penerima);

  if (!pengirimId || !pengirimExists) {
    errors.push(`Pengirim ID ('${pengirimId}') tidak valid atau tidak terdaftar di Master Pelanggan`);
    recommendations.push("Lengkapi Pengirim & Daftarkan di Master Pelanggan");
  }

  if (!penerimaId || !penerimaExists) {
    errors.push(`Penerima ID ('${penerimaId}') tidak valid atau tidak terdaftar di Master Pelanggan`);
    recommendations.push("Lengkapi Penerima & Daftarkan di Master Pelanggan");
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
  // PART 11 & PART 12: Status, Score, & Recommendations
  // ------------------------------------------
  let status: AuditStatus = "VALID";
  let score = 100;

  const allIssues = [...errors, ...warnings];

  // Check CRITICAL conditions:
  // - Customer completely missing or not found
  // - Duplicate resi
  const isCritical =
    (!pengirimId || !pengirimExists || !penerimaId || !penerimaExists) ||
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

  // Deduplicate recommendations
  const uniqueRecs = Array.from(new Set(recommendations));

  return {
    status,
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
    const d = (tx.tanggal_transaksi || tx.created_at || tx.tanggal || "").split("T")[0];
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
