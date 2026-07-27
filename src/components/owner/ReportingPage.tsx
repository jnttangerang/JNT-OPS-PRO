import React, { useState, useEffect } from "react";
import { SessionData, Outlet } from "../../types";
import useAppsScript from "../../hooks/useAppsScript";
import { toast } from "../../utils/toast";
import {
  Calendar,
  Filter,
  Download,
  BarChart3,
  TrendingUp,
  Building2,
  User,
  Package,
  DollarSign,
  PieChart,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  FileSpreadsheet,
  ArrowUpRight,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart as RePieChart,
  Pie,
  Cell,
  CartesianGrid,
  LineChart,
  Line
} from "recharts";

interface ReportingPageProps {
  session: SessionData;
  outlets: Outlet[];
}

const COLORS = ["#E4002B", "#2563EB", "#10B981", "#F59E0B", "#8B5CF6", "#64748B"];

export default function ReportingPage({ session, outlets }: ReportingPageProps) {
  const { callBackend, loading } = useAppsScript();

  // Filter States
  const [dateStart, setDateStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateEnd, setDateEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [filterOutlet, setFilterOutlet] = useState<string>("ALL");
  const [filterOperator, setFilterOperator] = useState<string>("ALL");
  const [filterServiceType, setFilterServiceType] = useState<string>("ALL");
  const [filterSettlementStatus, setFilterSettlementStatus] = useState<string>("ALL");
  const [filterAuditStatus, setFilterAuditStatus] = useState<string>("ALL");

  // Active View Tab
  const [activeTab, setActiveTab] = useState<"summary" | "daily" | "outlet" | "operator" | "settlement" | "audit" | "detail">("summary");

  // Reporting Data States
  const [reportSummaryData, setReportSummaryData] = useState<any>(null);
  const [detailedTx, setDetailedTx] = useState<any[]>([]);
  const [fetchingData, setFetchingData] = useState(false);

  // Pagination State for Detail Table
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    setCurrentPage(1);
  }, [dateStart, dateEnd, filterOutlet, filterOperator, filterServiceType, filterSettlementStatus, filterAuditStatus, activeTab]);

  const totalPages = Math.ceil(detailedTx.length / pageSize) || 1;
  const paginatedDetailedTx = detailedTx.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    fetchReportSummary();
  }, [dateStart, dateEnd, filterOutlet, filterOperator, filterServiceType, filterSettlementStatus, filterAuditStatus]);

  const fetchReportSummary = async () => {
    setFetchingData(true);
    try {
      const payload = {
        dateStart,
        dateEnd,
        filterOutlet,
        filterOperator,
        filterServiceType,
        filterSettlementStatus,
        filterAuditStatus
      };

      const res = await callBackend("getReportingSummary", payload);
      if (res && res.status === "success" && res.data) {
        setReportSummaryData(res.data);
      } else {
        toast.error(res?.message || "Gagal memuat data laporan");
      }

      // Also fetch detailed transactions for CSV / table view
      const resTx = await callBackend("getReportingTransactions", payload);
      if (resTx && resTx.status === "success" && resTx.data) {
        setDetailedTx(resTx.data);
      }
    } catch (err: any) {
      console.error("Error fetching report data:", err);
      toast.error("Terjadi kesalahan koneksi saat memuat data laporan.");
    } finally {
      setFetchingData(false);
    }
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // CSV Export Utility
  const handleExportCSV = () => {
    let rows: any[] = [];
    let filename = `Laporan_JNT_${activeTab}_${dateStart}_s_d_${dateEnd}.csv`;

    if (activeTab === "daily") {
      rows = (reportSummaryData?.daily_report || []).map((r: any) => ({
        Tanggal: r.tanggal,
        "ID Outlet": r.outlet_id,
        "Nama Outlet": r.nama_outlet,
        "Total Transaksi": r.total_transaksi,
        Express: r.express,
        Cargo: r.cargo,
        "Omset Customer": r.total_customer_payment,
        "Total YOYI/JTC": r.total_yoyi,
        "Setoran Owner": r.total_setoran_owner,
        "Kas Operasional": r.total_kas_operasional,
        "Selisih Margin": r.total_selisih
      }));
    } else if (activeTab === "outlet") {
      rows = (reportSummaryData?.outlet_report || []).map((r: any) => ({
        "ID Outlet": r.outlet_id,
        "Nama Outlet": r.nama_outlet,
        "Total Transaksi": r.total_transaksi,
        "Total Omset": r.omset,
        "Setoran Owner": r.setoran,
        "Kas Operasional": r.kas_outlet,
        Selisih: r.selisih
      }));
    } else if (activeTab === "operator") {
      rows = (reportSummaryData?.operator_report || []).map((r: any) => ({
        "ID Operator": r.admin_id,
        "Nama Operator": r.nama_operator,
        "Total Transaksi": r.total_transaksi,
        Express: r.express,
        Cargo: r.cargo,
        "Total Omset": r.omset,
        "Kas Operasional": r.kas_operasional
      }));
    } else if (activeTab === "detail" || activeTab === "summary") {
      rows = detailedTx.map((t: any) => ({
        "No Resi": t.resi_id,
        "ID Transaksi": t.transaksi_id,
        Tanggal: t.tanggal,
        "Layanan": t.tipe_layanan,
        "Produk": t.tipe_produk,
        "Outlet": t.outlet_nama,
        "Operator": t.admin_nama,
        "Total Customer": t.total_customer,
        "YOYI / JTC": t.total_yoyi,
        "Setoran Owner": t.setoran_owner,
        "Kas Operasional": t.kas_operasional,
        "Status Setoran": t.settlement_status,
        "Status Audit": t.audit_status,
        Pengirim: t.pengirim,
        Penerima: t.penerima,
        "Metode Bayar": t.metode_bayar
      }));
    }

    if (rows.length === 0) {
      toast.info("Tidak ada data untuk diexport");
      return;
    }

    const headers = Object.keys(rows[0]);
    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [
        headers.join(","),
        ...rows.map((row) =>
          headers
            .map((field) => {
              const val = row[field] === undefined || row[field] === null ? "" : String(row[field]);
              return `"${val.replace(/"/g, '""')}"`;
            })
            .join(",")
        )
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Berhasil mengunduh laporan ${activeTab.toUpperCase()}`);
  };

  const summary = reportSummaryData?.summary || {};
  const analytics = reportSummaryData?.analytics || {};
  const charts = reportSummaryData?.charts || {};

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 font-sans">
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-150 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="bg-[#E4002B] p-2 rounded-xl text-white shadow-md shadow-red-500/10">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">
              Laporan & Analitik Owner
            </h1>
          </div>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Dashboard konsolidasi data harian, performa outlet, dan audit setoran (Read-Only)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchReportSummary}
            disabled={fetchingData}
            className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${fetchingData ? "animate-spin" : ""}`} />
            <span>Muat Ulang</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="py-2.5 px-4 bg-[#E4002B] hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-red-500/20 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* GLOBAL FILTERS PANEL */}
      <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
          <Filter className="h-4 w-4 text-[#E4002B]" />
          <h2 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">
            Filter Laporan Konsolidasi
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* Rentang Tanggal Mulai */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
              Dari Tanggal
            </label>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="w-full text-xs font-medium px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#E4002B] focus:outline-none"
            />
          </div>

          {/* Rentang Tanggal Sampai */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
              Sampai Tanggal
            </label>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="w-full text-xs font-medium px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#E4002B] focus:outline-none"
            />
          </div>

          {/* Filter Outlet */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
              Outlet
            </label>
            <select
              value={filterOutlet}
              onChange={(e) => setFilterOutlet(e.target.value)}
              className="w-full text-xs font-medium px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#E4002B] focus:outline-none"
            >
              <option value="ALL">Semua Outlet</option>
              {outlets.map((o) => (
                <option key={o.outlet_id} value={o.outlet_id}>
                  {o.nama_outlet}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Layanan */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
              Layanan
            </label>
            <select
              value={filterServiceType}
              onChange={(e) => setFilterServiceType(e.target.value)}
              className="w-full text-xs font-medium px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#E4002B] focus:outline-none"
            >
              <option value="ALL">Semua Layanan</option>
              <option value="Express">Express</option>
              <option value="Cargo">Cargo</option>
            </select>
          </div>

          {/* Filter Status Setoran */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
              Status Setoran
            </label>
            <select
              value={filterSettlementStatus}
              onChange={(e) => setFilterSettlementStatus(e.target.value)}
              className="w-full text-xs font-medium px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#E4002B] focus:outline-none"
            >
              <option value="ALL">Semua Setoran</option>
              <option value="DISETUJUI">Disetujui</option>
              <option value="MENUNGGU_APPROVAL">Menunggu Approval</option>
              <option value="DITOLAK">Ditolak</option>
              <option value="BELUM_ADA_SETORAN">Belum Ada Setoran</option>
            </select>
          </div>

          {/* Filter Status Audit */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
              Status Audit
            </label>
            <select
              value={filterAuditStatus}
              onChange={(e) => setFilterAuditStatus(e.target.value)}
              className="w-full text-xs font-medium px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#E4002B] focus:outline-none"
            >
              <option value="ALL">Semua Status Audit</option>
              <option value="SESUAI">Sesuai</option>
              <option value="SELISIH">Selisih</option>
              <option value="PERLU_REVIEW">Perlu Review</option>
              <option value="BELUM_DIAUDIT">Belum Diaudit</option>
            </select>
          </div>

          {/* Reset button */}
          <div className="space-y-1 flex items-end">
            <button
              onClick={() => {
                setFilterOutlet("ALL");
                setFilterOperator("ALL");
                setFilterServiceType("ALL");
                setFilterSettlementStatus("ALL");
                setFilterAuditStatus("ALL");
              }}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        </div>
      </div>

      {/* OVERALL METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Transaksi */}
        <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Transaksi</span>
            <div className="bg-blue-50 p-2 rounded-xl text-blue-600">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl font-black text-gray-900 font-mono">
            {summary.total_transaksi || 0} <span className="text-xs font-normal text-gray-400">resi</span>
          </p>
          <div className="flex items-center gap-2 text-[10px] text-gray-500 font-medium">
            <span className="text-red-600 font-bold">{summary.total_express || 0} Express</span>
            <span>•</span>
            <span className="text-blue-600 font-bold">{summary.total_cargo || 0} Cargo</span>
          </div>
        </div>

        {/* Omset Customer */}
        <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Omset</span>
            <div className="bg-emerald-50 p-2 rounded-xl text-emerald-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="text-lg font-black text-emerald-600 font-mono">
            {formatRupiah(summary.total_customer_payment || 0)}
          </p>
          <p className="text-[10px] text-gray-400 font-medium">Total Pembayaran Customer</p>
        </div>

        {/* Setoran Owner */}
        <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Setoran Owner</span>
            <div className="bg-red-50 p-2 rounded-xl text-[#E4002B]">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <p className="text-lg font-black text-[#E4002B] font-mono">
            {formatRupiah(summary.total_setoran_owner || 0)}
          </p>
          <p className="text-[10px] text-gray-400 font-medium">Nominal Hak Owner</p>
        </div>

        {/* Kas Operasional */}
        <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Kas Outlet</span>
            <div className="bg-amber-50 p-2 rounded-xl text-amber-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="text-lg font-black text-amber-600 font-mono">
            {formatRupiah(summary.total_kas_operasional || 0)}
          </p>
          <p className="text-[10px] text-gray-400 font-medium">Kas Operasional Outlet</p>
        </div>

        {/* Selisih Margin */}
        <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Selisih</span>
            <div className="bg-purple-50 p-2 rounded-xl text-purple-600">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <p className="text-lg font-black text-purple-600 font-mono">
            {formatRupiah(summary.total_selisih || 0)}
          </p>
          <p className="text-[10px] text-gray-400 font-medium">Omset Dikurangi YOYI/JTC</p>
        </div>
      </div>

      {/* NAVIGATION TABS FOR REPORT VIEWS */}
      <div className="flex items-center gap-1 bg-white p-1.5 rounded-2xl border border-gray-150 shadow-sm overflow-x-auto">
        <button
          onClick={() => setActiveTab("summary")}
          className={`py-2 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "summary"
              ? "bg-[#E4002B] text-white shadow-md shadow-red-500/20"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Ikhtisar & Grafik
        </button>
        <button
          onClick={() => setActiveTab("daily")}
          className={`py-2 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "daily"
              ? "bg-[#E4002B] text-white shadow-md shadow-red-500/20"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Laporan Harian
        </button>
        <button
          onClick={() => setActiveTab("outlet")}
          className={`py-2 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "outlet"
              ? "bg-[#E4002B] text-white shadow-md shadow-red-500/20"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Performa Outlet
        </button>
        <button
          onClick={() => setActiveTab("operator")}
          className={`py-2 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "operator"
              ? "bg-[#E4002B] text-white shadow-md shadow-red-500/20"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Performa Operator
        </button>
        <button
          onClick={() => setActiveTab("settlement")}
          className={`py-2 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "settlement"
              ? "bg-[#E4002B] text-white shadow-md shadow-red-500/20"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Laporan Setoran
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`py-2 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "audit"
              ? "bg-[#E4002B] text-white shadow-md shadow-red-500/20"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Laporan Audit
        </button>
        <button
          onClick={() => setActiveTab("detail")}
          className={`py-2 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "detail"
              ? "bg-[#E4002B] text-white shadow-md shadow-red-500/20"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Detail Resi
        </button>
      </div>

      {/* TAB CONTENT RENDER */}
      {fetchingData && (
        <div className="bg-white p-12 rounded-2xl border border-gray-150 text-center space-y-3">
          <RefreshCw className="h-8 w-8 text-[#E4002B] animate-spin mx-auto" />
          <p className="text-xs font-bold text-gray-600">Memproses dan mengonsolidasi data laporan...</p>
        </div>
      )}

      {!fetchingData && activeTab === "summary" && (
        <div className="space-y-6">
          {/* HIGHLIGHT ANALYTICS METRICS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Highest Outlet */}
            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-2">
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">
                Outlet Omset Tertinggi
              </span>
              <p className="text-sm font-bold text-gray-900 truncate">
                {analytics.highest_outlet?.nama_outlet || "Belum Ada Data"}
              </p>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-gray-500 font-medium">Total Omset:</span>
                <span className="font-bold text-emerald-600 font-mono">
                  {formatRupiah(analytics.highest_outlet?.omset || 0)}
                </span>
              </div>
            </div>

            {/* Highest Operator */}
            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-2">
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">
                Operator Paling Aktif
              </span>
              <p className="text-sm font-bold text-gray-900 truncate">
                {analytics.highest_operator?.nama_operator || "Belum Ada Data"}
              </p>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-gray-500 font-medium">Total Transaksi:</span>
                <span className="font-bold text-blue-600 font-mono">
                  {analytics.highest_operator?.total_transaksi || 0} resi
                </span>
              </div>
            </div>

            {/* Averages */}
            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-2">
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">
                Rata-Rata Transaksi & Nilai
              </span>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Transaksi / Hari:</span>
                <span className="font-bold text-gray-800 font-mono">
                  {analytics.avg_transactions_per_day || 0} resi
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-gray-500 font-medium">Rata-Rata Bayar:</span>
                <span className="font-bold text-emerald-600 font-mono">
                  {formatRupiah(analytics.avg_customer_payment || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* VISUAL CHARTS SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Daily Transactions Trend */}
            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-4">
              <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#E4002B]" />
                Tren Jumlah Transaksi Harian
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.daily_transactions || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#FFFFFF", borderRadius: "12px", fontSize: "11px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="express" name="Express" fill="#E4002B" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cargo" name="Cargo" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Daily Revenue Trend */}
            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-4">
              <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Tren Omset vs Setoran Harian
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={charts.daily_revenue || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(val: any) => formatRupiah(Number(val))}
                      contentStyle={{ backgroundColor: "#FFFFFF", borderRadius: "12px", fontSize: "11px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Line type="monotone" dataKey="omset" name="Omset Customer" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="setoran" name="Setoran Owner" stroke="#E4002B" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Express vs Cargo Share */}
            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-4">
              <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                <PieChart className="h-4 w-4 text-purple-600" />
                Proporsi Express vs Cargo
              </h3>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={charts.express_vs_cargo || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {(charts.express_vs_cargo || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [`${val} resi`, "Jumlah"]} />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Settlement Status Distribution */}
            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-4">
              <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                Distribusi Status Setoran
              </h3>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={charts.settlement_status || []}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {(charts.settlement_status || []).map((entry: any, index: number) => (
                        <Cell key={`cell-set-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [`${val} transaksi`, "Total"]} />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DAILY REPORT TABLE */}
      {!fetchingData && activeTab === "daily" && (
        <div className="bg-white rounded-2xl border border-gray-150 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">
              Laporan Konsolidasi Harian Per Outlet
            </h3>
            <span className="text-xs text-gray-500 font-mono">
              {(reportSummaryData?.daily_report || []).length} baris
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-150 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Outlet</th>
                  <th className="py-3 px-4 text-center">Total Resi</th>
                  <th className="py-3 px-4 text-center">Express / Cargo</th>
                  <th className="py-3 px-4 text-right">Omset Customer</th>
                  <th className="py-3 px-4 text-right">Setoran Owner</th>
                  <th className="py-3 px-4 text-right">Kas Outlet</th>
                  <th className="py-3 px-4 text-right">Selisih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-medium text-gray-700">
                {(reportSummaryData?.daily_report || []).map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-gray-900">{row.tanggal}</td>
                    <td className="py-3 px-4 font-bold text-gray-800">{row.nama_outlet}</td>
                    <td className="py-3 px-4 text-center font-bold font-mono">{row.total_transaksi}</td>
                    <td className="py-3 px-4 text-center font-mono">
                      <span className="text-red-600 font-bold">{row.express}</span> /{" "}
                      <span className="text-blue-600 font-bold">{row.cargo}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600 font-mono">
                      {formatRupiah(row.total_customer_payment)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[#E4002B] font-mono">
                      {formatRupiah(row.total_setoran_owner)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-amber-600 font-mono">
                      {formatRupiah(row.total_kas_operasional)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-purple-600 font-mono">
                      {formatRupiah(row.total_selisih)}
                    </td>
                  </tr>
                ))}
                {(reportSummaryData?.daily_report || []).length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-gray-400 font-medium">
                      Tidak ada data laporan harian untuk filter yang dipilih.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OUTLET PERFORMANCE TABLE */}
      {!fetchingData && activeTab === "outlet" && (
        <div className="bg-white rounded-2xl border border-gray-150 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">
              Ringkasan Performa Outlet
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-150 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">ID Outlet</th>
                  <th className="py-3 px-4">Nama Outlet</th>
                  <th className="py-3 px-4 text-center">Total Transaksi</th>
                  <th className="py-3 px-4 text-right">Total Omset</th>
                  <th className="py-3 px-4 text-right">Total Setoran Owner</th>
                  <th className="py-3 px-4 text-right">Kas Operasional</th>
                  <th className="py-3 px-4 text-right">Total Selisih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-medium text-gray-700">
                {(reportSummaryData?.outlet_report || []).map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-gray-500">{row.outlet_id}</td>
                    <td className="py-3 px-4 font-bold text-gray-900">{row.nama_outlet}</td>
                    <td className="py-3 px-4 text-center font-bold font-mono">{row.total_transaksi}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600 font-mono">
                      {formatRupiah(row.omset)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[#E4002B] font-mono">
                      {formatRupiah(row.setoran)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-amber-600 font-mono">
                      {formatRupiah(row.kas_outlet)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-purple-600 font-mono">
                      {formatRupiah(row.selisih)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OPERATOR PERFORMANCE TABLE */}
      {!fetchingData && activeTab === "operator" && (
        <div className="bg-white rounded-2xl border border-gray-150 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">
              Ringkasan Performa Operator Admin
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-150 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">ID Operator</th>
                  <th className="py-3 px-4">Nama Operator</th>
                  <th className="py-3 px-4 text-center">Total Resi</th>
                  <th className="py-3 px-4 text-center">Express</th>
                  <th className="py-3 px-4 text-center">Cargo</th>
                  <th className="py-3 px-4 text-right">Omset Customer</th>
                  <th className="py-3 px-4 text-right">Kas Operasional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-medium text-gray-700">
                {(reportSummaryData?.operator_report || []).map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-gray-500">{row.admin_id}</td>
                    <td className="py-3 px-4 font-bold text-gray-900">{row.nama_operator}</td>
                    <td className="py-3 px-4 text-center font-bold font-mono">{row.total_transaksi}</td>
                    <td className="py-3 px-4 text-center font-mono text-red-600 font-bold">{row.express}</td>
                    <td className="py-3 px-4 text-center font-mono text-blue-600 font-bold">{row.cargo}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600 font-mono">
                      {formatRupiah(row.omset)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-amber-600 font-mono">
                      {formatRupiah(row.kas_operasional)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SETTLEMENT REPORT TABLE */}
      {!fetchingData && activeTab === "settlement" && (
        <div className="bg-white rounded-2xl border border-gray-150 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">
              Laporan Header Setoran (Master_Setoran)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-150 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">ID Setoran</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Outlet</th>
                  <th className="py-3 px-4">Admin Pembuat</th>
                  <th className="py-3 px-4 text-center">Jumlah Resi</th>
                  <th className="py-3 px-4 text-right">Total Setoran</th>
                  <th className="py-3 px-4 text-center">Status Approval</th>
                  <th className="py-3 px-4 text-center">Closing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-medium text-gray-700">
                {detailedTx.length >= 0 &&
                  (reportSummaryData?.settlement_report?.detail || []).map((s: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">{s.setoran_id}</td>
                      <td className="py-3 px-4 font-mono">{s.tanggal}</td>
                      <td className="py-3 px-4 font-bold text-gray-800">{s.outlet_name || s.outlet_id}</td>
                      <td className="py-3 px-4 text-gray-600">{s.admin_pembuat}</td>
                      <td className="py-3 px-4 text-center font-bold font-mono">{s.jumlah_resi}</td>
                      <td className="py-3 px-4 text-right font-bold text-[#E4002B] font-mono">
                        {formatRupiah(s.total_setoran_owner)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            s.status === "DISETUJUI"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : s.status === "MENUNGGU_APPROVAL"
                              ? "bg-amber-50 text-amber-700 border border-amber-100"
                              : s.status === "DITOLAK"
                              ? "bg-rose-50 text-rose-700 border border-rose-100"
                              : "bg-red-50 text-red-700 border border-red-100"
                          }`}
                        >
                          {s.status === "MENUNGGU_APPROVAL" ? "MENUNGGU APPROVAL" : s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-[10px]">
                        {s.closing_status === "CLOSED" ? (
                          <span className="text-emerald-600 font-bold">CLOSED</span>
                        ) : (
                          <span className="text-gray-400">OPEN</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AUDIT REPORT SUMMARY */}
      {!fetchingData && activeTab === "audit" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                Audit Sesuai
              </span>
              <p className="text-xl font-black text-gray-900 font-mono">
                {reportSummaryData?.audit_summary?.sesuai || 0}
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">
                Audit Selisih
              </span>
              <p className="text-xl font-black text-gray-900 font-mono">
                {reportSummaryData?.audit_summary?.selisih || 0}
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">
                Perlu Review
              </span>
              <p className="text-xl font-black text-gray-900 font-mono">
                {reportSummaryData?.audit_summary?.perlu_review || 0}
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Belum Diaudit
              </span>
              <p className="text-xl font-black text-gray-900 font-mono">
                {reportSummaryData?.audit_summary?.belum_diaudit || 0}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* RAW TRANSACTION DETAILS TABLE */}
      {(fetchingData || (activeTab === "detail" || activeTab === "audit")) && (
        <div className="bg-white rounded-2xl border border-gray-150 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">
              Detail Seluruh Transaksi Resi
            </h3>
            <span className="text-xs text-gray-500 font-mono">{detailedTx.length} resi</span>
          </div>
          {fetchingData ? (
            <div className="p-6 space-y-3 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg w-full"></div>
              ))}
            </div>
          ) : detailedTx.length === 0 ? (
            <div className="p-12 text-center text-gray-400 space-y-2">
              <Package className="h-10 w-10 mx-auto text-gray-300 stroke-[1.5]" />
              <p className="text-sm font-bold text-gray-700">Belum ada transaksi resi.</p>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Belum ada data resi paket dalam periode filter yang dipilih.
              </p>
            </div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-150 text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                      <th className="py-3 px-4">No Resi</th>
                      <th className="py-3 px-4">Tanggal</th>
                      <th className="py-3 px-4">Layanan</th>
                      <th className="py-3 px-4">Outlet</th>
                      <th className="py-3 px-4">Operator</th>
                      <th className="py-3 px-4 text-right">Total Customer</th>
                      <th className="py-3 px-4 text-right">Setoran Owner</th>
                      <th className="py-3 px-4 text-center">Status Setoran</th>
                      <th className="py-3 px-4 text-center">Status Audit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs font-medium text-gray-700">
                    {paginatedDetailedTx.map((t: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-gray-900">{t.resi_id}</td>
                        <td className="py-3 px-4 font-mono text-gray-500">{t.tanggal}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                              t.tipe_layanan === "Express"
                                ? "bg-red-50 text-[#E4002B]"
                                : "bg-blue-50 text-blue-600"
                            }`}
                          >
                            {t.tipe_layanan}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-gray-800">{t.outlet_nama}</td>
                        <td className="py-3 px-4 text-gray-600">{t.admin_nama}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600 font-mono">
                          {formatRupiah(t.total_customer)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-[#E4002B] font-mono">
                          {formatRupiah(t.setoran_owner)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            t.settlement_status === "DISETUJUI"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : t.settlement_status === "MENUNGGU_APPROVAL"
                              ? "bg-amber-50 text-amber-700 border border-amber-100"
                              : t.settlement_status === "BELUM_DISETOR"
                              ? "bg-red-50 text-red-700 border border-red-100"
                              : "bg-gray-100 text-gray-700 border border-gray-200"
                          }`}>
                            {t.settlement_status === "MENUNGGU_APPROVAL" ? "MENUNGGU APPROVAL" : t.settlement_status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              t.audit_status === "SESUAI"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : t.audit_status === "SELISIH"
                                ? "bg-red-50 text-red-700 border border-red-100"
                                : t.audit_status === "PERLU_REVIEW"
                                ? "bg-amber-50 text-amber-700 border border-amber-100"
                                : "bg-gray-100 text-gray-700 border border-gray-200"
                            }`}
                          >
                            {t.audit_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="p-4 bg-gray-50/80 border-t border-gray-150 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <span className="text-gray-500 font-medium">
                    Menampilkan {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, detailedTx.length)} dari {detailedTx.length} resi
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
          )}
        </div>
      )}
    </div>
  );
}
