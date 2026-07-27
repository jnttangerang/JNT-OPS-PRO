import React, { useState, useEffect } from "react";
import { SessionData, Outlet } from "../../types";
import useAppsScript from "../../hooks/useAppsScript";
import { toast } from "../../utils/toast";
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
  ChevronRight
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
  const [dateStart, setDateStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [dateEnd, setDateEnd] = useState(() => new Date().toISOString().split("T")[0]);
  
  const [detail, setDetail] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

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
      } else {
        toast.error(res.message || "Gagal memuat detail");
      }
    } catch (e: any) {
      toast.error(e.message || "Terjadi kesalahan");
    }
  };

  const handleApprove = async () => {
    if (!detail) return;
    if (!confirm("Setujui setoran ini?")) return;
    try {
      const res = await callBackend("approveSetoran", {
        setoran_id: detail.header.setoran_id,
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

  const handleReject = async () => {
    if (!detail) return;
    if (!rejectReason) {
      toast.error("Alasan penolakan wajib diisi");
      return;
    }
    try {
      const res = await callBackend("rejectSetoran", {
        setoran_id: detail.header.setoran_id,
        admin_id: session.user_id,
        catatan: rejectReason
      });
      if (res.status === "success") {
        toast.success(res.message);
        setShowRejectModal(false);
        setRejectReason("");
        fetchDetail(detail.header.setoran_id);
        fetchList();
      } else {
        toast.error(res.message);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "MENUNGGU_APPROVAL":
        return <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded text-[10px] font-bold">MENUNGGU APPROVAL</span>;
      case "DISETUJUI":
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded text-[10px] font-bold">DISETUJUI</span>;
      case "DITOLAK":
        return <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded text-[10px] font-bold">DITOLAK</span>;
      default:
        return <span className="bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 rounded text-[10px] font-bold">{status}</span>;
    }
  };

  if (detail) {
    const { header, summary, transactions } = detail;
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <button 
          onClick={() => setDetail(null)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Detail Setoran {header.tanggal}</h2>
              <p className="text-sm text-gray-500 font-mono mt-1">{header.setoran_id} • {summary.outlet_name}</p>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(header.status)}
              {header.status === "MENUNGGU_APPROVAL" && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowRejectModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-lg transition-colors border border-red-200"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Tolak
                  </button>
                  <button 
                    onClick={handleApprove}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-lg transition-colors border border-emerald-200"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Setujui
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Total Transaksi</p>
              <p className="font-mono text-lg font-black text-gray-800">{summary.jumlah_resi}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mb-1">Setoran Owner</p>
              <p className="font-mono text-lg font-black text-blue-800">Rp {Number(summary.total_setoran_owner).toLocaleString("id-ID")}</p>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">Kas Operasional</p>
              <p className="font-mono text-lg font-black text-emerald-800">Rp {Number(summary.total_kas_outlet).toLocaleString("id-ID")}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
              <p className="text-xs text-gray-500">
                <span className="font-bold">Dibuat:</span> {header.admin_pembuat}
              </p>
              {header.approved_by && (
                <p className="text-xs text-gray-500 mt-1">
                  <span className="font-bold">Oleh:</span> {header.approved_by}
                </p>
              )}
            </div>
          </div>
          
          {header.catatan_owner && (
            <div className="mb-6 p-4 bg-red-50 text-red-800 text-sm rounded-xl border border-red-100 flex items-start gap-2">
              <MessageSquare className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-0.5">Catatan Penolakan:</p>
                <p>{header.catatan_owner}</p>
              </div>
            </div>
          )}

          <h3 className="text-sm font-bold text-gray-800 mb-3 border-b border-gray-100 pb-2">Daftar Resi</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-xs text-left text-gray-700 divide-y divide-gray-100">
              <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                <tr>
                  <th className="p-3">Resi</th>
                  <th className="p-3">Layanan</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3 text-right">Dibayar Customer</th>
                  <th className="p-3 text-right">Setoran Owner</th>
                  <th className="p-3 text-right">Kas Outlet</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-sans">
                {transactions && transactions.length > 0 ? (
                  transactions.map((tx: any) => (
                    <tr key={tx.resi_id} className="hover:bg-gray-50/50">
                      <td className="p-3 font-mono font-bold">{tx.resi_id}</td>
                      <td className="p-3">{tx.tipe_layanan}</td>
                      <td className="p-3">{tx.transaksi_id}</td> {/* Use transaksi ID or other available info for customer context if needed, currently we don't fetch customer name directly in tx list unless joined, keeping simple */}
                      <td className="p-3 text-right font-mono text-gray-800">Rp {Number(tx.total_dibayar_customer).toLocaleString("id-ID")}</td>
                      <td className="p-3 text-right font-mono font-semibold text-blue-700">Rp {Number(tx.setoran_ke_owner).toLocaleString("id-ID")}</td>
                      <td className="p-3 text-right font-mono font-semibold text-emerald-700">Rp {Number(tx.kas_operasional).toLocaleString("id-ID")}</td>
                      <td className="p-3"><span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold">{tx.status_resi}</span></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400 italic">Tidak ada transaksi</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Reject */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-500" /> Tolak Setoran
                </h3>
                <button onClick={() => setShowRejectModal(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Alasan Penolakan</label>
                  <textarea 
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    placeholder="Masukkan alasan mengapa setoran ini ditolak..."
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-gray-50"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Transaksi akan otomatis menjadi UNLOCKED dan dapat diperbaiki oleh Kasir.</p>
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50/50">
                <button 
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={handleReject}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-bold bg-[#E4002B] hover:bg-red-700 text-white rounded-xl transition-colors disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : "Tolak Setoran"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Persetujuan Setoran</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">Kelola dan setujui setoran harian dari Kasir Outlet</p>
        </div>
        <button 
          onClick={fetchList}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-bold rounded-xl border border-gray-200 shadow-sm transition-colors disabled:opacity-50"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Segarkan
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Outlet</label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select 
                value={filterOutlet}
                onChange={(e) => setFilterOutlet(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                <option value="ALL">Semua Outlet</option>
                {outlets.map((o) => (
                  <option key={o.outlet_id} value={o.outlet_id}>{o.nama_outlet}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Status</label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                <option value="ALL">Semua Status</option>
                <option value="MENUNGGU_APPROVAL">Menunggu Persetujuan</option>
                <option value="DISETUJUI">Disetujui</option>
                <option value="DITOLAK">Ditolak</option>
              </select>
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Mulai</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Sampai</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-xs text-left text-gray-700 divide-y divide-gray-100">
            <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
              <tr>
                <th className="p-4">Tanggal</th>
                <th className="p-4">Outlet</th>
                <th className="p-4 text-center">Trx</th>
                <th className="p-4 text-right">Setoran Owner</th>
                <th className="p-4 text-right">Kas Outlet</th>
                <th className="p-4">Dibuat Oleh</th>
                <th className="p-4">Waktu Dibuat</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-6">
                    <div className="space-y-3 animate-pulse">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-10 bg-gray-100 rounded-lg w-full"></div>
                      ))}
                    </div>
                  </td>
                </tr>
              ) : paginatedList.length > 0 ? (
                paginatedList.map((item) => (
                  <tr key={item.setoran_id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 font-mono font-bold text-gray-800">{item.tanggal}</td>
                    <td className="p-4 font-semibold">{item.outlet_name}</td>
                    <td className="p-4 text-center font-mono font-bold">{item.jumlah_resi}</td>
                    <td className="p-4 text-right font-mono font-semibold text-blue-700">Rp {Number(item.total_setoran_owner).toLocaleString("id-ID")}</td>
                    <td className="p-4 text-right font-mono font-semibold text-emerald-700">Rp {Number(item.total_kas_outlet).toLocaleString("id-ID")}</td>
                    <td className="p-4 text-xs font-semibold text-gray-700">{item.admin_pembuat}</td>
                    <td className="p-4 text-[10px] text-gray-500 font-mono">{new Date(item.created_at).toLocaleString("id-ID")}</td>
                    <td className="p-4">{getStatusBadge(item.status)}</td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => fetchDetail(item.setoran_id)}
                        className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors inline-flex items-center gap-1 text-[10px] font-bold uppercase cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Detail
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-gray-400">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="font-semibold text-xs text-gray-600">Belum ada data setoran dalam periode filter ini.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-gray-500 font-medium">
              Menampilkan {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, list.length)} dari {list.length} setoran
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-gray-200 bg-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 cursor-pointer text-gray-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-extrabold text-gray-700 px-2">
                Halaman {currentPage} dari {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-gray-200 bg-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 cursor-pointer text-gray-700"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
