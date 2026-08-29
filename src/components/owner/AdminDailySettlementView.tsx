import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar, CheckCircle2, AlertTriangle, AlertCircle, Lock, Loader2, Store,
  RefreshCw, DollarSign, ArrowUpRight, History, X, Info, FileText, Check,
  Clock, ShieldAlert, ChevronRight, CheckCircle
} from "lucide-react";
import { toast } from "../../utils/toast";
import { getTodayWIB, calculateSettlementAging } from "../../utils/dateUtils";
import { useAppsScript } from "../../hooks/useAppsScript";

export interface AdminDailySettlementViewProps {
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

export default function AdminDailySettlementView({
  session,
  outlets,
  activeOutletId,
  onChangeActiveOutlet
}: AdminDailySettlementViewProps) {
  const { callBackend } = useAppsScript();
  const currentUserId = session?.user_id || session?.username || "SYSTEM";
  const currentUserName = session?.nama_lengkap || session?.username || "Admin";

  const defaultOutlet = activeOutletId || session?.outlet_id_home || outlets[0]?.outlet_id || "OUT-A";
  const [selectedClosingOutlet, setSelectedClosingOutlet] = useState<string>(defaultOutlet);
  const [closingDate, setClosingDate] = useState<string>(() => getTodayWIB());

  // Data States
  const [loading, setLoading] = useState<boolean>(false);
  const [validating, setValidating] = useState<boolean>(false);
  const [adminSettlementData, setAdminSettlementData] = useState<any[]>([]);
  const [activeOutletClosingStatus, setActiveOutletClosingStatus] = useState<any>(null);

  // Modal States
  const [showSetoranModal, setShowSetoranModal] = useState<boolean>(false);
  const [targetOutletId, setTargetOutletId] = useState<string>("");
  const [targetOutletName, setTargetOutletName] = useState<string>("");
  const [nominalSetorInput, setNominalSetorInput] = useState<number | string>("");
  const [setoranNotes, setSetoranNotes] = useState<string>("");
  const [submittingSetoran, setSubmittingSetoran] = useState<boolean>(false);

  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);
  const [closeNotes, setCloseNotes] = useState<string>("");
  const [submittingClose, setSubmittingClose] = useState<boolean>(false);

  // Keep closing outlet synchronized with activeOutletId if provided
  useEffect(() => {
    if (activeOutletId && activeOutletId !== selectedClosingOutlet) {
      setSelectedClosingOutlet(activeOutletId);
    }
  }, [activeOutletId]);

  const handleSelectClosingOutlet = (outletId: string) => {
    setSelectedClosingOutlet(outletId);
    if (onChangeActiveOutlet) {
      onChangeActiveOutlet(outletId);
    }
  };

