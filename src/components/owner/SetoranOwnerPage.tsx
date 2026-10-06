import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { SessionData, Outlet } from "../../types";
import useAppsScript from "../../hooks/useAppsScript";
import { toast } from "../../utils/toast";
import { getTodayWIB, shiftWIBDays, calculateSettlementAging } from "../../utils/dateUtils";
import {
  Calendar,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  RefreshCcw,
  ArrowLeft,
  X,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Activity,
  AlertTriangle,
  AlertCircle,
  CreditCard,
  Banknote,
  Smartphone,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from "lucide-react";

interface SetoranOwnerPageProps {
  session: SessionData;
  outlets: Outlet[];
}

export default function SetoranOwnerPage({ session, outlets }: SetoranOwnerPageProps) {
  const { callBackend, loading } = useAppsScript();
  const [list, setList] = useState<any[]>([]);
  
  const [filterOutlet, setFilterOutlet] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [dateStart, setDateStart] = useState(() => shiftWIBDays(getTodayWIB(), -7));
  const [dateEnd, setDateEnd] = useState(() => getTodayWIB());
  
  const [detail, setDetail] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showAllTransactions, setShowAllTransactions] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    setCurrentPage(1);
    fetchList();
  }, [filterOutlet, filterStatus, dateStart, dateEnd]);

  const totalPages = Math.ceil(list.length / pageSize) || 1;
  const paginatedList = list.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const fetchList = async () => {
    try {
      const res = await callBackend("getSetoranList", {
        outlet_id: filterOutlet,
        status: filterStatus,
        date_start: dateStart,
        date_end: dateEnd
      });
      if (res.status === "success") {
        setList(res.data);
      } else {
        toast.error("Gagal memuat daftar setoran");
      }
    } catch (e: any) {
      toast.error(e.message || "Terjadi kesalahan");
    }
  };

  const fetchDetail = async (setoranId: string) => {
    try {
      const res = await callBackend("getSetoranDetail", { setoran_id: setoranId });
      if (res.status === "success") {
        setDetail(res.data);
        setShowAllTransactions(false);
      } else {
        toast.error(res.message || "Gagal memuat detail");
      }
    } catch (e: any) {
      toast.error(e.message || "Terjadi kesalahan");
    }
  };

  const handleApprove = async (realizationId?: string) => {
    if (!detail) return;
    const msg = realizationId 
      ? "Setujui realisasi uang ini?" 
      : "Setujui seluruh setoran ini?";
    if (!confirm(msg)) return;
    try {
      const res = await callBackend("approveSetoran", {
        setoran_id: detail.header.setoran_id,
        realization_id: typeof realizationId === "string" ? realizationId : undefined,
        admin_id: session.user_id
      });
      if (res.status === "success") {
        toast.success(res.message);
        fetchDetail(detail.header.setoran_id);
        fetchList();
      } else {
        toast.error(res.message);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const [rejectingRealizationId, setRejectingRealizationId] = useState<string | null>(null);

  const handleOpenRejectModal = (realizationId?: string) => {
    setRejectingRealizationId(typeof realizationId === "string" ? realizationId : null);
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!detail) return;
    if (!rejectReason) {
      toast.error("Alasan penolakan wajib diisi");
      return;
    }
    try {
      const res = await callBackend("rejectSetoran", {
        setoran_id: detail.header.setoran_id,
        realization_id: rejectingRealizationId,
        admin_id: session.user_id,
        catatan: rejectReason
      });
      if (res.status === "success") {
        toast.success(res.message);
        setShowRejectModal(false);
        setRejectReason("");
        setRejectingRealizationId(null);
        fetchDetail(detail.header.setoran_id);
        fetchList();
      } else {
        toast.error(res.message);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const getVarianceBadge = (variance: number) => {
    if (Math.abs(variance) < 0.01) {
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono">
          <CheckCircle className="w-3 h-3" /> MATCH (Rp 0)
        </span>
      );
    }
    if (variance < 0) {
      return (
        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono">
          <AlertCircle className="w-3 h-3" /> KURANG (-Rp {Math.abs(variance).toLocaleString("id-ID")})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono">
        LEBIH (+Rp {variance.toLocaleString("id-ID")})
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "MENUNGGU_APPROVAL":
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase">
            <Clock className="w-3 h-3 text-amber-600" /> Menunggu Approval
          </span>
        );
      case "DISETUJUI":
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase">
            <CheckCircle className="w-3 h-3 text-emerald-600" /> Disetujui
          </span>
        );
      case "DITOLAK":
        return (
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase">
            <XCircle className="w-3 h-3 text-rose-600" /> Ditolak
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 border border-gray-200 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
            {status}
          </span>
        );
    }
  };

  const getAgingBadge = (tanggal: string, createdAt?: string, isSubmitted: boolean = true) => {
    const aging = calculateSettlementAging(tanggal, createdAt || null, isSubmitted);
    if (!aging) return null;
    switch (aging.badge_variant) {
      case "success":
        return <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">{aging.status_label}</span>;
      case "warning":
        return <span className="bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">{aging.status_label}</span>;
      case "danger":
        return <span className="bg-red-50 text-red-700 border border-red-300 px-2 py-0.5 rounded text-[10px] font-bold">{aging.status_label}</span>;
      case "neutral":
      default:
        return <span className="bg-slate-50 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold">{aging.status_label}</span>;
    }
  };

  // ==========================================
  // DETAIL VIEW
  // ==========================================
  if (detail) {
    const { header = {}, summary = {}, transactions = [], realizations = [] } = detail;
    const expected = Number(summary.expected_cash ?? header.expected_cash ?? header.wajib_setor_owner ?? 0);
    const actual = Number(summary.actual_cash ?? header.actual_cash ?? 0);
    const variance = actual - expected;
    const outstanding = Math.max(0, expected - actual);

    // Split transactions into Tunai vs Non-Tunai for clarity
    const tunaiTxs = transactions.filter((t: any) => {
      const m = String(t.metode_bayar || "").toUpperCase();
      return m === "CASH" || m === "TUNAI";
    });

    const nonTunaiTxs = transactions.filter((t: any) => {
      const m = String(t.metode_bayar || "").toUpperCase();
      return m !== "CASH" && m !== "TUNAI";
    });

    const totalNonTunai = nonTunaiTxs.reduce(
      (sum: number, t: any) => sum + Number(t.total_dibayar_customer || t.grand_total || 0),
      0
    );

    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto font-sans">
        {/* Back Button */}
        <button 
          onClick={() => setDetail(null)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm font-bold transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Setoran
        </button>

        {/* 1. KEPALA SETORAN (DECISION SUMMARY) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-5">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-black text-gray-900 tracking-tight">
                  Setoran Tanggal {header.tanggal}
                </h2>
                {getStatusBadge(header.status)}
              </div>
              <p className="text-xs text-gray-500 font-mono mt-1">
                ID Setoran: <strong className="text-gray-800">{header.setoran_id}</strong> • Outlet: <strong className="text-gray-800">{summary.outlet_name || header.outlet_name}</strong>
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Admin Pencatat: <strong className="text-gray-900 font-bold">{header.admin_pembuat_name || header.admin_pembuat}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              {header.status === "MENUNGGU_APPROVAL" && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowRejectModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl transition-colors border border-red-200 cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" /> Tolak
                  </button>
                  <button 
                    onClick={() => handleApprove()}
                    className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" /> Setujui
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RINGKASAN FINANSIAL (DECISION CARDS) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">
                Wajib Setor Cash (Expected)
              </span>
              <p className="font-mono text-xl font-black text-slate-800">
                Rp {expected.toLocaleString("id-ID")}
              </p>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Total uang tunai fisik yang wajib disetor
              </span>
            </div>

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200/80">
              <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider block mb-1">
                Cash Disetor (Approved)
              </span>
              <p className="font-mono text-xl font-black text-blue-800">
                Rp {actual.toLocaleString("id-ID")}
              </p>
              <span className="text-[10px] text-blue-500 mt-0.5 block">
                Realisasi yang telah disetujui Owner
              </span>
            </div>

            <div className={`p-4 rounded-xl border ${Math.abs(variance) < 0.01 ? "bg-emerald-50 border-emerald-200" : variance < 0 ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}`}>
              <span className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-gray-600">
                Selisih Setoran
              </span>
              <p className={`font-mono text-xl font-black ${Math.abs(variance) < 0.01 ? "text-emerald-700" : variance < 0 ? "text-red-700" : "text-blue-700"}`}>
                {variance === 0 ? "Rp 0 (MATCH)" : (variance < 0 ? `-Rp ${Math.abs(variance).toLocaleString("id-ID")}` : `+Rp ${variance.toLocaleString("id-ID")}`)}
              </p>
              <span className="text-[10px] opacity-75 mt-0.5 block">
                {variance === 0 ? "Sesuai / Tidak ada selisih" : variance < 0 ? "Uang fisik kurang setor" : "Uang fisik lebih setor"}
              </span>
            </div>

            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200/80">
              <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider block mb-1">
                Outstanding (Belum Disetor)
              </span>
              <p className="font-mono text-xl font-black text-amber-800">
                Rp {outstanding.toLocaleString("id-ID")}
              </p>
              <span className="text-[10px] text-amber-600 mt-0.5 block">
                Sisa kewajiban yang belum disetujui
              </span>
            </div>
          </div>

          {header.catatan_owner && (
            <div className="p-4 bg-red-50 text-red-800 text-xs rounded-xl border border-red-200 flex items-start gap-2.5">
              <MessageSquare className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div>
                <p className="font-bold mb-0.5">Catatan Penolakan Terakhir:</p>
                <p className="leading-relaxed">{header.catatan_owner}</p>
              </div>
            </div>
          )}

          {/* 2. PEMISAHAN PEMBAYARAN: TUNAI vs NON-TUNAI */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            {/* TUNAI CARD */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-gray-800 font-bold text-sm">
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span>Pembayaran Tunai (Kewajiban Fisik)</span>
              </div>
              <div className="text-xs space-y-1.5 text-gray-600">
                <div className="flex justify-between">
                  <span>Wajib Setor Tunai:</span>
                  <strong className="font-mono text-gray-900">Rp {expected.toLocaleString("id-ID")}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Realisasi Tunai Disetor:</span>
                  <strong className="font-mono text-blue-700">Rp {actual.toLocaleString("id-ID")}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Jumlah Resi Tunai:</span>
                  <span className="font-mono">{tunaiTxs.length} Resi</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-200">
                  <span className="font-semibold">Kondisi Kas Tunai:</span>
                  {getVarianceBadge(variance)}
                </div>
              </div>
            </div>

            {/* NON-TUNAI CARD */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-800 font-bold text-sm">
                  <CreditCard className="w-4 h-4 text-purple-600" />
                  <span>Pembayaran Digital & Non-Tunai</span>
                </div>
                <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-bold">
                  Bukan Cash Fisik
                </span>
              </div>
              <div className="text-xs space-y-1.5 text-gray-600">
                <div className="flex justify-between">
                  <span>Total Non-Tunai (QRIS / Transfer / APP):</span>
                  <strong className="font-mono text-purple-800">Rp {totalNonTunai.toLocaleString("id-ID")}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Jumlah Resi Non-Tunai:</span>
                  <span className="font-mono">{nonTunaiTxs.length} Resi</span>
                </div>
                
                {/* Breakdown by Non-Tunai Method & Proof */}
                {nonTunaiTxs.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200/80 space-y-1.5">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                      Rincian Transaksi Non-Tunai & Bukti
                    </span>
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                      {nonTunaiTxs.map((nt: any) => {
                        const proofUrl = nt.bukti_transfer_url || nt.bukti_bayar_url || nt.bukti_foto_url;
                        const method = (nt.metode_bayar || nt.metode_pembayaran_ongkir || "NON-TUNAI").toUpperCase();
                        return (
                          <div key={nt.resi_id} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-gray-150 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[9px] font-mono">
                                {method}
                              </span>
                              <span className="font-mono text-gray-700">{nt.resi_id}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-gray-800">
                                Rp {Number(nt.total_dibayar_customer || nt.grand_total || 0).toLocaleString("id-ID")}
                              </span>
                              {proofUrl ? (
                                <a 
                                  href={proofUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-blue-600 hover:text-blue-800 font-bold underline inline-flex items-center gap-0.5"
                                  title="Lihat Bukti Transfer / QRIS"
                                >
                                  <Eye className="w-3 h-3" /> Bukti
                                </a>
                              ) : (
                                <span className="text-[10px] text-gray-400">Tanpa Bukti</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-gray-500 leading-relaxed pt-1 border-t border-gray-200">
                  Uang pembayaran non-tunai langsung masuk ke sistem rekening digital Owner / QRIS, bukan disetorkan fisik oleh Admin.
                </p>
              </div>
            </div>
          </div>

          {/* 3. DAFTAR REALISASI SETORAN (CASH / TRANSFER) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">
                Rincian Penyerahan Uang (Setoran Realization)
              </h3>
              <span className="text-[11px] text-gray-500 font-mono">
                {realizations.length} Penyerahan Tercatat
              </span>
            </div>

            {realizations.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-xs text-left text-gray-700 divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">
                    <tr>
                      <th className="p-3">Metode</th>
                      <th className="p-3 text-right">Nominal</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-center">Bukti</th>
                      <th className="p-3">Catatan Admin</th>
                      <th className="p-3 text-center">Aksi Otorisasi (Owner)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {realizations.map((r: any) => {
                      const isPending = r.status === "MENUNGGU_APPROVAL";
                      const isApproved = r.status === "DISETUJUI";
                      const isRejected = r.status === "DITOLAK";

                      return (
                        <tr key={r.realization_id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-semibold text-gray-900">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 font-mono">
                              {r.metode || "TUNAI"}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-blue-700">
                            Rp {Number(r.nominal || 0).toLocaleString("id-ID")}
                          </td>
                          <td className="p-3">{getStatusBadge(r.status)}</td>
                          <td className="p-3 text-center">
                            {r.bukti_url ? (
                              <a 
                                href={r.bukti_url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200 text-[10px] font-bold"
                                title="Lihat Bukti Setoran"
                              >
                                <Eye className="w-3.5 h-3.5" /> Bukti
                              </a>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="p-3 text-[11px] max-w-[200px] text-gray-600" title={r.catatan}>
                            {r.catatan || "-"}
                          </td>
                          <td className="p-3 text-center">
                            {isPending && (
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  onClick={() => handleApprove(r.realization_id)}
                                  className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-lg transition-colors border border-emerald-200 cursor-pointer"
                                  title="Setujui Realisasi Uang Ini"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" /> Approve
                                </button>
                                <button 
                                  onClick={() => handleOpenRejectModal(r.realization_id)} 
                                  className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-lg transition-colors border border-red-200 cursor-pointer" 
                                  title="Tolak Realisasi Uang Ini"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Reject
                                </button>
                              </div>
                            )}
                            {isApproved && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Selesai Disetujui
                              </span>
                            )}
                            {isRejected && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-bold">
                                <XCircle className="w-3.5 h-3.5 text-red-500" /> Ditolak
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 bg-gray-50 border border-gray-200 rounded-xl text-center text-gray-500 text-xs">
                Belum ada entri penyerahan uang (Setoran Realization) untuk setoran ini.
              </div>
            )}
          </div>

          {/* 4. AUDIT ENGINE BANNER */}
          <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900">Pemeriksaan Bukti & Transaksi (Audit Engine)</p>
                <p className="text-[11px] text-gray-500">
                  Jika ada bukti resi yang hilang, selisih YoYi, atau transfer QRIS bermasalah, periksa di Audit Engine.
                </p>
              </div>
            </div>
            <Link 
              to="/owner-audit"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 shrink-0 bg-white px-3 py-1.5 rounded-lg border border-indigo-200 shadow-2xs"
            >
              Buka Audit Engine <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {/* 5. KONTEKS TRANSAKSI RESI (COLLAPSIBLE REFERENCE) */}
          <div className="border-t border-gray-100 pt-4">
            <button
              onClick={() => setShowAllTransactions(!showAllTransactions)}
              className="flex items-center justify-between w-full text-left p-2 rounded-lg hover:bg-gray-50 text-gray-700 text-xs font-bold cursor-pointer"
            >
              <span>Daftar Transaksi Resi ({transactions.length} Resi Terinput)</span>
              <span className="flex items-center gap-1 text-gray-400 text-[11px]">
                {showAllTransactions ? "Sembunyikan" : "Tampilkan Rincian"}
                {showAllTransactions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </button>

            {showAllTransactions && (
              <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-xs text-left text-gray-700 divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">
                    <tr>
                      <th className="p-2.5">Resi</th>
                      <th className="p-2.5">Layanan</th>
                      <th className="p-2.5">Metode Bayar</th>
                      <th className="p-2.5 text-right">Dibayar Customer</th>
                      <th className="p-2.5 text-right">Cash Fisik</th>
                      <th className="p-2.5 text-right">Kas Outlet</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-sans">
                    {transactions.map((tx: any) => (
                      <tr key={tx.resi_id} className="hover:bg-gray-50/50">
                        <td className="p-2.5 font-mono font-bold">{tx.resi_id}</td>
                        <td className="p-2.5">{tx.tipe_layanan || (tx.ekspedisi === "CARGO" ? "Cargo" : "Express")}</td>
                        <td className="p-2.5 font-semibold">{tx.metode_bayar || tx.metode_pembayaran_ongkir || "CASH"}</td>
                        <td className="p-2.5 text-right font-mono text-gray-800">Rp {Number(tx.total_dibayar_customer).toLocaleString("id-ID")}</td>
                        <td className="p-2.5 text-right font-mono font-semibold text-blue-700">Rp {Number(tx.cash_payment || tx.setoran_ke_owner || 0).toLocaleString("id-ID")}</td>
                        <td className="p-2.5 text-right font-mono font-semibold text-emerald-700">Rp {Number(tx.kas_operasional || 0).toLocaleString("id-ID")}</td>
                        <td className="p-2.5"><span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold">{tx.status_resi}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Reject */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/60">
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-500" /> Tolak Realisasi / Setoran
                </h3>
                <button onClick={() => setShowRejectModal(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <label className="block text-xs font-bold text-gray-700">Alasan Penolakan (Wajib Diisi)</label>
                <textarea 
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Jelaskan alasan penolakan agar admin dapat memperbaiki (misal: bukti transfer salah, uang fisik kurang)..."
                  className="w-full border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-gray-50"
                />
                <p className="text-[10px] text-gray-500">
                  Admin outlet akan menerima catatan ini dan dapat merevisi penyerahan uang.
                </p>
              </div>
              <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50/60">
                <button 
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  onClick={handleReject}
                  disabled={loading}
                  className="px-4 py-2 text-xs font-bold bg-[#E4002B] hover:bg-red-700 text-white rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Menyimpan..." : "Kirim Penolakan"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // LIST VIEW (DECISION CENTER)
  // ==========================================
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Persetujuan Setoran</h1>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Decision Center: Verifikasi dan otorisasi setoran uang tunai harian dari Admin Outlet
          </p>
        </div>
        <button 
          onClick={fetchList}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl border border-gray-200 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#E4002B]' : ''}`} /> Segarkan Data
        </button>
      </div>

      {/* Filter Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Outlet</label>
            <select
              value={filterOutlet}
              onChange={(e) => setFilterOutlet(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            >
              <option value="ALL">Semua Outlet</option>
              {outlets.map((o) => (
                <option key={o.outlet_id} value={o.outlet_id}>
                  {o.nama_outlet}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full md:w-52 space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Status Approval</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            >
              <option value="ALL">Semua Status</option>
              <option value="MENUNGGU_APPROVAL">Menunggu Approval</option>
              <option value="DISETUJUI">Sudah Disetujui</option>
              <option value="DITOLAK">Ditolak</option>
            </select>
          </div>

          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Dari Tanggal</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input 
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>
          </div>

          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Sampai Tanggal</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input 
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>
          </div>
        </div>

        {/* Quick Date Shortcuts */}
        <div className="flex items-center gap-2 pt-1 border-t border-gray-100 text-[11px]">
          <span className="text-gray-400 font-semibold">Rentang Cepat:</span>
          <button 
            type="button"
            onClick={() => { setDateStart(getTodayWIB()); setDateEnd(getTodayWIB()); }}
            className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium cursor-pointer"
          >
            Hari Ini
          </button>
          <button 
            type="button"
            onClick={() => { setDateStart(shiftWIBDays(getTodayWIB(), -7)); setDateEnd(getTodayWIB()); }}
            className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium cursor-pointer"
          >
            7 Hari Terakhir
          </button>
          <button 
            type="button"
            onClick={() => { setDateStart(`${getTodayWIB().slice(0, 7)}-01`); setDateEnd(getTodayWIB()); }}
            className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold cursor-pointer"
          >
            Bulan Ini
          </button>
        </div>

        {/* Tabel Utama Setoran */}
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-xs text-left text-gray-700 divide-y divide-gray-200">
            <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">
              <tr>
                <th className="p-3.5">Tanggal</th>
                <th className="p-3.5">Outlet</th>
                <th className="p-3.5">Admin</th>
                <th className="p-3.5 text-right">Wajib Setor Cash</th>
                <th className="p-3.5 text-right">Sudah Disetor</th>
                <th className="p-3.5 text-center">Selisih</th>
                <th className="p-3.5 text-center">Status Approval</th>
                <th className="p-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-6">
                    <div className="space-y-3 animate-pulse">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-9 bg-gray-100 rounded-lg w-full"></div>
                      ))}
                    </div>
                  </td>
                </tr>
              ) : paginatedList.length > 0 ? (
                paginatedList.map((item) => {
                  const expectedVal = Number(item.expected_cash ?? item.wajib_setor_owner ?? 0);
                  const actualVal = Number(item.actual_cash ?? 0);
                  const varianceVal = actualVal - expectedVal;

                  return (
                    <tr key={item.setoran_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-gray-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {item.tanggal}
                          {item.status === "MENUNGGU_APPROVAL" && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Menunggu Otorisasi"></span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 font-semibold text-gray-900">
                        {item.outlet_name || item.outlet_id}
                      </td>
                      <td className="p-3.5 text-gray-700">
                        {item.admin_pembuat_name || item.admin_pembuat || "-"}
                      </td>
                      <td className="p-3.5 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                        Rp {expectedVal.toLocaleString("id-ID")}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-blue-700 whitespace-nowrap">
                        Rp {actualVal.toLocaleString("id-ID")}
                      </td>
                      <td className="p-3.5 text-center whitespace-nowrap">
                        {getVarianceBadge(varianceVal)}
                      </td>
                      <td className="p-3.5 text-center whitespace-nowrap">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <button 
                          onClick={() => fetchDetail(item.setoran_id)}
                          className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-400" /> Review
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-gray-400">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="font-semibold text-xs text-gray-600">Tidak ada setoran yang cocok dengan filter ini.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
            <span>
              Menampilkan {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, list.length)} dari {list.length} data
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 border border-gray-200 bg-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer font-bold"
              >
                Sebelumnya
              </button>
              <span className="px-2 font-mono font-bold text-gray-800">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 border border-gray-200 bg-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer font-bold"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
