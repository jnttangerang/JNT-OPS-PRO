import { calculateDailyFinancial } from "./financialEngine";
import { getExceptions } from "./reconciliationReviewEngine";
import { getSettlementRecord } from "./settlementEngine";
import { getDailyClosingRecord } from "./dailyClosingEngine";
import { getCertificationRecord } from "./financialCloseCertificationEngine";
import { logAuditEvent } from "./auditTrailEngine";

export interface ActorInfo {
  actor_id: string;
  actor_name: string;
  actor_role: string;
}

export interface FinancialCloseReport {
  report_id: string;
  evidence_id: string;
  outlet_id: string;
  tanggal: string;
  generated_at: string;
  status: "DRAFT" | "UNFINALIZED" | "FINAL";

  certification: any;
  daily_closing: any;
  settlement: any;
  reconciliation: any;
  financial_summary: any;

  transaction_summary: any;
  exception_summary: any;
  audit_timeline: any;

  controls: any;
  evidence_chain: any;

  generated_by: ActorInfo;
}

export function generateEvidenceFingerprint(outletId: string, tanggal: string): string {
  const cleanOutlet = (outletId || "GLOBAL").trim().toUpperCase();
  const cleanDate = (tanggal || new Date().toISOString().split("T")[0]).trim();
  return `EV-${cleanOutlet}-${cleanDate}`;
}