  const getActorInfo = useCallback(() => ({
    actor_id: session?.user_id || session?.username || "SYSTEM",
    actor_name: session?.nama_lengkap || session?.username || "Admin",
    actor_role: session?.role || "ADMIN"
  }), [session]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Multi-Outlet settlement data specifically for this Admin
      const adminRes = await fetch(`/api/dailyClosing/admin/status?admin_id=${encodeURIComponent(currentUserId)}&tanggal=${closingDate}`);
      if (adminRes.ok) {
        const adminJson = await adminRes.json();
        setAdminSettlementData(adminJson.data || []);
      }

      // 2. Fetch Active Outlet's Book Closing Status
      if (selectedClosingOutlet) {
        const statusRes = await fetch(`/api/dailyClosing/status?outlet_id=${encodeURIComponent(selectedClosingOutlet)}&tanggal=${closingDate}`);
        if (statusRes.ok) {
          const statusJson = await statusRes.json();
          setActiveOutletClosingStatus(statusJson);
        }
      }
    } catch (err) {
      console.error("Error fetching admin daily settlement data:", err);
      toast.error("Gagal memuat data setoran harian.");
    } finally {
      setLoading(false);
    }
  }, [currentUserId, closingDate, selectedClosingOutlet]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Aggregate Admin's Personal Cash Totals across all outlets
  const totalWajibSetor = adminSettlementData.reduce((acc, item) => {
    return acc + Number(item.my_breakdown?.expected_cash || 0);
  }, 0);

  const totalDisetor = adminSettlementData.reduce((acc, item) => {
    return acc + Number(item.my_breakdown?.setoran_actual || 0);
  }, 0);

  const totalOutstanding = Math.max(0, totalWajibSetor - totalDisetor);

  // Modal Action: Open Setoran
  const handleOpenSetoran = (outletId: string, outletName: string, expectedCash: number) => {
    setTargetOutletId(outletId);
    setTargetOutletName(outletName);
    setNominalSetorInput(expectedCash);
    setSetoranNotes("");
    setShowSetoranModal(true);
  };

  // Submit Setoran to Backend
  const handleSubmitSetoran = async () => {
    const nominal = Number(nominalSetorInput);
    if (isNaN(nominal) || nominal < 0) {
      toast.error("Nominal uang yang disetor tidak valid.");
      return;
    }

    setSubmittingSetoran(true);
    try {
      const res = await callBackend("createSetoran", {
        outlet_id: targetOutletId,
        tanggal: closingDate,
        admin_id: currentUserId,
        nominal_setor: nominal,
        actual_cash: nominal,
        catatan: setoranNotes.trim()
      });

      if (res.status === "success") {
        toast.success(res.message || `Setoran untuk outlet ${targetOutletName} berhasil diajukan ke Owner.`);
        setShowSetoranModal(false);
        await fetchData();
      } else {
        toast.error(res.message || "Gagal membuat laporan setoran.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Terjadi kesalahan saat mengajukan setoran.");
    } finally {
      setSubmittingSetoran(false);
    }
  };

  // Action: Validate Outlet Closing
  const handleValidateClosing = async () => {
    setValidating(true);
    try {
      const selectedName = outlets.find(o => o.outlet_id === selectedClosingOutlet)?.nama_outlet || selectedClosingOutlet;
      const res = await fetch("/api/dailyClosing/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: selectedClosingOutlet,
          outlet_name: selectedName,
          tanggal: closingDate,
          ...getActorInfo()
        })
      });

      const json = await res.json();
      if (res.ok && (json.status === "success" || json.status === "blocked")) {
        setActiveOutletClosingStatus(json.data || json);
        if (json.status === "success") {
          toast.success(json.message || `Status outlet '${selectedName}' SIAP TUTUP BUKU.`);
        } else {
          toast.error(json.message || `Outlet '${selectedName}' belum memenuhi syarat tutup buku.`);
        }
      } else {
        toast.error(json.message || "Gagal memeriksa kelayakan tutup buku.");
      }
      await fetchData();
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan koneksi saat validasi.");
    } finally {
      setValidating(false);
    }
  };

  // Action: Execute Outlet Close
  const handleExecuteClose = async () => {
    setSubmittingClose(true);
    try {
      const selectedName = outlets.find(o => o.outlet_id === selectedClosingOutlet)?.nama_outlet || selectedClosingOutlet;
      const res = await fetch("/api/dailyClosing/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: selectedClosingOutlet,
          outlet_name: selectedName,
          tanggal: closingDate,
          notes: closeNotes,
          ...getActorInfo()
        })
      });

      const json = await res.json();
      if (res.ok && json.status === "success") {
        toast.success(json.message || `Tutup buku berhasil diselesaikan untuk outlet '${selectedName}'.`);
        setShowCloseModal(false);
        setCloseNotes("");
        await fetchData();
      } else {
        toast.error(json.message || "Gagal menyelesaikan tutup buku.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan saat menutup buku operasional.");
    } finally {
      setSubmittingClose(false);
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

  const selectedOutletDisplayName = outlets.find(o => o.outlet_id === selectedClosingOutlet)?.nama_outlet || selectedClosingOutlet;
  const activeBookStatus = activeOutletClosingStatus?.status || "OPEN";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 font-sans text-gray-800 bg-gray-50/50 min-h-screen">
      {/* 1. ADMIN HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-150">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-700 border border-emerald-200">
              <DollarSign className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">SETORAN SAYA</h1>
          </div>
          <p className="text-xs text-gray-500 font-semibold">
            Tanggung jawab setoran harian dari transaksi yang Anda tangani ({currentUserName}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
            Segarkan
          </button>
        </div>
      </div>

      {/* 2. SECTION 1 — CASH RESPONSIBILITY (DOMINANT TOP SECTION) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
              <span>TANGGUNG JAWAB SETORAN HARIAN PER OUTLET</span>
              <span className="text-xs font-extrabold px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                {adminSettlementData.length} Outlet
              </span>
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Uang tunai hasil transaksi Anda yang wajib disetorkan ke Owner pada tanggal {closingDate}.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl p-10 border border-gray-150 text-center text-gray-400 space-y-3">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-emerald-600" />
            <p className="text-xs font-bold">Memeriksa tanggung jawab setoran harian Anda...</p>
          </div>
        ) : adminSettlementData.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-gray-150 text-center text-gray-400 space-y-2 shadow-sm">
            <CheckCircle className="w-10 h-10 mx-auto text-emerald-500 opacity-60" />
            <h3 className="text-sm font-black text-gray-700">Tidak Ada Tanggung Jawab Setoran</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Tidak ditemukan transaksi tunai yang tercatat atas nama akun Anda pada tanggal {closingDate}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {adminSettlementData.map((item) => {
              const brk = item.my_breakdown;
              const reqCash = Number(brk.expected_cash || 0);
              const actCash = Number(brk.setoran_actual || 0);
              const variance = Number(brk.setoran_variance || 0);
              const rawStatus = brk.setoran_status || "BELUM_SUBMIT";
              const ag = brk.aging || calculateSettlementAging(brk.tanggal || closingDate, brk.created_at || null, actCash > 0 || rawStatus !== "BELUM_SUBMIT");
              
              const isMatched = rawStatus === "MATCH" || rawStatus === "MATCHED" || rawStatus === "OK" || rawStatus === "DISETUJUI";
              const isPending = rawStatus === "MENUNGGU_APPROVAL" || rawStatus === "UNAPPROVED";

              return (
                <div
                  key={item.outlet_id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-150 p-5 space-y-4 hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-gray-100 rounded-lg text-gray-700">
                          <Store className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">
                            {item.outlet_name}
                          </h3>
                          <span className="text-[10px] font-bold text-gray-400">
                            {item.outlet_id}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        {getAgingBadge(ag)}
                      </div>
                    </div>

                    {/* Card Body Numbers */}
                    <div className="mt-4 space-y-2.5 text-xs">
                      <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl">
                        <span className="text-gray-600 font-bold">Wajib Setor Harian:</span>
                        <span className="font-black text-sm text-gray-900">
                          Rp {reqCash.toLocaleString("id-ID")}
                        </span>
                      </div>

                      <div className="flex justify-between items-center px-1">
                        <span className="text-gray-500 font-medium">Sudah Disetor:</span>
                        <span className="font-bold text-emerald-600">
                          Rp {actCash.toLocaleString("id-ID")}
                        </span>
                      </div>

                      <div className="flex justify-between items-center px-1 border-b border-gray-100 pb-2">
                        <span className="text-gray-500 font-medium">Selisih:</span>
                        <span className={`font-bold ${variance === 0 ? "text-emerald-600" : "text-red-600"}`}>
                          Rp {variance.toLocaleString("id-ID")}
                        </span>
                      </div>

                      <div className="flex justify-between items-center px-1 pt-1">
                        <span className="text-gray-500 font-medium">Status Setoran:</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                            isMatched
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : isPending
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {isMatched ? "SESUAI" : isPending ? "MENUNGGU PERSETUJUAN" : rawStatus === "BELUM_SUBMIT" ? "BELUM SETOR" : rawStatus}
                        </span>
                      </div>

                      <div className="flex justify-between items-center px-1 text-[11px] text-gray-400">
                        <span>Resi Tunai Terhitung:</span>
                        <span className="font-bold text-gray-700">{brk.jumlah_resi || 0} resi</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Button */}
                  <div className="pt-3 border-t border-gray-100">
                    {isMatched ? (
                      <div className="w-full py-2.5 px-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-black flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> SETORAN SELESAI
                      </div>
                    ) : isPending ? (
                      <div className="w-full py-2.5 px-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-black flex items-center justify-center gap-1.5">
                        <Clock className="w-4 h-4" /> MENUNGGU PERSETUJUAN OWNER
                      </div>
                    ) : (
                      <button
                        onClick={() => handleOpenSetoran(item.outlet_id, item.outlet_name, reqCash)}
                        className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer transition-all active:scale-[0.98]"
                      >
                        <DollarSign className="w-4 h-4" /> BUAT SETORAN INI
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. SECTION 2 — TOTAL TANGGUNG JAWAB SAYA (AGGREGATE CARD) */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700 pb-3">
          <div>
            <h3 className="text-sm font-black tracking-wider uppercase text-emerald-400">
              REKAPITULASI TOTAL SETORAN SAYA
            </h3>
            <p className="text-xs text-slate-300">
              Total kewajiban setoran harian Anda di seluruh outlet pada {closingDate}
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-slate-700/80 rounded-full border border-slate-600 text-slate-200">
            {adminSettlementData.length} Cabang Terkait
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
            <span className="text-[11px] font-bold text-slate-400 block mb-1">TOTAL WAJIB SETOR</span>
            <span className="text-xl font-black text-white">
              Rp {totalWajibSetor.toLocaleString("id-ID")}
            </span>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
            <span className="text-[11px] font-bold text-slate-400 block mb-1">TOTAL SUDAH DISETOR</span>
            <span className="text-xl font-black text-emerald-400">
              Rp {totalDisetor.toLocaleString("id-ID")}
            </span>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
            <span className="text-[11px] font-bold text-slate-400 block mb-1">SISA BELUM DISETOR</span>
            <span className={`text-xl font-black ${totalOutstanding === 0 ? "text-slate-300" : "text-amber-400"}`}>
              Rp {totalOutstanding.toLocaleString("id-ID")}
            </span>
          </div>
        </div>
      </div>

      {/* 4. SECTION 3 — TUTUP BUKU OUTLET AKTIF (SEPARATED OPERATIONAL SCOPE) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-150 p-6 space-y-5">
        <div className="border-b border-gray-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-gray-900 tracking-tight">
                  TUTUP BUKU OPERASIONAL (OUTLET AKTIF)
                </h3>
              </div>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Tutup Buku adalah penutupan operasional outlet, terpisah dari kewajiban setoran harian admin.
              </p>
            </div>

            {/* Dropdown to switch active outlet for closing */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">Pilih Outlet:</span>
              <select
                value={selectedClosingOutlet}
                onChange={(e) => handleSelectClosingOutlet(e.target.value)}
                className="bg-gray-50 border border-gray-200 text-xs font-bold text-gray-800 px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                {outlets.map((o) => (
                  <option key={o.outlet_id} value={o.outlet_id}>
                    {o.nama_outlet}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Active Outlet Book Status Info Card */}
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">Status Buku {selectedOutletDisplayName}:</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase border ${
                  activeBookStatus === "CLOSED"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : activeBookStatus === "READY"
                    ? "bg-blue-100 text-blue-800 border-blue-300"
                    : activeBookStatus === "BLOCKED"
                    ? "bg-red-100 text-red-800 border-red-300"
                    : "bg-amber-100 text-amber-800 border-amber-300"
                }`}
              >
                {activeBookStatus === "CLOSED"
                  ? "SUDAH DITUTUP"
                  : activeBookStatus === "READY"
                  ? "SIAP TUTUP BUKU"
                  : activeBookStatus === "BLOCKED"
                  ? "TERKENDALA"
                  : activeBookStatus}
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Total Transaksi Outlet: <strong className="text-gray-800">{activeOutletClosingStatus?.transaction_count || 0} resi</strong>
            </p>
          </div>

          {/* Action CTAs for closing */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleValidateClosing}
              disabled={validating || loading}
              className="px-3.5 py-2 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-blue-600" />}
              Cek Kelayakan
            </button>

            {activeBookStatus !== "CLOSED" && (
              <button
                onClick={() => setShowCloseModal(true)}
                disabled={validating || loading || activeBookStatus === "BLOCKED"}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-blue-600/20 disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 inline mr-1.5" />
                Tutup Buku Outlet
              </button>
            )}
          </div>
        </div>

        {/* Blocking reasons notification (if any) */}
        {activeOutletClosingStatus?.blocking_reasons && activeOutletClosingStatus.blocking_reasons.length > 0 && activeBookStatus !== "CLOSED" && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Pemberitahuan Kelayakan Tutup Buku:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-800">
                {activeOutletClosingStatus.blocking_reasons.map((reason: string, idx: number) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
              <span className="text-[10px] text-amber-700 font-semibold block pt-1">
                * Catatan: Jika kendala membutuhkan otorisasi, koordinasikan dengan Owner.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: BUAT SETORAN */}
      {showSetoranModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700">
                  <DollarSign className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-gray-800 text-sm">Buat Setoran ke Owner</h3>
              </div>
              <button
                onClick={() => setShowSetoranModal(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium text-emerald-700">Outlet Tujuan:</span>
                  <span className="font-bold text-emerald-950">{targetOutletName} ({targetOutletId})</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-emerald-700">Tanggal Transaksi:</span>
                  <span className="font-bold text-emerald-950">{closingDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-emerald-700">Penyetor (Admin):</span>
                  <span className="font-bold text-emerald-950">{currentUserName} ({currentUserId})</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nominal Uang Disetor (Rp)
                </label>
                <input
                  type="number"
                  value={nominalSetorInput}
                  onChange={(e) => setNominalSetorInput(e.target.value)}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Catatan / Keterangan (Opsional)
                </label>
                <textarea
                  value={setoranNotes}
                  onChange={(e) => setSetoranNotes(e.target.value)}
                  rows={2}
                  placeholder="Misal: Disetor tunai ke Owner, atau via transfer..."
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-gray-50"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
              <button
                onClick={() => setShowSetoranModal(false)}
                disabled={submittingSetoran}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSubmitSetoran}
                disabled={submittingSetoran}
                className="px-4 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer"
              >
                {submittingSetoran ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Kirim Laporan Setoran
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TUTUP BUKU CONFIRMATION */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-lg text-blue-700">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-gray-800 text-sm">Konfirmasi Tutup Buku Outlet</h3>
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
                Anda akan menutup buku harian untuk outlet <strong className="text-gray-900">{selectedOutletDisplayName}</strong> tanggal <strong className="text-gray-900">{closingDate}</strong>.
              </p>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Catatan Penutupan (Opsional)
                </label>
                <textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  rows={3}
                  placeholder="Tambahkan catatan serah terima atau kondisi operasional outlet..."
                  className="w-full border border-gray-200 rounded-xl p-3 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50"
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
                className="px-4 py-2 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm shadow-blue-600/20 cursor-pointer"
              >
                {submittingClose ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                Selesaikan Tutup Buku
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
