export type EventResult = "SUCCESS" | "REJECTED" | "FAILED" | "WARNING" | "CRITICAL";

export interface AuditEventInput {
  id?: string;
  audit_id?: string;
  actor_id?: string;
  actor_name?: string;
  actor_role?: string;
  outlet_id?: string;
  outlet_name?: string;
  entity_type: string;
  entity_id?: string;
  transaksi_id?: string;
  pengiriman_id?: string;
  import_id?: string;
  event_type: string;
  action: string;
  previous_status?: string;
  new_status?: string;
  before?: any;
  after?: any;
  result: EventResult;
  source?: string;
  route?: string;
  correlation_id?: string;
  reason?: string;
  error_code?: string;
  metadata?: any;
}

const SENSITIVE_KEYS = ["password", "token", "access_token", "refresh_token", "secret", "credential", "api_key", "pin", "otp"];

export function redactSensitiveData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item));
  }

  const sanitized: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some(sKey => lowerKey.includes(sKey))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof data[key] === "object") {
      sanitized[key] = redactSensitiveData(data[key]);
    } else {
      sanitized[key] = data[key];
    }
  }
  return sanitized;
}

export function logAuditEvent(db: any, input: AuditEventInput) {
  if (!db.AuditLogs) db.AuditLogs = [];

  const entityId = input.entity_id || input.transaksi_id || input.pengiriman_id || input.import_id || "";

  // Idempotency check: same correlation_id + event_type + entity_id + action
  if (input.correlation_id) {
    const existing = db.AuditLogs.find((log: any) => {
      let isMatch = log.correlation_id === input.correlation_id && 
                    log.event_type === input.event_type &&
                    (log.action === input.action || !input.action);
      if (input.transaksi_id) isMatch = isMatch && log.transaksi_id === input.transaksi_id;
      if (input.pengiriman_id) isMatch = isMatch && log.pengiriman_id === input.pengiriman_id;
      if (input.import_id) isMatch = isMatch && log.import_id === input.import_id;
      if (entityId) isMatch = isMatch && (log.entity_id === entityId || log.transaksi_id === entityId);
      return isMatch;
    });

    if (existing) {
      return existing; // idempotent, return existing record
    }
  }

  const now = new Date().toISOString();
  const audit_id = input.audit_id || input.id || ("ADT-" + String(Date.now()).slice(-6) + Math.floor(Math.random() * 100));

  const cleanBefore = input.before ? redactSensitiveData(input.before) : undefined;
  const cleanAfter = input.after ? redactSensitiveData(input.after) : undefined;
  const cleanMetadata = input.metadata ? redactSensitiveData(input.metadata) : {};

  const newLog = {
    // Standard Audit Event Schema
    id: audit_id,
    audit_id,
    created_at: now,
    actor_id: input.actor_id || "SYSTEM",
    actor_name: input.actor_name || "System",
    actor_role: input.actor_role || "SYSTEM",
    outlet_id: input.outlet_id || "",
    outlet_name: input.outlet_name || "",
    entity_type: input.entity_type,
    entity_id: entityId,
    transaksi_id: input.transaksi_id || (input.entity_type === "TRANSACTION" ? entityId : ""),
    pengiriman_id: input.pengiriman_id || (input.entity_type === "SHIPMENT" ? entityId : ""),
    import_id: input.import_id || (input.entity_type === "IMPORT" ? entityId : ""),
    event_type: input.event_type,
    action: input.action,
    previous_status: input.previous_status || "",
    new_status: input.new_status || "",
    before: cleanBefore,
    after: cleanAfter,
    result: input.result,
    source: input.source || "SYSTEM",
    route: input.route || "",
    correlation_id: input.correlation_id || "",
    reason: input.reason || "",
    error_code: input.error_code || "",
    metadata: cleanMetadata,

    // Backward-compatibility legacy fields
    log_id: audit_id,
    timestamp: now,
    user_id: input.actor_id || "SYSTEM",
    aksi: input.action,
    detail: `[${input.event_type}] ${input.action} - Result: ${input.result}` + (input.reason ? ` (${input.reason})` : "")
  };

  db.AuditLogs.unshift(newLog); // Append-only pattern (newest log prepended for UI performance, timeline helper sorts ascending)
  return newLog;
}

export function recordAuditEvent(db: any, input: AuditEventInput) {
  return logAuditEvent(db, input);
}

export function getAuditTrail(db: any, filters: {
  transaksi_id?: string;
  correlation_id?: string;
  import_id?: string;
  actor_id?: string;
  entity_id?: string;
  entity_type?: string;
  tanggal?: string;
  event_type?: string;
  outlet_id?: string;
  result?: EventResult;
}) {
  let logs = db.AuditLogs || [];
  if (filters.transaksi_id) {
    logs = logs.filter((l: any) => l.transaksi_id === filters.transaksi_id || l.entity_id === filters.transaksi_id);
  }
  if (filters.correlation_id) {
    logs = logs.filter((l: any) => l.correlation_id === filters.correlation_id);
  }
  if (filters.import_id) {
    logs = logs.filter((l: any) => l.import_id === filters.import_id || l.entity_id === filters.import_id);
  }
  if (filters.actor_id) {
    logs = logs.filter((l: any) => l.actor_id === filters.actor_id || l.user_id === filters.actor_id);
  }
  if (filters.entity_id) {
    logs = logs.filter((l: any) => l.entity_id === filters.entity_id || l.transaksi_id === filters.entity_id || l.import_id === filters.entity_id);
  }
  if (filters.entity_type) {
    logs = logs.filter((l: any) => l.entity_type === filters.entity_type);
  }
  if (filters.outlet_id) {
    logs = logs.filter((l: any) => l.outlet_id === filters.outlet_id);
  }
  if (filters.result) {
    logs = logs.filter((l: any) => l.result === filters.result);
  }
  if (filters.tanggal) {
    logs = logs.filter((l: any) => {
      const d = l.created_at || l.timestamp || "";
      return d.startsWith(filters.tanggal);
    });
  }
  if (filters.event_type) {
    logs = logs.filter((l: any) => l.event_type === filters.event_type);
  }

  return logs;
}

export function reconstructTransactionHistory(db: any, transaksi_id: string) {
  const logs = getAuditTrail(db, { transaksi_id });
  return logs.slice().sort((a: any, b: any) => {
    const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
    const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
    return timeA - timeB; // Ascending order
  });
}
