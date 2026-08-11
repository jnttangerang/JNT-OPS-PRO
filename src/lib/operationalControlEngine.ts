import { getExceptions, resolveException, startExceptionReview, ExceptionRecord } from "./reconciliationReviewEngine";
import { getSettlementRecord, processRecordDeposit, processReconcileSettlement, processApproveSettlement, processReopenSettlement, SettlementRecord } from "./settlementEngine";
import { getDailyClosingRecord, validateDailyClosing, executeDailyClosing, reopenDailyClosing, DailyClosingRecord } from "./dailyClosingEngine";
import { getCertificationRecord, validateFinancialClose, certifyFinancialClose, reopenFinancialClose, FinancialCloseCertificationRecord } from "./financialCloseCertificationEngine";
import { logAuditEvent, getAuditTrail } from "./auditTrailEngine";
import { calculateDailyFinancial } from "./financialEngine";

export type RoleType = "OWNER" | "ADMIN";
export type PriorityLevel = "P0" | "P1" | "P2" | "P3";
export type SeverityLevel = "CRITICAL" | "ERROR" | "WARNING" | "INFO";

export interface ActorInfo {
  actor_id: string;
  actor_name?: string;
  actor_role: string;
  outlet_id?: string;
}

export interface ActionableControlItem {
  action_id: string;
  action_type: string;
  severity: SeverityLevel;
  priority: PriorityLevel;
  entity_type: string;
  entity_id: string;
  transaksi_id?: string;
  outlet_id: string;
  tanggal: string;
  title: string;
  description: string;
  recommended_action: string;
  allowed_roles: RoleType[];
  source_engine: string;
  current_status: string;
  can_execute: boolean;
  blocking_reason?: string;
  financial_impact?: number;
}

export interface ControlActionExecutionInput {
  action_id: string;
  action_type: string;
  actor: ActorInfo;
  outlet_id: string;
  tanggal: string;
  entity_type?: string;
  entity_id?: string;
  correlation_id?: string;
  reason?: string;
  params?: any;
}

export interface ControlActionExecutionResult {
  status: "SUCCESS" | "ACTION_REJECTED" | "ACTION_FAILED" | "ACTION_VERIFICATION_FAILED" | "ACTION_ALREADY_COMPLETED";
  action_id: string;
  action_type: string;
  message: string;
  data?: any;
  reason?: string;
  correlation_id?: string;
}

const OWNER_ONLY_ACTIONS = [
  "APPROVE_SETTLEMENT",
  "REOPEN_SETTLEMENT",
  "REJECT_SETTLEMENT",
  "REOPEN_CLOSING",
  "CERTIFY_CLOSE",
  "REOPEN_CERTIFICATION"
];

/**
 * Validates role: strictly OWNER or ADMIN. SUPER_ADMIN or other roles are invalid.
 */
export function isRoleValid(role?: string): boolean {
  if (!role) return false;
  const upper = role.toUpperCase();
  return upper === "OWNER" || upper === "ADMIN";
}

/**
 * Checks if actor is authorized to perform action.
 */
export function checkActionAuthorization(
  db: any,
  actor: ActorInfo,
  actionType: string,
  targetOutletId: string
): { authorized: boolean; reason?: string } {
  const role = (actor.actor_role || "").toUpperCase();

  // Role validation
  if (!isRoleValid(role)) {
    return {
      authorized: false,
      reason: `Role '${actor.actor_role}' tidak valid. Hanya OWNER dan ADMIN yang diizinkan.`
    };
  }

  // Active outlet availability check for ADMIN
  if (role === "ADMIN") {
    if (!targetOutletId) {
      return {
        authorized: false,
        reason: "Akses ditolak: target outlet_id wajib diisi untuk role ADMIN."
      };
    }
    const outlets = db?.MASTER_OUTLET || db?.Outlets || [];
    const isOutletAvailable = outlets.some((o: any) => o.outlet_id === targetOutletId || o.id === targetOutletId);
    if (!isOutletAvailable && targetOutletId !== "ALL") {
      return {
        authorized: false,
        reason: `Akses ditolak: Outlet '${targetOutletId}' tidak tersedia atau tidak diizinkan untuk ADMIN.`
      };
    }
  }

  // Owner-only action check
  if (OWNER_ONLY_ACTIONS.includes(actionType) && role !== "OWNER") {
    return {
      authorized: false,
      reason: `Akses ditolak: Aksi '${actionType}' membutuhkan wewenang OWNER.`
    };
  }

  return { authorized: true };
}

