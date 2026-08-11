const fs = require('fs');
let code = fs.readFileSync('src/lib/decisionEngine.ts', 'utf8');

// Fix AuditEventInput missing fields 'action' and 'result'
// The logAuditEvent signature expects action, result.
// I will patch logAuditEvent calls in decisionEngine.ts
code = code.replace(
  /event_type:\s*"MANAGEMENT_DECISION_ACKNOWLEDGED",/g,
  'event_type: "MANAGEMENT_DECISION_ACKNOWLEDGED", action: "ACKNOWLEDGE", result: "SUCCESS",'
);
code = code.replace(
  /event_type:\s*"MANAGEMENT_DECISION_ASSIGNED",/g,
  'event_type: "MANAGEMENT_DECISION_ASSIGNED", action: "ASSIGN", result: "SUCCESS",'
);
code = code.replace(
  /event_type:\s*"MANAGEMENT_DECISION_STARTED",/g,
  'event_type: "MANAGEMENT_DECISION_STARTED", action: "START", result: "SUCCESS",'
);
code = code.replace(
  /event_type:\s*params\.resolution_type === "RESOLVED" \? "MANAGEMENT_DECISION_RESOLVED" : "MANAGEMENT_DECISION_ACCEPTED",/g,
  'event_type: params.resolution_type === "RESOLVED" ? "MANAGEMENT_DECISION_RESOLVED" : "MANAGEMENT_DECISION_ACCEPTED", action: "RESOLVE", result: "SUCCESS",'
);
code = code.replace(
  /event_type:\s*"MANAGEMENT_DECISION_REOPENED",/g,
  'event_type: "MANAGEMENT_DECISION_REOPENED", action: "REOPEN", result: "SUCCESS",'
);
code = code.replace(
  /event_type:\s*"MANAGEMENT_DECISION_ESCALATED",/g,
  'event_type: "MANAGEMENT_DECISION_ESCALATED", action: "ESCALATE", result: "SUCCESS",'
);

fs.writeFileSync('src/lib/decisionEngine.ts', code);