export function generateFinancialCloseReport(db: any, params: { outlet_id: string; tanggal: string; actor: ActorInfo }): { status: "success" | "error"; message: string; data?: FinancialCloseReport; error_code?: string } {
  const { outlet_id, tanggal, actor } = params;

  if (!outlet_id || !tanggal) {
    return { status: "error", message: "outlet_id dan tanggal wajib diisi.", error_code: "INVALID_PARAM" };
  }

  const allTxs = (db.MASTER_TRANSAKSI || []).filter((tx: any) => tx.outlet_id === outlet_id && tx.tanggal_transaksi === tanggal);

  const cert = getCertificationRecord(db, outlet_id, tanggal);
  const dc = getDailyClosingRecord(db, outlet_id, tanggal);
  const stl = getSettlementRecord(db, outlet_id, tanggal);
  const exceptions = getExceptions(db, { outlet_id });
  const periodExceptions = exceptions.filter(e => {
     // Optional: filtering logic depending on how exception stores date.
     // Assuming exception holds tanggal or we just grab those that are active.
     // In Phase 30, it might just be exceptions related to the outlet.
     // We will count all exceptions for the outlet.
     return true; 
  });
  
  const auditLogs = db.AuditLogs || [];
  const periodLogs = auditLogs.filter((log: any) => log.outlet_id === outlet_id && (log.tanggal === tanggal || log.entity_id?.includes(tanggal)));

  // TRANSACTION SUMMARY
  let validCount = 0;
  let cancelledCount = 0;
  let failedCount = 0;
  let expressCount = 0;
  let cargoCount = 0;
  let duplicateCount = 0; // naive
  
  const txIds = new Set();
  const resis = new Set();

  allTxs.forEach(tx => {
    if (tx.status_transaksi === "SUCCESS") validCount++;
    if (tx.status_transaksi === "CANCELLED") cancelledCount++;
    if (tx.status_transaksi === "FAILED") failedCount++;
    
    // Check duplicates
    if (txIds.has(tx.transaksi_id)) duplicateCount++;
    txIds.add(tx.transaksi_id);
    
    if (tx.no_resi) {
      if (resis.has(tx.no_resi) && tx.status_transaksi !== "CANCELLED") duplicateCount++;
      resis.add(tx.no_resi);
    }
  });

  const transaction_summary = {
    total_transactions: allTxs.length,
    valid: validCount,
    cancelled: cancelledCount,
    failed: failedCount,
    express: expressCount, // Need parsing if available, but skip for generic count unless type is provided
    cargo: cargoCount,
    active_resi: resis.size,
    duplicate: duplicateCount
  };

  // FINANCIAL SUMMARY
  const financialSummary = calculateDailyFinancial(allTxs);

  // RECONCILIATION SUMMARY
  const exception_summary = {
    total: periodExceptions.length,
    INFO: periodExceptions.filter(e => e.severity === "INFO").length,
    WARNING: periodExceptions.filter(e => e.severity === "WARNING").length,
    ERROR: periodExceptions.filter(e => e.severity === "ERROR").length,
    CRITICAL: periodExceptions.filter(e => e.severity === "CRITICAL").length,
    OPEN: periodExceptions.filter(e => e.status === "OPEN").length,
    IN_REVIEW: periodExceptions.filter(e => e.status === "IN_REVIEW").length,
    RESOLVED: periodExceptions.filter(e => e.status === "RESOLVED").length,
    ACCEPTED: periodExceptions.filter(e => e.status === "ACCEPTED").length,
    REJECTED: periodExceptions.filter(e => e.status === "REJECTED").length,
    REOPENED: periodExceptions.filter(e => e.status === "REOPENED").length
  };

  // REPORT STATUS
  let reportStatus: "DRAFT" | "UNFINALIZED" | "FINAL" = "DRAFT";
  
  if (cert) {
    if (cert.status === "CERTIFIED") reportStatus = "FINAL";
    else if (cert.status === "READY_FOR_CERTIFICATION" || cert.status === "OPEN" || cert.status === "REOPENED") reportStatus = "UNFINALIZED";
    else if (cert.status === "BLOCKED") reportStatus = "UNFINALIZED";
  }

  // AUDIT TIMELINE
  const audit_timeline = periodLogs.map((log: any) => ({
    event_type: log.event_type,
    timestamp: log.created_at,
    actor_id: log.actor_id,
    entity_type: log.entity_type,
    entity_id: log.entity_id
  }));

  // EVIDENCE CHAIN
  const evidence_chain = {
    certification_id: cert ? cert.certification_id : null,
    closing_id: dc ? dc.closing_id : null,
    settlement_id: stl ? stl.settlement_id : null,
    reconciliation_exceptions: periodExceptions.map(e => e.exception_id),
    transactions: allTxs.map(tx => tx.transaksi_id)
  };

  const reportId = generateEvidenceFingerprint(outlet_id, tanggal);

  const report: FinancialCloseReport = {
    report_id: reportId,
    evidence_id: reportId,
    outlet_id,
    tanggal,
    generated_at: new Date().toISOString(),
    status: reportStatus,
    certification: cert || null,
    daily_closing: dc || null,
    settlement: stl || null,
    reconciliation: exception_summary,
    financial_summary: financialSummary || {},
    transaction_summary,
    exception_summary,
    audit_timeline,
    controls: cert?.controls || [],
    evidence_chain,
    generated_by: actor
  };

  // AUDIT
  logAuditEvent(db, {
    event_type: "FINANCIAL_CLOSE_REPORT_GENERATED",
    action: "GENERATE_REPORT",
    entity_type: "FINANCIAL_CLOSE_REPORT",
    entity_id: reportId,
    outlet_id,
    result: "SUCCESS",
    actor_id: actor.actor_id,
    actor_name: actor.actor_name,
    actor_role: actor.actor_role,
    metadata: {
      report_status: reportStatus,
      certification_id: cert?.certification_id
    }
  });

  return { status: "success", message: "Report berhasil di-generate.", data: report };
}

export function accessEvidence(db: any, params: { outlet_id: string; tanggal: string; actor: ActorInfo }): { status: "success" | "error"; message: string; data?: FinancialCloseReport; error_code?: string } {
  // Essentially same as generating report, but logs as accessed
  const res = generateFinancialCloseReport(db, params);
  if (res.status === "success" && res.data) {
    logAuditEvent(db, {
      event_type: "FINANCIAL_CLOSE_EVIDENCE_ACCESSED",
      action: "ACCESS_EVIDENCE",
      entity_type: "FINANCIAL_CLOSE_REPORT",
      entity_id: res.data.report_id,
      outlet_id: params.outlet_id,
      result: "SUCCESS",
      actor_id: params.actor.actor_id,
      actor_name: params.actor.actor_name,
      actor_role: params.actor.actor_role,
      metadata: {
        report_status: res.data.status
      }
    });
  }
  return res;
}
