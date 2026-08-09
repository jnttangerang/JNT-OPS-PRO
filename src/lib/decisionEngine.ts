import { logAuditEvent } from "./auditTrailEngine";

export type DecisionPriority = "P0" | "P1" | "P2" | "P3";
export type DecisionStatus = "OPEN" | "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED" | "ACCEPTED" | "REOPENED";

export interface ManagementDecision {
  decision_id: string;
  created_at: string;
  updated_at: string;
  
  decision_type: string;
  priority: DecisionPriority;
  severity: string;
  
  outlet_id: string;
  outlet_name: string;
  tanggal: string;
  
  entity_type: string;
  entity_id: string;
  transaksi_id?: string;
  
  title: string;
  summary: string;
  root_cause?: string;
  
  impact: string;
  financial_impact: number;
  
  recommended_action: string;
  available_actions: string[];
  required_role: string[];
  
  status: DecisionStatus;
  
  assigned_to?: string;
  acknowledged_by?: string;
  resolved_by?: string;
  
  source_engine: string;
  source_reference: string;
  
  created_from_exception: boolean;
  correlation_id?: string;
  
  metadata?: any;
}

// Ensure the table exists
export function ensureDecisionTable(db: any): ManagementDecision[] {
  if (!db.ManagementDecisions) {
    db.ManagementDecisions = [];
  }
  return db.ManagementDecisions;
}

// Check role
function hasPermission(role: string, requiredRoles: string[]): boolean {
  if (role === "OWNER") return true;
  return requiredRoles.includes(role);
}

// Generate deterministic fingerprint
function generateDecisionFingerprint(
  source_engine: string,
  source_reference: string,
  outlet_id: string,
  tanggal: string,
  entity_type: string,
  entity_id: string,
  decision_type: string
): string {
  return `${source_engine}:${source_reference}:${outlet_id}:${tanggal}:${entity_type}:${entity_id}:${decision_type}`;
}

export function syncDecisionsFromExceptions(db: any, outlet_id: string, tanggal: string) {
  const decisions = ensureDecisionTable(db);
  const exceptions = db.ReconciliationExceptions?.filter((e: any) => e.outlet_id === outlet_id) || [];
  
  for (const ex of exceptions) {
    // Only sync unresolved ones or actively synced ones
    const exDate = ex.created_at.split("T")[0]; // Use created_at or explicitly passed tanggal
    // If it's a specific date filter, we might want to skip, but exceptions don't strictly have 'tanggal' in all cases, we use created_at date.
    
    const fingerprint = generateDecisionFingerprint(
      "RECONCILIATION_ENGINE",
      ex.exception_id,
      ex.outlet_id,
      exDate,
      "EXCEPTION",
      ex.exception_id,
      ex.exception_type
    );
    
    let existing = decisions.find(d => d.decision_id === fingerprint);
    
    if (ex.status === "RESOLVED" && !existing) continue; // don't create new decision for already resolved exception
    
    let priority: DecisionPriority = "P3";
    if (ex.severity === "CRITICAL") priority = "P0";
    else if (ex.severity === "ERROR") priority = "P1";
    else if (ex.severity === "WARNING") priority = "P2";
    
    let status: DecisionStatus = "OPEN";
    if (ex.status === "RESOLVED") status = "RESOLVED";
    else if (ex.status === "REOPENED") status = "REOPENED";
    else if (ex.status === "IN_REVIEW") status = "IN_PROGRESS";
    
    const financial_impact = ex.metadata?.financial_impact || ex.metadata?.amount_difference || 0;
    
    if (!existing) {
      existing = {
        decision_id: fingerprint,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        decision_type: ex.exception_type,
        priority,
        severity: ex.severity,
        outlet_id: ex.outlet_id,
        outlet_name: ex.outlet_id, // can be enriched later
        tanggal: exDate,
        entity_type: "EXCEPTION",
        entity_id: ex.exception_id,
        title: `Exception: ${ex.exception_type}`,
        summary: ex.description || `Reconciliation exception detected for ${ex.outlet_id}`,
        impact: "Data Integrity / Financial",
        financial_impact,
        recommended_action: "Review Exception",
        available_actions: ["VIEW_EXCEPTION", "START_REVIEW", "RESOLVE_EXCEPTION", "ACCEPT_EXCEPTION", "REOPEN_EXCEPTION"],
        required_role: ["ADMIN", "OWNER"],
        status,
        source_engine: "RECONCILIATION_ENGINE",
        source_reference: ex.exception_id,
        created_from_exception: true
      };
      decisions.push(existing);
    } else {
      // Update existing
      existing.status = status;
      existing.priority = priority;
      existing.financial_impact = financial_impact;
      existing.updated_at = new Date().toISOString();
    }
  }
}

