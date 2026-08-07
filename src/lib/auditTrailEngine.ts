export type EventResult = "SUCCESS" | "REJECTED" | "FAILED" | "WARNING" | "CRITICAL";

export interface AuditEventInput {
  actor_id?: string;
  actor_name?: string;
  actor_role?: string;
  outlet_id?: string;
  outlet_name?: string;
  transaksi_id?: string;
  pengiriman_id?: string;
  import_id?: string;
  event_type: string;
  entity_type: string;
  action: string;
  previous_status?: string;
  new_status?: string;
  result: EventResult;
  source?: string;
  correlation_id?: string;
  reason?: string;
  metadata?: any;
}

export function logAuditEvent(db: any, input: AuditEventInput) {
  if (!db.AuditLogs) db.AuditLogs = [];
  
  // Idempotency check: same correlation_id, event_type, entity identifier
  if (input.correlation_id) {
    const existing = db.AuditLogs.find((log: any) => {
      let isMatch = log.correlation_id === input.correlation_id && log.event_type === input.event_type;
      if (input.transaksi_id) isMatch = isMatch && log.transaksi_id === input.transaksi_id;
      if (input.pengiriman_id) isMatch = isMatch && log.pengiriman_id === input.pengiriman_id;
      if (input.import_id) isMatch = isMatch && log.import_id === input.import_id;
      return isMatch;
    });

    if (existing) {
      return existing; // idempotent, do not duplicate
    }
  }

  const now = new Date().toISOString();
  const audit_id = "ADT-" + String(Date.now()).slice(-6) + Math.floor(Math.random() * 100);

  const newLog = {
    // New Standard Fields
    audit_id,
    created_at: now,
    actor_id: input.actor_id || "SYSTEM",
    actor_name: input.actor_name || "System",
    actor_role: input.actor_role || "SYSTEM",
    outlet_id: input.outlet_id || "",
    outlet_name: input.outlet_name || "",
    transaksi_id: input.transaksi_id || "",
    pengiriman_id: input.pengiriman_id || "",
    import_id: input.import_id || "",
    event_type: input.event_type,
    entity_type: input.entity_type,
    action: input.action,
    previous_status: input.previous_status || "",
    new_status: input.new_status || "",
    result: input.result,
    source: input.source || "SYSTEM",
    correlation_id: input.correlation_id || "",
    reason: input.reason || "",
    metadata: input.metadata || {},

    // Legacy fields mapped
    log_id: audit_id,
    timestamp: now,
    user_id: input.actor_id || "SYSTEM",
    aksi: input.action,
    detail: `[${input.event_type}] ${input.action} - Result: ${input.result}` + (input.reason ? ` (${input.reason})` : "")
  };

  db.AuditLogs.unshift(newLog);
  return newLog;
}

export function getAuditTrail(db: any, filters: {
  transaksi_id?: string;
  correlation_id?: string;
  import_id?: string;
  actor_id?: string;
  tanggal?: string;
  event_type?: string;
}) {
  let logs = db.AuditLogs || [];
  if (filters.transaksi_id) logs = logs.filter((l: any) => l.transaksi_id === filters.transaksi_id);
  if (filters.correlation_id) logs = logs.filter((l: any) => l.correlation_id === filters.correlation_id);
  if (filters.import_id) logs = logs.filter((l: any) => l.import_id === filters.import_id);
  if (filters.actor_id) logs = logs.filter((l: any) => l.actor_id === filters.actor_id || l.user_id === filters.actor_id);
  if (filters.tanggal) {
    logs = logs.filter((l: any) => {
      const d = l.created_at || l.timestamp || "";
      return d.startsWith(filters.tanggal);
    });
  }
  if (filters.event_type) logs = logs.filter((l: any) => l.event_type === filters.event_type);

  return logs;
}

export function reconstructTransactionHistory(db: any, transaksi_id: string) {
  const logs = getAuditTrail(db, { transaksi_id });
  return logs.sort((a: any, b: any) => {
    const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
    const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
    return timeA - timeB; // Ascending order
  });
}
