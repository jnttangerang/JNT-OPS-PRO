import React, { useState, useEffect, useCallback } from "react";
import { 
  Calendar, CheckCircle2, AlertTriangle, AlertCircle, Lock, Loader2, Store, 
  RefreshCw, ShieldAlert, DollarSign, Users, FileCheck, ArrowUpRight, 
  History, RotateCcw, X, Info, FileText, Check, AlertOctagon, CornerUpLeft
} from "lucide-react";
import { toast } from "../../utils/toast";
import { useAppsScript } from "../../hooks/useAppsScript";

export interface DailyClosingPageProps {
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

export default function DailyClosingPage({
  session,
  outlets,
  activeOutletId,
  onChangeActiveOutlet
}: DailyClosingPageProps) {
  const { callBackend } = useAppsScript();
  
  // Default to activeOutletId or session's outlet or first outlet
  const defaultOutlet = activeOutletId || session?.outlet_id_home || outlets[0]?.outlet_id || "OUT-A";
  const [selectedOutlet, setSelectedOutlet] = useState<string>(defaultOutlet);
  const [closingDate, setClosingDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // Data States
  const [loading, setLoading] = useState<boolean>(false);
  const [validating, setValidating] = useState<boolean>(false);
  const [closingStatusData, setClosingStatusData] = useState<any>(null);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Modal States
  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);
  const [closeNotes, setCloseNotes] = useState<string>("");
  const [showReopenModal, setShowReopenModal] = useState<boolean>(false);
  const [reopenReason, setReopenReason] = useState<string>("");
  
  // Exception Resolution Modal State
  const [selectedException, setSelectedException] = useState<any | null>(null);
  const [resolutionType, setResolutionType] = useState<string>("RESOLVED");
  const [resolutionNotes, setResolutionNotes] = useState<string>("");

  // Sync with activeOutletId prop when changed externally
  useEffect(() => {
    if (activeOutletId && activeOutletId !== selectedOutlet) {
      setSelectedOutlet(activeOutletId);
    }
  }, [activeOutletId]);

  // Fetch status, exceptions, and audit logs on outlet or date change
  const fetchData = useCallback(async () => {
    if (!selectedOutlet || !closingDate) return;
    setLoading(true);

    try {
      // 1. Fetch Daily Closing Status
      const statusRes = await fetch(`/api/dailyClosing/status?outlet_id=${encodeURIComponent(selectedOutlet)}&tanggal=${encodeURIComponent(closingDate)}`);
      if (statusRes.ok) {
        const statusJson = await statusRes.json();
        setClosingStatusData(statusJson?.data || statusJson || null);
      } else {
        const errJson = await statusRes.json().catch(() => ({}));
        toast.error(errJson.message || "Gagal mengambil status daily closing.");
      }

      // 2. Fetch Reconciliation Exceptions for the selected outlet
      const excRes = await fetch("/api/reconciliation/exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outlet_id: selectedOutlet })
      });
      if (excRes.ok) {
        const excJson = await excRes.json();
        setExceptions(excJson?.data || []);
      }

      // 3. Fetch Audit Trail for Daily Closing events
      const auditRes = await fetch("/api/auditTrail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outlet_id: selectedOutlet, entity_type: "DAILY_CLOSING" })
      });
      if (auditRes.ok) {
        const auditJson = await auditRes.json();
        setAuditLogs(auditJson?.data || []);
      }
    } catch (err: any) {
      console.error("Error fetching daily closing data:", err);
      toast.error(err?.message || "Gagal memuat data daily closing.");
    } finally {
      setLoading(false);
    }
  }, [selectedOutlet, closingDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Outlet Change
  const handleOutletChange = (newOutletId: string) => {
    setSelectedOutlet(newOutletId);
    if (onChangeActiveOutlet) {
      onChangeActiveOutlet(newOutletId);
    }
  };

  // Actor payload helper
  const getActorInfo = () => ({
    actor_id: session?.user_id || session?.username || "USER-01",
    actor_name: session?.nama_lengkap || session?.username || "Operator",
    actor_role: session?.role || "ADMIN"
  });

  // Action: Create Setoran
  const handleCreateSetoran = async () => {
    if (!confirm("Buat Laporan Setoran sejumlah Wajib Setor saat ini?")) return;
    setLoading(true);
    try {
      const res = await callBackend("createSetoran", {
        outlet_id: selectedOutlet,
        tanggal: closingDate,
        admin_id: session?.user_id || session?.username || "SYSTEM"
      });
      if (res.status === "success") {
        toast.success(res.message || "Laporan setoran berhasil dibuat.");
        fetchData();
      } else {
        toast.error(res.message || "Gagal membuat laporan setoran.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Terjadi kesalahan sistem saat membuat laporan setoran.");
    } finally {
      setLoading(false);
    }
  };

  // Action: Validate Closing
  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await fetch("/api/dailyClosing/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: selectedOutlet,
          tanggal: closingDate,
          ...getActorInfo()
        })
      });

      const json = await res.json();
      if (res.ok && (json.status === "success" || json.status === "blocked")) {
        setClosingStatusData(json.data || json);
        if (json.status === "success") {
          toast.success(json.message || "Validasi daily closing berhasil. Status READY.");
        } else {
          toast.error(json.message || "Daily closing diblokir karena syarat validasi belum terpenuhi.");
        }
      } else {
        toast.error(json.message || "Gagal memvalidasi daily closing.");
      }
      await fetchData();
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan koneksi saat validasi.");
    } finally {
      setValidating(false);
    }
  };

  // Action: Close Daily Closing
  const handleExecuteClose = async () => {
    setValidating(true);
    try {
      const res = await fetch("/api/dailyClosing/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: selectedOutlet,
          tanggal: closingDate,
          notes: closeNotes,
          ...getActorInfo()
        })
      });

      const json = await res.json();
      if (res.ok && json.status === "success") {
        toast.success(json.message || "Daily closing berhasil diselesaikan! Status CLOSED.");
        setShowCloseModal(false);
        setCloseNotes("");
        await fetchData();
      } else {
        toast.error(json.message || "Gagal menyelesaikan daily closing.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan saat menutup daily closing.");
    } finally {
      setValidating(false);
    }
  };

  // Action: Reopen Daily Closing
  const handleReopen = async () => {
    if (!reopenReason.trim()) {
      toast.error("Alasan pembukaan kembali (reason) wajib diisi.");
      return;
    }

    setValidating(true);
    try {
      const res = await fetch("/api/dailyClosing/reopen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: selectedOutlet,
          tanggal: closingDate,
          reason: reopenReason.trim(),
          ...getActorInfo()
        })
      });

      const json = await res.json();
      if (res.ok && json.status === "success") {
        toast.success(json.message || "Daily closing berhasil dibuka kembali (REOPENED).");
        setShowReopenModal(false);
        setReopenReason("");
        await fetchData();
      } else {
        toast.error(json.message || "Gagal membuka kembali daily closing.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan saat reopen daily closing.");
    } finally {
      setValidating(false);
    }
  };

  // Action: Start Exception Review
  const handleStartReview = async (exceptionId: string) => {
    try {
      const res = await fetch("/api/reconciliation/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exception_id: exceptionId,
          ...getActorInfo()
        })
      });
      const json = await res.json();
      if (res.ok && json.status === "success") {
        toast.success("Review exception dimulai.");
        fetchData();
      } else {
        toast.error(json.message || "Gagal memulai review exception.");
      }
    } catch (e: any) {
      toast.error("Gagal memulai review exception.");
    }
  };

  // Action: Submit Resolution for Exception
  const handleResolveSubmit = async () => {
    if (!selectedException) return;
    if (!resolutionNotes.trim()) {
      toast.error("Alasan penyelesaian (resolution notes) wajib diisi.");
      return;
    }

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
        toast.success("Exception berhasil diselesaikan!");
        setSelectedException(null);
        setResolutionNotes("");
        fetchData();
      } else {
        toast.error(json.message || "Gagal menyelesaikan exception.");
      }
    } catch (e: any) {
      toast.error("Gagal mengirim penyelesaian exception.");
    }
  };

  // Status mapping helper
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "CLOSED":
        return <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-black rounded-full border border-emerald-300 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> CLOSED</span>;
      case "READY":
        return <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-black rounded-full border border-blue-300 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> READY</span>;
      case "BLOCKED":
        return <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-black rounded-full border border-red-300 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> BLOCKED</span>;
      case "REOPENED":
        return <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-black rounded-full border border-amber-300 flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" /> REOPENED</span>;
      case "VALIDATING":
        return <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-black rounded-full border border-purple-300 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> VALIDATING</span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-black rounded-full border border-gray-300 flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> OPEN</span>;
    }
  };

  const statusVal = closingStatusData?.status || "OPEN";
  const blockingReasons: string[] = closingStatusData?.blocking_reasons || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* HEADER & CONTEXT SELECTOR */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-150 p-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-red-50 text-[#E4002B] rounded-xl flex items-center justify-center font-bold shadow-sm">
            <Lock className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">Daily Closing</h1>
            <p className="text-xs text-gray-500 font-medium">Validasi & Penutupan Operasional Outlet Harian</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Outlet Selector */}
          <div className="relative flex-1 md:flex-none min-w-[160px]">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Outlet</label>
            <div className="relative">
              <Store className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                id="outlet-selector"
                value={selectedOutlet}
                onChange={(e) => handleOutletChange(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-[#E4002B]/20 focus:border-[#E4002B]"
              >
                {outlets.map((o) => (
                  <option key={o.outlet_id} value={o.outlet_id}>
                    {o.nama_outlet} ({o.outlet_id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Selector */}
          <div className="relative flex-1 md:flex-none min-w-[150px]">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tanggal</label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="closing-date-picker"
                type="date"
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-[#E4002B]/20 focus:border-[#E4002B]"
              />
            </div>
          </div>

          {/* Refresh Button */}
          <div className="flex items-end">
            <button
              id="refresh-closing-btn"
              onClick={fetchData}
              disabled={loading}
              className="mt-5 p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh Data"
              aria-label="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* STATUS CARD & ACTIONS */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-150 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 uppercase">Status Daily Closing:</span>
              {getStatusBadge(statusVal)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Outlet <strong className="text-gray-800">{selectedOutlet}</strong> • Tanggal <strong className="text-gray-800">{closingDate}</strong>
            </p>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex flex-wrap gap-2">
            <button
              id="btn-validate-closing"
              onClick={handleValidate}
              disabled={validating || statusVal === "CLOSED"}
              className="px-4 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-sm"
            >
              {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
              Validate Closing
            </button>

            {statusVal === "READY" && (
              <button
                id="btn-execute-closing"
                onClick={() => setShowCloseModal(true)}
                disabled={validating}
                className="px-4 py-2.5 bg-[#E4002B] hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-red-500/20"
              >
                <Lock className="w-4 h-4" />
                Close Daily Closing
              </button>
            )}

            {statusVal === "CLOSED" && (
              <button
                id="btn-reopen-closing"
                onClick={() => setShowReopenModal(true)}
                disabled={validating}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Reopen Closing
              </button>
            )}
          </div>
        </div>

        {/* BLOCKING REASONS ALERT */}
        {statusVal === "BLOCKED" && blockingReasons.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 space-y-2">
            <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wide">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              Proses Daily Closing Terblokir ({blockingReasons.length} Alasan):
            </div>
            <ul className="list-disc list-inside text-xs space-y-1 font-medium pl-1">
              {blockingReasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </div>
        )}

        {statusVal === "CLOSED" && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-800 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-bold">Periode harian telah resmi ditutup (CLOSED).</p>
              {closingStatusData?.closed_at && (
                <p className="text-[11px] text-emerald-600">
                  Ditutup oleh: <strong>{closingStatusData.closed_by || "Admin"}</strong> pada {new Date(closingStatusData.closed_at).toLocaleString("id-ID")}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3 CORE SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 1. FINANCIAL SUMMARY CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-150 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <DollarSign className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider">Financial Summary</h3>
            </div>
            <span className="text-[10px] bg-blue-50 text-blue-700 font-extrabold px-2 py-0.5 rounded">Financial Engine</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-gray-500 font-medium">Total Transaksi</span>
              <span className="font-extrabold text-gray-900">{closingStatusData?.transaction_count ?? 0}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-gray-500 font-medium">Transaksi Valid</span>
              <span className="font-extrabold text-emerald-600">{closingStatusData?.valid_financial_transaction_count ?? 0}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-gray-500 font-medium">Transaksi Dibatalkan</span>
              <span className="font-extrabold text-red-500">{closingStatusData?.cancelled_transaction_count ?? 0}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-gray-500 font-medium">Total Customer</span>
              <span className="font-extrabold text-gray-900">{closingStatusData?.total_customer ?? 0}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-gray-500 font-medium">Wajib Setor Owner</span>
              <span className="font-black text-blue-600">Rp {Number(closingStatusData?.setoran_required ?? closingStatusData?.total_owner_deposit ?? 0).toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-gray-500 font-medium">Kas Outlet</span>
              <span className="font-black text-purple-600">Rp {Number(closingStatusData?.total_outlet_cash ?? 0).toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-gray-500 font-medium">Pembulatan</span>
              <span className="font-extrabold text-gray-700">Rp {Number(closingStatusData?.total_rounding ?? 0).toLocaleString("id-ID")}</span>
            </div>
          </div>
        </div>

        {/* 2. SETORAN OWNER STATUS CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-150 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <FileCheck className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider">Status Setoran Owner</h3>
            </div>
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
              closingStatusData?.setoran_status === "MATCHED" 
                ? "bg-emerald-100 text-emerald-800" 
                : "bg-red-100 text-red-800"
            }`}>
              {closingStatusData?.setoran_status || "PENDING"}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-gray-500 font-medium">Wajib Setor</span>
              <span className="font-black text-gray-900">Rp {Number(closingStatusData?.setoran_required ?? 0).toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-gray-500 font-medium">Sudah Disetor (Actual)</span>
              <span className="font-black text-emerald-600">Rp {Number(closingStatusData?.setoran_actual ?? 0).toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-gray-500 font-medium">Selisih Setoran</span>
              <span className={`font-black ${
                (closingStatusData?.setoran_variance ?? 0) === 0 ? "text-emerald-600" : "text-red-600"
              }`}>
                Rp {Number(closingStatusData?.setoran_variance ?? 0).toLocaleString("id-ID")}
              </span>
            </div>
            <div className="pt-2">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-[11px] text-gray-600 mb-3">
                {closingStatusData?.setoran_status === "MATCHED" ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Setoran owner telah sesuai dengan perhitungan sistem.
                  </span>
                ) : (
                  <span className="text-red-700 font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" /> Setoran belum sesuai aturan atau masih terdapat selisih.
                  </span>
                )}
              </div>
              
              {closingStatusData?.setoran_status !== "MATCHED" && closingStatusData?.status !== "CLOSED" && session?.role === "ADMIN" && (
                <button
                  onClick={handleCreateSetoran}
                  disabled={loading || closingStatusData?.setoran_required <= 0}
                  className="w-full flex justify-center items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <DollarSign className="w-4 h-4" />
                  Buat Laporan Setoran
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 3. RECONCILIATION SUMMARY CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-150 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <AlertOctagon className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider">Reconciliation Summary</h3>
            </div>
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
              closingStatusData?.reconciliation_status === "MATCHED" 
                ? "bg-emerald-100 text-emerald-800" 
                : "bg-red-100 text-red-800"
            }`}>
              {closingStatusData?.reconciliation_status || "UNKNOWN"}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-gray-500 font-medium">Total Exceptions Open</span>
              <span className="font-extrabold text-gray-900">{closingStatusData?.open_exceptions_count ?? 0}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-gray-500 font-medium">Critical Exceptions</span>
              <span className="font-black text-red-600">{closingStatusData?.open_critical_count ?? 0}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-50">
              <span className="text-gray-500 font-medium">Error Exceptions</span>
              <span className="font-black text-orange-600">{closingStatusData?.open_error_count ?? 0}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-gray-500 font-medium">Warning Exceptions</span>
              <span className="font-bold text-amber-600">{closingStatusData?.open_warning_count ?? 0}</span>
            </div>
          </div>
        </div>

      </div>

      {/* BLOCKING EXCEPTIONS SECTION */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-150 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="text-sm font-extrabold text-gray-900 uppercase tracking-wide">Blocking & Open Exceptions</h2>
          </div>
          <span className="text-xs font-bold text-gray-400">{exceptions.length} Item</span>
        </div>

        {exceptions.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            Tidak ada open exception untuk outlet <strong>{selectedOutlet}</strong>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100">
                <tr>
                  <th className="py-3 px-3">Severity</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Entity / ID</th>
                  <th className="py-3 px-3">Reason</th>
                  <th className="py-3 px-3">Recommendation</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
                {exceptions.map((exc) => {
                  const excId = exc.exception_id || exc.id;
                  const severity = exc.severity || exc.type_severity || "ERROR";
                  const excStatus = exc.status || "OPEN";
                  return (
                    <tr key={excId} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          severity === "CRITICAL" ? "bg-red-100 text-red-800 border border-red-200" :
                          severity === "ERROR" ? "bg-orange-100 text-orange-800 border border-orange-200" :
                          "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}>
                          {severity}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] font-bold text-gray-700">{exc.type}</td>
                      <td className="py-3 px-3 font-mono text-[11px]">
                        <div>{exc.entity_type}</div>
                        <div className="text-gray-400 text-[10px]">{exc.entity_id || exc.transaksi_id || "-"}</div>
                      </td>
                      <td className="py-3 px-3 max-w-xs truncate text-gray-600" title={exc.reason}>{exc.reason}</td>
                      <td className="py-3 px-3 max-w-xs truncate text-gray-500" title={exc.recommendation}>{exc.recommendation || "-"}</td>
                      <td className="py-3 px-3 font-bold text-[10px]">
                        <span className={`px-2 py-0.5 rounded ${
                          excStatus === "RESOLVED" ? "bg-emerald-100 text-emerald-800" :
                          excStatus === "IN_REVIEW" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700"
                        }`}>
                          {excStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right space-x-1">
                        {excStatus === "OPEN" && (
                          <button
                            onClick={() => handleStartReview(excId)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded text-[11px] transition-colors cursor-pointer"
                          >
                            Review
                          </button>
                        )}
                        {excStatus !== "RESOLVED" && (
                          <button
                            onClick={() => {
                              setSelectedException(exc);
                              setResolutionNotes("");
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[11px] transition-colors cursor-pointer"
                          >
                            Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AUDIT TRAIL SECTION */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-150 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-gray-700" />
            <h2 className="text-sm font-extrabold text-gray-900 uppercase tracking-wide">Daily Closing Audit Trail</h2>
          </div>
          <span className="text-xs font-bold text-gray-400">{auditLogs.length} Event</span>
        </div>

        {auditLogs.length === 0 ? (
          <div className="py-6 text-center text-gray-400 text-xs">
            Belum ada audit event tercatat untuk closing outlet ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100">
                <tr>
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Event / Action</th>
                  <th className="py-2.5 px-3">Result</th>
                  <th className="py-2.5 px-3">Detail / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                {auditLogs.slice(0, 15).map((log: any) => (
                  <tr key={log.id || log.audit_id || Math.random()} className="hover:bg-gray-50">
                    <td className="py-2.5 px-3 text-gray-500 font-mono text-[11px]">
                      {log.created_at ? new Date(log.created_at).toLocaleTimeString("id-ID") : "-"}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-gray-800">
                      {log.actor_name || log.actor_id || "SYSTEM"} ({log.actor_role || "SYSTEM"})
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-gray-900 font-extrabold">
                      {log.event_type}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[10px]">
                      <span className={`px-2 py-0.5 rounded ${
                        log.result === "SUCCESS" ? "bg-emerald-100 text-emerald-800" :
                        log.result === "REJECTED" || log.result === "FAILED" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {log.result}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 max-w-xs truncate" title={log.reason || log.detail || JSON.stringify(log.metadata || {})}>
                      {log.reason || log.detail || (log.metadata ? JSON.stringify(log.metadata) : "-")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: CLOSE CONFIRMATION */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-gray-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#E4002B]" /> Confirm Daily Closing
              </h3>
              <button 
                onClick={() => setShowCloseModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Anda akan mengunci seluruh operasional harian outlet <strong className="text-gray-800">{selectedOutlet}</strong> pada tanggal <strong className="text-gray-800">{closingDate}</strong>.
            </p>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Catatan Closing (Opsional)</label>
              <textarea
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Tuliskan catatan tambahan jika ada..."
                className="w-full p-3 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#E4002B]/20 focus:border-[#E4002B]"
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-2 justify-end">
              <button
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteClose}
                disabled={validating}
                className="px-4 py-2 bg-[#E4002B] hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer"
              >
                {validating && <Loader2 className="w-4 h-4 animate-spin" />}
                Konfirmasi Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REOPEN CONFIRMATION */}
      {showReopenModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-gray-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-600" /> Reopen Daily Closing
              </h3>
              <button 
                onClick={() => setShowReopenModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Membuka kembali daily closing memerlukan otoritas Owner / Super Admin dan wajib disertai alasan resmi yang akan dicatat di Audit Trail.
            </p>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Alasan Reopen (Wajib)</label>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Misal: Koreksi transaksi kasir, penyesuaian setoran bank..."
                className="w-full p-3 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                rows={3}
                required
              />
            </div>

            <div className="flex gap-2 pt-2 justify-end">
              <button
                onClick={() => setShowReopenModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleReopen}
                disabled={validating || !reopenReason.trim()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {validating && <Loader2 className="w-4 h-4 animate-spin" />}
                Konfirmasi Reopen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESOLVE EXCEPTION */}
      {selectedException && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-gray-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Selesaikan Exception
              </h3>
              <button 
                onClick={() => setSelectedException(null)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-1">
              <div className="font-bold text-gray-900">Type: {selectedException.type}</div>
              <div className="text-gray-600">{selectedException.reason}</div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Keputusan / Decision</label>
              <select
                value={resolutionType}
                onChange={(e) => setResolutionType(e.target.value)}
                className="w-full p-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="RESOLVED">Selesaikan Exception (Resolved)</option>
                <option value="ACCEPTED">Ditoleransi / Disetujui Owner (Accepted)</option>
                <option value="REJECTED">Ditolak (Rejected)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Catatan Penyelesaian (Notes)</label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Jelaskan dasar keputusan penyelesaian..."
                className="w-full p-3 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-2 justify-end">
              <button
                onClick={() => setSelectedException(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleResolveSubmit}
                disabled={!resolutionNotes.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                Simpan Penyelesaian
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
