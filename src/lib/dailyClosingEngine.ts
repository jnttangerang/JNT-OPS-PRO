import { 
  calculateFinancialSummary, 
  calculateDailyFinancial, 
  isTransactionValidForFinance 
} from "./financialEngine";
import { 
  reconcileDaily, 
  logReconciliationExecution 
} from "./reconciliationEngine";
import { 
  syncReconciliationExceptions, 
  getClosingReconciliationStatus, 
  getExceptions 
} from "./reconciliationReviewEngine";
import { logAuditEvent } from "./auditTrailEngine";
import { getSettlementRecord } from "./settlementEngine";
import { getWIBDate, getTodayWIB, extractBusinessDate } from "../utils/dateUtils";

export type ClosingState = "OPEN" | "VALIDATING" | "READY" | "CLOSED" | "BLOCKED" | "REOPENED";

export interface ActorInfo {
  actor_id: string;
  actor_name?: string;
  actor_role?: string;
}

export interface AdminClosingBreakdown {
  admin_id: string;
  outlet_id: string;
  tanggal: string;
  customer_payment: number;
  owner_deposit: number;
  outlet_cash: number;
  cash_payment: number;
  digital_payment: number;
  dfod_outstanding: number;
  expected_cash: number;
  setoran_actual: number;
  setoran_variance: number;
  setoran_status: "MATCHED" | "MISMATCH" | "UNAPPROVED" | "MISSING" | "OK";
  jumlah_resi: number;
}

export interface DailyClosingRecord {
  closing_id: string;
  outlet_id: string;
  tanggal: string;
  status: ClosingState;

  // Single Source of Truth: Financial Engine
  total_customer: number;
  total_owner_deposit: number;
  total_outlet_cash: number;
  total_rounding: number;
  total_cash_payment?: number;
  total_digital_payment?: number;
  total_dfod_outstanding?: number;
  transaction_count: number;
  valid_financial_transaction_count: number;
  cancelled_transaction_count: number;

  // Setoran Validation Summary (Based on Physical Cash Responsibility)
  setoran_required: number;
  setoran_actual: number;
  setoran_variance: number;
  setoran_status: "MATCHED" | "MISMATCH" | "UNAPPROVED" | "MISSING" | "OK";

  // Admin Breakdown (Admin + Outlet + Tanggal Responsibility)
  admin_breakdown?: AdminClosingBreakdown[];

  // Reconciliation Summary
  reconciliation_status: "MATCHED" | "WARNING" | "MISMATCH" | "CRITICAL";
  open_exceptions_count: number;
  open_critical_count: number;
  open_error_count: number;
  open_warning_count: number;

  // Audit Metadata & State Machine
  validated_at?: string;
  validated_by?: string;
  closed_at?: string;
  closed_by?: string;
  reopened_at?: string;
  reopened_by?: string;
  reopen_reason?: string;
  notes?: string;
  blocking_reasons?: string[];

  created_at: string;
  updated_at: string;
}

function getOutletDisplayName(db: any, outletId: string, providedName?: string): string {
  if (providedName && providedName.trim() !== "" && providedName !== outletId) {
    return providedName.trim();
  }
  const outlets = db.Master_Outlet || db.Outlets || db.outlets || db.MASTER_OUTLET || [];
  const found = outlets.find((o: any) => o.outlet_id === outletId || o.id === outletId || o.nama_outlet === outletId || o.kode_outlet === outletId);
  return found?.nama_outlet || found?.nama || found?.name || outletId;
}

function ensureClosingTable(db: any): DailyClosingRecord[] {
  if (!db.DailyClosing) {
    db.DailyClosing = [];
  }
  if (!db.DailyClosings) {
    db.DailyClosings = db.DailyClosing;
  }
  return db.DailyClosing;
}

export function generateClosingId(outletId: string, tanggal: string): string {
  const cleanOutlet = String(outletId || "GLOBAL").trim().toUpperCase();
  const cleanDate = (tanggal || getTodayWIB()).trim();
  return `CLS-${cleanOutlet}-${cleanDate}`;
}

export function getDailyClosingRecord(db: any, outletId: string, tanggal: string): DailyClosingRecord | null {
  const list = ensureClosingTable(db);
  const closingId = generateClosingId(outletId, tanggal);
  const found = list.find((item: DailyClosingRecord) => item.closing_id === closingId || (item.outlet_id === outletId && item.tanggal === tanggal));
  return found || null;
}

