import { logAuditEvent } from "./auditTrailEngine";
import { getControlActions } from "./operationalControlEngine";

export type RoleType = "OWNER" | "ADMIN";
export type PriorityLevel = "P0" | "P1" | "P2" | "P3";
export type SeverityLevel = "CRITICAL" | "ERROR" | "WARNING" | "INFO";

export type WorkflowStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "PENDING_VERIFICATION"
  | "RESOLVED"
  | "VERIFIED"
  | "CLOSED"
  | "ESCALATED"
  | "BLOCKED"
  | "REOPENED";

export type SLAStatus =
  | "ON_TRACK"
  | "DUE_SOON"
  | "OVERDUE"
  | "BREACHED"
  | "RESOLVED"
  | "CLOSED";

export type AgeingBucket =
  | "< 1 jam"
  | "1–4 jam"
  | "4–24 jam"
  | "1–3 hari"
  | "> 3 hari";

export interface WorkflowCaseRecord {
  workflow_id: string;
  action_id: string;
  source_type: string;
  source_id: string;
  outlet_id: string;
  transaksi_id?: string;
  priority: PriorityLevel;
  severity: SeverityLevel;
  title: string;
  description: string;
  assigned_to?: string;
  assigned_role?: RoleType;
  assigned_at?: string;
  created_at: string;
  due_at: string;
  completed_at?: string;
  status: WorkflowStatus;
  resolution?: string;
  resolution_note?: string;
  resolution_code?: string;
  resolved_by?: string;
  resolved_at?: string;
  verified_by?: string;
  verified_at?: string;
  verification_result?: string;
  verification_note?: string;
  evidence?: any;
  escalation_level: number;
  escalation_required?: boolean;
  updated_at: string;
}

export interface ActorInfo {
  actor_id: string;
  actor_name?: string;
  actor_role: string;
  outlet_id?: string;
}

export const SLA_HOURS_MAP: Record<PriorityLevel, number> = {
  P0: 1,    // 1 Hour
  P1: 4,    // 4 Hours
  P2: 24,   // 24 Hours
  P3: 72    // 72 Hours
};

export const VALID_RESOLUTION_CODES = [
  "DATA_CORRECTED",
  "MISSING_DATA_COMPLETED",
  "SETTLEMENT_REVIEWED",
  "RECONCILIATION_RESOLVED",
  "PHOTO_COMPLETED",
  "CUSTOMER_DATA_COMPLETED",
  "TRANSACTION_REVIEWED",
  "FALSE_POSITIVE",
  "ACCEPTED_BY_OWNER"
];

const VALID_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  OPEN: ["ASSIGNED", "IN_PROGRESS", "ESCALATED"],
  ASSIGNED: ["IN_PROGRESS", "ESCALATED"],
  IN_PROGRESS: ["PENDING_VERIFICATION", "RESOLVED", "BLOCKED", "ESCALATED"],
  BLOCKED: ["IN_PROGRESS", "ESCALATED"],
  ESCALATED: ["IN_PROGRESS"],
  PENDING_VERIFICATION: ["RESOLVED", "VERIFIED", "REOPENED"],
  RESOLVED: ["PENDING_VERIFICATION", "VERIFIED", "REOPENED"],
  VERIFIED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "ASSIGNED"]
};

export function isRoleValid(role?: string): boolean {
  if (!role) return false;
  const upper = role.toUpperCase();
  return upper === "OWNER" || upper === "ADMIN";
}

export function checkWorkflowAuthorization(
  db: any,
  actor: ActorInfo,
  targetOutletId: string,
  requiresOwner: boolean = false
): { authorized: boolean; reason?: string } {
  const role = (actor.actor_role || "").toUpperCase();

  if (!isRoleValid(role)) {
    return {
      authorized: false,
      reason: `Role '${actor.actor_role}' tidak valid. Hanya OWNER dan ADMIN yang diizinkan.`
    };
  }

  if (requiresOwner && role !== "OWNER") {
    return {
      authorized: false,
      reason: `Aksi ini membutuhkan role OWNER.`
    };
  }

  if (role === "ADMIN") { 
    const outlets = db?.MASTER_OUTLET || db?.Outlets || [];
    const isOutletAvailable = outlets.some((o: any) => o.outlet_id === targetOutletId || o.id === targetOutletId);
    if (!isOutletAvailable && targetOutletId !== "ALL" && targetOutletId) {
      return {
        authorized: false,
        reason: `Akses ditolak: Outlet '${targetOutletId}' tidak tersedia atau tidak diizinkan untuk ADMIN.`
      };
    }
  }

  return { authorized: true };
}

