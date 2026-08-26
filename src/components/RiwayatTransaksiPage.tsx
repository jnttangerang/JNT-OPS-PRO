import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  Eye, 
  MapPin, 
  Package, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  Pencil, 
  Ban, 
  X, 
  Save, 
  User, 
  Phone, 
  FileText, 
  DollarSign, 
  CheckCircle2,
  Clock,
  Building2,
  Calendar,
  Filter,
  Truck
} from "lucide-react";
import useAppsScript from "../hooks/useAppsScript";
import { SessionData, Outlet, User as UserType } from "../types";
import { getTodayWIB } from "../utils/dateUtils";
import { toast } from "../utils/toast";
import { highlightText } from "../utils/highlight";
import BulkImportYoYiModal from "./BulkImportYoYiModal";

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
  nama_barang: string;
  status_resi: string;
}

interface TransaksiDetail {
  resi_id: string;
  transaksi_id: string;
  timestamp: string;
  tipe: "Express" | "Cargo";
  tipe_produk: string;
  admin_id: string;
  admin_name: string;
  outlet_id: string;
  outlet_name: string;
  nama_pengirim: string;
  hp_pengirim: string;
  alamat_pengirim: string;
  nama_penerima: string;
  hp_penerima: string;
  alamat_penerima: string;
  nama_barang: string;
  berat_kg: number;
  ongkir_dasar: number;
  biaya_asuransi: number;
  biaya_packing: number;
  biaya_amplop: number;
  biaya_lain: number;
  grand_total: number;
  setoran_ke_owner: number;
  kas_operasional: number;
  metode_bayar: string;
  status_resi: string;
  catatan?: string;
}

