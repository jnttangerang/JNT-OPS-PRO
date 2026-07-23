import React, { useState, useEffect } from "react";
import { 
  Lock, TrendingUp, DollarSign, Wallet, RefreshCw, Calendar, 
  MapPin, Database, ListCollapse, Search, Eye, ExternalLink, HelpCircle, Download, Target
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import useAppsScript from "../hooks/useAppsScript";
import { SessionData, Outlet, DashboardData, AuditLog } from "../types";

interface DashboardPageProps {
  session: SessionData;
  outlets: Outlet[];
  onNavigate?: (view: string) => void;
}

export default function DashboardPage({ session, outlets, onNavigate }: DashboardPageProps) {
  const { callBackend, loading } = useAppsScript();

  // Role Protection
  const isOwner = session.role === "OWNER";

  // Filter States
  const [selectedOutletFilter, setSelectedOutletFilter] = useState(outlets.length > 0 ? outlets[0].outlet_id : "");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 15); // Default 15 days back
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Dashboard Data State
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Audit Log search query
  const [auditSearch, setAuditSearch] = useState("");

  const loadDashboardMetrics = async () => {
    if (!isOwner) return;
    setLoadingDashboard(true);
    setSeedSuccess(null);
    try {
      const response = await callBackend("getDashboardData", {
        user_id: session.user_id,
        role: session.role,
        filterOutlet: selectedOutletFilter,
        dateStart: startDate,
        dateEnd: endDate
      });
      if (response.status === "success" && response.data) {
        setDashboardData(response.data);
      }
    } catch (e) {
      console.error("Failed to load dashboard data", e);
    } finally {
      setLoadingDashboard(false);
    }
  };

  useEffect(() => {
    loadDashboardMetrics();
  }, [selectedOutletFilter, startDate, endDate]);

  // Seed database utility
  const handleSeedDatabase = async () => {
    setSeeding(true);
    setSeedSuccess(null);
    try {
      const response = await callBackend("initDatabaseSheets");
      if (response.status === "success") {
        setSeedSuccess("Berhasil menyemai (seed) data database! Seluruh tabel J&T default kini siap digunakan.");
        loadDashboardMetrics();
      } else {
        setSeedSuccess("Error: " + response.message);
      }
    } catch (err: any) {
      setSeedSuccess("Error penyemaian: " + err.message);
    } finally {
      setSeeding(false);
    }
  };

  const handleDownloadMonthlyCSV = () => {
    if (!dashboardData?.monthly_reports) return;
    
    const rows = [
      ["Bulan", "Outlet", "Omset (Rp)", "Jumlah Transaksi"]
    ];
    
    dashboardData.monthly_reports.forEach(report => {
      report.outlets.forEach(outlet => {
        rows.push([
          report.month,
          outlet.nama_outlet,
          outlet.omset.toString(),
          outlet.transaksi.toString()
        ]);
      });
    });
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Omset_Bulanan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Guard access
  if (!isOwner) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="mx-auto bg-amber-50 text-amber-600 rounded-full h-16 w-16 flex items-center justify-center mb-4 border border-amber-100">
          <Lock className="h-8 w-8 stroke-[2.5]" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">Akses Terbatas (OWNER Only)</h2>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          Maaf, halaman ini berisi laporan finansial rahasia, audit log, dan analisis omset harian. Halaman ini hanya dapat diakses oleh akun <code className="bg-gray-100 px-1 font-mono text-amber-700">OWNER</code>.
        </p>
        <button
          onClick={() => onNavigate && onNavigate("pre-input")}
          className="mt-6 py-2.5 px-6 bg-[#E4002B] hover:bg-[#c20023] font-bold text-white text-xs rounded-xl shadow-md transition-all duration-150"
        >
          Kembali ke Modul Input Paket
        </button>
      </div>
    );
  }

  // Define colors for Pie chart
  const PIE_COLORS = ["#E4002B", "#3B82F6", "#10B981", "#F59E0B"];

  // Filter audit logs based on search text
  const filteredAuditLogs = dashboardData?.audit_logs?.filter((log: AuditLog) => {
    const keyword = auditSearch.toLowerCase();
    return (
      log.aksi.toLowerCase().includes(keyword) ||
      log.user_id.toLowerCase().includes(keyword) ||
      (log.detail && log.detail.toLowerCase().includes(keyword))
    );
  }) || [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

      {/* HEADER SECTION */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="bg-red-50 text-[#E4002B] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest font-mono">
              OWNER INTELLIGENCE BOARD
            </span>
            <h1 className="text-2xl font-bold text-gray-800 font-sans mt-2">
              Dashboard Analisis Finansial
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Pantau total omset outlet, verifikasi setoran outlet, audit log aktivitas admin, dan Synced database.
            </p>
          </div>

          {/* Quick Database Seeder */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSeedDatabase}
              disabled={seeding}
              className="py-2 px-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5 cursor-pointer transition duration-150"
            >
              <Database className={`h-4 w-4 ${seeding ? "animate-spin text-amber-400" : ""}`} />
              <span>{seeding ? "Loading..." : "Synced Database"}</span>
            </button>
            
            <button
              onClick={loadDashboardMetrics}
              disabled={loadingDashboard}
              className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition duration-150 cursor-pointer"
              title="Refresh Dashboard"
            >
              <RefreshCw className={`h-4 w-4 ${loadingDashboard ? "animate-spin text-[#E4002B]" : ""}`} />
            </button>
          </div>
        </div>

        {seedSuccess && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-xs font-mono">
            {seedSuccess}
          </div>
        )}
      </div>

      {/* 2. FILTERS PANEL */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Filter Outlet */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            Filter Outlet
          </label>
          <div className="relative">
            <div className="absolute left-3 inset-y-0 flex items-center pointer-events-none text-gray-400">
              <MapPin className="h-4 w-4" />
            </div>
            <select
              value={selectedOutletFilter}
              onChange={(e) => setSelectedOutletFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
            >
              {outlets.map((o) => (
                <option key={o.outlet_id} value={o.outlet_id}>
                  {o.nama_outlet}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Start Date */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            Tanggal Awal
          </label>
          <div className="relative">
            <div className="absolute left-3 inset-y-0 flex items-center pointer-events-none text-gray-400">
              <Calendar className="h-4 w-4" />
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
            />
          </div>
        </div>

        {/* End Date */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            Tanggal Akhir
          </label>
          <div className="relative">
            <div className="absolute left-3 inset-y-0 flex items-center pointer-events-none text-gray-400">
              <Calendar className="h-4 w-4" />
            </div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
            />
          </div>
        </div>

      </div>

      {/* 3. CORE METRICS GRIDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        
        {/* Omset Card */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden">
          <div className="bg-red-50 text-[#E4002B] p-3.5 rounded-2xl border border-red-100/50">
            <TrendingUp className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block font-mono">
              Total Transaksi
            </span>
            <p className="text-xl font-extrabold text-gray-800 font-mono mt-0.5">
              Rp {dashboardData?.summary?.total_omset?.toLocaleString("id-ID") || "0"}
            </p>
            <span className="text-[10px] text-gray-400 block mt-0.5">
              {dashboardData?.summary?.total_transaksi || 0} resi terinput
            </span>
          </div>
          <div className="absolute -right-2 -bottom-2 opacity-[0.03] text-red-700">
            <TrendingUp className="h-24 w-24" />
          </div>
        </div>

        {/* Setoran Card */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden">
          <div className="bg-blue-50 text-blue-600 p-3.5 rounded-2xl border border-blue-100/50">
            <DollarSign className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block font-mono">
              Setoran Outlet Wajib (Owner)
            </span>
            <p className="text-xl font-extrabold text-blue-800 font-mono mt-0.5">
              Rp {dashboardData?.summary?.total_setoran_owner?.toLocaleString("id-ID") || "0"}
            </p>
            <span className="text-[10px] text-blue-500 block mt-0.5">
              Wajib diserahkan harian
            </span>
          </div>
          <div className="absolute -right-2 -bottom-2 opacity-[0.03] text-blue-700">
            <DollarSign className="h-24 w-24" />
          </div>
        </div>

        {/* Kas Card */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden">
          <div className="bg-green-50 text-green-600 p-3.5 rounded-2xl border border-green-100/50">
            <Wallet className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block font-mono">
              Kas Operasional (Outlet)
            </span>
            <p className="text-xl font-extrabold text-green-800 font-mono mt-0.5">
              Rp {dashboardData?.summary?.total_kas_operasional?.toLocaleString("id-ID") || "0"}
            </p>
            <span className="text-[10px] text-green-500 block mt-0.5">
              Amplop & packing di outlet
            </span>
          </div>
          <div className="absolute -right-2 -bottom-2 opacity-[0.03] text-green-700">
            <Wallet className="h-24 w-24" />
          </div>
        </div>

      </div>

      {/* DAILY TARGET PROGRESS */}
      {dashboardData?.target_harian && (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Target className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">Target Harian (Hari Ini)</h3>
            </div>
            <span className="text-xs font-semibold text-gray-500">
              {dashboardData.target_harian.current} / {dashboardData.target_harian.target} Transaksi
            </span>
          </div>
          
          <div className="w-full bg-gray-100 rounded-full h-3.5 mb-1.5 overflow-hidden border border-gray-200">
            <div 
              className={`h-3.5 rounded-full transition-all duration-700 ease-out ${
                (dashboardData.target_harian.current / dashboardData.target_harian.target) >= 1 
                  ? "bg-emerald-500" 
                  : "bg-indigo-500"
              }`}
              style={{ 
                width: `${Math.min(100, Math.max(0, (dashboardData.target_harian.current / dashboardData.target_harian.target) * 100))}%` 
              }}
            ></div>
          </div>
          <div className="flex justify-between text-[10px] font-mono text-gray-400">
            <span>0%</span>
            <span>
              {Math.round((dashboardData.target_harian.current / dashboardData.target_harian.target) * 100)}% Tercapai
            </span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* 4. ANALYTICAL CHARTS SECTION (GRID) */}
      {dashboardData && dashboardData.chart_data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Daily Trend Chart (2/3 size) */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 md:col-span-2 space-y-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Tren Omset Harian (Express vs Cargo)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dashboardData.chart_data.daily_trends || []}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Express" name="J&T Express" fill="#E4002B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Cargo" name="J&T Cargo" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Payment Methods Ratio (1/3 size) */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4 flex flex-col justify-between">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Breakdown Metode Pembayaran
            </h3>
            
            <div className="h-44 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dashboardData.chart_data.payment_shares || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {(dashboardData.chart_data.payment_shares || []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Pie Legend list */}
            <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-600">
              {(dashboardData.chart_data.payment_shares || []).map((item: any, idx: number) => (
                <div key={item.name} className="flex items-center gap-1.5 truncate">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                  <span className="font-semibold truncate">{item.name}:</span>
                  <span className="font-mono text-gray-800">Rp {item.value.toLocaleString("id-ID")}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* 5. LAPORAN BULANAN (MONTHLY REPORTS) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            <h3 className="font-bold text-gray-800 text-sm">Rekapan Laporan Bulanan per Outlet</h3>
          </div>
          
          <button
            onClick={handleDownloadMonthlyCSV}
            disabled={!dashboardData?.monthly_reports || dashboardData.monthly_reports.length === 0}
            className="py-1.5 px-4 bg-blue-50 hover:bg-blue-100 disabled:bg-gray-100 disabled:text-gray-400 text-blue-700 font-bold text-xs rounded-lg flex items-center gap-2 transition-colors border border-blue-200"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Unduh Laporan (CSV)</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-xs text-left text-gray-700 divide-y divide-gray-100">
            <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
              <tr>
                <th className="p-3">Bulan</th>
                <th className="p-3">Outlet</th>
                <th className="p-3 text-right">Jumlah Transaksi</th>
                <th className="p-3 text-right">Total Omset (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-sans">
              {dashboardData?.monthly_reports && dashboardData.monthly_reports.length > 0 ? (
                dashboardData.monthly_reports.map((report) => (
                  <React.Fragment key={report.month}>
                    {report.outlets.map((outlet, idx) => (
                      <tr key={`${report.month}-${outlet.outlet_id}`} className="hover:bg-gray-50/50">
                        {idx === 0 && (
                          <td className="p-3 font-bold text-gray-800 align-top" rowSpan={report.outlets.length}>
                            {new Date(report.month + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
                          </td>
                        )}
                        <td className="p-3 font-semibold text-gray-800">
                          {outlet.nama_outlet}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {outlet.transaksi}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-green-700">
                          {outlet.omset.toLocaleString("id-ID")}
                        </td>
                      </tr>
                    ))}
                    {/* Subtotal row per month */}
                    <tr className="bg-gray-50 font-bold border-t-2 border-gray-100">
                      <td className="p-3 text-right text-gray-600" colSpan={2}>
                        Subtotal {new Date(report.month + "-01").toLocaleDateString("id-ID", { month: "short", year: "numeric" })}
                      </td>
                      <td className="p-3 text-right text-gray-600 font-mono">
                        {report.outlets.reduce((acc, curr) => acc + curr.transaksi, 0)}
                      </td>
                      <td className="p-3 text-right text-gray-800 font-mono">
                        {report.total_omset.toLocaleString("id-ID")}
                      </td>
                    </tr>
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-400 italic">
                    Belum ada data bulanan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. AUDIT LOGS COMPONENT */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        
        {/* Header and Search */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <ListCollapse className="h-4 w-4 text-[#E4002B]" />
            <h3 className="font-bold text-gray-800 text-sm">Audit Logs Aktivitas Sistem</h3>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <div className="absolute left-3 inset-y-0 flex items-center text-gray-400 pointer-events-none">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none"
              placeholder="Cari aksi / admin id..."
            />
          </div>
        </div>

        {/* Log table/list */}
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-xs text-left text-gray-700 divide-y divide-gray-100">
            <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
              <tr>
                <th className="p-3">Waktu</th>
                <th className="p-3">Admin ID</th>
                <th className="p-3">Aksi</th>
                <th className="p-3">Keterangan Aktivitas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-sans">
              {filteredAuditLogs.length > 0 ? (
                filteredAuditLogs.map((log: AuditLog) => (
                  <tr key={log.log_id} className="hover:bg-gray-50/50">
                    <td className="p-3 font-mono text-[10px] text-gray-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString("id-ID")}
                    </td>
                    <td className="p-3 font-semibold text-gray-800">
                      {log.user_id}
                    </td>
                    <td className="p-3">
                      <span className="bg-red-50 text-[#E4002B] text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-mono tracking-wide">
                        {log.aksi}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600 max-w-xs sm:max-w-md truncate" title={log.detail}>
                      {log.detail}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-400 italic">
                    Belum ada audit log yang sesuai filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
