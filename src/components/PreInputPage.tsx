import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  User, Phone, MapPin, Sparkles, Camera, Image as ImageIcon, 
  Save, ArrowLeft, CheckCircle2, Clipboard, ChevronRight, RefreshCw, AlertCircle, BookOpen,
  PlusCircle, Search, Filter, XCircle, Clock, Play, Edit3, Trash2, Zap, Check, AlertTriangle, Layers,
  CreditCard, Hash, ArrowRight, Activity, Scale, DollarSign, Tag
, ChevronLeft} from 'lucide-react';
import useAppsScript from "../hooks/useAppsScript";
import { SessionData, Outlet, MasterCustomer, RiwayatPenerima } from "../types";
import { toast } from "../utils/toast";
import AddressBookDrawer from "./AddressBookDrawer";
import { calculateWeight } from "../utils/weightCalculator";
import { getDisplayImageUrl } from "../utils/image";

interface PreInputPageProps {
  session: SessionData;
  activeOutletId: string;
  onChangeActiveOutlet: (id: string) => void;
  outlets: Outlet[];
  onNavigate: (view: string) => void;
}

export default function PreInputPage({ 
  session, 
  activeOutletId, 
  onChangeActiveOutlet, 
  outlets,
  onNavigate 
}: PreInputPageProps) {
  const { callBackend, loading } = useAppsScript();

  // Active Draft ID being edited in form (null = New Draft)
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  
  // States - Form Pengirim
  const [namaPengirim, setNamaPengirim] = useState("");
  const [hpPengirim, setHpPengirim] = useState("");
  const [alamatPengirim, setAlamatPengirim] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  
  // Customer Suggestions Dropdown
  const [customerSuggestions, setCustomerSuggestions] = useState<MasterCustomer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [penerimaSuggestions, setPenerimaSuggestions] = useState<any[]>([]);
  const [showPenerimaSuggestions, setShowPenerimaSuggestions] = useState(false);
  const [searchingPenerima, setSearchingPenerima] = useState(false);
  const penerimaSuggestionContainerRef = useRef<HTMLDivElement>(null);
  const namaPenerimaInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<any>(null);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  
  // Recipient History
  const [riwayatPenerima, setRiwayatPenerima] = useState<RiwayatPenerima[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // States - Form Penerima
  const [namaPenerima, setNamaPenerima] = useState("");
  const [hpPenerima, setHpPenerima] = useState("");
  const [alamatPenerima, setAlamatPenerima] = useState("");
  const [optimizingAddress, setOptimizingAddress] = useState(false);
  const [aiNotice, setAiNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [alamatPenerimaAsli, setAlamatPenerimaAsli] = useState("");
  const [suggestedAddress, setSuggestedAddress] = useState<string | null>(null);

  // States - Form Paket
  const [ekspedisi, setEkspedisi] = useState<"Express" | "Cargo">("Express");
  const [namaBarang, setNamaBarang] = useState("");
  const [beratKg, setBeratKg] = useState("0");
  const [volP, setVolP] = useState("");
  const [volL, setVolL] = useState("");
  const [volT, setVolT] = useState("");
  const [nilaiBarangRaw, setNilaiBarangRaw] = useState("");
  const [fotoPaketUrl, setFotoPaketUrl] = useState("");
  const [fotoResiUrl, setFotoResiUrl] = useState("");
  const [uploadingFotoPaket, setUploadingFotoPaket] = useState(false);
  const [uploadingFotoResi, setUploadingFotoResi] = useState(false);
  const [catatanAdmin, setCatatanAdmin] = useState("");

  const [sysConfig, setSysConfig] = useState<any>(null);

  // Workspace States (Operational Board 4 Columns)
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("Semua");
  const [autoSaveStatus, setAutoSaveStatus] = useState<string | null>(null);
  const [activeBoardTab, setActiveBoardTab] = useState("DRAFT");
  const [boardPage, setBoardPage] = useState(1);
  const [boardLimit, setBoardLimit] = useState(5);
  const [users, setUsers] = useState<any[]>([]);
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      const res = await callBackend("getUsers");
      if (res && res.status === "success" && Array.isArray(res.data)) setUsers(res.data);
    };
    fetchUsers();
  }, [callBackend]);

  const handleSimpanDraftManual = async () => {
    setFormError(null);
    try {
      const calc = calcWeight();
      const payload = {
        transaksi_id: editingTxId,
        is_draft: true,
        status: "Draft",
        admin_id: session.user_id,
        admin_name: session.nama_lengkap || session.username || session.user_id,
        outlet_id_tugas: activeOutletId,
        nama_pengirim: String(namaPengirim || "").trim(),
        hp_pengirim: String(hpPengirim || "").trim(),
        alamat_pengirim: String(alamatPengirim || "").trim(),
        nama_penerima: String(namaPenerima || "").trim(),
        hp_penerima: String(hpPenerima || "").trim(),
        alamat_penerima: String(alamatPenerima || "").trim(),
        alamat_penerima_asli: alamatPenerimaAsli || String(alamatPenerima || "").trim(),
        catatan_admin: String(catatanAdmin || "").trim(),
        nama_barang: String(namaBarang || "").trim(),
        ekspedisi,
        berat_timbangan: Number(beratKg) || 0,
        panjang_cm: Number(volP) || 0,
        lebar_cm: Number(volL) || 0,
        tinggi_cm: Number(volT) || 0,
        berat_volume: calc.berat_volume,
        dasar_berat: calc.dasar_berat,
        berat_kg: calc.berat_penagihan,
        volume: `${volP || 0} x ${volL || 0} x ${volT || 0}`,
        nilai_barang: getCleanNumberValue(nilaiBarangRaw || ""),
        foto_paket_url: fotoPaketUrl || "",
        foto_resi_url: fotoResiUrl || ""
      };
      
      setAutoSaveStatus("Menyimpan draft...");
      const res = await callBackend("saveDataPreInput", payload);
      if (res && res.status === "success" && res.data) {
        const txId = res.data.transaksi_id;
        if (!editingTxId) setEditingTxId(txId);
        localStorage.setItem("active_draft_tx_id", txId);
        setAutoSaveStatus(`Draft Tersimpan ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`);
        
        const draftsRes = await callBackend("getPreInputDrafts");
        if (draftsRes && draftsRes.status === "success" && Array.isArray(draftsRes.data)) {
          setDrafts(draftsRes.data);
        }
      }
    } catch (e) {
      console.error("Manual save failed:", e);
      setAutoSaveStatus("Gagal menyimpan draft");
    }
  };

  const confirmAndExecuteHapusDraft = async (txId: string) => {
    try {
      // Optimistic delete
      setDrafts(prev => prev.filter(d => d.transaksi_id !== txId));
      if (editingTxId === txId) handleDraftBaru();
      
      const res = await callBackend("deletePreInputDraft", { transaksi_id: txId, admin_id: session.user_id });
      if (res && res.status === "success") {
        toast.success(`Draft ${txId} berhasil dihapus permanen`);
        const draftsRes = await callBackend("getPreInputDrafts");
        if (draftsRes && draftsRes.status === "success" && Array.isArray(draftsRes.data)) {
          setDrafts(draftsRes.data);
        }
      } else {
        toast.error("Gagal menghapus draft: " + (res?.message || "Error server"));
        const draftsRes = await callBackend("getPreInputDrafts");
        if (draftsRes && draftsRes.status === "success" && Array.isArray(draftsRes.data)) {
          setDrafts(draftsRes.data);
        }
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Terjadi kesalahan saat menghapus draft");
    } finally {
      setDraftToDelete(null);
    }
  };

  const handleHapusDraft = (txId: string) => {
    setDraftToDelete(txId);
  };

  const [duplicateAlert, setDuplicateAlert] = useState<any | null>(null);

  // New Operational Workspace Filters
  const [filterOutlet, setFilterOutlet] = useState<string>("ALL");
  const [filterHari, setFilterHari] = useState<string>("ALL"); // ALL, TODAY, WEEK, MONTH
  const [filterEkspedisi, setFilterEkspedisi] = useState<string>("ALL");
  const [filterAdmin, setFilterAdmin] = useState<string>("ALL");

  // Resi Modal State
  const [resiModalData, setResiModalData] = useState<any | null>(null);
  const [inputResiNumber, setInputResiNumber] = useState<string>("");

  // Recent Quick Fill lists
  const [recentCustomers, setRecentCustomers] = useState<MasterCustomer[]>([]);
  const [recentAddresses, setRecentAddresses] = useState<string[]>([]);

  // Success and Clearing Screen States
  const [submittedTxId, setSubmittedTxId] = useState<string | null>(null);
  const [clearingText, setClearingText] = useState("");
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [copiedFieldKey, setCopiedFieldKey] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Address Book Drawers
  const [bukuPengirimOpen, setBukuPengirimOpen] = useState(false);
  const [bukuPenerimaOpen, setBukuPenerimaOpen] = useState(false);

  // Popup Validasi Kualitas Foto
  const [showValidationPopup, setShowValidationPopup] = useState(false);
  const [validationPopupData, setValidationPopupData] = useState<{
    type: "paket" | "resi";
    previewUrl: string;
    remoteUrl?: string;
    detectedResiId: string | null;
    extractedInfo?: {
      resi_id?: string;
      nama_pengirim?: string;
      hp_pengirim?: string;
      alamat_pengirim?: string;
      nama_penerima?: string;
      hp_penerima?: string;
      alamat_penerima?: string;
      nama_barang?: string;
    } | null;
  } | null>(null);

  // Refs
  const namaInputRef = useRef<HTMLInputElement>(null);
  const cameraPaketInputRef = useRef<HTMLInputElement>(null);
  const cameraResiInputRef = useRef<HTMLInputElement>(null);
  const clearingTextRef = useRef<HTMLTextAreaElement>(null);
  const suggestionContainerRef = useRef<HTMLDivElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load Settings & Master Data on mount
  useEffect(() => {
    callBackend("getAllSettings")
      .then(res => {
        if (res?.data?.systemSettings) setSysConfig(res.data.systemSettings);
      })
      .catch(console.error);

    fetchDrafts();
    fetchRecentMasterData();
  }, [callBackend]);

  // Fetch Drafts from backend (supports lightweight background polling)
  const fetchDrafts = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoadingDrafts(true);
    try {
      const response = await callBackend("getPreInputDrafts");
      if (response && response.status === "success" && Array.isArray(response.data)) {
        setDrafts(response.data);
      }
    } catch (err) {
      console.error("Gagal memuat list draft workspace:", err);
    } finally {
      if (!isBackground) setLoadingDrafts(false);
    }
  }, [callBackend]);

  // AUTO REFRESH: Polling ringan setiap 5 detik
  useEffect(() => {
    const timer = setInterval(() => {
      fetchDrafts(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [fetchDrafts]);

  // Fetch recent customers (max 5) and addresses (max 5)
  const fetchRecentMasterData = useCallback(async () => {
    try {
      const cstRes = await callBackend("getCustomersMaster");
      if (cstRes && cstRes.status === "success" && Array.isArray(cstRes.data)) {
        setRecentCustomers(cstRes.data.slice(0, 5));
      }

      const sndRes = await callBackend("getBukuPengirim");
      if (sndRes && sndRes.status === "success" && Array.isArray(sndRes.data)) {
        const uniqueAddresses = Array.from(
          new Set(sndRes.data.map((item: any) => item.alamat).filter(Boolean))
        ).slice(0, 5) as string[];
        setRecentAddresses(uniqueAddresses);
      }
    } catch (e) {
      console.error("Failed to load recent master data", e);
    }
  }, [callBackend]);

  // Recover active draft from localStorage on initial render
  useEffect(() => {
    const savedDraftId = localStorage.getItem("active_draft_tx_id");
    if (savedDraftId && !editingTxId) {
      callBackend("getPreInput", { transaksi_id: savedDraftId })
        .then(res => {
          if (res && res.status === "success" && res.data) {
            populateFormFromDraft(res.data);
            setEditingTxId(savedDraftId);
            toast.info(`Draft ${savedDraftId} dipulihkan dari sesi sebelumnya.`);
          } else {
            localStorage.removeItem("active_draft_tx_id");
          }
        })
        .catch(() => {
          localStorage.removeItem("active_draft_tx_id");
        });
    }
  }, [callBackend]);

  // Weight Calculation Helper
  const calcWeight = () => {
    return calculateWeight(
      parseFloat(beratKg) || 0,
      parseFloat(volP) || 0,
      parseFloat(volL) || 0,
      parseFloat(volT) || 0,
      ekspedisi,
      sysConfig?.divisor_express || 6000,
      sysConfig?.divisor_cargo || 5000
    );
  };

  // Convert Rp string formatted back to integer
  const getCleanNumberValue = (rpStr: string | number): number => {
    return Number(String(rpStr || "").replace(/\D/g, "")) || 0;
  };

  // Debounced Customer Search on Sender Name
  useEffect(() => {
    if (String(namaPengirim || "").trim().length < 2 || selectedCustomerId) {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSearchingCustomer(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const response = await callBackend("searchCustomer", { query: namaPengirim });
        if (response && response.status === "success" && response.data) {
          setCustomerSuggestions(response.data);
          setShowSuggestions(response.data.length > 0);
        }
      } catch (e) {
        console.error("Search Customer failed", e);
      } finally {
        setSearchingCustomer(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [namaPengirim, selectedCustomerId, callBackend]);

  // Close suggestions dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionContainerRef.current && !suggestionContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
      if (penerimaSuggestionContainerRef.current && !penerimaSuggestionContainerRef.current.contains(event.target as Node)) {
        setShowPenerimaSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch Recipient History when customer ID selected
  useEffect(() => {
    if (!selectedCustomerId) {
      setRiwayatPenerima([]);
      return;
    }

    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const response = await callBackend("getRiwayatPenerima", { customer_id: selectedCustomerId });
        if (response && response.status === "success" && response.data) {
          setRiwayatPenerima(response.data);
        }
      } catch (err) {
        console.error("Failed to fetch recipient history", err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [selectedCustomerId, callBackend]);

  // Duplicate Customer Detection
  useEffect(() => {
    const normPhone = String(hpPengirim || "").replace(/\D/g, "");
    const safeNama = String(namaPengirim || "").trim();
    if (!safeNama && !normPhone) {
      setDuplicateAlert(null);
      return;
    }

    const existingMatch = drafts.find((d) => {
      if (d.transaksi_id === editingTxId) return false;
      if (d.status === "SELESAI" || d.status === "Dibatalkan" || d.status === "BATAL") return false;
      
      const dPhone = String(d.hp_pengirim || "").replace(/\D/g, "");
      const dName = String(d.nama_pengirim || "").trim().toLowerCase();
      
      const matchName = dName && safeNama.toLowerCase() === dName;
      const matchPhone = normPhone && normPhone.length >= 8 && dPhone === normPhone;
      
      return matchName || matchPhone;
    });

    setDuplicateAlert(existingMatch || null);
  }, [namaPengirim, hpPengirim, drafts, editingTxId]);

  

  // Form Reset / Draft Baru action
  const handleDraftBaru = useCallback(() => {
    setEditingTxId(null);
    localStorage.removeItem("active_draft_tx_id");
    setNamaPengirim("");
    setHpPengirim("");
    setAlamatPengirim("");
    setSelectedCustomerId(null);
    setNamaPenerima("");
    setHpPenerima("");
    setAlamatPenerima("");
    setEkspedisi("Express");
    setNamaBarang("");
    setBeratKg("0");
    setVolP("");
    setVolL("");
    setVolT("");
    setNilaiBarangRaw("");
    setFotoPaketUrl("");
    setFotoResiUrl("");
    setCatatanAdmin("");
    setSubmittedTxId(null);
    setClearingText("");
    setAiNotice(null);
    setFormError(null);
    setAlamatPenerimaAsli("");
    setSuggestedAddress(null);
    setDuplicateAlert(null);
    setAutoSaveStatus(null);

    setTimeout(() => {
      namaInputRef.current?.focus();
    }, 50);

    toast.info("Form dibersihkan. Siap untuk draft baru.");
  }, []);

  // Keyboard Shortcuts Listener (Ctrl+N: New Draft, Ctrl+S: Manual Save, Esc: Cancel/Reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleDraftBaru();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSimpanDraftManual();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleDraftBaru();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDraftBaru]);

  // Populate form fields from a Draft object
  const populateFormFromDraft = (draft: any) => {
    if (!draft) return;

    // 1. Pengirim
    setNamaPengirim(draft.nama_pengirim || draft.namaPengirim || draft.pengirim || draft.nama || "");
    setHpPengirim(draft.hp_pengirim || draft.hpPengirim || draft.no_hp_pengirim || draft.telepon_pengirim || draft.hp || "");
    setAlamatPengirim(draft.alamat_pengirim || draft.alamatPengirim || draft.alamat_pengirim_asli || draft.alamat || "");

    // 2. Penerima & Alamat
    setNamaPenerima(draft.nama_penerima || draft.namaPenerima || draft.penerima || "");
    setHpPenerima(draft.hp_penerima || draft.hpPenerima || draft.no_hp_penerima || draft.telepon_penerima || "");
    setAlamatPenerima(draft.alamat_penerima || draft.alamatPenerima || "");
    setAlamatPenerimaAsli(draft.alamat_penerima_asli || draft.alamat_asli || draft.alamat_penerima || draft.alamatPenerima || "");

    // 3. Ekspedisi
    const expStr = String(draft.ekspedisi || draft.layanan || draft.service || draft.jenis_layanan || "Express").toUpperCase();
    setEkspedisi(expStr.includes("CARGO") ? "Cargo" : "Express");

    // 4. Barang
    setNamaBarang(draft.nama_barang || draft.namaBarang || draft.barang || draft.deskripsi_barang || draft.deskripsi || "");

    // 5. Berat
    const bVal = [
      draft.berat_timbangan,
      draft.berat_kg,
      draft.beratKg,
      draft.berat,
      draft.berat_penagihan
    ].find(v => v !== undefined && v !== null && v !== "" && !isNaN(Number(v)) && Number(v) > 0);
    setBeratKg(bVal !== undefined ? String(bVal) : "0");

    // 6. Volume (P, L, T)
    let p = draft.panjang_cm ?? draft.panjang ?? draft.panjangCm ?? draft.volP;
    let l = draft.lebar_cm ?? draft.lebar ?? draft.lebarCm ?? draft.volL;
    let t = draft.tinggi_cm ?? draft.tinggi ?? draft.tinggiCm ?? draft.volT;

    if ((!p || !l || !t || Number(p) === 0) && (draft.volume || draft.dimensi)) {
      const volStr = String(draft.volume || draft.dimensi || "");
      const parts = volStr.toLowerCase().split(/x|\*/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
      if (parts.length >= 3) {
        p = p || parts[0];
        l = l || parts[1];
        t = t || parts[2];
      }
    }

    setVolP(p && !isNaN(Number(p)) && Number(p) > 0 ? String(p) : "");
    setVolL(l && !isNaN(Number(l)) && Number(l) > 0 ? String(l) : "");
    setVolT(t && !isNaN(Number(t)) && Number(t) > 0 ? String(t) : "");

    // 7. Nilai Barang
    const valBarang = [
      draft.nilai_barang,
      draft.nilaiBarang,
      draft.harga_barang,
      draft.nilai
    ].find(v => v !== undefined && v !== null && v !== "" && !isNaN(Number(v)) && Number(v) > 0);

    if (valBarang) {
      setNilaiBarangRaw(Number(valBarang).toLocaleString("id-ID"));
    } else {
      setNilaiBarangRaw("");
    }

    // 8. Media & Notes
    setFotoPaketUrl(draft.foto_paket_url || draft.foto_paket || "");
    setFotoResiUrl(draft.foto_resi_url || draft.foto_resi || "");
    setCatatanAdmin(draft.catatan_admin || draft.catatanAdmin || draft.catatan || "");

    setSubmittedTxId(null);
    setFormError(null);
  };

  // Click on a draft card to edit
  const handleSelectDraftToEdit = async (draft: any) => {
    if (!draft) return;
    const txId = draft.transaksi_id;
    setEditingTxId(txId);
    localStorage.setItem("active_draft_tx_id", txId);

    // Immediately populate from the clicked draft card object
    populateFormFromDraft(draft);

    // Fetch fresh full draft details from backend
    try {
      const res = await callBackend("getPreInput", { transaksi_id: txId });
      if (res && res.status === "success" && res.data) {
        populateFormFromDraft(res.data);
      }
    } catch (e) {
      console.error("Gagal mengambil detail draft terbaru:", e);
    }

    toast.info(`Mengedit draft: ${txId}`);
    if (namaInputRef.current) {
      namaInputRef.current.focus();
    }
  };

  // Continue Draft to Resi & Bayar page
  const handleLanjutkanDraft = (draft: any) => {
    localStorage.setItem("pending_transaksi_id", draft.transaksi_id);
    if (draft.no_resi) localStorage.setItem("pending_no_resi", draft.no_resi);
    onNavigate("transaksi");
  };

  // Cancel Draft (change status to Dibatalkan)
  const handleBatalkanDraft = async (txId: string) => {
    try {
      const res = await callBackend("updatePreInputStatus", {
        transaksi_id: txId,
        status: "Dibatalkan",
        admin_id: session.nama_lengkap || session.username || session.user_id
      });
      if (res && res.status === "success") {
        toast.success(`Draft ${txId} dibatalkan.`);
        if (editingTxId === txId) handleDraftBaru();
        fetchDrafts();
      } else {
        toast.error(res?.message || "Gagal membatalkan draft.");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal membatalkan draft.");
    }
  };

  // Change draft status directly
  const handleMoveStatus = async (txId: string, newStatus: string, noResiVal?: string) => {
    try {
      const res = await callBackend("updatePreInputStatus", {
        transaksi_id: txId,
        status: newStatus,
        no_resi: noResiVal || undefined,
        admin_id: session.nama_lengkap || session.username || session.user_id
      });
      if (res && res.status === "success") {
        toast.success(`Status ${txId} diubah ke ${newStatus}`);
        fetchDrafts();
      } else {
        toast.error(res?.message || "Gagal mengubah status.");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal mengubah status.");
    }
  };

  // Submit Resi Number from Modal popup (Input YoYi -> Siap Dibayar)
  const handleSaveResiNumber = async () => {
    if (!resiModalData || !inputResiNumber.trim()) {
      toast.error("Nomor Resi wajib diisi!");
      return;
    }
    const cleanResi = inputResiNumber.trim().toUpperCase();
    try {
      const res = await callBackend("updatePreInputStatus", {
        transaksi_id: resiModalData.transaksi_id,
        status: "Siap Dibayar",
        no_resi: cleanResi,
        admin_id: session.nama_lengkap || session.username || session.user_id
      });
      if (res && res.status === "success") {
        toast.success(`Resi ${cleanResi} berhasil disimpan! Status: SIAP DIBAYAR`);
        setResiModalData(null);
        setInputResiNumber("");
        fetchDrafts();
      } else {
        toast.error(res?.message || "Gagal menyimpan nomor resi.");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan nomor resi.");
    }
  };

  // Determine Column for Card
  const getColumnForCard = useCallback((card: any) => {
    const st = String(card.status || "").toUpperCase();
    if (st === "SELESAI") return "SELESAI";
    if (st === "SIAP DIBAYAR" || st === "SIAP_DIBAYAR" || (card.no_resi && st !== "DRAFT" && st !== "INPUT_YOYI")) {
      return "SIAP_DIBAYAR";
    }
    if (st === "INPUT_YOYI" || st === "PROSES YOYI" || st === "INPUT YOYI") {
      return "INPUT_YOYI";
    }
    return "DRAFT";
  }, []);

  // Filtered list of all active drafts based on search & filters
  const filteredDraftsAll = useMemo(() => {
    return drafts.filter((card) => {
      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = String(card.nama_pengirim || "").toLowerCase().includes(q) || String(card.nama_penerima || "").toLowerCase().includes(q);
        const matchPhone = String(card.hp_pengirim || "").toLowerCase().includes(q) || String(card.hp_penerima || "").toLowerCase().includes(q);
        const matchAddr = String(card.alamat_penerima || "").toLowerCase().includes(q) || String(card.alamat_pengirim || "").toLowerCase().includes(q);
        const matchItem = String(card.nama_barang || "").toLowerCase().includes(q);
        const matchResi = String(card.no_resi || "").toLowerCase().includes(q);
        const matchTx = String(card.transaksi_id || "").toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchAddr && !matchItem && !matchResi && !matchTx) {
          return false;
        }
      }

      // Outlet filter
      if (filterOutlet !== "ALL" && card.outlet_id_tugas !== filterOutlet) {
        return false;
      }

      // Ekspedisi filter
      if (filterEkspedisi !== "ALL") {
        const exp = (card.ekspedisi || "Express").toUpperCase();
        if (!exp.includes(filterEkspedisi.toUpperCase())) return false;
      }

      // Admin filter
      if (filterAdmin !== "ALL" && card.admin_id !== filterAdmin) {
        return false;
      }

      // Hari filter
      if (filterHari !== "ALL") {
        const cardDate = new Date(card.timestamp || card.updated_at || Date.now());
        const now = new Date();
        if (filterHari === "TODAY") {
          if (cardDate.toDateString() !== now.toDateString()) return false;
        } else if (filterHari === "WEEK") {
          const diffDays = (now.getTime() - cardDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 7) return false;
        } else if (filterHari === "MONTH") {
          if (cardDate.getMonth() !== now.getMonth() || cardDate.getFullYear() !== now.getFullYear()) return false;
        }
      }

      if (card.status === "Dibatalkan" && !searchQuery) return false;

      return true;
    });
  }, [drafts, searchQuery, filterOutlet, filterEkspedisi, filterAdmin, filterHari]);

  // Distribute into 4 Column Lists (with 30-second auto-hide for SELESAI column)
  const columnData = useMemo(() => {
    const draftList: any[] = [];
    const inputYoyiList: any[] = [];
    const siapDibayarList: any[] = [];
    const selesaiList: any[] = [];

    const now = Date.now();

    filteredDraftsAll.forEach((card) => {
      const col = getColumnForCard(card);
      if (col === "DRAFT") {
        draftList.push(card);
      } else if (col === "INPUT_YOYI") {
        inputYoyiList.push(card);
      } else if (col === "SIAP_DIBAYAR") {
        siapDibayarList.push(card);
      } else if (col === "SELESAI") {
        // Auto-hide rule: card in SELESAI column auto disappears after 30 seconds
        const completedTime = new Date(card.updated_at || card.timestamp || 0).getTime();
        if (now - completedTime < 30000) {
          selesaiList.push(card);
        }
      }
    });

    return {
      DRAFT: draftList,
      INPUT_YOYI: inputYoyiList,
      SIAP_DIBAYAR: siapDibayarList,
      SELESAI: selesaiList
    };
  }, [filteredDraftsAll, getColumnForCard]);

  // Recent 5 activities
  const recentActivities = useMemo(() => {
    const sorted = [...drafts].sort((a, b) => {
      const tA = new Date(a.updated_at || a.timestamp || 0).getTime();
      const tB = new Date(b.updated_at || b.timestamp || 0).getTime();
      return tB - tA;
    });

    return sorted.slice(0, 5).map((item) => {
      const dt = new Date(item.updated_at || item.timestamp || Date.now());
      const timeStr = dt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      const st = String(item.status || "Draft").toUpperCase();

      let statusDisplay = "DRAFT";
      if (st === "SELESAI") {
        statusDisplay = "SELESAI";
      } else if (st === "SIAP_DIBAYAR" || st === "SIAP DIBAYAR" || item.no_resi) {
        statusDisplay = "SIAP BAYAR";
      } else if (st === "INPUT_YOYI" || st === "PROSES YOYI") {
        statusDisplay = "PROSES YOYI";
      } else if (st === "DIBATALKAN") {
        statusDisplay = "BATAL";
      }

      let senderName = item.nama_pengirim ? item.nama_pengirim.toUpperCase() : "?";
      if (senderName.length > 6) senderName = senderName.substring(0, 6);

      let receiverName = item.nama_penerima ? item.nama_penerima.toUpperCase() : "?";
      if (receiverName.length > 6) receiverName = receiverName.substring(0, 6);

      const txDisplay = `${senderName} → ${receiverName}`;

      return {
        time: timeStr,
        txDisplay,
        statusDisplay
      };
    });
  }, [drafts]);

  // Product Badge Renderer
  const renderProductBadge = (ekspedisi?: string, namaBarang?: string) => {
    const expUpper = (ekspedisi || "").toUpperCase();
    const barangUpper = (namaBarang || "").toUpperCase();

    let code = "EXPRESS";
    let bgClass = "bg-red-50 text-[#E4002B] border-red-200";

    if (expUpper.includes("CARGO")) {
      code = "CARGO";
      bgClass = "bg-purple-50 text-purple-700 border-purple-200";
    } else if (expUpper.includes("DOC") || barangUpper.includes("DOKUMEN") || barangUpper.includes("DOC")) {
      code = "DOC";
      bgClass = "bg-teal-50 text-teal-700 border-teal-200";
    } else if (expUpper.includes("EZ")) {
      code = "EZ";
      bgClass = "bg-blue-50 text-blue-700 border-blue-200";
    } else if (expUpper.includes("HBO")) {
      code = "HBO";
      bgClass = "bg-orange-50 text-orange-700 border-orange-200";
    } else if (expUpper.includes("VIP")) {
      code = "VIP";
      bgClass = "bg-yellow-50 text-yellow-800 border-yellow-200";
    } else if (expUpper.includes("APP")) {
      code = "APP";
      bgClass = "bg-pink-50 text-pink-700 border-pink-200";
    }

    return (
      <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-md border font-mono tracking-wide ${bgClass}`}>
        {code}
      </span>
    );
  };

  // Priority Badges Renderer
  const renderPriorityBadges = (card: any) => {
    const nilai = Number(card.nilai_barang || 0);
    const berat = Number(card.berat_kg || card.berat_timbangan || 0);

    const badges = [];

    if (nilai > 5000000) {
      badges.push(
        <span key="hv" className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-amber-500 text-white shadow-2xs tracking-wider animate-pulse">
          💎 HIGH VALUE
        </span>
      );
    }

    if (berat > 20) {
      badges.push(
        <span key="heavy" className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-slate-800 text-white shadow-2xs tracking-wider">
          ⚖️ HEAVY ({berat}kg)
        </span>
      );
    }

    if (badges.length === 0) return null;

    return (
      <div className="flex flex-wrap items-center gap-1 pt-1">
        {badges}
      </div>
    );
  };

  // Manual Save Handler
  const handleSavePreInput = async (isDraftManual = false) => {
    setFormError(null);

    if (!String(namaPengirim || "").trim()) {
      setFormError("Nama pengirim wajib diisi!");
      return;
    }
    if (!String(hpPengirim || "").trim()) {
      setFormError("Nomor HP pengirim wajib diisi!");
      return;
    }
    if (!String(alamatPengirim || "").trim()) {
      setFormError("Alamat pengirim wajib diisi!");
      return;
    }
    if (!String(namaPenerima || "").trim()) {
      setFormError("Nama penerima wajib diisi!");
      return;
    }
    if (!String(hpPenerima || "").trim()) {
      setFormError("Nomor HP penerima wajib diisi!");
      return;
    }
    if (!String(alamatPenerima || "").trim()) {
      setFormError("Alamat penerima wajib diisi!");
      return;
    }
    if (!String(namaBarang || "").trim()) {
      setFormError("Nama barang paket wajib diisi!");
      return;
    }

    try {
      const calc = calcWeight();
      const payload = {
        transaksi_id: editingTxId,
        is_draft: isDraftManual,
        status: isDraftManual ? "Draft" : "Siap Dibayar",
        admin_id: session.user_id,
        admin_name: session.nama_lengkap || session.username || session.user_id,
        outlet_id_tugas: activeOutletId,
        nama_pengirim: String(namaPengirim || "").trim(),
        hp_pengirim: String(hpPengirim || "").trim(),
        alamat_pengirim: String(alamatPengirim || "").trim(),
        nama_penerima: String(namaPenerima || "").trim(),
        hp_penerima: String(hpPenerima || "").trim(),
        alamat_penerima: String(alamatPenerima || "").trim(),
        alamat_penerima_asli: alamatPenerimaAsli || String(alamatPenerima || "").trim(),
        catatan_admin: String(catatanAdmin || "").trim(),
        nama_barang: String(namaBarang || "").trim(),
        ekspedisi,
        berat_timbangan: Number(beratKg) || 0,
        panjang_cm: Number(volP) || 0,
        lebar_cm: Number(volL) || 0,
        tinggi_cm: Number(volT) || 0,
        berat_volume: calc.berat_volume,
        dasar_berat: calc.dasar_berat,
        berat_kg: calc.berat_penagihan,
        volume: `${volP || 0} x ${volL || 0} x ${volT || 0}`,
        nilai_barang: getCleanNumberValue(nilaiBarangRaw || ""),
        foto_paket_url: fotoPaketUrl || "",
        foto_resi_url: fotoResiUrl || ""
      };

      const response = await callBackend("saveDataPreInput", payload);

      if (response && response.status === "success" && response.data) {
        const txId = response.data.transaksi_id;
        setSubmittedTxId(txId);
        setEditingTxId(null);
        localStorage.removeItem("active_draft_tx_id");

        // Format Clearing Box Text
        const outletObj = outlets.find(o => o.outlet_id === activeOutletId);
        const textSummary = 
`========================================
    J&T EXPRESS — PRE-INPUT RINGKASAN
========================================
[KODE PRE-INPUT] : ${txId}
[LOKASI TUGAS]  : ${outletObj?.nama_outlet || activeOutletId}
[TANGGAL]       : ${new Date().toLocaleString("id-ID")}
----------------------------------------
PENGIRIM:
Nama    : ${namaPengirim}
No. HP  : ${hpPengirim}
Alamat  : ${alamatPengirim}

PENERIMA:
Nama    : ${namaPenerima}
No. HP  : ${hpPenerima}
Alamat  : ${alamatPenerima}
----------------------------------------
INFORMASI PAKET:
Layanan : ${ekspedisi}
Barang  : ${namaBarang}
Berat   : ${calc.berat_penagihan} kg (${calc.dasar_berat})
Nilai   : Rp ${getCleanNumberValue(nilaiBarangRaw || "").toLocaleString("id-ID")}
Catatan : ${catatanAdmin || "-"}
========================================`;

        setClearingText(textSummary);
        toast.success(`Pre-Input ${txId} berhasil disimpan!`);
        fetchDrafts();
      } else {
        setFormError(response?.message || "Gagal menyimpan data pre-input.");
        toast.error(response?.message || "Gagal menyimpan data pre-input.");
      }
    } catch (err: any) {
      setFormError(err.message || "Terjadi kesalahan jaringan.");
      toast.error(err.message || "Terjadi kesalahan jaringan.");
    }
  };

  // Format Currency
  const formatRupiahDisplay = (valStr: string) => {
    const cleaned = (valStr || "").replace(/\D/g, "");
    if (!cleaned) return "";
    return Number(cleaned).toLocaleString("id-ID");
  };

  const handleNilaiBarangChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNilaiBarangRaw(formatRupiahDisplay(e.target.value));
  };

  // Select Customer from suggestion
  const selectCustomer = (cst: any) => {
    if (!cst) return;
    setNamaPengirim(cst.nama_pengirim || cst.nama || "");
    setHpPengirim(cst.no_hp || cst.hp_pengirim || cst.telepon || "");
    setAlamatPengirim(cst.alamat_pengirim || cst.alamat || "");
    setSelectedCustomerId(cst.customer_id || null);
    setShowSuggestions(false);
  };

  const handlePenerimaChange = (val: string, type: "nama" | "hp" | "alamat") => {
    if (type === "nama") setNamaPenerima(val);
    if (type === "hp") setHpPenerima(val);
    if (type === "alamat") setAlamatPenerima(val);

    if (type === "nama" || type === "hp") {
      if (val.length >= 3) {
        setSearchingPenerima(true);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(async () => {
          try {
            const res = await callBackend("getBukuPenerima", { search: val });
            if (res && res.status === "success" && Array.isArray(res.data)) {
              setPenerimaSuggestions(res.data.slice(0, 10));
              setShowPenerimaSuggestions(true);
            }
          } finally {
            setSearchingPenerima(false);
          }
        }, 500);
      } else {
        setShowPenerimaSuggestions(false);
        setPenerimaSuggestions([]);
      }
    }
  };

  const handleSelectPenerima = (penerima: any) => {
    setNamaPenerima(penerima.nama || penerima.nama_penerima || "");
    setHpPenerima(penerima.telepon || penerima.no_hp || penerima.no_hp_penerima || "");
    setAlamatPenerima(penerima.alamat || penerima.alamat_penerima || "");
    setShowPenerimaSuggestions(false);
    
    // Focus next input or just unfocus
    setTimeout(() => {
      document.getElementById("input-nama-barang")?.focus();
    }, 100);
  };

  const handleSenderChange = (val: string, type: "nama" | "hp" | "alamat") => {
    const safeVal = val || "";
    if (type === "nama") {
      setNamaPengirim(safeVal);
      setSelectedCustomerId(null);
    } else if (type === "hp") {
      setHpPengirim(safeVal.replace(/\D/g, ""));
      setSelectedCustomerId(null);
    } else if (type === "alamat") {
      setAlamatPengirim(safeVal);
    }
  };

  // Auto fill Recipient from history click
  const selectRecipientFromHistory = (rec: any) => {
    if (!rec) return;
    setNamaPenerima(rec.nama_penerima || rec.nama || "");
    setHpPenerima(rec.no_hp_penerima || rec.no_hp || rec.telepon || "");
    setAlamatPenerima(rec.alamat_penerima || rec.alamat || "");
  };

  // AI Address Optimizer
  const handleOptimizeAddress = async () => {
    if (!(alamatPenerima || "").trim()) {
      setAiNotice({ type: "error", text: "Alamat penerima kosong! Ketik alamat terlebih dahulu." });
      return;
    }

    setOptimizingAddress(true);
    setAiNotice(null);
    setSuggestedAddress(null);
    try {
      const response = await callBackend("perbaikiAlamatAI", { alamat: alamatPenerima });
      if (response && response.status === "success" && response.data) {
        setSuggestedAddress(response.data);
        setAiNotice({ type: "success", text: "Hasil perbaikan alamat oleh AI sudah siap! Tinjau di bawah." });
      } else {
        setAiNotice({ type: "error", text: response?.message || "Gagal merapikan alamat." });
      }
    } catch (err: any) {
      setAiNotice({
        type: "error",
        text: err.message || "Terjadi kendala AI, silakan coba lagi atau isi manual."
      });
    } finally {
      setOptimizingAddress(false);
    }
  };

  const handleApplyAiAddress = () => {
    if (suggestedAddress) {
      setAlamatPenerimaAsli(alamatPenerima);
      setAlamatPenerima(suggestedAddress);
      setSuggestedAddress(null);
      setAiNotice({ type: "success", text: "Berhasil menggunakan alamat versi AI!" });
    }
  };

  // Upload Photo Handlers

  const handlePasteImage = async (e: React.ClipboardEvent, type: "paket") => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setUploadingFotoPaket(true);
          setFormError(null);
          try {
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64Str = reader.result as string;
              try {
                const response = await callBackend("uploadFile", {
                  fileBase64: base64Str,
                  fileName: file.name || "pasted-image.png",
                  category: "FOTO_PAKET"
                });
                const remoteUrl = (response && response.status === "success" && response.data) ? response.data : base64Str;
                setValidationPopupData({
                  type: "paket",
                  previewUrl: base64Str,
                  remoteUrl: remoteUrl,
                  detectedResiId: null
                });
                setShowValidationPopup(true);
              } catch (err: any) {
                setValidationPopupData({
                  type: "paket",
                  previewUrl: base64Str,
                  remoteUrl: base64Str,
                  detectedResiId: null
                });
                setShowValidationPopup(true);
              } finally {
                setUploadingFotoPaket(false);
              }
            };
            reader.readAsDataURL(file);
          } catch (err: any) {
            setUploadingFotoPaket(false);
            setFormError(err.message || "Gagal memproses gambar dari clipboard");
          }
        }
        break;
      }
    }
  };

  const handlePaketFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFotoPaket(true);
    setFormError(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Str = reader.result as string;
        try {
          const response = await callBackend("uploadFile", {
            fileBase64: base64Str,
            fileName: file.name,
            category: "FOTO_PAKET"
          });

          const remoteUrl = (response && response.status === "success" && response.data) ? response.data : base64Str;

          setValidationPopupData({
            type: "paket",
            previewUrl: base64Str, // Use base64Str so photo always displays clearly in modal preview
            remoteUrl: remoteUrl,
            detectedResiId: null
          });
          setShowValidationPopup(true);
        } catch (err: any) {
          // Fallback to base64Str even if backend response failed
          setValidationPopupData({
            type: "paket",
            previewUrl: base64Str,
            remoteUrl: base64Str,
            detectedResiId: null
          });
          setShowValidationPopup(true);
        } finally {
          setUploadingFotoPaket(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadingFotoPaket(false);
      setFormError("Gagal membaca berkas gambar.");
    }
  };

  const handleClearingBoxClick = () => {
    if (clearingTextRef.current) {
      clearingTextRef.current.select();
      navigator.clipboard.writeText(clearingText);
      setCopiedNotification(true);
      toast.success("Ringkasan Pre-Input berhasil disalin ke clipboard!");
      setTimeout(() => setCopiedNotification(false), 3000);
    }
  };

  const handleCopyValue = (val: string, key: string, label: string) => {
    if (!val || val.trim() === "") {
      toast.info(`Kolom ${label} kosong.`);
      return;
    }
    navigator.clipboard.writeText(val);
    setCopiedFieldKey(key);
    toast.success(`"${label}" (${val}) berhasil disalin!`);
    setTimeout(() => setCopiedFieldKey(null), 2000);
  };

  // Filtered Drafts for Workspace Area
  const filteredDrafts = useMemo(() => {
    return drafts.filter((d) => {
      // Exclude completed or canceled unless all explicitly selected
      if (filterStatus !== "Semua") {
        if (filterStatus === "Draft" && d.status !== "Draft" && d.status !== "PENDING") return false;
        if (filterStatus === "Siap Dibayar" && d.status !== "Siap Dibayar" && d.status !== "SIAP_DIBAYAR") return false;
        if (filterStatus === "Diproses" && d.status !== "Diproses" && d.status !== "DIPROSES") return false;
      }

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const nameMatch = String(d.nama_pengirim || "").toLowerCase().includes(q) || String(d.nama_penerima || "").toLowerCase().includes(q);
      const phoneMatch = String(d.hp_pengirim || "").includes(q) || String(d.hp_penerima || "").includes(q);
      const itemMatch = String(d.nama_barang || "").toLowerCase().includes(q);
      const addrMatch = String(d.alamat_pengirim || "").toLowerCase().includes(q) || String(d.alamat_penerima || "").toLowerCase().includes(q);
      const txMatch = String(d.transaksi_id || "").toLowerCase().includes(q);

      return nameMatch || phoneMatch || itemMatch || addrMatch || txMatch;
    });
  }, [drafts, searchQuery, filterStatus]);

  // Helper badge color renderer
  const renderStatusBadge = (statusStr: string) => {
    const s = (statusStr || "Draft").toUpperCase();
    if (s === "SELESAI") {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">Selesai</span>;
    }
    if (s === "DIBATALKAN" || s === "BATAL") {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-800 border border-red-200">Dibatalkan</span>;
    }
    if (s === "SIAP DIBAYAR" || s === "SIAP_DIBAYAR") {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">Siap Dibayar</span>;
    }
    if (s === "DIPROSES") {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-800 border border-purple-200">Diproses</span>;
    }
    if (s === "MENUNGGU RESI") {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">Menunggu Resi</span>;
    }
    return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">Draft</span>;
  };

  return (
    <div className="w-full max-w-[1800px] mx-auto px-3 sm:px-6 py-6 space-y-6">
      
      {/* HEADER SECTION & SHORTCUT TOOLBAR */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-red-50 text-[#E4002B] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest font-mono">
                OPERASIONAL WORKSPACE
              </span>
              {editingTxId && (
                <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2.5 py-1 rounded-full font-mono border border-blue-100">
                  EDITING: {editingTxId}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-800 font-sans mt-2">
              Pre-Input & Workspace Operasional
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Papan kerja utama admin untuk input, pantau, dan teruskan transaksi aktif.
            </p>
          </div>

          {/* ACTIONS & OUTLET SELECTOR */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Action: Draft Baru Button */}
            <button
              onClick={handleDraftBaru}
              type="button"
              className="py-2 px-3.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition duration-150 shadow-sm cursor-pointer"
            >
              <PlusCircle size={15} className="text-red-400" />
              <span>Draft Baru</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] bg-gray-700 text-gray-200 rounded font-mono">Ctrl+N</kbd>
            </button>

            {/* Lokasi Tugas Outlet Override */}
            <div className="bg-gray-50 p-2 px-3 rounded-xl border border-gray-100 flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono shrink-0">
                Outlet:
              </span>
              <select
                value={activeOutletId}
                onChange={(e) => onChangeActiveOutlet(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg text-xs py-1 px-2 font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
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

        {/* KEYBOARD SHORTCUTS HINT BAR */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between text-[11px] text-gray-500 gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[9px] bg-gray-100 border border-gray-200 rounded font-mono text-gray-700 font-bold">Ctrl + N</kbd>
              <span>Draft Baru</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[9px] bg-gray-100 border border-gray-200 rounded font-mono text-gray-700 font-bold">Ctrl + S</kbd>
              <span>Simpan Pre-Input</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[9px] bg-gray-100 border border-gray-200 rounded font-mono text-gray-700 font-bold">Esc</kbd>
              <span>Batalkan Edit</span>
            </span>
          </div>

          {autoSaveStatus && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{autoSaveStatus}</span>
            </div>
          )}
        </div>
      </div>

      {formError && (
        <div className="p-4 bg-red-50 border-l-4 border-[#E4002B] rounded-r-xl flex items-start gap-2 text-red-800 text-sm animate-bounce">
          <AlertCircle className="h-5 w-5 shrink-0 text-[#E4002B] mt-0.5" />
          <div>
            <p className="font-semibold">Mohon Lengkapi Form</p>
            <p className="text-xs opacity-90 mt-0.5">{formError}</p>
          </div>
        </div>
      )}

      {/* RENDER CLEARING LAYAR / KOTAK KLIRING (IF SUCCESSFUL) */}
      {submittedTxId ? (
        <div className="bg-white rounded-2xl shadow-lg border border-green-100 p-6 sm:p-8 animate-fade-in max-w-4xl mx-auto space-y-6">
          <div className="text-center">
            <div className="mx-auto bg-green-50 text-green-600 rounded-full h-16 w-16 flex items-center justify-center mb-4 shadow-sm">
              <CheckCircle2 className="h-10 w-10 stroke-[2]" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">
              Pre-Input Berhasil Disimpan!
            </h2>
            <p className="text-xs text-green-600 font-mono font-bold mt-1">
              KODE PRE-INPUT: {submittedTxId}
            </p>
            <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1.5">
              Klik tombol <strong className="text-slate-700">Salin</strong> pada setiap kolom di bawah untuk dimasukkan ke sistem <strong className="text-[#00A968]">YoYi!</strong>
            </p>
          </div>

          {/* YOYI FIELDS QUICK-COPY GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            {/* INFORMASI PENGIRIM */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
                <User className="h-4 w-4 text-[#E4002B]" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Informasi Pengirim</h3>
              </div>

              <div className="space-y-2">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-medium text-slate-400">Nama</span>
                    <span className="block text-xs font-semibold text-slate-800 truncate">{namaPengirim || "-"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyValue(namaPengirim, "pengirim_nama", "Nama Pengirim")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition cursor-pointer border ${
                      copiedFieldKey === "pengirim_nama"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {copiedFieldKey === "pengirim_nama" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Clipboard className="h-3.5 w-3.5 text-slate-500" />}
                    <span>{copiedFieldKey === "pengirim_nama" ? "Disalin" : "Salin"}</span>
                  </button>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-medium text-slate-400">Telepon</span>
                    <span className="block text-xs font-semibold text-slate-800 truncate">{hpPengirim || "-"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyValue(hpPengirim, "pengirim_hp", "Telepon Pengirim")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition cursor-pointer border ${
                      copiedFieldKey === "pengirim_hp"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {copiedFieldKey === "pengirim_hp" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Clipboard className="h-3.5 w-3.5 text-slate-500" />}
                    <span>{copiedFieldKey === "pengirim_hp" ? "Disalin" : "Salin"}</span>
                  </button>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-start justify-between gap-2 shadow-2xs">
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-medium text-slate-400">Detail Alamat</span>
                    <span className="block text-xs font-semibold text-slate-800 line-clamp-2">{alamatPengirim || "-"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyValue(alamatPengirim, "pengirim_alamat", "Alamat Pengirim")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition cursor-pointer border ${
                      copiedFieldKey === "pengirim_alamat"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {copiedFieldKey === "pengirim_alamat" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Clipboard className="h-3.5 w-3.5 text-slate-500" />}
                    <span>{copiedFieldKey === "pengirim_alamat" ? "Disalin" : "Salin"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* INFORMASI PENERIMA */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
                <MapPin className="h-4 w-4 text-[#E4002B]" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Informasi Penerima</h3>
              </div>

              <div className="space-y-2">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-medium text-slate-400">Nama</span>
                    <span className="block text-xs font-semibold text-slate-800 truncate">{namaPenerima || "-"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyValue(namaPenerima, "penerima_nama", "Nama Penerima")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition cursor-pointer border ${
                      copiedFieldKey === "penerima_nama"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {copiedFieldKey === "penerima_nama" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Clipboard className="h-3.5 w-3.5 text-slate-500" />}
                    <span>{copiedFieldKey === "penerima_nama" ? "Disalin" : "Salin"}</span>
                  </button>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-medium text-slate-400">Telepon</span>
                    <span className="block text-xs font-semibold text-slate-800 truncate">{hpPenerima || "-"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyValue(hpPenerima, "penerima_hp", "Telepon Penerima")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition cursor-pointer border ${
                      copiedFieldKey === "penerima_hp"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {copiedFieldKey === "penerima_hp" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Clipboard className="h-3.5 w-3.5 text-slate-500" />}
                    <span>{copiedFieldKey === "penerima_hp" ? "Disalin" : "Salin"}</span>
                  </button>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-start justify-between gap-2 shadow-2xs">
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-medium text-slate-400">Detail Alamat</span>
                    <span className="block text-xs font-semibold text-slate-800 line-clamp-2">{alamatPenerima || "-"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyValue(alamatPenerima, "penerima_alamat", "Alamat Penerima")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition cursor-pointer border ${
                      copiedFieldKey === "penerima_alamat"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {copiedFieldKey === "penerima_alamat" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Clipboard className="h-3.5 w-3.5 text-slate-500" />}
                    <span>{copiedFieldKey === "penerima_alamat" ? "Disalin" : "Salin"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* INFORMASI BARANG */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
                <Layers className="h-4 w-4 text-[#E4002B]" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Informasi Barang</h3>
              </div>

              <div className="space-y-2">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-medium text-slate-400">Nama Barang</span>
                    <span className="block text-xs font-semibold text-slate-800 truncate">{namaBarang || "-"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyValue(namaBarang, "barang_nama", "Nama Barang")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition cursor-pointer border ${
                      copiedFieldKey === "barang_nama"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {copiedFieldKey === "barang_nama" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Clipboard className="h-3.5 w-3.5 text-slate-500" />}
                    <span>{copiedFieldKey === "barang_nama" ? "Disalin" : "Salin"}</span>
                  </button>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-medium text-slate-400">Berat Paket (KG)</span>
                    <span className="block text-xs font-semibold text-slate-800 truncate">{calcWeight().berat_penagihan} KG</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyValue(calcWeight().berat_penagihan.toString(), "barang_berat", "Berat Paket")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition cursor-pointer border ${
                      copiedFieldKey === "barang_berat"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {copiedFieldKey === "barang_berat" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Clipboard className="h-3.5 w-3.5 text-slate-500" />}
                    <span>{copiedFieldKey === "barang_berat" ? "Disalin" : "Salin"}</span>
                  </button>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-medium text-slate-400">Nilai Barang (IDR)</span>
                    <span className="block text-xs font-semibold text-slate-800 truncate">
                      {nilaiBarangRaw ? `Rp ${formatRupiahDisplay(nilaiBarangRaw)}` : "-"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyValue(getCleanNumberValue(nilaiBarangRaw || "").toString(), "barang_nilai", "Nilai Barang")}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition cursor-pointer border ${
                      copiedFieldKey === "barang_nilai"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {copiedFieldKey === "barang_nilai" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Clipboard className="h-3.5 w-3.5 text-slate-500" />}
                    <span>{copiedFieldKey === "barang_nilai" ? "Disalin" : "Salin"}</span>
                  </button>
                </div>

                {catatanAdmin && (
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs">
                    <div className="min-w-0 flex-1">
                      <span className="block text-[10px] font-medium text-slate-400">Catatan</span>
                      <span className="block text-xs font-semibold text-slate-800 truncate">{catatanAdmin}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyValue(catatanAdmin, "barang_catatan", "Catatan")}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition cursor-pointer border ${
                        copiedFieldKey === "barang_catatan"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {copiedFieldKey === "barang_catatan" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Clipboard className="h-3.5 w-3.5 text-slate-500" />}
                      <span>{copiedFieldKey === "barang_catatan" ? "Disalin" : "Salin"}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* KOTAK KLIRING TEKS LENGKAP */}
          <div className="pt-2 border-t border-slate-100">
            <details className="group">
              <summary className="text-xs font-semibold text-slate-500 cursor-pointer flex items-center justify-center gap-2 py-2 select-none hover:text-slate-800 transition">
                <span>Lihat Teks Ringkasan Pre-Input Lengkap (Kotak Kliring)</span>
                <span className="text-[10px] font-bold text-slate-400 group-open:rotate-180 transition-transform duration-200">▼</span>
              </summary>
              <div className="mt-3 relative max-w-lg mx-auto">
                <textarea
                  ref={clearingTextRef}
                  readOnly
                  onClick={handleClearingBoxClick}
                  value={clearingText}
                  className="w-full h-40 bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl p-4 font-mono text-xs text-gray-700 leading-relaxed cursor-pointer focus:outline-none resize-none shadow-inner transition-colors duration-200"
                />
                <div className="absolute bottom-3 right-3 bg-gray-900/80 text-white rounded-lg py-1 px-2.5 flex items-center gap-1.5 text-[10px] pointer-events-none">
                  <Clipboard className="h-3.5 w-3.5" />
                  <span>{copiedNotification ? "Tersalin!" : "Klik untuk Salin Seluruh Ringkasan"}</span>
                </div>
              </div>
            </details>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row justify-center gap-4 max-w-lg mx-auto">
            <button
              onClick={handleDraftBaru}
              className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 font-semibold text-gray-700 rounded-xl transition duration-150 text-sm cursor-pointer"
            >
              Input Pelanggan Baru
            </button>
            <button
              onClick={() => {
                if (submittedTxId) {
                  localStorage.setItem("pending_transaksi_id", submittedTxId);
                  onNavigate("transaksi");
                }
              }}
              className="flex-1 py-3 px-4 bg-[#E4002B] hover:bg-[#c20023] font-semibold text-white rounded-xl shadow-md flex items-center justify-center gap-2 transition duration-150 text-sm cursor-pointer"
            >
              <span>Lanjut Input Resi & Finansial</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        /* MAIN WORKSPACE 2-AREA LAYOUT */
        <div className="grid grid-cols-1 md:grid-cols-12 lg:grid-cols-12 gap-6 items-start">
          
          {/* AREA KIRI: FORM PRE-INPUT (DIPERBESAR: 58% Desktop / 7 Kolom) */}
          <div className="md:col-span-7 lg:col-span-7 xl:col-span-7 2xl:col-span-7 space-y-6">

            {/* DUPLICATE CUSTOMER ALERT BANNER */}
            {duplicateAlert && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm space-y-3 animate-in fade-in duration-200">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 rounded-xl text-amber-800 shrink-0 mt-0.5">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-amber-900 text-sm">
                      Ditemukan Draft Aktif untuk Customer Ini!
                    </p>
                    <p className="text-amber-800">
                      Customer <span className="font-bold">{duplicateAlert.nama_pengirim}</span> ({duplicateAlert.hp_pengirim}) sudah memiliki draft aktif:
                      <code className="ml-1 px-1 bg-amber-100 rounded font-mono font-bold text-amber-900">{duplicateAlert.transaksi_id}</code>.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/60">
                  <button
                    type="button"
                    onClick={() => handleSelectDraftToEdit(duplicateAlert)}
                    className="py-1.5 px-3 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Lanjutkan Draft Lama
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicateAlert(null)}
                    className="py-1.5 px-3 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Buat Draft Baru
                  </button>
                </div>
              </div>
            )}

            {/* FORM CARD CONTAINER */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6 space-y-6">

              {/* DATA PENGIRIM */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-red-50 p-1.5 rounded-lg text-[#E4002B]">
                      <User className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold text-gray-800 text-sm">Data Pengirim</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBukuPengirimOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 text-[#E4002B] hover:bg-red-100 transition-colors text-xs font-bold cursor-pointer"
                  >
                    <BookOpen size={13} />
                    <span>Buku Pengirim</span>
                  </button>
                </div>

                {/* Nama Pengirim + Recent Customer Pills */}
                <div className="relative" ref={suggestionContainerRef}>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Nama Pengirim <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      ref={namaInputRef}
                      type="text"
                      value={namaPengirim}
                      onChange={(e) => handleSenderChange(e.target.value.toUpperCase(), "nama")}
                      className="w-full pl-3 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B] focus:border-[#E4002B]"
                      placeholder="Silahkan masukan nama"
                    />
                    {searchingCustomer && (
                      <div className="absolute right-3 inset-y-0 flex items-center">
                        <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Suggestions Dropdown */}
                  {showSuggestions && customerSuggestions.length > 0 && (
                    <div className="absolute z-20 w-full bg-white border border-gray-200 mt-1 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-50">
                      <div className="p-2 bg-gray-50 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        Pelanggan Tetap Terdaftar:
                      </div>
                      {customerSuggestions.map((cst) => {
                        const name = cst.nama || cst.nama_pengirim || "Pelanggan";
                        const phone = cst.telepon || cst.no_hp || cst.hp_pengirim || "";
                        const addr = cst.alamat_pengirim || cst.alamat || "";
                        return (
                          <button
                            key={cst.customer_id}
                            type="button"
                            onClick={() => selectCustomer(cst)}
                            className="w-full text-left p-3 hover:bg-gray-50 text-xs transition-colors flex flex-col gap-0.5 cursor-pointer"
                          >
                            <span className="font-bold text-gray-800">{name}</span>
                            <span className="text-gray-500">{phone}{addr ? ` • ${addr.slice(0, 45)}...` : ""}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* RECENT CUSTOMERS (MAX 5 PILLS) */}
                  {recentCustomers.length > 0 && !namaPengirim && (
                    <div className="mt-2 space-y-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Pelanggan Terakhir:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {recentCustomers.map((cst) => {
                          const name = cst.nama || cst.nama_pengirim || "Pelanggan";
                          const phone = cst.telepon || cst.no_hp || cst.hp_pengirim || "";
                          return (
                            <button
                              key={cst.customer_id}
                              type="button"
                              onClick={() => selectCustomer(cst)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-red-50 hover:text-[#E4002B] text-gray-700 rounded-lg text-[11px] font-medium transition cursor-pointer"
                            >
                              + {name} {phone ? `(${phone})` : ""}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* HP Pengirim */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Nomor HP Pengirim <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 inset-y-0 flex items-center text-gray-400 text-xs font-mono">
                      +62
                    </div>
                    <input
                      type="tel"
                      value={hpPengirim}
                      onChange={(e) => handleSenderChange(e.target.value, "hp")}
                      className="w-full pl-12 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B] focus:border-[#E4002B]"
                      placeholder="812xxxxxxxx"
                    />
                  </div>
                </div>

                {/* Alamat Pengirim */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Alamat Lengkap Pengirim <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={alamatPengirim}
                    onChange={(e) => handleSenderChange(e.target.value.toUpperCase(), "alamat")}
                    rows={2}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B] focus:border-[#E4002B] resize-none"
                    placeholder="Nama jalan, nomor rumah, RT/RW, kelurahan, kecamatan, kab/kota, provinsi."
                  />

                  {/* RECENT ADDRESSES (MAX 5 PILLS) */}
                  {recentAddresses.length > 0 && !alamatPengirim && (
                    <div className="mt-2 space-y-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Alamat Terakhir:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {recentAddresses.map((addr, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setAlamatPengirim(addr)}
                            className="px-2.5 py-1 bg-gray-100 hover:bg-red-50 hover:text-[#E4002B] text-gray-700 rounded-lg text-[10px] font-medium transition max-w-xs truncate cursor-pointer"
                          >
                            📍 {addr}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* DATA PENERIMA */}
              <div className="space-y-4 border-t border-gray-100 pt-5">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-red-50 p-1.5 rounded-lg text-[#E4002B]">
                      <User className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold text-gray-800 text-sm">Data Penerima</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBukuPenerimaOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 text-[#E4002B] hover:bg-red-100 transition-colors text-xs font-bold cursor-pointer"
                  >
                    <BookOpen size={13} />
                    <span>Buku Penerima</span>
                  </button>
                </div>

                {/* Nama Penerima + Suggestions */}
                <div className="relative" ref={penerimaSuggestionContainerRef}>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Nama Penerima <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      ref={namaPenerimaInputRef}
                      type="text"
                      value={namaPenerima}
                      onChange={(e) => handlePenerimaChange(e.target.value.toUpperCase(), "nama")}
                      className="w-full pl-3 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B] focus:border-[#E4002B]"
                      placeholder="Silahkan masukan nama"
                    />
                    {searchingPenerima && (
                      <div className="absolute right-3 inset-y-0 flex items-center">
                        <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />
                      </div>
                    )}
                  </div>
                  {showPenerimaSuggestions && penerimaSuggestions.length > 0 && (
                    <div className="absolute z-20 w-full bg-white border border-gray-200 mt-1 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-50">
                      {penerimaSuggestions.map((pen, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSelectPenerima(pen)}
                          className="px-3 py-2 hover:bg-red-50 cursor-pointer transition-colors"
                        >
                          <div className="font-bold text-gray-800 text-[13px]">{pen.nama || pen.nama_penerima}</div>
                          <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[#E4002B]">{pen.telepon || pen.no_hp || pen.no_hp_penerima}</span>
                            <span className="truncate flex-1">{pen.alamat || pen.alamat_penerima}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* HP Penerima */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Nomor HP Penerima <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 inset-y-0 flex items-center text-gray-400 text-xs font-mono">
                      +62
                    </div>
                    <input
                      type="tel"
                      value={hpPenerima}
                      onChange={(e) => setHpPenerima(e.target.value.replace(/\D/g, ""))}
                      className="w-full pl-12 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B] focus:border-[#E4002B]"
                      placeholder="813xxxxxxxx"
                    />
                  </div>
                </div>

                {/* Alamat Penerima & AI Button */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Alamat Lengkap Penerima <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleOptimizeAddress}
                      disabled={optimizingAddress}
                      className="flex items-center gap-1 text-[11px] font-bold text-[#E4002B] bg-red-50 hover:bg-red-100 py-1 px-2.5 rounded-lg transition cursor-pointer disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      {optimizingAddress ? (
                        <>
                          <RefreshCw className="h-3 w-3 animate-spin" />
                          <span>Merapikan...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3 text-amber-500 fill-amber-500" />
                          <span>AI Pakar Alamat</span>
                        </>
                      )}
                    </button>
                  </div>

                  <textarea
                    value={alamatPenerima}
                    onChange={(e) => setAlamatPenerima(e.target.value.toUpperCase())}
                    rows={2}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B] focus:border-[#E4002B] resize-none"
                    placeholder="Alamat penerima..."
                  />

                  {suggestedAddress && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-900 flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5 fill-amber-500 text-amber-600" />
                          Rekomendasi AI
                        </span>
                        <button
                          type="button"
                          onClick={handleApplyAiAddress}
                          className="px-2.5 py-1 bg-[#E4002B] hover:bg-[#c20023] text-white font-bold rounded-lg text-[11px] cursor-pointer"
                        >
                          Gunakan
                        </button>
                      </div>
                      <p className="font-mono text-gray-700 bg-white p-2 rounded border border-amber-100">
                        {suggestedAddress}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* DATA PAKET */}
              <div className="space-y-4 border-t border-gray-100 pt-5">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <div className="bg-red-50 p-1.5 rounded-lg text-[#E4002B]">
                    <Clipboard className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold text-gray-800 text-sm">Data Paket</h3>
                </div>

                {/* Jenis Ekspedisi */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Jenis Ekspedisi <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="ekspedisi_preinput"
                        value="Express"
                        checked={ekspedisi === "Express"}
                        onChange={() => setEkspedisi("Express")}
                        className="accent-[#E4002B]"
                      />
                      <span className="text-sm font-medium text-gray-800">Express</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="ekspedisi_preinput"
                        value="Cargo"
                        checked={ekspedisi === "Cargo"}
                        onChange={() => setEkspedisi("Cargo")}
                        className="accent-[#E4002B]"
                      />
                      <span className="text-sm font-medium text-gray-800">Cargo</span>
                    </label>
                  </div>
                </div>

                {/* Nama Barang */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Nama Barang Paket <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={namaBarang}
                    onChange={(e) => setNamaBarang(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B] focus:border-[#E4002B]"
                    placeholder="Contoh: Laptop Asus, Pakaian, Makanan"
                  />
                </div>

                {/* Berat & Volume Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Berat Timbangan (KG)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={beratKg}
                        onChange={(e) => setBeratKg(e.target.value)}
                        className="w-full pl-3 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
                      />
                      <div className="absolute right-3 inset-y-0 flex items-center text-xs text-gray-400 font-bold">
                        KG
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 truncate" title="Volume (P x L x T cm)">
                      Volume (P x L x T cm)
                    </label>
                    <div className="flex items-center gap-1 w-full">
                      <input
                        type="number"
                        min="0"
                        value={volP}
                        onChange={(e) => setVolP(e.target.value)}
                        className="flex-1 min-w-0 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-center focus:ring-1 focus:ring-[#E4002B]"
                        placeholder="P"
                      />
                      <span className="text-gray-400 text-xs shrink-0">x</span>
                      <input
                        type="number"
                        min="0"
                        value={volL}
                        onChange={(e) => setVolL(e.target.value)}
                        className="flex-1 min-w-0 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-center focus:ring-1 focus:ring-[#E4002B]"
                        placeholder="L"
                      />
                      <span className="text-gray-400 text-xs shrink-0">x</span>
                      <input
                        type="number"
                        min="0"
                        value={volT}
                        onChange={(e) => setVolT(e.target.value)}
                        className="flex-1 min-w-0 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-center focus:ring-1 focus:ring-[#E4002B]"
                        placeholder="T"
                      />
                    </div>
                  </div>
                </div>

                {/* Calculated Results */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="block text-[10px] font-bold text-gray-400 uppercase">Vol. Kg</span>
                    <span className="block font-bold text-gray-700">{calcWeight().berat_volume} kg</span>
                  </div>
                  <div className="border-l border-gray-200">
                    <span className="block text-[10px] font-bold text-gray-400 uppercase">Dasar</span>
                    <span className="block font-bold text-blue-600">{calcWeight().dasar_berat}</span>
                  </div>
                  <div className="border-l border-gray-200">
                    <span className="block text-[10px] font-bold text-[#E4002B] uppercase">Penagihan</span>
                    <span className="block font-black text-[#E4002B]">{calcWeight().berat_penagihan} kg</span>
                  </div>
                </div>

                {/* Nilai Barang */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Nilai Barang (Rp)
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 inset-y-0 flex items-center text-gray-400 text-xs font-bold">
                      Rp
                    </div>
                    <input
                      type="text"
                      value={nilaiBarangRaw}
                      onChange={handleNilaiBarangChange}
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
                      placeholder="Contoh: 150.000"
                    />
                  </div>
                </div>

                {/* Catatan Admin */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Catatan Internal Admin (Opsional)
                  </label>
                  <textarea
                    value={catatanAdmin}
                    onChange={(e) => setCatatanAdmin(e.target.value)}
                    rows={2}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B] resize-none"
                    placeholder="Catatan packing kayu, instruksi khusus, dll"
                  />
                </div>

                {/* Camera Upload */}
                <div 
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 focus-within:ring-2 focus-within:ring-[#E4002B]/30 outline-none"
                  onPaste={(e) => handlePasteImage(e, "paket")}
                  tabIndex={0}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                    <span className="uppercase tracking-wider">Foto Fisik Paket <span className="font-normal text-[9px] text-gray-500 ml-1">(Klik area ini lalu Ctrl+V untuk Paste)</span></span>
                    {fotoPaketUrl && <span className="text-emerald-600">✓ Tersimpan</span>}
                  </div>

                  <button
                    type="button"
                    onClick={() => cameraPaketInputRef.current?.click()}
                    disabled={uploadingFotoPaket}
                    className="w-full py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <Camera className="h-4 w-4 text-[#E4002B]" />
                    <span>{uploadingFotoPaket ? "Mengunggah..." : "Ambil Foto Paket"}</span>
                  </button>

                  <input
                    type="file"
                    ref={cameraPaketInputRef}
                    onChange={handlePaketFileChange}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                  />

                  {fotoPaketUrl && (
                    <div className="p-2 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-sm">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <img 
                          src={getDisplayImageUrl(fotoPaketUrl)} 
                          alt="Foto Paket" 
                          className="h-10 w-10 object-cover rounded-lg border border-slate-200 shrink-0" 
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-slate-800 truncate">Foto Paket Tersimpan</span>
                          <span className="text-[10px] text-slate-400 truncate">{fotoPaketUrl}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setValidationPopupData({
                            type: "paket",
                            previewUrl: getDisplayImageUrl(fotoPaketUrl),
                            remoteUrl: fotoPaketUrl,
                            detectedResiId: null
                          });
                          setShowValidationPopup(true);
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-[#E4002B] hover:bg-red-50 rounded-lg transition shrink-0 cursor-pointer border border-red-100"
                      >
                        Lihat / Ubah
                      </button>
                    </div>
                  )}
                </div>

              </div>

              {/* ACTION BUTTONS */}
              <div className="pt-2 flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleDraftBaru}
                  className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition cursor-pointer shrink-0 whitespace-nowrap"
                >
                  Reset Form
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePreInput(false)}
                  disabled={loading || uploadingFotoPaket}
                  className="flex-1 py-3 px-4 bg-[#E4002B] hover:bg-[#c20023] disabled:bg-gray-400 text-white font-extrabold rounded-xl shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer text-xs sm:text-sm whitespace-nowrap min-w-0"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
                      <span className="truncate">Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 shrink-0" />
                      <span className="truncate">Simpan Pre-Input (Siap Dibayar)</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>

          {/* AREA KANAN: OPERATIONAL WORKSPACE BOARD (DIPERKECIL: 42% Desktop / 5 Kolom / STICKY BOARD) */}
          <div className="md:col-span-5 lg:col-span-5 xl:col-span-5 2xl:col-span-5 space-y-4 md:sticky md:top-6 lg:sticky lg:top-6 z-10 self-start">
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 space-y-4">
              
              {/* BOARD HEADER */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-[#E4002B]/10 p-2 rounded-xl text-[#E4002B]">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">Operational Workspace Board</h3>
                    <p className="text-xs text-gray-400">Papan pantau & alur otomatis admin outlet J&T</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-red-50 text-[#E4002B] text-xs font-extrabold px-2.5 py-1 rounded-full font-mono border border-red-100">
                    Total: {filteredDraftsAll.length} Draft
                  </span>
                  <button
                    type="button"
                    onClick={() => fetchDrafts(false)}
                    disabled={loadingDrafts}
                    className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl transition cursor-pointer border border-gray-200"
                    title="Refresh Manual Board"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingDrafts ? "animate-spin text-[#E4002B]" : ""}`} />
                  </button>
                </div>
              </div>

              {/* SUMMARY BAR */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                <div className="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">1. Draft</span>
                    <span className="text-lg font-black text-slate-800 font-mono">{columnData.DRAFT.length}</span>
                  </div>
                  <div className="bg-blue-50 text-blue-600 p-1.5 rounded-lg text-xs font-bold">
                    📋
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-amber-100 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">2. Input YoYi</span>
                    <span className="text-lg font-black text-slate-800 font-mono">{columnData.INPUT_YOYI.length}</span>
                  </div>
                  <div className="bg-amber-50 text-amber-600 p-1.5 rounded-lg text-xs font-bold">
                    ⚡
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">3. Siap Dibayar</span>
                    <span className="text-lg font-black text-slate-800 font-mono">{columnData.SIAP_DIBAYAR.length}</span>
                  </div>
                  <div className="bg-emerald-50 text-emerald-600 p-1.5 rounded-lg text-xs font-bold">
                    💳
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">4. Selesai</span>
                    <span className="text-lg font-black text-slate-800 font-mono">{columnData.SELESAI.length}</span>
                  </div>
                  <div className="bg-slate-100 text-slate-600 p-1.5 rounded-lg text-xs font-bold">
                    ✅
                  </div>
                </div>
              </div>

              {/* SEARCH BAR & MULTI FILTERS */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search realtime: Nama, WA, Alamat, Barang, Nomor Resi..."
                    className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#E4002B]/30"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* FILTER DROPDOWNS */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <select
                      value={filterOutlet}
                      onChange={(e) => setFilterOutlet(e.target.value)}
                      className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
                    >
                      <option value="ALL">Semua Outlet</option>
                      {outlets.map((o) => (
                        <option key={o.outlet_id} value={o.outlet_id}>
                          {o.nama_outlet} ({o.outlet_id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <select
                      value={filterHari}
                      onChange={(e) => setFilterHari(e.target.value)}
                      className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
                    >
                      <option value="ALL">Semua Hari</option>
                      <option value="TODAY">Hari Ini</option>
                      <option value="WEEK">7 Hari Terakhir</option>
                      <option value="MONTH">Bulan Ini</option>
                    </select>
                  </div>

                  <div>
                    <select
                      value={filterEkspedisi}
                      onChange={(e) => setFilterEkspedisi(e.target.value)}
                      className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
                    >
                      <option value="ALL">Semua Ekspedisi</option>
                      <option value="Express">Express</option>
                      <option value="Cargo">Cargo</option>
                    </select>
                  </div>

                  <div>
                    <select
                      value={filterAdmin}
                      onChange={(e) => setFilterAdmin(e.target.value)}
                      className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
                    >
                      <option value="ALL">Semua Admin</option>
                      {Array.from(new Set(drafts.map((d) => d.admin_id).filter(Boolean))).map((adm) => {
                        const u = users.find(x => x.user_id === adm || x.username === adm);
                        const label = u ? (u.nama_lengkap || u.username || adm) : adm;
                        return (
                          <option key={adm} value={adm}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>

              {/* OPERATIONAL BOARD (ACCORDION TABS) */}
              {loadingDrafts ? (
                <div className="py-12 text-center text-xs text-gray-400 flex flex-col items-center gap-2">
                  <RefreshCw className="h-6 w-6 animate-spin text-[#E4002B]" />
                  <span>Memuat workspace operasional board...</span>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {/* ACCORDION TABS HEADER */}
                  <div className="flex flex-wrap sm:flex-nowrap bg-gray-100 p-1.5 rounded-xl w-full gap-1">
                    <button
                      onClick={() => { setActiveBoardTab("DRAFT"); setBoardPage(1); }}
                      className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-colors ${activeBoardTab === "DRAFT" ? 'bg-white text-blue-700 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
                    >
                      DRAFT <span className={`ml-1 px-1.5 py-0.5 rounded font-mono text-[9px] ${activeBoardTab === "DRAFT" ? "bg-blue-100" : "bg-gray-200"}`}>{columnData.DRAFT.length}</span>
                    </button>
                    <button
                      onClick={() => { setActiveBoardTab("INPUT_YOYI"); setBoardPage(1); }}
                      className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-colors ${activeBoardTab === "INPUT_YOYI" ? 'bg-white text-amber-700 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
                    >
                      INPUT YOYI <span className={`ml-1 px-1.5 py-0.5 rounded font-mono text-[9px] ${activeBoardTab === "INPUT_YOYI" ? "bg-amber-100" : "bg-gray-200"}`}>{columnData.INPUT_YOYI.length}</span>
                    </button>
                    <button
                      onClick={() => { setActiveBoardTab("SIAP_DIBAYAR"); setBoardPage(1); }}
                      className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-colors ${activeBoardTab === "SIAP_DIBAYAR" ? 'bg-white text-emerald-700 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
                    >
                      SIAP DIBAYAR <span className={`ml-1 px-1.5 py-0.5 rounded font-mono text-[9px] ${activeBoardTab === "SIAP_DIBAYAR" ? "bg-emerald-100" : "bg-gray-200"}`}>{columnData.SIAP_DIBAYAR.length}</span>
                    </button>
                    <button
                      onClick={() => { setActiveBoardTab("SELESAI"); setBoardPage(1); }}
                      className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-colors ${activeBoardTab === "SELESAI" ? 'bg-white text-gray-800 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
                    >
                      SELESAI <span className={`ml-1 px-1.5 py-0.5 rounded font-mono text-[9px] ${activeBoardTab === "SELESAI" ? "bg-gray-100 text-gray-600" : "bg-gray-200"}`}>{columnData.SELESAI.length}</span>
                    </button>
                  </div>

                  {/* ACTIVE TAB CONTENT */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-3 flex flex-col space-y-3 min-h-[400px]">
                    <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                      {columnData[activeBoardTab as "DRAFT" | "INPUT_YOYI" | "SIAP_DIBAYAR" | "SELESAI"].length === 0 ? (
                        <p className="text-[11px] text-gray-500 text-center py-12 italic">Tidak ada data untuk status ini.</p>
                      ) : (
                        columnData[activeBoardTab as "DRAFT" | "INPUT_YOYI" | "SIAP_DIBAYAR" | "SELESAI"]
                          .slice((boardPage - 1) * boardLimit, boardPage * boardLimit)
                          .map((card: any) => {
                          const dateObj = card.timestamp ? new Date(card.timestamp) : new Date();
                          const timeFormatted = dateObj.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                          
                          // Styling per tab
                          let cardBorder = "border-gray-200";
                          let badgeBg = "bg-gray-100 text-gray-600";
                          if (activeBoardTab === "DRAFT") { cardBorder = "border-blue-200"; badgeBg = "bg-blue-50 text-blue-600"; }
                          else if (activeBoardTab === "INPUT_YOYI") { cardBorder = "border-amber-200"; badgeBg = "bg-amber-50 text-amber-600"; }
                          else if (activeBoardTab === "SIAP_DIBAYAR") { cardBorder = "border-emerald-200"; badgeBg = "bg-emerald-50 text-emerald-600"; }
                          
                          // Is being edited?
                          const isCurrent = editingTxId === card.transaksi_id;

                          return (
                            <div key={card.transaksi_id} className={`p-3 bg-white rounded-xl border ${cardBorder} transition space-y-2.5 shadow-2xs flex flex-col justify-between hover:shadow-sm ${isCurrent ? "ring-2 ring-[#E4002B]/20 border-[#E4002B]" : ""}`}>
                              <div className="flex items-start justify-between gap-1 border-b border-gray-100 pb-1.5">
                                <div>
                                  <h5 className="font-bold text-slate-900 text-xs">{card.nama_pengirim || "Customer Umum"}</h5>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${badgeBg}`}>
                                      {card.transaksi_id.split("-")[1] || card.transaksi_id}
                                    </span>
                                    <span className="text-[9px] text-gray-400 font-mono">• {timeFormatted}</span>
                                  </div>
                                </div>
                                {renderProductBadge(card.ekspedisi, card.nama_barang)}
                              </div>
                              <div className="text-[11px] space-y-1 text-slate-700">
                                <p className="font-semibold truncate text-slate-800">📦 {card.nama_barang || "Tanpa Nama Barang"}</p>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                                  <span>{card.berat_kg || card.berat_timbangan || 0} kg</span>
                                  <span>📍 {card.alamat_penerima ? card.alamat_penerima.slice(0, 18) + "..." : "-"}</span>
                                </div>
                                {renderPriorityBadges(card)}
                              </div>
                              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  {activeBoardTab !== "SELESAI" && (
                                    <button
                                      type="button"
                                      onClick={() => handleSelectDraftToEdit(card)}
                                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition text-[10px] flex items-center gap-1"
                                    >
                                      <Edit3 className="h-3 w-3" /> Edit
                                    </button>
                                  )}
                                  
                                  {activeBoardTab === "DRAFT" && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleBatalkanDraft(card.transaksi_id)}
                                        className="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-lg transition text-[10px] flex items-center gap-1"
                                      >
                                        <XCircle className="h-3 w-3" /> Batal
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleHapusDraft(card.transaksi_id)}
                                        className="px-2 py-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 font-semibold rounded-lg transition text-[10px]"
                                        title="Hapus Data (Tidak bisa dikembalikan)"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </>
                                  )}
                                  
                                  {activeBoardTab === "INPUT_YOYI" && (
                                    <button
                                      type="button"
                                      onClick={() => handleMoveStatus(card.transaksi_id, "Draft")}
                                      className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition text-[10px] flex items-center gap-1"
                                    >
                                      <RefreshCw className="h-3 w-3" /> Ke Draft
                                    </button>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-1.5">
                                  {activeBoardTab === "DRAFT" && (
                                    <button
                                      type="button"
                                      onClick={() => handleMoveStatus(card.transaksi_id, "INPUT_YOYI")}
                                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg transition text-[10px] flex items-center gap-1 shadow-2xs"
                                    >
                                      Lanjut <ArrowRight className="h-3 w-3" />
                                    </button>
                                  )}
                                  
                                  {activeBoardTab === "INPUT_YOYI" && (
                                    <button
                                      type="button"
                                      onClick={() => setResiModalData(card)}
                                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-lg transition text-[10px] flex items-center gap-1 shadow-2xs"
                                    >
                                      Input Resi <ArrowRight className="h-3 w-3" />
                                    </button>
                                  )}
                                  
                                  {activeBoardTab === "SIAP_DIBAYAR" && (
                                    <button
                                      type="button"
                                      onClick={() => handleLanjutkanDraft(card)}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg transition text-[10px] flex items-center gap-1 shadow-2xs"
                                    >
                                      Bayar <ArrowRight className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    
                    {/* PAGINATION */}
                    {columnData[activeBoardTab as "DRAFT" | "INPUT_YOYI" | "SIAP_DIBAYAR" | "SELESAI"].length > 0 && (
                      <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between text-[11px] text-gray-500 gap-2">
                        <div className="flex items-center gap-1.5">
                          <select 
                            value={boardLimit} 
                            onChange={(e) => { setBoardLimit(Number(e.target.value)); setBoardPage(1); }}
                            className="bg-gray-50 border border-gray-200 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-[#E4002B] text-gray-700 font-semibold cursor-pointer"
                          >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                          </select>
                          <span>/ hal</span>
                        </div>
                        <div className="font-semibold hidden sm:block">
                          Menampilkan {Math.min((boardPage - 1) * boardLimit + 1, columnData[activeBoardTab as "DRAFT" | "INPUT_YOYI" | "SIAP_DIBAYAR" | "SELESAI"].length)} - {Math.min(boardPage * boardLimit, columnData[activeBoardTab as "DRAFT" | "INPUT_YOYI" | "SIAP_DIBAYAR" | "SELESAI"].length)} dari {columnData[activeBoardTab as "DRAFT" | "INPUT_YOYI" | "SIAP_DIBAYAR" | "SELESAI"].length} data
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            disabled={boardPage === 1}
                            onClick={() => setBoardPage(p => Math.max(1, p - 1))}
                            className="p-1 rounded bg-gray-50 border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Halaman Sebelumnya"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <span className="font-mono px-2 font-bold">{boardPage}</span>
                          <button 
                            disabled={boardPage * boardLimit >= columnData[activeBoardTab as "DRAFT" | "INPUT_YOYI" | "SIAP_DIBAYAR" | "SELESAI"].length}
                            onClick={() => setBoardPage(p => p + 1)}
                            className="p-1 rounded bg-gray-50 border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Halaman Selanjutnya"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
{/* RECENT ACTIVITY LOG SECTION */}
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-gray-500" />
                    <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Recent Activity (5 Terakhir)</h4>
                  </div>
                  <span className="text-[9px] text-gray-400 font-mono">Audit Operasional</span>
                </div>

                <div className="bg-gray-50/80 rounded-xl p-2.5 border border-gray-200/80 space-y-1.5 text-xs">
                  {recentActivities.length === 0 ? (
                    <p className="text-[11px] text-gray-400 text-center py-1">Belum ada log aktivitas.</p>
                  ) : (
                    recentActivities.map((act, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] py-0.5 border-b border-gray-200/40 last:border-0">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="font-mono text-[10px] font-bold text-gray-500 bg-white px-1.5 py-0.5 rounded border border-gray-200 shrink-0">
                            {act.time}
                          </span>
                          <span className="font-bold text-gray-800 shrink-0 truncate">{act.txDisplay}</span>
                        </div>
                        <span className="font-mono text-[10px] text-red-600 font-semibold shrink-0">
                          {act.statusDisplay}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* MODAL INPUT NOMOR RESI YOYI / JTC */}
      {resiModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-150">
            <div className="bg-[#E4002B] px-5 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Input Nomor Resi (YoYi / JTC)</h3>
                <p className="text-xs text-red-100 font-mono mt-0.5">{resiModalData.transaksi_id} • {resiModalData.nama_pengirim || "Customer"}</p>
              </div>
              <button 
                onClick={() => { setResiModalData(null); setInputResiNumber(""); }}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nomor Resi J&T / JTC <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={inputResiNumber}
                  onChange={(e) => setInputResiNumber(e.target.value.toUpperCase())}
                  placeholder="Contoh: JX1234567890"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#E4002B]"
                  autoFocus
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Setelah disimpan, status otomatis berpindah ke <strong className="text-emerald-600">SIAP DIBAYAR</strong>.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setResiModalData(null); setInputResiNumber(""); }}
                  className="w-1/3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveResiNumber}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Simpan & Pindah</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Validasi Kualitas Foto Popup */}
      {showValidationPopup && validationPopupData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="bg-[#E4002B] px-6 py-4 text-white">
              <h3 className="text-lg font-bold tracking-tight">Validasi Kualitas Foto</h3>
              <p className="text-xs text-red-100 mt-0.5">
                Verifikasi Foto Paket Fisik
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-100 border border-slate-200 shadow-inner">
                <img 
                  src={getDisplayImageUrl(validationPopupData.previewUrl)} 
                  alt="Preview" 
                  className="h-full w-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-slate-800">Verifikasi Hasil Foto</p>
                <p className="text-xs text-slate-500">
                  Apakah Foto Paket terlihat jelas, terang, dan tidak buram?
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 px-6 py-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowValidationPopup(false);
                  setValidationPopupData(null);
                  toast.info("Silakan ambil ulang foto.");
                  cameraPaketInputRef.current?.click();
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition cursor-pointer"
              >
                Buram / Retake
              </button>
              <button
                type="button"
                onClick={() => {
                  setFotoPaketUrl(validationPopupData.remoteUrl || validationPopupData.previewUrl);
                  toast.success("Foto Paket berhasil disimpan!");
                  setShowValidationPopup(false);
                  setValidationPopupData(null);
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-[#E4002B] py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#c20023] transition cursor-pointer"
              >
                Jelas & Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS DRAFT */}
      {draftToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-sm">Hapus Draft Pre-Input?</h4>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{draftToDelete}</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Data draft ini akan dihapus secara permanen dari sistem dan tidak dapat dipulihkan.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDraftToDelete(null)}
                className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => confirmAndExecuteHapusDraft(draftToDelete)}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Ya, Hapus Draft</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Address Book Drawers */}
      <AddressBookDrawer
        isOpen={bukuPengirimOpen}
        onClose={() => setBukuPengirimOpen(false)}
        type="PENGIRIM"
        onSelect={(item) => {
          setNamaPengirim(item.nama);
          setHpPengirim(item.telepon);
          setAlamatPengirim(item.alamat);
          toast.success(`Pengirim "${item.nama}" dipilih`);
        }}
      />

      <AddressBookDrawer
        isOpen={bukuPenerimaOpen}
        onClose={() => setBukuPenerimaOpen(false)}
        type="PENERIMA"
        onSelect={(item) => {
          setNamaPenerima(item.nama);
          setHpPenerima(item.telepon);
          setAlamatPenerima(item.alamat);
          toast.success(`Penerima "${item.nama}" dipilih`);
        }}
      />

    </div>
  );
}
