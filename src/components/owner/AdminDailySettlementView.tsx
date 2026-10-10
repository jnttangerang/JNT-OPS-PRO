import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Calendar, CheckCircle2, AlertTriangle, AlertCircle, Lock, Loader2, Store,
  RefreshCw, DollarSign, ArrowUpRight, History, X, Info, FileText, Check,
  Clock, ShieldAlert, ChevronRight, CheckCircle, Image as ImageIcon, Camera,
  ExternalLink, SlidersHorizontal, Upload, Send, Sparkles, Filter, ChevronDown, Save
} from "lucide-react";
import { toast } from "../../utils/toast";
import { getTodayWIB, calculateSettlementAging } from "../../utils/dateUtils";
import { useAppsScript } from "../../hooks/useAppsScript";

export interface AdminDailySettlementViewProps {
  session: {
    user_id?: string;
    username?: string;
    nama_lengkap?: string;
    role: string;
    outlet_id_home?: string;
  };
  outlets: Array<{ outlet_id: string; nama_outlet: string }>;
  activeOutletId?: string;
  onChangeActiveOutlet?: (outletId: string) => void;
}

export default function AdminDailySettlementView({
  session,
  outlets,
  activeOutletId,
  onChangeActiveOutlet
}: AdminDailySettlementViewProps) {
  const { callBackend } = useAppsScript();
  const currentUserId = session?.user_id || session?.username || "SYSTEM";
  const currentUserName = session?.nama_lengkap || session?.username || "Admin";

  const defaultOutlet = activeOutletId || session?.outlet_id_home || outlets[0]?.outlet_id || "OUT-A";
  const [selectedClosingOutlet, setSelectedClosingOutlet] = useState<string>(defaultOutlet);
  const [closingDate, setClosingDate] = useState<string>(() => getTodayWIB());

  // Data States
  const [loading, setLoading] = useState<boolean>(false);
  const [validating, setValidating] = useState<boolean>(false);
  const [adminSettlementData, setAdminSettlementData] = useState<any[]>([]);
  const [activeOutletClosingStatus, setActiveOutletClosingStatus] = useState<any>(null);

  // Modal States
  const [showSetoranModal, setShowSetoranModal] = useState<boolean>(false);
  const [targetOutletId, setTargetOutletId] = useState<string>("");
  const [targetOutletName, setTargetOutletName] = useState<string>("");
  const [nominalSetorInput, setNominalSetorInput] = useState<number | string>("");
  const [metodeSetoran, setMetodeSetoran] = useState<string>("TUNAI");
  const [buktiTransferUrl, setBuktiTransferUrl] = useState<string>("");
  const [targetKasOutlet, setTargetKasOutlet] = useState<number>(0);
  const [uploadingBukti, setUploadingBukti] = useState<boolean>(false);
  const [setoranNotes, setSetoranNotes] = useState<string>("");
  const [submittingSetoran, setSubmittingSetoran] = useState<boolean>(false);

  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);
  const [closeNotes, setCloseNotes] = useState<string>("");
  const [submittingClose, setSubmittingClose] = useState<boolean>(false);

  // Today's Transactions State
  const [todayTransactions, setTodayTransactions] = useState<any[]>([]);
  const [loadingTxs, setLoadingTxs] = useState<boolean>(false);

  // Inline Edit, Bulk Selection, View Mode State
  const [editingCell, setEditingCell] = useState<{
    transaksiId: string;
    field: string;
  } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"compact" | "detail">("compact");
  const [bulkLoading, setBulkLoading] = useState<boolean>(false);

  // Evidence Modal State
  const [evidenceModal, setEvidenceModal] = useState<{
    isOpen: boolean;
    resiId: string;
    field: "bukti_bayar_url" | "bukti_tambahan_url" | "foto_paket_url" | "foto_resi_url";
    title: string;
    category: "BUKTI_BAYAR" | "BUKTI_ADD" | "FOTO_PAKET" | "FOTO_RESI";
    currentUrl?: string;
  } | null>(null);
  const [uploadingEvidence, setUploadingEvidence] = useState<boolean>(false);
  const [tempImagePreview, setTempImagePreview] = useState<string | null>(null);
  const [tempBase64, setTempBase64] = useState<string | null>(null);

  // Keep closing outlet synchronized with activeOutletId if provided
  useEffect(() => {
    if (activeOutletId && activeOutletId !== selectedClosingOutlet) {
      setSelectedClosingOutlet(activeOutletId);
    }
  }, [activeOutletId]);

  const handleSelectClosingOutlet = (outletId: string) => {
    setSelectedClosingOutlet(outletId);
    if (onChangeActiveOutlet) {
      onChangeActiveOutlet(outletId);
    }
  };

  const getActorInfo = useCallback(() => ({
    actor_id: session?.user_id || session?.username || "SYSTEM",
    actor_name: session?.nama_lengkap || session?.username || "Admin",
    actor_role: session?.role || "ADMIN"
  }), [session]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Multi-Outlet settlement data specifically for this Admin
      const adminRes = await fetch(`/api/dailyClosing/admin/status?admin_id=${encodeURIComponent(currentUserId)}&tanggal=${closingDate}`);
      if (adminRes.ok) {
        const adminJson = await adminRes.json();
        setAdminSettlementData(adminJson.data || []);
      }

      // 2. Fetch Active Outlet's Book Closing Status
      if (selectedClosingOutlet) {
        const statusRes = await fetch(`/api/dailyClosing/status?outlet_id=${encodeURIComponent(selectedClosingOutlet)}&tanggal=${closingDate}`);
        if (statusRes.ok) {
          const statusJson = await statusRes.json();
          setActiveOutletClosingStatus(statusJson.data || statusJson);
        }
      }

      // 3. Fetch Today's Transactions for Active Outlet & Date
      if (selectedClosingOutlet && closingDate) {
        setLoadingTxs(true);
        try {
          const txRes = await callBackend("getRiwayatTransaksi", {
            filterOutlet: selectedClosingOutlet,
            tanggal_awal: closingDate,
            tanggal_akhir: closingDate
          });
          if (txRes?.status === "success" && Array.isArray(txRes.data)) {
            setTodayTransactions(txRes.data);
          } else {
            setTodayTransactions([]);
          }
        } finally {
          setLoadingTxs(false);
        }
      }
    } catch (err) {
      console.error("Error fetching admin daily settlement data:", err);
      toast.error("Gagal memuat data setoran harian.");
    } finally {
      setLoading(false);
    }
  }, [callBackend, currentUserId, closingDate, selectedClosingOutlet]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Step 5: Filter Transaksi Hari Ini untuk Outlet & Admin
  const transaksiHariIni = useMemo(() => {
    return todayTransactions.filter((t: any) => {
      // Date filter
      const tDate = t.tanggal_transaksi || (t.timestamp ? t.timestamp.split("T")[0] : "");
      if (tDate && tDate !== closingDate) return false;

      // Admin match check (for ADMIN role)
      if (session?.role === "ADMIN") {
        const rawAdmin = (t.admin || "").toLowerCase();
        const uId = (session?.user_id || "").toLowerCase();
        const uName = (session?.nama_lengkap || "").toLowerCase();
        const uUser = (session?.username || "").toLowerCase();
        if (t.admin && t.admin !== "-" && t.admin !== "SYSTEM") {
          return rawAdmin === uId || rawAdmin === uName || rawAdmin === uUser;
        }
      }
      return true;
    });
  }, [todayTransactions, closingDate, session]);

  // Step 5: Header Finansial 3 Angka Real-time
  const totalHakOwner = useMemo(() => {
    return transaksiHariIni.reduce((sum: number, t: any) => {
      if (t.status_resi === "BATAL") return sum;
      const ongkir = Number(t.ongkir_dasar || t.grand_total || 0);
      const tambahan = Number(t.biaya_amplop || 0) + Number(t.biaya_packing || 0);
      return sum + ongkir + tambahan;
    }, 0);
  }, [transaksiHariIni]);

  const totalDigital = useMemo(() => {
    return transaksiHariIni.reduce((sum: number, t: any) => {
      if (t.status_resi === "BATAL") return sum;
      let digital = 0;
      const ongkir = Number(t.ongkir_dasar || t.grand_total || 0);
      const tambahan = Number(t.biaya_amplop || 0) + Number(t.biaya_packing || 0);

      const mOngkir = String(t.metode_bayar || "").toUpperCase();
      if (["QRIS", "TRANSFER", "ORDER BY APP", "ORDER_BY_APP", "APP"].includes(mOngkir)) {
        digital += ongkir;
      }

      const mTambahan = String(t.metode_bayar_tambahan || "").toUpperCase();
      if (["QRIS", "TRANSFER"].includes(mTambahan)) {
        digital += tambahan;
      }

      return sum + digital;
    }, 0);
  }, [transaksiHariIni]);

  const totalWajibSetorFisik = Math.max(0, totalHakOwner - totalDigital);

  // Step 7: Auto-calculate kelengkapan
  const calculateKelengkapan = (transaksi: any): boolean => {
    if (transaksi.status_resi === "BATAL") return true;
    const mOngkir = String(transaksi.metode_bayar || "").toUpperCase();
    const hasOngkir = !!mOngkir;
    const isDigitalOngkir = mOngkir === "QRIS" || mOngkir === "TRANSFER";
    const hasBuktiOngkir = !isDigitalOngkir || !!transaksi.bukti_bayar_url;

    const totalBiayaTambahan = (Number(transaksi.biaya_amplop) || 0) + (Number(transaksi.biaya_packing) || 0);
    const hasTambahan = totalBiayaTambahan === 0 || !!transaksi.metode_bayar_tambahan;

    return hasOngkir && hasBuktiOngkir && hasTambahan;
  };

  // Step 2 & 3: Inline update handler
  const handleUpdateTransaksi = async (
    resiId: string,
    field: string,
    value: any
  ) => {
    const item = todayTransactions.find((t: any) => t.resi_id === resiId || t.transaksi_id === resiId);
    if (!item) return;

    const previousTxs = [...todayTransactions];
    // Optimistic local update
    setTodayTransactions((prev) =>
      prev.map((t) => {
        if (t.resi_id === resiId || t.transaksi_id === resiId) {
          const updated: any = { ...t };
          if (field === "metode_bayar" || field === "metode_bayar_ongkir") {
            updated.metode_bayar = value;
            updated.metode_bayar_ongkir = value;
          } else if (field === "metode_bayar_tambahan") {
            updated.metode_bayar_tambahan = value;
          } else if (field === "biaya_amplop") {
            updated.biaya_amplop = Number(value) || 0;
            const ongkir = Number(updated.ongkir_dasar || updated.grand_total || 0);
            const packing = Number(updated.biaya_packing || 0);
            const asuransi = Number(updated.biaya_asuransi || 0);
            const lain = Number(updated.biaya_lain || 0);
            const pembulatan = Number(updated.pembulatan || 0);
            updated.grand_total = ongkir + updated.biaya_amplop + packing + asuransi + lain + pembulatan;
          } else if (field === "biaya_packing") {
            updated.biaya_packing = Number(value) || 0;
            const ongkir = Number(updated.ongkir_dasar || updated.grand_total || 0);
            const amplop = Number(updated.biaya_amplop || 0);
            const asuransi = Number(updated.biaya_asuransi || 0);
            const lain = Number(updated.biaya_lain || 0);
            const pembulatan = Number(updated.pembulatan || 0);
            updated.grand_total = ongkir + amplop + updated.biaya_packing + asuransi + lain + pembulatan;
          } else if (field === "ongkir_dasar") {
            updated.ongkir_dasar = Number(value) || 0;
            const amplop = Number(updated.biaya_amplop || 0);
            const packing = Number(updated.biaya_packing || 0);
            const asuransi = Number(updated.biaya_asuransi || 0);
            const lain = Number(updated.biaya_lain || 0);
            const pembulatan = Number(updated.pembulatan || 0);
            updated.grand_total = updated.ongkir_dasar + amplop + packing + asuransi + lain + pembulatan;
          } else {
            updated[field] = value;
          }
          return updated;
        }
        return t;
      })
    );

    try {
      const backendField = field === "metode_bayar_ongkir" ? "metode_bayar" : field;
      const flatPayload: any = {
        resi_id: item.resi_id,
        old_resi_id: item.resi_id,
        transaksi_id: item.transaksi_id,
        user_id: session?.user_id,
        outlet_id: selectedClosingOutlet || session?.outlet_id_home,
        tipe: item.tipe || "Express",
        [backendField]: value,
        data: {
          resi_id: item.resi_id,
          transaksi_id: item.transaksi_id,
          [backendField]: value
        }
      };

      const res = await callBackend("updateTransaksi", {
        ...flatPayload,
        jenis_layanan: item.tipe || "Express",
        data: flatPayload
      });

      if (res?.status === "success") {
        toast.success(`Berhasil perbarui ${backendField.replace(/_/g, " ")}`);
        fetchData();
      } else {
        toast.error("Gagal update: " + (res?.message || "Terjadi kesalahan"));
        setTodayTransactions(previousTxs);
      }
    } catch (err: any) {
      console.error("Gagal update:", err);
      toast.error("Gagal update: " + err.message);
      setTodayTransactions(previousTxs);
    } finally {
      setEditingCell(null);
    }
  };

  // Step 4: Bulk update handler
  const handleBulkUpdate = async (field: string, value: any) => {
    if (selectedRows.size === 0) return;
    const targetIds: string[] = Array.from(selectedRows);
    setBulkLoading(true);
    toast.info(`Memproses ${targetIds.length} transaksi...`);

    try {
      for (const resiId of targetIds) {
        await handleUpdateTransaksi(resiId, field, value);
      }
      setSelectedRows(new Set());
      toast.success(`${targetIds.length} transaksi berhasil diperbarui`);
      fetchData();
    } catch (err: any) {
      toast.error("Gagal bulk update: " + err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  // Evidence modal helpers
  const openEvidenceModal = (
    resiId: string,
    field: "bukti_bayar_url" | "bukti_tambahan_url" | "foto_paket_url" | "foto_resi_url",
    category: "BUKTI_BAYAR" | "BUKTI_ADD" | "FOTO_PAKET" | "FOTO_RESI",
    title: string,
    currentUrl?: string
  ) => {
    setTempImagePreview(null);
    setTempBase64(null);
    setEvidenceModal({
      isOpen: true,
      resiId,
      field,
      category,
      title,
      currentUrl
    });
  };

  const handleEvidenceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Str = reader.result as string;
      setTempBase64(base64Str);
      setTempImagePreview(base64Str);
    };
    reader.readAsDataURL(file);
  };

  const handleEvidencePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Str = reader.result as string;
            setTempBase64(base64Str);
            setTempImagePreview(base64Str);
            toast.success("Gambar berhasil diambil dari clipboard!");
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    }
  };

  const handleSaveEvidence = async () => {
    if (!evidenceModal || !tempBase64) return;
    setUploadingEvidence(true);
    try {
      const fileName = `${evidenceModal.resiId}_${evidenceModal.category}_${Date.now()}.jpg`;
      const res = await callBackend("uploadFile", {
        fileBase64: tempBase64,
        fileName,
        category: evidenceModal.category
      });
      if (res?.status === "success" && res.data) {
        await handleUpdateTransaksi(evidenceModal.resiId, evidenceModal.field, res.data);
        toast.success("Foto / Bukti berhasil disimpan!");
        setEvidenceModal(null);
        setTempImagePreview(null);
        setTempBase64(null);
      } else {
        toast.error("Gagal mengunggah gambar: " + (res?.message || "Terjadi kesalahan"));
      }
    } catch (err: any) {
      toast.error("Error upload file: " + err.message);
    } finally {
      setUploadingEvidence(false);
    }
  };

  // Step 6: Validasi kelengkapan lalu buka setoran
  const handleValidateAndSubmitSetoran = () => {
    const incomplete = transaksiHariIni.filter((t: any) => !calculateKelengkapan(t));
    if (incomplete.length > 0) {
      toast.error(`Masih ada ${incomplete.length} transaksi yang belum lengkap! Mohon lengkapi metode bayar dan bukti.`);
      return;
    }

    const selectedName = outlets.find(o => o.outlet_id === selectedClosingOutlet)?.nama_outlet || selectedClosingOutlet;
    const currentBrk = adminSettlementData.find(item => item.outlet_id === selectedClosingOutlet)?.my_breakdown;
    const reqCash = totalWajibSetorFisik > 0 ? totalWajibSetorFisik : Number(currentBrk?.expected_cash || 0);
    const kasOutlet = currentBrk?.outlet_cash || activeOutletClosingStatus?.kas_outlet || 0;

    handleOpenSetoran(selectedClosingOutlet, selectedName, reqCash, kasOutlet);
  };

  // Aggregate Admin's Personal Cash Totals across all outlets
  const totalWajibSetor = adminSettlementData.reduce((acc, item) => {
    return acc + Number(item.my_breakdown?.expected_cash || 0);
  }, 0);

  const totalDisetor = adminSettlementData.reduce((acc, item) => {
    return acc + Number(item.my_breakdown?.setoran_actual || 0);
  }, 0);

  const totalOutstanding = Math.max(0, totalWajibSetor - totalDisetor);

  // Modal Action: Open Setoran
  const handleOpenSetoran = (outletId: string, outletName: string, expectedCash: number, kasOutlet: number) => {
    setTargetOutletId(outletId);
    setTargetOutletName(outletName);
    setNominalSetorInput(expectedCash);
    setSetoranNotes("");
    setMetodeSetoran("TUNAI");
    setBuktiTransferUrl("");
    setTargetKasOutlet(kasOutlet);
    setShowSetoranModal(true);
  };

  // Submit Setoran to Backend
  const handleSubmitSetoran = async () => {
    const nominal = Number(nominalSetorInput);
    if (isNaN(nominal) || nominal < 0) {
      toast.error("Nominal uang yang disetor tidak valid.");
      return;
    }

    if (metodeSetoran === "TRANSFER" && !buktiTransferUrl) {
      toast.error("Bukti transfer wajib diunggah.");
      return;
    }

    if (metodeSetoran === "KAS_OUTLET" && nominal > targetKasOutlet) {
      toast.error(`Nominal Kas Outlet tidak boleh melebihi sisa kas operasional (Rp ${targetKasOutlet.toLocaleString("id-ID")}).`);
      return;
    }

    setSubmittingSetoran(true);
    try {
      const res = await callBackend("createSetoran", {
        outlet_id: targetOutletId,
        tanggal: closingDate,
        admin_id: currentUserId,
        nominal_setor: nominal,
        actual_cash: nominal,
        catatan: setoranNotes.trim(),
        metode_setor: metodeSetoran,
        bukti_url: buktiTransferUrl
      });

      if (res.status === "success") {
        toast.success(res.message || `Setoran untuk outlet ${targetOutletName} berhasil diajukan ke Owner.`);
        setShowSetoranModal(false);
        await fetchData();
      } else {
        toast.error(res.message || "Gagal membuat laporan setoran.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Terjadi kesalahan saat mengajukan setoran.");
    } finally {
      setSubmittingSetoran(false);
    }
  };

  // Action: Validate Outlet Closing
  const handleValidateClosing = async () => {
    setValidating(true);
    try {
      const selectedName = outlets.find(o => o.outlet_id === selectedClosingOutlet)?.nama_outlet || selectedClosingOutlet;
      const res = await fetch("/api/dailyClosing/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: selectedClosingOutlet,
          outlet_name: selectedName,
          tanggal: closingDate,
          ...getActorInfo()
        })
      });

      const json = await res.json();
      if (res.ok && (json.status === "success" || json.status === "blocked")) {
        setActiveOutletClosingStatus(json.data || json);
        if (json.status === "success") {
          toast.success(json.message || `Status outlet '${selectedName}' SIAP TUTUP BUKU.`);
        } else {
          toast.error(json.message || `Outlet '${selectedName}' belum memenuhi syarat tutup buku.`);
        }
      } else {
        toast.error(json.message || "Gagal memeriksa kelayakan tutup buku.");
      }
      await fetchData();
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan koneksi saat validasi.");
    } finally {
      setValidating(false);
    }
  };

  // Action: Execute Outlet Close
  const handleExecuteClose = async () => {
    setSubmittingClose(true);
    try {
      const selectedName = outlets.find(o => o.outlet_id === selectedClosingOutlet)?.nama_outlet || selectedClosingOutlet;
      const res = await fetch("/api/dailyClosing/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: selectedClosingOutlet,
          outlet_name: selectedName,
          tanggal: closingDate,
          notes: closeNotes,
          ...getActorInfo()
        })
      });

      const json = await res.json();
      if (res.ok && json.status === "success") {
        toast.success(json.message || `Tutup buku berhasil diselesaikan untuk outlet '${selectedName}'.`);
        setShowCloseModal(false);
        setCloseNotes("");
        await fetchData();
      } else {
        toast.error(json.message || "Gagal menyelesaikan tutup buku.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan saat menutup buku operasional.");
    } finally {
      setSubmittingClose(false);
    }
  };

  const getAgingBadge = (ag: any) => {
    if (!ag) return null;
    let badgeClass = "bg-gray-100 text-gray-700 border-gray-200";
    if (ag.badge_variant === "success") {
      badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
    } else if (ag.badge_variant === "warning") {
      badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
    } else if (ag.badge_variant === "danger") {
      badgeClass = "bg-red-50 text-red-700 border-red-200";
    }

    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-black border uppercase tracking-wider ${badgeClass}`}>
        {ag.status_label || (ag.is_late ? `Terlambat ${ag.late_days} Hari` : "Tepat Waktu")}
      </span>
    );
  };

  const selectedOutletDisplayName = outlets.find(o => o.outlet_id === selectedClosingOutlet)?.nama_outlet || selectedClosingOutlet;
  const activeBookStatus = activeOutletClosingStatus?.status || "OPEN";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 font-sans text-gray-800 bg-gray-50/50 min-h-screen">
      {/* 1. ADMIN HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-150">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-700 border border-emerald-200">
              <DollarSign className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">SETORAN SAYA</h1>
          </div>
          <p className="text-xs text-gray-500 font-semibold">
            Tanggung jawab setoran harian dari transaksi yang Anda tangani ({currentUserName}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 shadow-inner">
            <Calendar className="w-4 h-4 text-gray-500" />
            <input
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-gray-800 focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
            Segarkan
          </button>
        </div>
      </div>

      {/* 1.5. HEADER FINANSIAL 3 ANGKA HARIAN ADMIN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl p-5 text-white shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-purple-200 mb-1">TOTAL HAK OWNER</p>
          <p className="text-2xl font-black font-mono">Rp {totalHakOwner.toLocaleString("id-ID")}</p>
          <p className="text-xs text-purple-200/80 mt-1 font-medium">Ongkir + Biaya Tambahan ({selectedOutletDisplayName})</p>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-5 text-white shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-200 mb-1">DIGITAL OWNER-DIRECT</p>
          <p className="text-2xl font-black font-mono">Rp {totalDigital.toLocaleString("id-ID")}</p>
          <p className="text-xs text-blue-200/80 mt-1 font-medium">QRIS / Transfer langsung ke Owner</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-700 rounded-2xl p-5 text-white shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-orange-200 mb-1">WAJIB SETOR FISIK</p>
          <p className="text-2xl font-black font-mono">Rp {totalWajibSetorFisik.toLocaleString("id-ID")}</p>
          <p className="text-xs text-orange-200/80 mt-1 font-medium">Kas fisik tunai yang wajib disetor</p>
        </div>
      </div>

      {/* 1.6. TABEL TRANSAKSI HARIAN ADMIN DENGAN INLINE EDIT & BULK ACTION */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-150 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                <FileText className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-black text-gray-900 tracking-tight">
                TRANSAKSI HARIAN — {selectedOutletDisplayName}
              </h2>
              <span className="text-xs font-extrabold px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full border border-blue-200">
                {transaksiHariIni.length} Resi
              </span>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Lengkapi metode bayar dan lampiran bukti langsung pada tabel sebelum melakukan setor.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === "compact" ? "detail" : "compact")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === "detail"
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-2xs"
                  : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {viewMode === "compact" ? "Mode Detail (Semua Bukti)" : "Mode Ringkas"}
            </button>

            <button
              type="button"
              onClick={handleValidateAndSubmitSetoran}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              Submit Setoran ke Owner
            </button>
          </div>
        </div>

        {/* BULK ACTION BAR */}
        {selectedRows.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
              <span className="text-sm font-bold text-blue-900">
                {selectedRows.size} transaksi terpilih
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleBulkUpdate("metode_bayar", "QRIS")}
                disabled={bulkLoading}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Set Ongkir → QRIS
              </button>
              <button
                type="button"
                onClick={() => handleBulkUpdate("metode_bayar_tambahan", "QRIS")}
                disabled={bulkLoading}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Set Tambahan → QRIS
              </button>
              <button
                type="button"
                onClick={() => handleBulkUpdate("metode_bayar", "TUNAI")}
                disabled={bulkLoading}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Set Ongkir → TUNAI
              </button>
              <button
                type="button"
                onClick={() => setSelectedRows(new Set())}
                disabled={bulkLoading}
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Batal Seleksi
              </button>
            </div>
          </div>
        )}

        {/* TABLE CONTENT */}
        {loadingTxs ? (
          <div className="py-12 text-center text-gray-400 space-y-2">
            <Loader2 className="w-7 h-7 mx-auto animate-spin text-blue-600" />
            <p className="text-xs font-bold">Memuat transaksi harian outlet...</p>
          </div>
        ) : transaksiHariIni.length === 0 ? (
          <div className="py-10 text-center text-gray-400 space-y-1 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <CheckCircle className="w-8 h-8 mx-auto text-gray-300" />
            <p className="text-xs font-bold text-gray-600">Tidak ada transaksi yang tercatat untuk outlet ini pada {closingDate}.</p>
            <p className="text-[11px] text-gray-400">Pastikan tanggal dan outlet sudah sesuai.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-xs text-left text-gray-700 divide-y divide-gray-200">
              <thead className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider font-mono">
                <tr>
                  <th className="p-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={transaksiHariIni.length > 0 && transaksiHariIni.every((t: any) => selectedRows.has(t.resi_id || t.transaksi_id))}
                      onChange={(e) => {
                        const newSelected = new Set(selectedRows);
                        if (e.target.checked) {
                          transaksiHariIni.forEach((t: any) => newSelected.add(t.resi_id || t.transaksi_id));
                        } else {
                          transaksiHariIni.forEach((t: any) => newSelected.delete(t.resi_id || t.transaksi_id));
                        }
                        setSelectedRows(newSelected);
                      }}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-3">No / Resi</th>
                  <th className="p-3">Pengirim ➔ Penerima</th>
                  <th className="p-3">Admin</th>
                  <th className="p-3 text-center">Metode Ongkir</th>
                  <th className="p-3 text-right">Ongkir</th>
                  <th className="p-3 text-center">Tambahan (Amplop / Packing)</th>
                  <th className="p-3 text-center">Metode Tambahan</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Bukti Ongkir</th>
                  <th className="p-3 text-center">Bukti Tambahan</th>
                  {viewMode === "detail" && (
                    <>
                      <th className="p-3 text-center">Foto Paket</th>
                      <th className="p-3 text-center">Foto Resi</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-sans">
                {transaksiHariIni.map((item: any, index: number) => {
                  const rId = item.resi_id || item.transaksi_id;
                  const isSelected = selectedRows.has(rId);
                  const isComplete = calculateKelengkapan(item);

                  return (
                    <tr 
                      key={rId || index}
                      className={`hover:bg-gray-50/80 transition-colors ${isSelected ? "bg-blue-50/40" : ""}`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const newSelected = new Set(selectedRows);
                            if (e.target.checked) {
                              newSelected.add(rId);
                            } else {
                              newSelected.delete(rId);
                            }
                            setSelectedRows(newSelected);
                          }}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* No / Resi */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-400 text-[11px] w-6">
                            {index + 1}.
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`font-mono font-bold text-xs ${item.status_resi === "BATAL" ? "text-gray-400 line-through" : "text-gray-900"}`}>
                                {item.resi_id || item.transaksi_id}
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                item.tipe === "Express" ? "bg-red-50 text-red-600 border border-red-100" : "bg-blue-50 text-blue-700 border border-blue-100"
                              }`}>
                                {item.tipe || "EZ"}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 font-medium">
                              {item.jam_transaksi || (item.timestamp ? item.timestamp.split("T")[1]?.slice(0, 5) : "-")}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Pengirim ➔ Penerima */}
                      <td className="p-3 max-w-[180px]">
                        <p className="font-semibold text-gray-800 truncate" title={item.pengirim || "Umum"}>
                          {item.pengirim || "Umum"}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate" title={item.penerima || "Umum"}>
                          ➔ {item.penerima || "Umum"}
                        </p>
                      </td>

                      {/* Admin */}
                      <td className="p-3 whitespace-nowrap">
                        <p className="font-semibold text-gray-800">
                          {item.admin || "-"}
                        </p>
                      </td>

                      {/* Metode Bayar Ongkir (Inline Edit) */}
                      <td className="p-3 text-center whitespace-nowrap">
                        {editingCell?.transaksiId === rId && editingCell?.field === "metode_bayar" ? (
                          <select
                            value={item.metode_bayar || "TUNAI"}
                            onChange={(e) => {
                              handleUpdateTransaksi(rId, "metode_bayar", e.target.value);
                              setEditingCell(null);
                            }}
                            onBlur={() => setEditingCell(null)}
                            autoFocus
                            className="px-2 py-1 border border-orange-400 rounded-lg text-xs font-bold bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 shadow-2xs cursor-pointer"
                          >
                            <option value="TUNAI">TUNAI</option>
                            <option value="QRIS">QRIS</option>
                            <option value="TRANSFER">TRANSFER</option>
                            <option value="DFOD">DFOD</option>
                          </select>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingCell({ transaksiId: rId, field: "metode_bayar" })}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                              String(item.metode_bayar).toUpperCase() === "QRIS"
                                ? "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100"
                                : String(item.metode_bayar).toUpperCase() === "TRANSFER"
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                                : String(item.metode_bayar).toUpperCase() === "DFOD"
                                ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            }`}
                            title="Klik untuk ubah metode ongkir"
                          >
                            {item.metode_bayar || "PILIH ▼"}
                          </button>
                        )}
                      </td>

                      {/* Ongkir Dasar */}
                      <td className="p-3 text-right font-mono font-semibold text-gray-800 whitespace-nowrap">
                        Rp {(Number(item.ongkir_dasar || item.grand_total) || 0).toLocaleString("id-ID")}
                      </td>

                      {/* Biaya Tambahan (Inline Inputs) */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400 font-bold">Amp:</span>
                            <input
                              type="number"
                              min={0}
                              step={500}
                              defaultValue={item.biaya_amplop || 0}
                              key={`amp-${rId}-${item.biaya_amplop}`}
                              onBlur={(e) => {
                                const val = Number(e.target.value) || 0;
                                if (val !== (item.biaya_amplop || 0)) {
                                  handleUpdateTransaksi(rId, "biaya_amplop", val);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              }}
                              placeholder="0"
                              className="w-16 px-1.5 py-1 border border-gray-200 rounded text-xs font-mono text-right bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-500"
                              title="Biaya Amplop"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400 font-bold">Pac:</span>
                            <input
                              type="number"
                              min={0}
                              step={1000}
                              defaultValue={item.biaya_packing || 0}
                              key={`pac-${rId}-${item.biaya_packing}`}
                              onBlur={(e) => {
                                const val = Number(e.target.value) || 0;
                                if (val !== (item.biaya_packing || 0)) {
                                  handleUpdateTransaksi(rId, "biaya_packing", val);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              }}
                              placeholder="0"
                              className="w-16 px-1.5 py-1 border border-gray-200 rounded text-xs font-mono text-right bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-500"
                              title="Biaya Packing"
                            />
                          </div>
                        </div>
                      </td>

                      {/* Metode Tambahan (Inline Dropdown) */}
                      <td className="p-3 text-center whitespace-nowrap">
                        {editingCell?.transaksiId === rId && editingCell?.field === "metode_bayar_tambahan" ? (
                          <select
                            value={item.metode_bayar_tambahan || ""}
                            onChange={(e) => {
                              handleUpdateTransaksi(rId, "metode_bayar_tambahan", e.target.value);
                              setEditingCell(null);
                            }}
                            onBlur={() => setEditingCell(null)}
                            autoFocus
                            className="px-2 py-1 border border-purple-400 rounded-lg text-xs font-bold bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-2xs cursor-pointer"
                          >
                            <option value="">-</option>
                            <option value="TUNAI">TUNAI</option>
                            <option value="QRIS">QRIS</option>
                            <option value="TRANSFER">TRANSFER</option>
                          </select>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingCell({ transaksiId: rId, field: "metode_bayar_tambahan" })}
                            className={`px-2 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                              item.metode_bayar_tambahan
                                ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 font-bold"
                                : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                            }`}
                            title="Klik untuk ubah metode biaya tambahan"
                          >
                            {item.metode_bayar_tambahan || "-"}
                          </button>
                        )}
                      </td>

                      {/* Total */}
                      <td className="p-3 text-right font-mono font-bold text-gray-900 whitespace-nowrap">
                        Rp {(Number(item.grand_total) || 0).toLocaleString("id-ID")}
                      </td>

                      {/* Kelengkapan */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isComplete
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}>
                          {isComplete ? "LENGKAP" : "BELUM"}
                        </span>
                      </td>

                      {/* Bukti Ongkir */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEvidenceModal(rId, "bukti_bayar_url", "BUKTI_BAYAR", "Bukti Pembayaran Ongkir", item.bukti_bayar_url)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 border transition-colors cursor-pointer ${
                            item.bukti_bayar_url
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
                          }`}
                        >
                          {item.bukti_bayar_url ? "🖼 Lihat" : "📷 Tambah"}
                        </button>
                      </td>

                      {/* Bukti Tambahan */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEvidenceModal(rId, "bukti_tambahan_url", "BUKTI_ADD", "Bukti Biaya Tambahan", item.bukti_tambahan_url)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 border transition-colors cursor-pointer ${
                            item.bukti_tambahan_url
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
                          }`}
                        >
                          {item.bukti_tambahan_url ? "🖼 Lihat" : "📷 Tambah"}
                        </button>
                      </td>

                      {/* Detail Photos */}
                      {viewMode === "detail" && (
                        <>
                          <td className="p-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openEvidenceModal(rId, "foto_paket_url", "FOTO_PAKET", "Foto Paket / Barang", item.foto_paket_url)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 border transition-colors cursor-pointer ${
                                item.foto_paket_url
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                  : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
                              }`}
                            >
                              {item.foto_paket_url ? "🖼 Lihat" : "📷 Tambah"}
                            </button>
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openEvidenceModal(rId, "foto_resi_url", "FOTO_RESI", "Foto Fisik Resi", item.foto_resi_url)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 border transition-colors cursor-pointer ${
                                item.foto_resi_url
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                  : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
                              }`}
                            >
                              {item.foto_resi_url ? "🖼 Lihat" : "📷 Tambah"}
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. SECTION 1 — CASH RESPONSIBILITY (DOMINANT TOP SECTION) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
              <span>TANGGUNG JAWAB SETORAN HARIAN PER OUTLET</span>
              <span className="text-xs font-extrabold px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                {adminSettlementData.length} Outlet
              </span>
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Uang tunai hasil transaksi Anda yang wajib disetorkan ke Owner pada tanggal {closingDate}.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl p-10 border border-gray-150 text-center text-gray-400 space-y-3">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-emerald-600" />
            <p className="text-xs font-bold">Memeriksa tanggung jawab setoran harian Anda...</p>
          </div>
        ) : adminSettlementData.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-gray-150 text-center text-gray-400 space-y-2 shadow-sm">
            <CheckCircle className="w-10 h-10 mx-auto text-emerald-500 opacity-60" />
            <h3 className="text-sm font-black text-gray-700">Tidak Ada Tanggung Jawab Setoran</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Tidak ditemukan transaksi tunai yang tercatat atas nama akun Anda pada tanggal {closingDate}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {adminSettlementData.map((item) => {
              const brk = item.my_breakdown;
              const reqCash = Number(brk.expected_cash || 0);
              const actCash = Number(brk.setoran_actual || 0);
              const variance = Number(brk.setoran_variance || 0);
              const rawStatus = brk.setoran_status || "BELUM_SUBMIT";
              const ag = brk.aging || calculateSettlementAging(brk.tanggal || closingDate, brk.created_at || null, actCash > 0 || rawStatus !== "BELUM_SUBMIT");
              
              const isMatched = rawStatus === "MATCH" || rawStatus === "MATCHED" || rawStatus === "OK" || rawStatus === "DISETUJUI";
              const isPending = rawStatus === "MENUNGGU_APPROVAL" || rawStatus === "UNAPPROVED";

              return (
                <div
                  key={item.outlet_id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-150 p-5 space-y-4 hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-gray-100 rounded-lg text-gray-700">
                          <Store className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">
                            {item.outlet_name}
                          </h3>
                          <span className="text-[10px] font-bold text-gray-400">
                            {item.outlet_id}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        {getAgingBadge(ag)}
                      </div>
                    </div>

                    {/* Card Body Numbers */}
                    <div className="mt-4 space-y-2.5 text-xs">
                      <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl">
                        <span className="text-gray-600 font-bold">Wajib Setor Harian:</span>
                        <span className="font-black text-sm text-gray-900">
                          Rp {reqCash.toLocaleString("id-ID")}
                        </span>
                      </div>

                      <div className="flex justify-between items-center px-1">
                        <span className="text-gray-500 font-medium">Sudah Disetor:</span>
                        <span className="font-bold text-emerald-600">
                          Rp {actCash.toLocaleString("id-ID")}
                        </span>
                      </div>

                      <div className="flex justify-between items-center px-1 border-b border-gray-100 pb-2">
                        <span className="text-gray-500 font-medium">Selisih:</span>
                        <span className={`font-bold ${variance === 0 ? "text-emerald-600" : "text-red-600"}`}>
                          Rp {variance.toLocaleString("id-ID")}
                        </span>
                      </div>

                      <div className="flex justify-between items-center px-1 pt-1">
                        <span className="text-gray-500 font-medium">Status Setoran:</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                            isMatched
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : isPending
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {isMatched ? "SESUAI" : isPending ? "MENUNGGU PERSETUJUAN" : rawStatus === "BELUM_SUBMIT" ? "BELUM SETOR" : rawStatus}
                        </span>
                      </div>

                      <div className="flex justify-between items-center px-1 text-[11px] text-gray-400">
                        <span>Resi Tunai Terhitung:</span>
                        <span className="font-bold text-gray-700">{brk.jumlah_resi || 0} resi</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Button */}
                  <div className="pt-3 border-t border-gray-100">
                    {isMatched ? (
                      <div className="w-full py-2.5 px-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-black flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> SETORAN LUNAS
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {isPending && (
                          <div className="w-full py-2 px-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5">
                            <Clock className="w-3 h-3" /> ADA SETORAN MENUNGGU PERSETUJUAN
                          </div>
                        )}
                        <button
                          onClick={() => handleOpenSetoran(item.outlet_id, item.outlet_name, reqCash, brk.outlet_cash || 0)}
                          className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer transition-all active:scale-[0.98]"
                        >
                          <DollarSign className="w-4 h-4" /> {(brk.setoran_actual || 0) > 0 ? "TAMBAH SETORAN (SISA)" : "BUAT SETORAN"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. SECTION 2 — TOTAL TANGGUNG JAWAB SAYA (AGGREGATE CARD) */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700 pb-3">
          <div>
            <h3 className="text-sm font-black tracking-wider uppercase text-emerald-400">
              REKAPITULASI TOTAL SETORAN SAYA
            </h3>
            <p className="text-xs text-slate-300">
              Total kewajiban setoran harian Anda di seluruh outlet pada {closingDate}
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-slate-700/80 rounded-full border border-slate-600 text-slate-200">
            {adminSettlementData.length} Cabang Terkait
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
            <span className="text-[11px] font-bold text-slate-400 block mb-1">TOTAL WAJIB SETOR</span>
            <span className="text-xl font-black text-white">
              Rp {totalWajibSetor.toLocaleString("id-ID")}
            </span>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
            <span className="text-[11px] font-bold text-slate-400 block mb-1">TOTAL SUDAH DISETOR</span>
            <span className="text-xl font-black text-emerald-400">
              Rp {totalDisetor.toLocaleString("id-ID")}
            </span>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
            <span className="text-[11px] font-bold text-slate-400 block mb-1">SISA BELUM DISETOR</span>
            <span className={`text-xl font-black ${totalOutstanding === 0 ? "text-slate-300" : "text-amber-400"}`}>
              Rp {totalOutstanding.toLocaleString("id-ID")}
            </span>
          </div>
        </div>
      </div>

      {/* 4. SECTION 3 — TUTUP BUKU OUTLET AKTIF (SEPARATED OPERATIONAL SCOPE) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-150 p-6 space-y-5">
        <div className="border-b border-gray-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-gray-900 tracking-tight">
                  TUTUP BUKU OPERASIONAL (OUTLET AKTIF)
                </h3>
              </div>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Tutup Buku adalah penutupan operasional outlet, terpisah dari kewajiban setoran harian admin.
              </p>
            </div>

            {/* Dropdown to switch active outlet for closing */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">Pilih Outlet:</span>
              <select
                value={selectedClosingOutlet}
                onChange={(e) => handleSelectClosingOutlet(e.target.value)}
                className="bg-gray-50 border border-gray-200 text-xs font-bold text-gray-800 px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                {outlets.map((o) => (
                  <option key={o.outlet_id} value={o.outlet_id}>
                    {o.nama_outlet}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Active Outlet Book Status Info Card */}
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">Status Buku {selectedOutletDisplayName}:</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase border ${
                  activeBookStatus === "CLOSED"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : activeBookStatus === "READY"
                    ? "bg-blue-100 text-blue-800 border-blue-300"
                    : activeBookStatus === "BLOCKED"
                    ? "bg-red-100 text-red-800 border-red-300"
                    : "bg-amber-100 text-amber-800 border-amber-300"
                }`}
              >
                {activeBookStatus === "CLOSED"
                  ? "SUDAH DITUTUP"
                  : activeBookStatus === "READY"
                  ? "SIAP TUTUP BUKU"
                  : activeBookStatus === "BLOCKED"
                  ? "TERKENDALA"
                  : activeBookStatus}
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Total Transaksi Outlet: <strong className="text-gray-800">{activeOutletClosingStatus?.transaction_count || 0} resi</strong>
            </p>
          </div>

          {/* Action CTAs for closing */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleValidateClosing}
              disabled={validating || loading}
              className="px-3.5 py-2 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-blue-600" />}
              Cek Kelayakan
            </button>

            {activeBookStatus !== "CLOSED" && (
              <button
                onClick={() => setShowCloseModal(true)}
                disabled={validating || loading || activeBookStatus === "BLOCKED"}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-blue-600/20 disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 inline mr-1.5" />
                Tutup Buku Outlet
              </button>
            )}
          </div>
        </div>

        {/* Blocking reasons notification (if any) */}
        {activeOutletClosingStatus?.blocking_reasons && activeOutletClosingStatus.blocking_reasons.length > 0 && activeBookStatus !== "CLOSED" && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Pemberitahuan Kelayakan Tutup Buku:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-800">
                {activeOutletClosingStatus.blocking_reasons.map((reason: string, idx: number) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
              <span className="text-[10px] text-amber-700 font-semibold block pt-1">
                * Catatan: Jika kendala membutuhkan otorisasi, koordinasikan dengan Owner.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: BUAT SETORAN */}
      {showSetoranModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700">
                  <DollarSign className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-gray-800 text-sm">Buat Setoran ke Owner</h3>
              </div>
              <button
                onClick={() => setShowSetoranModal(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium text-emerald-700">Outlet Tujuan:</span>
                  <span className="font-bold text-emerald-950">{targetOutletName} ({targetOutletId})</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-emerald-700">Tanggal Transaksi:</span>
                  <span className="font-bold text-emerald-950">{closingDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-emerald-700">Penyetor (Admin):</span>
                  <span className="font-bold text-emerald-950">{currentUserName} ({currentUserId})</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nominal Uang Disetor (Rp)
                </label>
                <input
                  type="number"
                  value={nominalSetorInput}
                  onChange={(e) => setNominalSetorInput(e.target.value)}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Bentuk / Metode Uang
                </label>
                <select
                  value={metodeSetoran}
                  onChange={(e) => setMetodeSetoran(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-gray-50"
                >
                  <option value="TUNAI">Tunai Fisik</option>
                  <option value="TRANSFER">Transfer Bank</option>
                  <option value="KAS_OUTLET">Tahan Kas Operasional</option>
                </select>
              </div>

              {metodeSetoran === "TRANSFER" && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Upload Bukti Transfer
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      setUploadingBukti(true);
                      try {
                        const reader = new FileReader();
                        reader.readAsDataURL(file);
                        reader.onload = async () => {
                          const base64 = reader.result as string;
                          const res = await fetch("/api/uploadFile", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              fileBase64: base64,
                              fileName: `BUKTI_TF_${targetOutletId}_${closingDate}`,
                              category: "SETORAN"
                            })
                          });
                          const data = await res.json();
                          if (res.ok && data.url) {
                            setBuktiTransferUrl(data.url);
                            toast.success("Bukti transfer berhasil diunggah.");
                          } else {
                            toast.error(data.message || "Gagal mengunggah bukti.");
                          }
                          setUploadingBukti(false);
                        };
                      } catch (err) {
                        toast.error("Terjadi kesalahan upload.");
                        setUploadingBukti(false);
                      }
                    }}
                    className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                  />
                  {uploadingBukti && <p className="text-[10px] text-emerald-600 font-medium mt-1"><Loader2 className="w-3 h-3 animate-spin inline mr-1" /> Mengunggah...</p>}
                  {buktiTransferUrl && !uploadingBukti && <p className="text-[10px] text-emerald-600 font-medium mt-1">✔ Bukti terlampir</p>}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Catatan / Keterangan (Opsional)
                </label>
                <textarea
                  value={setoranNotes}
                  onChange={(e) => setSetoranNotes(e.target.value)}
                  rows={2}
                  placeholder="Misal: Disetor tunai ke Owner, atau via transfer..."
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-gray-50"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
              <button
                onClick={() => setShowSetoranModal(false)}
                disabled={submittingSetoran}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSubmitSetoran}
                disabled={submittingSetoran}
                className="px-4 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer"
              >
                {submittingSetoran ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Kirim Laporan Setoran
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TUTUP BUKU CONFIRMATION */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-lg text-blue-700">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-gray-800 text-sm">Konfirmasi Tutup Buku Outlet</h3>
              </div>
              <button
                onClick={() => setShowCloseModal(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-600 leading-relaxed">
                Anda akan menutup buku harian untuk outlet <strong className="text-gray-900">{selectedOutletDisplayName}</strong> tanggal <strong className="text-gray-900">{closingDate}</strong>.
              </p>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Catatan Penutupan (Opsional)
                </label>
                <textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  rows={3}
                  placeholder="Tambahkan catatan serah terima atau kondisi operasional outlet..."
                  className="w-full border border-gray-200 rounded-xl p-3 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
              <button
                onClick={() => setShowCloseModal(false)}
                disabled={submittingClose}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteClose}
                disabled={submittingClose}
                className="px-4 py-2 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm shadow-blue-600/20 cursor-pointer"
              >
                {submittingClose ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                Selesaikan Tutup Buku
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EVIDENCE UPLOAD & PREVIEW */}
      {evidenceModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in"
          onPaste={handleEvidencePaste}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-gray-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-800">{evidenceModal.title}</h3>
                  <p className="text-xs text-gray-400 font-mono">No. Resi: {evidenceModal.resiId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEvidenceModal(null);
                  setTempImagePreview(null);
                  setTempBase64(null);
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current or Preview Image */}
            <div className="space-y-3">
              {(tempImagePreview || evidenceModal.currentUrl) ? (
                <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex flex-col items-center p-2">
                  <img
                    src={tempImagePreview || evidenceModal.currentUrl}
                    alt="Preview Bukti"
                    className="max-h-64 object-contain rounded-lg w-full shadow-2xs"
                  />
                  {evidenceModal.currentUrl && !tempImagePreview && (
                    <a
                      href={evidenceModal.currentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                    >
                      Buka Gambar Penuh <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {tempImagePreview && (
                    <p className="text-[11px] font-semibold text-emerald-600 mt-2">
                      Siap diunggah (pratinjau baru)
                    </p>
                  )}
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400 bg-gray-50/50">
                  <ImageIcon className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-xs font-semibold text-gray-600">Belum ada foto atau bukti tersimpan.</p>
                </div>
              )}

              {/* Paste or Upload Area */}
              <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl text-center space-y-2">
                <p className="text-xs font-semibold text-blue-900">
                  📋 Salin & Tempel (Paste) atau Unggah Berkas
                </p>
                <p className="text-[11px] text-blue-700/80">
                  Tekan <kbd className="px-1.5 py-0.5 bg-white border border-blue-200 rounded font-mono text-[10px] text-gray-700">Ctrl + V</kbd> di jendela ini, atau pilih gambar dari galeri/file.
                </p>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-300 hover:bg-blue-50 text-blue-700 text-xs font-bold rounded-lg cursor-pointer transition shadow-2xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Pilih File Gambar</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEvidenceFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setEvidenceModal(null);
                  setTempImagePreview(null);
                  setTempBase64(null);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer transition"
              >
                Batal
              </button>
              {tempBase64 && (
                <button
                  type="button"
                  onClick={handleSaveEvidence}
                  disabled={uploadingEvidence}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {uploadingEvidence ? "Mengunggah..." : "Simpan & Terapkan"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