/**
 * Maps severity to priority level deterministically.
 */
export function mapSeverityToPriority(severity: SeverityLevel, isBlocking = false, isMismatch = false): PriorityLevel {
  if (severity === "CRITICAL" || isBlocking || (isMismatch && severity === "ERROR")) return "P0";
  if (severity === "ERROR" || isMismatch) return "P1";
  if (severity === "WARNING") return "P2";
  return "P3";
}

/**
 * Reads state from existing domain engines and computes actionable control items.
 * READ-ONLY: Must NOT perform any mutations or write audit logs.
 */
export function getControlActions(
  db: any,
  params: {
    outlet_id?: string;
    tanggal?: string;
    role?: string;
    actor_id?: string;
  }
): {
  actions: ActionableControlItem[];
  total: number;
  critical: number;
  error: number;
  warning: number;
  info: number;
} {
  const actions: ActionableControlItem[] = [];
  const queryRole = (params.role || "OWNER").toUpperCase();

  // Validate role query
  if (!isRoleValid(queryRole)) {
    return { actions: [], total: 0, critical: 0, error: 0, warning: 0, info: 0 };
  }

  // Determine list of outlets to scan
  let targetOutlets: string[] = [];
  if (params.outlet_id) {
    targetOutlets = [params.outlet_id];
  } else if (queryRole === "ADMIN" && params.actor_id) {
    // ADMIN can only view active outlet
    targetOutlets = [params.outlet_id || "OUTLET-01"];
  } else {
    // OWNER can view all outlets
    const allTxs = db.MASTER_TRANSAKSI || [];
    const outletSet = new Set<string>(allTxs.map((t: any) => t.outlet_id).filter(Boolean));
    if (db.DailyClosing) {
      db.DailyClosing.forEach((c: any) => c.outlet_id && outletSet.add(c.outlet_id));
    }
    if (db.SettlementRecords) {
      db.SettlementRecords.forEach((s: any) => s.outlet_id && outletSet.add(s.outlet_id));
    }
    targetOutlets = Array.from(outletSet);
    if (targetOutlets.length === 0) targetOutlets = ["OUTLET-01"];
  }

  // Determine dates
  const targetDate = params.tanggal;

  for (const outletId of targetOutlets) {
    // 1. RECONCILIATION EXCEPTIONS
    const exceptions: ExceptionRecord[] = (db.ReconciliationExceptions || []).filter((e: ExceptionRecord) => {
      const matchOutlet = !e.outlet_id || e.outlet_id === outletId;
      const matchStatus = e.status === "OPEN" || e.status === "IN_REVIEW" || e.status === "REOPENED";
      const matchDate = !targetDate || (e.detected_at && e.detected_at.startsWith(targetDate)) || (e.created_at && e.created_at.startsWith(targetDate));
      return matchOutlet && matchStatus && matchDate;
    });

    for (const exc of exceptions) {
      const sev = (exc.severity || "ERROR") as SeverityLevel;
      const prio = mapSeverityToPriority(sev);
      const allowedRoles: RoleType[] = ["OWNER", "ADMIN"];

      actions.push({
        action_id: `ACT-EXC-${exc.exception_id}`,
        action_type: "RESOLVE_EXCEPTION",
        severity: sev,
        priority: prio,
        entity_type: "RECONCILIATION_EXCEPTION",
        entity_id: exc.exception_id,
        transaksi_id: exc.transaksi_id,
        outlet_id: outletId,
        tanggal: targetDate || exc.detected_at?.split("T")[0] || new Date().toISOString().split("T")[0],
        title: `Discrepancy [${exc.exception_type}]: ${exc.entity_id}`,
        description: exc.root_cause || "Terdapat perbedaan rekonsiliasi yang memerlukan tindakan resolution.",
        recommended_action: exc.recommendation || "Lakukan review dan tentukan resolution (RESOLVED / ACCEPTED).",
        allowed_roles: allowedRoles,
        source_engine: "reconciliationReviewEngine",
        current_status: exc.status,
        can_execute: true,
        financial_impact: Math.abs(exc.evidence?.amount || exc.financial_impact || 0)
      });
    }

    // 2. SETTLEMENT ACTIONS
    if (targetDate) {
      const stl = getSettlementRecord(db, outletId, targetDate);
      if (stl) {
        if (stl.status === "UNSETTLED" || stl.status === "PENDING_DEPOSIT" || stl.status === "MISMATCH") {
          const isMismatch = stl.status === "MISMATCH" || Math.abs(stl.difference) > 0.01;
          const sev: SeverityLevel = isMismatch ? "CRITICAL" : "ERROR";
          const prio = mapSeverityToPriority(sev, false, isMismatch);

          actions.push({
            action_id: `ACT-STL-${stl.settlement_id}`,
            action_type: "RECORD_DEPOSIT",
            severity: sev,
            priority: prio,
            entity_type: "SETTLEMENT",
            entity_id: stl.settlement_id,
            outlet_id: outletId,
            tanggal: targetDate,
            title: `Settlement Keuangan: ${stl.status}`,
            description: isMismatch 
              ? `Terdapat selisih deposit setoran sebesar Rp ${Math.abs(stl.difference).toLocaleString("id-ID")}.`
              : "Settlement harian belum disetor / dicatat.",
            recommended_action: "Rekam jumlah setoran aktual dan lakukan rekonsiliasi deposit.",
            allowed_roles: ["OWNER", "ADMIN"],
            source_engine: "settlementEngine",
            current_status: stl.status,
            can_execute: true,
            financial_impact: Math.abs(stl.difference || stl.expected_owner_deposit)
          });
        } else if (stl.status === "PENDING_APPROVAL" || stl.status === "MATCHED" || stl.status === "DEPOSIT_RECORDED") {
          actions.push({
            action_id: `ACT-STL-APP-${stl.settlement_id}`,
            action_type: "APPROVE_SETTLEMENT",
            severity: "WARNING",
            priority: "P1",
            entity_type: "SETTLEMENT",
            entity_id: stl.settlement_id,
            outlet_id: outletId,
            tanggal: targetDate,
            title: `Settlement Menunggu Approval Owner`,
            description: `Settlement harian ${stl.settlement_id} telah siap untuk disetujui.`,
            recommended_action: "Review data keuangan dan berikan Owner Approval.",
            allowed_roles: ["OWNER"],
            source_engine: "settlementEngine",
            current_status: stl.status,
            can_execute: queryRole === "OWNER",
            blocking_reason: queryRole !== "OWNER" ? "Membutuhkan wewenang Owner" : undefined,
            financial_impact: stl.expected_owner_deposit
          });
        }
      }

      // 3. DAILY CLOSING ACTIONS
      const dc = getDailyClosingRecord(db, outletId, targetDate);
      if (dc) {
        if (dc.status === "BLOCKED") {
          actions.push({
            action_id: `ACT-DC-${dc.closing_id}`,
            action_type: "VALIDATE_CLOSING",
            severity: "CRITICAL",
            priority: "P0",
            entity_type: "DAILY_CLOSING",
            entity_id: dc.closing_id,
            outlet_id: outletId,
            tanggal: targetDate,
            title: `Daily Closing BLOCKED`,
            description: (dc.blocking_reasons && dc.blocking_reasons.length > 0)
              ? dc.blocking_reasons.join("; ")
              : "Proses closing harian diblokir karena ada exception / selisih.",
            recommended_action: "Selesaikan exception pending lalu jalankan re-validasi closing.",
            allowed_roles: ["OWNER", "ADMIN"],
            source_engine: "dailyClosingEngine",
            current_status: dc.status,
            can_execute: true,
            blocking_reason: dc.blocking_reasons?.join("; ")
          });
        } else if (dc.status === "READY" || dc.status === "OPEN" || dc.status === "VALIDATING") {
          actions.push({
            action_id: `ACT-DC-EXEC-${dc.closing_id}`,
            action_type: "EXECUTE_CLOSING",
            severity: "WARNING",
            priority: "P2",
            entity_type: "DAILY_CLOSING",
            entity_id: dc.closing_id,
            outlet_id: outletId,
            tanggal: targetDate,
            title: `Proses Closing Harian Siap Dieksekusi`,
            description: `Daily closing outlet ${outletId} tanggal ${targetDate} dalam status ${dc.status}.`,
            recommended_action: "Eksekusi daily closing untuk menutup operasional harian.",
            allowed_roles: ["OWNER", "ADMIN"],
            source_engine: "dailyClosingEngine",
            current_status: dc.status,
            can_execute: true
          });
        }
      }

      // 4. FINANCIAL CLOSE CERTIFICATION ACTIONS
      const cert = getCertificationRecord(db, outletId, targetDate);
      if (cert) {
        if (cert.status === "READY_FOR_CERTIFICATION") {
          actions.push({
            action_id: `ACT-CERT-${cert.certification_id}`,
            action_type: "CERTIFY_CLOSE",
            severity: "WARNING",
            priority: "P1",
            entity_type: "FINANCIAL_CERTIFICATION",
            entity_id: cert.certification_id,
            outlet_id: outletId,
            tanggal: targetDate,
            title: `Sertifikasi Penutupan Keuangan Siap`,
            description: `Seluruh kontrol penutupan keuangan outlet ${outletId} tanggal ${targetDate} telah terpenuhi.`,
            recommended_action: "Owner melakukan Final Certification penutupan buku harian.",
            allowed_roles: ["OWNER"],
            source_engine: "financialCloseCertificationEngine",
            current_status: cert.status,
            can_execute: queryRole === "OWNER",
            blocking_reason: queryRole !== "OWNER" ? "Hanya Owner yang dapat melakukan sertifikasi" : undefined
          });
        } else if (cert.status === "BLOCKED") {
          actions.push({
            action_id: `ACT-CERT-BLK-${cert.certification_id}`,
            action_type: "VALIDATE_CERTIFICATION",
            severity: "CRITICAL",
            priority: "P0",
            entity_type: "FINANCIAL_CERTIFICATION",
            entity_id: cert.certification_id,
            outlet_id: outletId,
            tanggal: targetDate,
            title: `Certification Penutupan Keuangan BLOCKED`,
            description: cert.blocking_reasons?.join("; ") || "Proses sertifikasi keuangan diblokir.",
            recommended_action: "Review kegagalan kontrol dan selesaikan prasyarat penutupan.",
            allowed_roles: ["OWNER", "ADMIN"],
            source_engine: "financialCloseCertificationEngine",
            current_status: cert.status,
            can_execute: true,
            blocking_reason: cert.blocking_reasons?.join("; ")
          });
        }
      }
    }
  }

  // Sort actions deterministically: P0 -> P1 -> P2 -> P3, then financial impact descending
  const priorityOrder: Record<PriorityLevel, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  actions.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    const impactDiff = (b.financial_impact || 0) - (a.financial_impact || 0);
    if (impactDiff !== 0) return impactDiff;
    return a.action_id.localeCompare(b.action_id);
  });

  const critical = actions.filter(a => a.severity === "CRITICAL").length;
  const error = actions.filter(a => a.severity === "ERROR").length;
  const warning = actions.filter(a => a.severity === "WARNING").length;
  const info = actions.filter(a => a.severity === "INFO").length;

  return {
    actions,
    total: actions.length,
    critical,
    error,
    warning,
    info
  };
}