export function isValidWorkflowTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
  if (from === to) return true;
  // Explicitly forbidden transitions
  if (from === "CLOSED" && to === "OPEN") return false;
  if (from === "VERIFIED" && to === "IN_PROGRESS") return false;
  if (from === "RESOLVED" && to === "OPEN") return false;
  if (from === "OPEN" && to === "CLOSED") return false;
  if (from === "OPEN" && to === "VERIFIED") return false;

  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function calculateDueAt(createdAt: string, priority: PriorityLevel): string {
  const createdTime = new Date(createdAt).getTime();
  const hours = SLA_HOURS_MAP[priority] || 24;
  return new Date(createdTime + hours * 3600 * 1000).toISOString();
}

export function evaluateSLAAndAgeing(
  workflow: WorkflowCaseRecord,
  nowMs: number = Date.now()
): {
  sla_status: SLAStatus;
  age_ms: number;
  ageing_bucket: AgeingBucket;
  sla_remaining_ms: number;
  is_overdue: boolean;
  is_breached: boolean;
} {
  const createdMs = new Date(workflow.created_at).getTime();
  const dueMs = new Date(workflow.due_at).getTime();
  const ageMs = Math.max(0, nowMs - createdMs);
  const remainingMs = dueMs - nowMs;

  let ageing_bucket: AgeingBucket = "< 1 jam";
  const hours = ageMs / (1000 * 3600);
  if (hours < 1) ageing_bucket = "< 1 jam";
  else if (hours <= 4) ageing_bucket = "1–4 jam";
  else if (hours <= 24) ageing_bucket = "4–24 jam";
  else if (hours <= 72) ageing_bucket = "1–3 hari";
  else ageing_bucket = "> 3 hari";

  if (workflow.status === "CLOSED") {
    return { sla_status: "CLOSED", age_ms: ageMs, ageing_bucket, sla_remaining_ms: remainingMs, is_overdue: false, is_breached: false };
  }
  if (["RESOLVED", "PENDING_VERIFICATION", "VERIFIED"].includes(workflow.status)) {
    return { sla_status: "RESOLVED", age_ms: ageMs, ageing_bucket, sla_remaining_ms: remainingMs, is_overdue: false, is_breached: false };
  }

  const is_overdue = nowMs > dueMs;
  const is_breached = is_overdue || workflow.escalation_required || workflow.status === "ESCALATED";

  let sla_status: SLAStatus = "ON_TRACK";
  if (is_breached) {
    sla_status = "BREACHED";
  } else if (is_overdue) {
    sla_status = "OVERDUE";
  } else {
    const totalSlaMs = (SLA_HOURS_MAP[workflow.priority] || 24) * 3600 * 1000;
    if (remainingMs <= 0.25 * totalSlaMs) {
      sla_status = "DUE_SOON";
    } else {
      sla_status = "ON_TRACK";
    }
  }

  return { sla_status, age_ms: ageMs, ageing_bucket, sla_remaining_ms: remainingMs, is_overdue, is_breached };
}

export function ensureWorkflowCasesTable(db: any): WorkflowCaseRecord[] {
  if (!db.WorkflowCases) {
    db.WorkflowCases = [];
  }
  return db.WorkflowCases;
}

/**
 * Automatically syncs workflow cases from Phase 36 Control Actions.
 */
export function syncWorkflowsFromControlEngine(
  db: any,
  params: { outlet_id?: string; tanggal?: string } = {}
): WorkflowCaseRecord[] {
  const table = ensureWorkflowCasesTable(db);
  const actionsRes = getControlActions(db, {
    outlet_id: params.outlet_id,
    tanggal: params.tanggal,
    role: "OWNER"
  });

  const nowIso = new Date().toISOString();

  for (const item of actionsRes.actions) {
    const existing = table.find(
      w => w.action_id === item.action_id || (w.source_type === item.entity_type && w.source_id === item.entity_id)
    );

    if (!existing) {
      const createdAt = item.tanggal ? `${item.tanggal}T08:00:00.000Z` : nowIso;
      const dueAt = calculateDueAt(createdAt, item.priority);
      const defaultRole = (item.allowed_roles.includes("ADMIN") && item.allowed_roles.length === 1) ? "ADMIN" : "OWNER";

      const newCase: WorkflowCaseRecord = {
        workflow_id: `WF-${item.action_id}`,
        action_id: item.action_id,
        source_type: item.entity_type,
        source_id: item.entity_id,
        outlet_id: item.outlet_id,
        transaksi_id: item.transaksi_id,
        priority: item.priority,
        severity: item.severity,
        title: item.title,
        description: item.description,
        assigned_role: defaultRole as RoleType,
        created_at: createdAt,
        due_at: dueAt,
        status: "OPEN",
        escalation_level: 0,
        escalation_required: false,
        updated_at: nowIso
      };

      table.push(newCase);
    }
  }

  // Auto process SLA breaches/escalations
  processEscalations(db);

  return table;
}

