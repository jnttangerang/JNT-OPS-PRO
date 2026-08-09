const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// The req.body fields are typed as `any` anyway in typical express. 
// But let's cast them string explicitly to fix TS errors.
code = code.replace(
  'const result = acknowledgeDecision(db, req.body);',
  'const result = acknowledgeDecision(db, { decision_id: req.body.decision_id as string, actor_id: req.body.actor_id as string, actor_name: req.body.actor_name as string, actor_role: req.body.actor_role as string, reason: req.body.reason as string });'
);
code = code.replace(
  'const result = assignDecision(db, req.body);',
  'const result = assignDecision(db, { decision_id: req.body.decision_id as string, assigned_to: req.body.assigned_to as string, actor_id: req.body.actor_id as string, actor_name: req.body.actor_name as string, actor_role: req.body.actor_role as string, reason: req.body.reason as string });'
);
code = code.replace(
  'const result = startDecision(db, req.body);',
  'const result = startDecision(db, { decision_id: req.body.decision_id as string, actor_id: req.body.actor_id as string, actor_name: req.body.actor_name as string, actor_role: req.body.actor_role as string, reason: req.body.reason as string });'
);
code = code.replace(
  'const result = resolveDecision(db, req.body);',
  'const result = resolveDecision(db, { decision_id: req.body.decision_id as string, actor_id: req.body.actor_id as string, actor_name: req.body.actor_name as string, actor_role: req.body.actor_role as string, reason: req.body.reason as string, resolution_type: req.body.resolution_type as "RESOLVED"|"ACCEPTED" });'
);
code = code.replace(
  'const result = reopenDecision(db, req.body);',
  'const result = reopenDecision(db, { decision_id: req.body.decision_id as string, actor_id: req.body.actor_id as string, actor_name: req.body.actor_name as string, actor_role: req.body.actor_role as string, reason: req.body.reason as string });'
);
code = code.replace(
  'const result = escalateDecision(db, req.body);',
  'const result = escalateDecision(db, { decision_id: req.body.decision_id as string, actor_id: req.body.actor_id as string, actor_name: req.body.actor_name as string, actor_role: req.body.actor_role as string, reason: req.body.reason as string });'
);

fs.writeFileSync('server.ts', code);
