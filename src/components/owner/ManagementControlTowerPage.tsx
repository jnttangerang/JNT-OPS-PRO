import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Calendar, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  FileText,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Clock,
  Shield,
  Search
} from 'lucide-react';
import { getTodayWIB } from '../../utils/dateUtils';


interface ManagementControlTowerPageProps {
  session: any;
  outlets: any[];
  activeOutletId: string;
  onChangeActiveOutlet: (outletId: string) => void;
  onNavigate: (view: string) => void;
}

export default function ManagementControlTowerPage({
  session,
  outlets,
  activeOutletId,
  onChangeActiveOutlet,
  onNavigate
}: ManagementControlTowerPageProps) {
  const [tanggal, setTanggal] = useState<string>(() => getTodayWIB());
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [workflowSummary, setWorkflowSummary] = useState<any>(null);
  const [intelligenceData, setIntelligenceData] = useState<any>(null);
  const [reviewData, setReviewData] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [matrixData, setMatrixData] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, matrixRes, trendRes, decisionsRes, workflowRes, intelRes, reviewRes] = await Promise.all([
        fetch(`/api/control-tower/summary?outlet_id=${activeOutletId}&tanggal=${tanggal}`).then(res => res.json()),
        fetch(`/api/control-tower/matrix?tanggal=${tanggal}`).then(res => res.json()),
        fetch(`/api/control-tower/trend?outlet_id=${activeOutletId}&end_date=${tanggal}&days=7`).then(res => res.json()),
        fetch(`/api/management/decisions?outlet_id=${session.role === "OWNER" ? "" : activeOutletId}&role=${session.role}&tanggal=${tanggal}`).then(res => res.json()),
        fetch(`/api/workflow/summary?outlet_id=${activeOutletId}&tanggal=${tanggal}`).then(res => res.json()),
        fetch(`/api/intelligence/summary?outlet_id=${activeOutletId}&tanggal=${tanggal}&role=${session.role}&actor_id=${session.user?.id || "SYS"}`).then(res => res.json()),
        fetch(`/api/management-review/summary?outlet_id=${activeOutletId}&tanggal=${tanggal}&role=${session.role}&actor_id=${session.user?.id || "SYS"}`).then(res => res.json())
      ]);

      if (summaryRes.status === "error") throw new Error(summaryRes.message);
      
      setSummaryData(summaryRes.data);
      setMatrixData(matrixRes.data || []);
      setTrendData(trendRes.data || []);
      setDecisions(decisionsRes.data || []);
      if (workflowRes.status === "success" || workflowRes.data) {
        setWorkflowSummary(workflowRes.data);
      }
      if (intelRes.status === "success" || intelRes.data) {
        setIntelligenceData(intelRes.data);
      }
      if (reviewRes.status === "success" || reviewRes.data) {
        setReviewData(reviewRes.data || []);
      }
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error(err);
      setError("Gagal memuat Data Control Tower.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeOutletId, tanggal]);

  if (session.role !== "OWNER") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center space-y-4">
        <Shield className="h-16 w-16 text-red-100" />
        <h2 className="text-xl font-bold text-gray-800">Akses Ditolak</h2>
        <p className="text-sm text-gray-500 max-w-sm">Halaman Management Control Tower hanya dapat diakses oleh Owner untuk memonitor kesehatan operasional dan keuangan outlet.</p>
      </div>
    );
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val || 0);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold border border-red-200">CRITICAL</span>;
      case "ERROR": return <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-bold border border-orange-200">ERROR</span>;
      case "WARNING": return <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs font-bold border border-yellow-200">WARNING</span>;
      default: return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold border border-blue-200">{severity}</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status || "OPEN";
    switch (s) {
      case "CLOSED":
      case "CERTIFIED":
      case "RESOLVED":
      case "APPROVED":
      case "MATCHED":
      case "FINAL":
        return <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 font-mono text-[10px] font-bold tracking-wider">{s}</span>;
      case "BLOCKED":
      case "MISMATCH":
      case "REJECTED":
        return <span className="text-red-700 bg-red-50 px-2 py-1 rounded-md border border-red-100 font-mono text-[10px] font-bold tracking-wider">{s}</span>;
      default:
        return <span className="text-gray-700 bg-gray-50 px-2 py-1 rounded-md border border-gray-200 font-mono text-[10px] font-bold tracking-wider">{s}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8 animate-in fade-in duration-300">
      
      {/* HEADER & FILTERS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" />
            Control Tower
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">Financial & Operational Operations Dashboard</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
            <Building2 className="h-4 w-4 text-gray-400 ml-2 mr-1" />
            <select
              value={activeOutletId}
              onChange={(e) => onChangeActiveOutlet(e.target.value)}
              className="bg-transparent border-none text-sm font-semibold text-gray-800 focus:ring-0 cursor-pointer pr-8 py-1.5"
            >
              <option value="ALL">Semua Outlet</option>
              {outlets.map((o) => (
                <option key={o.outlet_id} value={o.outlet_id}>{o.nama_outlet}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
            <Calendar className="h-4 w-4 text-gray-400 ml-2 mr-1" />
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="bg-transparent border-none text-sm font-semibold text-gray-800 focus:ring-0 cursor-pointer py-1.5"
            />
          </div>
          
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle className="h-5 w-5" />
          <div className="flex-1">
            <p className="font-bold text-sm">Failed to load Control Tower data</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
          <button onClick={fetchData} className="px-3 py-1.5 bg-white rounded border border-red-200 text-xs font-bold shadow-sm hover:bg-red-50">Retry</button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="animate-pulse bg-gray-200 h-28 w-full rounded-xl" />)}
        </div>
      ) : summaryData ? (
        <>
          <div className="flex items-center justify-end text-xs text-gray-400 font-mono">
            Last Updated: {lastUpdated.toLocaleTimeString()}
          </div>

          {/* ACTION REQUIRED - HIGHEST PRIORITY */}
          {decisions.filter(d => d.status !== "RESOLVED" && d.status !== "ACCEPTED").length > 0 && (
            <div className="bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden border-2">
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
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                          decision.priority === 'P0' ? 'bg-red-100 text-red-700 border-red-200' :
                          decision.priority === 'P1' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                          decision.priority === 'P2' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                          'bg-blue-100 text-blue-700 border-blue-200'
                        }`}>
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
            </div>
          )}

          {/* MANAGEMENT REVIEW QUEUE */}
          {reviewData && reviewData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                <h3 className="font-black text-gray-900 tracking-tight text-sm uppercase">Management Review Cycle</h3>
                <span className="ml-auto bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {reviewData.length} REVIEWS
                </span>
              </div>
              <div className="divide-y divide-gray-100 bg-white">
                {reviewData.map((review: any) => (
                  <div key={review.review_id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          review.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                          review.status === 'ACTION_REQUIRED' ? 'bg-red-100 text-red-700 border-red-200' :
                          review.status === 'ACTION_IN_PROGRESS' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                          review.status === 'VERIFICATION_REQUIRED' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                          'bg-blue-100 text-blue-700 border-blue-200'
                        }`}>
                          {review.status}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{review.review_id} <span className="text-gray-400 font-normal ml-1">({review.period})</span></p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                          <span className="flex items-center gap-1 font-medium"><Building2 className="h-3 w-3"/> {outlets.find(o => o.outlet_id === review.outlet_id)?.nama_outlet || review.outlet_id}</span>
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3"/> {review.tanggal}</span>
                          {review.deviations?.length > 0 && (
                            <span className="flex items-center gap-1 text-red-600 font-bold"><AlertTriangle className="h-3 w-3"/> {review.deviations.length} Deviations</span>
                          )}
                          {review.insights?.length > 0 && (
                            <span className="flex items-center gap-1 text-blue-600 font-medium"><Activity className="h-3 w-3"/> {review.insights.length} Insights</span>
                          )}
                          {review.decisions?.length > 0 && (
                            <span className="flex items-center gap-1 text-indigo-600 font-bold"><Shield className="h-3 w-3"/> {review.decisions.length} Decisions</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <button className="px-4 py-1.5 bg-white border border-gray-200 shadow-sm rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all">
                         View Details
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WORKFLOW & SLA HEALTH CONTROL PANEL */}
          {workflowSummary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* ACTION REQUIRED */}
              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-red-600" />
                    <h4 className="text-xs font-black uppercase text-gray-900 tracking-wider">Action Required</h4>
                  </div>
                  <span className="bg-red-100 text-red-700 text-xs font-black px-2 py-0.5 rounded-full font-mono">
                    {workflowSummary.action_required?.total_open || 0} Open
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-red-50 p-2 rounded-lg border border-red-100">
                    <div className="text-[10px] font-bold text-red-600 uppercase">P0</div>
                    <div className="text-base font-black text-red-900">{workflowSummary.action_required?.p0 || 0}</div>
                  </div>
                  <div className="bg-orange-50 p-2 rounded-lg border border-orange-100">
                    <div className="text-[10px] font-bold text-orange-600 uppercase">P1</div>
                    <div className="text-base font-black text-orange-900">{workflowSummary.action_required?.p1 || 0}</div>
                  </div>
                  <div className="bg-yellow-50 p-2 rounded-lg border border-yellow-100">
                    <div className="text-[10px] font-bold text-yellow-600 uppercase">P2</div>
                    <div className="text-base font-black text-yellow-900">{workflowSummary.action_required?.p2 || 0}</div>
                  </div>
                  <div className="bg-blue-50 p-2 rounded-lg border border-blue-100">
                    <div className="text-[10px] font-bold text-blue-600 uppercase">P3</div>
                    <div className="text-base font-black text-blue-900">{workflowSummary.action_required?.p3 || 0}</div>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-gray-50 flex justify-between items-center text-xs text-gray-500 font-medium">
                  <span>Overdue: <strong className="text-red-600">{workflowSummary.action_required?.overdue || 0}</strong></span>
                  <span>Escalated: <strong className="text-orange-600">{workflowSummary.action_required?.escalated || 0}</strong></span>
                  <span>Unassigned: <strong className="text-gray-700">{workflowSummary.action_required?.unassigned || 0}</strong></span>
                </div>
              </div>

              {/* WORKFLOW STATUS SUMMARY */}
              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <h4 className="text-xs font-black uppercase text-gray-900 tracking-wider">Workflow Summary</h4>
                  </div>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-mono">
                    Cases Active
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <div className="text-[10px] font-bold text-gray-500 uppercase">In Progress</div>
                    <div className="text-base font-black text-gray-900">{workflowSummary.workflow_summary?.in_progress || 0}</div>
                  </div>
                  <div className="bg-purple-50 p-2 rounded-lg border border-purple-100">
                    <div className="text-[10px] font-bold text-purple-600 uppercase">Pending Verif</div>
                    <div className="text-base font-black text-purple-900">{workflowSummary.workflow_summary?.pending_verification || 0}</div>
                  </div>
                  <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                    <div className="text-[10px] font-bold text-emerald-600 uppercase">Resolved/Closed</div>
                    <div className="text-base font-black text-emerald-900">{(workflowSummary.workflow_summary?.resolved || 0) + (workflowSummary.workflow_summary?.closed || 0)}</div>
                  </div>
                </div>
              </div>

              {/* SLA HEALTH */}
              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-600" />
                    <h4 className="text-xs font-black uppercase text-gray-900 tracking-wider">SLA Health</h4>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full font-mono ${
                    (workflowSummary.sla_health?.breached || 0) > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {(workflowSummary.sla_health?.breached || 0) > 0 ? 'BREACH DETECTED' : 'HEALTHY'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                    <div className="text-[10px] font-bold text-emerald-600 uppercase">On Track</div>
                    <div className="text-base font-black text-emerald-900">{workflowSummary.sla_health?.on_track || 0}</div>
                  </div>
                  <div className="bg-yellow-50 p-2 rounded-lg border border-yellow-100">
                    <div className="text-[10px] font-bold text-yellow-600 uppercase">Due Soon</div>
                    <div className="text-base font-black text-yellow-900">{workflowSummary.sla_health?.due_soon || 0}</div>
                  </div>
                  <div className="bg-orange-50 p-2 rounded-lg border border-orange-100">
                    <div className="text-[10px] font-bold text-orange-600 uppercase">Overdue</div>
                    <div className="text-base font-black text-orange-900">{workflowSummary.sla_health?.overdue || 0}</div>
                  </div>
                  <div className="bg-red-50 p-2 rounded-lg border border-red-100">
                    <div className="text-[10px] font-bold text-red-600 uppercase">Breached</div>
                    <div className="text-base font-black text-red-900">{workflowSummary.sla_health?.breached || 0}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PHASE 38 - MANAGEMENT INTELLIGENCE SECTIONS */}
          {intelligenceData && (
            <div className="space-y-4">
              
              {/* OPERATIONAL INTELLIGENCE */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* BOTTLENECKS */}
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                   <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-3">Top Bottleneck</h3>
                   {intelligenceData.bottlenecks?.length > 0 ? (
                     <div className="space-y-2">
                       {intelligenceData.bottlenecks.map((b: any, idx: number) => (
                         <div key={idx} className="bg-red-50 p-3 rounded-lg border border-red-100 flex items-start gap-3">
                           <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                           <div>
                             <h4 className="text-sm font-bold text-red-900">{b.bottleneck_type.replace(/_/g, " ")}</h4>
                             <p className="text-xs text-red-700">{b.evidence}</p>
                             <div className="mt-2 text-xs font-bold text-red-800 bg-red-100 px-2 py-0.5 rounded inline-block">Action: {b.recommended_action}</div>
                           </div>
                         </div>
                       ))}
                     </div>
                   ) : (
                     <div className="text-xs text-gray-500 italic bg-gray-50 p-3 rounded-lg text-center">No major bottlenecks detected.</div>
                   )}
                </div>

                {/* MANAGEMENT INSIGHTS & RECURRING EXCEPTIONS */}
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-4">
                   <div>
                     <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-3">Management Insights</h3>
                     {intelligenceData.management_insights?.length > 0 ? (
                       <div className="space-y-2">
                         {intelligenceData.management_insights.map((ins: any, idx: number) => (
                           <div key={idx} className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                             <div className="flex justify-between items-center mb-1">
                               <h4 className="text-xs font-bold text-orange-900">{ins.type.replace(/_/g, " ")}</h4>
                               <span className="text-[10px] font-bold text-orange-700 uppercase bg-orange-100 px-1.5 py-0.5 rounded">{ins.direction}</span>
                             </div>
                             <p className="text-xs text-orange-800 mb-1">{ins.explanation}</p>
                             <div className="text-[10px] text-gray-600 font-medium">Recommended: <span className="font-bold text-gray-900">{ins.recommended_action}</span></div>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <div className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded-lg text-center">No critical insights.</div>
                     )}
                   </div>
                   
                   <div>
                     <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-3">Recurring Exceptions</h3>
                     {intelligenceData.recurring_exceptions?.length > 0 ? (
                       <div className="space-y-2">
                         {intelligenceData.recurring_exceptions.slice(0, 3).map((re: any, idx: number) => (
                           <div key={idx} className="bg-gray-50 p-2 rounded-lg border border-gray-200 flex justify-between items-center">
                             <div>
                               <div className="text-xs font-bold text-gray-900">{re.exception_type}</div>
                               <div className="text-[10px] text-gray-500">{re.classification} ({re.occurrence}x occurrences)</div>
                             </div>
                             <div className="text-right">
                               <div className="text-[10px] font-bold text-red-600">{re.open_count} Open</div>
                               <div className="text-[10px] text-gray-500">{re.resolved_count} Resolved</div>
                             </div>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <div className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded-lg text-center">No recurring exceptions detected.</div>
                     )}
                   </div>
                </div>
              </div>

              {/* OUTLET HEALTH (OWNER ONLY) */}
              {session.role === "OWNER" && intelligenceData.outlet_health?.length > 0 && (
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-3">Outlet Health & Performance</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/50">
                          <th className="py-2 px-3 text-[10px] font-black text-gray-500 uppercase">Outlet</th>
                          <th className="py-2 px-3 text-[10px] font-black text-gray-500 uppercase text-center">Score</th>
                          <th className="py-2 px-3 text-[10px] font-black text-gray-500 uppercase text-center">Volume</th>
                          <th className="py-2 px-3 text-[10px] font-black text-gray-500 uppercase text-center">Open Exc</th>
                          <th className="py-2 px-3 text-[10px] font-black text-gray-500 uppercase text-center">Closing</th>
                          <th className="py-2 px-3 text-[10px] font-black text-gray-500 uppercase text-center">Overdue Wf</th>
                        </tr>
                      </thead>
                      <tbody>
                        {intelligenceData.outlet_health.map((oh: any, idx: number) => (
                          <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-3 text-xs font-bold text-gray-900">{oh.outlet_id}</td>
                            <td className="py-2 px-3 text-center">
                              <span className={`text-xs font-black px-2 py-0.5 rounded ${
                                oh.health_score >= 80 ? 'bg-emerald-100 text-emerald-800' :
                                oh.health_score >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                              }`}>{oh.health_score}</span>
                            </td>
                            <td className="py-2 px-3 text-xs text-center font-mono">{oh.transaction_volume}</td>
                            <td className="py-2 px-3 text-xs text-center font-mono">{oh.open_exceptions}</td>
                            <td className="py-2 px-3 text-xs text-center font-mono">{oh.closing_status}</td>
                            <td className="py-2 px-3 text-xs text-center font-mono">{oh.overdue_workflow}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ADMIN PERFORMANCE */}
              {intelligenceData.admin_performance?.length > 0 && (
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-3">Admin Workload & Performance</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {intelligenceData.admin_performance.map((ap: any, idx: number) => (
                      <div key={idx} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                          <div className="font-bold text-sm text-gray-900">{ap.admin_id}</div>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                            ap.workload_classification === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                            ap.workload_classification === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                            ap.workload_classification === 'NORMAL' ? 'bg-blue-100 text-blue-800' :
                            'bg-emerald-100 text-emerald-800'
                          }`}>{ap.workload_classification} WORKLOAD</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center text-xs">
                          <div>
                            <div className="text-[10px] text-gray-500 uppercase">Volume</div>
                            <div className="font-mono font-bold text-gray-900">{ap.total_resi}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-500 uppercase">Backlog</div>
                            <div className="font-mono font-bold text-gray-900">{ap.open_backlog}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-500 uppercase">Resolved</div>
                            <div className="font-mono font-bold text-emerald-700">{ap.workflow_resolved}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-500 uppercase">SLA Breach</div>
                            <div className="font-mono font-bold text-red-600">{ap.sla_breach}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* EXECUTIVE SUMMARY GRIDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Transaksi</span>
              <span className="text-2xl font-black text-gray-900">{summaryData.financialSummary.jumlah_transaksi || 0}</span>
              <span className="text-[10px] text-gray-400 font-medium mt-1">Valid Transactions</span>
            </div>
            
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Customer Pay</span>
              <span className="text-2xl font-black text-gray-900">{formatCurrency(summaryData.financialSummary.total_customer)}</span>
              <span className="text-[10px] text-gray-400 font-medium mt-1">Gross Payment</span>
            </div>

            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 shadow-sm flex flex-col justify-center">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Wajib Setor</span>
              <span className="text-2xl font-black text-blue-900">{formatCurrency(summaryData.financialSummary.total_cash_payment)}</span>
              <span className="text-[10px] text-blue-500 font-medium mt-1">Expected Deposit</span>
            </div>

            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 shadow-sm flex flex-col justify-center">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Kas Outlet</span>
              <span className="text-2xl font-black text-emerald-900">{formatCurrency(summaryData.financialSummary.total_outlet)}</span>
              <span className="text-[10px] text-emerald-500 font-medium mt-1">Retained Earnings</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Settlement Status */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:border-blue-200 transition-colors">
              <div className="pb-2">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Settlement</div>
              </div>
              <div>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-lg font-black text-gray-900">{formatCurrency(summaryData.settlement?.actual_deposit || 0)}</div>
                    <div className="text-[10px] text-gray-400 mt-1">Actual Deposit</div>
                  </div>
                  <div className="mb-1">{getStatusBadge(summaryData.settlement?.status)}</div>
                </div>
              </div>
            </div>

            {/* Reconciliation */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:border-orange-200 transition-colors cursor-pointer" onClick={() => onNavigate("owner-audit")}>
              <div className="pb-2">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Exceptions</div>
              </div>
              <div>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-2xl font-black text-gray-900">{summaryData.exceptions.open}</div>
                    <div className="text-[10px] text-gray-400 mt-1">Open Issues</div>
                  </div>
                  <div className="flex gap-1 mb-1">
                    {summaryData.exceptions.critical > 0 && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
                    {summaryData.exceptions.error > 0 && <span className="w-2 h-2 rounded-full bg-orange-500"></span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Closing */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:border-emerald-200 transition-colors cursor-pointer" onClick={() => onNavigate("daily-closing")}>
              <div className="pb-2">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Daily Closing</div>
              </div>
              <div>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-lg font-black text-gray-900 truncate">
                      {summaryData.dailyClosing?.closing_id ? "Initiated" : "Not Started"}
                    </div>
                  </div>
                  <div className="mb-1">{getStatusBadge(summaryData.dailyClosing?.status)}</div>
                </div>
              </div>
            </div>

            {/* Evidence & Cert */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:border-purple-200 transition-colors cursor-pointer" onClick={() => onNavigate("reporting")}>
              <div className="pb-2">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between">
                  <span>Evidence</span>
                  <span className="font-black text-purple-700">{summaryData.healthScore}/100</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-end">
                  <div className="mb-1">{getStatusBadge(summaryData.evidenceStatus)}</div>
                  <div className="mb-1">{getStatusBadge(summaryData.certification?.status)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* TWO COLUMN LAYOUT FOR DEEPER DIVES */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LEFT COLUMN */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* ADMIN PERFORMANCE */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100">
                  <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-gray-500" />
                    Admin Performance
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-gray-100 text-[10px] font-black tracking-wider text-gray-500 uppercase">
                        <th className="p-3">Admin</th>
                        <th className="p-3 text-right">Total Resi</th>
                        <th className="p-3 text-right">Refund/Batal</th>
                        <th className="p-3 text-right">Setor Owner</th>
                        <th className="p-3 text-right">Kas Outlet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(summaryData.adminPerformance || []).length === 0 ? (
                        <tr><td colSpan={5} className="p-4 text-center text-xs text-gray-500 font-medium">Belum ada transaksi</td></tr>
                      ) : (
                        (summaryData.adminPerformance || []).map((data: any) => (
                          <tr key={data.admin_id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-3 font-bold text-gray-800 text-xs">{data.admin_id}</td>
                            <td className="p-3 text-right font-mono text-xs text-gray-600">{data.jumlah_resi}</td>
                            <td className="p-3 text-right font-mono text-xs text-gray-600">-</td>
                            <td className="p-3 text-right font-mono text-xs font-semibold text-blue-600">{formatCurrency(data.owner_deposit)}</td>
                            <td className="p-3 text-right font-mono text-xs font-semibold text-emerald-600">{formatCurrency(data.outlet_cash)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* OUTLET MATRIX */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100">
                  <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-500" />
                    Global Outlet Matrix
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-gray-100 text-[10px] font-black tracking-wider text-gray-500 uppercase">
                        <th className="p-3">Outlet</th>
                        <th className="p-3 text-right">Txs</th>
                        <th className="p-3 text-right">Deposit</th>
                        <th className="p-3 text-center">Settlement</th>
                        <th className="p-3 text-center">Closing</th>
                        <th className="p-3 text-center">Exception</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {matrixData.map((m: any) => (
                        <tr key={m.outlet_id} className={`hover:bg-gray-50/50 transition-colors cursor-pointer ${m.outlet_id === activeOutletId ? 'bg-blue-50/30' : ''}`} onClick={() => onChangeActiveOutlet(m.outlet_id)}>
                          <td className="p-3 font-bold text-gray-800 text-xs">
                            {m.outlet_name}
                            {m.outlet_id === activeOutletId && <span className="ml-2 w-2 h-2 rounded-full bg-blue-500 inline-block"></span>}
                          </td>
                          <td className="p-3 text-right font-mono text-xs text-gray-600">{m.transaction_count}</td>
                          <td className="p-3 text-right font-mono text-xs font-semibold text-gray-700">{formatCurrency(m.owner_deposit)}</td>
                          <td className="p-3 text-center">{getStatusBadge(m.settlement_status)}</td>
                          <td className="p-3 text-center">{getStatusBadge(m.closing_status)}</td>
                          <td className="p-3 text-center">
                            {m.open_exceptions > 0 ? (
                              <span className="text-red-600 font-black text-xs">{m.open_exceptions} open</span>
                            ) : (
                              <span className="text-gray-400 font-medium text-xs">0</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-6">
              
              {/* RECENT AUDIT LOGS */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="pb-3 border-b border-gray-50">
                  <div className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    Last Activity
                  </div>
                </div>
                <div className="pt-4">
                  <div className="space-y-4">
                    {summaryData.recentLogs?.length === 0 ? (
                      <p className="text-center text-xs text-gray-500 py-4">Belum ada aktivitas</p>
                    ) : (
                      summaryData.recentLogs?.slice(0, 6).map((log: any, idx: number) => (
                        <div key={idx} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5"></div>
                            {idx !== summaryData.recentLogs.length - 1 && <div className="w-px h-full bg-gray-100 my-1"></div>}
                          </div>
                          <div className="flex-1 pb-1">
                            <p className="text-[10px] font-mono text-gray-400">
                              {new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} &bull; {log.actor_name}
                            </p>
                            <p className="text-xs font-bold text-gray-800 mt-0.5 break-all">
                              {log.event_type.replace(/_/g, ' ')}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* EXCEPTIONS AGING */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="pb-3 border-b border-gray-50">
                  <div className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-gray-500" />
                    Aging Exceptions
                  </div>
                </div>
                <div className="pt-4">
                  <div className="space-y-3">
                    {["0-1 Hari", "2-3 Hari", "4-7 Hari", ">7 Hari"].map((label, idx) => (
                      <div key={label} className="flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-600">{label}</span>
                        <span className="font-bold text-gray-900 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                          {idx === 0 ? summaryData.exceptions.open : 0} {/* Simplified for UI, real logic needs date diff */}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function UserIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
