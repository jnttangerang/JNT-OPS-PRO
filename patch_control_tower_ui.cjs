const fs = require('fs');
let code = fs.readFileSync('src/components/owner/ManagementControlTowerPage.tsx', 'utf8');

// Replace the hardcoded Action Required with the dynamic queue
// Actually, it is better to modify the Action Required UI to use the ManagementDecisions we fetch.
// First we need to fetch them.
code = code.replace(
  'const [summaryData, setSummaryData] = useState<any>(null);',
  'const [summaryData, setSummaryData] = useState<any>(null);\n  const [decisions, setDecisions] = useState<any[]>([]);'
);

code = code.replace(
  'const [summaryRes, matrixRes, trendRes] = await Promise.all([',
  'const [summaryRes, matrixRes, trendRes, decisionsRes] = await Promise.all(['
);

code = code.replace(
  'fetch(`/api/control-tower/trend?outlet_id=${activeOutletId}&end_date=${tanggal}&days=7`).then(res => res.json())',
  'fetch(`/api/control-tower/trend?outlet_id=${activeOutletId}&end_date=${tanggal}&days=7`).then(res => res.json()),\n        fetch(`/api/management/decisions?outlet_id=${session.role === "OWNER" ? "" : activeOutletId}&role=${session.role}&tanggal=${tanggal}`).then(res => res.json())'
);

code = code.replace(
  'setTrendData(trendRes.data || []);',
  'setTrendData(trendRes.data || []);\n      setDecisions(decisionsRes.data || []);'
);

// We replace the summaryData.actionRequired block
const oldActionBlock = `{summaryData.actionRequired?.length > 0 && (
            <Card className="border-red-100 shadow-sm overflow-hidden border-2">
              <div className="bg-red-50 px-4 py-3 border-b border-red-100 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <h3 className="font-black text-red-900 tracking-tight text-sm">ACTION REQUIRED</h3>
                <span className="ml-auto bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  {summaryData.actionRequired.length} ISSUES
                </span>
              </div>
              <div className="divide-y divide-gray-50 bg-white">
                {summaryData.actionRequired.map((action: any, idx: number) => (
                  <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getSeverityBadge(action.severity)}</div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{action.issue}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 font-medium">
                          <span>{outlets.find(o => o.outlet_id === action.outlet)?.nama_outlet || action.outlet}</span>
                          <span>&bull;</span>
                          <span>{action.tanggal}</span>
                          {action.age > 0 && (
                            <>
                              <span>&bull;</span>
                              <span className="text-red-500 font-bold flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Age: {action.age} hari
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        if (action.issue.includes("Settlement")) onNavigate("setoran-owner");
                        else if (action.issue.includes("Closing")) onNavigate("daily-closing");
                        else if (action.issue.includes("Financial Close")) onNavigate("reporting");
                        else onNavigate("owner-audit");
                      }}
                      className="px-4 py-2 bg-white border border-gray-200 shadow-sm rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all self-start sm:self-center"
                    >
                      {action.action}
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}`;

const newActionBlock = `{decisions.filter(d => d.status !== "RESOLVED" && d.status !== "ACCEPTED").length > 0 && (
            <Card className="border-red-100 shadow-sm overflow-hidden border-2">
              <div className="bg-red-50 px-4 py-3 border-b border-red-100 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <h3 className="font-black text-red-900 tracking-tight text-sm">MANAGEMENT ACTION QUEUE</h3>
                <span className="ml-auto bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  {decisions.filter(d => d.status !== "RESOLVED" && d.status !== "ACCEPTED").length} PENDING
                </span>
              </div>
              <div className="divide-y divide-gray-50 bg-white">
                {decisions.filter(d => d.status !== "RESOLVED" && d.status !== "ACCEPTED").map((decision: any) => (
                  <div key={decision.decision_id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <span className={\`px-2 py-0.5 rounded-full text-xs font-bold border \${
                          decision.priority === 'P0' ? 'bg-red-100 text-red-700 border-red-200' :
                          decision.priority === 'P1' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                          decision.priority === 'P2' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                          'bg-blue-100 text-blue-700 border-blue-200'
                        }\`}>
                          {decision.priority}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{decision.title}</p>
                        <p className="text-xs text-gray-600 mt-0.5 max-w-xl truncate">{decision.summary}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500 font-medium">
                          <span>{outlets.find(o => o.outlet_id === decision.outlet_id)?.nama_outlet || decision.outlet_id}</span>
                          <span>&bull;</span>
                          <span>{decision.tanggal}</span>
                          <span>&bull;</span>
                          <span className="font-mono">{decision.status}</span>
                          {decision.financial_impact > 0 && (
                            <>
                              <span>&bull;</span>
                              <span className="text-red-600 font-bold font-mono text-xs">{formatCurrency(decision.financial_impact)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 self-start sm:self-center">
                      {session.role === "OWNER" && decision.status === "OPEN" && (
                         <button 
                         onClick={async () => {
                           await fetch('/api/management/decision/acknowledge', {
                             method: 'POST',
                             headers: {'Content-Type': 'application/json'},
                             body: JSON.stringify({ decision_id: decision.decision_id, actor_id: session.user_id, actor_name: session.nama_lengkap, actor_role: session.role })
                           });
                           fetchData();
                         }}
                         className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-200 transition-all"
                       >
                         Acknowledge
                       </button>
                      )}
                      <button 
                        onClick={() => {
                          if (decision.entity_type === "SETTLEMENT") onNavigate("setoran-owner");
                          else if (decision.entity_type === "CLOSING") onNavigate("daily-closing");
                          else if (decision.entity_type === "CERTIFICATION") onNavigate("reporting");
                          else onNavigate("owner-audit");
                        }}
                        className="px-4 py-1.5 bg-white border border-gray-200 shadow-sm rounded-lg text-xs font-bold text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-all"
                      >
                        {decision.recommended_action || "Review"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}`;
          
code = code.replace(oldActionBlock, newActionBlock);

fs.writeFileSync('src/components/owner/ManagementControlTowerPage.tsx', code);