export function validateDailyClosing(
  db: any,
  params: {
    outlet_id: string;
    outlet_name?: string;
    tanggal: string;
    actor: ActorInfo;
  },
  options?: { isDryRun?: boolean }
): { status: "success" | "blocked" | "error"; error_code?: string; message: string; data?: DailyClosingRecord; blocking_reasons?: string[] } {
  const { outlet_id, outlet_name, tanggal, actor } = params;
  const isDryRun = options?.isDryRun || false;

  if (!outlet_id) {
    return { status: "error", error_code: "INVALID_PARAM", message: "outlet_id wajib diisi." };
  }
  if (!tanggal) {
    return { status: "error", error_code: "INVALID_PARAM", message: "tanggal wajib diisi." };
  }

  const list = ensureClosingTable(db);
  const closingId = generateClosingId(outlet_id, tanggal);
  let existing = list.find((r) => r.closing_id === closingId);

  const resolvedOutletName = getOutletDisplayName(db, outlet_id, outlet_name);

  if (existing && existing.status === "CLOSED") {
    return {
      status: "error",
      error_code: "PERIOD_ALREADY_CLOSED",
      message: `Periode tutup buku '${tanggal}' untuk outlet '${resolvedOutletName}' sudah dalam status CLOSED. Buka kembali (Reopen) terlebih dahulu untuk memproses ulang.`,
      data: existing
    };
  }

  const now = new Date().toISOString();

  // Log audit event for closing started
  if (!isDryRun) {
    logAuditEvent(db, {
      event_type: "CLOSING_STARTED",
      action: "START_DAILY_CLOSING_VALIDATION",
      entity_type: "DAILY_CLOSING",
      entity_id: closingId,
      outlet_id,
      result: "SUCCESS",
      actor_id: actor.actor_id,
      actor_name: actor.actor_name,
      actor_role: actor.actor_role,
      metadata: { outlet_id, tanggal }
    });
  }

  // 1. Single Source of Truth Financial Calculation for outlet + tanggal
  const allTx = db.MASTER_TRANSAKSI || [];
  const outletDateTx = allTx.filter((tx: any) => {
    const d = extractBusinessDate(tx);
    return tx.outlet_id === outlet_id && d === tanggal;
  });

  const dailyFin = calculateDailyFinancial(outletDateTx);

  let total_rounding = 0;
  let valid_financial_transaction_count = 0;
  let cancelled_transaction_count = 0;

  for (const tx of outletDateTx) {
    if (isTransactionValidForFinance(tx)) {
      valid_financial_transaction_count++;
      const summary = calculateFinancialSummary(tx);
      total_rounding += summary.rounding;
    } else {
      cancelled_transaction_count++;
    }
  }

  // 2. Reconciliation Execution & Exception Review Validation
  const reconRes = reconcileDaily(db, tanggal, outlet_id);
  if (!isDryRun) {
    logReconciliationExecution(db, reconRes, actor.actor_id || "SYSTEM");
    syncReconciliationExceptions(db, reconRes);
  }

  const reconClosingStatus = getClosingReconciliationStatus(db, outlet_id, tanggal);

  // 3. Setoran Admin Physical Cash Validation (Admin + Outlet + Tanggal SSOT)
  const allSetoran = db.Master_Setoran || db.SetoranData || db.Setoran || [];
  const activeSetoran = allSetoran.filter((s: any) => {
    const sDate = extractBusinessDate(s);
    return s.outlet_id === outlet_id && sDate === tanggal && s.status !== "DITOLAK";
  });

  // Calculate Admin Cash Responsibility Breakdown (grouped by admin_id + outlet_id + tanggal)
  const adminMap: Record<string, AdminClosingBreakdown> = {};
  for (const tx of outletDateTx) {
    if (!isTransactionValidForFinance(tx)) continue;
    const admin = tx.admin_id || "UNKNOWN";
    if (!adminMap[admin]) {
      adminMap[admin] = {
        admin_id: admin,
        outlet_id,
        tanggal,
        customer_payment: 0,
        owner_deposit: 0,
        outlet_cash: 0,
        cash_payment: 0,
        digital_payment: 0,
        dfod_outstanding: 0,
        expected_cash: 0,
        setoran_actual: 0,
        setoran_variance: 0,
        setoran_status: "OK",
        jumlah_resi: 0
      };
    }
    const summary = calculateFinancialSummary(tx);
    adminMap[admin].customer_payment += summary.customer_payment;
    adminMap[admin].owner_deposit += summary.owner_deposit;
    adminMap[admin].outlet_cash += summary.outlet_cash;
    adminMap[admin].cash_payment += summary.cash_payment;
    adminMap[admin].digital_payment += summary.digital_payment;
    adminMap[admin].dfod_outstanding += summary.dfod_outstanding;
    adminMap[admin].expected_cash += summary.cash_payment;
    adminMap[admin].jumlah_resi++;
  }

  // Aggregate setoran actual per admin
  for (const s of activeSetoran) {
    const sAdmin = s.admin_id || s.user_id || s.created_by || "UNKNOWN";
    const nominal = Number(s.nominal || s.jumlah_setor || s.total_setor || 0);
    if (!adminMap[sAdmin]) {
      adminMap[sAdmin] = {
        admin_id: sAdmin,
        outlet_id,
        tanggal,
        customer_payment: 0,
        owner_deposit: 0,
        outlet_cash: 0,
        cash_payment: 0,
        digital_payment: 0,
        dfod_outstanding: 0,
        expected_cash: 0,
        setoran_actual: 0,
        setoran_variance: 0,
        setoran_status: "OK",
        jumlah_resi: 0
      };
    }
    adminMap[sAdmin].setoran_actual += nominal;
  }

  // Compute per-admin variance and status
  const adminBreakdown: AdminClosingBreakdown[] = Object.values(adminMap).map((adm) => {
    const variance = adm.setoran_actual - adm.expected_cash;
    const adminSetorans = activeSetoran.filter((s: any) => {
      const sAdmin = s.admin_id || s.user_id || s.created_by || "UNKNOWN";
      return sAdmin === adm.admin_id;
    });

    let status: "MATCHED" | "MISMATCH" | "UNAPPROVED" | "MISSING" | "OK" = "OK";
    if (adm.expected_cash === 0) {
      status = "OK";
    } else if (adminSetorans.length === 0) {
      status = "MISSING";
    } else {
      const hasUnapproved = adminSetorans.some((s: any) =>
        s.status === "PENDING" ||
        (s.status !== "DISETUJUI" && s.status !== "APPROVED" && s.approval_status !== "APPROVED")
      );
      if (hasUnapproved) {
        status = "UNAPPROVED";
      } else if (Math.abs(variance) > 0.01) {
        status = "MISMATCH";
      } else {
        status = "MATCHED";
      }
    }

    return {
      ...adm,
      setoran_variance: variance,
      setoran_status: status
    };
  });

  // Physical Cash Responsibility is SUM(cash_payment)
  const setoran_required = dailyFin.total_cash_payment;
  let setoran_actual = 0;
  for (const s of activeSetoran) {
    setoran_actual += Number(s.nominal || s.jumlah_setor || s.total_setor || 0);
  }

  // Contract: variance = actual_cash - expected_cash
  const setoran_variance = setoran_actual - setoran_required;

  let setoran_status: "MATCHED" | "MISMATCH" | "UNAPPROVED" | "MISSING" | "OK" = "OK";
  if (setoran_required === 0) {
    setoran_status = "OK";
  } else if (activeSetoran.length === 0) {
    setoran_status = "MISSING";
  } else {
    const hasUnapproved = activeSetoran.some((s: any) => 
      s.status === "PENDING" || 
      (s.status !== "DISETUJUI" && s.status !== "APPROVED" && s.approval_status !== "APPROVED")
    );
    if (hasUnapproved) {
      setoran_status = "UNAPPROVED";
    } else if (Math.abs(setoran_variance) > 0.01) {
      setoran_status = "MISMATCH";
    } else {
      setoran_status = "MATCHED";
    }
  }

  // 4. Compile Blocking Reasons
  const blocking_reasons: string[] = [];

  if (reconClosingStatus.open_critical_count > 0) {
    blocking_reasons.push(`Terdapat ${reconClosingStatus.open_critical_count} CRITICAL reconciliation exception belum selesai.`);
  }

  if (reconClosingStatus.open_error_count > 0) {
    blocking_reasons.push(`Terdapat ${reconClosingStatus.open_error_count} ERROR reconciliation exception belum selesai.`);
  }

  if (reconRes.variance_total > 0.01) {
    blocking_reasons.push(`Terdapat selisih finansial rekonsiliasi sebesar Rp ${reconRes.variance_total.toLocaleString('id-ID')}.`);
  }

  if (setoran_required > 0) {
    if (setoran_status === "MISSING") {
      blocking_reasons.push("Setoran Fisik Tunai belum dibuat (wajib setor tunai > 0).");
    } else if (setoran_status === "UNAPPROVED") {
      blocking_reasons.push("Setoran Fisik Tunai belum disetujui (status masih PENDING).");
    } else if (setoran_status === "MISMATCH") {
      const diffDesc = setoran_variance < 0 
        ? `Kurang Setor Rp ${Math.abs(setoran_variance).toLocaleString('id-ID')}` 
        : `Lebih Setor Rp ${setoran_variance.toLocaleString('id-ID')}`;
      blocking_reasons.push(`Selisih setoran fisik tunai: Wajib Setor Tunai Rp ${setoran_required.toLocaleString('id-ID')} vs Disetor Rp ${setoran_actual.toLocaleString('id-ID')} (${diffDesc}).`);
    }
  }

  // Multi-Admin Breakdown check
  for (const adm of adminBreakdown) {
    if (adm.expected_cash > 0 && adm.setoran_status !== "MATCHED" && adm.setoran_status !== "OK") {
      if (adm.setoran_status === "MISSING") {
        blocking_reasons.push(`Admin ${adm.admin_id}: Setoran Tunai Rp ${adm.expected_cash.toLocaleString('id-ID')} belum dibuat.`);
      } else if (adm.setoran_status === "UNAPPROVED") {
        blocking_reasons.push(`Admin ${adm.admin_id}: Setoran Tunai Rp ${adm.expected_cash.toLocaleString('id-ID')} masih PENDING.`);
      } else if (adm.setoran_status === "MISMATCH") {
        const diff = adm.setoran_variance;
        const diffDesc = diff < 0 ? `Kurang Rp ${Math.abs(diff).toLocaleString('id-ID')}` : `Lebih Rp ${diff.toLocaleString('id-ID')}`;
        blocking_reasons.push(`Admin ${adm.admin_id}: Selisih setoran tunai (Wajib Rp ${adm.expected_cash.toLocaleString('id-ID')} vs Aktual Rp ${adm.setoran_actual.toLocaleString('id-ID')} - ${diffDesc}).`);
      }
    }
  }

  // Settlement Engine Check
  const stlRecord = getSettlementRecord(db, outlet_id, tanggal);
  if (stlRecord) {
    if (["UNSETTLED", "PENDING_DEPOSIT", "MISMATCH", "UNDER_REVIEW", "REJECTED"].includes(stlRecord.status)) {
      blocking_reasons.push(`Settlement Keuangan Owner belum selesai/disetujui (status: ${stlRecord.status}).`);
    }
  }

  const isBlocked = blocking_reasons.length > 0;
  const finalStatus: ClosingState = isBlocked ? "BLOCKED" : "READY";

  // Construct or update DailyClosingRecord idempotently
  const record: DailyClosingRecord = {
    closing_id: closingId,
    outlet_id,
    tanggal,
    status: finalStatus,

    total_customer: dailyFin.total_customer,
    total_owner_deposit: dailyFin.total_owner,
    total_outlet_cash: dailyFin.total_outlet,
    total_rounding,
    total_cash_payment: dailyFin.total_cash_payment,
    total_digital_payment: dailyFin.total_digital_payment,
    total_dfod_outstanding: dailyFin.total_dfod_outstanding,
    transaction_count: outletDateTx.length,
    valid_financial_transaction_count,
    cancelled_transaction_count,

    setoran_required,
    setoran_actual,
    setoran_variance,
    setoran_status,

    admin_breakdown: adminBreakdown,

    reconciliation_status: reconRes.status,
    open_exceptions_count: reconClosingStatus.open_exceptions_count,
    open_critical_count: reconClosingStatus.open_critical_count,
    open_error_count: reconClosingStatus.open_error_count,
    open_warning_count: reconClosingStatus.open_warning_count,

    validated_at: now,
    validated_by: actor.actor_id || actor.actor_name || "SYSTEM",
    blocking_reasons: isBlocked ? blocking_reasons : [],
    created_at: existing ? existing.created_at : now,
    updated_at: now
  };

  let targetRecord: DailyClosingRecord;
  if (!existing) {
    targetRecord = record;
    if (!isDryRun) {
      list.push(targetRecord);
    }
  } else {
    targetRecord = { ...existing, ...record };
    if (!isDryRun) {
      Object.assign(existing, targetRecord);
    }
  }

  // Audit trail event
  if (isBlocked) {
    if (!isDryRun) {
      logAuditEvent(db, {
        event_type: "CLOSING_BLOCKED",
        action: "VALIDATE_DAILY_CLOSING",
        entity_type: "DAILY_CLOSING",
        entity_id: closingId,
        outlet_id,
        result: "FAILED",
        reason: blocking_reasons.join(" | "),
        actor_id: actor.actor_id,
        actor_name: actor.actor_name,
        actor_role: actor.actor_role,
        metadata: { blocking_reasons, record: targetRecord }
      });
    }
    return {
      status: "blocked",
      error_code: reconClosingStatus.open_critical_count > 0 ? "OPEN_CRITICAL_EXCEPTION" : "CLOSING_BLOCKED",
      message: `Tutup buku terkendala untuk outlet '${resolvedOutletName}' tanggal '${tanggal}'.`,
      data: { ...targetRecord },
      blocking_reasons
    };
  } else {
    if (!isDryRun) {
      logAuditEvent(db, {
        event_type: "CLOSING_VALIDATED",
        action: "VALIDATE_DAILY_CLOSING",
        entity_type: "DAILY_CLOSING",
        entity_id: closingId,
        outlet_id,
        result: "SUCCESS",
        actor_id: actor.actor_id,
        actor_name: actor.actor_name,
        actor_role: actor.actor_role,
        metadata: { record: targetRecord }
      });
    }
    return {
      status: "success",
      message: `Tutup buku valid dan SIAP untuk outlet '${resolvedOutletName}' tanggal '${tanggal}'.`,
      data: { ...targetRecord }
    };
  }
}

