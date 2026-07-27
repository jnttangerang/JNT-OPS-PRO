import React, { useState, useEffect } from "react";
import { Search, Eye, Trash2, MapPin, Package, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import useAppsScript from "../hooks/useAppsScript";
import { SessionData, Outlet } from "../types";
import { toast } from "../utils/toast";
import { highlightText } from "../utils/highlight";

interface RiwayatTransaksiPageProps {
  session: SessionData;
  outlets: Outlet[];
  activeOutletId?: string;
}

interface TransaksiItem {
  resi_id: string;
  transaksi_id: string;
  timestamp: string;
  admin: string;
  outlet: string;
  tipe: "Express" | "Cargo";
  grand_total: number;
  pengirim: string;
  penerima: string;
  status_resi: string;
}

export default function RiwayatTransaksiPage({ session, outlets, activeOutletId }: RiwayatTransaksiPageProps) {
  const { callBackend } = useAppsScript();
  const [data, setData] = useState<TransaksiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOutlet, setFilterOutlet] = useState<string>(session.role === "OWNER" ? "ALL" : (activeOutletId || session.outlet_id_home));
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    if (session.role !== "OWNER" && activeOutletId) {
      setFilterOutlet(activeOutletId);
    }
  }, [activeOutletId, session.role]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await callBackend("getRiwayatTransaksi", { filterOutlet });
      if (response.status === "success" && response.data) {
        setData(response.data);
      }
    } catch (error) {
      console.error("Error fetching riwayat:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterOutlet]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterOutlet]);

  const filteredData = data.filter(item => 
    item.resi_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.pengirim.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.penerima.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.admin.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleDelete = async (resi_id: string, tipe: string) => {
    if (window.confirm(`Apakah Anda yakin ingin membatalkan/menghapus resi ${resi_id}?`)) {
      try {
        const response = await callBackend("deleteTransaksi", { 
          resi_id, 
          user_id: session.user_id,
          outlet_id: session.outlet_id_home,
          tipe
        });
        if (response.status === "success") {
          toast.success("Transaksi berhasil dibatalkan.");
          fetchData(); // refresh data
        } else {
          toast.error("Gagal: " + response.message);
        }
      } catch (e: any) {
        toast.error("Error membatalkan transaksi: " + e.message);
      }
    }
  };

  const handleDetail = (resi_id: string) => {
    toast.info(`Menampilkan detail untuk resi: ${resi_id}`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      
      {/* HEADER & FILTER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Riwayat Transaksi</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola dan pantau seluruh resi yang tercatat di sistem.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {session.role === "OWNER" && (
            <div className="flex items-center gap-2 w-full sm:w-auto bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
              <MapPin className="h-4 w-4 text-gray-400" />
              <select
                value={filterOutlet}
                onChange={(e) => setFilterOutlet(e.target.value)}
                className="bg-transparent text-sm font-semibold text-gray-700 focus:outline-none w-full cursor-pointer"
              >
                <option value="ALL">Semua Outlet (Global)</option>
                {outlets.map((o) => (
                  <option key={o.outlet_id} value={o.outlet_id}>
                    {o.nama_outlet}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari No. Resi / Nama..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#E4002B] focus:border-[#E4002B]"
            />
          </div>
        </div>
      </div>

      {/* DATA LIST */}
      {loading ? (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl w-full"></div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {paginatedData.length > 0 ? (
            <div>
              <div className="divide-y divide-gray-100">
                {paginatedData.map((item, index) => (
                  <div key={item.resi_id} className="p-4 sm:p-5 hover:bg-gray-50/50 flex flex-col sm:flex-row justify-between gap-4 transition-colors">
                    
                    {/* KIRI: No.urut, Resi, Waktu, Admin, Outlet */}
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">
                        {(currentPage - 1) * pageSize + index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`font-bold font-mono text-base ${item.status_resi === "BATAL" ? "text-gray-400 line-through" : "text-gray-800"}`}>
                            {highlightText(item.resi_id, searchTerm)}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            item.tipe === "Express" ? "bg-red-50 text-[#E4002B] border border-red-100" : "bg-blue-50 text-blue-700 border border-blue-100"
                          }`}>
                            {item.tipe}
                          </span>
                          {item.status_resi === "BATAL" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-100">
                              BATAL
                            </span>
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-500 space-y-0.5">
                          <p><span className="font-medium text-gray-400 w-16 inline-block">Waktu</span>: {new Date(item.timestamp).toLocaleString("id-ID")}</p>
                          <p><span className="font-medium text-gray-400 w-16 inline-block">Admin</span>: <span className="font-semibold text-gray-700">{highlightText(item.admin, searchTerm)}</span></p>
                          <p><span className="font-medium text-gray-400 w-16 inline-block">Outlet</span>: {item.outlet}</p>
                          <p className="mt-1 text-gray-400">
                            {highlightText(item.pengirim, searchTerm)} ➔ {highlightText(item.penerima, searchTerm)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* KANAN: Grand Total, Aksi */}
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 pl-12 sm:pl-0 border-t border-gray-50 sm:border-0 pt-3 sm:pt-0">
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Grand Total</p>
                        <p className={`font-bold font-mono text-lg ${item.status_resi === "BATAL" ? "text-gray-400 line-through" : "text-gray-800"}`}>
                          Rp {item.grand_total.toLocaleString("id-ID")}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDetail(item.resi_id)}
                          className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-colors cursor-pointer"
                          title="Lihat Detail"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {item.status_resi !== "BATAL" && (
                          <button
                            onClick={() => handleDelete(item.resi_id, item.tipe)}
                            className="p-2 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg transition-colors cursor-pointer"
                            title="Batalkan / Hapus"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                ))}
              </div>

              {/* PAGINATION BAR */}
              {totalPages > 1 && (
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <span className="text-gray-500 font-medium">
                    Menampilkan {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredData.length)} dari {filteredData.length} transaksi
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
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <AlertCircle className="h-10 w-10 text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-600">
                {searchTerm ? "Belum ada transaksi yang sesuai pencarian." : "Belum ada transaksi hari ini."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