/**
 * Orchestrates action execution through existing domain engines, verifies outcome, and writes audit logs.
 */
export function executeControlAction(
  db: any,
  input: ControlActionExecutionInput
): ControlActionExecutionResult {
  const { action_id, action_type, actor, outlet_id, tanggal, correlation_id, reason, entity_id, entity_type, params } = input;
  const corrId = correlation_id || (`CORR-ACT-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`);

  // 1. Audit Started
  logAuditEvent(db, {
    event_type: "CONTROL_ACTION_STARTED",
    action: action_type,
    entity_type: entity_type || "CONTROL_ACTION",
    entity_id: entity_id || action_id,
    outlet_id,
    actor_id: actor.actor_id,
    actor_name: actor.actor_name,
    actor_role: actor.actor_role,
    result: "SUCCESS",
    correlation_id: corrId,
    reason: reason || `Mulai eksekusi kontrol aksi '${action_type}'.`
  });

  // 2. Authorization & Isolation Validation
  const authRes = checkActionAuthorization(db, actor, action_type, outlet_id);
  if (!authRes.authorized) {
    logAuditEvent(db, {
      event_type: "CONTROL_ACTION_REJECTED",
      action: action_type,
      entity_type: entity_type || "CONTROL_ACTION",
      entity_id: entity_id || action_id,
      outlet_id,
      actor_id: actor.actor_id,
      actor_name: actor.actor_name,
      actor_role: actor.actor_role,
      result: "REJECTED",
      correlation_id: corrId,
      reason: authRes.reason || "Akses ditolak"
    });

    return {
      status: "ACTION_REJECTED",
      action_id,
      action_type,
      message: authRes.reason || "Akses ditolak.",
      reason: authRes.reason,
      correlation_id: corrId
    };
  }

  logAuditEvent(db, {
    event_type: "CONTROL_ACTION_AUTHORIZED",
    action: action_type,
    entity_type: entity_type || "CONTROL_ACTION",
    entity_id: entity_id || action_id,
    outlet_id,
    actor_id: actor.actor_id,
    actor_name: actor.actor_name,
    actor_role: actor.actor_role,
    result: "SUCCESS",
    correlation_id: corrId
  });

  // 3. Idempotency Check
  const auditLogs = getAuditTrail(db, { correlation_id: corrId, event_type: "CONTROL_ACTION_VERIFIED" });
  if (auditLogs && auditLogs.length > 0) {
    return {
      status: "ACTION_ALREADY_COMPLETED",
      action_id,
      action_type,
      message: `Aksi '${action_id}' sudah selesai dieksekusi sebelumnya (idempotent).`,
      correlation_id: corrId
    };
  }

  // 4. Execution via Existing Domain Engines
  let domainResult: { status: "success" | "error" | "blocked"; message?: string; data?: any; error_code?: string } = {
    status: "error",
    message: `Aksi '${action_type}' tidak dikenal.`
  };

  try {
    switch (action_type) {
      // RECONCILIATION ACTIONS
      case "RESOLVE_EXCEPTION":
      case "ACCEPT_EXCEPTION": {
        const targetExcId = entity_id || (params && params.exception_id);
        const resolution = action_type === "ACCEPT_EXCEPTION" ? "ACCEPTED" : (params?.resolution || "RESOLVED");
        domainResult = resolveException(db, {
          exception_id: targetExcId,
          resolution,
          resolution_reason: reason || params?.resolution_reason || "Resolution via Operational Control Engine",
          evidence: params?.evidence,
          correlation_id: corrId,
          actor: { actor_id: actor.actor_id, actor_name: actor.actor_name, actor_role: actor.actor_role }
        });
        break;
      }

      case "REVIEW_EXCEPTION": {
        const targetExcId = entity_id || (params && params.exception_id);
        domainResult = startExceptionReview(db, targetExcId, {
          actor_id: actor.actor_id,
          actor_name: actor.actor_name,
          actor_role: actor.actor_role
        });
        break;
      }

      // SETTLEMENT ACTIONS
      case "RECORD_DEPOSIT": {
        const stlRecord = getSettlementRecord(db, outlet_id, tanggal);
        if (!stlRecord) {
          domainResult = { status: "error", message: `Settlement record untuk outlet '${outlet_id}' tanggal '${tanggal}' tidak ditemukan.` };
        } else {
          const actualAmount = params?.actual_amount !== undefined ? Number(params.actual_amount) : stlRecord.expected_owner_deposit;
          domainResult = processRecordDeposit({
            settlement: stlRecord,
            actual_amount: actualAmount,
            setoran_id: params?.setoran_id,
            notes: reason,
            actor: { actor_id: actor.actor_id, actor_name: actor.actor_name, actor_role: actor.actor_role }
          });
          if (domainResult.status === "success" && domainResult.data) {
            Object.assign(stlRecord, domainResult.data);
          }
        }
        break;
      }

      case "RECONCILE_SETTLEMENT": {
        const stlRecord = getSettlementRecord(db, outlet_id, tanggal);
        if (!stlRecord) {
          domainResult = { status: "error", message: `Settlement record untuk outlet '${outlet_id}' tanggal '${tanggal}' tidak ditemukan.` };
        } else {
          const txs = (db.MASTER_TRANSAKSI || []).filter((t: any) => t.outlet_id === outlet_id && t.tanggal_transaksi === tanggal);
          domainResult = processReconcileSettlement({
            settlement: stlRecord,
            transactions: txs,
            actualDepositInput: params?.actual_amount,
            openExceptions: db.ReconciliationExceptions,
            actor: { actor_id: actor.actor_id, actor_name: actor.actor_name, actor_role: actor.actor_role }
          });
          if (domainResult.status === "success" && domainResult.data) {
            Object.assign(stlRecord, domainResult.data);
          }
        }
        break;
      }

      case "APPROVE_SETTLEMENT": {
        const stlRecord = getSettlementRecord(db, outlet_id, tanggal);
        if (!stlRecord) {
          domainResult = { status: "error", message: `Settlement record untuk outlet '${outlet_id}' tanggal '${tanggal}' tidak ditemukan.` };
        } else {
          domainResult = processApproveSettlement({
            settlement: stlRecord,
            openExceptions: db.ReconciliationExceptions,
            actor: { actor_id: actor.actor_id, actor_name: actor.actor_name, actor_role: actor.actor_role },
            allowSelfApproval: params?.allowSelfApproval !== undefined ? params.allowSelfApproval : true
          });
          if (domainResult.status === "success" && domainResult.data) {
            Object.assign(stlRecord, domainResult.data);
          }
        }
        break;
      }

      case "REOPEN_SETTLEMENT": {
        const stlRecord = getSettlementRecord(db, outlet_id, tanggal);
        if (!stlRecord) {
          domainResult = { status: "error", message: `Settlement record tidak ditemukan.` };
        } else {
          domainResult = processReopenSettlement({
            settlement: stlRecord,
            reason: reason || "Reopen settlement requested",
            actor: { actor_id: actor.actor_id, actor_name: actor.actor_name, actor_role: actor.actor_role }
          });
        }
        break;
      }

      // DAILY CLOSING ACTIONS
      case "VALIDATE_CLOSING": {
        domainResult = validateDailyClosing(db, {
          outlet_id,
          tanggal,
          actor: { actor_id: actor.actor_id, actor_name: actor.actor_name, actor_role: actor.actor_role }
        });
        break;
      }

      case "EXECUTE_CLOSING": {
        domainResult = executeDailyClosing(db, {
          outlet_id,
          tanggal,
          actor: { actor_id: actor.actor_id, actor_name: actor.actor_name, actor_role: actor.actor_role },
          notes: reason
        });
        break;
      }

      case "REOPEN_CLOSING": {
        domainResult = reopenDailyClosing(db, {
          outlet_id,
          tanggal,
          reason: reason || "Reopen closing requested",
          actor: { actor_id: actor.actor_id, actor_name: actor.actor_name, actor_role: actor.actor_role }
        });
        break;
      }

      // FINANCIAL CLOSE CERTIFICATION ACTIONS
      case "VALIDATE_CERTIFICATION": {
        domainResult = validateFinancialClose(db, {
          outlet_id,
          tanggal,
          actor: { actor_id: actor.actor_id, actor_name: actor.actor_name || "Actor", actor_role: actor.actor_role }
        });
        break;
      }

      case "CERTIFY_CLOSE": {
        domainResult = certifyFinancialClose(db, {
          outlet_id,
          tanggal,
          actor: { actor_id: actor.actor_id, actor_name: actor.actor_name || "Owner", actor_role: actor.actor_role }
        });
        break;
      }

      case "REOPEN_CERTIFICATION": {
        domainResult = reopenFinancialClose(db, {
          outlet_id,
          tanggal,
          reason: reason || "Reopen certification requested",
          actor: { actor_id: actor.actor_id, actor_name: actor.actor_name || "Owner", actor_role: actor.actor_role }
        });
        break;
      }

      default:
        domainResult = {
          status: "error",
          message: `Action type '${action_type}' tidak didukung oleh Control Engine.`
        };
    }
  } catch (err: any) {
    domainResult = {
      status: "error",
      message: `Kegagalan internal eksekusi domain engine: ${err?.message || err}`
    };
  }

  // Handle Domain Engine Failure
  if (domainResult.status === "error") {
    logAuditEvent(db, {
      event_type: "CONTROL_ACTION_FAILED",
      action: action_type,
      entity_type: entity_type || "CONTROL_ACTION",
      entity_id: entity_id || action_id,
      outlet_id,
      actor_id: actor.actor_id,
      actor_name: actor.actor_name,
      actor_role: actor.actor_role,
      result: "FAILED",
      reason: domainResult.message,
      correlation_id: corrId
    });

    return {
      status: "ACTION_FAILED",
      action_id,
      action_type,
      message: domainResult.message,
      reason: domainResult.message,
      correlation_id: corrId
    };
  }

  // 5. Read-back Verification
  let verificationPassed = false;
  if (action_type === "RESOLVE_EXCEPTION" || action_type === "ACCEPT_EXCEPTION") {
    const targetExcId = entity_id || (params && params.exception_id);
    const updatedExc = (db.ReconciliationExceptions || []).find((e: any) => e.exception_id === targetExcId);
    if (updatedExc && (updatedExc.status === "RESOLVED" || updatedExc.status === "ACCEPTED")) {
      verificationPassed = true;
    }
  } else if (action_type === "RECORD_DEPOSIT" || action_type === "APPROVE_SETTLEMENT" || action_type === "RECONCILE_SETTLEMENT") {
    const updatedStl = getSettlementRecord(db, outlet_id, tanggal);
    if (updatedStl) {
      if (action_type === "APPROVE_SETTLEMENT" && updatedStl.status === "APPROVED") verificationPassed = true;
      else if (action_type === "RECORD_DEPOSIT" && (updatedStl.status === "DEPOSIT_RECORDED" || updatedStl.status === "MATCHED" || updatedStl.status === "MISMATCH")) verificationPassed = true;
      else if (action_type === "RECONCILE_SETTLEMENT") verificationPassed = true;
    }
  } else if (action_type === "EXECUTE_CLOSING" || action_type === "VALIDATE_CLOSING") {
    const updatedDc = getDailyClosingRecord(db, outlet_id, tanggal);
    if (updatedDc) {
      if (action_type === "EXECUTE_CLOSING" && updatedDc.status === "CLOSED") verificationPassed = true;
      else if (action_type === "VALIDATE_CLOSING") verificationPassed = true;
    }
  } else if (action_type === "CERTIFY_CLOSE" || action_type === "VALIDATE_CERTIFICATION") {
    const updatedCert = getCertificationRecord(db, outlet_id, tanggal);
    if (updatedCert) {
      if (action_type === "CERTIFY_CLOSE" && updatedCert.status === "CERTIFIED") verificationPassed = true;
      else if (action_type === "VALIDATE_CERTIFICATION") verificationPassed = true;
    }
  } else {
    verificationPassed = true;
  }

  if (!verificationPassed) {
    logAuditEvent(db, {
      event_type: "CONTROL_ACTION_FAILED",
      action: action_type,
      entity_type: entity_type || "CONTROL_ACTION",
      entity_id: entity_id || action_id,
      outlet_id,
      actor_id: actor.actor_id,
      actor_name: actor.actor_name,
      actor_role: actor.actor_role,
      result: "FAILED",
      reason: "Verifikasi read-back gagal setelah eksekusi.",
      correlation_id: corrId
    });

    return {
      status: "ACTION_VERIFICATION_FAILED",
      action_id,
      action_type,
      message: "Proses verifikasi pasca eksekusi gagal.",
      reason: "Read-back state verification failed",
      correlation_id: corrId
    };
  }

  // 6. Log Success Events
  logAuditEvent(db, {
    event_type: "CONTROL_ACTION_EXECUTED",
    action: action_type,
    entity_type: entity_type || "CONTROL_ACTION",
    entity_id: entity_id || action_id,
    outlet_id,
    actor_id: actor.actor_id,
    actor_name: actor.actor_name,
    actor_role: actor.actor_role,
    result: "SUCCESS",
    correlation_id: corrId,
    after: domainResult.data
  });

  logAuditEvent(db, {
    event_type: "CONTROL_ACTION_VERIFIED",
    action: action_type,
    entity_type: entity_type || "CONTROL_ACTION",
    entity_id: entity_id || action_id,
    outlet_id,
    actor_id: actor.actor_id,
    actor_name: actor.actor_name,
    actor_role: actor.actor_role,
    result: "SUCCESS",
    correlation_id: corrId
  });

  return {
    status: "SUCCESS",
    action_id,
    action_type,
    message: domainResult.message || `Aksi '${action_type}' berhasil dijalankan dan diverifikasi.`,
    data: domainResult.data,
    correlation_id: corrId
  };
}