export function executeDailyClosing(
  db: any,
  params: {
    outlet_id: string;
    outlet_name?: string;
    tanggal: string;
    actor: ActorInfo;
    notes?: string;
  }
): { status: "success" | "error"; error_code?: string; message: string; data?: DailyClosingRecord; blocking_reasons?: string[] } {
  const { outlet_id, outlet_name, tanggal, actor, notes } = params;
  const resolvedOutletName = getOutletDisplayName(db, outlet_id, outlet_name);

  const existing = getDailyClosingRecord(db, outlet_id, tanggal);
  if (existing && existing.status === "CLOSED") {
    return {
      status: "success",
      message: `Tutup buku sudah berstatus SUDAH DITUTUP untuk outlet '${resolvedOutletName}'.`,
      data: existing
    };
  }

  const valRes = validateDailyClosing(db, { outlet_id, outlet_name, tanggal, actor });

  if (valRes.status === "blocked" || valRes.data?.status === "BLOCKED") {
    return {
      status: "error",
      error_code: valRes.error_code || "CLOSING_BLOCKED",
      message: "Proses tutup buku diblokir karena syarat validasi belum terpenuhi.",
      data: valRes.data,
      blocking_reasons: valRes.blocking_reasons
    };
  }

  const record = getDailyClosingRecord(db, outlet_id, tanggal) || valRes.data!;
  const now = new Date().toISOString();

  record.status = "CLOSED";
  record.closed_at = now;
  record.closed_by = actor.actor_id || actor.actor_name || "SYSTEM";
  if (notes) record.notes = notes;
  record.updated_at = now;

  logAuditEvent(db, {
    event_type: "CLOSING_COMPLETED",
    action: "EXECUTE_DAILY_CLOSING",
    entity_type: "DAILY_CLOSING",
    entity_id: record.closing_id,
    outlet_id,
    result: "SUCCESS",
    actor_id: actor.actor_id,
    actor_name: actor.actor_name,
    actor_role: actor.actor_role,
    metadata: {
      closing_id: record.closing_id,
      outlet_id,
      tanggal,
      total_customer: record.total_customer,
      total_owner_deposit: record.total_owner_deposit,
      total_outlet_cash: record.total_outlet_cash,
      transaction_count: record.transaction_count
    }
  });

  return {
    status: "success",
    message: `Tutup buku berhasil diselesaikan (SUDAH DITUTUP) untuk outlet '${resolvedOutletName}' tanggal '${tanggal}'.`,
    data: record
  };
}

