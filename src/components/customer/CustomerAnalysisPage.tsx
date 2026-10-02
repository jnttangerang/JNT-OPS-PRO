import React, { useState, useEffect } from "react";
import { 
  Users, Search, Filter, Phone, MapPin, Building2, Calendar, Star, X, Package, 
  BarChart3, ArrowUpRight, TrendingUp, ChevronLeft, ChevronRight, RefreshCw, FileText
} from "lucide-react";
import useAppsScript from "../../hooks/useAppsScript";
import { Outlet } from "../../types";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Link } from "react-router-dom";

interface CustomerAnalysisPageProps {
  outlets?: Outlet[];
}

interface CustomerAnalysisItem {
  customer_id: string;
  nama: string;
  telepon: string;
  alamat?: string;
  total_transaksi: number;
  total_nominal: number;
  frekuensi_transaksi: string;
  first_transaction: string;
  last_transaction: string;
  sender_count: number;
  recipient_count: number;
  outlet_terakhir: string;
  daftar_transaksi_terakhir: Array<{
    tanggal: string;
    resi: string;
    outlet: string;
    peran: "PENGIRIM" | "PENERIMA";
    nominal: number;
    status: string;
  }>;
}

export default function CustomerAnalysisPage({ outlets = [] }: CustomerAnalysisPageProps) {
  const { callBackend } = useAppsScript();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    total_customers: 0,
    total_transaksi: 0,
    total_nominal: 0,
    avg_transaksi_per_customer: 0
  });
  const [customers, setCustomers] = useState<CustomerAnalysisItem[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOutlet, setFilterOutlet] = useState("");
  const [sortBy, setSortBy] = useState<"nominal" | "transaksi" | "terbaru">("nominal");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Detail Modal / Drawer
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerAnalysisItem | null>(null);

  useEffect(() => {
    loadAnalysisData();
  }, []);

  const loadAnalysisData = async () => {
    setLoading(true);
    try {
      const res = await callBackend("getCustomerAnalysis");
      if (res?.status === "success" && res.data) {
        setSummary(res.data.summary || {
          total_customers: 0,
          total_transaksi: 0,
          total_nominal: 0,
          avg_transaksi_per_customer: 0
        });
        setCustomers(res.data.customers || []);
      } else {
        // Fallback: load from getCustomersMaster if needed
        const fallbackRes = await callBackend("getCustomersMaster");
        if (fallbackRes?.status === "success" && Array.isArray(fallbackRes.data)) {
          const list: CustomerAnalysisItem[] = fallbackRes.data.map((c: any) => ({
            customer_id: c.customer_id,
            nama: c.nama,
            telepon: c.telepon,
            alamat: c.alamat,
            total_transaksi: c.total_transaksi || 0,
            total_nominal: c.total_nominal || c.total_omzet || 0,
            frekuensi_transaksi: `${c.total_transaksi || 0}x`,
            first_transaction: c.transaksi_pertama || c.customer_sejak || "",
            last_transaction: c.transaksi_terakhir || c.last_shipment || "",
            sender_count: c.total_pengirim || 0,
            recipient_count: c.total_penerima || 0,
            outlet_terakhir: c.outlet_terakhir || c.outlet_id || "OUT-001",
            daftar_transaksi_terakhir: []
          }));
          const totalNominal = list.reduce((sum, item) => sum + item.total_nominal, 0);
          const totalTrx = list.reduce((sum, item) => sum + item.total_transaksi, 0);
          setSummary({
            total_customers: list.length,
            total_transaksi: totalTrx,
            total_nominal: totalNominal,
            avg_transaksi_per_customer: list.length > 0 ? Number((totalTrx / list.length).toFixed(1)) : 0
          });
          setCustomers(list);
        }
      }
    } catch (e) {
      console.error("Gagal memuat analisa customer:", e);
    } finally {
      setLoading(false);
    }
  };

  // Filter & Sorting
  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = 
      !q ||
      c.nama.toLowerCase().includes(q) ||
      c.telepon.toLowerCase().includes(q) ||
      c.customer_id.toLowerCase().includes(q) ||
      (c.alamat && c.alamat.toLowerCase().includes(q));

    const matchOutlet = !filterOutlet || c.outlet_terakhir === filterOutlet;

    return matchSearch && matchOutlet;
  }).sort((a, b) => {
    if (sortBy === "nominal") {
      return b.total_nominal - a.total_nominal;
    }
    if (sortBy === "transaksi") {
      return b.total_transaksi - a.total_transaksi;
    }
    if (sortBy === "terbaru") {
      const dateA = a.last_transaction ? new Date(a.last_transaction).getTime() : 0;
      const dateB = b.last_transaction ? new Date(b.last_transaction).getTime() : 0;
      return dateB - dateA;
    }
    return 0;
  });

  const totalPages = Math.ceil(filteredCustomers.length / limit) || 1;
  const startIndex = (page - 1) * limit;
  const currentData = filteredCustomers.slice(startIndex, startIndex + limit);

  const getOutletName = (id: string) => {
    const found = outlets.find(o => o.outlet_id === id);
    return found ? found.nama_outlet : id;
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in relative space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="bg-red-50 p-2 rounded-xl text-[#E4002B]">
              <BarChart3 size={22} />
            </div>
            <h1 className="text-2xl font-black text-gray-800">
              Analisa Customer
            </h1>
          </div>
          <p className="text-gray-500 text-xs md:text-sm mt-1">
            Informasi agregasi riwayat transaksi pelanggan berbasis canonical Customer ID SSOT.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/customer"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Users size={15} />
            <span>Ke Data Customer</span>
          </Link>
          <button
            onClick={loadAnalysisData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors disabled:opacity-50"
            title="Muat Ulang"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>Total Pelanggan</span>
            <Users size={16} className="text-gray-400" />
          </div>
          <div className="text-2xl font-black text-gray-900 mt-2">
            {summary.total_customers.toLocaleString("id-ID")}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Canonical Customer SSOT</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>Total Transaksi</span>
            <FileText size={16} className="text-gray-400" />
          </div>
          <div className="text-2xl font-black text-gray-900 mt-2">
            {summary.total_transaksi.toLocaleString("id-ID")}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Akumulasi Pengirim & Penerima</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>Total Omzet</span>
            <TrendingUp size={16} className="text-[#E4002B]" />
          </div>
          <div className="text-xl md:text-2xl font-black text-[#E4002B] mt-2">
            Rp {(summary.total_nominal || 0).toLocaleString("id-ID")}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Nominal Transaksi Customer</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>Rata-Rata Transaksi</span>
            <BarChart3 size={16} className="text-gray-400" />
          </div>
          <div className="text-2xl font-black text-gray-900 mt-2">
            {summary.avg_transaksi_per_customer}x
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Frekuensi per Pelanggan</p>
        </div>
      </div>

      {/* Main Analysis Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Controls: Search & Filters */}
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Cari nama, no HP, atau Customer ID..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:border-[#E4002B] outline-none bg-gray-50/50"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterOutlet}
              onChange={e => {
                setFilterOutlet(e.target.value);
                setPage(1);
              }}
              className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:border-[#E4002B] outline-none bg-white font-medium text-gray-700 min-w-[130px]"
            >
              <option value="">Semua Outlet</option>
              {outlets.map(o => (
                <option key={o.outlet_id} value={o.outlet_id}>{o.nama_outlet}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={e => {
                setSortBy(e.target.value as any);
                setPage(1);
              }}
              className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:border-[#E4002B] outline-none bg-white font-medium text-gray-700 min-w-[150px]"
            >
              <option value="nominal">Nominal Tertinggi</option>
              <option value="transaksi">Transaksi Terbanyak</option>
              <option value="terbaru">Terakhir Aktif</option>
            </select>
          </div>
        </div>

        {/* Table of Customer Analysis */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-100">
                <th className="p-4 font-bold">Customer ID & Nama</th>
                <th className="p-4 font-bold">Kontak HP / WA</th>
                <th className="p-4 font-bold text-center">Frekuensi</th>
                <th className="p-4 font-bold text-center">Peran (S/R)</th>
                <th className="p-4 font-bold">Total Nominal</th>
                <th className="p-4 font-bold">Pertama Kirim</th>
                <th className="p-4 font-bold">Terakhir Kirim</th>
                <th className="p-4 font-bold">Outlet Terakhir</th>
                <th className="p-4 font-bold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400">
                    Memuat data analisa customer...
                  </td>
                </tr>
              ) : currentData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400">
                    Tidak ada data customer yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                currentData.map(c => (
                  <tr 
                    key={c.customer_id}
                    onClick={() => setSelectedCustomer(c)}
                    className="hover:bg-red-50/30 transition-colors cursor-pointer"
                  >
                    <td className="p-4">
                      <div className="font-bold text-gray-900 text-sm">{c.nama}</div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">{c.customer_id}</div>
                    </td>
                    <td className="p-4 text-gray-600 font-mono">
                      {c.telepon || "-"}
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-black text-gray-800 text-sm">{c.total_transaksi}x</span>
                    </td>
                    <td className="p-4 text-center text-gray-600">
                      <span className="text-blue-700 font-bold">{c.sender_count}</span>
                      <span className="text-gray-300 mx-1">/</span>
                      <span className="text-emerald-700 font-bold">{c.recipient_count}</span>
                    </td>
                    <td className="p-4 font-bold text-[#E4002B]">
                      Rp {(c.total_nominal || 0).toLocaleString("id-ID")}
                    </td>
                    <td className="p-4 text-gray-500">
                      {c.first_transaction ? format(new Date(c.first_transaction), "dd MMM yyyy", { locale: id }) : "-"}
                    </td>
                    <td className="p-4 text-gray-600">
                      {c.last_transaction ? format(new Date(c.last_transaction), "dd MMM yyyy", { locale: id }) : "-"}
                    </td>
                    <td className="p-4 text-gray-600">
                      {getOutletName(c.outlet_terakhir)}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCustomer(c);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-[#E4002B] hover:text-white text-gray-700 font-bold text-[11px] transition-colors inline-flex items-center gap-1"
                      >
                        Detail
                        <ArrowUpRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-white text-xs text-gray-600">
          <div className="flex items-center gap-3">
            <span>Total <span className="font-bold text-gray-800">{filteredCustomers.length}</span> pelanggan</span>
            <div className="h-4 w-px bg-gray-300"></div>
            <select
              value={limit}
              onChange={e => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="border border-gray-200 rounded px-2 py-1 outline-none focus:border-red-500 bg-white cursor-pointer"
            >
              <option value={10}>10 / halaman</option>
              <option value={25}>25 / halaman</option>
              <option value={50}>50 / halaman</option>
              <option value={100}>100 / halaman</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1 min-w-[28px] flex justify-center items-center rounded disabled:opacity-40 hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <span className="px-3 py-1 font-medium text-gray-700">
              Halaman {page} dari {totalPages}
            </span>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0}
              className="p-1 min-w-[28px] flex justify-center items-center rounded disabled:opacity-40 hover:bg-gray-200 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Customer Quick Analysis Drawer */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col">
            
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="bg-red-50 p-2 rounded-xl text-[#E4002B]">
                  <Users size={18} />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-sm">
                    {selectedCustomer.nama}
                  </h2>
                  <p className="text-xs text-gray-500 font-mono">
                    ID: {selectedCustomer.customer_id} · HP: {selectedCustomer.telepon || "-"}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setSelectedCustomer(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-gray-50/50 text-xs">
              
              {/* Aggregation Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-gray-150 shadow-sm space-y-1">
                  <span className="text-gray-400 text-[10px] font-bold uppercase block">Total Transaksi</span>
                  <span className="text-xl font-black text-gray-900">{selectedCustomer.total_transaksi}x</span>
                  <div className="text-[11px] text-gray-500 flex items-center gap-2 pt-1">
                    <span>Pengirim: <strong className="text-blue-700">{selectedCustomer.sender_count}</strong></span>
                    <span>·</span>
                    <span>Penerima: <strong className="text-emerald-700">{selectedCustomer.recipient_count}</strong></span>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-gray-150 shadow-sm space-y-1">
                  <span className="text-gray-400 text-[10px] font-bold uppercase block">Total Nominal Transaksi</span>
                  <span className="text-lg font-black text-[#E4002B]">
                    Rp {(selectedCustomer.total_nominal || 0).toLocaleString("id-ID")}
                  </span>
                  <div className="text-[11px] text-gray-500 pt-1">
                    Frekuensi: <strong>{selectedCustomer.frekuensi_transaksi}</strong>
                  </div>
                </div>
              </div>

              {/* Identity & Profile */}
              <div className="bg-white rounded-xl p-4 border border-gray-150 shadow-sm space-y-2.5">
                <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wider border-b border-gray-100 pb-2">
                  Identitas Customer
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-gray-400 block text-[10px]">Customer ID:</span>
                    <span className="font-mono font-bold text-gray-800">{selectedCustomer.customer_id}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Nomor HP:</span>
                    <span className="font-mono text-gray-800">{selectedCustomer.telepon || "-"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400 block text-[10px]">Alamat Terdaftar:</span>
                    <span className="text-gray-700">{selectedCustomer.alamat || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Timeline & Outlet */}
              <div className="bg-white rounded-xl p-4 border border-gray-150 shadow-sm space-y-2.5">
                <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wider border-b border-gray-100 pb-2">
                  Aktivitas & Outlet
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-gray-400 block text-[10px]">Transaksi Pertama:</span>
                    <span className="font-medium text-gray-800">
                      {selectedCustomer.first_transaction ? format(new Date(selectedCustomer.first_transaction), "dd MMMM yyyy", { locale: id }) : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Transaksi Terakhir:</span>
                    <span className="font-medium text-gray-800">
                      {selectedCustomer.last_transaction ? format(new Date(selectedCustomer.last_transaction), "dd MMMM yyyy", { locale: id }) : "-"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400 block text-[10px]">Outlet Terakhir:</span>
                    <span className="font-bold text-gray-800">{getOutletName(selectedCustomer.outlet_terakhir)}</span>
                  </div>
                </div>
              </div>

              {/* Recent Transactions List */}
              <div className="bg-white rounded-xl p-4 border border-gray-150 shadow-sm space-y-3">
                <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wider border-b border-gray-100 pb-2">
                  Daftar Transaksi Terakhir ({selectedCustomer.daftar_transaksi_terakhir?.length || 0})
                </h3>

                {!selectedCustomer.daftar_transaksi_terakhir || selectedCustomer.daftar_transaksi_terakhir.length === 0 ? (
                  <p className="text-gray-400 text-center py-4 text-xs">Belum ada riwayat transaksi detail.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedCustomer.daftar_transaksi_terakhir.map((tx, idx) => (
                      <div key={idx} className="p-2.5 bg-gray-50 rounded-lg border border-gray-100 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="font-mono font-bold text-gray-900">{tx.resi}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            tx.peran === "PENGIRIM" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                          }`}>
                            {tx.peran}
                          </span>
                        </div>
                        <div className="flex justify-between text-gray-500 text-[11px]">
                          <span>{tx.tanggal ? format(new Date(tx.tanggal), "dd MMM yyyy", { locale: id }) : "-"} · {getOutletName(tx.outlet)}</span>
                          <span className="font-bold text-[#E4002B]">
                            Rp {(tx.nominal || 0).toLocaleString("id-ID")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-white flex justify-end">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors"
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