export function syncDecisionsFromSettlement(db: any, outlet_id: string, tanggal: string) {
  const decisions = ensureDecisionTable(db);
  const settlements = db.Settlements?.filter((s: any) => s.outlet_id === outlet_id && s.tanggal === tanggal) || [];
  
  for (const s of settlements) {
    if (s.status !== "MISMATCH" && s.status !== "REJECTED") {
      // If we already have a decision for this, resolve it if it's settled/matched
      const fp = generateDecisionFingerprint("SETTLEMENT_ENGINE", s.settlement_id, s.outlet_id, s.tanggal, "SETTLEMENT", s.settlement_id, "SETTLEMENT_ISSUE");
      const existing = decisions.find(d => d.decision_id === fp);
      if (existing && ["MATCHED", "APPROVED", "SETTLED"].includes(s.status) && existing.status !== "RESOLVED") {
        existing.status = "RESOLVED";
        existing.updated_at = new Date().toISOString();
      }
      continue;
    }
    
    const fingerprint = generateDecisionFingerprint("SETTLEMENT_ENGINE", s.settlement_id, s.outlet_id, s.tanggal, "SETTLEMENT", s.settlement_id, "SETTLEMENT_ISSUE");
    let existing = decisions.find(d => d.decision_id === fingerprint);
    
    let priority: DecisionPriority = s.status === "MISMATCH" ? "P0" : "P1";
    let financial_impact = Math.abs((s.expected_deposit || 0) - (s.actual_deposit || 0));
    
    if (!existing) {
      existing = {
        decision_id: fingerprint,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        decision_type: "SETTLEMENT_ISSUE",
        priority,
        severity: "CRITICAL",
        outlet_id: s.outlet_id,
        outlet_name: s.outlet_id,
        tanggal: s.tanggal,
        entity_type: "SETTLEMENT",
        entity_id: s.settlement_id,
        title: `Settlement ${s.status}`,
        summary: `Settlement issue detected: Expected ${s.expected_deposit}, Actual ${s.actual_deposit}`,
        impact: "Financial Settlement",
        financial_impact,
        recommended_action: "Review Settlement",
        available_actions: ["VIEW_SETTLEMENT", "RECORD_DEPOSIT", "RECONCILE_SETTLEMENT", "APPROVE_SETTLEMENT", "REJECT_SETTLEMENT", "REOPEN_SETTLEMENT"],
        required_role: ["ADMIN", "OWNER"],
        status: "OPEN",
        source_engine: "SETTLEMENT_ENGINE",
        source_reference: s.settlement_id,
        created_from_exception: false
      };
      decisions.push(existing);
    } else {
      existing.priority = priority;
      existing.financial_impact = financial_impact;
      if (existing.status === "RESOLVED") existing.status = "REOPENED";
      existing.updated_at = new Date().toISOString();
    }
  }
}