export default function RiwayatTransaksiPage({ session, outlets, activeOutletId }: RiwayatTransaksiPageProps) {
  const { callBackend } = useAppsScript();
  const [data, setData] = useState<TransaksiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserType[]>([]);
  
  const todayStr = getTodayWIB();
  
  const [filterTanggalAwal, setFilterTanggalAwal] = useState(todayStr);
  const [filterTanggalAkhir, setFilterTanggalAkhir] = useState(todayStr);
  const [filterOutlet, setFilterOutlet] = useState<string>(session.role === "OWNER" ? "ALL" : (activeOutletId || session.outlet_id_home));
  const [filterAdmin, setFilterAdmin] = useState<string>("ALL");
  const [filterEkspedisi, setFilterEkspedisi] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [jumpPage, setJumpPage] = useState("");

  // Detail Modal State
  const [selectedDetail, setSelectedDetail] = useState<TransaksiDetail | null>(null);
  
  // Bulk Import State
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Edit Modal State
  const [editItem, setEditItem] = useState<TransaksiDetail | null>(null);
  const [originalResiId, setOriginalResiId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Cancel Confirmation Modal State
  const [cancelTarget, setCancelTarget] = useState<TransaksiItem | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (session.role !== "OWNER" && activeOutletId) {
      setFilterOutlet(activeOutletId);
    }
  }, [activeOutletId, session.role]);

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

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await callBackend("getRiwayatTransaksi", { 
        filterOutlet,
        tanggal_awal: filterTanggalAwal,
        tanggal_akhir: filterTanggalAkhir
      });
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
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterOutlet, filterTanggalAwal, filterTanggalAkhir]);

  const getAdminName = (rawAdmin: string) => {
    if (!rawAdmin) return "-";
    const found = users.find(
      (u) =>
        u.user_id === rawAdmin ||
        u.username?.toLowerCase() === rawAdmin.toLowerCase() ||
        u.nama_lengkap?.toLowerCase() === rawAdmin.toLowerCase()
    );
    if (found?.nama_lengkap) return found.nama_lengkap;
    return rawAdmin;
  };

  // Distinct list of Admins for filter dropdown (Hanya admin yang ada di data transaksi saat ini & tanpa duplikat)
  const adminOptions = useMemo(() => {
    const seenNames = new Set<string>();
    const options: { id: string; name: string }[] = [];

    data.forEach((item) => {
      if (!item.admin || item.admin.trim() === "" || item.admin === "-") return;
      const displayName = getAdminName(item.admin);
      if (!displayName || displayName === "-") return;

      const normalized = displayName.trim().toLowerCase();
      if (!seenNames.has(normalized)) {
        seenNames.add(normalized);
        options.push({
          id: displayName,
          name: displayName
        });
      }
    });

    return options.sort((a, b) => a.name.localeCompare(b.name, "id-ID"));
  }, [data, users]);

  // Reset filterAdmin jika nama admin tidak ada di transaksi saat ini
  useEffect(() => {
    if (filterAdmin !== "ALL" && !adminOptions.some((opt) => opt.id.toLowerCase() === filterAdmin.toLowerCase())) {
      setFilterAdmin("ALL");
    }
  }, [adminOptions, filterAdmin]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterOutlet, filterAdmin, filterEkspedisi]);

  const filteredData = data.filter((item) => {
    // 1. Ekspedisi Filter
    if (filterEkspedisi !== "ALL" && item.tipe !== filterEkspedisi) {
      return false;
    }

    // 2. Admin Filter (Hanya tampilkan transaksi milik admin terpilih)
    if (filterAdmin !== "ALL") {
      const adminName = getAdminName(item.admin);
      const target = filterAdmin.trim().toLowerCase();
      const matchesAdmin = 
        adminName.trim().toLowerCase() === target ||
        item.admin.trim().toLowerCase() === target;
      if (!matchesAdmin) return false;
    }

    // 3. Search Term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const adminName = getAdminName(item.admin).toLowerCase();
      return (
        item.resi_id.toLowerCase().includes(term) ||
        item.pengirim.toLowerCase().includes(term) ||
        item.penerima.toLowerCase().includes(term) ||
        item.admin.toLowerCase().includes(term) ||
        adminName.includes(term) ||
        item.transaksi_id.toLowerCase().includes(term) ||
        (item.nama_barang && item.nama_barang.toLowerCase().includes(term))
      );
    }

    return true;
  });

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Fetch full detail for Viewing
  const handleOpenDetail = async (item: TransaksiItem) => {
    setLoadingDetail(true);
    setSelectedDetail(null);
    try {
      const res = await callBackend("getDetailTransaksi", {
        resi_id: item.resi_id,
        transaksi_id: item.transaksi_id
      });
      if (res.status === "success" && res.data) {
        setSelectedDetail(res.data);
      } else {
        // Fallback to basic item info
        setSelectedDetail({
          resi_id: item.resi_id,
          transaksi_id: item.transaksi_id,
          timestamp: item.timestamp,
          tipe: item.tipe,
          tipe_produk: item.tipe === "Cargo" ? "Cargo Standard" : "EZ",
          admin_id: "",
          admin_name: item.admin,
          outlet_id: "",
          outlet_name: item.outlet,
          nama_pengirim: item.pengirim,
          hp_pengirim: "-",
          alamat_pengirim: "-",
          nama_penerima: item.penerima,
          hp_penerima: "-",
          alamat_penerima: "-",
          nama_barang: item.nama_barang || "-",
          berat_kg: 1,
          ongkir_dasar: item.grand_total,
          biaya_asuransi: 0,
          biaya_packing: 0,
          biaya_amplop: 0,
          biaya_lain: 0,
          grand_total: item.grand_total,
          setoran_ke_owner: item.grand_total,
          kas_operasional: 0,
          metode_bayar: "Tunai",
          status_resi: item.status_resi
        });
      }
    } catch (err: any) {
      toast.error("Gagal memuat detail transaksi: " + err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Fetch detail and open Edit modal (Owner)
  const handleOpenEdit = async (item: TransaksiItem) => {
    setSavingEdit(false);
    setOriginalResiId(item.resi_id);
    try {
      const res = await callBackend("getDetailTransaksi", {
        resi_id: item.resi_id,
        transaksi_id: item.transaksi_id
      });
      if (res.status === "success" && res.data) {
        setEditItem(res.data);
      } else {
        // Fallback default
        setEditItem({
          resi_id: item.resi_id,
          transaksi_id: item.transaksi_id,
          timestamp: item.timestamp,
          tipe: item.tipe,
          tipe_produk: item.tipe === "Cargo" ? "Cargo Standard" : "EZ",
          admin_id: "",
          admin_name: item.admin,
          outlet_id: "",
          outlet_name: item.outlet,
          nama_pengirim: item.pengirim,
          hp_pengirim: "",
          alamat_pengirim: "",
          nama_penerima: item.penerima,
          hp_penerima: "",
          alamat_penerima: "",
          nama_barang: item.nama_barang || "",
          berat_kg: 1,
          ongkir_dasar: item.grand_total,
          biaya_asuransi: 0,
          biaya_packing: 0,
          biaya_amplop: 0,
          biaya_lain: 0,
          grand_total: item.grand_total,
          setoran_ke_owner: item.grand_total,
          kas_operasional: 0,
          metode_bayar: "Tunai",
          status_resi: item.status_resi,
          catatan: ""
        });
      }
    } catch (err: any) {
      toast.error("Gagal memuat data edit: " + err.message);
    }
  };

  // Save edited transaction (Owner)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;

    if (!editItem.resi_id.trim()) {
      toast.error("Nomor Resi tidak boleh kosong!");
      return;
    }

    setSavingEdit(true);
    try {
      const flatPayload = {
        old_resi_id: originalResiId,
        resi_id: editItem.resi_id,
        transaksi_id: editItem.transaksi_id,
        user_id: session.user_id,
        outlet_id: editItem.outlet_id || session.outlet_id_home,
        tipe: editItem.tipe,
        nama_pengirim: editItem.nama_pengirim,
        hp_pengirim: editItem.hp_pengirim,
        alamat_pengirim: editItem.alamat_pengirim,
        nama_penerima: editItem.nama_penerima,
        hp_penerima: editItem.hp_penerima,
        alamat_penerima: editItem.alamat_penerima,
        nama_barang: editItem.nama_barang,
        berat_kg: editItem.berat_kg,
        tipe_produk: editItem.tipe_produk,
        metode_bayar: editItem.metode_bayar,
        ongkir_dasar: editItem.ongkir_dasar,
        biaya_packing: editItem.biaya_packing,
        biaya_asuransi: editItem.biaya_asuransi,
        biaya_amplop: editItem.biaya_amplop,
        grand_total: editItem.grand_total,
        setoran_ke_owner: editItem.setoran_ke_owner,
        kas_operasional: editItem.kas_operasional,
        status_resi: editItem.status_resi,
        catatan: editItem.catatan,
        total_dibayar_customer: editItem.grand_total,
        admin_id_pencatat: session.user_id,
        outlet_id_input: editItem.outlet_id || session.outlet_id_home
      };

      const res = await callBackend("updateTransaksi", {
        ...flatPayload,
        jenis_layanan: editItem.tipe || "Express",
        data: flatPayload
      });

      if (res.status === "success") {
        toast.success(res.message || "Transaksi berhasil diperbarui!");
        setEditItem(null);
        fetchData();
      } else {
        toast.error("Gagal memperbarui: " + (res.message || "Terjadi kesalahan"));
      }
    } catch (err: any) {
      toast.error("Error update transaksi: " + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // Confirm cancel transaction (Owner or Admin)
  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const response = await callBackend("deleteTransaksi", { 
        resi_id: cancelTarget.resi_id, 
        transaksi_id: cancelTarget.transaksi_id,
        user_id: session.user_id,
        outlet_id: session.outlet_id_home,
        tipe: cancelTarget.tipe
      });
      if (response.status === "success") {
        toast.success("Transaksi resi " + cancelTarget.resi_id + " berhasil dibatalkan.");
        setCancelTarget(null);
        fetchData();
      } else {
        toast.error("Gagal membatalkan: " + response.message);
      }
    } catch (e: any) {
      toast.error("Error membatalkan transaksi: " + e.message);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      
      {/* HEADER & FILTER */}
      <div className="flex flex-col gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Riwayat Transaksi</h1>
            <p className="text-sm text-gray-500 mt-1">Kelola, pantau, edit, dan batalkan resi yang tercatat di sistem.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => setIsBulkImportModalOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold shadow-md hover:bg-gray-800 transition-colors"
            >
              <Package className="w-4 h-4" />
              Import Bulk YoYi
            </button>
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

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm font-semibold">
            <Filter className="h-4 w-4" />
            <span>Filter:</span>
          </div>

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

          {/* Filter Ekspedisi (Semua Level: ADMIN & OWNER) */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 text-xs">
            <Truck className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-gray-500 font-bold">Ekspedisi:</span>
            <select
              value={filterEkspedisi}
              onChange={(e) => setFilterEkspedisi(e.target.value)}
              className="bg-transparent font-semibold text-gray-800 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Ekspedisi</option>
              <option value="Express">Express</option>
              <option value="Cargo">Cargo</option>
            </select>
          </div>

          {/* Filter Admin (Semua Level: ADMIN & OWNER) */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 text-xs">
            <User className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-gray-500 font-bold">Admin:</span>
            <select
              value={filterAdmin}
              onChange={(e) => setFilterAdmin(e.target.value)}
              className="bg-transparent font-semibold text-gray-800 focus:outline-none cursor-pointer max-w-[150px] truncate"
            >
              <option value="ALL">Semua Admin</option>
              {adminOptions.map((adm) => (
                <option key={adm.id} value={adm.id}>
                  {adm.name}
                </option>
              ))}
            </select>
          </div>

          {session.role === "OWNER" && (
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 text-xs">
              <MapPin className="h-3.5 w-3.5 text-gray-400" />
              <select
                value={filterOutlet}
                onChange={(e) => setFilterOutlet(e.target.value)}
                className="bg-transparent font-semibold text-gray-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Outlet</option>
                {outlets.map((o) => (
                  <option key={o.outlet_id} value={o.outlet_id}>
                    {o.nama_outlet}
                  </option>
                ))}
              </select>
            </div>
          )}
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
                  <div key={item.resi_id || item.transaksi_id || index} className="p-4 sm:p-5 hover:bg-gray-50/50 flex flex-col sm:flex-row justify-between gap-4 transition-colors">
                    
                    {/* KIRI: No.urut, Resi, Waktu, Admin, Outlet */}
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">
                        {(currentPage - 1) * pageSize + index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className={`font-bold font-mono text-base ${item.status_resi === "BATAL" ? "text-gray-400 line-through" : "text-gray-800"}`}>
                            {highlightText(item.resi_id || item.transaksi_id, searchTerm)}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            item.tipe === "Express" ? "bg-red-50 text-[#E4002B] border border-red-100" : "bg-blue-50 text-blue-700 border border-blue-100"
                          }`}>
                            {item.tipe}
                          </span>
                          {item.status_resi === "BATAL" ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-100">
                              BATAL
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
                              {item.status_resi || "AKTIF"}
                            </span>
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-500 space-y-0.5">
                          <p><span className="font-medium text-gray-400 w-16 inline-block">Waktu</span>: {new Date(item.timestamp).toLocaleString("id-ID")}</p>
                          <p><span className="font-medium text-gray-400 w-16 inline-block">Admin</span>: <span className="font-semibold text-gray-700">{highlightText(getAdminName(item.admin), searchTerm)}</span></p>
                          <p><span className="font-medium text-gray-400 w-16 inline-block">Outlet</span>: {item.outlet}</p>
                          <p className="mt-1 text-gray-500 font-medium">
                            {highlightText(item.pengirim || "Umum", searchTerm)} ➔ {highlightText(item.penerima || "Umum", searchTerm)}
                            {item.nama_barang && item.nama_barang !== "-" && (
                              <span className="text-gray-400 ml-1 italic font-normal">
                                ({highlightText(item.nama_barang, searchTerm)})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* KANAN: Grand Total, Tombol Aksi */}
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 pl-12 sm:pl-0 border-t border-gray-50 sm:border-0 pt-3 sm:pt-0">
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Grand Total</p>
                        <p className={`font-bold font-mono text-lg ${item.status_resi === "BATAL" ? "text-gray-400 line-through" : "text-gray-800"}`}>
                          Rp {item.grand_total.toLocaleString("id-ID")}
                        </p>
                      </div>
                      
                      {/* ACTION BUTTONS */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* 1. Lihat Detail (Eye Icon) */}
                        <button
                          onClick={() => handleOpenDetail(item)}
                          className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-colors cursor-pointer"
                          title="Lihat Detail Transaksi"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* 2. Edit Transaksi (Pencil Icon) */}
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 rounded-lg transition-colors cursor-pointer"
                          title="Edit Transaksi"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        {/* 3. Batalkan Transaksi (Ban Icon) */}
                        {item.status_resi !== "BATAL" && (
                          <button
                            onClick={() => setCancelTarget(item)}
                            className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded-lg transition-colors cursor-pointer"
                            title="Batalkan Transaksi"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                ))}
              </div>

              {/* PAGINATION BAR */}
              {totalPages > 1 && (
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-600">
                  <div className="flex items-center gap-3">
                    <span>Total <span className="font-bold text-gray-800">{filteredData.length}</span> data</span>
                    <div className="h-4 w-px bg-gray-300"></div>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:border-red-500 cursor-pointer"
                    >
                      <option value={10}>10 / halaman</option>
                      <option value={25}>25 / halaman</option>
                      <option value={50}>50 / halaman</option>
                      <option value={100}>100 / halaman</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <span>Lompat ke</span>
                      <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={jumpPage}
                        onChange={(e) => setJumpPage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            let p = parseInt(jumpPage, 10);
                            if (!isNaN(p)) {
                              if (p < 1) p = 1;
                              if (p > totalPages) p = totalPages;
                              setCurrentPage(p);
                              setJumpPage("");
                            }
                          }
                        }}
                        className="w-12 bg-white border border-gray-200 rounded px-2 py-1 text-center outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1 min-w-[28px] flex justify-center items-center rounded disabled:opacity-40 hover:bg-gray-200 transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                      .map((p, i, arr) => (
                        <React.Fragment key={p}>
                          {i > 0 && p - arr[i - 1] > 1 && (
                            <span className="px-1 text-gray-400">...</span>
                          )}
                          <button
                            onClick={() => setCurrentPage(p)}
                            className={`min-w-[28px] h-[28px] flex items-center justify-center rounded text-[11px] font-medium transition-colors ${
                              currentPage === p 
                                ? "bg-white border border-emerald-500 text-emerald-600 shadow-sm" 
                                : "hover:bg-gray-200 text-gray-600"
                            }`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      ))
                    }

                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1 min-w-[28px] flex justify-center items-center rounded disabled:opacity-40 hover:bg-gray-200 transition-colors"
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
                {searchTerm ? "Belum ada transaksi yang sesuai pencarian." : "Belum ada transaksi yang tercatat."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* MODAL DETAIL TRANSAKSI */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-5 border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Detail Transaksi</h2>
                  <p className="text-xs text-gray-500 font-mono">Resi: {selectedDetail.resi_id || selectedDetail.transaksi_id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Info Badge */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-xl text-xs">
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Layanan</span>
                <span className="font-bold text-gray-800">{selectedDetail.tipe} ({selectedDetail.tipe_produk})</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Status</span>
                <span className={`font-bold ${selectedDetail.status_resi === "BATAL" ? "text-rose-600" : "text-emerald-600"}`}>
                  {selectedDetail.status_resi}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Admin</span>
                <span className="font-semibold text-gray-700">{selectedDetail.admin_name || selectedDetail.admin_id}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Outlet</span>
                <span className="font-semibold text-gray-700">{selectedDetail.outlet_name || selectedDetail.outlet_id}</span>
              </div>
            </div>

            {/* Pengirim & Penerima */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50/70 rounded-xl border border-gray-100 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                  <User className="h-4 w-4 text-gray-400" />
                  Pengirim
                </div>
                <p className="text-sm font-semibold text-gray-800">{selectedDetail.nama_pengirim || "Umum"}</p>
                <p className="text-xs text-gray-500">{selectedDetail.hp_pengirim || "-"}</p>
                <p className="text-xs text-gray-600 leading-relaxed">{selectedDetail.alamat_pengirim || "-"}</p>
              </div>

              <div className="p-4 bg-gray-50/70 rounded-xl border border-gray-100 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  Penerima
                </div>
                <p className="text-sm font-semibold text-gray-800">{selectedDetail.nama_penerima || "Umum"}</p>
                <p className="text-xs text-gray-500">{selectedDetail.hp_penerima || "-"}</p>
                <p className="text-xs text-gray-600 leading-relaxed">{selectedDetail.alamat_penerima || "-"}</p>
              </div>
            </div>

            {/* Barang & Biaya */}
            <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Nama Barang & Berat:</span>
                <span className="font-semibold text-gray-800">{selectedDetail.nama_barang || "Paket"} ({selectedDetail.berat_kg} Kg)</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Ongkos Kirim Dasar:</span>
                <span className="font-mono text-gray-800">Rp {Number(selectedDetail.ongkir_dasar || 0).toLocaleString("id-ID")}</span>
              </div>
              {selectedDetail.biaya_packing > 0 && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Biaya Packing:</span>
                  <span className="font-mono text-gray-800">Rp {Number(selectedDetail.biaya_packing).toLocaleString("id-ID")}</span>
                </div>
              )}
              {selectedDetail.biaya_asuransi > 0 && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Biaya Asuransi:</span>
                  <span className="font-mono text-gray-800">Rp {Number(selectedDetail.biaya_asuransi).toLocaleString("id-ID")}</span>
                </div>
              )}
              {selectedDetail.biaya_amplop > 0 && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Biaya Amplop:</span>
                  <span className="font-mono text-gray-800">Rp {Number(selectedDetail.biaya_amplop).toLocaleString("id-ID")}</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 flex justify-between items-center font-bold">
                <span className="text-sm text-gray-800">Grand Total ({selectedDetail.metode_bayar}):</span>
                <span className="text-base text-[#E4002B] font-mono">Rp {Number(selectedDetail.grand_total || 0).toLocaleString("id-ID")}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold cursor-pointer transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT TRANSAKSI */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 space-y-5 border border-gray-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Pencil className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Edit Transaksi</h2>
                  <p className="text-xs text-gray-500">Ubah data transaksi resi {originalResiId}</p>
                </div>
              </div>
              <button
                onClick={() => setEditItem(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              
              {/* SECTION: NOMOR RESI & STATUS & LAYANAN */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-amber-50/40 p-3.5 rounded-xl border border-amber-100">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nomor Resi</label>
                  <input
                    type="text"
                    value={editItem.resi_id}
                    onChange={(e) => setEditItem({ ...editItem, resi_id: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-mono font-bold focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Status Resi</label>
                  <select
                    value={editItem.status_resi}
                    onChange={(e) => setEditItem({ ...editItem, status_resi: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold focus:ring-1 focus:ring-amber-500 focus:border-amber-500 cursor-pointer"
                  >
                    <option value="AKTIF">AKTIF</option>
                    <option value="SELESAI">SELESAI</option>
                    <option value="BATAL">BATAL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Tipe Produk</label>
                  <input
                    type="text"
                    value={editItem.tipe_produk}
                    onChange={(e) => setEditItem({ ...editItem, tipe_produk: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="EZ / DOC / Cargo"
                  />
                </div>
              </div>

              {/* SECTION: PENGIRIM */}
              <div className="border border-gray-100 p-4 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="h-4 w-4 text-gray-400" />
                  Informasi Pengirim
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nama Pengirim</label>
                    <input
                      type="text"
                      value={editItem.nama_pengirim}
                      onChange={(e) => setEditItem({ ...editItem, nama_pengirim: e.target.value })}
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">No HP Pengirim</label>
                    <input
                      type="text"
                      value={editItem.hp_pengirim}
                      onChange={(e) => setEditItem({ ...editItem, hp_pengirim: e.target.value })}
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Alamat Pengirim</label>
                  <textarea
                    rows={2}
                    value={editItem.alamat_pengirim}
                    onChange={(e) => setEditItem({ ...editItem, alamat_pengirim: e.target.value })}
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* SECTION: PENERIMA */}
              <div className="border border-gray-100 p-4 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  Informasi Penerima
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nama Penerima</label>
                    <input
                      type="text"
                      value={editItem.nama_penerima}
                      onChange={(e) => setEditItem({ ...editItem, nama_penerima: e.target.value })}
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">No HP Penerima</label>
                    <input
                      type="text"
                      value={editItem.hp_penerima}
                      onChange={(e) => setEditItem({ ...editItem, hp_penerima: e.target.value })}
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Alamat Penerima</label>
                  <textarea
                    rows={2}
                    value={editItem.alamat_penerima}
                    onChange={(e) => setEditItem({ ...editItem, alamat_penerima: e.target.value })}
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* SECTION: BARANG & KEUANGAN */}
              <div className="border border-gray-100 p-4 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  Barang & Keuangan
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nama Barang</label>
                    <input
                      type="text"
                      value={editItem.nama_barang}
                      onChange={(e) => setEditItem({ ...editItem, nama_barang: e.target.value })}
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Berat (Kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editItem.berat_kg}
                      onChange={(e) => setEditItem({ ...editItem, berat_kg: Number(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Metode Bayar</label>
                    <select
                      value={editItem.metode_bayar}
                      onChange={(e) => setEditItem({ ...editItem, metode_bayar: e.target.value })}
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm cursor-pointer"
                    >
                      <option value="Tunai">Tunai</option>
                      <option value="Transfer">Transfer</option>
                      <option value="QRIS">QRIS</option>
                      <option value="EDC">EDC</option>
                      <option value="Order by APP">Order by APP</option>
                      <option value="DFOD">DFOD</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Ongkir Dasar</label>
                    <input
                      type="number"
                      value={editItem.ongkir_dasar}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        const amplop = Number(editItem.biaya_amplop || 0);
                        const packing = Number(editItem.biaya_packing || 0);
                        const asuransi = Number(editItem.biaya_asuransi || 0);
                        const lain = Number(editItem.biaya_lain || 0);
                        const grand = val + amplop + packing + asuransi + lain;
                        const kas = amplop + packing;
                        setEditItem({ 
                          ...editItem, 
                          ongkir_dasar: val, 
                          grand_total: grand, 
                          kas_operasional: kas, 
                          setoran_ke_owner: grand - kas 
                        });
                      }}
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Biaya Amplop</label>
                    <input
                      type="number"
                      value={editItem.biaya_amplop ?? 0}
                      onChange={(e) => {
                        const amplop = Number(e.target.value) || 0;
                        const ongkir = Number(editItem.ongkir_dasar || 0);
                        const packing = Number(editItem.biaya_packing || 0);
                        const asuransi = Number(editItem.biaya_asuransi || 0);
                        const lain = Number(editItem.biaya_lain || 0);
                        const grand = ongkir + amplop + packing + asuransi + lain;
                        const kas = amplop + packing;
                        setEditItem({ 
                          ...editItem, 
                          biaya_amplop: amplop, 
                          grand_total: grand, 
                          kas_operasional: kas, 
                          setoran_ke_owner: grand - kas 
                        });
                      }}
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Biaya Packing</label>
                    <input
                      type="number"
                      value={editItem.biaya_packing ?? 0}
                      onChange={(e) => {
                        const packing = Number(e.target.value) || 0;
                        const ongkir = Number(editItem.ongkir_dasar || 0);
                        const amplop = Number(editItem.biaya_amplop || 0);
                        const asuransi = Number(editItem.biaya_asuransi || 0);
                        const lain = Number(editItem.biaya_lain || 0);
                        const grand = ongkir + amplop + packing + asuransi + lain;
                        const kas = amplop + packing;
                        setEditItem({ 
                          ...editItem, 
                          biaya_packing: packing, 
                          grand_total: grand, 
                          kas_operasional: kas, 
                          setoran_ke_owner: grand - kas 
                        });
                      }}
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Biaya Asuransi</label>
                    <input
                      type="number"
                      value={editItem.biaya_asuransi ?? 0}
                      onChange={(e) => {
                        const asuransi = Number(e.target.value) || 0;
                        const ongkir = Number(editItem.ongkir_dasar || 0);
                        const amplop = Number(editItem.biaya_amplop || 0);
                        const packing = Number(editItem.biaya_packing || 0);
                        const lain = Number(editItem.biaya_lain || 0);
                        const grand = ongkir + amplop + packing + asuransi + lain;
                        const kas = amplop + packing;
                        setEditItem({ 
                          ...editItem, 
                          biaya_asuransi: asuransi, 
                          grand_total: grand, 
                          kas_operasional: kas, 
                          setoran_ke_owner: grand - kas 
                        });
                      }}
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1">Grand Total</label>
                    <input
                      type="number"
                      value={editItem.grand_total}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        const kas = Number(editItem.biaya_amplop || 0) + Number(editItem.biaya_packing || 0);
                        setEditItem({ 
                          ...editItem, 
                          grand_total: val, 
                          setoran_ke_owner: val - kas 
                        });
                      }}
                      className="w-full px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm font-mono font-bold text-[#E4002B]"
                    />
                  </div>
                </div>
              </div>

              {/* ACTION FOOTER */}
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditItem(null)}
                  disabled={savingEdit}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold cursor-pointer transition disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-[#E4002B] hover:bg-[#c20024] text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {savingEdit ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI BATALKAN TRANSAKSI */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-gray-100">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl">
                <Ban className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">Batalkan Transaksi?</h3>
                <p className="text-xs text-gray-500 font-mono">No. Resi: {cancelTarget.resi_id}</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Apakah Anda yakin ingin membatalkan transaksi resi ini? Status transaksi akan diubah menjadi <strong className="text-rose-600">BATAL</strong> dan tercatat di audit log.
            </p>

            <div className="bg-gray-50 p-3 rounded-xl text-xs space-y-1 text-gray-600">
              <p><span className="text-gray-400">Pengirim:</span> <strong>{cancelTarget.pengirim || "Umum"}</strong></p>
              <p><span className="text-gray-400">Penerima:</span> <strong>{cancelTarget.penerima || "Umum"}</strong></p>
              <p><span className="text-gray-400">Grand Total:</span> <strong className="font-mono text-gray-800">Rp {cancelTarget.grand_total.toLocaleString("id-ID")}</strong></p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer transition disabled:opacity-50"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
              >
                <Ban className="h-4 w-4" />
                {cancelling ? "Membatalkan..." : "Ya, Batalkan Transaksi"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BulkImportYoYiModal
        isOpen={isBulkImportModalOpen}
        onClose={() => setIsBulkImportModalOpen(false)}
        activeOutletId={activeOutletId || session.outlet_id_home}
        adminId={session.user_id}
        outlets={outlets}
        users={users}
        onImportComplete={() => {
          setIsBulkImportModalOpen(false);
          fetchData();
        }}
      />
    </div>
  );
}
