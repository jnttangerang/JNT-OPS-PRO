import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar, CheckCircle2, AlertTriangle, AlertCircle, Lock, Loader2, Store,
  RefreshCw, ShieldAlert, DollarSign, Users, FileCheck, ArrowUpRight,
  History, RotateCcw, X, Info, FileText, Check, AlertOctagon, CornerUpLeft,
  ChevronDown, ChevronUp, Eye, Clock, ShieldCheck, Filter
} from "lucide-react";
import { toast } from "../../utils/toast";
import { getTodayWIB, calculateSettlementAging } from "../../utils/dateUtils";

export interface OwnerDailyClosingDashboardProps {
  session: {
    user_id?: string;
    username?: string;
    nama_lengkap?: string;
    role: string;
    outlet_id_home?: string;
  };
  outlets: Array<{ outlet_id: string; nama_outlet: string }>;
  activeOutletId?: string;
  onChangeActiveOutlet?: (outletId: string) => void;
}

export default function OwnerDailyClosingDashboard({
  session,
  outlets,
  activeOutletId,
  onChangeActiveOutlet
}: OwnerDailyClosingDashboardProps) {
  const [closingDate, setClosingDate] = useState<string>(() => getTodayWIB());
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState<boolean>(false);
  const [validatingOutlet, setValidatingOutlet] = useState<string | null>(null);

  // Data States
  const [summaryData, setSummaryData] = useState<any>(null);
  const [outletClosingRecords, setOutletClosingRecords] = useState<Record<string, any>>({});
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [expandedOutlets, setExpandedOutlets] = useState<Record<string, boolean>>({});

  // Modals
  const [showReopenModal, setShowReopenModal] = useState<boolean>(false);
  const [reopenTargetOutlet, setReopenTargetOutlet] = useState<{ id: string; name: string } | null>(null);
  const [reopenReason, setReopenReason] = useState<string>("");
  const [submittingReopen, setSubmittingReopen] = useState<boolean>(false);

  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);
  const [closeTargetOutlet, setCloseTargetOutlet] = useState<{ id: string; name: string } | null>(null);
  const [closeNotes, setCloseNotes] = useState<string>("");
  const [submittingClose, setSubmittingClose] = useState<boolean>(false);

  const [selectedException, setSelectedException] = useState<any | null>(null);
  const [resolutionType, setResolutionType] = useState<string>("RESOLVED");
  const [resolutionNotes, setResolutionNotes] = useState<string>("");
  const [submittingResolution, setSubmittingResolution] = useState<boolean>(false);

  const [selectedAdminTransactions, setSelectedAdminTransactions] = useState<any | null>(null);

  const getActorInfo = useCallback(() => ({
    actor_id: session?.user_id || session?.username || "OWNER-01",
    actor_name: session?.nama_lengkap || session?.username || "Owner",
    actor_role: session?.role || "OWNER"
  }), [session]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Consolidated Owner Summary (All Outlets by default)
      const summaryRes = await fetch("/api/getOwnerClosingSummary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date_start: closingDate,
          date_end: closingDate,
          status: statusFilter !== "ALL" ? statusFilter : undefined
        })
      });

      if (summaryRes.ok) {
        const summaryJson = await summaryRes.json();
        setSummaryData(summaryJson.data || null);
      }

      // 2. Fetch closing status for each outlet
      const closingStatusMap: Record<string, any> = {};
      await Promise.all(
        outlets.map(async (o) => {
          try {
            const res = await fetch(`/api/dailyClosing/status?outlet_id=${encodeURIComponent(o.outlet_id)}&tanggal=${closingDate}`);
            if (res.ok) {
              const json = await res.json();
              const record = json.data || json;
              closingStatusMap[o.outlet_id] = {
                ...record,
                late_info: json.late_info ?? null,
              };
            }
          } catch {
            // ignore individual outlet fetch errors
          }
        })
      );
      setOutletClosingRecords(closingStatusMap);

      // 3. Fetch Global Exceptions across all outlets for this date
      try {
        const exRes = await fetch(`/api/reconciliation/exceptions?tanggal=${closingDate}`);
        if (exRes.ok) {
          const exJson = await exRes.json();
          setExceptions(exJson.data || []);
        }
      } catch {
        // ignore exception fetch errors
      }

      // 4. Fetch Audit Logs
      try {
        const logsRes = await fetch(`/api/reconciliation/logs?tanggal=${closingDate}`);
        if (logsRes.ok) {
          const logsJson = await logsRes.json();
          setAuditLogs(logsJson.data || []);
        }
      } catch {
        // ignore log fetch failure
      }
    } catch (err) {
      console.error("Error fetching owner closing dashboard data:", err);
      toast.error("Gagal memuat ringkasan portfolio harian.");
    } finally {
      setLoading(false);
    }
  }, [closingDate, statusFilter, outlets]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Expand all outlets by default when data loads
  useEffect(() => {
    if (outlets.length > 0 && Object.keys(expandedOutlets).length === 0) {
      const initialExpanded: Record<string, boolean> = {};
      outlets.forEach((o) => {
        initialExpanded[o.outlet_id] = true;
      });
      setExpandedOutlets(initialExpanded);
    }
  }, [outlets]);

  const toggleOutletExpand = (outletId: string) => {
    setExpandedOutlets((prev) => ({
      ...prev,
      [outletId]: !prev[outletId]
    }));
  };

  // Group summary rows by outlet
  const rows: any[] = summaryData?.rows || [];
  const outletGroups: Record<string, { outlet_id: string; outlet_name: string; admins: any[]; total_expected: number; total_actual: number; total_variance: number }> = {};

  outlets.forEach((o) => {
    outletGroups[o.outlet_id] = {
      outlet_id: o.outlet_id,
      outlet_name: o.nama_outlet,
      admins: [],
      total_expected: 0,
      total_actual: 0,
      total_variance: 0
    };
  });

  rows.forEach((r) => {
    const oId = r.outlet_id;
    if (!outletGroups[oId]) {
      outletGroups[oId] = {
        outlet_id: oId,
        outlet_name: r.outlet_name || oId,
        admins: [],
        total_expected: 0,
        total_actual: 0,
        total_variance: 0
      };
    }
    outletGroups[oId].admins.push(r);
    outletGroups[oId].total_expected += Number(r.expected_cash || 0);
    outletGroups[oId].total_actual += Number(r.actual_cash || 0);
    outletGroups[oId].total_variance += Number(r.variance || 0);
  });

  // Action Center calculation (items requiring attention)
  const actionItems: Array<{
    type: "UNSUBMITTED" | "LATE" | "VARIANCE" | "BLOCKED_BOOK";
    title: string;
    outlet_id: string;
    outlet_name: string;
    admin_name?: string;
    nominal?: number;
    description: string;
    aging_label?: string;
  }> = [];

  rows.forEach((r) => {
    const isSubmitted = r.setoran_status !== "BELUM_SUBMIT";
    const ag = r.aging || calculateSettlementAging(r.tanggal, r.created_at, isSubmitted);
    
    if (!isSubmitted && Number(r.expected_cash) > 0) {
      actionItems.push({
        type: "UNSUBMITTED",
        title: "Setoran Kas Belum Dibuat",
        outlet_id: r.outlet_id,
        outlet_name: r.outlet_name,
        admin_name: r.admin_nama,
        nominal: Number(r.expected_cash),
        description: `Admin ${r.admin_nama} belum menyerahkan setoran kas wajib Rp ${Number(r.expected_cash).toLocaleString("id-ID")}.`,
        aging_label: ag.status_label
      });
    } else if (ag.is_late) {
      actionItems.push({
        type: "LATE",
        title: "Setoran Melewati Jatuh Tempo",
        outlet_id: r.outlet_id,
        outlet_name: r.outlet_name,
        admin_name: r.admin_nama,
        nominal: Number(r.expected_cash),
        description: `Setoran terlambat ${ag.late_days} hari dari tanggal operasional.`,
        aging_label: ag.status_label
      });
    }

    if (r.variance_status === "SHORT" || r.variance_status === "OVER") {
      actionItems.push({
        type: "VARIANCE",
        title: `Selisih Setoran (${r.variance_status})`,
        outlet_id: r.outlet_id,
        outlet_name: r.outlet_name,
        admin_name: r.admin_nama,
        nominal: Number(r.variance),
        description: `Terdapat selisih kas Rp ${Math.abs(Number(r.variance)).toLocaleString("id-ID")} antara wajib setor dan realisasi disetor.`,
        aging_label: ag.status_label
      });
    }
  });

  // Action: Validate Outlet Closing
  const handleValidateOutlet = async (outletId: string, outletName: string) => {
    setValidatingOutlet(outletId);
    try {
      const res = await fetch("/api/dailyClosing/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: outletId,
          outlet_name: outletName,
          tanggal: closingDate,
          ...getActorInfo()
        })
      });

      const json = await res.json();
      if (res.ok && (json.status === "success" || json.status === "blocked")) {
        setOutletClosingRecords((prev) => {
          const record = json.data || json;
          return {
            ...prev,
            [outletId]: {
              ...record,
              late_info: json.late_info ?? null,
            }
          };
        });
        if (json.status === "success") {
          toast.success(json.message || `Status outlet '${outletName}' SIAP TUTUP BUKU.`);
        } else {
          toast.error(json.message || `Outlet '${outletName}' terkendala tutup buku.`);
        }
      } else {
        toast.error(json.message || "Gagal memvalidasi outlet.");
      }
      await fetchData();
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan koneksi saat validasi.");
    } finally {
      setValidatingOutlet(null);
    }
  };

  // Action: Open Close Modal
  const handleOpenCloseModal = (outletId: string, outletName: string) => {
    setCloseTargetOutlet({ id: outletId, name: outletName });
    setCloseNotes("");
    setShowCloseModal(true);
  };

  // Action: Execute Close
  const handleExecuteClose = async () => {
    if (!closeTargetOutlet) return;
    setSubmittingClose(true);
    try {
      const res = await fetch("/api/dailyClosing/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: closeTargetOutlet.id,
          outlet_name: closeTargetOutlet.name,
          tanggal: closingDate,
          notes: closeNotes,
          ...getActorInfo()
        })
      });

      const json = await res.json();
      if (res.ok && json.status === "success") {
        toast.success(json.message || `Tutup buku berhasil untuk outlet '${closeTargetOutlet.name}'.`);
        setShowCloseModal(false);
        setCloseNotes("");
        await fetchData();
      } else {
        toast.error(json.message || "Gagal menyelesaikan tutup buku.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan sistem saat tutup buku.");
    } finally {
      setSubmittingClose(false);
    }
  };

  // Action: Open Reopen Modal
  const handleOpenReopenModal = (outletId: string, outletName: string) => {
    setReopenTargetOutlet({ id: outletId, name: outletName });
    setReopenReason("");
    setShowReopenModal(true);
  };

  // Action: Execute Reopen
  const handleExecuteReopen = async () => {
    if (!reopenTargetOutlet) return;
    if (!reopenReason.trim()) {
      toast.error("Alasan pembukaan kembali buku (reason) wajib diisi.");
      return;
    }

    setSubmittingReopen(true);
    try {
      const res = await fetch("/api/dailyClosing/reopen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: reopenTargetOutlet.id,
          outlet_name: reopenTargetOutlet.name,
          tanggal: closingDate,
          reason: reopenReason.trim(),
          ...getActorInfo()
        })
      });

      const json = await res.json();
      if (res.ok && json.status === "success") {
        toast.success(json.message || `Buku harian outlet '${reopenTargetOutlet.name}' berhasil dibuka kembali (REOPENED).`);
        setShowReopenModal(false);
        setReopenReason("");
        await fetchData();
      } else {
        toast.error(json.message || "Gagal membuka kembali buku.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan koneksi saat reopen buku.");
    } finally {
      setSubmittingReopen(false);
    }
  };

  // Action: Submit Exception Resolution
  const handleResolveSubmit = async () => {
    if (!selectedException) return;
    if (!resolutionNotes.trim()) {
      toast.error("Alasan penyelesaian kendala wajib diisi.");
      return;
    }

    setSubmittingResolution(true);
    try {
      const res = await fetch("/api/reconciliation/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exception_id: selectedException.exception_id || selectedException.id,
          resolution: resolutionType,
          resolution_reason: resolutionNotes.trim(),
          ...getActorInfo()
        })
      });

      const json = await res.json();
      if (res.ok && json.status === "success") {
        toast.success("Kendala operasional berhasil diselesaikan.");
        setSelectedException(null);
        setResolutionNotes("");
        await fetchData();
      } else {
        toast.error(json.message || "Gagal menyelesaikan kendala.");
      }
    } catch (e: any) {
      toast.error("Gagal mengirim penyelesaian kendala.");
    } finally {
      setSubmittingResolution(false);
    }
  };

  const getAgingBadge = (ag: any) => {
    if (!ag) return null;
    let badgeClass = "bg-gray-100 text-gray-700 border-gray-200";
    if (ag.badge_variant === "success") {
      badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
    } else if (ag.badge_variant === "warning") {
      badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
    } else if (ag.badge_variant === "danger") {
      badgeClass = "bg-red-50 text-red-700 border-red-200";
    }

    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-black border uppercase tracking-wider ${badgeClass}`}>
        {ag.status_label || (ag.is_late ? `Terlambat ${ag.late_days} Hari` : "Tepat Waktu")}
      </span>
    );
  };

  const totalExpectedAll = Number(summaryData?.total_expected_cash || 0);
  const totalActualAll = Number(summaryData?.total_actual_cash || 0);
  const totalOutstandingAll = Math.max(0, totalExpectedAll - totalActualAll);
  const matchedCount = Number(summaryData?.count_matched || 0);
  const pendingCount = Number(summaryData?.count_belum_submit || 0) + Number(summaryData?.count_submitted || 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 font-sans text-gray-800 bg-gray-50/50 min-h-screen">
      {/* 1. OWNER HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-150">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-700 border border-indigo-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              DAILY CLOSING & SETTLEMENT MONITORING
            </h1>
          </div>
          <p className="text-xs text-gray-500 font-semibold">
            Monitoring konsolidasi kas dan kepatuhan setoran seluruh outlet ({outlets.length} Cabang Terdaftar).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700">
            <Filter className="w-3.5 h-3.5 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-gray-800 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="BELUM_SUBMIT">Belum Setor</option>
              <option value="MENUNGGU_APPROVAL">Menunggu Persetujuan</option>
              <option value="DISETUJUI">Disetujui</option>
              <option value="SHORT">Selisih Kurang (Short)</option>
              <option value="OVER">Selisih Lebih (Over)</option>
            </select>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 shadow-inner">
            <Calendar className="w-4 h-4 text-gray-500" />
            <input
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-gray-800 focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            Segarkan
          </button>
        </div>
      </div>

      {/* 2. SECTION 1 — PORTFOLIO SUMMARY (4 STAT CARDS) */}
      <div className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
          <Store className="w-4 h-4 text-indigo-600" />
          <span>RINGKASAN PORTFOLIO KONSOLIDASI (SEMUA OUTLET)</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-1">
            <span className="text-xs font-bold text-gray-500">TOTAL WAJIB SETOR</span>
            <div className="text-2xl font-black text-gray-900">
              Rp {totalExpectedAll.toLocaleString("id-ID")}
            </div>
            <p className="text-[10px] text-gray-400 font-medium">
              Akumulasi kas fisik seluruh admin & outlet
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-1">
            <span className="text-xs font-bold text-gray-500">TOTAL REALISASI DISETOR</span>
            <div className="text-2xl font-black text-emerald-600">
              Rp {totalActualAll.toLocaleString("id-ID")}
            </div>
            <p className="text-[10px] text-emerald-700 font-medium">
              Uang kas yang sudah dilaporkan/masuk
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-1">
            <span className="text-xs font-bold text-gray-500">OUTSTANDING (BELUM DISETOR)</span>
            <div className={`text-2xl font-black ${totalOutstandingAll === 0 ? "text-gray-700" : "text-amber-600"}`}>
              Rp {totalOutstandingAll.toLocaleString("id-ID")}
            </div>
            <p className="text-[10px] text-amber-700 font-medium">
              Sisa kewajiban admin yang belum disetor
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-1">
            <span className="text-xs font-bold text-gray-500">STATUS KELENGKAPAN SETORAN</span>
            <div className="text-lg font-black text-gray-800 pt-1">
              <span className="text-emerald-600">{matchedCount} Selesai</span>
              <span className="text-gray-400 mx-1.5">•</span>
              <span className="text-amber-600">{pendingCount} Menunggu</span>
            </div>
            <p className="text-[10px] text-gray-400 font-medium">
              {rows.length} entri admin terdeteksi hari ini
            </p>
          </div>
        </div>
      </div>

      {/* 3. SECTION 2 — ACTION CENTER (ITEMS REQUIRING ATTENTION) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-150 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-50 rounded-lg text-amber-700 border border-amber-200">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h2 className="text-base font-black text-gray-900 tracking-tight">
              MEMERLUKAN TINDAKAN & PERHATIAN OWNER
            </h2>
          </div>
          <span className="text-xs font-extrabold px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-200">
            {actionItems.length} Perlu Ditindaklanjuti
          </span>
        </div>

        {actionItems.length === 0 ? (
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-black">Semua Outlet & Setoran Berjalan Tertib</p>
              <p className="text-[11px] text-emerald-700 font-medium">
                Tidak ada setoran yang belum dibuat, tidak ada selisih, dan seluruh setoran tepat waktu untuk tanggal ini.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {actionItems.map((item, idx) => (
              <div
                key={idx}
                className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs font-black text-gray-900 uppercase">
                      {item.outlet_name}
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 uppercase">
                      {item.type}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-amber-950 mt-1">
                    {item.admin_name ? `Admin: ${item.admin_name}` : item.title}
                  </p>

                  <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-gray-500 font-medium">{item.aging_label || "Jatuh Tempo H+1"}</span>
                  <button
                    onClick={() => {
                      // auto expand the target outlet
                      setExpandedOutlets((prev) => ({ ...prev, [item.outlet_id]: true }));
                      toast.info(`Melihat rincian outlet ${item.outlet_name}`);
                    }}
                    className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span>Tinjau Outlet</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. SECTION 3 — SETTLEMENT BY OUTLET (MULTI-OUTLET ACCORDION / DRILL-DOWN) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
              <span>SETTLEMENT KAS PER OUTLET & ADMIN</span>
              <span className="text-xs font-extrabold px-2.5 py-0.5 bg-gray-200 text-gray-800 rounded-full">
                {Object.keys(outletGroups).length} Outlet
              </span>
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Rincian kewajiban kas fisik dan drill-down admin per cabang untuk tanggal {closingDate}.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {Object.values(outletGroups).map((group) => {
            const isExpanded = expandedOutlets[group.outlet_id] ?? true;
            const closingRec = outletClosingRecords[group.outlet_id];
            const bookStatus = closingRec?.status || "OPEN";
            const variance = group.total_variance;

            return (
              <div
                key={group.outlet_id}
                className="bg-white rounded-2xl shadow-sm border border-gray-150 overflow-hidden transition-all"
              >
                {/* Outlet Header Summary Bar */}
                <div
                  onClick={() => toggleOutletExpand(group.outlet_id)}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-gray-50/80 transition-colors select-none border-b border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gray-100 text-gray-700 rounded-xl">
                      <Store className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-gray-900 uppercase">
                          {group.outlet_name}
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-500 rounded border border-gray-200">
                          {group.outlet_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 font-medium">Status Buku:</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                            bookStatus === "CLOSED"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : bookStatus === "READY"
                              ? "bg-blue-100 text-blue-800 border-blue-300"
                              : bookStatus === "BLOCKED"
                              ? "bg-red-100 text-red-800 border-red-300"
                              : "bg-amber-100 text-amber-800 border-amber-300"
                          }`}
                        >
                          {bookStatus === "CLOSED" ? "SUDAH DITUTUP" : bookStatus === "READY" ? "SIAP TUTUP" : bookStatus === "BLOCKED" ? "TERKENDALA" : bookStatus}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Outlet Aggregate Financial Metrics */}
                  <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block">WAJIB SETOR</span>
                      <span className="font-black text-gray-900 text-sm">
                        Rp {group.total_expected.toLocaleString("id-ID")}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block">REALISASI SETOR</span>
                      <span className="font-black text-emerald-600 text-sm">
                        Rp {group.total_actual.toLocaleString("id-ID")}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block">SELISIH</span>
                      <span className={`font-black text-sm ${variance === 0 ? "text-emerald-600" : "text-red-600"}`}>
                        Rp {variance.toLocaleString("id-ID")}
                      </span>
                    </div>

                    <div className="p-1.5 rounded-lg bg-gray-100 text-gray-500">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Drill-down: Admin List inside Outlet */}
                {isExpanded && (
                  <div className="p-5 bg-gray-50/50 space-y-4">
                    {group.admins.length === 0 ? (
                      <div className="p-4 bg-white rounded-xl border border-gray-200 text-center text-gray-400 text-xs font-semibold">
                        Tidak ada transaksi atau setoran admin tercatat di outlet ini pada tanggal {closingDate}.
                      </div>
                    ) : (
                      <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-100/75 border-b border-gray-200 text-gray-600 font-black uppercase text-[10px]">
                              <th className="p-3">Admin</th>
                              <th className="p-3 text-center">Resi Tunai</th>
                              <th className="p-3 text-right">Wajib Setor Kas</th>
                              <th className="p-3 text-right">Disetor</th>
                              <th className="p-3 text-right">Selisih</th>
                              <th className="p-3 text-center">Aging</th>
                              <th className="p-3 text-center">Status Setoran</th>
                              <th className="p-3 text-center">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 font-sans">
                            {group.admins.map((adm, aIdx) => {
                              const req = Number(adm.expected_cash || 0);
                              const act = Number(adm.actual_cash || 0);
                              const v = Number(adm.variance || 0);
                              const isSub = adm.setoran_status !== "BELUM_SUBMIT";
                              const ag = adm.aging || calculateSettlementAging(adm.tanggal, adm.created_at, isSub);
                              const isMatched = adm.variance_status === "MATCH" && isSub;

                              return (
                                <tr key={aIdx} className="hover:bg-gray-50/80 transition-colors">
                                  <td className="p-3">
                                    <div className="font-black text-gray-900">{adm.admin_nama}</div>
                                    <div className="text-[10px] text-gray-400 font-mono">{adm.admin_id}</div>
                                  </td>
                                  <td className="p-3 text-center font-bold text-gray-700">
                                    {adm.jumlah_resi || 0}
                                  </td>
                                  <td className="p-3 text-right font-black text-gray-900">
                                    Rp {req.toLocaleString("id-ID")}
                                  </td>
                                  <td className="p-3 text-right font-bold text-emerald-600">
                                    Rp {act.toLocaleString("id-ID")}
                                  </td>
                                  <td className="p-3 text-right font-bold">
                                    <span className={v === 0 ? "text-emerald-600" : "text-red-600"}>
                                      Rp {v.toLocaleString("id-ID")}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center">
                                    {getAgingBadge(ag)}
                                  </td>
                                  <td className="p-3 text-center">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                                        isMatched
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                          : adm.setoran_status === "MENUNGGU_APPROVAL"
                                          ? "bg-amber-50 text-amber-700 border-amber-200"
                                          : "bg-red-50 text-red-700 border-red-200"
                                      }`}
                                    >
                                      {isMatched ? "SESUAI" : adm.setoran_status === "BELUM_SUBMIT" ? "BELUM SETOR" : adm.setoran_status}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center">
                                    <button
                                      onClick={() => setSelectedAdminTransactions(adm)}
                                      className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                                    >
                                      <Eye className="w-3 h-3 text-gray-500" />
                                      <span>Rincian</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. SECTION 4 — KENDALA OPERASIONAL & REKONSILIASI (GLOBAL EXCEPTIONS) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-150 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-red-50 rounded-lg text-red-700 border border-red-200">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <h2 className="text-base font-black text-gray-900 tracking-tight">
              KENDALA OPERASIONAL & REKONSILIASI (EXCEPTIONS)
            </h2>
          </div>
          <span className="text-xs font-bold text-gray-500">
            {exceptions.length} Kendala Terdeteksi
          </span>
        </div>

        {exceptions.length === 0 ? (
          <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-200 text-center text-emerald-800 space-y-1">
            <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-600" />
            <p className="text-xs font-black">Tidak Ada Kendala Operasional</p>
            <p className="text-[11px] text-emerald-700">
              Seluruh transaksi tercatat bersih dan tidak ada selisih tanpa verifikasi.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 font-black uppercase text-[10px]">
                  <th className="p-3">Outlet</th>
                  <th className="p-3">Tipe Kendala</th>
                  <th className="p-3">Tingkat</th>
                  <th className="p-3">Deskripsi</th>
                  <th className="p-3 text-right">Dampak Finansial</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Wewenang / Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-sans">
                {exceptions.map((ex, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{ex.outlet_id}</td>
                    <td className="p-3 font-bold text-gray-800">{ex.exception_type}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        ex.severity === "CRITICAL" ? "bg-red-100 text-red-800 border border-red-300" :
                        ex.severity === "ERROR" ? "bg-amber-100 text-amber-800 border border-amber-300" :
                        "bg-blue-100 text-blue-800 border border-blue-300"
                      }`}>
                        {ex.severity}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600 max-w-xs truncate">{ex.message}</td>
                    <td className="p-3 text-right font-black text-red-600">
                      Rp {Number(ex.amount || 0).toLocaleString("id-ID")}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] font-bold">
                        {ex.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {ex.status !== "RESOLVED" && ex.status !== "IGNORED" ? (
                        <button
                          onClick={() => {
                            setSelectedException(ex);
                            setResolutionNotes("");
                          }}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black transition-colors cursor-pointer"
                        >
                          Selesaikan Kendala
                        </button>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-bold">✓ Selesai</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. SECTION 5 — DAILY CLOSING STATUS & CONTROL (TUTUP BUKU PER OUTLET) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-150 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 rounded-lg text-blue-700 border border-blue-200">
              <Lock className="w-4 h-4" />
            </div>
            <h2 className="text-base font-black text-gray-900 tracking-tight">
              STATUS TUTUP BUKU & KONTROL OTORISASI PER OUTLET
            </h2>
          </div>
          <span className="text-xs text-gray-500 font-medium">
            Tanggal: <strong className="text-gray-900">{closingDate}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {outlets.map((o) => {
            const closingRec = outletClosingRecords[o.outlet_id];
            const bookStatus = closingRec?.status || "OPEN";
            const isValidating = validatingOutlet === o.outlet_id;

            return (
              <div
                key={o.outlet_id}
                className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-black text-gray-900 uppercase">{o.nama_outlet}</h4>
                      <span className="text-[10px] text-gray-400 font-bold">{o.outlet_id}</span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                        bookStatus === "CLOSED"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : bookStatus === "READY"
                          ? "bg-blue-100 text-blue-800 border-blue-300"
                          : bookStatus === "BLOCKED"
                          ? "bg-red-100 text-red-800 border-red-300"
                          : "bg-amber-100 text-amber-800 border-amber-300"
                      }`}
                    >
                      {bookStatus === "CLOSED" ? "SUDAH DITUTUP" : bookStatus === "READY" ? "SIAP TUTUP" : bookStatus === "BLOCKED" ? "TERKENDALA" : bookStatus}
                    </span>
                  </div>

                  <div className="mt-3 text-xs text-gray-600 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Transaksi:</span>
                      <span className="font-bold text-gray-800">{closingRec?.transaction_count || 0} resi</span>
                    </div>
                    {closingRec?.closed_by && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Ditutup Oleh:</span>
                        <span className="font-bold text-gray-800">{closingRec.closed_by}</span>
                      </div>
                    )}
                  </div>
                  
                  {bookStatus === "CLOSED" && closingRec?.late_info?.has_late_transactions === true && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mt-3">
                      <div className="flex items-start gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[11px] font-bold text-amber-900 block leading-tight">
                            ⚠ Ada Transaksi Setelah Tutup Buku
                          </span>
                          <span className="text-[10px] text-amber-700">
                            {closingRec.late_info.late_transaction_count} transaksi terlambat
                          </span>
                        </div>
                      </div>
                      <div className="text-[10px] text-amber-800 space-y-0.5 mb-2 pl-6">
                        <div className="flex justify-between">
                          <span>Setoran Owner:</span>
                          <span className="font-bold">Rp {Number(closingRec.late_info.late_owner_deposit).toLocaleString("id-ID")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Kas Outlet:</span>
                          <span className="font-bold">Rp {Number(closingRec.late_info.late_cash_payment).toLocaleString("id-ID")}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleOpenReopenModal(o.outlet_id, o.nama_outlet)}
                        className="w-full py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-bold rounded-lg border border-amber-300 transition-colors cursor-pointer"
                      >
                        Reopen untuk Rekonsiliasi
                      </button>
                    </div>
                  )}
                </div>

                {/* Control Action Buttons */}
                <div className="pt-3 border-t border-gray-200/80 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleValidateOutlet(o.outlet_id, o.nama_outlet)}
                    disabled={isValidating || loading}
                    className="px-2.5 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Validasi"}
                  </button>

                  {bookStatus === "CLOSED" ? (
                    <button
                      onClick={() => handleOpenReopenModal(o.outlet_id, o.nama_outlet)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Buka Kembali
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenCloseModal(o.outlet_id, o.nama_outlet)}
                      disabled={bookStatus === "BLOCKED"}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black transition-all disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5 inline mr-1" />
                      Tutup Buku
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 7. SECTION 6 — AUDIT LOGS */}
      {auditLogs.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-150 p-6 space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <History className="w-4 h-4 text-gray-500" />
            <h2 className="text-xs font-black text-gray-700 uppercase tracking-wider">
              RIWAYAT AKTIVITAS SISTEM (AUDIT TRAIL)
            </h2>
          </div>

          <div className="space-y-2">
            {auditLogs.slice(0, 5).map((log, idx) => (
              <div key={idx} className="p-2.5 bg-gray-50 rounded-xl text-xs flex justify-between items-center text-gray-700">
                <div className="space-y-0.5">
                  <span className="font-bold text-gray-900 mr-2">{log.action || log.event_type}</span>
                  <span className="text-gray-500 font-mono text-[11px]">{log.actor_name || log.actor_id}</span>
                </div>
                <span className="text-[10px] text-gray-400 font-mono">{log.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: REOPEN CLOSING */}
      {showReopenModal && reopenTargetOutlet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-100 rounded-lg text-amber-700">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-gray-800 text-sm">Buka Kembali Buku Harian</h3>
              </div>
              <button
                onClick={() => setShowReopenModal(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium text-amber-700">Outlet:</span>
                  <span className="font-bold">{reopenTargetOutlet.name} ({reopenTargetOutlet.id})</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-amber-700">Tanggal:</span>
                  <span className="font-bold">{closingDate}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Alasan Pembukaan Kembali (Wajib Diisi)
                </label>
                <textarea
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  rows={3}
                  placeholder="Misal: Perlu input koreksi transaksi resi atau rekonsiliasi manual..."
                  className="w-full border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-gray-50"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
              <button
                onClick={() => setShowReopenModal(false)}
                disabled={submittingReopen}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteReopen}
                disabled={submittingReopen}
                className="px-4 py-2 text-xs font-black bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm shadow-amber-600/20"
              >
                {submittingReopen ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Konfirmasi Reopen Buku
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CLOSE CONFIRMATION */}
      {showCloseModal && closeTargetOutlet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-lg text-blue-700">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-gray-800 text-sm">Tutup Buku Outlet (Owner)</h3>
              </div>
              <button
                onClick={() => setShowCloseModal(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-600 leading-relaxed">
                Anda akan menutup operasional outlet <strong className="text-gray-900">{closeTargetOutlet.name}</strong> untuk tanggal <strong className="text-gray-900">{closingDate}</strong>.
              </p>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Catatan Penutupan (Opsional)
                </label>
                <textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  rows={3}
                  placeholder="Catatan penutupan operasional..."
                  className="w-full border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
              <button
                onClick={() => setShowCloseModal(false)}
                disabled={submittingClose}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteClose}
                disabled={submittingClose}
                className="px-4 py-2 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm shadow-blue-600/20"
              >
                {submittingClose ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                Selesaikan Tutup Buku
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXCEPTION RESOLUTION */}
      {selectedException && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-red-100 rounded-lg text-red-700">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-gray-800 text-sm">Penyelesaian Kendala Operasional</h3>
              </div>
              <button
                onClick={() => setSelectedException(null)}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-950 space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium text-red-700">Tipe:</span>
                  <span className="font-bold">{selectedException.exception_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-red-700">Dampak Finansial:</span>
                  <span className="font-bold">Rp {Number(selectedException.amount || 0).toLocaleString("id-ID")}</span>
                </div>
                <p className="text-[11px] text-red-800 pt-1 border-t border-red-200/60 mt-1">
                  {selectedException.message}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Metode Penyelesaian
                </label>
                <select
                  value={resolutionType}
                  onChange={(e) => setResolutionType(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="RESOLVED">Selesaikan (RESOLVED - Sudah Ditangani)</option>
                  <option value="APPROVED_FORCE_CLOSE">Otorisasi Khusus (APPROVED FORCE CLOSE)</option>
                  <option value="IGNORED">Abaikan Kendala (IGNORED - Non-blocking)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Alasan & Catatan Penyelesaian (Wajib)
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={3}
                  placeholder="Jelaskan dasar pertimbangan penyelesaian kendala ini..."
                  className="w-full border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-gray-50"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
              <button
                onClick={() => setSelectedException(null)}
                disabled={submittingResolution}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleResolveSubmit}
                disabled={submittingResolution}
                className="px-4 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-600/20"
              >
                {submittingResolution ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Terapkan Penyelesaian
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADMIN TRANSACTION DETAILS */}
      {selectedAdminTransactions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-gray-100">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gray-100 rounded-lg text-gray-700">
                  <Users className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">
                    Rincian Transaksi: {selectedAdminTransactions.admin_nama}
                  </h3>
                  <p className="text-[10px] text-gray-500">
                    Outlet: {selectedAdminTransactions.outlet_name} ({selectedAdminTransactions.outlet_id}) • Tanggal: {selectedAdminTransactions.tanggal}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAdminTransactions(null)}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 max-h-96 overflow-y-auto space-y-3">
              {(!selectedAdminTransactions.transactions || selectedAdminTransactions.transactions.length === 0) ? (
                <p className="text-center text-xs text-gray-400 py-6">
                  Tidak ada rincian transaksi individu yang tersimpan.
                </p>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-600 font-black uppercase text-[10px]">
                        <th className="p-2.5">No Resi</th>
                        <th className="p-2.5">Metode Bayar</th>
                        <th className="p-2.5 text-right">Bayar Customer</th>
                        <th className="p-2.5 text-right">Wajib Setor Owner</th>
                        <th className="p-2.5 text-right">Kas Outlet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedAdminTransactions.transactions.map((tx: any, tIdx: number) => (
                        <tr key={tIdx} className="hover:bg-gray-50">
                          <td className="p-2.5 font-mono font-bold text-gray-900">{tx.resi_id}</td>
                          <td className="p-2.5 font-semibold text-gray-700">{tx.metode_bayar}</td>
                          <td className="p-2.5 text-right font-bold text-gray-900">
                            Rp {Number(tx.customer_payment || 0).toLocaleString("id-ID")}
                          </td>
                          <td className="p-2.5 text-right font-bold text-indigo-600">
                            Rp {Number(tx.wajib_setor_owner || 0).toLocaleString("id-ID")}
                          </td>
                          <td className="p-2.5 text-right font-bold text-emerald-600">
                            Rp {Number(tx.kas_outlet || 0).toLocaleString("id-ID")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50">
              <button
                onClick={() => setSelectedAdminTransactions(null)}
                className="px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
