import { logAuditEvent } from "./auditTrailEngine";
import { getManagementIntelligence } from "./managementIntelligenceEngine";
import { createWorkflowCase } from "./operationalWorkflowEngine";
import { executeControlAction } from "./operationalControlEngine";

export type ReviewPeriod = "DAILY" | "WEEKLY" | "MONTHLY";
export type ReviewStatus = "OPEN" | "ANALYZING" | "REVIEW_READY" | "ACTION_REQUIRED" | "ACTION_IN_PROGRESS" | "VERIFICATION_REQUIRED" | "COMPLETED" | "REOPENED";
export type DecisionType = "MONITOR" | "INVESTIGATE" | "REASSIGN" | "ESCALATE" | "CORRECT" | "REVIEW" | "BLOCK" | "CLOSE";

export interface DeviationRecord {
  deviation_id: string;
  scope: string;
  type: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  priority: "P0" | "P1" | "P2" | "P3";
  metric: string;
  actual: number | string;
  target: number | string | "TARGET_NOT_CONFIGURED";
  variance: number | string;
  detected_at: string;
  outlet_id: string;
  admin_id?: string;
  source_type: string;
  source_id: string;
}

export interface InsightRecord {
  insight_id: string;
  evidence: string;
  impact: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  likely_cause: string;
  recommended_action: string;
}

export interface DecisionRecord {
  decision_id: string;
  decision_type: DecisionType;
  reason: string;
  source_type: string;
  source_id: string;
  priority: string;
  recommended_by: string;
  created_at: string;
  action_ref?: string; // Linked workflow or action ID
}

export interface ManagementReviewRecord {
  review_id: string;
  outlet_id: string;
  period: ReviewPeriod;
  tanggal: string;
  status: ReviewStatus;
  kpis: any;
  deviations: DeviationRecord[];
  insights: InsightRecord[];
  decisions: DecisionRecord[];
  created_at: string;
  updated_at: string;
  completed_at?: string;
  completed_by?: string;
}

function ensureManagementReviewsTable(db: any): ManagementReviewRecord[] {
  if (!db.ManagementReviews) db.ManagementReviews = [];
  return db.ManagementReviews;
}