export function syncDecisionsFromClosing(db: any, outlet_id: string, tanggal: string) {
  const decisions = ensureDecisionTable(db);
  const closings = db.DailyClosing?.filter((c: any) => c.outlet_id === outlet_id && c.tanggal === tanggal) || [];
  
  for (const c of closings) {
    if (c.status !== "BLOCKED") {
      const fp = generateDecisionFingerprint("DAILY_CLOSING_ENGINE", c.closing_id, c.outlet_id, c.tanggal, "CLOSING", c.closing_id, "CLOSING_BLOCKED");
      const existing = decisions.find(d => d.decision_id === fp);
      if (existing && ["CLOSED"].includes(c.status) && existing.status !== "RESOLVED") {
        existing.status = "RESOLVED";
        existing.updated_at = new Date().toISOString();
      }
      continue;
    }
    
    const fingerprint = generateDecisionFingerprint("DAILY_CLOSING_ENGINE", c.closing_id, c.outlet_id, c.tanggal, "CLOSING", c.closing_id, "CLOSING_BLOCKED");
    let existing = decisions.find(d => d.decision_id === fingerprint);
    
    if (!existing) {
      existing = {
        decision_id: fingerprint,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        decision_type: "CLOSING_BLOCKED",
        priority: "P0",
        severity: "CRITICAL",
        outlet_id: c.outlet_id,
        outlet_name: c.outlet_id,
        tanggal: c.tanggal,
        entity_type: "CLOSING",
        entity_id: c.closing_id,
        title: `Closing Blocked`,
        summary: `Daily closing is blocked. Reasons: ${(c.blocking_reasons || []).join(", ")}`,
        impact: "Operational Closing",
        financial_impact: 0,
        recommended_action: "Resolve Blocking Issues",
        available_actions: ["VIEW_CLOSING", "VALIDATE_CLOSING", "EXECUTE_CLOSING", "REOPEN_CLOSING"],
        required_role: ["ADMIN", "OWNER"],
        status: "OPEN",
        source_engine: "DAILY_CLOSING_ENGINE",
        source_reference: c.closing_id,
        created_from_exception: false
      };
      decisions.push(existing);
    } else {
      existing.summary = `Daily closing is blocked. Reasons: ${(c.blocking_reasons || []).join(", ")}`;
      if (existing.status === "RESOLVED") existing.status = "REOPENED";
      existing.updated_at = new Date().toISOString();
    }
  }
}

export function syncDecisionsFromCertification(db: any, outlet_id: string, tanggal: string) {
  const decisions = ensureDecisionTable(db);
  const certs = db.FinancialCloseCertification?.filter((c: any) => c.outlet_id === outlet_id && c.tanggal === tanggal) || [];
  
  for (const c of certs) {
    if (c.status !== "BLOCKED") {
      const fp = generateDecisionFingerprint("CERTIFICATION_ENGINE", c.certification_id, c.outlet_id, c.tanggal, "CERTIFICATION", c.certification_id, "CERTIFICATION_BLOCKED");
      const existing = decisions.find(d => d.decision_id === fp);
      if (existing && ["CERTIFIED"].includes(c.status) && existing.status !== "RESOLVED") {
        existing.status = "RESOLVED";
        existing.updated_at = new Date().toISOString();
      }
      continue;
    }
    
    const fingerprint = generateDecisionFingerprint("CERTIFICATION_ENGINE", c.certification_id, c.outlet_id, c.tanggal, "CERTIFICATION", c.certification_id, "CERTIFICATION_BLOCKED");
    let existing = decisions.find(d => d.decision_id === fingerprint);
    
    if (!existing) {
      existing = {
        decision_id: fingerprint,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        decision_type: "CERTIFICATION_BLOCKED",
        priority: "P0",
        severity: "CRITICAL",
        outlet_id: c.outlet_id,
        outlet_name: c.outlet_id,
        tanggal: c.tanggal,
        entity_type: "CERTIFICATION",
        entity_id: c.certification_id,
        title: `Certification Blocked`,
        summary: `Financial Close Certification is blocked due to failed controls.`,
        impact: "Financial Certification",
        financial_impact: 0,
        recommended_action: "Resolve Failed Controls",
        available_actions: ["VIEW_CERTIFICATION", "VALIDATE_CERTIFICATION", "CERTIFY", "REOPEN_CERTIFICATION", "VIEW_EVIDENCE"],
        required_role: ["OWNER"],
        status: "OPEN",
        source_engine: "CERTIFICATION_ENGINE",
        source_reference: c.certification_id,
        created_from_exception: false
      };
      decisions.push(existing);
    } else {
      if (existing.status === "RESOLVED") existing.status = "REOPENED";
      existing.updated_at = new Date().toISOString();
    }
  }
}