/**
 * Scans open/active workflow cases and triggers SLA breaches/escalations.
 */
export function processEscalations(db: any, nowMs: number = Date.now()): number {
  const table = ensureWorkflowCasesTable(db);
  let escalationCount = 0;

  for (const wf of table) {
    if (["RESOLVED", "VERIFIED", "CLOSED"].includes(wf.status)) continue;

    const evalResult = evaluateSLAAndAgeing(wf, nowMs);

    if ((evalResult.is_overdue || evalResult.is_breached) && !wf.escalation_required) {
      wf.escalation_required = true;
      wf.escalation_level = (wf.escalation_level || 0) + 1;
      wf.status = "ESCALATED";
      wf.updated_at = new Date(nowMs).toISOString();
      escalationCount++;

      logAuditEvent(db, {
        entity_type: "WORKFLOW_CASE",
        entity_id: wf.workflow_id,
        transaksi_id: wf.transaksi_id,
        outlet_id: wf.outlet_id,
        event_type: "WORKFLOW_SLA_BREACHED",
        action: "SLA_BREACH_ESCALATION",
        previous_status: wf.status,
        new_status: "ESCALATED",
        result: "WARNING",
        reason: `SLA breached for workflow '${wf.workflow_id}' (${wf.priority}). Escalation level set to ${wf.escalation_level}.`,
        metadata: { priority: wf.priority, due_at: wf.due_at, escalation_level: wf.escalation_level }
      });

      logAuditEvent(db, {
        entity_type: "WORKFLOW_CASE",
        entity_id: wf.workflow_id,
        transaksi_id: wf.transaksi_id,
        outlet_id: wf.outlet_id,
        event_type: "WORKFLOW_ESCALATED",
        action: "ESCALATE_WORKFLOW",
        previous_status: wf.status,
        new_status: "ESCALATED",
        result: "WARNING",
        reason: `Workflow escalated to level ${wf.escalation_level}`,
        metadata: { escalation_level: wf.escalation_level }
      });
    }
  }

  return escalationCount;
}

/**
 * Creates a new Workflow Case.
 */
export function createWorkflowCase(
  db: any,
  input: {
    action_id?: string;
    source_type: string;
    source_id: string;
    outlet_id: string;
    transaksi_id?: string;
    priority: PriorityLevel;
    severity: SeverityLevel;
    title: string;
    description: string;
    assigned_to?: string;
    assigned_role?: RoleType;
    created_at?: string;
    actor: ActorInfo;
  }
): { status: "success" | "error"; message: string; data?: WorkflowCaseRecord; error_code?: string } {
  const auth = checkWorkflowAuthorization(db, input.actor, input.outlet_id);
  if (!auth.authorized) {
    return { status: "error", message: auth.reason || "Unauthorized", error_code: "UNAUTHORIZED" };
  }

  const table = ensureWorkflowCasesTable(db);
  const actId = input.action_id || `ACT-${input.source_type}-${input.source_id}`;

  // Idempotency: Check if active workflow exists for same source / action
  const existing = table.find(
    w => (w.action_id === actId || (w.source_type === input.source_type && w.source_id === input.source_id)) &&
         w.status !== "CLOSED"
  );

  if (existing) {
    return {
      status: "success",
      message: `Workflow case sudah ada untuk action '${actId}'.`,
      data: existing
    };
  }

  const createdAt = input.created_at || new Date().toISOString();
  const dueAt = calculateDueAt(createdAt, input.priority);
  const wfId = `WF-${actId}-${Date.now()}`;

  const newCase: WorkflowCaseRecord = {
    workflow_id: wfId,
    action_id: actId,
    source_type: input.source_type,
    source_id: input.source_id,
    outlet_id: input.outlet_id,
    transaksi_id: input.transaksi_id,
    priority: input.priority,
    severity: input.severity,
    title: input.title,
    description: input.description,
    assigned_to: input.assigned_to,
    assigned_role: input.assigned_role || "ADMIN",
    assigned_at: input.assigned_to ? createdAt : undefined,
    created_at: createdAt,
    due_at: dueAt,
    status: input.assigned_to ? "ASSIGNED" : "OPEN",
    escalation_level: 0,
    escalation_required: false,
    updated_at: createdAt
  };

  table.push(newCase);

  logAuditEvent(db, {
    actor_id: input.actor.actor_id,
    actor_name: input.actor.actor_name,
    actor_role: input.actor.actor_role,
    outlet_id: input.outlet_id,
    entity_type: "WORKFLOW_CASE",
    entity_id: wfId,
    transaksi_id: input.transaksi_id,
    event_type: "WORKFLOW_CREATED",
    action: "CREATE_WORKFLOW",
    new_status: newCase.status,
    result: "SUCCESS",
    reason: `Workflow case '${wfId}' berhasil dibuat.`,
    metadata: { priority: input.priority, severity: input.severity, due_at: dueAt }
  });

  if (input.assigned_to) {
    logAuditEvent(db, {
      actor_id: input.actor.actor_id,
      actor_name: input.actor.actor_name,
      actor_role: input.actor.actor_role,
      outlet_id: input.outlet_id,
      entity_type: "WORKFLOW_CASE",
      entity_id: wfId,
      event_type: "WORKFLOW_ASSIGNED",
      action: "ASSIGN_WORKFLOW",
      new_status: "ASSIGNED",
      result: "SUCCESS",
      reason: `Workflow case '${wfId}' ditugaskan kepada '${input.assigned_to}'.`
    });
  }

  return { status: "success", message: `Workflow case '${wfId}' berhasil dibuat.`, data: newCase };
}