export function isRoleAuthorized(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function generateReviewId(scope: string, outlet_id: string, period: string, tanggal: string): string {
  return `MR-${scope}-${outlet_id || "GLOBAL"}-${period}-${tanggal}`;
}

export function getManagementReviewSummary(db: any, params: { outlet_id?: string; tanggal?: string; role: string; actor_id: string }) {
  if (!isRoleAuthorized(params.role)) throw new Error("UNAUTHORIZED: Invalid role");
  
  const reviews = ensureManagementReviewsTable(db);
  const targetOutletId = params.role === "ADMIN" ? params.outlet_id : params.outlet_id;
  
  if (params.role === "ADMIN" && !targetOutletId) {
    throw new Error("UNAUTHORIZED: ADMIN must specify active outlet_id");
  }
  
  return reviews.filter(r => {
    if (targetOutletId && r.outlet_id !== targetOutletId) return false;
    if (params.tanggal && !r.review_id.includes(params.tanggal)) return false;
    return true;
  });
}

export function getManagementReviewDetail(db: any, review_id: string, actor: { role?: string; actor_role?: string; outlet_id?: string; actor_id: string }) {
  const role = actor.role || actor.actor_role || "";
  if (!isRoleAuthorized(role)) throw new Error("UNAUTHORIZED: Invalid role");
  
  const reviews = ensureManagementReviewsTable(db);
  const review = reviews.find(r => r.review_id === review_id);
  
  if (!review) throw new Error("NOT_FOUND: Review not found");
  
  if (role === "ADMIN") {
    if (review.outlet_id === "GLOBAL") {
      throw new Error("UNAUTHORIZED: ADMIN cannot access GLOBAL reviews");
    }
    const outlets = db?.MASTER_OUTLET || db?.Outlets || [];
    const isOutletAvailable = outlets.some((o: any) => o.outlet_id === review.outlet_id || o.id === review.outlet_id);
    if (!isOutletAvailable && review.outlet_id !== "ALL") {
      throw new Error("UNAUTHORIZED: Cross-outlet access rejected or outlet unavailable");
    }
  }
  
  return review;
}

export function createManagementReview(
  db: any, 
  params: { outlet_id: string; period: ReviewPeriod; tanggal: string },
  actor: { role?: string; actor_role?: string; outlet_id?: string; actor_id: string }
) {
  const role = actor.role || actor.actor_role || "";
  if (!isRoleAuthorized(role)) throw new Error("UNAUTHORIZED: Invalid role");
  if (role === "ADMIN" && params.outlet_id === "GLOBAL") {
    throw new Error("UNAUTHORIZED: ADMIN cannot create GLOBAL reviews");
  }
  if (role === "ADMIN") {
    const outlets = db?.MASTER_OUTLET || db?.Outlets || [];
    const isOutletAvailable = outlets.some((o: any) => o.outlet_id === params.outlet_id || o.id === params.outlet_id);
    if (!isOutletAvailable && params.outlet_id !== "ALL") {
      throw new Error("UNAUTHORIZED: Cross-outlet access rejected or outlet unavailable");
    }
  }

  const reviews = ensureManagementReviewsTable(db);
  const scope = params.outlet_id === "GLOBAL" ? "GLOBAL" : "OUTLET";
  const review_id = generateReviewId(scope, params.outlet_id, params.period, params.tanggal);
  
  let existing = reviews.find(r => r.review_id === review_id);
  if (existing) return existing; // Idempotent

  const newReview: ManagementReviewRecord = {
    review_id,
    outlet_id: params.outlet_id,
    period: params.period,
    tanggal: params.tanggal,
    status: "OPEN",
    kpis: {},
    deviations: [],
    insights: [],
    decisions: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  reviews.push(newReview);
  
  logAuditEvent(db, {
    event_type: "MANAGEMENT_REVIEW_EVENT", result: "SUCCESS", action: "MANAGEMENT_REVIEW_STARTED",
    entity_type: "MANAGEMENT_REVIEW",
    entity_id: review_id,
    actor_id: actor.actor_id,
    outlet_id: params.outlet_id,
  });

  return newReview;
}

export function analyzeManagementReview(
  db: any,
  params: { review_id: string },
  actor: { role: string; outlet_id?: string; actor_id: string }
) {
  const review = getManagementReviewDetail(db, params.review_id, actor);
  
  if (review.status === "COMPLETED") {
    throw new Error("INVALID_TRANSITION: Review is already COMPLETED");
  }

  review.status = "ANALYZING";
  review.updated_at = new Date().toISOString();

  // Fetch intelligence data
  const intelFilter = {
    outlet_id: review.outlet_id === "GLOBAL" ? undefined : review.outlet_id,
    tanggal: review.tanggal,
    role: actor.role as "OWNER"|"ADMIN",
    actor_id: actor.actor_id
  };
  
  const intel = getManagementIntelligence(db, intelFilter);
  
  review.kpis = {
    throughput: intel.outcome_kpis.throughput,
    reliability: intel.outcome_kpis.reliability,
    quality: intel.outcome_kpis.quality,
    resolution: intel.outcome_kpis.resolution
  };

  review.deviations = [];
  review.insights = [];

  // Generate Deviations
  if (intel.sla_performance && intel.sla_performance.breached > 0) {
    review.deviations.push({
      deviation_id: `DEV-SLA-${Date.now()}-1`,
      scope: "OPERATIONAL",
      type: "SLA_BREACH",
      severity: "CRITICAL",
      priority: "P0",
      metric: "Breached SLAs",
      actual: intel.sla_performance.breached,
      target: 0,
      variance: intel.sla_performance.breached,
      detected_at: new Date().toISOString(),
      outlet_id: review.outlet_id,
      source_type: "WORKFLOW",
      source_id: "MULTIPLE"
    });
  }

  if (intel.outcome_kpis.quality.exception_rate && intel.outcome_kpis.quality.exception_rate > 0) {
    review.deviations.push({
      deviation_id: `DEV-EXC-${Date.now()}-1`,
      scope: "RECONCILIATION",
      type: "RECONCILIATION_EXCEPTION",
      severity: "ERROR",
      priority: "P1",
      metric: "Exception Rate",
      actual: intel.outcome_kpis.quality.exception_rate,
      target: 0,
      variance: intel.outcome_kpis.quality.exception_rate,
      detected_at: new Date().toISOString(),
      outlet_id: review.outlet_id,
      source_type: "RECONCILIATION",
      source_id: "MULTIPLE"
    });
  }

  // Generate Insights based on intelligence insights
  if (intel.management_insights) {
    for (const ins of intel.management_insights) {
      review.insights.push({
        insight_id: `INS-${Date.now()}-${Math.random()}`,
        evidence: ins.evidence || "UNKNOWN",
        impact: ins.severity === "CRITICAL" ? "CRITICAL" : (ins.severity === "HIGH" ? "HIGH" : "MEDIUM"),
        likely_cause: "WORKFLOW",
        recommended_action: ins.recommended_action
      });
    }
  }

  // Detect repeated exceptions
  if (intel.recurring_exceptions) {
    for (const rec of intel.recurring_exceptions) {
      review.deviations.push({
        deviation_id: `DEV-REC-${Date.now()}-${Math.random()}`,
        scope: "OPERATIONAL",
        type: "REPEATED_EXCEPTION",
        severity: "WARNING",
        priority: "P2",
        metric: "Occurrence",
        actual: rec.occurrence,
        target: 1,
        variance: rec.occurrence - 1,
        detected_at: new Date().toISOString(),
        outlet_id: rec.outlet_id,
        source_type: "EXCEPTION",
        source_id: rec.exception_type
      });
      
      review.insights.push({
        insight_id: `INS-REC-${Date.now()}-${Math.random()}`,
        evidence: `${rec.exception_type} occurred ${rec.occurrence} times.`,
        impact: "MEDIUM",
        likely_cause: "DATA",
        recommended_action: "INVESTIGATE"
      });
    }
  }

  if (review.deviations.length > 0) {
    review.status = "ACTION_REQUIRED";
  } else {
    review.status = "REVIEW_READY";
  }

  logAuditEvent(db, {
    event_type: "MANAGEMENT_REVIEW_EVENT", result: "SUCCESS", action: "MANAGEMENT_REVIEW_ANALYZED",
    entity_type: "MANAGEMENT_REVIEW",
    entity_id: review.review_id,
    actor_id: actor.actor_id,
    outlet_id: review.outlet_id,
  });

  return review;
}

export function addManagementDecision(
  db: any,
  params: { review_id: string; decision_type: DecisionType; reason: string; source_type: string; source_id: string; priority: string },
  actor: { role: string; outlet_id?: string; actor_id: string; name?: string }
) {
  const review = getManagementReviewDetail(db, params.review_id, actor);
  
  if (review.status === "COMPLETED") {
    throw new Error("INVALID_TRANSITION: Review is already COMPLETED");
  }

  const decision: DecisionRecord = {
    decision_id: `DEC-${Date.now()}`,
    decision_type: params.decision_type,
    reason: params.reason,
    source_type: params.source_type,
    source_id: params.source_id,
    priority: params.priority,
    recommended_by: actor.actor_id,
    created_at: new Date().toISOString()
  };

  // Action Bridge: automatically dispatch to workflow or control engine
  if (params.decision_type === "ESCALATE" || params.decision_type === "REASSIGN" || params.decision_type === "INVESTIGATE") {
    const wfRes = createWorkflowCase(db, {
      source_type: params.source_type,
      source_id: params.source_id,
      outlet_id: review.outlet_id === "GLOBAL" ? "O1" : review.outlet_id,
      action_id: params.decision_type,
      priority: (params.priority as "P0"|"P1"|"P2"|"P3") || "P2",
      severity: "WARNING",
      title: `Management Decision: ${params.decision_type}`,
      description: params.reason,
      actor: { actor_id: actor.actor_id, actor_role: ((actor as any).actor_role || actor.role) as any, outlet_id: actor.outlet_id, actor_name: ((actor as any).actor_name || actor.name) }
    });
    if (wfRes.status === "success" && wfRes.data) {
      decision.action_ref = wfRes.data.workflow_id;
    } else {
      console.log("createWorkflowCase Failed:", wfRes);
    }
  }

  review.decisions.push(decision);
  review.status = "ACTION_IN_PROGRESS";
  review.updated_at = new Date().toISOString();

  logAuditEvent(db, {
    event_type: "MANAGEMENT_REVIEW_EVENT", result: "SUCCESS", action: "MANAGEMENT_DECISION_CREATED",
    entity_type: "MANAGEMENT_REVIEW",
    entity_id: review.review_id,
    actor_id: actor.actor_id,
    outlet_id: review.outlet_id,
  });

  return decision;
}

export function completeManagementReview(
  db: any,
  params: { review_id: string },
  actor: { role: string; outlet_id?: string; actor_id: string }
) {
  const review = getManagementReviewDetail(db, params.review_id, actor);
  
  if (review.status === "COMPLETED") {
    throw new Error("INVALID_TRANSITION: Review is already COMPLETED");
  }

  // Completion rules: No open critical/error deviations without decisions?
  // We'll enforce a simple rule: if deviations exist, at least one decision must be made unless they are INFO.
  const criticalDeviations = review.deviations.filter(d => d.severity === "CRITICAL" || d.severity === "ERROR");
  
  // If workflows are linked in decisions, check if they are closed/resolved.
  // We'll just check if there's any workflow created by decisions
  const openWfs = review.decisions
    .filter(d => d.action_ref)
    .map(d => db.WorkflowCases?.find((w:any) => w.workflow_id === d.action_ref))
    .filter(w => w && w.status !== "RESOLVED" && w.status !== "VERIFIED" && w.status !== "CLOSED");

  if (openWfs.length > 0) {
    review.status = "VERIFICATION_REQUIRED";
    throw new Error("VERIFICATION_REQUIRED: Blocking workflows are still open");
  }

  if (criticalDeviations.length > 0 && review.decisions.length === 0) {
    review.status = "ACTION_REQUIRED";
    throw new Error("ACTION_REQUIRED: Critical deviations require decisions before completion");
  }

  review.status = "COMPLETED";
  review.completed_at = new Date().toISOString();
  review.completed_by = actor.actor_id;
  review.updated_at = new Date().toISOString();

  logAuditEvent(db, {
    event_type: "MANAGEMENT_REVIEW_EVENT", result: "SUCCESS", action: "MANAGEMENT_REVIEW_COMPLETED",
    entity_type: "MANAGEMENT_REVIEW",
    entity_id: review.review_id,
    actor_id: actor.actor_id,
    outlet_id: review.outlet_id,
  });

  return review;
}

export function reopenManagementReview(
  db: any,
  params: { review_id: string },
  actor: { role: string; outlet_id?: string; actor_id: string }
) {
  const review = getManagementReviewDetail(db, params.review_id, actor);
  
  if (review.status !== "COMPLETED") {
    throw new Error("INVALID_TRANSITION: Only COMPLETED reviews can be REOPENED");
  }

  review.status = "REOPENED";
  review.completed_at = undefined;
  review.completed_by = undefined;
  review.updated_at = new Date().toISOString();

  logAuditEvent(db, {
    event_type: "MANAGEMENT_REVIEW_EVENT", result: "SUCCESS", action: "MANAGEMENT_REVIEW_REOPENED",
    entity_type: "MANAGEMENT_REVIEW",
    entity_id: review.review_id,
    actor_id: actor.actor_id,
    outlet_id: review.outlet_id,
  });

  return review;
}
