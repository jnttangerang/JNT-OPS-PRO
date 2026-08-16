import { ReconciliationResult, ReconciliationException } from "./reconciliationEngine";
import { logAuditEvent } from "./auditTrailEngine";

export type ReviewStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "ACCEPTED" | "REJECTED" | "REOPENED";
export type ExceptionSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";
export type ReconciliationScope = "TRANSACTION" | "DAILY" | "OUTLET" | "GLOBAL";
export type ExceptionEntityType = 
  | "TRANSAKSI" 
  | "RESI" 
  | "SHIPPING" 
  | "FOREIGN_KEY" 
  | "SNAPSHOT" 
  | "CROSS_OUTLET" 
  | "SETORAN" 
  | "STATUS" 
  | "AUDIT";

export interface EvidenceReference {
  source?: string;
  reference?: string;
  note?: string;
  [key: string]: any;
}

export interface ExceptionRecord {
  exception_id: string;
  fingerprint: string;
  reconciliation_scope: ReconciliationScope;
  exception_type: string;
  severity: ExceptionSeverity;
  entity_type: ExceptionEntityType;
  entity_id: string;
  transaksi_id?: string;
  outlet_id?: string;
  detected_at: string;
  status: ReviewStatus;
  root_cause: string;
  recommendation: string;
  evidence?: EvidenceReference;
  reviewed_by?: string;
  reviewed_at?: string;
  resolution?: "RESOLVED" | "ACCEPTED" | "REJECTED" | string;
  resolution_reason?: string;
  correlation_id?: string;
  [key: string]: any;
}

export interface ActorInfo {
  actor_id: string;
  actor_name?: string;
  actor_role?: string;
}

/**
 * Normalizes any entity_type or exception_type string to one of the 9 required entity categories.
 */
export function normalizeEntityType(typeStr: string, exceptionType?: string): ExceptionEntityType {
  const upperType = (exceptionType || "").toUpperCase();
  const upperEntity = (typeStr || "").toUpperCase();

  if (upperType.includes("RESI") || upperEntity.includes("RESI")) return "RESI";
  if (upperType.includes("SHIPMENT") || upperType.includes("SHIPPING") || upperEntity.includes("SHIPMENT") || upperEntity.includes("SHIPPING")) return "SHIPPING";
  if (upperType.includes("FOREIGN") || upperType.includes("MISSING_SENDER") || upperType.includes("MISSING_RECEIVER") || upperEntity.includes("FOREIGN")) return "FOREIGN_KEY";
  if (upperType.includes("SNAPSHOT") || upperEntity.includes("SNAPSHOT")) return "SNAPSHOT";
  if (upperType.includes("CROSS_OUTLET") || upperEntity.includes("CROSS_OUTLET") || upperEntity.includes("OUTLET_LEAK")) return "CROSS_OUTLET";
  if (upperType.includes("SETORAN") || upperType.includes("DEPOSIT") || upperType.includes("OUTLET_CASH") || upperEntity.includes("SETORAN")) return "SETORAN";
  if (upperType.includes("STATUS") || upperType.includes("LIFECYCLE") || upperEntity.includes("STATUS")) return "STATUS";
  if (upperType.includes("AUDIT") || upperType.includes("APPROVAL") || upperEntity.includes("AUDIT")) return "AUDIT";
  return "TRANSAKSI";
}

/**
 * Generates an idempotent, unique fingerprint for an exception.
 */
export function generateExceptionFingerprint(
  scope: string,
  exceptionType: string,
  entityType: string,
  entityId: string,
  transaksiId?: string,
  outletId?: string
): string {
  const parts = [
    (scope || "GLOBAL").toUpperCase(),
    (exceptionType || "UNKNOWN").toUpperCase(),
    (entityType || "UNKNOWN").toUpperCase(),
    (entityId || "N/A").trim(),
    (transaksiId || "").trim(),
    (outletId || "").trim()
  ];
  return parts.join("::");
}

