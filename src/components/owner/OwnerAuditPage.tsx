import React, { useState, useEffect } from "react";
import { SessionData, Outlet } from "../../types";
import useAppsScript from "../../hooks/useAppsScript";
import { toast } from "../../utils/toast";
import { highlightText } from "../../utils/highlight";
import { getTodayWIB, shiftWIBDays } from "../../utils/dateUtils";
import {
  Calendar,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  RefreshCcw,
  Search,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Shield,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Truck
} from "lucide-react";

interface OwnerAuditPageProps {
  session: SessionData;
  outlets: Outlet[];
}

export default function OwnerAuditPage({ session, outlets }: OwnerAuditPageProps) {
  const { callBackend, loading } = useAppsScript();
  
  const [filterOutlet, setFilterOutlet] = useState<string>("ALL");
  const [filterEkspedisi, setFilterEkspedisi] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterAdmin, setFilterAdmin] = useState<string>("");
  const [dateStart, setDateStart] = useState(() => getTodayWIB());
  const [dateEnd, setDateEnd] = useState(() => getTodayWIB());
  
  const [auditData, setAuditData] = useState<any>(null);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [auditNote, setAuditNote] = useState("");
  const [savingAudit, setSavingAudit] = useState(false);
  const [userRegistry, setUserRegistry] = useState<any[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await callBackend("getUsers");
        if (res?.status === "success" && Array.isArray(res.data)) {
          setUserRegistry(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch user registry", err);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchAuditData();
  }, [filterOutlet, dateStart, dateEnd]);

  const fetchAuditData = async () => {
    try {
      const res = await callBackend("getAuditData", {
        outlet_id: filterOutlet,
        date_start: dateStart,
        date_end: dateEnd
      });
      if (res.status === "success") {
        setAuditData(res.data);
      } else {
        toast.error("Gagal memuat data audit");
      }
    } catch (e: any) {
      toast.error(e.message || "Terjadi kesalahan");
    }
  };

  
  const handleSaveAudit = async (status: string) => {
    if (!selectedTx) return;
    setSavingAudit(true);
    try {
      const res = await callBackend("updateAuditDecision", {
        resi_id: selectedTx.resi_id,
        audit_status: status,
        audit_note: auditNote,
        owner_id: session.user_id
      });
      if (res.status === "success") {
        toast.success("Keputusan audit disimpan");
        
        // update local list instead of full refetch if we want, or just refetch
        await fetchAuditData();
        
        setSelectedTx(null);
        setAuditNote("");
      } else {
        toast.error(res.message || "Gagal menyimpan");
      }
    } catch (e: any) {
      toast.error(e.message || "Terjadi kesalahan");
    } finally {
      setSavingAudit(false);
    }
  };
const getStatusBadge = (status: string) => {
    switch(status) {
      case "BELUM_DIAUDIT":
        return <span className="bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 w-fit"><Shield className="w-3 h-3"/> BELUM DIAUDIT</span>;
      case "SESUAI":
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 w-fit"><ShieldCheck className="w-3 h-3"/> SESUAI</span>;
      case "SELISIH":
        return <span className="bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 w-fit"><ShieldAlert className="w-3 h-3"/> SELISIH</span>;
      case "PERLU_REVIEW":
        return <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 w-fit"><HelpCircle className="w-3 h-3"/> PERLU REVIEW</span>;
      default:
        return <span className="bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 rounded text-[10px] font-bold">{status}</span>;
    }
  };

  const getAdminFullName = (adminVal: string) => {
    if (!adminVal) return "-";
    const idStr = String(adminVal).trim();
    const lower = idStr.toLowerCase();

    const found = userRegistry.find(
      (u: any) =>
        u.user_id === idStr ||
        (u.username && u.username.toLowerCase() === lower) ||
        (u.nama_lengkap && u.nama_lengkap.toLowerCase() === lower)
    );

    if (found?.nama_lengkap) return found.nama_lengkap;
    if (found?.username) return found.username;

    if (lower === "system" || lower === "admin") {
      const sysAdmin = userRegistry.find((u: any) => u.username === "admin" || u.user_id === "USR-002");
      if (sysAdmin?.nama_lengkap) return sysAdmin.nama_lengkap;
      return "ADMIN (SYSTEM)";
    }

    return idStr;
  };

  // Filter the list dynamically in frontend for admin, status, and ekspedisi so we don't refetch
  const filteredList = auditData?.detail?.filter((tx: any) => {
    if (filterStatus !== "ALL" && tx.audit_status !== filterStatus) return false;
    if (filterEkspedisi !== "ALL") {
      const expType = String(tx.ekspedisi || tx.tipe || "").toUpperCase();
      const targetExp = filterEkspedisi.toUpperCase();
      if (targetExp === "EXPRESS" && !expType.includes("EXP") && !expType.includes("EXPRESS")) return false;
      if (targetExp === "CARGO" && !expType.includes("CRG") && !expType.includes("CARGO")) return false;
    }
    if (filterAdmin) {
      const adminName = getAdminFullName(tx.admin || tx.admin_id);
      if (adminName !== filterAdmin) return false;
    }
    return true;
  }) || [];

  // Extract unique admins from the fetched audit data mapped to nama_lengkap
  const uniqueAdmins = Array.from(new Set(
    (auditData?.detail || [])
      .map((tx: any) => getAdminFullName(tx.admin || tx.admin_id))
      .filter(Boolean)
  )).sort() as string[];

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [jumpPage, setJumpPage] = useState<string>("");

  useEffect(() => {
    setCurrentPage(1);
  }, [filterOutlet, filterStatus, filterEkspedisi, filterAdmin, dateStart, dateEnd, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
  const paginatedList = filteredList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleJumpPage = () => {
    const p = parseInt(jumpPage, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setCurrentPage(p);
      setJumpPage("");
    } else {
      toast.error(`Masukkan nomor halaman antara 1 - ${totalPages}`);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Audit Engine</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">Verifikasi integritas data keuangan outlet pasca setoran</p>
        </div>
        <button 
          onClick={fetchAuditData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-bold rounded-xl border border-gray-200 shadow-sm transition-colors disabled:opacity-50"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Segarkan Data
        </button>
      </div>

      {/* Summary Cards */}
      {auditData && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Jml Resi</p>
            <p className="font-mono text-xl font-black text-gray-800">{auditData.summary.total_transaksi}</p>
            <div className="flex gap-2 mt-1 text-[9px] text-gray-400 font-semibold">
               <span>EXP: {auditData.summary.total_express}</span>
               <span>CRG: {auditData.summary.total_cargo}</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Total Customer</p>
            <p className="font-mono text-lg font-black text-gray-800">Rp {(auditData.summary.total_customer_payment/1000).toLocaleString("id-ID")}k</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Total YOYI/JTC</p>
            <p className="font-mono text-lg font-black text-gray-800">Rp {(auditData.summary.total_yoyi/1000).toLocaleString("id-ID")}k</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm flex flex-col justify-center">
            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mb-1">Setoran Owner</p>
            <p className="font-mono text-lg font-black text-blue-800">Rp {(auditData.summary.total_setoran_owner/1000).toLocaleString("id-ID")}k</p>
          </div>
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm flex flex-col justify-center">
            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">Kas Outlet</p>
            <p className="font-mono text-lg font-black text-emerald-800">Rp {(auditData.summary.total_kas_operasional/1000).toLocaleString("id-ID")}k</p>
          </div>
          <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm flex flex-col justify-center">
            <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider mb-1">Total Selisih</p>
            <p className="font-mono text-lg font-black text-red-800">Rp {(auditData.summary.total_selisih).toLocaleString("id-ID")}</p>
          </div>
        </div>
      )}

      {/* Filters & List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          <div className="space-y-1">
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
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Ekspedisi</label>
            <div className="relative">
              <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select 
                value={filterEkspedisi}
                onChange={(e) => setFilterEkspedisi(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                <option value="ALL">Semua Ekspedisi</option>
                <option value="Express">Express</option>
                <option value="Cargo">Cargo</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Status Audit</label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                <option value="ALL">Semua Status</option>
                <option value="BELUM_DIAUDIT">Belum Diaudit</option>
                <option value="SESUAI">Sesuai</option>
                <option value="SELISIH">Selisih</option>
                <option value="PERLU_REVIEW">Perlu Review</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Cari Admin</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select 
                value={filterAdmin}
                onChange={(e) => setFilterAdmin(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                <option value="">Semua Admin</option>
                {uniqueAdmins.map((adminName, i) => (
                  <option key={i} value={adminName}>{adminName}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
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
          <div className="space-y-1">
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
                <th className="p-4">Resi / Waktu</th>
                <th className="p-4">Outlet / Admin</th>
                <th className="p-4 text-right">Customer</th>
                <th className="p-4 text-right">Setoran / Kas</th>
                <th className="p-4 text-right">Selisih</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-6">
                    <div className="space-y-3 animate-pulse">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-10 bg-gray-100 rounded-lg w-full"></div>
                      ))}
                    </div>
                  </td>
                </tr>
              ) : paginatedList.length > 0 ? (
                paginatedList.map((tx: any) => (
                  <tr key={tx.resi_id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4">
                      <p className="font-mono font-bold text-gray-800">{tx.resi_id}</p>
                      <p className="text-[10px] text-gray-500 font-mono mt-0.5">{new Date(tx.timestamp).toLocaleString("id-ID")} • {tx.tipe}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-semibold text-gray-800">{tx.outlet_name}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{getAdminFullName(tx.admin || tx.admin_id)}</p>
                    </td>
                    <td className="p-4 text-right">
                      <p className="font-mono font-bold text-gray-800">Rp {Number(tx.total_customer).toLocaleString("id-ID")}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">YOYI: Rp {Number(tx.total_yoyi).toLocaleString("id-ID")}</p>
                    </td>
                    <td className="p-4 text-right">
                      <p className="font-mono font-semibold text-blue-700">Rp {Number(tx.setoran_owner).toLocaleString("id-ID")}</p>
                      <p className="text-[10px] text-emerald-600 font-mono mt-0.5">Kas: Rp {Number(tx.kas_operasional).toLocaleString("id-ID")}</p>
                    </td>
                    <td className="p-4 text-right">
                      <p className={`font-mono font-black ${tx.selisih < 0 ? "text-red-600" : tx.selisih > 0 ? "text-emerald-600" : "text-gray-400"}`}>
                        {tx.selisih < 0 ? "-" : tx.selisih > 0 ? "+" : ""}Rp {Math.abs(tx.selisih).toLocaleString("id-ID")}
                      </p>
                    </td>
                    <td className="p-4">{getStatusBadge(tx.audit_status)}</td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => { setSelectedTx(tx); setAuditNote(tx.audit_note || ""); }}
                        className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors inline-flex items-center justify-center w-8 h-8 cursor-pointer"
                        title="Lihat Detail Audit"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-400">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="font-semibold text-xs text-gray-600">Belum ada data audit yang sesuai filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredList.length > 0 && (
          <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 text-gray-500 font-medium">
              <span>
                Menampilkan <strong className="text-gray-800 font-bold">{((currentPage - 1) * pageSize) + 1}</strong> - <strong className="text-gray-800 font-bold">{Math.min(currentPage * pageSize, filteredList.length)}</strong> dari <strong className="text-gray-800 font-bold">{filteredList.length}</strong> data audit
              </span>
              <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200">
                <label className="text-[11px] font-semibold text-gray-500">Tampilkan:</label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-[11px] text-gray-400">/ hal.</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Lompat Halaman */}
              <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-gray-200 shadow-sm">
                <span className="text-[11px] font-semibold text-gray-500">Lompat:</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={jumpPage}
                  onChange={(e) => setJumpPage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleJumpPage();
                  }}
                  placeholder={`1-${totalPages}`}
                  className="w-14 px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded text-xs font-bold text-center text-gray-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-red-500"
                />
                <button
                  type="button"
                  onClick={handleJumpPage}
                  className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold transition-colors cursor-pointer"
                >
                  Go
                </button>
              </div>

              {/* Prev / Next */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-gray-200 bg-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 cursor-pointer text-gray-700"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-extrabold text-gray-700 px-2 min-w-[90px] text-center">
                  Hal {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-gray-200 bg-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 cursor-pointer text-gray-700"
                  title="Halaman Berikutnya"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drawer Detail */}
      {selectedTx && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-50 border-l border-gray-100 flex flex-col transform transition-transform">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
               <Eye className="w-5 h-5 text-gray-500" /> Detail Transaksi
            </h3>
            <button onClick={() => setSelectedTx(null)} className="text-gray-400 hover:text-gray-700 transition-colors p-1 bg-white rounded-md shadow-sm border border-gray-200">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-white">
             {/* Header */}
             <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Nomor Resi</p>
                <p className="font-mono text-2xl font-black text-gray-900">{selectedTx.resi_id}</p>
                <div className="flex gap-2 mt-2">
                   {getStatusBadge(selectedTx.audit_status)}
                   <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold">{selectedTx.tipe}</span>
                </div>
             </div>
             
             {/* Info List */}
             <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-50">
                   <span className="text-xs text-gray-500 font-semibold">Waktu</span>
                   <span className="text-xs font-mono font-bold text-gray-800">{new Date(selectedTx.timestamp).toLocaleString("id-ID")}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                   <span className="text-xs text-gray-500 font-semibold">Outlet</span>
                   <span className="text-xs font-bold text-gray-800">{selectedTx.outlet_name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                   <span className="text-xs text-gray-500 font-semibold">Admin</span>
                   <span className="text-xs font-bold text-gray-800">{getAdminFullName(selectedTx.admin || selectedTx.admin_id)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                   <span className="text-xs text-gray-500 font-semibold">Customer / Referensi</span>
                   <span className="text-xs font-bold text-gray-800">{selectedTx.customer}</span>
                </div>
             </div>
             
             {/* Financials */}
             <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Rincian Keuangan</h4>
                
                <div className="flex justify-between items-center">
                   <span className="text-xs text-gray-600 font-semibold">Total Dibayar Customer</span>
                   <span className="text-sm font-mono font-black text-gray-900">Rp {Number(selectedTx.total_customer).toLocaleString("id-ID")}</span>
                </div>
                
                <div className="flex justify-between items-center">
                   <span className="text-xs text-gray-600 font-semibold">Total YOYI / JTC (Ongkir + Asuransi)</span>
                   <span className="text-sm font-mono font-bold text-gray-600">Rp {Number(selectedTx.total_yoyi).toLocaleString("id-ID")}</span>
                </div>
                
                <div className="pt-2 mt-2 border-t border-gray-200 border-dashed"></div>
                
                <div className="flex justify-between items-center">
                   <span className="text-xs text-blue-600 font-bold">Setoran ke Owner</span>
                   <span className="text-sm font-mono font-black text-blue-700">Rp {Number(selectedTx.setoran_owner).toLocaleString("id-ID")}</span>
                </div>
                
                <div className="flex justify-between items-center">
                   <span className="text-xs text-emerald-600 font-bold">Kas Operasional (Packing dll)</span>
                   <span className="text-sm font-mono font-black text-emerald-700">Rp {Number(selectedTx.kas_operasional).toLocaleString("id-ID")}</span>
                </div>
             </div>
             
             {/* Selisih block */}
             <div className={`rounded-xl p-4 border ${selectedTx.selisih < 0 ? "bg-red-50 border-red-100" : selectedTx.selisih > 0 ? "bg-emerald-50 border-emerald-100" : "bg-gray-50 border-gray-100"}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-gray-500">Analisis Selisih</p>
                <div className="flex justify-between items-center">
                   <span className="text-sm font-bold text-gray-800">Total Selisih</span>
                   <span className={`text-lg font-mono font-black ${selectedTx.selisih < 0 ? "text-red-600" : selectedTx.selisih > 0 ? "text-emerald-600" : "text-gray-600"}`}>
                     {selectedTx.selisih < 0 ? "-" : selectedTx.selisih > 0 ? "+" : ""}Rp {Math.abs(selectedTx.selisih).toLocaleString("id-ID")}
                   </span>
                </div>
                {selectedTx.selisih < 0 && (
                   <p className="text-[10px] text-red-600 mt-2 font-medium">⚠️ Transaksi ini menyebabkan kerugian pada setoran owner sebesar Rp {Math.abs(selectedTx.selisih).toLocaleString("id-ID")} karena uang dari customer kurang dari YOYI.</p>
                )}
             </div>
          </div>
          
          {/* Audit Actions */}
          <div className="bg-white p-5 border-t border-gray-100 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Catatan Audit (Opsional)</label>
              <textarea 
                value={auditNote}
                onChange={(e) => setAuditNote(e.target.value)}
                rows={2}
                placeholder="Tambahkan catatan khusus..."
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50"
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => handleSaveAudit("PERLU_REVIEW")}
                disabled={savingAudit}
                className="flex-1 py-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 font-bold rounded-xl text-xs transition-colors border border-yellow-200 disabled:opacity-50"
              >
                {savingAudit ? "..." : "PERLU REVIEW"}
              </button>
              <button 
                onClick={() => handleSaveAudit("SESUAI")}
                disabled={savingAudit}
                className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs transition-colors border border-emerald-200 disabled:opacity-50"
              >
                {savingAudit ? "..." : "SESUAI"}
              </button>
            </div>
          </div>
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
             <button onClick={() => setSelectedTx(null)} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors">Tutup Detail</button>
          </div>
        </div>
      )}
    </div>
  );
}