export function syncAllDecisions(db: any, outlet_id: string, tanggal: string) {
  syncDecisionsFromExceptions(db, outlet_id, tanggal);
  syncDecisionsFromSettlement(db, outlet_id, tanggal);
  syncDecisionsFromClosing(db, outlet_id, tanggal);
  syncDecisionsFromCertification(db, outlet_id, tanggal);
}

export function getDecisions(db: any, params: { outlet_id?: string; role: string }) {
  const decisions = ensureDecisionTable(db);
  let result = decisions;
  
  if (params.outlet_id && params.role !== "OWNER") {
    result = result.filter(d => d.outlet_id === params.outlet_id);
  }
  
  // Sort by priority (P0 -> P1 -> P2 -> P3), then by financial impact (desc), then by age (asc/created_at)
  result.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority.localeCompare(b.priority);
    }
    if (a.financial_impact !== b.financial_impact) {
      return b.financial_impact - a.financial_impact;
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  
  return result;
}

export function acknowledgeDecision(db: any, params: { decision_id: string; actor_id: string; actor_name: string; actor_role: string; reason?: string }) {
  const decisions = ensureDecisionTable(db);
  const decision = decisions.find(d => d.decision_id === params.decision_id);
  
  if (!decision) return { status: "error", message: "Decision not found" };
  if (decision.status !== "OPEN" && decision.status !== "REOPENED") {
    return { status: "error", message: `Cannot acknowledge decision in ${decision.status} status` };
  }
  
  if (params.actor_role !== "OWNER" && decision.outlet_id && params.actor_role === "ADMIN") {
    // Basic check, full auth happens outside but let's be safe
  }
  
  const oldStatus = decision.status;
  decision.status = "ACKNOWLEDGED";
  decision.acknowledged_by = params.actor_id;
  decision.updated_at = new Date().toISOString();
  
  logAuditEvent(db, {
    entity_type: "MANAGEMENT_DECISION",
    entity_id: decision.decision_id,
    outlet_id: decision.outlet_id,
    event_type: "MANAGEMENT_DECISION_ACKNOWLEDGED", action: "ACKNOWLEDGE", result: "SUCCESS",
    actor_id: params.actor_id,
    actor_name: params.actor_name,
    actor_role: params.actor_role,
    metadata: {
      old_status: oldStatus,
      new_status: decision.status,
      reason: params.reason
    }
  });
  
  return { status: "success", data: decision };
}

export function assignDecision(db: any, params: { decision_id: string; assigned_to: string; actor_id: string; actor_name: string; actor_role: string; reason?: string }) {
  const decisions = ensureDecisionTable(db);
  const decision = decisions.find(d => d.decision_id === params.decision_id);
  
  if (!decision) return { status: "error", message: "Decision not found" };
  if (params.actor_role !== "OWNER") {
    return { status: "error", message: "Only OWNER can assign decisions" };
  }
  
  decision.assigned_to = params.assigned_to;
  decision.updated_at = new Date().toISOString();
  
  logAuditEvent(db, {
    entity_type: "MANAGEMENT_DECISION",
    entity_id: decision.decision_id,
    outlet_id: decision.outlet_id,
    event_type: "MANAGEMENT_DECISION_ASSIGNED", action: "ASSIGN", result: "SUCCESS",
    actor_id: params.actor_id,
    actor_name: params.actor_name,
    actor_role: params.actor_role,
    metadata: {
      assigned_to: params.assigned_to,
      reason: params.reason
    }
  });
  
  return { status: "success", data: decision };
}

export function startDecision(db: any, params: { decision_id: string; actor_id: string; actor_name: string; actor_role: string; reason?: string }) {
  const decisions = ensureDecisionTable(db);
  const decision = decisions.find(d => d.decision_id === params.decision_id);
  
  if (!decision) return { status: "error", message: "Decision not found" };
  
  const validPrevStates = ["OPEN", "ACKNOWLEDGED", "REOPENED"];
  if (!validPrevStates.includes(decision.status)) {
    return { status: "error", message: `Cannot start decision from ${decision.status}` };
  }
  
  const oldStatus = decision.status;
  decision.status = "IN_PROGRESS";
  decision.updated_at = new Date().toISOString();
  
  logAuditEvent(db, {
    entity_type: "MANAGEMENT_DECISION",
    entity_id: decision.decision_id,
    outlet_id: decision.outlet_id,
    event_type: "MANAGEMENT_DECISION_STARTED", action: "START", result: "SUCCESS",
    actor_id: params.actor_id,
    actor_name: params.actor_name,
    actor_role: params.actor_role,
    metadata: {
      old_status: oldStatus,
      new_status: decision.status,
      reason: params.reason
    }
  });
  
  return { status: "success", data: decision };
}

