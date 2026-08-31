import React, { useState, useEffect, useMemo } from "react";
import { 
  Wallet, Plus, Search, Filter, RefreshCw, Calendar, AlertCircle, Edit2, Trash2, 
  ArrowUpRight, ArrowDownRight, DollarSign, FileText, ExternalLink, Image, Building2, Eye, X,
  ChevronLeft, ChevronRight, Database, ArrowLeftRight, Landmark
} from "lucide-react";
import { useAppsScript } from "../../hooks/useAppsScript";
import { toast } from "../../utils/toast";
import { highlightText } from "../../utils/highlight";
import { getTodayWIB, getWIBDate } from "../../utils/dateUtils";
import { SessionData, Outlet, KeuanganOutlet, KategoriKeuangan, User, OpeningBalanceKasOutlet } from "../../types";

interface KeuanganOutletPageProps {
  session: SessionData;
  outlets: Outlet[];
  activeOutletId: string;
  onChangeActiveOutlet?: (id: string) => void;
}

export default function KeuanganOutletPage({ session, outlets, activeOutletId, onChangeActiveOutlet }: KeuanganOutletPageProps) {
  const { callBackend } = useAppsScript();
  const [loading, setLoading] = useState(false);
  const [ledgerList, setLedgerList] = useState<KeuanganOutlet[]>([]);
  const [openingBalance, setOpeningBalance] = useState<OpeningBalanceKasOutlet>({ total: 0, admin: 0, owner: 0 });
  const [categories, setCategories] = useState<KategoriKeuangan[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Date defaults (current month in Asia/Jakarta WIB)
  const todayStr = getTodayWIB();
  const firstDayOfMonth = `${todayStr.slice(0, 7)}-01`;

  const isAdmin = session.role === "ADMIN";

  // Filters
  const [filterTanggalAwal, setFilterTanggalAwal] = useState(firstDayOfMonth);
  const [filterTanggalAkhir, setFilterTanggalAkhir] = useState(todayStr);
  const [filterOutlet, setFilterOutlet] = useState(activeOutletId || "ALL");
  const [filterJenis, setFilterJenis] = useState<"ALL" | "PEMASUKAN" | "PENGELUARAN">("ALL");
  const [filterKategori, setFilterKategori] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Sync filterOutlet with global activeOutletId
  useEffect(() => {
    if (activeOutletId) {
      setFilterOutlet(activeOutletId);
      setFormOutletId(activeOutletId === "ALL" ? "" : activeOutletId);
    }
  }, [activeOutletId]);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KeuanganOutlet | null>(null);
  const [formJenis, setFormJenis] = useState<"PEMASUKAN" | "PENGELUARAN" | "TRANSFER_INTERNAL">("PENGELUARAN");
  const [formTanggal, setFormTanggal] = useState(todayStr);
  const [formOutletId, setFormOutletId] = useState(activeOutletId === "ALL" ? "" : activeOutletId);
  const [formKategoriId, setFormKategoriId] = useState("");
  const [formNominal, setFormNominal] = useState<number | "">("");
  const [formDeskripsi, setFormDeskripsi] = useState("");
  const [formBuktiUrl, setFormBuktiUrl] = useState("");
  const [formLokasiUang, setFormLokasiUang] = useState<"ADMIN" | "OWNER">("ADMIN");
  const [submitting, setSubmitting] = useState(false);

  // Modal View Bukti State
  const [previewBuktiUrl, setPreviewBuktiUrl] = useState<string | null>(null);

  const [backfilling, setBackfilling] = useState(false);

  // Trigger Backfill Historis
  const handleRunBackfill = async () => {
    if (!window.confirm("Jalankan sinkronisasi / backfill otomatis data biaya amplop & packing dari seluruh transaksi historis ke Kas Outlet?")) {
      return;
    }
    setBackfilling(true);
    try {
      const res = await callBackend("backfillKeuanganOutlet", { action: "apiBackfillKeuanganOutletFromTransactions" });
      if (res.status === "success") {
        toast.success(res.message || `Backfill selesai (${res.created_count || 0} entry ditambahkan)`);
        await fetchLedger();
      } else {
        toast.error(res.message || "Gagal menjalankan backfill.");
      }
    } catch (err: any) {
      console.error("Backfill error", err);
      toast.error(err?.message || "Terjadi kesalahan saat backfill.");
    } finally {
      setBackfilling(false);
    }
  };

  // Fetch Categories, Users & Ledger
  const fetchCategories = async () => {
    try {
      const res = await callBackend("getKategoriKeuangan");
      if (res.status === "success" && Array.isArray(res.data)) {
        const unique = Array.from(new Map(res.data.map((x: KategoriKeuangan) => [x.id, x])).values());
        setCategories(unique);
      }
    } catch (err) {
      console.error("Fetch categories error", err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await callBackend("getUsers");
      if (res && res.status === "success" && Array.isArray(res.data)) {
        setUsers(res.data);
      }
    } catch (err) {
      console.error("Fetch users error", err);
    }
  };

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const res深 = await callBackend("getKeuanganOutlet", {
        tanggal_awal: filterTanggalAwal,
        tanggal_akhir: filterTanggalAkhir,
        outlet_id: filterOutlet,
        jenis: filterJenis,
        kategori_id: filterKategori
      });
      if (res深.status === "success" && Array.isArray(res深.data)) {
        setLedgerList(res深.data);
        if (res深.opening_balance) {
          setOpeningBalance(res深.opening_balance);
        } else {
          setOpeningBalance({ total: 0, admin: 0, owner: 0 });
        }
      } else {
        toast.error(res深.message || "Gagal memuat ledger keuangan outlet.");
      }
    } catch (err) {
      console.error("Fetch ledger error", err);
      toast.error("Terjadi kesalahan saat mengambil data keuangan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchUsers();
  }, []);

  // Helper to resolve admin full name
  const getAdminName = (rawDibuatOleh?: string) => {
    if (!rawDibuatOleh) return "-";
    const found = users.find(
      (u) =>
        u.user_id === rawDibuatOleh ||
        u.username?.toLowerCase() === rawDibuatOleh.toLowerCase() ||
        u.nama_lengkap?.toLowerCase() === rawDibuatOleh.toLowerCase()
    );
    if (found?.nama_lengkap) return found.nama_lengkap;
    if (session?.user_id === rawDibuatOleh || session?.username?.toLowerCase() === rawDibuatOleh.toLowerCase()) {
      return session.nama_lengkap || session.username;
    }
    return rawDibuatOleh;
  };

  useEffect(() => {
    fetchLedger();
  }, [filterTanggalAwal, filterTanggalAkhir, filterOutlet, filterJenis, filterKategori]);

  // Active categories for forms
  const activeCategoriesForJenis = useMemo(() => {
    if (formJenis === "TRANSFER_INTERNAL") {
      return [
        { id: "KAT-TRANSFER-ADMIN-TO-OWNER", nama: "Transfer Kas Admin ke Owner (Admin -> Owner)", jenis: "TRANSFER_INTERNAL", aktif: true },
        { id: "KAT-TRANSFER-OWNER-TO-ADMIN", nama: "Transfer Dana Owner ke Admin (Owner -> Admin)", jenis: "TRANSFER_INTERNAL", aktif: true }
      ];
    }
    return categories.filter(c => c.aktif && c.jenis === formJenis);
  }, [categories, formJenis]);

  // Client side search filter
  const displayedList = useMemo(() => {
    if (!searchQuery.trim()) return ledgerList;
    const q = searchQuery.toLowerCase().trim();
    return ledgerList.filter((item) => 
      item.kategori_nama?.toLowerCase().includes(q) ||
      item.deskripsi?.toLowerCase().includes(q) ||
      item.nama_outlet?.toLowerCase().includes(q) ||
      item.dibuat_oleh?.toLowerCase().includes(q) ||
      getAdminName(item.dibuat_oleh).toLowerCase().includes(q)
    );
  }, [ledgerList, searchQuery, users, session]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterOutlet, filterJenis, filterKategori, filterTanggalAwal, filterTanggalAkhir]);

  const totalPages = Math.ceil(displayedList.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    return displayedList.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [displayedList, currentPage, pageSize]);

  // Calculate Summary Cards & Balance Ledger
  const totalPemasukan = useMemo(() => {
    return ledgerList
      .filter((x) => x.jenis === "PEMASUKAN")
      .reduce((sum, x) => sum + (x.nominal || 0), 0);
  }, [ledgerList]);

  const totalPengeluaran = useMemo(() => {
    return ledgerList
      .filter((x) => x.jenis === "PENGELUARAN")
      .reduce((sum, x) => sum + (x.nominal || 0), 0);
  }, [ledgerList]);

  // Mutasi Bersih Periode
  const mutasiBersihPeriode = useMemo(() => {
    return totalPemasukan - totalPengeluaran;
  }, [totalPemasukan, totalPengeluaran]);

  // Mutasi Kas Admin & Owner dalam periode filter
  const mutasiAdminPeriode = useMemo(() => {
    let sum = 0;
    ledgerList.forEach(x => {
      const isOwner = x.lokasi_uang === "OWNER";
      const isAdmin = x.lokasi_uang === "ADMIN" || (!isOwner && x.jenis === "PEMASUKAN"); // Default tunai is admin
      
      if (x.jenis === "PEMASUKAN" && !isOwner) sum += (x.nominal || 0);
      else if (x.jenis === "PENGELUARAN" && isAdmin) sum -= (x.nominal || 0);
      else if (x.jenis === "TRANSFER_INTERNAL") {
        if (x.lokasi_uang === "ADMIN") {
          // Transfer Admin -> Owner (Admin berkurang)
          sum -= (x.nominal || 0);
        } else {
          // Transfer Owner -> Admin (Admin bertambah)
          sum += (x.nominal || 0);
        }
      }
    });
    return sum;
  }, [ledgerList]);

  const mutasiOwnerPeriode = useMemo(() => {
    let sum = 0;
    ledgerList.forEach(x => {
      const isOwner = x.lokasi_uang === "OWNER";
      
      if (x.jenis === "PEMASUKAN" && isOwner) sum += (x.nominal || 0);
      else if (x.jenis === "PENGELUARAN" && isOwner) sum -= (x.nominal || 0);
      else if (x.jenis === "TRANSFER_INTERNAL") {
        if (x.lokasi_uang === "ADMIN") {
          // Transfer Admin -> Owner (Owner bertambah)
          sum += (x.nominal || 0);
        } else {
          // Transfer Owner -> Admin (Owner berkurang)
          sum -= (x.nominal || 0);
        }
      }
    });
    return sum;
  }, [ledgerList]);

  // Saldo Akhir Kumulatif = Saldo Awal + Mutasi Periode
  const saldoAkhirTotal = useMemo(() => {
    return (openingBalance.total || 0) + mutasiBersihPeriode;
  }, [openingBalance.total, mutasiBersihPeriode]);

  const saldoAkhirAdmin = useMemo(() => {
    return (openingBalance.admin || 0) + mutasiAdminPeriode;
  }, [openingBalance.admin, mutasiAdminPeriode]);

  const saldoAkhirOwner = useMemo(() => {
    return (openingBalance.owner || 0) + mutasiOwnerPeriode;
  }, [openingBalance.owner, mutasiOwnerPeriode]);

  // Open Add Modal
  const handleOpenAdd = (jenis: "PEMASUKAN" | "PENGELUARAN" | "TRANSFER_INTERNAL") => {
    setEditingItem(null);
    setFormJenis(jenis);
    setFormTanggal(todayStr);
    setFormOutletId(session.outlet_id_home || (outlets[0]?.outlet_id || ""));
    
    // Auto select first active category for this jenis
    if (jenis === "TRANSFER_INTERNAL") {
      if (isAdmin) {
        // ADMIN -> OWNER
        setFormKategoriId("KAT-TRANSFER-ADMIN-TO-OWNER");
        setFormLokasiUang("ADMIN");
      } else {
        // OWNER -> ADMIN
        setFormKategoriId("KAT-TRANSFER-OWNER-TO-ADMIN");
        setFormLokasiUang("OWNER");
      }
    } else {
      const matchingCat = categories.find(c => c.aktif && c.jenis === jenis);
      setFormKategoriId(matchingCat ? matchingCat.id : "");
      setFormLokasiUang("ADMIN");
    }
    
    setFormNominal("");
    setFormDeskripsi("");
    setFormBuktiUrl("");
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: KeuanganOutlet) => {
    setEditingItem(item);
    setFormJenis(item.jenis);
    setFormTanggal(item.tanggal);
    setFormOutletId(item.outlet_id);
    setFormKategoriId(item.kategori_id);
    setFormNominal(item.nominal);
    setFormDeskripsi(item.deskripsi || "");
    setFormBuktiUrl(item.bukti_url || "");
    setFormLokasiUang(item.lokasi_uang || "ADMIN");
    setModalOpen(true);
  };

  // Image Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setFormBuktiUrl(result);
      toast.success("Bukti transaksi berhasil diunggah.");
    };
    reader.readAsDataURL(file);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKategoriId) {
      toast.error("Silakan pilih kategori keuangan.");
      return;
    }
    if (!formNominal || Number(formNominal) <= 0) {
      toast.error("Nominal transaksi harus lebih dari 0.");
      return;
    }
    if (!formTanggal) {
      toast.error("Tanggal transaksi wajib diisi.");
      return;
    }
    if (!formOutletId) {
      toast.error("Outlet wajib dipilih.");
      return;
    }

    setSubmitting(true);
    try {
      if (editingItem) {
        const res = await callBackend("updateKeuanganOutlet", {
          id: editingItem.id,
          tanggal: formTanggal,
          outlet_id: formOutletId,
          kategori_id: formKategoriId,
          nominal: Number(formNominal),
          deskripsi: formDeskripsi.trim(),
          bukti_url: formBuktiUrl,
          lokasi_uang: formLokasiUang,
          user_role: session.role,
          user_id: session.user_id
        });
        if (res.status === "success") {
          toast.success(res.message || "Transaksi berhasil diperbarui.");
          setModalOpen(false);
          fetchLedger();
        } else {
          toast.error(res.message || "Gagal memperbarui transaksi.");
        }
      } else {
        const res = await callBackend("saveKeuanganOutlet", {
          tanggal: formTanggal,
          outlet_id: formOutletId,
          kategori_id: formKategoriId,
          nominal: Number(formNominal),
          deskripsi: formDeskripsi.trim(),
          bukti_url: formBuktiUrl,
          lokasi_uang: formLokasiUang,
          dibuat_oleh: session.nama_lengkap || session.username || session.role || "SYSTEM",
          user_role: session.role,
          user_id: session.user_id
        });
        if (res.status === "success") {
          toast.success(res.message || "Transaksi berhasil dicatat.");
          setModalOpen(false);
          fetchLedger();
        } else {
          toast.error(res.message || "Gagal mencatat transaksi.");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan koneksi saat menyimpan data.");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete / Soft-Delete Handler
  const handleDelete = async (item: KeuanganOutlet) => {
    if (!window.confirm(`Nonaktifkan catatan ${item.jenis} sebesar Rp ${item.nominal.toLocaleString("id-ID")} (${item.kategori_nama})?`)) {
      return;
    }

    try {
      const res = await callBackend("deleteKeuanganOutlet", { id: item.id, user_role: session.role, user_id: session.user_id });
      if (res.status === "success") {
        toast.success("Catatan keuangan dinonaktifkan.");
        fetchLedger();
      } else {
        toast.error(res.message || "Gagal menonaktifkan catatan.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal terhubung ke server.");
    }
  };

  // Role Guard
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    return (
      <div className="p-6 max-w-4xl mx-auto mt-8">
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl flex items-center gap-4 shadow-sm">
          <AlertCircle className="h-8 w-8 text-red-500 shrink-0" />
          <div>
            <h3 className="font-extrabold text-base">Akses Ditolak</h3>
            <p className="text-xs text-red-600 mt-1">
              Modul Kas Outlet (Ledger) khusus untuk pengguna dengan wewenang <strong>OWNER</strong> atau <strong>ADMIN</strong>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in pb-28">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-150">
        <div className="flex items-center gap-3.5">
          <div className="bg-purple-500/10 p-3 rounded-2xl text-purple-700">
            <Wallet className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-gray-800 tracking-tight">
                Kas Outlet (Cash Ledger)
              </h1>
              <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
                Operasional
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">
              Pencatatan kas operasional pengeluaran & pemasukan luar transaksi paket customer.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunBackfill}
            disabled={backfilling || loading}
            className="px-3.5 py-2.5 text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="Sinkronisasi / Backfill otomatis Amplop & Packing dari transaksi"
          >
            <Database className={`h-4 w-4 ${backfilling ? "animate-spin text-purple-600" : ""}`} />
            <span className="hidden sm:inline">{backfilling ? "Sinkronisasi..." : "Backfill Transaksi"}</span>
          </button>

          <button
            onClick={fetchLedger}
            disabled={loading}
            className="p-2.5 text-gray-500 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-purple-600" : ""}`} />
          </button>
          
          <button
            onClick={() => handleOpenAdd("PEMASUKAN")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/10 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>+ Pemasukan</span>
          </button>

          <button
            onClick={() => handleOpenAdd("PENGELUARAN")}
            className="bg-[#E4002B] hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-red-500/10 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>+ Pengeluaran</span>
          </button>
          <button
            onClick={() => handleOpenAdd("TRANSFER_INTERNAL")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/10 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>{isAdmin ? "Transfer Kas ke Owner" : "Transfer ke Admin"}</span>
          </button>
        </div>
      </div>

      {/* Summary Cards: 3-Tier Continuous Ledger System */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Saldo Awal (Bawaan Sebelum Filter) */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                Saldo Awal
              </span>
              <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
                <Landmark className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-xl md:text-2xl font-black text-slate-800 font-mono">
                Rp {(openingBalance.total || 0).toLocaleString("id-ID")}
              </span>
              <p className="text-[10px] text-gray-400 mt-0.5">Saldo kas kumulatif sebelum {filterTanggalAwal}</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-gray-400 block text-[10px] font-semibold">Kas Fisik Admin</span>
              <span className="font-mono font-bold text-gray-700">Rp {(openingBalance.admin || 0).toLocaleString("id-ID")}</span>
            </div>
            <div className="text-right">
              <span className="text-gray-400 block text-[10px] font-semibold">Kas Digital Owner</span>
              <span className="font-mono font-bold text-purple-700">Rp {(openingBalance.owner || 0).toLocaleString("id-ID")}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Mutasi Periode (Pemasukan, Pengeluaran, Mutasi Bersih) */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                Mutasi Periode
              </span>
              <div className={`p-2 rounded-xl ${mutasiBersihPeriode >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                <ArrowLeftRight className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className={`text-xl md:text-2xl font-black font-mono ${mutasiBersihPeriode >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {mutasiBersihPeriode >= 0 ? "+" : ""}Rp {mutasiBersihPeriode.toLocaleString("id-ID")}
              </span>
              <p className="text-[10px] text-gray-400 mt-0.5">Pemasukan - Pengeluaran dalam periode filter</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-gray-400 block text-[10px] font-semibold">Pemasukan</span>
              <span className="font-mono font-bold text-emerald-600">+Rp {totalPemasukan.toLocaleString("id-ID")}</span>
            </div>
            <div className="text-right">
              <span className="text-gray-400 block text-[10px] font-semibold">Pengeluaran</span>
              <span className="font-mono font-bold text-red-600">-Rp {totalPengeluaran.toLocaleString("id-ID")}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Saldo Akhir (Total Hak Kas Outlet Kumulatif) */}
        <div className="bg-gradient-to-br from-purple-900 to-indigo-950 p-5 rounded-2xl text-white shadow-md shadow-purple-950/20 relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-purple-200 uppercase tracking-wider">
                Total Saldo Kas Outlet
              </span>
              <div className="p-2 bg-white/10 text-white rounded-xl backdrop-blur-sm">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-xl md:text-2xl font-black text-white font-mono tracking-tight">
                Rp {saldoAkhirTotal.toLocaleString("id-ID")}
              </span>
              <p className="text-[10px] text-purple-200/80 mt-0.5">Saldo Awal + Mutasi Bersih</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-purple-300 block text-[10px] font-semibold">Kas Fisik (Admin)</span>
              <span className="font-mono font-bold text-emerald-300">Rp {saldoAkhirAdmin.toLocaleString("id-ID")}</span>
            </div>
            <div className="text-right">
              <span className="text-purple-300 block text-[10px] font-semibold">Kas Digital (Owner)</span>
              <span className="font-mono font-bold text-purple-200">Rp {saldoAkhirOwner.toLocaleString("id-ID")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4.5 rounded-2xl shadow-sm border border-gray-150 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Tanggal Awal */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs">
            <Calendar className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-gray-500 font-bold">Awal:</span>
            <input
              type="date"
              value={filterTanggalAwal}
              onChange={(e) => setFilterTanggalAwal(e.target.value)}
              className="bg-transparent font-semibold text-gray-800 focus:outline-none"
            />
          </div>

          {/* Tanggal Akhir */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs">
            <Calendar className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-gray-500 font-bold">Akhir:</span>
            <input
              type="date"
              value={filterTanggalAkhir}
              onChange={(e) => setFilterTanggalAkhir(e.target.value)}
              className="bg-transparent font-semibold text-gray-800 focus:outline-none"
            />
          </div>

          {/* Outlet Filter */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs">
            <Building2 className="h-3.5 w-3.5 text-gray-400" />
            {isAdmin ? (
              <span className="font-bold text-gray-800">
                {outlets.find(o => o.outlet_id === activeOutletId)?.nama_outlet || activeOutletId}
              </span>
            ) : (
              <select
                value={filterOutlet}
                onChange={(e) => {
                  setFilterOutlet(e.target.value);
                  if (onChangeActiveOutlet) onChangeActiveOutlet(e.target.value);
                }}
                className="bg-transparent font-bold text-gray-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Outlet</option>
                {outlets.map((o) => (
                  <option key={o.outlet_id} value={o.outlet_id}>
                    {o.nama_outlet}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Jenis Filter */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs">
            <Filter className="h-3.5 w-3.5 text-gray-400" />
            <select
              value={filterJenis}
              onChange={(e) => setFilterJenis(e.target.value as any)}
              className="bg-transparent font-bold text-gray-800 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Jenis</option>
              <option value="PEMASUKAN">Pemasukan</option>
              <option value="PENGELUARAN">Pengeluaran</option>
            </select>
          </div>

          {/* Kategori Filter */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs">
            <span className="text-gray-500 font-bold">Kategori:</span>
            <select
              value={filterKategori}
              onChange={(e) => setFilterKategori(e.target.value)}
              className="bg-transparent font-bold text-gray-800 focus:outline-none cursor-pointer max-w-[160px]"
            >
              <option value="ALL">Semua Kategori</option>
              {categories.map((c, idx) => (
                <option key={`${c.id}-${idx}`} value={c.id}>
                  {c.jenis === "PEMASUKAN" ? "[+] " : "[-] "}{c.nama}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari deskripsi, nama kategori, outlet, atau operator..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
          />
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-150 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-xl w-full"></div>
            ))}
          </div>
        ) : displayedList.length === 0 ? (
          <div className="p-12 text-center text-gray-400 space-y-2">
            <Wallet className="h-10 w-10 mx-auto text-gray-300 stroke-[1.5]" />
            <p className="text-sm font-bold text-gray-700">Belum ada kas outlet.</p>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              Belum ada data pemasukan atau pengeluaran operasional dalam periode filter ini.
            </p>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[750px]">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-150 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-28">Tanggal</th>
                    <th className="py-3.5 px-4">Outlet</th>
                    <th className="py-3.5 px-4 w-28">Jenis</th>
                    <th className="py-3.5 px-4">Kategori</th>
                    <th className="py-3.5 px-4 text-right w-36">Nominal</th>
                    <th className="py-3.5 px-4">Deskripsi</th>
                    <th className="py-3.5 px-4 w-28">Operator</th>
                    <th className="py-3.5 px-4 text-center w-20">Bukti</th>
                    <th className="py-3.5 px-4 text-right w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                  {paginatedList.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                      {/* Tanggal */}
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-900 whitespace-nowrap">
                        {item.tanggal}
                      </td>

                      {/* Outlet */}
                      <td className="py-3.5 px-4 font-semibold text-gray-800">
                        <span>{item.nama_outlet || item.outlet_id}</span>
                      </td>

                      {/* Jenis */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-block w-fit px-2.5 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider ${
                            item.jenis === "PEMASUKAN"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : item.jenis === "TRANSFER_INTERNAL"
                              ? "bg-blue-50 text-blue-700 border border-blue-100"
                              : "bg-red-50 text-red-700 border border-red-100"
                          }`}>
                            {item.jenis === "PEMASUKAN" ? "+ Pemasukan" : item.jenis === "TRANSFER_INTERNAL" ? "⟲ Transfer" : "- Pengeluaran"}
                          </span>
                          <span className={`inline-block w-fit px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            item.jenis === "TRANSFER_INTERNAL"
                              ? item.lokasi_uang === "ADMIN"
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : "bg-purple-50 text-purple-700 border border-purple-100"
                              : item.lokasi_uang === "OWNER"
                              ? "bg-purple-50 text-purple-700 border border-purple-100" 
                              : "bg-gray-100 text-gray-700 border border-gray-200"
                          }`}>
                            {item.jenis === "TRANSFER_INTERNAL"
                              ? item.lokasi_uang === "ADMIN"
                                ? "Admin ➔ Owner"
                                : "Owner ➔ Admin"
                              : item.lokasi_uang === "OWNER"
                              ? "Di Owner"
                              : "Di Admin"}
                          </span>
                        </div>
                      </td>

                      {/* Kategori */}
                      <td className="py-3.5 px-4 font-bold text-gray-900">
                        {item.kategori_nama ? highlightText(item.kategori_nama, searchQuery) : "-"}
                      </td>

                      {/* Nominal */}
                      <td className={`py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap ${
                        item.jenis === "PEMASUKAN" 
                          ? "text-emerald-700" 
                          : item.jenis === "TRANSFER_INTERNAL" 
                          ? "text-blue-700" 
                          : "text-red-600"
                      }`}>
                        {item.jenis === "PEMASUKAN" ? "+" : item.jenis === "TRANSFER_INTERNAL" ? "⟲" : "-"} Rp {item.nominal.toLocaleString("id-ID")}
                      </td>

                      {/* Deskripsi */}
                      <td className="py-3.5 px-4 text-gray-600 max-w-xs truncate" title={item.deskripsi}>
                        {item.deskripsi ? highlightText(item.deskripsi, searchQuery) : <span className="text-gray-300 font-normal italic">-</span>}
                      </td>

                      {/* Operator (Nama Admin) */}
                      <td className="py-3.5 px-4 text-gray-700 font-medium">
                        {highlightText(getAdminName(item.dibuat_oleh), searchQuery)}
                      </td>

                      {/* Bukti */}
                      <td className="py-3.5 px-4 text-center">
                        {item.bukti_url ? (
                          <button
                            onClick={() => setPreviewBuktiUrl(item.bukti_url || null)}
                            className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                            title="Lihat Bukti Transaksi"
                          >
                            <Image className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="text-gray-300 text-[10px] italic">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-gray-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Catatan"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Nonaktifkan / Hapus Catatan"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
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
                  Menampilkan {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, displayedList.length)} dari {displayedList.length} data
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

      {/* MODAL INPUT / EDIT */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-150 w-full max-w-lg overflow-hidden animate-scale-in">
            <div className={`p-5 border-b border-gray-100 flex items-center justify-between ${
              formJenis === "PEMASUKAN" ? "bg-emerald-50/60" : "bg-red-50/60"
            }`}>
              <h3 className="text-sm font-extrabold text-gray-800 flex items-center gap-2">
                <Wallet className={`h-4 w-4 ${formJenis === "PEMASUKAN" ? "text-emerald-600" : "text-[#E4002B]"}`} />
                <span>
                  {editingItem ? "Edit Transaksi Keuangan" : `Tambah ${formJenis === "PEMASUKAN" ? "Pemasukan Non-Transaksi" : "Pengeluaran Operasional"}`}
                </span>
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Toggle Jenis (If creating new) */}
              {!editingItem && (
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setFormJenis("PENGELUARAN");
                      const matchingCat = categories.find(c => c.aktif && c.jenis === "PENGELUARAN");
                      setFormKategoriId(matchingCat ? matchingCat.id : "");
                    }}
                    className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                      formJenis === "PENGELUARAN"
                        ? "bg-[#E4002B] text-white shadow-xs"
                        : "text-gray-600 hover:text-gray-800"
                    }`}
                  >
                    - Pengeluaran
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormJenis("PEMASUKAN");
                      const matchingCat = categories.find(c => c.aktif && c.jenis === "PEMASUKAN");
                      setFormKategoriId(matchingCat ? matchingCat.id : "");
                    }}
                    className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                      formJenis === "PEMASUKAN"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-gray-600 hover:text-gray-800"
                    }`}
                  >
                    + Pemasukan
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Tanggal */}
                <div>
                  <label className="block text-[11px] font-extrabold text-gray-700 mb-1">
                    Tanggal <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formTanggal}
                    onChange={(e) => setFormTanggal(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>

                {/* Outlet */}
                <div>
                  <label className="block text-[11px] font-extrabold text-gray-700 mb-1">
                    Outlet <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    disabled={isAdmin}
                    value={formOutletId}
                    onChange={(e) => setFormOutletId(e.target.value)}
                    className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 ${isAdmin ? "opacity-75 bg-gray-100 cursor-not-allowed" : "bg-white cursor-pointer"}`}
                  >
                    {outlets.map((o) => (
                      <option key={o.outlet_id} value={o.outlet_id}>
                        {o.nama_outlet}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Kategori Dropdown */}
              <div>
                <label className="block text-[11px] font-extrabold text-gray-700 mb-1">
                  Kategori {formJenis === "PEMASUKAN" ? "Pemasukan" : formJenis === "TRANSFER_INTERNAL" ? "Transfer" : "Pengeluaran"} <span className="text-red-500">*</span>
                </label>
                {activeCategoriesForJenis.length === 0 ? (
                  <p className="text-xs text-red-500 bg-red-50 p-2.5 rounded-xl border border-red-100">
                    Belum ada kategori {formJenis.toLowerCase()} aktif. Buka menu Master Kategori Keuangan untuk menambahnya.
                  </p>
                ) : (
                  <select
                    required
                    value={formKategoriId}
                    onChange={(e) => {
                      const newCatId = e.target.value;
                      setFormKategoriId(newCatId);
                      if (formJenis === "TRANSFER_INTERNAL") {
                        if (newCatId === "KAT-TRANSFER-ADMIN-TO-OWNER") {
                          setFormLokasiUang("ADMIN");
                        } else if (newCatId === "KAT-TRANSFER-OWNER-TO-ADMIN") {
                          setFormLokasiUang("OWNER");
                        }
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer"
                  >
                    {activeCategoriesForJenis.map((c, idx) => (
                      <option key={`${c.id}-${idx}`} value={c.id}>
                        {c.nama}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Nominal */}
              <div>
                <label className="block text-[11px] font-extrabold text-gray-700 mb-1">
                  Nominal (Rp) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  placeholder="Contoh: 50000"
                  value={formNominal}
                  onChange={(e) => setFormNominal(e.target.value ? Number(e.target.value) : "")}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              {/* Lokasi Uang */}
              <div>
                <label className="block text-[11px] font-extrabold text-gray-700 mb-1">
                  {formJenis === "TRANSFER_INTERNAL" ? "Sumber Dana / Arah Transfer" : "Lokasi Uang"} <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  disabled={formJenis === "TRANSFER_INTERNAL"}
                  value={formLokasiUang}
                  onChange={(e) => setFormLokasiUang(e.target.value as "ADMIN" | "OWNER")}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer disabled:bg-gray-100 disabled:text-gray-700"
                >
                  <option value="ADMIN">{formJenis === "TRANSFER_INTERNAL" ? "Dari Kas Fisik Admin -> Disetor ke Rekening Owner" : "Di Admin (Kas Fisik Laci)"}</option>
                  <option value="OWNER">{formJenis === "TRANSFER_INTERNAL" ? "Dari Rekening Digital Owner -> Ditarik/Diberikan ke Admin" : "Di Owner (Rekening Digital)"}</option>
                </select>
                {formJenis === "TRANSFER_INTERNAL" && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    {formLokasiUang === "ADMIN" 
                      ? "Kas Fisik Admin berkurang, Kas Digital Owner bertambah (Total Saldo Kas Outlet tetap)." 
                      : "Kas Digital Owner berkurang, Kas Fisik Admin bertambah (Total Saldo Kas Outlet tetap)."}
                  </p>
                )}
              </div>

              {/* Deskripsi */}
              <div>
                <label className="block text-[11px] font-extrabold text-gray-700 mb-1">
                  Deskripsi / Catatan (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Pembelian isi ulang galon & air minum admin..."
                  value={formDeskripsi}
                  onChange={(e) => setFormDeskripsi(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              {/* Upload Bukti */}
              <div>
                <label className="block text-[11px] font-extrabold text-gray-700 mb-1">
                  Bukti Transaksi / Nota (Opsional)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
                  />
                  {formBuktiUrl && (
                    <button
                      type="button"
                      onClick={() => setFormBuktiUrl("")}
                      className="text-xs text-red-500 hover:underline cursor-pointer"
                    >
                      Hapus
                    </button>
                  )}
                </div>
                {formBuktiUrl && (
                  <div className="mt-2">
                    <img
                      src={formBuktiUrl}
                      alt="Preview Bukti"
                      className="h-20 w-auto object-cover rounded-xl border border-gray-200"
                    />
                  </div>
                )}
              </div>

              {/* Form Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || activeCategoriesForJenis.length === 0}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer disabled:opacity-50 ${
                    formJenis === "PEMASUKAN"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : formJenis === "TRANSFER_INTERNAL"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-[#E4002B] hover:bg-red-700"
                  }`}
                >
                  {submitting ? "Menyimpan..." : "Simpan Catatan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PREVIEW BUKTI */}
      {previewBuktiUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-lg w-full relative">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h4 className="text-xs font-extrabold text-gray-800">Bukti Transaksi</h4>
              <button
                onClick={() => setPreviewBuktiUrl(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 flex justify-center bg-gray-900/5">
              <img
                src={previewBuktiUrl}
                alt="Bukti Transaksi"
                className="max-h-[70vh] w-auto object-contain rounded-xl shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