/**
 * Assigns a Workflow Case to an actor.
 */
export function assignWorkflowCase(
  db: any,
  input: {
    workflow_id: string;
    assigned_to: string;
    assigned_role?: RoleType;
    actor: ActorInfo;
  }
): { status: "success" | "error"; message: string; data?: WorkflowCaseRecord; error_code?: string } {
  const table = ensureWorkflowCasesTable(db);
  const wf = table.find(w => w.workflow_id === input.workflow_id);

  if (!wf) {
    return { status: "error", message: `Workflow case '${input.workflow_id}' tidak ditemukan.`, error_code: "NOT_FOUND" };
  }

  const auth = checkWorkflowAuthorization(db, input.actor, wf.outlet_id);
  if (!auth.authorized) {
    return { status: "error", message: auth.reason || "Unauthorized", error_code: "UNAUTHORIZED" };
  }

  if (!isValidWorkflowTransition(wf.status, "ASSIGNED") && wf.status !== "ASSIGNED" && wf.status !== "OPEN") {
    return { status: "error", message: `Transisi status dari '${wf.status}' ke 'ASSIGNED' tidak valid.`, error_code: "INVALID_TRANSITION" };
  }

  const prevStatus = wf.status;
  wf.assigned_to = input.assigned_to;
  wf.assigned_role = input.assigned_role || wf.assigned_role || "ADMIN";
  wf.assigned_at = new Date().toISOString();
  if (wf.status === "OPEN") {
    wf.status = "ASSIGNED";
  }
  wf.updated_at = new Date().toISOString();

  logAuditEvent(db, {
    actor_id: input.actor.actor_id,
    actor_name: input.actor.actor_name,
    actor_role: input.actor.actor_role,
    outlet_id: wf.outlet_id,
    entity_type: "WORKFLOW_CASE",
    entity_id: wf.workflow_id,
    transaksi_id: wf.transaksi_id,
    event_type: "WORKFLOW_ASSIGNED",
    action: "ASSIGN_WORKFLOW",
    previous_status: prevStatus,
    new_status: wf.status,
    result: "SUCCESS",
    reason: `Workflow '${wf.workflow_id}' ditugaskan kepada '${input.assigned_to}' (${wf.assigned_role}).`
  });

  return { status: "success", message: `Workflow '${wf.workflow_id}' berhasil ditugaskan.`, data: wf };
}

/**
 * Starts working on a Workflow Case (transition to IN_PROGRESS).
 */