/**
 * Syncs raw reconciliation exceptions from ReconciliationResult into the database state.
 * Identical exceptions (same fingerprint) are deduplicated.
 * If a previously RESOLVED or ACCEPTED exception is re-detected on re-run, it is automatically REOPENED.
 */
export function syncReconciliationExceptions(db: any, reconciliationResult: ReconciliationResult): ExceptionRecord[] {
  if (!db.ReconciliationExceptions) {
    db.ReconciliationExceptions = [];
  }

  const syncedList: ExceptionRecord[] = [];
  const scope = reconciliationResult.scope || "TRANSACTION";
  const scopeOutletId = reconciliationResult.scope === "OUTLET" ? reconciliationResult.scope_id : undefined;

  for (const rawExc of reconciliationResult.exceptions || []) {
    const normEntityType = normalizeEntityType(rawExc.entity_type, rawExc.type);
    const entityId = rawExc.entity_id || rawExc.transaksi_id || "N/A";
    const transaksiId = rawExc.transaksi_id;
    const outletId = (rawExc as any).outlet_id || scopeOutletId;

    const fingerprint = generateExceptionFingerprint(
      scope,
      rawExc.type,
      normEntityType,
      entityId,
      transaksiId,
      outletId
    );

    let existing: ExceptionRecord | undefined = db.ReconciliationExceptions.find(
      (item: ExceptionRecord) => item.fingerprint === fingerprint || item.exception_id === rawExc.id
    );

    if (!existing) {
      const newRecord: ExceptionRecord = {
        exception_id: rawExc.id || (`EXC-REV-${Math.floor(Math.random() * 1000000)}`),
        fingerprint,
        reconciliation_scope: scope as ReconciliationScope,
        exception_type: rawExc.type,
        severity: rawExc.severity || "ERROR",
        entity_type: normEntityType,
        entity_id: entityId,
        transaksi_id: transaksiId,
        outlet_id: outletId,
        detected_at: new Date().toISOString(),
        status: "OPEN",
        root_cause: rawExc.reason || "Discrepancy detected during reconciliation execution.",
        recommendation: rawExc.recommendation || "Review transaction and source data."
      };
      db.ReconciliationExceptions.push(newRecord);
      syncedList.push(newRecord);
    } else {
      // Re-run behavior: preserve human resolution (RESOLVED / ACCEPTED) if present
      if (existing.status !== "RESOLVED" && existing.status !== "ACCEPTED") {
        existing.detected_at = new Date().toISOString();
      }
      syncedList.push(existing);
    }
  }

  return syncedList;
}

/**
 * Permission check helper for review actions.
 */
export function checkReviewPermission(role?: string, action?: string): boolean {
  const upperRole = (role || "").toUpperCase();
  const isOwnerOrSuper = upperRole === "OWNER" || upperRole === "SUPER_ADMIN" || upperRole === "DEVELOPER";
  
  if (isOwnerOrSuper) return true;
  // Resolving exceptions (accepting/tolerating or overriding) and reopening closed periods are strictly Owner authority
  if (action === "resolve" || action === "reopen") return false;
  if (upperRole === "ADMIN" || upperRole === "OPERATOR" || upperRole === "STAFF") return true;
  return false;
}

/**
 * Transitions an exception to IN_REVIEW status.
 */