export function resolveDecision(db: any, params: { decision_id: string; actor_id: string; actor_name: string; actor_role: string; reason?: string; resolution_type: "RESOLVED" | "ACCEPTED" }) {
  const decisions = ensureDecisionTable(db);
  const decision = decisions.find(d => d.decision_id === params.decision_id);
  
  if (!decision) return { status: "error", message: "Decision not found" };
  if (decision.status === "RESOLVED" || decision.status === "ACCEPTED") {
    return { status: "error", message: `Decision already ${decision.status}` };
  }
  
  // Notice: The actual resolution of the underlying issue MUST be done via the respective engine.
  // This engine only tracks the decision lifecycle.
  const oldStatus = decision.status;
  decision.status = params.resolution_type;
  decision.resolved_by = params.actor_id;
  decision.updated_at = new Date().toISOString();
  
  logAuditEvent(db, {
    entity_type: "MANAGEMENT_DECISION",
    entity_id: decision.decision_id,
    outlet_id: decision.outlet_id,
    event_type: params.resolution_type === "RESOLVED" ? "MANAGEMENT_DECISION_RESOLVED" : "MANAGEMENT_DECISION_ACCEPTED", action: "RESOLVE", result: "SUCCESS",
    actor_id: params.actor_id,
    actor_name: params.actor_name,
    actor_role: params.actor_role,
    metadata: {
      old_status: oldStatus,
      new_status: decision.status,
      reason: params.reason
    }
  });
  
  return { status: "success", data: decision };
}

export function reopenDecision(db: any, params: { decision_id: string; actor_id: string; actor_name: string; actor_role: string; reason?: string }) {
  const decisions = ensureDecisionTable(db);
  const decision = decisions.find(d => d.decision_id === params.decision_id);
  
  if (!decision) return { status: "error", message: "Decision not found" };
  if (decision.status !== "RESOLVED" && decision.status !== "ACCEPTED") {
    return { status: "error", message: `Cannot reopen decision in ${decision.status}` };
  }
  
  const oldStatus = decision.status;
  decision.status = "REOPENED";
  decision.updated_at = new Date().toISOString();
  
  logAuditEvent(db, {
    entity_type: "MANAGEMENT_DECISION",
    entity_id: decision.decision_id,
    outlet_id: decision.outlet_id,
    event_type: "MANAGEMENT_DECISION_REOPENED", action: "REOPEN", result: "SUCCESS",
    actor_id: params.actor_id,
    actor_name: params.actor_name,
    actor_role: params.actor_role,
    metadata: {
      old_status: oldStatus,
      new_status: decision.status,
      reason: params.reason
    }
  });
  
  return { status: "success", data: decision };
}

export function escalateDecision(db: any, params: { decision_id: string; actor_id: string; actor_name: string; actor_role: string; reason?: string }) {
  const decisions = ensureDecisionTable(db);
  const decision = decisions.find(d => d.decision_id === params.decision_id);
  
  if (!decision) return { status: "error", message: "Decision not found" };
  
  decision.priority = "P0";
  decision.updated_at = new Date().toISOString();
  
  logAuditEvent(db, {
    entity_type: "MANAGEMENT_DECISION",
    entity_id: decision.decision_id,
    outlet_id: decision.outlet_id,
    event_type: "MANAGEMENT_DECISION_ESCALATED", action: "ESCALATE", result: "SUCCESS",
    actor_id: params.actor_id,
    actor_name: params.actor_name,
    actor_role: params.actor_role,
    metadata: {
      reason: params.reason
    }
  });
  
  return { status: "success", data: decision };
}