export function startWorkflowCase(
  db: any,
  input: {
    workflow_id: string;
    actor: ActorInfo;
  }
): { status: "success" | "error"; message: string; data?: WorkflowCaseRecord; error_code?: string } {
  const table = ensureWorkflowCasesTable(db);
  const wf = table.find(w => w.workflow_id === input.workflow_id);

  if (!wf) {
    return { status: "error", message: `Workflow case '${input.workflow_id}' tidak ditemukan.`, error_code: "NOT_FOUND" };
  }

  const auth = checkWorkflowAuthorization(db, input.actor, wf.outlet_id);
  if (!auth.authorized) {
    return { status: "error", message: auth.reason || "Unauthorized", error_code: "UNAUTHORIZED" };
  }

  if (!isValidWorkflowTransition(wf.status, "IN_PROGRESS")) {
    return { status: "error", message: `Transisi status dari '${wf.status}' ke 'IN_PROGRESS' tidak valid.`, error_code: "INVALID_TRANSITION" };
  }

  const prevStatus = wf.status;
  wf.status = "IN_PROGRESS";
  if (!wf.assigned_to) {
    wf.assigned_to = input.actor.actor_id;
    wf.assigned_role = input.actor.actor_role as RoleType;
    wf.assigned_at = new Date().toISOString();
  }
  wf.updated_at = new Date().toISOString();

  logAuditEvent(db, {
    actor_id: input.actor.actor_id,
    actor_name: input.actor.actor_name,
    actor_role: input.actor.actor_role,
    outlet_id: wf.outlet_id,
    entity_type: "WORKFLOW_CASE",
    entity_id: wf.workflow_id,
    transaksi_id: wf.transaksi_id,
    event_type: "WORKFLOW_STARTED",
    action: "START_WORKFLOW",
    previous_status: prevStatus,
    new_status: "IN_PROGRESS",
    result: "SUCCESS",
    reason: `Workflow '${wf.workflow_id}' mulai dikerjakan oleh '${input.actor.actor_id}'.`
  });

  return { status: "success", message: `Workflow '${wf.workflow_id}' dalam pengerjaan.`, data: wf };
}

/**
 * Resolves a Workflow Case.
 */
export function resolveWorkflowCase(
  db: any,
  input: {
    workflow_id: string;
    resolution_code: string;
    resolution_note: string;
    evidence?: any;
    actor: ActorInfo;
  }
): { status: "success" | "error"; message: string; data?: WorkflowCaseRecord; error_code?: string } {
  const table = ensureWorkflowCasesTable(db);
  const wf = table.find(w => w.workflow_id === input.workflow_id);

  if (!wf) {
    return { status: "error", message: `Workflow case '${input.workflow_id}' tidak ditemukan.`, error_code: "NOT_FOUND" };
  }

  const auth = checkWorkflowAuthorization(db, input.actor, wf.outlet_id);
  if (!auth.authorized) {
    return { status: "error", message: auth.reason || "Unauthorized", error_code: "UNAUTHORIZED" };
  }

  if (!VALID_RESOLUTION_CODES.includes(input.resolution_code)) {
    return { status: "error", message: `Resolution code '${input.resolution_code}' tidak valid.`, error_code: "INVALID_RESOLUTION_CODE" };
  }

  if (!input.resolution_note || input.resolution_note.trim().length === 0) {
    return { status: "error", message: "Catatan resolusi wajib diisi.", error_code: "MISSING_RESOLUTION_NOTE" };
  }

  if (!isValidWorkflowTransition(wf.status, "RESOLVED")) {
    return { status: "error", message: `Transisi status dari '${wf.status}' ke 'RESOLVED' tidak valid.`, error_code: "INVALID_TRANSITION" };
  }

  const prevStatus = wf.status;
  const nowIso = new Date().toISOString();

  wf.status = "RESOLVED";
  wf.resolution_code = input.resolution_code;
  wf.resolution_note = input.resolution_note.trim();
  wf.resolution = `${input.resolution_code}: ${input.resolution_note.trim()}`;
  wf.resolved_by = input.actor.actor_id;
  wf.resolved_at = nowIso;
  if (input.evidence) wf.evidence = input.evidence;
  wf.updated_at = nowIso;

  logAuditEvent(db, {
    actor_id: input.actor.actor_id,
    actor_name: input.actor.actor_name,
    actor_role: input.actor.actor_role,
    outlet_id: wf.outlet_id,
    entity_type: "WORKFLOW_CASE",
    entity_id: wf.workflow_id,
    transaksi_id: wf.transaksi_id,
    event_type: "WORKFLOW_RESOLVED",
    action: "RESOLVE_WORKFLOW",
    previous_status: prevStatus,
    new_status: "RESOLVED",
    result: "SUCCESS",
    reason: `Workflow '${wf.workflow_id}' diselesaikan dengan kode '${input.resolution_code}'.`
  });

  return { status: "success", message: `Workflow '${wf.workflow_id}' berhasil diselesaikan.`, data: wf };
}

/**
 * Verifies a resolved Workflow Case.
 */