export function reopenDailyClosing(
  db: any,
  params: {
    outlet_id: string;
    outlet_name?: string;
    tanggal: string;
    reason: string;
    actor: ActorInfo;
  }
): { status: "success" | "error"; error_code?: string; message: string; data?: DailyClosingRecord } {
  const { outlet_id, outlet_name, tanggal, reason, actor } = params;
  const resolvedOutletName = getOutletDisplayName(db, outlet_id, outlet_name);

  if (!actor || !actor.actor_role) {
    return { status: "error", error_code: "INVALID_ACTOR", message: "Identitas dan role actor wajib disertakan." };
  }

  const role = (actor.actor_role || "").toUpperCase();
  if (role !== "OWNER") {
    return {
      status: "error",
      error_code: "REOPEN_NOT_AUTHORIZED",
      message: "Akses ditolak. Wewenang Owner atau Super Admin diperlukan untuk membuka kembali (reopen) tutup buku."
    };
  }

  if (!reason || reason.trim().length === 0) {
    return {
      status: "error",
      error_code: "REASON_REQUIRED",
      message: "Alasan pembukaan kembali (reason) wajib diisi."
    };
  }

  const record = getDailyClosingRecord(db, outlet_id, tanggal);
  if (!record) {
    return {
      status: "error",
      error_code: "NOT_FOUND",
      message: `Data tutup buku tidak ditemukan untuk outlet '${resolvedOutletName}' tanggal '${tanggal}'.`
    };
  }

  if (record.status === "REOPENED") {
    return {
      status: "success",
      message: "Daily closing sudah dalam status REOPENED.",
      data: record
    };
  }

  if (record.status !== "CLOSED") {
    return {
      status: "error",
      error_code: "INVALID_STATE",
      message: `Tidak dapat meng-reopen closing dengan status '${record.status}'. Hanya status CLOSED yang dapat di-reopen.`
    };
  }

  const now = new Date().toISOString();
  const prevStatus = record.status;

  record.status = "REOPENED";
  record.reopened_at = now;
  record.reopened_by = actor.actor_id || actor.actor_name || "OWNER";
  record.reopen_reason = reason.trim();
  record.updated_at = now;

  logAuditEvent(db, {
    event_type: "CLOSING_REOPENED",
    action: "REOPEN_DAILY_CLOSING",
    entity_type: "DAILY_CLOSING",
    entity_id: record.closing_id,
    outlet_id,
    previous_status: prevStatus,
    new_status: "REOPENED",
    reason: reason.trim(),
    result: "WARNING",
    actor_id: actor.actor_id,
    actor_name: actor.actor_name,
    actor_role: actor.actor_role,
    metadata: {
      outlet_id,
      tanggal,
      reason: reason.trim()
    }
  });

  return {
    status: "success",
    message: `Periode daily closing outlet '${outlet_id}' tanggal '${tanggal}' berhasil dibuka kembali (REOPENED).`,
    data: record
  };
}

