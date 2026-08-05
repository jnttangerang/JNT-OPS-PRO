import React, { useState, useEffect, useMemo } from "react";
import { 
  Users, Upload, Search, CheckCircle, AlertCircle, RefreshCw, ChevronLeft, Edit, Trash2, Check, X, Info, ArrowUpDown 
} from "lucide-react";
import useAppsScript from "../../hooks/useAppsScript";
import { toast } from "../../utils/toast";

export default function ImportCustomerPage({ session, outlets = [] }: { session: any, outlets?: any[] }) {
  const { callBackend, loading } = useAppsScript();
  
  const [fetchedOutlets, setFetchedOutlets] = useState<any[]>([]);

  useEffect(() => {
    if (!outlets || outlets.length === 0) {
      callBackend("getOutlets").then((res) => {
        if (res && res.status === "success" && Array.isArray(res.data)) {
          setFetchedOutlets(res.data);
        }
      }).catch((err) => {
        console.error("Failed to load outlets in ImportCustomerPage", err);
      });
    }
  }, [outlets, callBackend]);

  const outletList = useMemo(() => {
    if (Array.isArray(outlets) && outlets.length > 0) return outlets;
    return fetchedOutlets;
  }, [outlets, fetchedOutlets]);
  
  const [outletId, setOutletId] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [sheetName, setSheetName] = useState("Customer Lama");
  
  const [previewData, setPreviewData] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Pagination for preview
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const itemsPerPage = 50;

  // Edit / Delete State
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc'|'desc'} | null>(null);
  const [importSessionId, setImportSessionId] = useState("");
  const [importSummary, setImportSummary] = useState<any>(null);


  const handlePreview = async () => {
    if (!outletId) return toast.error("Pilih Outlet terlebih dahulu.");
    if (!spreadsheetId.trim()) return toast.error("Spreadsheet ID / URL wajib diisi.");
    if (!sheetName.trim()) return toast.error("Nama Sheet wajib diisi.");

    try {
      const newSessionId = crypto.randomUUID ? crypto.randomUUID() : "IMPORT-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
      setImportSessionId(newSessionId);
      setImportSummary(null);

      const res = await callBackend("importCustomerFromSheet", {
        outletId,
        spreadsheetId: spreadsheetId.trim(),
        sheetName: sheetName.trim(),
        preview: true,
        importSessionId: newSessionId,
        user_id: session?.user_id || session?.username || "Unknown",
        frontend_version: "1.0.0",
        app_version: "1.0.0"
      });
      
      if (res.status === "success" && res.data) {
        // Assign unique IDs for client-side editing/deleting
        const withIds = res.data.previewRows.map((r: any, i: number) => ({ ...r, _id: i }));
        setPreviewData({ ...res.data, previewRows: withIds });
        setDeletedIds(new Set());
        setSelectedIds(new Set());
        setStatusFilter("ALL");
        setSortConfig(null);
        setCurrentPage(1);
        toast.success("Preview berhasil dimuat.");
      } else {
        toast.error(res.message || "Gagal memuat preview.");
      }
    } catch (error: any) {
      toast.error(error.message || "Gagal memuat preview.");
    }
  };

  const handleEdit = (row: any) => {
    setEditingIdx(row._id);
    setEditForm({ ...row });
  };

  const handleSaveEdit = () => {
    if (!previewData) return;
    const newData = { ...previewData };
    const rowIdx = newData.previewRows.findIndex((r: any) => r._id === editingIdx);
    if (rowIdx > -1) {
      newData.previewRows[rowIdx] = { ...editForm };
      setPreviewData(newData);
    }
    setEditingIdx(null);
  };

  const handleDelete = (id: number) => {
    const newDeleted = new Set(deletedIds);
    newDeleted.add(id);
    setDeletedIds(newDeleted);
    
    const newSelected = new Set(selectedIds);
    newSelected.delete(id);
    setSelectedIds(newSelected);
  };

  const workingCopy = useMemo(() => {
    if (!previewData?.previewRows) return [];
    return previewData.previewRows.filter((r: any) => !deletedIds.has(r._id));
  }, [previewData?.previewRows, deletedIds]);

  const handleImport = async () => {
    setShowConfirmModal(false);
    setIsImporting(true);
    
    try {
      const res = await callBackend("importCustomerFromSheet", {
        outletId,
        spreadsheetId: spreadsheetId.trim(),
        sheetName: sheetName.trim(),
        preview: false,
        editedRows: workingCopy,
        importSessionId,
        user_id: session?.user_id || session?.username || "Unknown",
        frontend_version: "1.0.0",
        app_version: "1.0.0"
      });
      
      if (res.status === "success") {
        toast.success("Import selesai");
        setImportSummary(res.data);
        setPreviewData(null);
      } else {
        toast.error(res.message || "Gagal import customer.");
      }
    } catch (error: any) {
      toast.error(error.message || "Gagal import customer.");
    } finally {
      setIsImporting(false);
    }
  };

  const deletedCount = deletedIds.size;
  const totalValid = workingCopy.length;
  const newCustomers = workingCopy.filter((r: any) => r.status === "NEW").length;
  const existingCustomers = workingCopy.filter((r: any) => r.status === "UPDATE").length;
  const errorCount = previewData?.failed || 0;

  const filteredPreview = useMemo(() => {
    let result = workingCopy;
    
    if (statusFilter !== "ALL") {
      result = result.filter((r: any) => r.status === statusFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((row: any) => {
        const outName = outletList.find((o: any) => (o.outlet_id || o.id) === row.outlet)?.nama_outlet || row.outlet || "";
        return (
          row.namaPengirim?.toLowerCase().includes(q) ||
          row.noHpPengirim?.includes(q) ||
          row.namaPenerima?.toLowerCase().includes(q) ||
          row.noHpPenerima?.includes(q) ||
          outName.toLowerCase().includes(q)
        );
      });
    }

    if (sortConfig) {
      result = [...result].sort((a: any, b: any) => {
        let aVal = a[sortConfig.key] || "";
        let bVal = b[sortConfig.key] || "";
        
        if (sortConfig.key === "outletName") {
          aVal = outletList.find((o: any) => (o.outlet_id || o.id) === a.outlet)?.nama_outlet || a.outlet || "";
          bVal = outletList.find((o: any) => (o.outlet_id || o.id) === b.outlet)?.nama_outlet || b.outlet || "";
        } else if (sortConfig.key === "status") {
          aVal = a.status || "";
          bVal = b.status || "";
        }

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [workingCopy, statusFilter, searchQuery, sortConfig, outletList]);

  const handleSort = (key: string) => {
    let direction = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction: direction as 'asc' | 'desc' });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredPreview.map((r: any) => r._id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) newSelected.add(id);
    else newSelected.delete(id);
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    const newDeleted = new Set(deletedIds);
    selectedIds.forEach(id => newDeleted.add(id));
    setDeletedIds(newDeleted);
    setSelectedIds(new Set());
  };


  const totalPages = Math.ceil(filteredPreview.length / itemsPerPage);
  const currentData = filteredPreview.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const isFormDisabled = loading || isImporting;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-3">
            <Upload className="text-[#E4002B] h-8 w-8" />
            Import Customer
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Impor database customer lama ke sistem operasional baru.
          </p>
        </div>
      </div>

      {/* Form Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-150 overflow-hidden">
        <div className="p-6 bg-gray-50/50 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-end">
          <div className="w-full md:w-1/4">
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
              Pilih Outlet <span className="text-red-500">*</span>
            </label>
            <select
              disabled={isFormDisabled}
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-[#E4002B] focus:border-[#E4002B] outline-none transition-all disabled:bg-gray-100 disabled:opacity-70"
            >
              <option value="">-- Pilih Outlet --</option>
              {outletList.map((o) => {
                const id = o.outlet_id || o.id;
                const name = o.nama_outlet || o.nama || id;
                return (
                  <option key={id} value={id}>
                    {name}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="w-full md:w-2/4">
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
              Spreadsheet ID / URL <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              disabled={isFormDisabled}
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/xxxxxxxxxxxxxxxx"
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-[#E4002B] focus:border-[#E4002B] outline-none transition-all disabled:bg-gray-100 disabled:opacity-70"
            />
          </div>

          <div className="w-full md:w-1/4">
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
              Nama Sheet <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              disabled={isFormDisabled}
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              placeholder="Customer Lama"
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-[#E4002B] focus:border-[#E4002B] outline-none transition-all disabled:bg-gray-100 disabled:opacity-70"
            />
          </div>

          <div className="w-full md:w-auto">
            <button
              disabled={isFormDisabled || !outletId || !spreadsheetId.trim() || !sheetName.trim()}
              onClick={handlePreview}
              className="w-full md:w-auto bg-gray-800 hover:bg-gray-900 text-white font-bold px-6 py-2.5 rounded-xl shadow-sm text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && !isImporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Preview
            </button>
          </div>
        </div>
      </div>

      {/* Progress / Loading Indicator */}
      {isImporting && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-center animate-pulse">
          <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-3" />
          <h3 className="font-bold text-blue-800 text-lg">Sedang mengimpor customer...</h3>
          <p className="text-blue-600 text-sm mt-1">Mohon tunggu, proses ini mungkin memakan waktu beberapa menit.</p>
        </div>
      )}

      {/* Preview Section */}
      {previewData && !isImporting && (
        <div className="space-y-6 animate-fade-in">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm flex flex-col justify-center text-center">
              <span className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-1">Total Data Valid</span>
              <span className="text-2xl font-black text-gray-700">{totalValid}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-green-150 shadow-sm flex flex-col justify-center text-center">
              <span className="text-green-600 font-bold text-xs uppercase tracking-wider mb-1">Customer Baru</span>
              <span className="text-2xl font-black text-green-700">{newCustomers}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-blue-150 shadow-sm flex flex-col justify-center text-center">
              <span className="text-blue-600 font-bold text-xs uppercase tracking-wider mb-1">Customer Existing</span>
              <span className="text-2xl font-black text-blue-700">{existingCustomers}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-orange-150 shadow-sm flex flex-col justify-center text-center">
              <span className="text-orange-500 font-bold text-xs uppercase tracking-wider mb-1">Data Dihapus</span>
              <span className="text-2xl font-black text-orange-600">{deletedCount > 0 ? deletedCount : 0}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-red-150 shadow-sm flex flex-col justify-center text-center">
              <span className="text-red-500 font-bold text-xs uppercase tracking-wider mb-1">Data Error</span>
              <span className="text-2xl font-black text-red-600">{errorCount}</span>
            </div>
          </div>

          {/* Action Header */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari nama, no HP, outlet..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E4002B] outline-none transition-all"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full md:w-auto bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 focus:ring-2 focus:ring-[#E4002B] outline-none transition-all"
              >
                <option value="ALL">Semua Status</option>
                <option value="NEW">NEW</option>
                <option value="UPDATE">UPDATE</option>
              </select>
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="w-full md:w-auto bg-orange-100 text-orange-700 hover:bg-orange-200 font-bold px-4 py-2 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus ({selectedIds.size})
                </button>
              )}
            </div>
            
            <button
              onClick={() => setShowConfirmModal(true)}
              className="w-full md:w-auto bg-[#E4002B] hover:bg-red-700 text-white font-bold px-8 py-2.5 rounded-xl shadow-sm text-sm transition-all flex items-center justify-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Import Customer
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-150 shadow-sm flex flex-col">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto relative">
              <table className="w-full text-left border-collapse relative">
                <thead className="sticky top-0 z-20 bg-gray-50 shadow-sm">
                  <tr className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-100">
                    <th className="p-4 font-bold sticky top-0 bg-gray-50 z-10">
                      <input 
                        type="checkbox" 
                        className="rounded text-red-500 focus:ring-red-500 cursor-pointer"
                        checked={filteredPreview.length > 0 && selectedIds.size === filteredPreview.length}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th className="p-4 font-bold sticky top-0 bg-gray-50 z-10">No</th>
                    <th className="p-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none sticky top-0 bg-gray-50 z-10" onClick={() => handleSort('status')}>
                      <div className="flex items-center gap-1">
                        Status
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </div>
                    </th>
                    <th className="p-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none sticky top-0 bg-gray-50 z-10" onClick={() => handleSort('namaPengirim')}>
                      <div className="flex items-center gap-1">
                        Pengirim
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </div>
                    </th>
                    <th className="p-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none sticky top-0 bg-gray-50 z-10" onClick={() => handleSort('namaPenerima')}>
                      <div className="flex items-center gap-1">
                        Penerima
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </div>
                    </th>
                    <th className="p-4 font-bold sticky top-0 bg-gray-50 z-10">Alamat</th>
                    <th className="p-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none sticky top-0 bg-gray-50 z-10" onClick={() => handleSort('outletName')}>
                      <div className="flex items-center gap-1">
                        Outlet Asal
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </div>
                    </th>
                    <th className="p-4 font-bold sticky top-0 bg-gray-50 z-10">Aksi</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-gray-100">
                  {currentData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-400">
                        Tidak ada data preview yang sesuai pencarian.
                      </td>
                    </tr>
                  ) : (
                    currentData.map((row: any, idx: number) => {
                      const isEditing = editingIdx === row._id;
                      const globalNum = (currentPage - 1) * itemsPerPage + idx + 1;
                      const outletName = outletList.find(o => (o.outlet_id || o.id) === row.outlet)?.nama_outlet || row.outlet;

                      return (
                        <tr key={row._id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4">
                            <input 
                              type="checkbox" 
                              className="rounded text-red-500 focus:ring-red-500 cursor-pointer"
                              checked={selectedIds.has(row._id)}
                              onChange={(e) => handleSelectRow(row._id, e.target.checked)}
                            />
                          </td>
                          <td className="p-4 font-mono text-gray-500">{globalNum}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              row.status === "NEW" ? "bg-green-100 text-green-700" :
                              row.status === "UPDATE" ? "bg-blue-100 text-blue-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="p-4 font-semibold text-gray-800">
                            {isEditing ? (
                              <input type="text" className="w-full border p-1 rounded" value={editForm.namaPengirim || ""} onChange={e => setEditForm({...editForm, namaPengirim: e.target.value})} />
                            ) : (row.namaPengirim || "-")}
                          </td>
                          <td className="p-4 font-mono text-gray-600">
                            {isEditing ? (
                              <input type="text" className="w-full border p-1 rounded" value={editForm.noHpPengirim || ""} onChange={e => setEditForm({...editForm, noHpPengirim: e.target.value})} />
                            ) : (row.noHpPengirim || "-")}
                          </td>
                          <td className="p-4 font-semibold text-gray-800">
                            {isEditing ? (
                              <input type="text" className="w-full border p-1 rounded" value={editForm.namaPenerima || ""} onChange={e => setEditForm({...editForm, namaPenerima: e.target.value})} />
                            ) : (row.namaPenerima || "-")}
                          </td>
                          <td className="p-4 font-mono text-gray-600">
                            {isEditing ? (
                              <input type="text" className="w-full border p-1 rounded" value={editForm.noHpPenerima || ""} onChange={e => setEditForm({...editForm, noHpPenerima: e.target.value})} />
                            ) : (row.noHpPenerima || "-")}
                          </td>
                          <td className="p-4 text-gray-600 max-w-[200px] truncate" title={row.alamat}>
                            {isEditing ? (
                              <input type="text" className="w-full border p-1 rounded" value={editForm.alamat || ""} onChange={e => setEditForm({...editForm, alamat: e.target.value})} />
                            ) : (row.alamat || "-")}
                          </td>
                          <td className="p-4 text-gray-600">
                            {outletName || "-"}
                          </td>
                          <td className="p-4 flex items-center gap-2">
                            {isEditing ? (
                              <>
                                <button onClick={handleSaveEdit} className="text-green-600 hover:bg-green-50 p-1 rounded"><Check className="w-4 h-4" /></button>
                                <button onClick={() => setEditingIdx(null)} className="text-gray-500 hover:bg-gray-100 p-1 rounded"><X className="w-4 h-4" /></button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => handleEdit(row)} className="text-blue-600 hover:bg-blue-50 p-1 rounded" title="Edit"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => handleDelete(row._id)} className="text-red-600 hover:bg-red-50 p-1 rounded" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
                <span className="text-xs text-gray-500">
                  Menampilkan <span className="font-bold text-gray-700">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-bold text-gray-700">{Math.min(currentPage * itemsPerPage, filteredPreview.length)}</span> dari <span className="font-bold text-gray-700">{filteredPreview.length}</span> baris
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 disabled:opacity-30 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="text-xs font-bold text-gray-700 px-3 py-1 bg-white rounded-lg border border-gray-200">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 disabled:opacity-30 transition-colors cursor-pointer rotate-180"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden scale-100 transition-transform">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-orange-100 text-orange-600 p-2 rounded-xl">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-black text-gray-800">Konfirmasi Import</h3>
              </div>
              <p className="text-gray-600 text-sm mb-4">
                Anda akan melakukan import database customer dari sheet <span className="font-bold text-gray-800">"{sheetName}"</span>.
              </p>
              <div className="bg-gray-50 p-4 rounded-xl space-y-2 mb-6 border border-gray-150">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Customer Baru (Pengirim & Penerima)</span>
                  <span className="font-bold text-green-600">{newCustomers} customer</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Update Existing Customer</span>
                  <span className="font-bold text-blue-600">{existingCustomers} update</span>
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-6 font-medium">Lanjutkan proses import?</p>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleImport}
                  className="px-5 py-2.5 rounded-xl font-bold text-white bg-[#E4002B] hover:bg-red-700 shadow-md shadow-red-500/20 transition-all flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Ya, Import Sekarang
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