export function verifyWorkflowCase(
  db: any,
  input: {
    workflow_id: string;
    verification_result: "PASS" | "FAIL";
    verification_note?: string;
    actor: ActorInfo;
  }
): { status: "success" | "error"; message: string; data?: WorkflowCaseRecord; error_code?: string } {
  const table = ensureWorkflowCasesTable(db);
  const wf = table.find(w => w.workflow_id === input.workflow_id);

  if (!wf) {
    return { status: "error", message: `Workflow case '${input.workflow_id}' tidak ditemukan.`, error_code: "NOT_FOUND" };
  }

  // Verification requires OWNER if case is P0 or financial
  const requiresOwner = wf.priority === "P0" || wf.source_type === "FINANCIAL_CERTIFICATION";
  const auth = checkWorkflowAuthorization(db, input.actor, wf.outlet_id, requiresOwner);
  if (!auth.authorized) {
    return { status: "error", message: auth.reason || "Unauthorized", error_code: "UNAUTHORIZED" };
  }

  if (wf.status !== "RESOLVED" && wf.status !== "PENDING_VERIFICATION") {
    return { status: "error", message: `Hanya workflow berstatus 'RESOLVED' atau 'PENDING_VERIFICATION' yang dapat diverifikasi (Status saat ini: '${wf.status}').`, error_code: "INVALID_STATE_FOR_VERIFICATION" };
  }

  const prevStatus = wf.status;
  const nowIso = new Date().toISOString();

  logAuditEvent(db, {
    actor_id: input.actor.actor_id,
    actor_name: input.actor.actor_name,
    actor_role: input.actor.actor_role,
    outlet_id: wf.outlet_id,
    entity_type: "WORKFLOW_CASE",
    entity_id: wf.workflow_id,
    event_type: "WORKFLOW_VERIFICATION_STARTED",
    action: "START_VERIFICATION",
    previous_status: prevStatus,
    result: "SUCCESS",
    reason: `Proses verifikasi dimulai untuk workflow '${wf.workflow_id}'.`
  });

  if (input.verification_result === "PASS") {
    wf.status = "VERIFIED";
    wf.verified_by = input.actor.actor_id;
    wf.verified_at = nowIso;
    wf.verification_result = "PASS";
    wf.verification_note = input.verification_note || "Verification Passed";
    wf.updated_at = nowIso;

    logAuditEvent(db, {
      actor_id: input.actor.actor_id,
      actor_name: input.actor.actor_name,
      actor_role: input.actor.actor_role,
      outlet_id: wf.outlet_id,
      entity_type: "WORKFLOW_CASE",
      entity_id: wf.workflow_id,
      transaksi_id: wf.transaksi_id,
      event_type: "WORKFLOW_VERIFIED",
      action: "VERIFY_WORKFLOW_PASS",
      previous_status: prevStatus,
      new_status: "VERIFIED",
      result: "SUCCESS",
      reason: `Verifikasi sukses untuk workflow '${wf.workflow_id}'.`
    });

    return { status: "success", message: `Verifikasi workflow '${wf.workflow_id}' LULUS.`, data: wf };
  } else {
    wf.status = "REOPENED";
    wf.verification_result = "FAIL";
    wf.verification_note = input.verification_note || "Verification Failed";
    wf.updated_at = nowIso;

    logAuditEvent(db, {
      actor_id: input.actor.actor_id,
      actor_name: input.actor.actor_name,
      actor_role: input.actor.actor_role,
      outlet_id: wf.outlet_id,
      entity_type: "WORKFLOW_CASE",
      entity_id: wf.workflow_id,
      transaksi_id: wf.transaksi_id,
      event_type: "WORKFLOW_REOPENED",
      action: "VERIFY_WORKFLOW_FAIL",
      previous_status: prevStatus,
      new_status: "REOPENED",
      result: "WARNING",
      reason: `Verifikasi gagal untuk workflow '${wf.workflow_id}': ${wf.verification_note}`
    });

    return { status: "success", message: `Verifikasi gagal. Workflow '${wf.workflow_id}' dibuka kembali (REOPENED).`, data: wf };
  }
}

/**
 * Reopens a Workflow Case.
 */