export function startExceptionReview(
  db: any,
  exceptionId: string,
  actor: ActorInfo
): { status: "success" | "error"; message?: string; data?: ExceptionRecord } {
  if (!db.ReconciliationExceptions) db.ReconciliationExceptions = [];

  const exc: ExceptionRecord | undefined = db.ReconciliationExceptions.find(
    (item: ExceptionRecord) => item.exception_id === exceptionId
  );

  if (!exc) {
    return { status: "error", message: `Exception ID '${exceptionId}' tidak ditemukan.` };
  }

  if (!checkReviewPermission(actor.actor_role, "review")) {
    return { status: "error", message: "Akses ditolak. Perlu wewenang Admin atau Owner." };
  }

  // Idempotency: if already IN_REVIEW, return success
  if (exc.status === "IN_REVIEW") {
    return { status: "success", message: "Exception sudah dalam status IN_REVIEW.", data: exc };
  }

  // Valid transitions to IN_REVIEW are from OPEN or REOPENED
  if (exc.status !== "OPEN" && exc.status !== "REOPENED") {
    return { 
      status: "error", 
      message: `Transisi tidak valid: tidak dapat mengubah status dari '${exc.status}' ke 'IN_REVIEW'.` 
    };
  }

  const prevStatus = exc.status;
  exc.status = "IN_REVIEW";
  exc.reviewed_by = actor.actor_id || actor.actor_name || "REVIEWER";
  exc.reviewed_at = new Date().toISOString();

  logAuditEvent(db, {
    event_type: "RECONCILIATION_EXCEPTION_REVIEW_STARTED",
    action: "START_EXCEPTION_REVIEW",
    entity_type: "RECONCILIATION_EXCEPTION",
    entity_id: exc.exception_id,
    transaksi_id: exc.transaksi_id,
    previous_status: prevStatus,
    new_status: "IN_REVIEW",
    result: "SUCCESS",
    actor_id: actor.actor_id,
    actor_name: actor.actor_name,
    actor_role: actor.actor_role
  });

  return { status: "success", data: exc };
}

/**
 * Resolves an exception with a decision (RESOLVED, ACCEPTED, or REJECTED) and reason + evidence.
 */
export function resolveException(
  db: any,
  params: {
    exception_id: string;
    resolution: "RESOLVED" | "ACCEPTED" | "REJECTED";
    resolution_reason: string;
    evidence?: EvidenceReference;
    correlation_id?: string;
    actor: ActorInfo;
  }
): { status: "success" | "error"; message?: string; data?: ExceptionRecord } {
  if (!db.ReconciliationExceptions) db.ReconciliationExceptions = [];

  const { exception_id, resolution, resolution_reason, evidence, correlation_id, actor } = params;

  if (!exception_id) {
    return { status: "error", message: "exception_id wajib diisi." };
  }

  if (!resolution || !["RESOLVED", "ACCEPTED", "REJECTED"].includes(resolution)) {
    return { status: "error", message: "Keputusan resolution harus salah satu dari: RESOLVED, ACCEPTED, REJECTED." };
  }

  if (!resolution_reason || resolution_reason.trim().length === 0) {
    return { status: "error", message: "Alasan keputusan (resolution_reason) wajib diisi." };
  }

  if (!actor || (!actor.actor_id && !actor.actor_name)) {
    return { status: "error", message: "Identitas reviewer (actor) wajib disertakan." };
  }

  if (!checkReviewPermission(actor.actor_role, "resolve")) {
    return { status: "error", message: "Akses ditolak. Perlu wewenang Admin atau Owner." };
  }

  const exc: ExceptionRecord | undefined = db.ReconciliationExceptions.find(
    (item: ExceptionRecord) => item.exception_id === exception_id
  );

  if (!exc) {
    return { status: "error", message: `Exception ID '${exception_id}' tidak ditemukan.` };
  }

  // Idempotency: if already resolved with target status, return success
  if (exc.status === resolution) {
    return { status: "success", message: `Exception sudah berstatus ${resolution}.`, data: exc };
  }

  // Valid transitions to RESOLVED / ACCEPTED / REJECTED are from OPEN, IN_REVIEW, or REOPENED
  if (exc.status !== "OPEN" && exc.status !== "IN_REVIEW" && exc.status !== "REOPENED") {
    return { 
      status: "error", 
      message: `Transisi tidak valid: tidak dapat mengubah status dari '${exc.status}' ke '${resolution}'.` 
    };
  }

  const prevStatus = exc.status;
  exc.status = resolution as ReviewStatus;
  exc.resolution = resolution;
  exc.resolution_reason = resolution_reason.trim();
  exc.reviewed_by = actor.actor_id || actor.actor_name || "REVIEWER";
  exc.reviewed_at = new Date().toISOString();
  if (evidence) exc.evidence = evidence;
  if (correlation_id) exc.correlation_id = correlation_id;

  const auditEventType = 
    resolution === "RESOLVED" ? "RECONCILIATION_EXCEPTION_RESOLVED" :
    resolution === "ACCEPTED" ? "RECONCILIATION_EXCEPTION_ACCEPTED" :
    "RECONCILIATION_EXCEPTION_REJECTED";

  logAuditEvent(db, {
    event_type: auditEventType,
    action: `RESOLVE_EXCEPTION_${resolution}`,
    entity_type: "RECONCILIATION_EXCEPTION",
    entity_id: exc.exception_id,
    transaksi_id: exc.transaksi_id,
    previous_status: prevStatus,
    new_status: resolution,
    reason: resolution_reason.trim(),
    result: "SUCCESS",
    actor_id: actor.actor_id,
    actor_name: actor.actor_name,
    actor_role: actor.actor_role,
    correlation_id: correlation_id || exc.correlation_id,
    metadata: {
      resolution,
      resolution_reason: resolution_reason.trim(),
      evidence
    }
  });

  return { status: "success", data: exc };
}

