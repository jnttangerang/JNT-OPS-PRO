"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Calendar,
  RefreshCw,
  X,
  Loader2,
  Lock,
  RotateCcw,
  AlertTriangle,
  Check,
  XCircle,
  ArrowUpRight
} from "lucide-react";
import { getTodayWIB, shiftWIBDays } from "../../utils/dateUtils";
import { toast } from "../../utils/toast";

interface OwnerDailyClosingDashboardProps {
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
}: OwnerDailyClosingDashboardProps) {
  const [closingDate, setClosingDate] = useState<string>(() => getTodayWIB());
  
  const [loading, setLoading] = useState<boolean>(false);
  const [validatingOutlet, setValidatingOutlet] = useState<string | null>(null);

  // Data States
  const [outletClosingRecords, setOutletClosingRecords] = useState<Record<string, any>>({});

  // Modals
  const [showReopenModal, setShowReopenModal] = useState<boolean>(false);
  const [reopenTargetOutlet, setReopenTargetOutlet] = useState<{ id: string; name: string } | null>(null);
  const [reopenReason, setReopenReason] = useState<string>("");
  const [submittingReopen, setSubmittingReopen] = useState<boolean>(false);

  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);
  const [closeTargetOutlet, setCloseTargetOutlet] = useState<{ id: string; name: string } | null>(null);
  const [closeNotes, setCloseNotes] = useState<string>("");
  const [submittingClose, setSubmittingClose] = useState<boolean>(false);

  const getActorInfo = useCallback(() => ({
    actor_id: session?.user_id || session?.username || "OWNER-01",
    actor_name: session?.nama_lengkap || session?.username || "Owner",
    actor_role: session?.role || "OWNER"
  }), [session]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch closing status for each outlet
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

    } catch (err) {
      console.error("Error fetching owner closing dashboard data:", err);
      toast.error("Gagal memuat status closing harian.");
    } finally {
      setLoading(false);
    }
  }, [closingDate, outlets]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      if (res.ok && json.status === "success") {
        toast.success(json.message || "Validasi berhasil dijalankan.");
        await fetchData(); // refresh to get new validation_data / status
      } else {
        toast.error(json.message || "Gagal melakukan validasi.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan sistem saat validasi.");
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
              STATUS TUTUP BUKU
            </h1>
          </div>
          <p className="text-xs text-gray-500 font-semibold">
            Monitoring status tutup buku (daily closing) seluruh outlet ({outlets.length} Cabang Terdaftar).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Date Shortcuts */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 p-1 rounded-xl text-xs">
            <button
              onClick={() => setClosingDate(getTodayWIB())}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                closingDate === getTodayWIB() ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => setClosingDate(shiftWIBDays(getTodayWIB(), -1))}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                closingDate === shiftWIBDays(getTodayWIB(), -1) ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Kemarin
            </button>
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

      {/* 2. DAILY CLOSING STATUS & CONTROL (TUTUP BUKU PER OUTLET) */}
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {outlets.map((o) => {
            const closingRec = outletClosingRecords[o.outlet_id];
            const bookStatus = closingRec?.status || "OPEN";
            const isValidating = validatingOutlet === o.outlet_id;

            // Extract canonical financial data from existing closing engine
            const txCount = closingRec?.transaction_count || 0;
            const expectedCash = Number(closingRec?.setoran_required ?? closingRec?.validation_data?.expected_cash ?? closingRec?.setoran_summary?.total_expected_cash ?? 0);
            const actualCash = Number(closingRec?.setoran_actual ?? closingRec?.validation_data?.actual_cash ?? closingRec?.setoran_summary?.total_actual_cash ?? 0);
            const cashVariance = Number(closingRec?.setoran_variance ?? (actualCash - expectedCash));
            const isCashMatch = expectedCash === 0 || (actualCash >= expectedCash);
            const cashShort = Math.max(0, expectedCash - actualCash);

            // Digital & QRIS payments
            const digitalPayment = Number(closingRec?.total_digital_payment ?? closingRec?.validation_data?.total_digital_payment ?? 0);

            // Audit issues
            const openCritical = Number(closingRec?.open_critical_count ?? closingRec?.validation_data?.open_critical_count ?? 0);
            const openError = Number(closingRec?.open_error_count ?? closingRec?.validation_data?.open_error_count ?? 0);
            const isAuditClean = (openCritical === 0 && openError === 0);

            // Selisih
            const selisihNominal = cashVariance;
            const isSelisihZero = Math.abs(selisihNominal) < 0.01;

            return (
              <div
                key={o.outlet_id}
                className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-4 flex flex-col justify-between hover:border-gray-300 transition-colors"
              >
                <div>
                  {/* Outlet & Date Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-3">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block font-mono">
                        DAILY CLOSING • {closingDate}
                      </span>
                      <h3 className="text-base font-black text-gray-900 tracking-tight uppercase">
                        {o.nama_outlet}
                      </h3>
                      <span className="text-[10px] font-mono text-gray-400 font-bold">{o.outlet_id}</span>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        bookStatus === "CLOSED"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : bookStatus === "READY"
                          ? "bg-blue-50 text-blue-800 border-blue-200"
                          : bookStatus === "BLOCKED"
                          ? "bg-rose-50 text-rose-800 border-rose-200"
                          : "bg-amber-50 text-amber-800 border-amber-200"
                      }`}
                    >
                      {bookStatus === "CLOSED"
                        ? "SUDAH DITUTUP"
                        : bookStatus === "READY"
                        ? "SIAP DITUTUP"
                        : bookStatus === "BLOCKED"
                        ? "BELUM BISA DITUTUP"
                        : "MENUNGGU PROSES"}
                    </span>
                  </div>

                  {/* 5-POINT SUMMARY CHECKLIST */}
                  <div className="py-3 space-y-2 text-xs">
                    {/* 1. Transaksi */}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 font-medium">Transaksi</span>
                      <span className="font-mono font-bold text-gray-800 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        {txCount} Resi
                      </span>
                    </div>

                    {/* 2. Setoran Cash */}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 font-medium">Setoran Cash</span>
                      <span className={`font-mono font-bold flex items-center gap-1.5 ${isCashMatch ? "text-gray-800" : "text-rose-600"}`}>
                        {isCashMatch ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        )}
                        Rp {actualCash.toLocaleString("id-ID")} / Rp {expectedCash.toLocaleString("id-ID")}
                      </span>
                    </div>

                    {/* 3. QRIS */}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 font-medium">QRIS</span>
                      <span className="font-mono font-bold text-gray-800 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        {digitalPayment > 0 ? `Rp ${digitalPayment.toLocaleString("id-ID")}` : "Rp 0"}
                      </span>
                    </div>

                    {/* 4. Audit */}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 font-medium">Audit</span>
                      <span className={`font-mono font-bold flex items-center gap-1.5 ${isAuditClean ? "text-gray-800" : "text-amber-700"}`}>
                        {isAuditClean ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        )}
                        {isAuditClean ? "0 Isu Kritis" : `${openCritical + openError} Isu Perlu Review`}
                      </span>
                    </div>

                    {/* 5. Selisih */}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                      <span className="text-gray-500 font-medium">Selisih</span>
                      <span className={`font-mono font-bold flex items-center gap-1.5 ${isSelisihZero ? "text-emerald-700" : selisihNominal < 0 ? "text-rose-600" : "text-blue-700"}`}>
                        {isSelisihZero ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        )}
                        {isSelisihZero ? "Rp 0" : `${selisihNominal < 0 ? "-" : "+"}Rp ${Math.abs(selisihNominal).toLocaleString("id-ID")}`}
                      </span>
                    </div>
                  </div>

                  {/* BLOCKED REASON BREAKDOWN */}
                  {bookStatus === "BLOCKED" && (
                    <div className="p-3 bg-rose-50/70 border border-rose-200/80 rounded-xl space-y-2 mt-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 block">
                        BELUM BISA DITUTUP
                      </span>

                      {/* Setoran Cash Issue */}
                      {!isCashMatch && (
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div>
                            <p className="font-bold text-rose-900">Setoran Cash</p>
                            <p className="text-[11px] text-rose-700 font-mono">
                              {cashShort > 0 ? `Kurang Rp ${cashShort.toLocaleString("id-ID")}` : "Belum diajukan / disetujui"}
                            </p>
                          </div>
                          <Link
                            to="/setoran-owner"
                            className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-700 font-bold text-[11px] rounded-lg border border-rose-200 transition-colors inline-flex items-center gap-1 shrink-0"
                          >
                            Lihat Setoran <ArrowUpRight className="w-3 h-3" />
                          </Link>
                        </div>
                      )}

                      {/* Audit Issue */}
                      {!isAuditClean && (
                        <div className="flex items-center justify-between gap-2 text-xs pt-1.5 border-t border-rose-100">
                          <div>
                            <p className="font-bold text-amber-900">Audit</p>
                            <p className="text-[11px] text-amber-800">
                              {openCritical + openError} transaksi perlu review
                            </p>
                          </div>
                          <Link
                            to="/owner-audit"
                            className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-800 font-bold text-[11px] rounded-lg border border-amber-200 transition-colors inline-flex items-center gap-1 shrink-0"
                          >
                            Lihat Audit <ArrowUpRight className="w-3 h-3" />
                          </Link>
                        </div>
                      )}

                      {/* Other Blocking Reasons from Engine */}
                      {closingRec?.blocking_reasons && closingRec.blocking_reasons.length > 0 && isCashMatch && isAuditClean && (
                        <div className="space-y-1 text-[11px] text-rose-800">
                          {closingRec.blocking_reasons.slice(0, 2).map((r: string, idx: number) => (
                            <p key={idx} className="line-clamp-2 leading-relaxed">• {r}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* LATE TRANSACTIONS WARNING IF CLOSED */}
                  {bookStatus === "CLOSED" && closingRec?.late_info?.has_late_transactions === true && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mt-2 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[11px] font-bold text-amber-900 block leading-tight">
                            Ada Transaksi Setelah Tutup Buku
                          </span>
                          <span className="text-[10px] text-amber-700">
                            {closingRec.late_info.late_transaction_count} transaksi terlambat tercatat
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenReopenModal(o.outlet_id, o.nama_outlet)}
                        className="w-full py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold rounded-lg border border-amber-300 transition-colors cursor-pointer"
                      >
                        Reopen untuk Rekonsiliasi
                      </button>
                    </div>
                  )}

                  {/* CLOSED BY INFO */}
                  {bookStatus === "CLOSED" && closingRec?.closed_by && (
                    <p className="text-[11px] text-gray-500 pt-1">
                      Ditutup oleh: <strong className="text-gray-800">{closingRec.closed_by}</strong>
                    </p>
                  )}
                </div>

                {/* BOTTOM ACTION BUTTONS */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleValidateOutlet(o.outlet_id, o.nama_outlet)}
                    disabled={isValidating || loading}
                    className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                    title="Cek & Validasi status terbaru"
                  >
                    {isValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Validasi"}
                  </button>

                  {bookStatus === "CLOSED" ? (
                    <button
                      onClick={() => handleOpenReopenModal(o.outlet_id, o.nama_outlet)}
                      className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Buka Kembali
                    </button>
                  ) : bookStatus === "READY" ? (
                    <button
                      onClick={() => handleOpenCloseModal(o.outlet_id, o.nama_outlet)}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Tutup Buku
                    </button>
                  ) : (
                    <button
                      disabled
                      className="px-3.5 py-1.5 bg-gray-200 text-gray-400 rounded-xl text-xs font-bold cursor-not-allowed"
                    >
                      Tutup Buku
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
            
            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-600">
                Anda akan membuka kembali status tutup buku untuk outlet <strong>{reopenTargetOutlet.name}</strong> pada tanggal <strong>{closingDate}</strong>.
              </p>
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Alasan Reopen (Wajib)
                </label>
                <textarea
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  rows={3}
                  placeholder="Berikan alasan mengapa buku harus dibuka kembali..."
                  className="w-full border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              
              <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                <p className="text-[10px] text-red-700 font-semibold leading-relaxed">
                  <strong>Peringatan:</strong> Membuka kembali buku harian akan membatalkan status CLOSED. Transaksi baru pada tanggal ini mungkin mengubah rekonsiliasi.
                </p>
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
                disabled={submittingReopen || !reopenReason.trim()}
                className="px-4 py-2 text-xs font-black bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm shadow-amber-500/20"
              >
                {submittingReopen && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Ya, Buka Kembali Buku
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
                <h3 className="font-bold text-gray-800 text-sm">Konfirmasi Tutup Buku</h3>
              </div>
              <button
                onClick={() => setShowCloseModal(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 space-y-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-500">Outlet:</span>
                  <span className="font-black text-gray-900">{closeTargetOutlet.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-500">Tanggal Operasional:</span>
                  <span className="font-black text-gray-900">{closingDate}</span>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Catatan Tutup Buku (Opsional)
                </label>
                <textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  rows={2}
                  placeholder="Tambahkan catatan khusus jika ada..."
                  className="w-full border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                <p className="text-[10px] text-blue-800 font-semibold leading-relaxed">
                  Dengan menutup buku harian, Anda menyatakan bahwa operasional kas pada tanggal ini telah selesai dan tervalidasi.
                </p>
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
                {submittingClose && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Selesaikan Tutup Buku
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