export function reopenWorkflowCase(
  db: any,
  input: {
    workflow_id: string;
    reason: string;
    actor: ActorInfo;
  }
): { status: "success" | "error"; message: string; data?: WorkflowCaseRecord; error_code?: string } {
  const table = ensureWorkflowCasesTable(db);
  const wf = table.find(w => w.workflow_id === input.workflow_id);

  if (!wf) {
    return { status: "error", message: `Workflow case '${input.workflow_id}' tidak ditemukan.`, error_code: "NOT_FOUND" };
  }

  const auth = checkWorkflowAuthorization(db, input.actor, wf.outlet_id);
  if (!auth.authorized) {
    return { status: "error", message: auth.reason || "Unauthorized", error_code: "UNAUTHORIZED" };
  }

  if (!isValidWorkflowTransition(wf.status, "REOPENED")) {
    return { status: "error", message: `Transisi status dari '${wf.status}' ke 'REOPENED' tidak valid.`, error_code: "INVALID_TRANSITION" };
  }

  const prevStatus = wf.status;
  const nowIso = new Date().toISOString();

  wf.status = "REOPENED";
  wf.resolution = undefined;
  wf.completed_at = undefined;
  wf.updated_at = nowIso;

  logAuditEvent(db, {
    actor_id: input.actor.actor_id,
    actor_name: input.actor.actor_name,
    actor_role: input.actor.actor_role,
    outlet_id: wf.outlet_id,
    entity_type: "WORKFLOW_CASE",
    entity_id: wf.workflow_id,
    transaksi_id: wf.transaksi_id,
    event_type: "WORKFLOW_REOPENED",
    action: "REOPEN_WORKFLOW",
    previous_status: prevStatus,
    new_status: "REOPENED",
    result: "SUCCESS",
    reason: `Workflow '${wf.workflow_id}' dibuka kembali: ${input.reason}`
  });

  return { status: "success", message: `Workflow '${wf.workflow_id}' dibuka kembali.`, data: wf };
}

/**
 * Closes a Workflow Case.
 */
export function closeWorkflowCase(
  db: any,
  input: {
    workflow_id: string;
    actor: ActorInfo;
  }
): { status: "success" | "error"; message: string; data?: WorkflowCaseRecord; error_code?: string } {
  const table = ensureWorkflowCasesTable(db);
  const wf = table.find(w => w.workflow_id === input.workflow_id);

  if (!wf) {
    return { status: "error", message: `Workflow case '${input.workflow_id}' tidak ditemukan.`, error_code: "NOT_FOUND" };
  }

  const auth = checkWorkflowAuthorization(db, input.actor, wf.outlet_id);
  if (!auth.authorized) {
    return { status: "error", message: auth.reason || "Unauthorized", error_code: "UNAUTHORIZED" };
  }

  if (!isValidWorkflowTransition(wf.status, "CLOSED")) {
    return { status: "error", message: `Transisi status dari '${wf.status}' ke 'CLOSED' tidak valid. Hanya VERIFIED yang dapat di-close.`, error_code: "INVALID_TRANSITION" };
  }

  const prevStatus = wf.status;
  const nowIso = new Date().toISOString();

  wf.status = "CLOSED";
  wf.completed_at = nowIso;
  wf.updated_at = nowIso;

  logAuditEvent(db, {
    actor_id: input.actor.actor_id,
    actor_name: input.actor.actor_name,
    actor_role: input.actor.actor_role,
    outlet_id: wf.outlet_id,
    entity_type: "WORKFLOW_CASE",
    entity_id: wf.workflow_id,
    transaksi_id: wf.transaksi_id,
    event_type: "WORKFLOW_CLOSED",
    action: "CLOSE_WORKFLOW",
    previous_status: prevStatus,
    new_status: "CLOSED",
    result: "SUCCESS",
    reason: `Workflow '${wf.workflow_id}' secara resmi ditutup (CLOSED).`
  });

  return { status: "success", message: `Workflow '${wf.workflow_id}' resmi ditutup.`, data: wf };
}

/**
 * Query workflow list with filtering, SLA evaluation, and role isolation.
 */
