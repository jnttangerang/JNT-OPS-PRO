import { calculateDailyFinancial, calculateAdminFinancial } from "./financialEngine";
import { getExceptions } from "./reconciliationReviewEngine";
import { getSettlementRecord } from "./settlementEngine";
import { getDailyClosingRecord } from "./dailyClosingEngine";
import { getCertificationRecord } from "./financialCloseCertificationEngine";
import { generateEvidenceFingerprint } from "./financialCloseEvidenceEngine";

export function getControlTowerSummary(db: any, params: { outlet_id: string; tanggal: string }) {
  const { outlet_id, tanggal } = params;
  
  if (!outlet_id || !tanggal) {
    return { status: "error", message: "outlet_id and tanggal are required" };
  }
  
  const allTxs = (db.MASTER_TRANSAKSI || []).filter((tx: any) => tx.outlet_id === outlet_id && tx.tanggal_transaksi === tanggal);
  
  const financialSummary = calculateDailyFinancial(allTxs);
  const adminPerformance = calculateAdminFinancial(allTxs);
  
  // Expedition performance
  const expressTxs = allTxs.filter(tx => tx.layanan?.toLowerCase().includes("ez"));
  const cargoTxs = allTxs.filter(tx => tx.layanan?.toLowerCase().includes("jtr") || tx.layanan?.toLowerCase().includes("cargo"));
  
  const expressPerformance = calculateDailyFinancial(expressTxs);
  const cargoPerformance = calculateDailyFinancial(cargoTxs);
  
  const exceptions = getExceptions(db, { outlet_id });
  const openExceptions = exceptions.filter(e => ["OPEN", "IN_REVIEW", "REOPENED"].includes(e.status));
  
  const settlement = getSettlementRecord(db, outlet_id, tanggal);
  const dailyClosing = getDailyClosingRecord(db, outlet_id, tanggal);
  const certification = getCertificationRecord(db, outlet_id, tanggal);
  
  // Audit Logs
  const auditLogs = db.AuditLogs || [];
  const recentLogs = auditLogs
    .filter((log: any) => log.outlet_id === outlet_id)
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);
    
  // Control Health Score - primitive calculation
  let healthScore = 100;
  let penalty = 0;
  if (openExceptions.length > 0) penalty += 10;
  if (openExceptions.some(e => e.severity === "CRITICAL")) penalty += 20;
  if (settlement?.status === "MISMATCH") penalty += 20;
  if (dailyClosing?.status === "BLOCKED") penalty += 15;
  if (certification?.status === "BLOCKED") penalty += 15;
  
  healthScore = Math.max(0, healthScore - penalty);
  
  // Top Action Required
  const actionRequired = [];
  
  // Critical exceptions
  openExceptions.filter(e => e.severity === "CRITICAL").forEach(e => {
    actionRequired.push({
      severity: "CRITICAL",
      issue: `Exception: ${e.exception_type}`,
      outlet: outlet_id,
      tanggal: e.created_at.split("T")[0],
      age: Math.floor((Date.now() - new Date(e.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      action: "Review"
    });
  });
  
  // Settlement
  if (settlement?.status === "MISMATCH") {
    actionRequired.push({
      severity: "CRITICAL",
      issue: "Settlement Mismatch",
      outlet: outlet_id,
      tanggal,
      age: 0,
      action: "Review"
    });
  } else if (settlement?.status === "UNDER_REVIEW") {
    actionRequired.push({
      severity: "WARNING",
      issue: "Settlement Under Review",
      outlet: outlet_id,
      tanggal,
      age: 0,
      action: "Approval"
    });
  }
  
  // Closing
  if (dailyClosing?.status === "BLOCKED") {
    actionRequired.push({
      severity: "ERROR",
      issue: "Daily Closing BLOCKED",
      outlet: outlet_id,
      tanggal,
      age: 0,
      action: "Resolve Blocking Reasons"
    });
  }
  
  // Certification
  if (certification?.status === "BLOCKED") {
    actionRequired.push({
      severity: "ERROR",
      issue: "Financial Close BLOCKED",
      outlet: outlet_id,
      tanggal,
      age: 0,
      action: "Resolve Failed Controls"
    });
  }

  // Evidence status
  let evidenceStatus = "UNFINALIZED";
  if (certification?.status === "CERTIFIED") evidenceStatus = "FINAL";
  
  return {
    status: "success",
    data: {
      outlet_id,
      tanggal,
      financialSummary,
      adminPerformance,
      expeditionPerformance: {
        express: expressPerformance,
        cargo: cargoPerformance
      },
      exceptions: {
        total: exceptions.length,
        open: openExceptions.length,
        critical: openExceptions.filter(e => e.severity === "CRITICAL").length,
        error: openExceptions.filter(e => e.severity === "ERROR").length,
        warning: openExceptions.filter(e => e.severity === "WARNING").length,
        info: openExceptions.filter(e => e.severity === "INFO").length,
        list: exceptions
      },
      settlement,
      dailyClosing,
      certification,
      evidenceStatus,
      healthScore,
      actionRequired,
      recentLogs
    }
  };
}

export function getControlTowerMatrix(db: any, params: { tanggal: string }) {
  const { tanggal } = params;
  if (!tanggal) return { status: "error", message: "tanggal is required" };
  
  const outlets = db.MASTER_OUTLET || [];
  const matrix = [];
  
  for (const outlet of outlets) {
    const outlet_id = outlet.outlet_id || outlet.id;
    const allTxs = (db.MASTER_TRANSAKSI || []).filter((tx: any) => tx.outlet_id === outlet_id && tx.tanggal_transaksi === tanggal);
    const financialSummary = calculateDailyFinancial(allTxs);
    const settlement = getSettlementRecord(db, outlet_id, tanggal);
    const exceptions = getExceptions(db, { outlet_id });
    const openExceptions = exceptions.filter(e => ["OPEN", "IN_REVIEW", "REOPENED"].includes(e.status));
    const dailyClosing = getDailyClosingRecord(db, outlet_id, tanggal);
    const certification = getCertificationRecord(db, outlet_id, tanggal);
    
    matrix.push({
      outlet_id,
      outlet_name: outlet.nama_outlet || outlet_id,
      transaction_count: allTxs.length,
      owner_deposit: financialSummary.total_owner || 0,
      settlement_status: settlement?.status || "UNSETTLED",
      open_exceptions: openExceptions.length,
      closing_status: dailyClosing?.status || "OPEN",
      certification_status: certification?.status || "OPEN"
    });
  }
  
  return { status: "success", data: matrix };
}

export function getControlTowerTrend(db: any, params: { outlet_id: string; end_date: string; days: number }) {
  const { outlet_id, end_date, days = 7 } = params;
  if (!outlet_id || !end_date) return { status: "error", message: "outlet_id and end_date required" };
  
  const result = [];
  const end = new Date(end_date);
  
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    
    const allTxs = (db.MASTER_TRANSAKSI || []).filter((tx: any) => tx.outlet_id === outlet_id && tx.tanggal_transaksi === dateStr);
    const financialSummary = calculateDailyFinancial(allTxs);
    
    result.push({
      tanggal: dateStr,
      transaction_count: allTxs.length,
      customer_payment: financialSummary.total_customer || 0,
      owner_deposit: financialSummary.total_owner || 0
    });
  }
  
  return { status: "success", data: result };
}