export function getDailyClosingStatus(db: any, outletId: string, tanggal: string) {
  const existing = getDailyClosingRecord(db, outletId, tanggal);
  if (existing && existing.status === "CLOSED") {
    return { status: "success", data: existing };
  }
  // Dry run validation to calculate fresh financial snapshot without mutating DB or logging
  const dummyActor: ActorInfo = { actor_id: "SYSTEM", actor_role: "SYSTEM" };
  const valRes = validateDailyClosing(db, { outlet_id: outletId, tanggal, actor: dummyActor }, { isDryRun: true });
  return { status: "success", data: valRes.data };
}

export interface OwnerSummaryFilter {
  outlet_id?: string;
  admin_id?: string;
  date_start?: string;
  date_end?: string;
  status?: string;
}

export function getOwnerClosingSummary(db: any, filters: OwnerSummaryFilter = {}) {
  const { outlet_id, admin_id, date_start, date_end, status } = filters;

  const userMap: Record<string, string> = {};
  (db.Users || []).forEach((u: any) => {
    userMap[u.user_id] = u.nama_lengkap || u.username || u.user_id;
  });

  const outletMap: Record<string, string> = {};
  (db.Outlets || db.Master_Outlet || []).forEach((o: any) => {
    outletMap[o.outlet_id] = o.nama_outlet || o.nama || o.outlet_id;
  });

  const allTx = db.MASTER_TRANSAKSI || [];
  const allSetoran = db.Master_Setoran || db.SetoranData || db.Setoran || [];

  // Group key: `${admin_id}_${outlet_id}_${tanggal}`
  const groupMap: Record<string, {
    admin_id: string;
    admin_nama: string;
    outlet_id: string;
    outlet_name: string;
    tanggal: string;
    jumlah_resi: number;
    customer_payment: number;
    owner_deposit: number;
    digital_payment: number;
    dfod_outstanding: number;
    kas_outlet: number;
    rounding: number;
    expected_cash: number;
    actual_cash: number;
    variance: number;
    variance_status: "MATCH" | "SHORT" | "OVER";
    setoran_status: "BELUM_SUBMIT" | "MENUNGGU_APPROVAL" | "DISETUJUI" | "DITOLAK";
    setoran_id?: string;
    closing_status: string;
    transactions: any[];
  }> = {};

  allTx.forEach((tx: any) => {
    if (!isTransactionValidForFinance(tx)) return;
    const txDate = extractBusinessDate(tx);
    if (!txDate) return;
    if (date_start && txDate < date_start) return;
    if (date_end && txDate > date_end) return;
    if (outlet_id && outlet_id !== "ALL" && tx.outlet_id !== outlet_id) return;
    const txAdmin = tx.admin_id || "UNKNOWN";
    if (admin_id && admin_id !== "ALL" && txAdmin !== admin_id) return;

    const groupKey = `${txAdmin}_${tx.outlet_id}_${txDate}`;
    if (!groupMap[groupKey]) {
      groupMap[groupKey] = {
        admin_id: txAdmin,
        admin_nama: userMap[txAdmin] || txAdmin,
        outlet_id: tx.outlet_id,
        outlet_name: outletMap[tx.outlet_id] || tx.outlet_id,
        tanggal: txDate,
        jumlah_resi: 0,
        customer_payment: 0,
        owner_deposit: 0,
        digital_payment: 0,
        dfod_outstanding: 0,
        kas_outlet: 0,
        rounding: 0,
        expected_cash: 0,
        actual_cash: 0,
        variance: 0,
        variance_status: "MATCH",
        setoran_status: "BELUM_SUBMIT",
        closing_status: "OPEN",
        transactions: []
      };
    }

    const sum = calculateFinancialSummary(tx);
    groupMap[groupKey].jumlah_resi++;
    groupMap[groupKey].customer_payment += sum.customer_payment;
    groupMap[groupKey].owner_deposit += sum.owner_deposit;
    groupMap[groupKey].digital_payment += sum.digital_payment;
    groupMap[groupKey].dfod_outstanding += sum.dfod_outstanding;
    groupMap[groupKey].kas_outlet += sum.outlet_cash;
    groupMap[groupKey].rounding += sum.rounding;
    groupMap[groupKey].expected_cash += sum.cash_payment;
    groupMap[groupKey].transactions.push({
      resi_id: tx.resi_id || tx.no_resi,
      ekspedisi: (tx.ekspedisi || "EXPRESS").toUpperCase() === "CARGO" ? "Cargo" : "Express",
      customer_payment: sum.customer_payment,
      wajib_setor_owner: sum.owner_deposit,
      kas_outlet: sum.outlet_cash,
      metode_bayar: tx.metode_bayar || tx.metode_pembayaran_ongkir || "CASH",
      status_resi: tx.status_resi || tx.status || "OK"
    });
  });

  // Also include groups from setoran records that might have no transactions matching
  allSetoran.forEach((s: any) => {
    const sDate = extractBusinessDate(s);
    if (!sDate) return;
    if (date_start && sDate < date_start) return;
    if (date_end && sDate > date_end) return;
    if (outlet_id && outlet_id !== "ALL" && s.outlet_id !== outlet_id) return;
    const sAdmin = s.admin_pembuat || s.admin_id || s.user_id || s.created_by || "UNKNOWN";
    if (admin_id && admin_id !== "ALL" && sAdmin !== admin_id) return;

    const groupKey = `${sAdmin}_${s.outlet_id}_${sDate}`;
    if (!groupMap[groupKey]) {
      groupMap[groupKey] = {
        admin_id: sAdmin,
        admin_nama: userMap[sAdmin] || sAdmin,
        outlet_id: s.outlet_id,
        outlet_name: outletMap[s.outlet_id] || s.outlet_name || s.outlet_id,
        tanggal: sDate,
        jumlah_resi: s.jumlah_resi || 0,
        customer_payment: 0,
        owner_deposit: 0,
        digital_payment: 0,
        dfod_outstanding: 0,
        kas_outlet: s.total_kas_outlet || 0,
        rounding: 0,
        expected_cash: 0,
        actual_cash: 0,
        variance: 0,
        variance_status: "MATCH",
        setoran_status: "BELUM_SUBMIT",
        closing_status: "OPEN",
        transactions: []
      };
    }
  });

  // Process setoran and closing status for each group
  let rows = Object.values(groupMap).map(row => {
    // Find active setoran for admin + outlet + date
    const setoran = allSetoran.find((s: any) => {
      const sDate = extractBusinessDate(s);
      const sAdmin = s.admin_pembuat || s.admin_id || s.user_id || s.created_by || "UNKNOWN";
      return sDate === row.tanggal && s.outlet_id === row.outlet_id && sAdmin === row.admin_id;
    });

    if (setoran) {
      row.setoran_id = setoran.setoran_id;
      row.actual_cash = Number(setoran.actual_cash ?? setoran.nominal_setor ?? setoran.nominal ?? setoran.total_setoran_owner ?? 0);
      row.setoran_status = setoran.status as any;
      if (setoran.closing_status) {
        row.closing_status = setoran.closing_status;
      }
    } else {
      row.actual_cash = 0;
      row.setoran_status = "BELUM_SUBMIT";
    }

    row.variance = row.actual_cash - row.expected_cash;
    if (Math.abs(row.variance) < 0.01) {
      row.variance_status = "MATCH";
    } else if (row.variance < 0) {
      row.variance_status = "SHORT";
    } else {
      row.variance_status = "OVER";
    }

    // Check DailyClosing table
    const closingRecord = getDailyClosingRecord(db, row.outlet_id, row.tanggal);
    if (closingRecord) {
      row.closing_status = closingRecord.status;
    }

    return row;
  });

  // Filter by status if requested
  if (status && status !== "ALL") {
    if (status === "BELUM_SUBMIT") {
      rows = rows.filter(r => r.setoran_status === "BELUM_SUBMIT");
    } else if (status === "MENUNGGU_APPROVAL") {
      rows = rows.filter(r => r.setoran_status === "MENUNGGU_APPROVAL");
    } else if (status === "DISETUJUI") {
      rows = rows.filter(r => r.setoran_status === "DISETUJUI");
    } else if (status === "DITOLAK") {
      rows = rows.filter(r => r.setoran_status === "DITOLAK");
    } else if (status === "SHORT") {
      rows = rows.filter(r => r.variance_status === "SHORT");
    } else if (status === "OVER") {
      rows = rows.filter(r => r.variance_status === "OVER");
    } else if (status === "MATCH") {
      rows = rows.filter(r => r.variance_status === "MATCH");
    }
  }

  // Sort descending by tanggal, then outlet_id
  rows.sort((a, b) => b.tanggal.localeCompare(a.tanggal) || a.outlet_id.localeCompare(b.outlet_id));

  // Compute aggregate stats across rows
  let total_expected_cash = 0;
  let total_actual_cash = 0;
  let total_variance = 0;
  let count_belum_submit = 0;
  let count_submitted = 0;
  let count_approved = 0;
  let count_rejected = 0;
  let count_short = 0;
  let count_over = 0;

  rows.forEach(r => {
    total_expected_cash += r.expected_cash;
    total_actual_cash += r.actual_cash;
    total_variance += r.variance;
    if (r.setoran_status === "BELUM_SUBMIT") count_belum_submit++;
    else if (r.setoran_status === "MENUNGGU_APPROVAL") count_submitted++;
    else if (r.setoran_status === "DISETUJUI") count_approved++;
    else if (r.setoran_status === "DITOLAK") count_rejected++;

    if (r.variance_status === "SHORT") count_short++;
    else if (r.variance_status === "OVER") count_over++;
  });

  return {
    status: "success",
    data: {
      summary: {
        total_expected_cash,
        total_actual_cash,
        total_variance,
        count_belum_submit,
        count_submitted,
        count_approved,
        count_rejected,
        count_short,
        count_over,
        total_rows: rows.length
      },
      rows
    }
  };
}