export function getWorkflowList(
  db: any,
  params: {
    outlet_id?: string;
    tanggal?: string;
    role?: string;
    actor_id?: string;
    status?: string;
    priority?: string;
    sla_status?: string;
  } = {}
) {
  // Sync workflows from control engine
  syncWorkflowsFromControlEngine(db, { outlet_id: params.outlet_id, tanggal: params.tanggal });

  const table = ensureWorkflowCasesTable(db);
  const nowMs = Date.now();

  const filtered = table.filter(wf => {
    // Outlet isolation
    if (params.outlet_id && wf.outlet_id !== params.outlet_id) return false;

    // Date isolation if specified
    if (params.tanggal && !wf.created_at.startsWith(params.tanggal)) return false;

    // Status filter
    if (params.status && wf.status !== params.status) return false;

    // Priority filter
    if (params.priority && wf.priority !== params.priority) return false;

    // Role boundary for ADMIN
    if (params.role && params.role.toUpperCase() === "ADMIN" && params.actor_id) {
      if (params.outlet_id && wf.outlet_id !== params.outlet_id) return false;
    }

    return true;
  });

  // Attach dynamic SLA and ageing info
  const items = filtered.map(wf => {
    const evalData = evaluateSLAAndAgeing(wf, nowMs);
    return {
      ...wf,
      sla_status: evalData.sla_status,
      age_ms: evalData.age_ms,
      ageing_bucket: evalData.ageing_bucket,
      sla_remaining_ms: evalData.sla_remaining_ms,
      is_overdue: evalData.is_overdue,
      is_breached: evalData.is_breached
    };
  });

  // Filter by sla_status if requested
  const resultItems = params.sla_status
    ? items.filter(i => i.sla_status === params.sla_status)
    : items;

  // Sorting priority: CRITICAL/P0 -> OVERDUE -> BREACHED -> DUE_SOON -> NORMAL
  const prioWeight: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const slaWeight: Record<string, number> = { BREACHED: 0, OVERDUE: 1, DUE_SOON: 2, ON_TRACK: 3, RESOLVED: 4, CLOSED: 5 };

  resultItems.sort((a, b) => {
    const pDiff = prioWeight[a.priority] - prioWeight[b.priority];
    if (pDiff !== 0) return pDiff;

    const sDiff = slaWeight[a.sla_status] - slaWeight[b.sla_status];
    if (sDiff !== 0) return sDiff;

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return resultItems;
}

/**
 * Gets detail of a single workflow case with evaluation.
 */
export function getWorkflowDetail(db: any, workflow_id: string, actor: ActorInfo) {
  const table = ensureWorkflowCasesTable(db);
  const wf = table.find(w => w.workflow_id === workflow_id);

  if (!wf) return null;

  const auth = checkWorkflowAuthorization(db, actor, wf.outlet_id);
  if (!auth.authorized) return null;

  const evalData = evaluateSLAAndAgeing(wf, Date.now());
  return {
    ...wf,
    sla_status: evalData.sla_status,
    age_ms: evalData.age_ms,
    ageing_bucket: evalData.ageing_bucket,
    sla_remaining_ms: evalData.sla_remaining_ms,
    is_overdue: evalData.is_overdue,
    is_breached: evalData.is_breached
  };
}

/**
 * Generates summary metrics for Control Tower.
 */
export function getWorkflowSummary(db: any, params: { outlet_id?: string; tanggal?: string } = {}) {
  const list = getWorkflowList(db, params);

  const total_open = list.filter(w => !["RESOLVED", "VERIFIED", "CLOSED"].includes(w.status)).length;
  const p0_count = list.filter(w => w.priority === "P0" && w.status !== "CLOSED").length;
  const p1_count = list.filter(w => w.priority === "P1" && w.status !== "CLOSED").length;
  const p2_count = list.filter(w => w.priority === "P2" && w.status !== "CLOSED").length;
  const p3_count = list.filter(w => w.priority === "P3" && w.status !== "CLOSED").length;

  const overdue_count = list.filter(w => w.sla_status === "OVERDUE").length;
  const breached_count = list.filter(w => w.sla_status === "BREACHED").length;
  const escalated_count = list.filter(w => w.status === "ESCALATED").length;
  const unassigned_count = list.filter(w => !w.assigned_to && w.status !== "CLOSED").length;

  const status_summary = {
    open: list.filter(w => w.status === "OPEN").length,
    in_progress: list.filter(w => w.status === "IN_PROGRESS" || w.status === "ASSIGNED" || w.status === "ESCALATED" || w.status === "BLOCKED").length,
    pending_verification: list.filter(w => w.status === "PENDING_VERIFICATION").length,
    resolved: list.filter(w => w.status === "RESOLVED" || w.status === "VERIFIED").length,
    closed: list.filter(w => w.status === "CLOSED").length
  };

  const sla_health = {
    on_track: list.filter(w => w.sla_status === "ON_TRACK").length,
    due_soon: list.filter(w => w.sla_status === "DUE_SOON").length,
    overdue: overdue_count,
    breached: breached_count
  };

  return {
    action_required: {
      total_open,
      p0: p0_count,
      p1: p1_count,
      p2: p2_count,
      p3: p3_count,
      overdue: overdue_count,
      sla_breached: breached_count,
      escalated: escalated_count,
      unassigned: unassigned_count
    },
    workflow_summary: status_summary,
    sla_health
  };
}
