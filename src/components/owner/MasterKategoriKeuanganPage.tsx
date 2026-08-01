import React, { useState, useEffect, useMemo } from "react";
import { 
  Tags, Search, Plus, Edit2, CheckCircle2, XCircle, AlertCircle, RefreshCw, Filter, ToggleLeft, ToggleRight
} from "lucide-react";
import { useAppsScript } from "../../hooks/useAppsScript";
import { toast } from "../../utils/toast";
import { SessionData, KategoriKeuangan } from "../../types";

interface MasterKategoriKeuanganPageProps {
  session: SessionData;
}

export default function MasterKategoriKeuanganPage({ session }: MasterKategoriKeuanganPageProps) {
  const { callBackend } = useAppsScript();
  const [loading, setLoading] = useState(false);
  const [kategoriList, setKategoriList] = useState<KategoriKeuangan[]>([]);
  
  // Tab state: "PENGELUARAN" | "PEMASUKAN"
  const [activeTab, setActiveTab] = useState<"PENGELUARAN" | "PEMASUKAN">("PENGELUARAN");

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"SEMUA" | "AKTIF" | "NON-AKTIF">("SEMUA");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KategoriKeuangan | null>(null);
  const [formNama, setFormNama] = useState("");
  const [formUrutan, setFormUrutan] = useState<number>(1);
  const [formAktif, setFormAktif] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Fetch Kategori
  const fetchKategori = async () => {
    setLoading(true);
    try {
      const response = await callBackend("getKategoriKeuangan");
      if (response.status === "success" && Array.isArray(response.data)) {
        const unique = Array.from(new Map(response.data.map((x: KategoriKeuangan) => [x.id, x])).values());
        setKategoriList(unique);
      } else {
        toast.error(response.message || "Gagal memuat data kategori keuangan.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Terjadi kesalahan koneksi saat mengambil kategori.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKategori();
  }, []);

  // Filtered Items
  const filteredList = useMemo(() => {
    return kategoriList
      .filter((item) => item.jenis.toUpperCase() === activeTab)
      .filter((item) => {
        if (!searchQuery.trim()) return true;
        return item.nama.toLowerCase().includes(searchQuery.toLowerCase().trim());
      })
      .filter((item) => {
        if (statusFilter === "AKTIF") return item.aktif === true;
        if (statusFilter === "NON-AKTIF") return item.aktif === false;
        return true;
      })
      .sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
  }, [kategoriList, activeTab, searchQuery, statusFilter]);

  // Counts
  const countPengeluaran = useMemo(() => kategoriList.filter((x) => x.jenis === "PENGELUARAN").length, [kategoriList]);
  const countPemasukan = useMemo(() => kategoriList.filter((x) => x.jenis === "PEMASUKAN").length, [kategoriList]);

  // Handle Open Add Modal
  const handleOpenAdd = () => {
    const maxUrutan = kategoriList
      .filter((x) => x.jenis === activeTab)
      .reduce((max, item) => Math.max(max, item.urutan || 0), 0);
    setEditingItem(null);
    setFormNama("");
    setFormUrutan(maxUrutan + 1);
    setFormAktif(true);
    setModalOpen(true);
  };

  // Handle Open Edit Modal
  const handleOpenEdit = (item: KategoriKeuangan) => {
    setEditingItem(item);
    setFormNama(item.nama);
    setFormUrutan(item.urutan);
    setFormAktif(item.aktif);
    setModalOpen(true);
  };

  // Handle Submit (Save/Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNama.trim()) {
      toast.error("Nama kategori wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      if (editingItem) {
        // Update
        const response = await callBackend("updateKategoriKeuangan", {
          id: editingItem.id,
          nama: formNama.trim(),
          urutan: formUrutan,
          aktif: formAktif
        });
        if (response.status === "success") {
          toast.success(response.message || "Kategori berhasil diperbarui!");
          setModalOpen(false);
          fetchKategori();
        } else {
          toast.error(response.message || "Gagal memperbarui kategori.");
        }
      } else {
        // Create
        const response = await callBackend("saveKategoriKeuangan", {
          jenis: activeTab,
          nama: formNama.trim(),
          urutan: formUrutan,
          created_by: session.nama_lengkap || session.username || "OWNER"
        });
        if (response.status === "success") {
          toast.success(response.message || "Kategori berhasil ditambahkan!");
          setModalOpen(false);
          fetchKategori();
        } else {
          toast.error(response.message || "Gagal menyimpan kategori baru.");
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Gagal terhubung ke server.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Toggle Active State
  const handleToggleAktif = async (item: KategoriKeuangan) => {
    const newStatus = !item.aktif;
    const confirmMsg = newStatus 
      ? `Aktifkan kembali kategori "${item.nama}"?`
      : `Nonaktifkan kategori "${item.nama}"? Data historis tidak akan dihapus.`;
    
    if (!window.confirm(confirmMsg)) return;

    try {
      const response = await callBackend("setKategoriAktif", {
        id: item.id,
        aktif: newStatus
      });
      if (response.status === "success") {
        toast.success(newStatus ? "Kategori diaktifkan." : "Kategori dinonaktifkan.");
        fetchKategori();
      } else {
        toast.error(response.message || "Gagal mengubah status kategori.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Terjadi kesalahan saat memproses status.");
    }
  };

  // Role Guard check
  if (session.role !== "OWNER") {
    return (
      <div className="p-6 max-w-4xl mx-auto mt-8">
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl flex items-center gap-4 shadow-sm">
          <AlertCircle className="h-8 w-8 text-red-500 shrink-0" />
          <div>
            <h3 className="font-extrabold text-base">Akses Ditolak</h3>
            <p className="text-xs text-red-600 mt-1">
              Modul Master Kategori Keuangan khusus untuk akun dengan kewenangan <strong>OWNER</strong>.
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
          <div className="bg-[#E4002B]/10 p-3 rounded-2xl text-[#E4002B]">
            <Tags className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-gray-800 tracking-tight">
                Master Kategori Keuangan
              </h1>
              <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
                Owner Only
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">
              Kelola daftar kategori Pemasukan & Pengeluaran sebagai fondasi pencatatan keuangan outlet.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchKategori}
            disabled={loading}
            className="p-2.5 text-gray-500 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-[#E4002B]" : ""}`} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="bg-[#E4002B] hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-red-500/10 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Tambah Kategori {activeTab === "PENGELUARAN" ? "Pengeluaran" : "Pemasukan"}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-2">
        <button
          onClick={() => setActiveTab("PENGELUARAN")}
          className={`py-3 px-5 text-xs font-extrabold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === "PENGELUARAN"
              ? "border-[#E4002B] text-[#E4002B] bg-red-50/50 rounded-t-xl"
              : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-t-xl"
          }`}
        >
          <span>Kategori Pengeluaran</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
            activeTab === "PENGELUARAN" ? "bg-[#E4002B] text-white" : "bg-gray-200 text-gray-700"
          }`}>
            {countPengeluaran}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("PEMASUKAN")}
          className={`py-3 px-5 text-xs font-extrabold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === "PEMASUKAN"
              ? "border-emerald-600 text-emerald-600 bg-emerald-50/50 rounded-t-xl"
              : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-t-xl"
          }`}
        >
          <span>Kategori Pemasukan</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
            activeTab === "PEMASUKAN" ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-700"
          }`}>
            {countPemasukan}
          </span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-150 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={`Cari kategori ${activeTab.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#E4002B]/20 focus:border-[#E4002B]"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Filter className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs font-bold text-gray-500">Status:</span>
          <div className="flex bg-gray-100 p-0.5 rounded-xl text-[11px] font-bold">
            {(["SEMUA", "AKTIF", "NON-AKTIF"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  statusFilter === st 
                    ? "bg-white text-gray-900 shadow-xs font-extrabold" 
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {st === "SEMUA" ? "Semua" : st === "AKTIF" ? "Aktif" : "Non-Aktif"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-150 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-[#E4002B]" />
            <p className="text-xs font-semibold">Memuat master kategori keuangan...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center text-gray-400 space-y-2">
            <Tags className="h-10 w-10 mx-auto text-gray-300 stroke-[1.5]" />
            <p className="text-sm font-bold text-gray-700">Tidak ada data kategori</p>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              {searchQuery ? "Tidak ditemukan kategori dengan kata kunci tersebut." : "Belum ada kategori yang terdaftar."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-150 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 text-center w-16">Urutan</th>
                  <th className="py-3.5 px-4">Nama Kategori</th>
                  <th className="py-3.5 px-4">Jenis</th>
                  <th className="py-3.5 px-4 text-center w-32">Status</th>
                  <th className="py-3.5 px-4 text-right w-40">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                {filteredList.map((item, idx) => (
                  <tr key={`${item.id}-${idx}`} className="hover:bg-gray-50/80 transition-colors">
                    {/* Urutan */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-lg bg-gray-100 font-mono font-bold text-gray-700 text-[11px]">
                        {item.urutan}
                      </span>
                    </td>

                    {/* Nama Kategori */}
                    <td className="py-3.5 px-4 font-bold text-gray-900">
                      <span>{item.nama}</span>
                    </td>

                    {/* Jenis */}
                    <td className="py-3.5 px-4 font-semibold">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider ${
                        item.jenis === "PENGELUARAN"
                          ? "bg-red-50 text-red-700 border border-red-100"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                      }`}>
                        {item.jenis}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      {item.aktif ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Aktif</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200">
                          <XCircle className="h-3 w-3" />
                          <span>Non-Aktif</span>
                        </span>
                      )}
                    </td>

                    {/* Aksi */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-gray-600 hover:text-[#E4002B] hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Kategori"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        
                        <button
                          onClick={() => handleToggleAktif(item)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            item.aktif 
                              ? "text-emerald-600 hover:text-red-600 hover:bg-red-50" 
                              : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"
                          }`}
                          title={item.aktif ? "Nonaktifkan Kategori" : "Aktifkan Kategori"}
                        >
                          {item.aktif ? <ToggleRight className="h-5 w-5 text-emerald-600" /> : <ToggleLeft className="h-5 w-5 text-gray-400" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Add / Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-150 w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-sm font-extrabold text-gray-800 flex items-center gap-2">
                <Tags className="h-4 w-4 text-[#E4002B]" />
                <span>{editingItem ? "Edit Kategori" : `Tambah Kategori ${activeTab === "PENGELUARAN" ? "Pengeluaran" : "Pemasukan"}`}</span>
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Jenis Indicator */}
              <div>
                <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                  Jenis Keuangan
                </label>
                <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-xs font-extrabold font-mono text-gray-700">
                  {editingItem ? editingItem.jenis : activeTab}
                </div>
              </div>

              {/* Nama Kategori */}
              <div>
                <label className="block text-[11px] font-extrabold text-gray-700 mb-1">
                  Nama Kategori <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: ATK, Listrik, Modal Owner"
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#E4002B]/20 focus:border-[#E4002B]"
                />
              </div>

              {/* Urutan */}
              <div>
                <label className="block text-[11px] font-extrabold text-gray-700 mb-1">
                  Urutan Tampilan
                </label>
                <input
                  type="number"
                  min={1}
                  value={formUrutan}
                  onChange={(e) => setFormUrutan(parseInt(e.target.value) || 1)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#E4002B]/20 focus:border-[#E4002B]"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Menentukan posisi kategori dalam daftar dropdown pilihan.
                </p>
              </div>

              {/* Status Aktif (Edit Mode Only) */}
              {editingItem && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-150">
                  <span className="text-xs font-bold text-gray-700">Status Aktif:</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAktif}
                      onChange={(e) => setFormAktif(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              )}

              {/* Submit / Cancel Buttons */}
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
                  disabled={submitting}
                  className="px-5 py-2.5 bg-[#E4002B] hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Menyimpan..." : "Simpan Kategori"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
