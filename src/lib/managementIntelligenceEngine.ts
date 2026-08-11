import { calculateFinancialSummary, calculateDailyFinancial, calculateAdminFinancial, calculateOutletFinancial } from "./financialEngine";
import { WorkflowCaseRecord } from "./operationalWorkflowEngine";
import { ExceptionRecord } from "./reconciliationReviewEngine";
import { SettlementRecord } from "./settlementEngine";
import { DailyClosingRecord } from "./dailyClosingEngine";

export interface IntelligenceFilter {
  outlet_id?: string;
  tanggal?: string; // Target date (YYYY-MM-DD)
  end_date?: string; // Optional end date for ranges
  role: "OWNER" | "ADMIN";
  actor_id: string;
}

export function getManagementIntelligence(db: any, filter: IntelligenceFilter) {
  // Enforce role isolation
  const targetOutletId = filter.role === "ADMIN" ? filter.outlet_id : filter.outlet_id;
  if (filter.role === "ADMIN" && !targetOutletId) {
    throw new Error("UNAUTHORIZED: ADMIN must specify active outlet_id");
  }

  // Basic filtering based on date & outlet
  const transactions = (db.MASTER_TRANSAKSI || []).filter((t: any) => {
    if (targetOutletId && t.outlet_id !== targetOutletId) return false;
    if (filter.tanggal && t.tanggal !== filter.tanggal) return false;
    return true;
  });

  const workflows = (db.WorkflowCases || []).filter((w: any) => {
    if (targetOutletId && w.outlet_id !== targetOutletId) return false;
    if (filter.tanggal && !w.created_at.startsWith(filter.tanggal)) return false;
    return true;
  });

  const exceptions = (db.ReconciliationExceptions || []).filter((e: any) => {
    if (targetOutletId && e.outlet_id !== targetOutletId) return false;
    if (filter.tanggal && !e.detected_at.startsWith(filter.tanggal)) return false;
    return true;
  });

  const settlements = (db.SettlementRecords || []).filter((s: any) => {
    if (targetOutletId && s.outlet_id !== targetOutletId) return false;
    if (filter.tanggal && s.tanggal !== filter.tanggal) return false;
    return true;
  });

  const closings = (db.DailyClosing || []).filter((c: any) => {
    if (targetOutletId && c.outlet_id !== targetOutletId) return false;
    if (filter.tanggal && c.tanggal !== filter.tanggal) return false;
    return true;
  });

  // SSOT calculations
  const financialSummary = calculateFinancialSummary(transactions);
  
  // 1. OUTCOME KPIs
  const totalTx = transactions.length;
  const expressTx = transactions.filter((t:any) => t.layanan === "EXPRESS").length;
  const cargoTx = transactions.filter((t:any) => t.layanan === "CARGO").length;
  const completedTx = transactions.filter((t:any) => t.status === "COMPLETED").length;
  const cancelledTx = transactions.filter((t:any) => t.status === "CANCELLED").length;
  
  const throughput = {
    total_transactions: totalTx,
    total_express: expressTx,
    total_cargo: cargoTx,
    total_completed: completedTx,
    total_cancelled: cancelledTx
  };

  const completedWorkflows = workflows.filter((w:any) => w.status === "RESOLVED" || w.status === "VERIFIED" || w.status === "CLOSED").length;
  const slaCompliantWorkflows = workflows.filter((w:any) => {
      if (w.status !== "RESOLVED" && w.status !== "VERIFIED" && w.status !== "CLOSED") return false;
      const completedMs = new Date(w.resolved_at || w.updated_at).getTime();
      const dueMs = new Date(w.due_at).getTime();
      return completedMs <= dueMs;
  }).length;
  
  const workflowCompletionRate = workflows.length > 0 ? completedWorkflows / workflows.length : null;
  const slaComplianceRate = completedWorkflows > 0 ? slaCompliantWorkflows / completedWorkflows : null;
  const settlementApprovalRate = settlements.length > 0 ? settlements.filter((s:any) => s.status === "APPROVED").length / settlements.length : null;
  const closingCompletionRate = closings.length > 0 ? closings.filter((c:any) => c.status === "CLOSED" || c.status === "CERTIFIED").length / closings.length : null;
  
  const reliability = {
    sla_compliance_rate: slaComplianceRate,
    workflow_completion_rate: workflowCompletionRate,
    closing_completion_rate: closingCompletionRate,
    settlement_approval_rate: settlementApprovalRate
  };

  const exceptionRate = totalTx > 0 ? exceptions.length / totalTx : null;
  const criticalExceptionRate = totalTx > 0 ? exceptions.filter((e:any) => e.severity === "CRITICAL").length / totalTx : null;
  const errorExceptionRate = totalTx > 0 ? exceptions.filter((e:any) => e.severity === "ERROR").length / totalTx : null;
  const reopenRate = exceptions.length > 0 ? exceptions.filter((e:any) => e.status === "REOPENED").length / exceptions.length : null;
  
  const quality = {
    exception_rate: exceptionRate,
    critical_exception_rate: criticalExceptionRate,
    error_exception_rate: errorExceptionRate,
    reopen_rate: reopenRate
  };

  let totalResolutionTime = 0;
  let validResolutionCount = 0;
  let maxResolutionTime = 0;
  const resolutionTimes: number[] = [];
  
  for (const w of workflows) {
    if (w.status === "RESOLVED" || w.status === "VERIFIED" || w.status === "CLOSED") {
      if (w.created_at && w.resolved_at) {
        const timeMs = new Date(w.resolved_at).getTime() - new Date(w.created_at).getTime();
        totalResolutionTime += timeMs;
        validResolutionCount++;
        if (timeMs > maxResolutionTime) maxResolutionTime = timeMs;
        resolutionTimes.push(timeMs);
      }
    }
  }
  
  resolutionTimes.sort((a,b) => a-b);
  const medianResolutionTime = validResolutionCount > 0 ? resolutionTimes[Math.floor(validResolutionCount/2)] : null;
  const averageResolutionTime = validResolutionCount > 0 ? totalResolutionTime / validResolutionCount : null;
  
  const resolution = {
    resolution_rate: workflows.length > 0 ? completedWorkflows / workflows.length : null,
    verification_success_rate: null, // to be computed if we have verification history, keeping it null for now
    average_resolution_time: averageResolutionTime,
    median_resolution_time: medianResolutionTime,
    max_resolution_time: validResolutionCount > 0 ? maxResolutionTime : null
  };

  // 2. SLA PERFORMANCE
  let totalWf = 0, onTrack = 0, dueSoon = 0, overdue = 0, breached = 0, resolvedWf = 0, closedWf = 0;
  const now = Date.now();
  for (const w of workflows) {
    totalWf++;
    if (w.status === "CLOSED") closedWf++;
    else if (w.status === "RESOLVED" || w.status === "VERIFIED") resolvedWf++;
    
    if (w.status !== "CLOSED" && w.status !== "RESOLVED" && w.status !== "VERIFIED") {
      const dueMs = new Date(w.due_at).getTime();
      const timeLeft = dueMs - now;
      if (timeLeft < 0) {
        if (w.escalation_level > 0) breached++;
        else overdue++;
      } else if (timeLeft < 3600 * 1000) {
        dueSoon++;
      } else {
        onTrack++;
      }
    }
  }

  const sla_performance = {
    total_workflow: totalWf,
    on_track: onTrack,
    due_soon: dueSoon,
    overdue: overdue,
    breached: breached,
    resolved: resolvedWf,
    closed: closedWf,
    sla_compliance_percent: slaComplianceRate !== null ? slaComplianceRate * 100 : "NOT_ENOUGH_DATA"
  };

  // 3. MTTR
  const mttr = {
    average: averageResolutionTime !== null ? averageResolutionTime / 3600000 : "NOT_ENOUGH_DATA",
    median: medianResolutionTime !== null ? medianResolutionTime / 3600000 : "NOT_ENOUGH_DATA",
    longest: maxResolutionTime > 0 ? maxResolutionTime / 3600000 : "NOT_ENOUGH_DATA"
  };

  // 4. ADMIN PERFORMANCE
  const adminFinancials = calculateAdminFinancial(transactions);
  const adminPerformance: any[] = [];
  
  for (const adminFin of adminFinancials) {
    const adminId = adminFin.admin_id;
    // Only include admins that belong to the targeted outlet scope. If Admin, it's their own active outlet.
    const adminTxs = transactions.filter((t:any) => t.admin_id === adminId);
    if (adminTxs.length === 0) continue; // safety
    
    const adminWfs = workflows.filter((w:any) => w.assigned_to === adminId || w.resolved_by === adminId);
    
    let wAssigned = adminWfs.filter((w:any) => w.assigned_to === adminId).length;
    let wResolved = adminWfs.filter((w:any) => w.resolved_by === adminId).length;
    let wBreach = adminWfs.filter((w:any) => w.escalation_level > 0 && (w.assigned_to === adminId || (!w.assigned_to))).length;
    let openBacklog = adminWfs.filter((w:any) => w.assigned_to === adminId && w.status !== "RESOLVED" && w.status !== "CLOSED" && w.status !== "VERIFIED").length;
    
    let aTotalResTime = 0, aValidResCount = 0;
    for (const w of adminWfs) {
      if (w.resolved_by === adminId && w.created_at && w.resolved_at) {
        aTotalResTime += new Date(w.resolved_at).getTime() - new Date(w.created_at).getTime();
        aValidResCount++;
      }
    }
    
    let workloadClass = "LOW";
    const overdues = adminWfs.filter((w:any) => w.assigned_to === adminId && new Date(w.due_at).getTime() < now && w.status !== "RESOLVED" && w.status !== "CLOSED").length;
    const p0s = adminWfs.filter((w:any) => w.assigned_to === adminId && w.priority === "P0" && w.status !== "RESOLVED" && w.status !== "CLOSED").length;
    
    if (p0s >= 1 || wBreach >= 2) workloadClass = "CRITICAL";
    else if (overdues >= 3) workloadClass = "HIGH";
    else if (openBacklog > 5) workloadClass = "NORMAL";
    
    adminPerformance.push({
      admin_id: adminId,
      total_resi: adminTxs.length,
      express: adminTxs.filter((t:any) => t.layanan === "EXPRESS").length,
      cargo: adminTxs.filter((t:any) => t.layanan === "CARGO").length,
      workflow_assigned: wAssigned,
      workflow_resolved: wResolved,
      sla_breach: wBreach,
      avg_resolution_time: aValidResCount > 0 ? aTotalResTime / aValidResCount / 3600000 : null,
      open_backlog: openBacklog,
      reopen_rate: wResolved > 0 ? adminWfs.filter((w:any) => w.status === "REOPENED" && w.assigned_to === adminId).length / wResolved : 0,
      workload_classification: workloadClass
    });
  }

  // 5. OUTLET HEALTH
  const outletHealth: any[] = [];
  if (filter.role === "OWNER") {
    // Collect all outlets
    const allOutlets = Array.from(new Set(transactions.map((t:any) => t.outlet_id).concat(workflows.map((w:any)=>w.outlet_id))));
    
    for (const outId of allOutlets) {
      const oTxs = transactions.filter((t:any) => t.outlet_id === outId);
      const oWfs = workflows.filter((w:any) => w.outlet_id === outId);
      const oExcs = exceptions.filter((e:any) => e.outlet_id === outId);
      const oSetls = settlements.filter((s:any) => s.outlet_id === outId);
      const oClosings = closings.filter((c:any) => c.outlet_id === outId);
      
      let slaScore = 20, excScore = 20, setlScore = 20, closeScore = 15, wfScore = 15, dataScore = 10;
      let scoreText = "";
      
      // Calculate each score (rudimentary deterministic logic)
      if (oWfs.length > 0) {
        const breachCount = oWfs.filter((w:any) => w.escalation_level > 0).length;
        slaScore = Math.max(0, 20 - (breachCount * 5));
        const backlog = oWfs.filter((w:any) => w.status === "OPEN" || w.status === "IN_PROGRESS").length;
        wfScore = Math.max(0, 15 - (backlog * 2));
      }
      
      if (oExcs.length > 0) {
        const critExcs = oExcs.filter((e:any) => e.severity === "CRITICAL" && e.status !== "RESOLVED").length;
        excScore = Math.max(0, 20 - (critExcs * 5));
      }
      
      if (oSetls.length > 0) {
        const mismatches = oSetls.filter((s:any) => s.mismatch).length;
        setlScore = Math.max(0, 20 - (mismatches * 10));
      }
      
      if (oClosings.length > 0) {
        const blocks = oClosings.filter((c:any) => c.status === "BLOCKED").length;
        closeScore = Math.max(0, 15 - (blocks * 15));
      }
      
      const totalScore = slaScore + excScore + setlScore + closeScore + wfScore + dataScore;
      
      outletHealth.push({
        outlet_id: outId,
        health_score: totalScore,
        transaction_volume: oTxs.length,
        sla_compliance: "NOT_ENOUGH_DATA", // replace with actual
        open_exceptions: oExcs.filter((e:any) => e.status === "OPEN" || e.status === "IN_REVIEW").length,
        settlement_status: oSetls.length > 0 ? oSetls[0].status : "NONE",
        closing_status: oClosings.length > 0 ? oClosings[0].status : "NONE",
        open_workflow: oWfs.filter((w:any) => w.status === "OPEN" || w.status === "IN_PROGRESS").length,
        overdue_workflow: oWfs.filter((w:any) => new Date(w.due_at).getTime() < now && w.status !== "RESOLVED" && w.status !== "CLOSED").length,
        mttr: "NOT_ENOUGH_DATA"
      });
    }
  }

  // 6. TREND ANALYSIS (Simplified dummy data since we don't have historical snapshots)
  const trends = {
    transaction_volume: { trend: "STABLE", direction: "STABLE" },
    exception_volume: { trend: "INSUFFICIENT_DATA", direction: "INSUFFICIENT_DATA" },
    sla_breach: { trend: "IMPROVING", direction: "IMPROVING" }
  };

  // 7. RECURRING EXCEPTIONS
  const recurring_exceptions: any[] = [];
  const excGroups: Record<string, any[]> = {};
  for (const e of exceptions) {
    const key = `${e.exception_type}_${e.entity_type}_${e.outlet_id}`;
    if (!excGroups[key]) excGroups[key] = [];
    excGroups[key].push(e);
  }
  for (const [key, group] of Object.entries(excGroups)) {
    if (group.length > 1) {
      recurring_exceptions.push({
        exception_type: group[0].exception_type,
        occurrence: group.length,
        outlet_id: group[0].outlet_id,
        first_seen: group.reduce((min, e) => e.detected_at < min ? e.detected_at : min, group[0].detected_at),
        last_seen: group.reduce((max, e) => e.detected_at > max ? e.detected_at : max, group[0].detected_at),
        open_count: group.filter(e => e.status !== "RESOLVED").length,
        resolved_count: group.filter(e => e.status === "RESOLVED").length,
        reopen_count: group.filter(e => e.status === "REOPENED").length,
        classification: group.length > 5 ? "SYSTEMIC" : "RECURRING"
      });
    }
  }

  // 8. BOTTLENECKS
  const bottlenecks: any[] = [];
  const blockedClosings = closings.filter((c:any) => c.status === "BLOCKED");
  if (blockedClosings.length > 0) {
    for (const c of blockedClosings) {
      bottlenecks.push({
        bottleneck_type: "CLOSING_BLOCKED",
        severity: "CRITICAL",
        outlet_id: c.outlet_id,
        evidence: `Closing blocked on ${c.tanggal}`,
        impact: "Financial reporting stalled",
        recommended_action: "REVIEW_DAILY_CLOSING"
      });
    }
  }

  // 9. MANAGEMENT INSIGHTS
  const management_insights: any[] = [];
  if (breached > 0) {
    management_insights.push({
      insight_id: "INS-SLA-" + Date.now(),
      type: "SLA_BREACH",
      severity: "HIGH",
      outlet_id: targetOutletId || "ALL",
      metric: "SLA Breach Count",
      current_value: breached,
      baseline_value: 0,
      direction: "DETERIORATING",
      evidence: `${breached} workflows breached SLA`,
      explanation: "SLA breach is actively deteriorating",
      recommended_action: "ESCALATE_WORKFLOW",
      confidence: "HIGH",
      data_coverage: "HIGH"
    });
  }

  return {
    outcome_kpis: { throughput, reliability, quality, resolution },
    sla_performance,
    mttr,
    admin_performance: adminPerformance,
    outlet_health: outletHealth,
    trends,
    recurring_exceptions,
    bottlenecks,
    management_insights
  };
}
