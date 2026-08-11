import React, { useState, useEffect } from "react";
import { 
  Users, Search, Filter, Phone, MapPin, Building2, Calendar, Star, X, Package, 
  BookOpen, Clock, DollarSign, Weight, ShoppingBag, ArrowUpRight, CheckCircle, BarChart3, AlertCircle
} from "lucide-react";
import useAppsScript from "../hooks/useAppsScript";
import { Outlet } from "../types";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface CustomerPageProps {
  outlets: Outlet[];
}

export default function CustomerPage({ outlets }: CustomerPageProps) {
  const { callBackend } = useAppsScript();

  // Active Main Tab: "SEMUA" | "PENGIRIM" | "PENERIMA"
  const [activeTab, setActiveTab] = useState<"SEMUA" | "PENGIRIM" | "PENERIMA">("SEMUA");

  // Data State
  const [customersMaster, setCustomersMaster] = useState<any[]>([]);
  const [bukuPengirim, setBukuPengirim] = useState<any[]>([]);
  const [bukuPenerima, setBukuPenerima] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOutlet, setFilterOutlet] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  // Detail Drawer State
  const [selectedCustId, setSelectedCustId] = useState<string | null>(null);
  const [selectedCustPhone, setSelectedCustPhone] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"ANALYTICS" | "PENGIRIM" | "PENERIMA" | "RIWAYAT">("ANALYTICS");

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [resCust, resSnd, resRcv] = await Promise.all([
        callBackend("getCustomersMaster"),
        callBackend("getBukuPengirim"),
        callBackend("getBukuPenerima")
      ]);

      if (resCust?.status === "success") setCustomersMaster(resCust.data || []);
      if (resSnd?.status === "success") setBukuPengirim(resSnd.data || []);
      if (resRcv?.status === "success") setBukuPenerima(resRcv.data || []);
    } catch (e) {
      console.error("Error loading customer data:", e);
    } finally {
      setLoading(false);
    }
  };

  const openCustomerDetail = async (custId: string, phone: string) => {
    setSelectedCustId(custId);
    setSelectedCustPhone(phone);
    setLoadingDetail(true);
    setDrawerTab("ANALYTICS");
    try {
      const res = await callBackend("getCustomerDetailFull", { customer_id: custId, telepon: phone });
      if (res?.status === "success") {
        setDetailData(res.data);
      }
    } catch (e) {
      console.error("Error loading detail:", e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeCustomerDetail = () => {
    setSelectedCustId(null);
    setSelectedCustPhone(null);
    setDetailData(null);
  };

  // Filter Helper
  const filterList = (list: any[], nameKey: string, phoneKey: string, addrKey: string, dateKey: string) => {
    return list.filter(item => {
      const q = searchQuery.toLowerCase();
      const matchSearch = 
        String(item[nameKey] || "").toLowerCase().includes(q) ||
        String(item[phoneKey] || "").toLowerCase().includes(q) ||
        String(item[addrKey] || "").toLowerCase().includes(q) ||
        String(item.customer_id || "").toLowerCase().includes(q);

      const matchOutlet = filterOutlet ? item.outlet_id === filterOutlet : true;
      const matchStatus = filterStatus ? item.status === filterStatus : true;

      const matchDate = (() => {
        if (!dateRange.start && !dateRange.end) return true;
        const dStr = item[dateKey] || item.created_at;
        if (!dStr) return false;
        const t = new Date(dStr).getTime();
        const s = dateRange.start ? new Date(dateRange.start).setHours(0,0,0,0) : 0;
        const e = dateRange.end ? new Date(dateRange.end).setHours(23,59,59,999) : Infinity;
        return t >= s && t <= e;
      })();

      return matchSearch && matchOutlet && matchStatus && matchDate;
    });
  };

  const filteredSemua = filterList(customersMaster, "nama", "telepon", "alamat", "last_shipment");
  const filteredPengirim = filterList(bukuPengirim, "nama", "telepon", "alamat", "tanggal_terakhir");
  const filteredPenerima = filterList(bukuPenerima, "nama", "telepon", "alamat", "tanggal_terakhir");

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in relative">
      
      {/* Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2.5">
            <div className="bg-red-50 p-2 rounded-xl text-[#E4002B]">
              <Users size={22} />
            </div>
            Customer Master & Address Book
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Pusat data pelanggan, buku alamat pengirim & penerima otomatis terstruktur dari aktivitas transaksi.
          </p>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-100 bg-gray-50/50 p-1.5 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab("SEMUA")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === "SEMUA" 
                ? "bg-white text-[#E4002B] shadow-sm border border-gray-150" 
                : "text-gray-500 hover:text-gray-800 hover:bg-white/50"
            }`}
          >
            <Users size={15} />
            <span>Semua Customer ({customersMaster.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("PENGIRIM")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === "PENGIRIM" 
                ? "bg-white text-[#E4002B] shadow-sm border border-gray-150" 
                : "text-gray-500 hover:text-gray-800 hover:bg-white/50"
            }`}
          >
            <BookOpen size={15} />
            <span>Buku Pengirim ({bukuPengirim.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("PENERIMA")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === "PENERIMA" 
                ? "bg-white text-[#E4002B] shadow-sm border border-gray-150" 
                : "text-gray-500 hover:text-gray-800 hover:bg-white/50"
            }`}
          >
            <BookOpen size={15} />
            <span>Buku Penerima ({bukuPenerima.length})</span>
          </button>
        </div>

        {/* Filter Controls */}
        <div className="p-4 border-b border-gray-100 bg-white flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Cari nama, no HP, ID customer, atau alamat..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:border-[#E4002B] outline-none bg-gray-50/50"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select 
              value={filterOutlet} 
              onChange={e => setFilterOutlet(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:border-[#E4002B] outline-none bg-white font-medium text-gray-700 min-w-[130px]"
            >
              <option value="">Semua Outlet</option>
              {outlets.map(o => <option key={o.outlet_id} value={o.outlet_id}>{o.nama_outlet}</option>)}
            </select>

            <select 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:border-[#E4002B] outline-none bg-white font-medium text-gray-700 min-w-[120px]"
            >
              <option value="">Semua Status</option>
              <option value="AKTIF">AKTIF</option>
              <option value="NON-AKTIF">NON-AKTIF</option>
            </select>

            <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-2 bg-white text-xs">
              <input 
                type="date"
                value={dateRange.start}
                onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="outline-none bg-transparent py-1.5 px-1 text-gray-700"
              />
              <span className="text-gray-400">-</span>
              <input 
                type="date"
                value={dateRange.end}
                onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="outline-none bg-transparent py-1.5 px-1 text-gray-700"
              />
            </div>
          </div>
        </div>

        {/* Tab 1: SEMUA CUSTOMER */}
        {activeTab === "SEMUA" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-100">
                  <th className="p-4 font-bold">Customer ID & Nama</th>
                  <th className="p-4 font-bold">Telepon / WhatsApp</th>
                  <th className="p-4 font-bold">Customer Sejak</th>
                  <th className="p-4 font-bold">Total Resi / Paket</th>
                  <th className="p-4 font-bold">Total Omzet</th>
                  <th className="p-4 font-bold">Terakhir Kirim</th>
                  <th className="p-4 font-bold">Maps Review</th>
                  <th className="p-4 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400">
                      Memuat data customer master...
                    </td>
                  </tr>
                ) : filteredSemua.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400">
                      Tidak ada data customer yang cocok.
                    </td>
                  </tr>
                ) : (
                  filteredSemua.map((c, i) => (
                    <tr 
                      key={c.customer_id || i} 
                      onClick={() => openCustomerDetail(c.customer_id, c.telepon)}
                      className="hover:bg-red-50/40 cursor-pointer transition-colors"
                    >
                      <td className="p-4">
                        <div className="font-bold text-gray-800 text-sm">{c.nama}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">{c.customer_id}</div>
                      </td>
                      <td className="p-4 text-gray-600 font-mono">{c.telepon}</td>
                      <td className="p-4 text-gray-500">
                        {c.customer_sejak ? format(new Date(c.customer_sejak), "dd MMM yyyy", { locale: id }) : "-"}
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-gray-800">{c.total_resi} resi</span>
                        <span className="text-gray-400 text-[10px] block">({c.total_paket} paket)</span>
                      </td>
                      <td className="p-4 font-bold text-[#E4002B]">
                        Rp {(c.total_omzet || 0).toLocaleString("id-ID")}
                      </td>
                      <td className="p-4 text-gray-600">
                        {c.last_shipment ? format(new Date(c.last_shipment), "dd MMM yyyy", { locale: id }) : "-"}
                      </td>
                      <td className="p-4">
                        {c.maps_review_status === "Contributor" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
                            <Star size={10} className="fill-yellow-500 text-yellow-500" />
                            Contributor
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            Belum Review
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          c.status === "AKTIF" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                        }`}>
                          {c.status || "AKTIF"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: BUKU PENGIRIM */}
        {activeTab === "PENGIRIM" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-100">
                  <th className="p-4 font-bold">ID & Nama Pengirim</th>
                  <th className="p-4 font-bold">Telepon</th>
                  <th className="p-4 font-bold">Alamat Pengirim</th>
                  <th className="p-4 font-bold">Jumlah Pengiriman</th>
                  <th className="p-4 font-bold">Pertama Kirim</th>
                  <th className="p-4 font-bold">Terakhir Kirim</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">
                      Memuat data buku pengirim...
                    </td>
                  </tr>
                ) : filteredPengirim.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">
                      Tidak ada data pengirim yang cocok.
                    </td>
                  </tr>
                ) : (
                  filteredPengirim.map((p, i) => (
                    <tr 
                      key={p.id || i}
                      onClick={() => openCustomerDetail(p.customer_id, p.telepon)}
                      className="hover:bg-red-50/40 cursor-pointer transition-colors"
                    >
                      <td className="p-4">
                        <div className="font-bold text-gray-800 text-sm">{p.nama}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">{p.id}</div>
                      </td>
                      <td className="p-4 text-gray-600 font-mono">{p.telepon}</td>
                      <td className="p-4 text-gray-700 max-w-xs truncate">{p.alamat}</td>
                      <td className="p-4 font-bold text-gray-800">
                        {p.jumlah_pengiriman || 1}x Pengiriman
                      </td>
                      <td className="p-4 text-gray-500">
                        {p.tanggal_pertama ? format(new Date(p.tanggal_pertama), "dd MMM yyyy", { locale: id }) : "-"}
                      </td>
                      <td className="p-4 text-gray-600">
                        {p.tanggal_terakhir ? format(new Date(p.tanggal_terakhir), "dd MMM yyyy", { locale: id }) : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: BUKU PENERIMA */}
        {activeTab === "PENERIMA" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-100">
                  <th className="p-4 font-bold">ID & Nama Penerima</th>
                  <th className="p-4 font-bold">Telepon</th>
                  <th className="p-4 font-bold">Alamat Penerima</th>
                  <th className="p-4 font-bold">Jumlah Diterima</th>
                  <th className="p-4 font-bold">Pertama Terima</th>
                  <th className="p-4 font-bold">Terakhir Terima</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">
                      Memuat data buku penerima...
                    </td>
                  </tr>
                ) : filteredPenerima.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">
                      Tidak ada data penerima yang cocok.
                    </td>
                  </tr>
                ) : (
                  filteredPenerima.map((r, i) => (
                    <tr 
                      key={r.id || i}
                      onClick={() => openCustomerDetail(r.customer_id, r.telepon)}
                      className="hover:bg-red-50/40 cursor-pointer transition-colors"
                    >
                      <td className="p-4">
                        <div className="font-bold text-gray-800 text-sm">{r.nama}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">{r.id}</div>
                      </td>
                      <td className="p-4 text-gray-600 font-mono">{r.telepon}</td>
                      <td className="p-4 text-gray-700 max-w-xs truncate">{r.alamat}</td>
                      <td className="p-4 font-bold text-gray-800">
                        {r.jumlah_diterima || 1}x Diterima
                      </td>
                      <td className="p-4 text-gray-500">
                        {r.tanggal_pertama ? format(new Date(r.tanggal_pertama), "dd MMM yyyy", { locale: id }) : "-"}
                      </td>
                      <td className="p-4 text-gray-600">
                        {r.tanggal_terakhir ? format(new Date(r.tanggal_terakhir), "dd MMM yyyy", { locale: id }) : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Customer Detail Drawer */}
      {selectedCustId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col">
            
            {/* Drawer Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="bg-red-50 p-2 rounded-xl text-[#E4002B]">
                  <Users size={18} />
                </div>
                <div>
                  <h2 className="font-bold text-gray-800 text-sm">
                    {detailData?.customer?.nama || "Detail Customer"}
                  </h2>
                  <p className="text-xs text-gray-500 font-mono">
                    ID: {selectedCustId} | Telepon: {selectedCustPhone}
                  </p>
                </div>
              </div>

              <button 
                onClick={closeCustomerDetail}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Navigation Tabs */}
            <div className="flex border-b border-gray-100 bg-white px-4 pt-2 gap-2 text-xs font-bold">
              <button
                onClick={() => setDrawerTab("ANALYTICS")}
                className={`pb-2 px-3 border-b-2 transition-all ${
                  drawerTab === "ANALYTICS"
                    ? "border-[#E4002B] text-[#E4002B]"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                Ringkasan & Analitik
              </button>
              <button
                onClick={() => setDrawerTab("RIWAYAT")}
                className={`pb-2 px-3 border-b-2 transition-all ${
                  drawerTab === "RIWAYAT"
                    ? "border-[#E4002B] text-[#E4002B]"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                Riwayat Pengiriman ({detailData?.riwayat_pengiriman?.length || 0})
              </button>
              <button
                onClick={() => setDrawerTab("PENGIRIM")}
                className={`pb-2 px-3 border-b-2 transition-all ${
                  drawerTab === "PENGIRIM"
                    ? "border-[#E4002B] text-[#E4002B]"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                Alamat Pengirim ({detailData?.pengirim_addresses?.length || 0})
              </button>
              <button
                onClick={() => setDrawerTab("PENERIMA")}
                className={`pb-2 px-3 border-b-2 transition-all ${
                  drawerTab === "PENERIMA"
                    ? "border-[#E4002B] text-[#E4002B]"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                Alamat Penerima ({detailData?.penerima_addresses?.length || 0})
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-gray-50/50">
              {loadingDetail ? (
                <div className="text-center py-20 text-gray-400 text-xs">Memuat detail customer...</div>
              ) : !detailData ? (
                <div className="text-center py-20 text-gray-400 text-xs">Data detail tidak ditemukan.</div>
              ) : (
                <>
                  {/* TAB 1: ANALYTICS & SUMMARY */}
                  {drawerTab === "ANALYTICS" && (
                    <div className="space-y-5">
                      
                      {/* Summary Cards Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white p-3 rounded-xl border border-gray-150 shadow-sm">
                          <p className="text-[10px] text-gray-400 font-bold uppercase">Total Resi</p>
                          <p className="text-lg font-black text-gray-800 mt-1">{detailData.summary?.total_resi || 0}</p>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-150 shadow-sm">
                          <p className="text-[10px] text-gray-400 font-bold uppercase">Total Paket</p>
                          <p className="text-lg font-black text-gray-800 mt-1">{detailData.summary?.total_paket || 0}</p>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-150 shadow-sm">
                          <p className="text-[10px] text-gray-400 font-bold uppercase">Total Ongkir</p>
                          <p className="text-base font-black text-[#E4002B] mt-1">
                            Rp {(detailData.summary?.total_ongkir || 0).toLocaleString("id-ID")}
                          </p>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-150 shadow-sm">
                          <p className="text-[10px] text-gray-400 font-bold uppercase">Total Omzet</p>
                          <p className="text-base font-black text-[#E4002B] mt-1">
                            Rp {(detailData.summary?.total_omzet || 0).toLocaleString("id-ID")}
                          </p>
                        </div>
                      </div>

                      {/* Customer Info Card */}
                      <div className="bg-white rounded-xl p-4 border border-gray-150 shadow-sm space-y-3">
                        <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-2">
                          Informasi Profil
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-600">
                          <div>
                            <span className="text-gray-400 block">Customer Sejak:</span>
                            <span className="font-bold text-gray-800">
                              {detailData.summary?.customer_sejak ? format(new Date(detailData.summary.customer_sejak), "dd MMMM yyyy", { locale: id }) : "-"}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 block">Terakhir Pengiriman:</span>
                            <span className="font-bold text-gray-800">
                              {detailData.summary?.last_shipment ? format(new Date(detailData.summary.last_shipment), "dd MMMM yyyy", { locale: id }) : "-"}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 block">Maps Review Status:</span>
                            <span className="font-bold text-yellow-700">
                              {detailData.summary?.maps_review_status}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 block">Status Akun:</span>
                            <span className="font-bold text-green-700">
                              {detailData.customer?.status || "AKTIF"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Customer Behavior Analytics */}
                      <div className="bg-white rounded-xl p-4 border border-gray-150 shadow-sm space-y-4">
                        <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-100 pb-2">
                          <BarChart3 size={14} className="text-[#E4002B]" />
                          Customer Behavior Analytics
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                            <span className="text-gray-400 text-[10px] font-bold uppercase block">Layanan Favorit</span>
                            <span className="font-bold text-gray-800 text-sm">{detailData.analytics?.layanan_favorit}</span>
                          </div>

                          <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                            <span className="text-gray-400 text-[10px] font-bold uppercase block">Berat Rata-Rata</span>
                            <span className="font-bold text-gray-800 text-sm">{detailData.analytics?.berat_rata_rata} kg</span>
                          </div>

                          <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                            <span className="text-gray-400 text-[10px] font-bold uppercase block">Barang Paling Sering</span>
                            <span className="font-bold text-gray-800 text-sm">{detailData.analytics?.barang_paling_sering}</span>
                          </div>

                          <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                            <span className="text-gray-400 text-[10px] font-bold uppercase block">Kota Tujuan Terbanyak</span>
                            <span className="font-bold text-gray-800 text-sm">{detailData.analytics?.kota_tujuan_terbanyak}</span>
                          </div>

                          <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                            <span className="text-gray-400 text-[10px] font-bold uppercase block">Hari Pengiriman Terbanyak</span>
                            <span className="font-bold text-gray-800 text-sm">{detailData.analytics?.hari_pengiriman_terbanyak}</span>
                          </div>

                          <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                            <span className="text-gray-400 text-[10px] font-bold uppercase block">Jam Pengiriman Terbanyak</span>
                            <span className="font-bold text-gray-800 text-sm">{detailData.analytics?.jam_pengiriman_terbanyak}</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* TAB 2: RIWAYAT PENGERIMAN */}
                  {drawerTab === "RIWAYAT" && (
                    <div className="space-y-3">
                      <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider">
                        Daftar Transaksi Real
                      </h4>
                      {detailData.riwayat_pengiriman?.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 text-xs bg-white rounded-xl border border-dashed border-gray-200">
                          Belum ada riwayat transaksi.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {detailData.riwayat_pengiriman.map((item: any, idx: number) => (
                            <div key={idx} className="bg-white border border-gray-150 rounded-xl p-3.5 shadow-sm text-xs space-y-2">
                              <div className="flex justify-between items-start border-b border-gray-100 pb-2">
                                <div>
                                  <span className="font-bold text-gray-800">
                                    {format(new Date(item.tanggal), "dd MMM yyyy HH:mm", { locale: id })}
                                  </span>
                                  <span className="text-gray-400 block font-mono text-[10px]">
                                    Admin: {item.admin}
                                  </span>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  item.status === "SELESAI" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                                }`}>
                                  {item.status}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-gray-600">
                                <div>
                                  <span className="text-gray-400 block text-[10px]">No Resi / Layanan:</span>
                                  <span className="font-bold text-gray-800">{item.no_resi} ({item.layanan} - {item.jenis_produk})</span>
                                </div>
                                <div>
                                  <span className="text-gray-400 block text-[10px]">Nama Barang:</span>
                                  <span className="font-bold text-gray-800">{item.nama_barang}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400 block text-[10px]">Timbangan / Penagihan (Dasar):</span>
                                  <span>{item.berat_timbangan || 0} kg / {item.berat_penagihan || 0} kg ({item.dasar_berat || "TIMBANGAN"}) | Vol: {item.volume}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400 block text-[10px]">Total Bayar:</span>
                                  <span className="font-bold text-[#E4002B]">Rp {(item.total_bayar || 0).toLocaleString("id-ID")}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: BUKU ALAMAT PENGIRIM */}
                  {drawerTab === "PENGIRIM" && (
                    <div className="space-y-3">
                      <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider">
                        Daftar Alamat Pengirim ({detailData.pengirim_addresses?.length || 0})
                      </h4>
                      {detailData.pengirim_addresses?.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 text-xs bg-white rounded-xl border border-dashed border-gray-200">
                          Tidak ada alamat pengirim tersimpan.
                        </div>
                      ) : (
                        detailData.pengirim_addresses.map((snd: any, idx: number) => (
                          <div key={idx} className="bg-white border border-gray-150 rounded-xl p-3.5 shadow-sm text-xs space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-gray-800">{snd.nama}</span>
                              <span className="bg-red-50 text-[#E4002B] text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {snd.jumlah_pengiriman || 1}x Pengiriman
                              </span>
                            </div>
                            <p className="text-gray-600 font-mono text-[11px]">{snd.telepon}</p>
                            <p className="text-gray-700">{snd.alamat}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 4: BUKU ALAMAT PENERIMA */}
                  {drawerTab === "PENERIMA" && (
                    <div className="space-y-3">
                      <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider">
                        Daftar Alamat Penerima ({detailData.penerima_addresses?.length || 0})
                      </h4>
                      {detailData.penerima_addresses?.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 text-xs bg-white rounded-xl border border-dashed border-gray-200">
                          Tidak ada alamat penerima tersimpan.
                        </div>
                      ) : (
                        detailData.penerima_addresses.map((rcv: any, idx: number) => (
                          <div key={idx} className="bg-white border border-gray-150 rounded-xl p-3.5 shadow-sm text-xs space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-gray-800">{rcv.nama}</span>
                              <span className="bg-red-50 text-[#E4002B] text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {rcv.jumlah_diterima || 1}x Diterima
                              </span>
                            </div>
                            <p className="text-gray-600 font-mono text-[11px]">{rcv.telepon}</p>
                            <p className="text-gray-700">{rcv.alamat}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                </>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
