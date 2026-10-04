import { calculateDailyFinancial, isTransactionValidForFinance } from "./financialEngine";
import { getExceptions, ExceptionRecord } from "./reconciliationReviewEngine";
import { getSettlementRecord } from "./settlementEngine";
import { getDailyClosingRecord } from "./dailyClosingEngine";
import { getAuditTrail, logAuditEvent } from "./auditTrailEngine";
import { getTodayWIB, extractBusinessDate } from "../utils/dateUtils";
import { resolveSetoranActualCash, parseSafeNominal } from "./setoranFinancialResolver";

export type CertificationState = "OPEN" | "VALIDATING" | "READY_FOR_CERTIFICATION" | "CERTIFIED" | "BLOCKED" | "REOPEN_REQUESTED" | "REOPENED";

export interface ControlResult {
  control_name: string;
  status: "PASS" | "WARNING" | "FAIL";
  message: string;
}

export interface FinancialCloseCertificationRecord {
  certification_id: string;
  outlet_id: string;
  tanggal: string;
  status: CertificationState;
  certified: boolean;
  controls: ControlResult[];
  blocking_reasons: string[];
  warnings: string[];
  financial_summary: any;
  settlement_status: string;
  reconciliation_status: string;
  daily_closing_status: string;
  evidence: any;
  certified_by?: string;
  certified_at?: string;
  reopened_by?: string;
  reopened_at?: string;
  reopen_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface ActorInfo {
  actor_id: string;
  actor_name: string;
  actor_role: string;
}

export function generateCertificationId(outletId: string, tanggal: string): string {
  const cleanOutlet = String(outletId || "GLOBAL").trim().toUpperCase();
  const cleanDate = (tanggal || getTodayWIB()).trim();
  return `FC-${cleanOutlet}-${cleanDate}`;
}

export function ensureCertificationTable(db: any): FinancialCloseCertificationRecord[] {
  if (!db.FinancialCloseCertification) {
    db.FinancialCloseCertification = [];
  }
  return db.FinancialCloseCertification;
}

export function getCertificationRecord(db: any, outletId: string, tanggal: string): FinancialCloseCertificationRecord | null {
  const list = ensureCertificationTable(db);
  const certId = generateCertificationId(outletId, tanggal);
  return list.find((r) => r.certification_id === certId || (r.outlet_id === outletId && r.tanggal === tanggal)) || null;
}

const VALID_CERT_TRANSITIONS: Record<CertificationState, CertificationState[]> = {
  OPEN: ["VALIDATING"],
  VALIDATING: ["READY_FOR_CERTIFICATION", "BLOCKED", "OPEN"],
  READY_FOR_CERTIFICATION: ["CERTIFIED", "VALIDATING", "BLOCKED", "OPEN"],
  BLOCKED: ["OPEN", "VALIDATING"],
  CERTIFIED: ["REOPEN_REQUESTED", "REOPENED"],
  REOPEN_REQUESTED: ["REOPENED"],
  REOPENED: ["OPEN", "VALIDATING"]
};

export function isValidCertificationTransition(from: CertificationState, to: CertificationState): boolean {
  if (from === to) return true;
  return VALID_CERT_TRANSITIONS[from]?.includes(to) || false;
}

export function validateFinancialClose(db: any, params: {
  outlet_id: string;
  tanggal: string;
  actor: ActorInfo;
}): { status: "success" | "error"; message: string; data?: FinancialCloseCertificationRecord; error_code?: string } {
  const { outlet_id, tanggal, actor } = params;
  if (!outlet_id || !tanggal) {
    return { status: "error", message: "outlet_id dan tanggal wajib diisi.", error_code: "INVALID_PARAM" };
  }

  const certId = generateCertificationId(outlet_id, tanggal);
  const list = ensureCertificationTable(db);
  let record = list.find(r => r.certification_id === certId);

  if (record && record.status === "CERTIFIED") {
    return { status: "error", message: "Sesi ini sudah CERTIFIED dan tidak dapat divalidasi ulang tanpa reopen.", error_code: "ALREADY_CERTIFIED", data: record };
  }

  // Pre-fetch related records
  const settlement = getSettlementRecord(db, outlet_id, tanggal);
  const dailyClosing = getDailyClosingRecord(db, outlet_id, tanggal);
  
  // Get all transactions
  // Enforce Date and Outlet isolation
  const allTxs = (db.MASTER_TRANSAKSI || []).filter((tx: any) => {
    return tx.outlet_id === outlet_id && tx.tanggal_transaksi === tanggal;
  });

  const controls: ControlResult[] = [];
  const blocking_reasons: string[] = [];
  const warnings: string[] = [];

  // CONTROL 01 — TRANSACTION INTEGRITY
  let transactionIntegrityStatus: "PASS" | "FAIL" | "WARNING" = "PASS";
  let duplicateTxs = false;
  let orphanTxs = false;
  let invalidStatusTxs = false;
  const txIds = new Set();
  const resis = new Set();
  for (const tx of allTxs) {
    if (txIds.has(tx.transaksi_id)) duplicateTxs = true;
    txIds.add(tx.transaksi_id);
    if (tx.no_resi) {
      if (resis.has(tx.no_resi) && tx.status_transaksi !== "CANCELLED") duplicateTxs = true;
      resis.add(tx.no_resi);
    }
    if (tx.status_transaksi === "FAILED" && tx.grand_total > 0) invalidStatusTxs = true;
  }
  if (duplicateTxs || orphanTxs || invalidStatusTxs) {
    transactionIntegrityStatus = "FAIL";
    blocking_reasons.push("Integritas transaksi gagal (duplicate/orphan/invalid status).");
  }
  controls.push({ control_name: "TRANSACTION_INTEGRITY", status: transactionIntegrityStatus, message: transactionIntegrityStatus === "PASS" ? "Valid" : "Integrity issues found" });

  // CONTROL 02 — FINANCIAL INTEGRITY
  let financialIntegrityStatus: "PASS" | "FAIL" | "WARNING" = "PASS";
  const financialSummary = calculateDailyFinancial(allTxs);
  if (!financialSummary) {
    financialIntegrityStatus = "FAIL";
    blocking_reasons.push("Gagal menghitung financial summary.");
  }
  controls.push({ control_name: "FINANCIAL_INTEGRITY", status: financialIntegrityStatus, message: "Valid" });

  // CANONICAL CASH CONTROL CALCULATIONS
  // Expected Cash strictly from canonical Financial Engine
  const expected_cash = financialSummary?.total_cash_payment ?? 0;

  // Actual & Pending Cash from canonical Setoran_Realization via resolveSetoranActualCash
  const allSetoran = db.Master_Setoran || db.SetoranData || db.Setoran || [];
  const activeSetoran = allSetoran.filter((s: any) => {
    const sDate = extractBusinessDate(s);
    return s.outlet_id === outlet_id && sDate === tanggal && s.status !== "DITOLAK";
  });

  let actual_cash = 0;
  let pending_cash = 0;
  const processedSetoranIds = new Set<string>();

  for (const s of activeSetoran) {
    const sId = String(s.setoran_id || "").trim();
    if (sId) processedSetoranIds.add(sId);
    const res = resolveSetoranActualCash(db, s.setoran_id);
    actual_cash += res.actual_cash;
    pending_cash += res.pending_cash;
  }

  // Also check direct realizations in db.Setoran_Realization (if not linked via Master_Setoran header)
  const allRealizations = db.Setoran_Realization || [];
  for (const r of allRealizations) {
    const rSetoranId = String(r.setoran_id || "").trim();
    if (rSetoranId && processedSetoranIds.has(rSetoranId)) continue;
    
    const rOutlet = r.outlet_id || (activeSetoran.length === 0 ? outlet_id : "");
    const rDate = extractBusinessDate(r) || (activeSetoran.length === 0 ? tanggal : "");
    if (rOutlet === outlet_id && rDate === tanggal) {
      const nominal = parseSafeNominal(r.nominal);
      const status = String(r.status || "").trim().toUpperCase();
      if (status === "DISETUJUI") {
        actual_cash += nominal;
      } else if (status === "MENUNGGU_APPROVAL") {
        pending_cash += nominal;
      }
    }
  }

  const variance = actual_cash - expected_cash;

  // CONTROL 03 — RECONCILIATION
  let reconciliationStatus: "PASS" | "FAIL" | "WARNING" = "PASS";
  const openExceptions = getExceptions(db, { outlet_id }).filter(e => e.status === "OPEN" || e.status === "IN_REVIEW");
  const criticalCount = openExceptions.filter(e => e.severity === "CRITICAL").length;
  const errorCount = openExceptions.filter(e => e.severity === "ERROR").length;
  if (criticalCount > 0 || errorCount > 0) {
    reconciliationStatus = "FAIL";
    blocking_reasons.push(`Terdapat ${criticalCount} CRITICAL dan ${errorCount} ERROR exception yang belum terselesaikan.`);
  }
  controls.push({ control_name: "RECONCILIATION", status: reconciliationStatus, message: "Valid" });

  // CONTROL 04 — SETTLEMENT (Legacy non-blocking information)
  const stlStatus = settlement ? settlement.status : "UNSETTLED";
  const settlementControlStatus: "PASS" | "WARNING" = (stlStatus === "APPROVED" || stlStatus === "SETTLED") ? "PASS" : "WARNING";
  if (settlementControlStatus === "WARNING") {
    warnings.push(`Status settlement: ${stlStatus} (legacy non-blocking).`);
  }
  controls.push({ control_name: "SETTLEMENT", status: settlementControlStatus, message: `Status: ${stlStatus} (legacy non-blocking)` });

  // CONTROL 05 — DAILY CLOSING
  let dailyClosingControlStatus: "PASS" | "FAIL" | "WARNING" = "PASS";
  const dcStatus = dailyClosing ? dailyClosing.status : "OPEN";
  if (dcStatus !== "CLOSED") {
    dailyClosingControlStatus = "FAIL";
    blocking_reasons.push(`Status Daily Closing belum CLOSED (current: ${dcStatus}).`);
  }
  controls.push({ control_name: "DAILY_CLOSING", status: dailyClosingControlStatus, message: "Valid" });

  // CONTROL 06 — OWNER APPROVAL (Canonical Realization Approval)
  let ownerApprovalStatus: "PASS" | "FAIL" | "WARNING" = "PASS";
  if (pending_cash > 0) {
    ownerApprovalStatus = "FAIL";
    blocking_reasons.push(`Terdapat realisasi setoran yang masih menunggu approval owner (pending: Rp ${pending_cash.toLocaleString('id-ID')}).`);
  }
  controls.push({
    control_name: "OWNER_APPROVAL",
    status: ownerApprovalStatus,
    message: ownerApprovalStatus === "PASS" ? "Valid" : `Pending approval (Rp ${pending_cash.toLocaleString('id-ID')})`
  });

  // CONTROL 06B — CANONICAL CASH CONTROL
  let cashControlStatus: "PASS" | "FAIL" | "WARNING" = "PASS";
  let cashControlMessage = "Valid";

  if (pending_cash > 0) {
    cashControlStatus = "FAIL";
    cashControlMessage = `Pending approval Rp ${pending_cash.toLocaleString('id-ID')}`;
  } else if (expected_cash === 0) {
    cashControlStatus = "PASS";
    cashControlMessage = "Expected cash Rp 0 (PASS)";
  } else if (variance < 0) {
    cashControlStatus = "FAIL";
    cashControlMessage = `KURANG SETOR (selisih -Rp ${Math.abs(variance).toLocaleString('id-ID')})`;
    blocking_reasons.push(`Kurang setor fisik tunai: expected Rp ${expected_cash.toLocaleString('id-ID')} vs actual Rp ${actual_cash.toLocaleString('id-ID')} (selisih -Rp ${Math.abs(variance).toLocaleString('id-ID')}).`);
  } else if (variance > 0) {
    cashControlStatus = "FAIL";
    cashControlMessage = `LEBIH SETOR (selisih +Rp ${variance.toLocaleString('id-ID')})`;
    blocking_reasons.push(`Lebih setor fisik tunai: expected Rp ${expected_cash.toLocaleString('id-ID')} vs actual Rp ${actual_cash.toLocaleString('id-ID')} (selisih +Rp ${variance.toLocaleString('id-ID')}).`);
  } else {
    cashControlStatus = "PASS";
    cashControlMessage = `Balance (Rp ${actual_cash.toLocaleString('id-ID')})`;
  }

  controls.push({
    control_name: "CASH_CONTROL",
    status: cashControlStatus,
    message: cashControlMessage
  });

  // CONTROL 07 — AUDIT TRAIL COMPLETENESS
  let auditTrailStatus: "PASS" | "FAIL" | "WARNING" = "PASS";
  // Just checking if we have events, normally it would check specific events. We check if Daily Closing event exists.
  const allEvents = db.AuditLogs || [];
  const dcEvents = allEvents.filter((e: any) => e.entity_type === "DAILY_CLOSING" && e.outlet_id === outlet_id && e.entity_id === dailyClosing?.closing_id);
  if (dcEvents.length === 0 && dailyClosing) {
    auditTrailStatus = "FAIL";
    blocking_reasons.push("Evidence Audit Trail untuk Daily Closing tidak lengkap.");
  }
  controls.push({ control_name: "AUDIT_TRAIL", status: auditTrailStatus, message: "Valid" });

  // CONTROL 08 — OUTLET ISOLATION
  let outletIsolationStatus: "PASS" | "FAIL" | "WARNING" = "PASS";
  const hasOtherOutlet = allTxs.some(tx => tx.outlet_id !== outlet_id);
  if (hasOtherOutlet) {
    outletIsolationStatus = "FAIL";
    blocking_reasons.push("Terdapat transaksi dari outlet lain yang masuk dalam cakupan.");
  }
  controls.push({ control_name: "OUTLET_ISOLATION", status: outletIsolationStatus, message: "Valid" });

  // CONTROL 09 — DATE ISOLATION
  let dateIsolationStatus: "PASS" | "FAIL" | "WARNING" = "PASS";
  const hasOtherDate = allTxs.some(tx => tx.tanggal_transaksi !== tanggal);
  if (hasOtherDate) {
    dateIsolationStatus = "FAIL";
    blocking_reasons.push("Terdapat transaksi dari tanggal lain yang masuk dalam cakupan.");
  }
  controls.push({ control_name: "DATE_ISOLATION", status: dateIsolationStatus, message: "Valid" });

  // CONTROL 10 — DATA COMPLETENESS
  let dataCompletenessStatus: "PASS" | "FAIL" | "WARNING" = "PASS";
  const missingData = allTxs.some(tx => !tx.transaksi_id || !tx.outlet_id || !tx.tanggal_transaksi);
  if (missingData) {
    dataCompletenessStatus = "FAIL";
    blocking_reasons.push("Beberapa transaksi kehilangan data mandatory (transaksi_id, outlet_id, tanggal_transaksi).");
  }
  controls.push({ control_name: "DATA_COMPLETENESS", status: dataCompletenessStatus, message: "Valid" });

  const isBlocked = blocking_reasons.length > 0;
  const newStatus: CertificationState = isBlocked ? "BLOCKED" : "READY_FOR_CERTIFICATION";

  const enhancedFinancialSummary = {
    ...financialSummary,
    expected_cash,
    actual_cash,
    pending_cash,
    variance,
    cash_status: expected_cash === 0 && actual_cash === 0 ? "BALANCE" : variance === 0 ? "BALANCE" : variance < 0 ? "KURANG_SETOR" : "LEBIH_SETOR"
  };

  if (record) {
    record.status = newStatus;
    record.controls = controls;
    record.blocking_reasons = blocking_reasons;
    record.warnings = warnings;
    record.financial_summary = enhancedFinancialSummary;
    record.settlement_status = stlStatus;
    record.reconciliation_status = reconciliationStatus;
    record.daily_closing_status = dcStatus;
    record.updated_at = new Date().toISOString();
  } else {
    record = {
      certification_id: certId,
      outlet_id,
      tanggal,
      status: newStatus,
      certified: false,
      controls,
      blocking_reasons,
      warnings,
      financial_summary: enhancedFinancialSummary,
      settlement_status: stlStatus,
      reconciliation_status: reconciliationStatus,
      daily_closing_status: dcStatus,
      evidence: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    list.push(record);
  }

  logAuditEvent(db, {
    event_type: isBlocked ? "FINANCIAL_CERTIFICATION_BLOCKED" : "FINANCIAL_CERTIFICATION_VALIDATED",
    action: "VALIDATE_CERTIFICATION",
    entity_type: "FINANCIAL_CERTIFICATION",
    entity_id: certId,
    outlet_id,
    result: isBlocked ? "FAILED" : "SUCCESS",
    actor_id: actor.actor_id,
    actor_name: actor.actor_name,
    actor_role: actor.actor_role,
    metadata: {
      blocking_count: blocking_reasons.length,
      warning_count: warnings.length,
      status: newStatus
    }
  });

  return {
    status: "success",
    message: isBlocked ? "Validasi gagal, Certification ter-BLOCKED." : "Validasi sukses, READY FOR CERTIFICATION.",
    data: record
  };
}

export function certifyFinancialClose(db: any, params: {
  outlet_id: string;
  tanggal: string;
  actor: ActorInfo;
}): { status: "success" | "error"; message: string; data?: FinancialCloseCertificationRecord; error_code?: string } {
  const { outlet_id, tanggal, actor } = params;
  
  if (actor.actor_role !== "OWNER") {
    return { status: "error", message: "Hanya OWNER yang dapat melakukan final certification.", error_code: "UNAUTHORIZED_CERTIFICATION" };
  }

  // Always re-validate before final certify
  const valResult = validateFinancialClose(db, params);
  if (valResult.status === "error") {
    return valResult;
  }
  
  const record = valResult.data!;
  if (record.status !== "READY_FOR_CERTIFICATION") {
    return { status: "error", message: `Sesi tidak dalam status READY_FOR_CERTIFICATION (current: ${record.status}).`, error_code: "INVALID_CLOSE_CERTIFICATION_TRANSITION" };
  }

  record.status = "CERTIFIED";
  record.certified = true;
  record.certified_by = actor.actor_id;
  record.certified_at = new Date().toISOString();
  record.updated_at = new Date().toISOString();

  logAuditEvent(db, {
    event_type: "FINANCIAL_CERTIFICATION_COMPLETED",
    action: "CERTIFY",
    entity_type: "FINANCIAL_CERTIFICATION",
    entity_id: record.certification_id,
    outlet_id,
    result: "SUCCESS",
    actor_id: actor.actor_id,
    actor_name: actor.actor_name,
    actor_role: actor.actor_role,
    metadata: {
      status: "CERTIFIED"
    }
  });

  return { status: "success", message: `Periode ${tanggal} untuk outlet ${outlet_id} berhasil di-CERTIFIED.`, data: record };
}

export function reopenFinancialClose(db: any, params: {
  outlet_id: string;
  tanggal: string;
  reason: string;
  actor: ActorInfo;
}): { status: "success" | "error"; message: string; data?: FinancialCloseCertificationRecord; error_code?: string } {
  const { outlet_id, tanggal, reason, actor } = params;

  if (actor.actor_role !== "OWNER") {
    return { status: "error", message: "Hanya OWNER yang dapat membuka kembali (reopen) certification yang sudah final.", error_code: "UNAUTHORIZED_REOPEN" };
  }

  if (!reason || reason.trim() === "") {
    return { status: "error", message: "Alasan reopen wajib diisi.", error_code: "MISSING_REOPEN_REASON" };
  }

  const certId = generateCertificationId(outlet_id, tanggal);
  const list = ensureCertificationTable(db);
  const record = list.find(r => r.certification_id === certId);

  if (!record) {
    return { status: "error", message: "Certification record tidak ditemukan.", error_code: "NOT_FOUND" };
  }

  if (record.status !== "CERTIFIED") {
    return { status: "error", message: `Hanya status CERTIFIED yang dapat direopen (current: ${record.status}).`, error_code: "INVALID_CLOSE_CERTIFICATION_TRANSITION" };
  }

  record.status = "REOPENED";
  record.certified = false;
  record.reopened_by = actor.actor_id;
  record.reopened_at = new Date().toISOString();
  record.reopen_reason = reason;
  record.updated_at = new Date().toISOString();

  logAuditEvent(db, {
    event_type: "FINANCIAL_CERTIFICATION_REOPENED",
    action: "REOPEN_CERTIFICATION",
    entity_type: "FINANCIAL_CERTIFICATION",
    entity_id: record.certification_id,
    outlet_id,
    result: "SUCCESS",
    actor_id: actor.actor_id,
    actor_name: actor.actor_name,
    actor_role: actor.actor_role,
    metadata: {
      status: "REOPENED",
      reason
    }
  });

  return { status: "success", message: `Certification ${certId} berhasil di-REOPENED.`, data: record };
}
