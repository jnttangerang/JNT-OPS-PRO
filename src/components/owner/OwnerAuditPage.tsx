import React, { useState, useEffect, useRef } from "react";
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
  Truck,
  Upload,
  Trash2,
  AlertTriangle,
  FileText,
  Plus
} from "lucide-react";

interface OwnerAuditPageProps {
  session: SessionData;
  outlets: Outlet[];
}

export default function OwnerAuditPage({ session, outlets }: OwnerAuditPageProps) {
  const { callBackend, loading } = useAppsScript();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"audit_setoran" | "audit_yoyi" | "audit_yoyi_results">("audit_setoran");

  // Tab 1: Audit Setoran States
  const [filterOutlet, setFilterOutlet] = useState<string>("ALL");
  const [filterEkspedisi, setFilterEkspedisi] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("EXCEPTION");
  const [filterAdmin, setFilterAdmin] = useState<string>("");
  const [dateStart, setDateStart] = useState(() => getTodayWIB());
  const [dateEnd, setDateEnd] = useState(() => getTodayWIB());
  const [auditData, setAuditData] = useState<any>(null);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [auditNote, setAuditNote] = useState("");
  const [savingAudit, setSavingAudit] = useState(false);
  const [userRegistry, setUserRegistry] = useState<any[]>([]);

  // Tab 2: Audit YoYi States
  const [selectedOutlet, setSelectedOutlet] = useState<string>(() => outlets[0]?.outlet_id || "");
  const [selectedAdmin, setSelectedAdmin] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayWIB());
  const [uploadedImages, setUploadedImages] = useState<{ base64: string; mimeType: string; preview: string; name: string }[]>([]);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);
  const [savingYoyiBatch, setSavingYoyiBatch] = useState<boolean>(false);

  // Tab 3: YoYi Comparison States
  const [compareOutlet, setCompareOutlet] = useState<string>(() => outlets[0]?.outlet_id || "");
  const [compareDate, setCompareDate] = useState<string>(() => getTodayWIB());
  const [compareResult, setCompareResult] = useState<any>(null);
  const [compareLoading, setCompareLoading] = useState<boolean>(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const handleRunComparison = async () => {
    if (!compareOutlet || !compareDate) {
      toast.error("Outlet dan Tanggal wajib dipilih.");
      return;
    }
    setCompareLoading(true);
    setCompareError(null);
    setCompareResult(null);

    try {
      const res = await callBackend("auditYoyiCompleteness", {
        outlet_id: compareOutlet,
        tanggal: compareDate,
        user_role: "OWNER"
      });

      if (res.status === "empty") {
        setCompareError("Audit YoYi belum dilakukan untuk tanggal ini.");
      } else if (res.status === "error") {
        setCompareError(res.message || "Gagal memproses perbandingan.");
        toast.error(res.message || "Gagal memproses perbandingan.");
      } else if (res.status === "success") {
        setCompareResult(res);
        toast.success("Berhasil memproses perbandingan!");
      } else {
        throw new Error(res.message || "Respon tidak dikenal.");
      }
    } catch (err: any) {
      console.error(err);
      setCompareError(err.message || "Terjadi kesalahan.");
      toast.error(err.message || "Gagal memproses perbandingan.");
    } finally {
      setCompareLoading(false);
    }
  };

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
    if (activeTab === "audit_setoran") {
      fetchAuditData();
    }
  }, [filterOutlet, dateStart, dateEnd, activeTab]);

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

  // Tab 2 Handlers
  const handleImagesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: typeof uploadedImages = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
        toast.error(`${file.name}: Format file tidak didukung. Harap upload gambar JPG, PNG, atau WEBP.`);
        continue;
      }

      // Validate size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: Ukuran file terlalu besar. Maksimal 10MB.`);
        continue;
      }

      const preview = URL.createObjectURL(file);
      
      // Read base64
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Gagal membaca gambar"));
          reader.readAsDataURL(file);
        });

        newImages.push({
          base64,
          mimeType: file.type,
          preview,
          name: file.name
        });
      } catch (err) {
        toast.error(`Gagal membaca file ${file.name}`);
      }
    }

    setUploadedImages((prev) => [...prev, ...newImages]);
    
    // Reset file input value to allow re-uploading same files
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = (index: number) => {
    setUploadedImages((prev) => {
      const copy = [...prev];
      const removed = copy.splice(index, 1)[0];
      if (removed && removed.preview.startsWith("blob:")) {
        URL.revokeObjectURL(removed.preview);
      }
      return copy;
    });
  };

  const handleRunOcr = async () => {
    if (uploadedImages.length === 0) {
      toast.error("Silakan upload minimal satu screenshot terlebih dahulu!");
      return;
    }

    setOcrLoading(true);
    setWarnings([]);
    setParsedRows([]);

    try {
      const res = await callBackend("parseRincianSerahTerimaScreenshot", {
        images: uploadedImages.map(img => ({ base64: img.base64, mimeType: img.mimeType }))
      });

      if (res.status === "success") {
        setParsedRows(res.rows || []);
        setWarnings(res.warnings || []);
        if (res.rows?.length > 0) {
          toast.success(`OCR Berhasil! Menemukan ${res.rows.length} resi.`);
        } else {
          toast.info("OCR selesai tetapi tidak menemukan baris resi yang valid pada gambar.");
        }
      } else {
        throw new Error(res.message || "Gagal memproses gambar.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Gagal memproses OCR.");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleRowChange = (index: number, field: string, value: any) => {
    setParsedRows((prev) => {
      const copy = [...prev];
      const updatedRow = { ...copy[index], [field]: value };
      
      // Recalculate audit_scope if sumber_order was changed
      if (field === "sumber_order") {
        const sourceOrderUpper = String(value || "").trim().toUpperCase();
        const isEcommerce = ["JY", "JX", "JZ"].some(prefix => sourceOrderUpper.includes(prefix));
        updatedRow.audit_scope = isEcommerce ? "ECOMMERCE_SKIP" : "AUDIT";
      }

      copy[index] = updatedRow;
      return copy;
    });
  };

  const handleRemoveRow = (index: number) => {
    setParsedRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirmSaveYoyiBatch = async () => {
    if (parsedRows.length === 0) {
      toast.error("Tidak ada baris data untuk disimpan.");
      return;
    }

    if (!selectedOutlet) {
      toast.error("Silakan pilih Outlet tujuan terlebih dahulu.");
      return;
    }

    if (!selectedAdmin) {
      toast.error("Silakan pilih Admin terkait terlebih dahulu.");
      return;
    }

    // Validation Minimal
    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      const rowLabel = `Baris #${i + 1}`;

      if (!row.resi_id || String(row.resi_id).trim().length === 0) {
        toast.error(`${rowLabel}: Nomor Resi wajib diisi!`);
        return;
      }

      if (row.total_yoyi !== null && row.total_yoyi !== undefined && row.total_yoyi !== "") {
        const num = Number(row.total_yoyi);
        if (isNaN(num)) {
          toast.error(`${rowLabel} (Resi: ${row.resi_id}): Total YoYi harus berupa angka murni!`);
          return;
        }
      }
    }

    setSavingYoyiBatch(true);

    try {
      // Build final rows mapping to AuditYoyiBatch schema
      const rowsToSave = parsedRows.map((row) => ({
        outlet_id: selectedOutlet,
        admin_id_terkait: selectedAdmin,
        tanggal_serah_terima: selectedDate,
        resi_id: String(row.resi_id).trim().toUpperCase(),
        sumber_order: row.sumber_order ? String(row.sumber_order).trim() : "",
        waktu_pemesanan: row.waktu_pemesanan ? String(row.waktu_pemesanan).trim() : "",
        metode_perhitungan: row.metode_perhitungan ? String(row.metode_perhitungan).trim() : "",
        status_waybill: row.status_waybill ? String(row.status_waybill).trim() : "",
        waktu_serah_terima: row.waktu_serah_terima ? String(row.waktu_serah_terima).trim() : "",
        operator_yoyi: row.operator_yoyi ? String(row.operator_yoyi).trim() : "",
        total_yoyi: row.total_yoyi !== null && row.total_yoyi !== "" ? Number(row.total_yoyi) : 0,
        imported_by: session.username || "owner"
      }));

      const res = await callBackend("saveAuditYoyiBatch", {
        user_role: "OWNER",
        rows: rowsToSave
      });

      if (res && res.status === "success") {
        toast.success("Berhasil menyimpan Rincian Serah Terima ke AuditYoyiBatch!");
        
        // Success: Reset form and clear state
        setParsedRows([]);
        setUploadedImages([]);
        setWarnings([]);
      } else {
        throw new Error(res.message || "Gagal menyimpan data.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Gagal menyimpan: ${err.message || String(err)}`);
    } finally {
      setSavingYoyiBatch(false);
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

  // Tab 1 Dynamic Filters
  const filteredList = auditData?.detail?.filter((tx: any) => {
    if (filterStatus === "EXCEPTION") {
      if (tx.audit_status === "VALID" || tx.audit_status === "SESUAI") return false;
    } else if (filterStatus !== "ALL" && tx.audit_status !== filterStatus) {
      return false;
    }
    
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight text-wrap balance">Audit Engine</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">Verifikasi integritas data keuangan outlet pasca setoran</p>
        </div>
        {activeTab === "audit_setoran" && (
          <button 
            onClick={fetchAuditData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-bold rounded-xl border border-gray-200 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Segarkan Data
          </button>
        )}
      </div>

      {/* Segmented Tab Selector */}
      <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("audit_setoran")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "audit_setoran"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          Audit Setoran & Transaksi
        </button>
        <button
          onClick={() => setActiveTab("audit_yoyi")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "audit_yoyi"
              ? "bg-white text-[#E4002B] shadow-sm"
              : "text-gray-500 hover:text-[#E4002B]"
          }`}
        >
          Rincian Serah Terima YoYi (OCR)
        </button>
        <button
          onClick={() => setActiveTab("audit_yoyi_results")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "audit_yoyi_results"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-500 hover:text-blue-600"
          }`}
        >
          Hasil Perbandingan YoYi
        </button>
      </div>

      {/* TAB 1 CONTENT: AUDIT SETORAN */}
      {activeTab === "audit_setoran" && (
        <>
          {/* Summary Cards */}
          {auditData && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
                <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider mb-1">Total Selisih Resi</p>
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
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer"
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
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer"
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
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                  >
                    <option value="EXCEPTION">Hanya Exception</option>
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
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer"
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
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer"
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
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer"
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
                        <td className="p-4 text-center">
                          {getStatusBadge(tx.audit_status)}
                          {tx.exception_domain && tx.exception_domain !== "NONE" && (
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">{tx.exception_domain}</p>
                          )}
                        </td>
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
        </>
      )}

      {/* TAB 2 CONTENT: AUDIT YOYI (OCR & CONFIRM BATCH) */}
      {activeTab === "audit_yoyi" && (
        <div className="space-y-6">
          {/* Target Settings Card */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" /> Pengaturan Data Serah Terima
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Target Outlet</label>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={selectedOutlet}
                    onChange={(e) => setSelectedOutlet(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                  >
                    {outlets.map((o) => (
                      <option key={o.outlet_id} value={o.outlet_id}>{o.nama_outlet}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Admin Terkait</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={selectedAdmin}
                    onChange={(e) => setSelectedAdmin(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                  >
                    <option value="">Pilih Admin Terkait...</option>
                    {userRegistry.map((u: any) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.nama_lengkap || u.username} ({u.role || "Admin"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Tanggal Serah Terima (Business Date)</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Screenshot Upload Panel */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Upload className="w-4 h-4 text-gray-500" /> Upload Screenshot Rincian Serah Terima
            </h3>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/jpg"
              multiple
              onChange={handleImagesChange}
              className="hidden"
            />

            {/* Drag & Drop Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 hover:border-[#E4002B] rounded-2xl p-8 text-center bg-gray-50/50 hover:bg-gray-50 transition-all cursor-pointer flex flex-col items-center justify-center gap-2"
            >
              <div className="w-12 h-12 rounded-full bg-[#E4002B]/10 text-[#E4002B] flex items-center justify-center shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-gray-700 mt-2">
                Klik untuk Memilih atau Seret Screenshot Rincian Serah Terima YoYi
              </p>
              <p className="text-[10px] text-gray-400 font-medium">
                Mendukung banyak gambar sekaligus (JPG, PNG, WEBP maks. 10MB per file)
              </p>
            </div>

            {/* Uploaded Images List */}
            {uploadedImages.length > 0 && (
              <div className="pt-2">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold text-gray-600">File Terpilih ({uploadedImages.length})</h4>
                  <button 
                    onClick={() => setUploadedImages([])}
                    className="text-[10px] font-bold text-red-600 hover:text-red-800 transition-colors cursor-pointer"
                  >
                    Hapus Semua
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {uploadedImages.map((img, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-100 shadow-xs bg-gray-50 aspect-square">
                      <img 
                        src={img.preview} 
                        alt={img.name} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => handleRemoveImage(idx)}
                          className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer shadow-md"
                          title="Hapus gambar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5 text-[8px] text-white font-medium truncate">
                        {img.name}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Run OCR Button */}
                <div className="pt-4 border-t border-gray-50 flex justify-end">
                  <button
                    onClick={handleRunOcr}
                    disabled={ocrLoading || uploadedImages.length === 0}
                    className="px-6 py-2.5 bg-[#E4002B] hover:bg-[#c20023] text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {ocrLoading ? (
                      <>
                        <RefreshCcw className="w-4 h-4 animate-spin" />
                        <span>Mengekstrak dengan Gemini AI...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        <span>Jalankan OCR Rincian Serah Terima</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Warnings Display */}
          {warnings.length > 0 && (
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex gap-3 text-amber-800">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold">Pemberitahuan dari AI OCR:</p>
                <ul className="list-disc pl-4 text-[11px] font-medium space-y-1">
                  {warnings.map((warn, index) => (
                    <li key={index}>{warn}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* OCR Result Table */}
          {parsedRows.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                <div>
                  <h3 className="text-sm font-bold text-gray-800">Hasil Ekstraksi OCR (Pratinjau & Koreksi Manual)</h3>
                  <p className="text-[10px] text-gray-400 font-medium">Lakukan perbaikan data langsung di tabel sebelum mengonfirmasi penyimpanan.</p>
                </div>
                <div className="text-xs font-bold text-gray-500 font-mono">
                  {parsedRows.length} resi ditemukan
                </div>
              </div>

              {/* Editable Table */}
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-xs text-left text-gray-700 divide-y divide-gray-100">
                  <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3 min-w-[140px]">Nomor Resi *</th>
                      <th className="p-3 min-w-[110px]">Sumber Order</th>
                      <th className="p-3 min-w-[140px]">Waktu Pemesanan</th>
                      <th className="p-3 min-w-[130px]">Metode Perhitungan</th>
                      <th className="p-3 min-w-[110px]">Status Waybill</th>
                      <th className="p-3 min-w-[140px]">Waktu Serah Terima</th>
                      <th className="p-3 min-w-[110px]">Operator YoYi</th>
                      <th className="p-3 min-w-[110px] text-right">Total YoYi (IDR) *</th>
                      <th className="p-3">Scope Audit</th>
                      <th className="p-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-3 text-gray-400 font-bold">{idx + 1}</td>
                        
                        {/* Resi ID */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.resi_id || ""}
                            onChange={(e) => handleRowChange(idx, "resi_id", e.target.value)}
                            placeholder="Wajib diisi"
                            className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono font-bold focus:outline-none focus:bg-white focus:ring-1 focus:ring-red-500"
                          />
                        </td>

                        {/* Sumber Order */}
                        <td className="p-2">
                          <select
                            value={row.sumber_order || ""}
                            onChange={(e) => handleRowChange(idx, "sumber_order", e.target.value)}
                            className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:bg-white focus:ring-1 focus:ring-red-500 cursor-pointer"
                          >
                            <option value="">Pilih...</option>
                            <option value="APP">APP</option>
                            <option value="VIP">VIP</option>
                            <option value="YoYi-WEB">YoYi-WEB</option>
                            <option value="JY">JY (E-commerce)</option>
                            <option value="JX">JX (E-commerce)</option>
                            <option value="JZ">JZ (E-commerce)</option>
                          </select>
                        </td>

                        {/* Waktu Pemesanan */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.waktu_pemesanan || ""}
                            onChange={(e) => handleRowChange(idx, "waktu_pemesanan", e.target.value)}
                            placeholder="YYYY-MM-DD HH:mm:ss"
                            className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:bg-white focus:ring-1 focus:ring-red-500"
                          />
                        </td>

                        {/* Metode Perhitungan */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.metode_perhitungan || ""}
                            onChange={(e) => handleRowChange(idx, "metode_perhitungan", e.target.value)}
                            placeholder="Biaya oleh pengirim / DFOD"
                            className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-red-500"
                          />
                        </td>

                        {/* Status Waybill */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.status_waybill || ""}
                            onChange={(e) => handleRowChange(idx, "status_waybill", e.target.value)}
                            placeholder="Delivered"
                            className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-red-500"
                          />
                        </td>

                        {/* Waktu Serah Terima */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.waktu_serah_terima || ""}
                            onChange={(e) => handleRowChange(idx, "waktu_serah_terima", e.target.value)}
                            placeholder="YYYY-MM-DD HH:mm:ss"
                            className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:bg-white focus:ring-1 focus:ring-red-500"
                          />
                        </td>

                        {/* Operator YoYi */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.operator_yoyi || ""}
                            onChange={(e) => handleRowChange(idx, "operator_yoyi", e.target.value)}
                            placeholder="Nama operator"
                            className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-red-500"
                          />
                        </td>

                        {/* Total YoYi */}
                        <td className="p-2">
                          <input
                            type="number"
                            value={row.total_yoyi === null ? "" : row.total_yoyi}
                            onChange={(e) => handleRowChange(idx, "total_yoyi", e.target.value === "" ? "" : Number(e.target.value))}
                            placeholder="0"
                            className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono font-bold text-right text-gray-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-red-500"
                          />
                        </td>

                        {/* Scope Audit - Zero-Pill inline metadata */}
                        <td className="p-3 whitespace-nowrap text-xs font-semibold">
                          {row.audit_scope === "ECOMMERCE_SKIP" ? (
                            <span className="text-amber-600 font-bold">DILEWATI · Ecommerce</span>
                          ) : (
                            <span className="text-slate-500">AUDIT</span>
                          )}
                        </td>

                        {/* Delete Action */}
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleRemoveRow(idx)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Confirm Actions */}
              <div className="pt-4 border-t border-gray-50 flex justify-end items-center gap-3">
                <button
                  onClick={() => setParsedRows([])}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Batalkan Pratinjau
                </button>
                <button
                  onClick={handleConfirmSaveYoyiBatch}
                  disabled={savingYoyiBatch || parsedRows.length === 0}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {savingYoyiBatch ? (
                    <>
                      <RefreshCcw className="w-4 h-4 animate-spin" />
                      <span>Menyimpan ke Google Sheet...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Confirm & Simpan ke AuditYoyiBatch</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "audit_yoyi_results" && (
        <div className="space-y-6">
          {/* Comparison Settings Card */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" /> Pilih Scope Perbandingan Audit YoYi
            </h3>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="space-y-1 flex-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Target Outlet</label>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={compareOutlet}
                    onChange={(e) => setCompareOutlet(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    {outlets.map((o) => (
                      <option key={o.outlet_id} value={o.outlet_id}>{o.nama_outlet}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1 flex-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Tanggal Serah Terima</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={compareDate}
                    onChange={(e) => setCompareDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  />
                </div>
              </div>

              <button
                onClick={handleRunComparison}
                disabled={compareLoading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 disabled:opacity-50 transition-colors cursor-pointer h-10 shrink-0"
              >
                {compareLoading ? (
                  <>
                    <RefreshCcw className="w-4 h-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Bandingkan & Audit</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Empty State / Error Notification */}
          {compareError && (
            <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100 text-center max-w-lg mx-auto space-y-3">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="text-sm font-bold text-amber-900">{compareError}</h3>
              <p className="text-xs text-amber-700 font-medium">
                Silakan lakukan upload screenshot dan simpan rincian YoYi terlebih dahulu pada tab "Rincian Serah Terima YoYi (OCR)" untuk tanggal ini.
              </p>
            </div>
          )}

          {/* Loading Skeleton */}
          {compareLoading && (
            <div className="space-y-4 animate-pulse">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {[1, 2, 3, 4, 5, 6, 7].map(i => (
                  <div key={i} className="h-20 bg-gray-100 rounded-xl"></div>
                ))}
              </div>
              <div className="h-64 bg-gray-100 rounded-2xl"></div>
            </div>
          )}

          {/* Result Dashboard */}
          {compareResult && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Total Resi YoYi</p>
                  <p className="font-mono text-xl font-black text-gray-800">{compareResult.total_yoyi_resi}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">E-commerce Skipped</p>
                  <p className="font-mono text-xl font-black text-gray-600">{compareResult.total_ecommerce_skip}</p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm flex flex-col justify-center">
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">FOUND & MATCH</p>
                  <p className="font-mono text-xl font-black text-emerald-700">
                    {compareResult.results?.filter((r: any) => r.audit_status === "FOUND" && r.payment_status === "MATCH").length || 0}
                  </p>
                </div>
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm flex flex-col justify-center">
                  <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider mb-1">MISSING (CRITICAL)</p>
                  <p className="font-mono text-xl font-black text-red-700">{compareResult.total_missing}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 shadow-sm flex flex-col justify-center">
                  <p className="text-[10px] text-purple-600 font-bold uppercase tracking-wider mb-1">Scope Mismatch</p>
                  <p className="font-mono text-xl font-black text-purple-700">{compareResult.total_scope_mismatch}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 shadow-sm flex flex-col justify-center">
                  <p className="text-[10px] text-orange-600 font-bold uppercase tracking-wider mb-1">Payment Mismatch</p>
                  <p className="font-mono text-xl font-black text-orange-700">
                    {compareResult.results?.filter((r: any) => r.payment_status === "MISMATCH").length || 0}
                  </p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 shadow-sm flex flex-col justify-center">
                  <p className="text-[10px] text-yellow-700 font-bold uppercase tracking-wider mb-1">Method Mismatch</p>
                  <p className="font-mono text-xl font-black text-yellow-800">
                    {compareResult.results?.filter((r: any) => r.method_status === "MISMATCH").length || 0}
                  </p>
                </div>
              </div>

              {/* Detailed Resi Results Table */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">Detail Hasil Perbandingan Resi YoYi vs Sistem</h3>
                    <p className="text-[10px] text-gray-400 font-medium">Lingkup Audit: Outlet {outlets.find(o => o.outlet_id === compareOutlet)?.nama_outlet || compareOutlet} • Tanggal {compareDate}</p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-xs text-left text-gray-700 divide-y divide-gray-100">
                    <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                      <tr>
                        <th className="p-3">Nomor Resi</th>
                        <th className="p-3">Sumber Order</th>
                        <th className="p-3">Status Audit</th>
                        <th className="p-3">Keterangan / Alasan</th>
                        <th className="p-3 text-right">Total YoYi</th>
                        <th className="p-3 text-right">Expected Internal</th>
                        <th className="p-3 text-right">Selisih</th>
                        <th className="p-3">Metode YoYi</th>
                        <th className="p-3">Metode Internal</th>
                        <th className="p-3">Admin Terkait</th>
                        <th className="p-3">Outlet Terkait</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-sans">
                      {compareResult.results?.map((res: any, idx: number) => {
                        let statusBadge = null;
                        if (res.audit_status === "FOUND") {
                          if (res.payment_status === "MATCH" && res.method_status === "MATCH") {
                            statusBadge = <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded text-[10px] font-bold">MATCH</span>;
                          } else {
                            statusBadge = <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded text-[10px] font-bold">FOUND</span>;
                          }
                        } else if (res.audit_status === "WARNING") {
                          statusBadge = <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded text-[10px] font-bold">WARNING</span>;
                        } else if (res.audit_status === "CRITICAL") {
                          statusBadge = <span className="bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded text-[10px] font-bold">CRITICAL</span>;
                        } else if (res.audit_status === "ECOMMERCE_SKIP") {
                          statusBadge = <span className="bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 rounded text-[10px] font-bold">SKIP</span>;
                        } else if (res.audit_status === "SCOPE_MISMATCH") {
                          statusBadge = <span className="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded text-[10px] font-bold">MISMATCH</span>;
                        }

                        return (
                          <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-3 font-mono font-bold text-gray-800">{res.resi_id}</td>
                            <td className="p-3 font-semibold text-gray-600">{res.sumber_order || "-"}</td>
                            <td className="p-3">{statusBadge}</td>
                            <td className="p-3 font-medium text-gray-600">
                              {res.audit_status === "CRITICAL" ? (
                                <span className="text-red-600 font-bold">Resi belum diinput ke sistem</span>
                              ) : res.audit_status === "ECOMMERCE_SKIP" ? (
                                <span className="text-gray-400">DILEWATI — Ecommerce</span>
                              ) : (
                                res.reason || <span className="text-emerald-600 font-semibold">Valid</span>
                              )}
                              {res.promo_candidate && (
                                <div className="text-[9px] mt-0.5 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                  <span className="text-purple-600">Potential Promo</span>
                                  <span className={res.promo_validation_status === "APPROVED" ? "text-emerald-600" : "text-amber-600"}>
                                    ({res.promo_validation_status || "UNAPPROVED"})
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono font-bold">
                              {res.total_yoyi !== null ? `Rp ${res.total_yoyi.toLocaleString("id-ID")}` : "-"}
                            </td>
                            <td className="p-3 text-right font-mono font-medium text-gray-600">
                              {res.expected_internal !== null ? `Rp ${res.expected_internal.toLocaleString("id-ID")}` : "-"}
                              {res.discount_from_yoyi > 0 && res.promo_validation_status === "APPROVED" && (
                                <p className="text-[8px] text-purple-600 font-bold mt-0.5">Diskon Terpotong</p>
                              )}
                            </td>
                            <td className={`p-3 text-right font-mono font-black ${res.difference > 0 ? "text-orange-600" : res.difference < 0 ? "text-red-600" : "text-gray-400"}`}>
                              {res.difference !== null && res.difference !== 0 ? (
                                `${res.difference > 0 ? "+" : ""}Rp ${res.difference.toLocaleString("id-ID")}`
                              ) : (
                                res.difference === 0 ? "Rp 0" : "-"
                              )}
                            </td>
                            <td className="p-3">
                              {res.metode_yoyi ? (
                                <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-600 font-semibold">{res.metode_yoyi}</span>
                              ) : "-"}
                            </td>
                            <td className="p-3">
                              {res.metode_internal ? (
                                <span className={`px-2 py-0.5 rounded font-semibold ${res.method_status === "MISMATCH" ? "bg-red-50 text-red-600 border border-red-100" : "bg-gray-100 text-gray-600"}`}>
                                  {res.metode_internal}
                                </span>
                              ) : "-"}
                            </td>
                            <td className="p-3 text-gray-500 font-medium">
                              {res.admin_id ? getAdminFullName(res.admin_id) : "-"}
                            </td>
                            <td className="p-3 text-gray-500 font-medium">
                              {res.outlet_id ? (outlets.find(o => o.outlet_id === res.outlet_id)?.nama_outlet || res.outlet_id) : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drawer Detail */}
      {selectedTx && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-50 border-l border-gray-100 flex flex-col transform transition-transform">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
               <Eye className="w-5 h-5 text-gray-500" /> Detail Transaksi
            </h3>
            <button onClick={() => setSelectedTx(null)} className="text-gray-400 hover:text-gray-700 transition-colors p-1 bg-white rounded-md shadow-sm border border-gray-200 cursor-pointer">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-white">
             <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Nomor Resi</p>
                <p className="font-mono text-2xl font-black text-gray-900">{selectedTx.resi_id}</p>
                <div className="flex gap-2 mt-2">
                   {getStatusBadge(selectedTx.audit_status)}
                   <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold">{selectedTx.tipe}</span>
                </div>
             </div>
             
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
             
             <div className={`rounded-xl p-4 border ${selectedTx.selisih < 0 ? "bg-red-50 border-red-100" : selectedTx.selisih > 0 ? "bg-emerald-50 border-emerald-100" : "bg-gray-50 border-gray-100"}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-gray-500">Analisis Selisih</p>
                <div className="flex justify-between items-center">
                   <span className="text-sm font-bold text-gray-800">Total Selisih</span>
                   <span className={`text-lg font-mono font-black ${selectedTx.selisih < 0 ? "text-red-600" : selectedTx.selisih > 0 ? "text-emerald-600" : "text-gray-600"}`}>
                     {selectedTx.selisih < 0 ? "-" : selectedTx.selisih > 0 ? "+" : ""}Rp {Math.abs(selectedTx.selisih).toLocaleString("id-ID")}
                   </span>
                </div>
                {selectedTx.selisih < 0 && (
                   <p className="text-[10px] text-red-600 mt-2 font-medium">⚠️ Resi ini mengalami margin negatif sebesar Rp {Math.abs(selectedTx.selisih).toLocaleString("id-ID")} karena total tagihan customer lebih kecil dari biaya YOYI/JTC.</p>
                )}
             </div>
          </div>
          
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
                className="flex-1 py-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 font-bold rounded-xl text-xs transition-colors border border-yellow-200 disabled:opacity-50 cursor-pointer"
              >
                {savingAudit ? "..." : "PERLU REVIEW"}
              </button>
              <button 
                onClick={() => handleSaveAudit("SESUAI")}
                disabled={savingAudit}
                className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs transition-colors border border-emerald-200 disabled:opacity-50 cursor-pointer"
              >
                {savingAudit ? "..." : "SESUAI"}
              </button>
            </div>
          </div>
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
             <button onClick={() => setSelectedTx(null)} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors cursor-pointer">Tutup Detail</button>
          </div>
        </div>
      )}
    </div>
  );
}