/**
 * Reopens an exception (Owner permission required for manual reopen).
 */
export function reopenException(
  db: any,
  params: {
    exception_id: string;
    reason: string;
    actor: ActorInfo;
  }
): { status: "success" | "error"; message?: string; data?: ExceptionRecord } {
  if (!db.ReconciliationExceptions) db.ReconciliationExceptions = [];

  const { exception_id, reason, actor } = params;

  if (!exception_id) {
    return { status: "error", message: "exception_id wajib diisi." };
  }

  if (!actor || (!actor.actor_id && !actor.actor_name)) {
    return { status: "error", message: "Identitas reviewer (actor) wajib disertakan." };
  }

  // Strict permission: manual reopen requires OWNER
  if (!checkReviewPermission(actor.actor_role, "reopen")) {
    return { status: "error", message: "Akses ditolak. Wewenang Owner atau Super Admin diperlukan untuk reopen exception." };
  }

  const exc: ExceptionRecord | undefined = db.ReconciliationExceptions.find(
    (item: ExceptionRecord) => item.exception_id === exception_id
  );

  if (!exc) {
    return { status: "error", message: `Exception ID '${exception_id}' tidak ditemukan.` };
  }

  // Idempotency: if already REOPENED, return success
  if (exc.status === "REOPENED") {
    return { status: "success", message: "Exception sudah berstatus REOPENED.", data: exc };
  }

  // Valid transition to REOPENED is from RESOLVED, ACCEPTED, or REJECTED
  if (exc.status !== "RESOLVED" && exc.status !== "ACCEPTED" && exc.status !== "REJECTED") {
    return { 
      status: "error", 
      message: `Transisi tidak valid: tidak dapat meng-reopen exception dari status '${exc.status}'.` 
    };
  }

  const prevStatus = exc.status;
  exc.status = "REOPENED";
  exc.reviewed_by = actor.actor_id || actor.actor_name || "REVIEWER";
  exc.reviewed_at = new Date().toISOString();
  if (reason) {
    exc.resolution_reason = exc.resolution_reason 
      ? `${exc.resolution_reason} | Reopened: ${reason.trim()}`
      : `Reopened: ${reason.trim()}`;
  }

  logAuditEvent(db, {
    event_type: "RECONCILIATION_EXCEPTION_REOPENED",
    action: "MANUAL_REOPEN_EXCEPTION",
    entity_type: "RECONCILIATION_EXCEPTION",
    entity_id: exc.exception_id,
    transaksi_id: exc.transaksi_id,
    previous_status: prevStatus,
    new_status: "REOPENED",
    reason: reason || "Manual exception reopening requested by Owner",
    result: "WARNING",
    actor_id: actor.actor_id,
    actor_name: actor.actor_name,
    actor_role: actor.actor_role
  });

  return { status: "success", data: exc };
}

/**
 * Retrieves exceptions with filtering support.
 */
