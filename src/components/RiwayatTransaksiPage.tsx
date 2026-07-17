import React, { useState, useEffect } from "react";
import { Search, Eye, Trash2, MapPin, Package, AlertCircle } from "lucide-react";
import useAppsScript from "../hooks/useAppsScript";
import { SessionData, Outlet } from "../types";
import { toast } from "../utils/toast";

interface RiwayatTransaksiPageProps {
  session: SessionData;
  outlets: Outlet[];
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

export default function RiwayatTransaksiPage({ session, outlets }: RiwayatTransaksiPageProps) {
  const { callBackend } = useAppsScript();
  const [data, setData] = useState<TransaksiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOutlet, setFilterOutlet] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

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

  const filteredData = data.filter(item => 
    item.resi_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.pengirim.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.penerima.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Package className="h-12 w-12 animate-pulse mb-3 text-gray-300" />
          <p className="text-sm font-medium">Memuat riwayat transaksi...</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filteredData.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {filteredData.map((item, index) => (
                <div key={item.resi_id} className="p-4 sm:p-5 hover:bg-gray-50/50 flex flex-col sm:flex-row justify-between gap-4 transition-colors">
                  
                  {/* KIRI: No.urut, Resi, Waktu, Admin, Outlet */}
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">
                      {index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`font-bold font-mono text-base ${item.status_resi === "BATAL" ? "text-gray-400 line-through" : "text-gray-800"}`}>
                          {item.resi_id}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          item.tipe === "Express" ? "bg-red-100 text-[#E4002B]" : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {item.tipe}
                        </span>
                        {item.status_resi === "BATAL" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-gray-200 text-gray-600">
                            BATAL
                          </span>
                        )}
                      </div>
                      
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <p><span className="font-medium text-gray-400 w-16 inline-block">Waktu</span>: {new Date(item.timestamp).toLocaleString("id-ID")}</p>
                        <p><span className="font-medium text-gray-400 w-16 inline-block">Admin</span>: <span className="font-semibold text-gray-700">{item.admin}</span></p>
                        <p><span className="font-medium text-gray-400 w-16 inline-block">Outlet</span>: {item.outlet}</p>
                        <p className="mt-1 text-gray-400">
                          {item.pengirim} ➔ {item.penerima}
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
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <AlertCircle className="h-10 w-10 text-gray-300 mb-2" />
              <p className="text-sm">Tidak ada transaksi yang ditemukan.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