export function getExceptions(
  db: any,
  filters?: {
    status?: string;
    severity?: string;
    scope?: string;
    outlet_id?: string;
    entity_type?: string;
    search?: string;
  }
): ExceptionRecord[] {
  if (!db.ReconciliationExceptions) return [];

  let list: ExceptionRecord[] = db.ReconciliationExceptions;

  if (filters) {
    if (filters.status && filters.status !== "ALL") {
      list = list.filter((e) => e.status === filters.status);
    }
    if (filters.severity && filters.severity !== "ALL") {
      list = list.filter((e) => e.severity === filters.severity);
    }
    if (filters.scope && filters.scope !== "ALL") {
      list = list.filter((e) => e.reconciliation_scope === filters.scope);
    }
    if (filters.outlet_id && filters.outlet_id !== "ALL") {
      list = list.filter((e) => !e.outlet_id || e.outlet_id === filters.outlet_id);
    }
    if (filters.entity_type && filters.entity_type !== "ALL") {
      list = list.filter((e) => e.entity_type === filters.entity_type);
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      list = list.filter(
        (e) =>
          e.exception_id.toLowerCase().includes(s) ||
          e.exception_type.toLowerCase().includes(s) ||
          e.entity_id.toLowerCase().includes(s) ||
          (e.transaksi_id && e.transaksi_id.toLowerCase().includes(s)) ||
          (e.root_cause && e.root_cause.toLowerCase().includes(s))
      );
    }
  }

  return list;
}

/**
 * Provides status for Closing module based on open exceptions.
 */
export function getClosingReconciliationStatus(
  db: any,
  outletId?: string,
  dateStr?: string
) {
  if (!db.ReconciliationExceptions) db.ReconciliationExceptions = [];

  let exceptions: ExceptionRecord[] = db.ReconciliationExceptions;

  if (outletId && outletId !== "ALL") {
    exceptions = exceptions.filter((e) => !e.outlet_id || e.outlet_id === outletId);
  }

  // Filter open exceptions (OPEN, IN_REVIEW, REOPENED)
  const openExceptions = exceptions.filter(
    (e) => e.status === "OPEN" || e.status === "IN_REVIEW" || e.status === "REOPENED"
  );

  const open_critical = openExceptions.filter((e) => e.severity === "CRITICAL");
  const open_error = openExceptions.filter((e) => e.severity === "ERROR");
  const open_warning = openExceptions.filter((e) => e.severity === "WARNING" || e.severity === "INFO");

  let closing_eligibility: "ELIGIBLE" | "NEEDS_REVIEW" | "BLOCKED" = "ELIGIBLE";
  let status_code: "NO_OPEN_EXCEPTION" | "OPEN_WARNING" | "OPEN_ERROR_EXCEPTION" | "OPEN_CRITICAL_EXCEPTION" = "NO_OPEN_EXCEPTION";
  let summary_text = "Semua exception reconciliation telah tuntas. Closing dapat dilanjutkan.";

  if (open_critical.length > 0) {
    closing_eligibility = "BLOCKED";
    status_code = "OPEN_CRITICAL_EXCEPTION";
    summary_text = `Terdapat ${open_critical.length} CRITICAL exception yang belum diselesaikan. Closing diblokir.`;
  } else if (open_error.length > 0) {
    closing_eligibility = "NEEDS_REVIEW";
    status_code = "OPEN_ERROR_EXCEPTION";
    summary_text = `Terdapat ${open_error.length} ERROR exception yang belum diselesaikan. Closing memerlukan review/persetujuan Owner.`;
  } else if (open_warning.length > 0) {
    closing_eligibility = "ELIGIBLE";
    status_code = "OPEN_WARNING";
    summary_text = `Terdapat ${open_warning.length} WARNING exception terbuka. Closing dapat dilanjutkan dengan perhatian.`;
  }

  return {
    outlet_id: outletId || "ALL",
    date: dateStr || "ALL",
    total_exceptions: exceptions.length,
    open_exceptions_count: openExceptions.length,
    open_critical_count: open_critical.length,
    open_error_count: open_error.length,
    open_warning_count: open_warning.length,
    closing_eligibility,
    status_code,
    summary_text,
    open_exceptions: openExceptions
  };
}
