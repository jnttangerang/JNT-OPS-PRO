import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  User, Phone, MapPin, Sparkles, Camera, Image as ImageIcon, 
  Save, ArrowLeft, CheckCircle2, Clipboard, ChevronRight, RefreshCw, AlertCircle, BookOpen,
  PlusCircle, Search, Filter, XCircle, Clock, Play, Edit3, Trash2, Zap, Check, AlertTriangle, Layers
} from "lucide-react";
import useAppsScript from "../hooks/useAppsScript";
import { SessionData, Outlet, MasterCustomer, RiwayatPenerima } from "../types";
import { toast } from "../utils/toast";
import AddressBookDrawer from "./AddressBookDrawer";
import { calculateWeight } from "../utils/weightCalculator";

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

  // Workspace States (Operational Board)
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("Semua");
  const [autoSaveStatus, setAutoSaveStatus] = useState<string | null>(null);
  const [duplicateAlert, setDuplicateAlert] = useState<any | null>(null);

  // Recent Quick Fill lists
  const [recentCustomers, setRecentCustomers] = useState<MasterCustomer[]>([]);
  const [recentAddresses, setRecentAddresses] = useState<string[]>([]);

  // Success and Clearing Screen States
  const [submittedTxId, setSubmittedTxId] = useState<string | null>(null);
  const [clearingText, setClearingText] = useState("");
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Address Book Drawers
  const [bukuPengirimOpen, setBukuPengirimOpen] = useState(false);
  const [bukuPenerimaOpen, setBukuPenerimaOpen] = useState(false);

  // Popup Validasi Kualitas Foto
  const [showValidationPopup, setShowValidationPopup] = useState(false);
  const [validationPopupData, setValidationPopupData] = useState<{
    type: "paket" | "resi";
    previewUrl: string;
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

  // Fetch Drafts from backend
  const fetchDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const response = await callBackend("getPreInputDrafts");
      if (response && response.status === "success" && Array.isArray(response.data)) {
        setDrafts(response.data);
      }
    } catch (err) {
      console.error("Gagal memuat list draft workspace:", err);
    } finally {
      setLoadingDrafts(false);
    }
  }, [callBackend]);

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
  const getCleanNumberValue = (rpStr: string): number => {
    return Number(rpStr.replace(/\D/g, "")) || 0;
  };

  // Debounced Customer Search on Sender Name
  useEffect(() => {
    if (namaPengirim.trim().length < 2 || selectedCustomerId) {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSearchingCustomer(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const response = await callBackend("searchCustomer", { query: namaPengirim });
        if (response.status === "success" && response.data) {
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
        if (response.status === "success" && response.data) {
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
    const normPhone = hpPengirim.replace(/\D/g, "");
    if (!namaPengirim.trim() && !normPhone) {
      setDuplicateAlert(null);
      return;
    }

    const existingMatch = drafts.find((d) => {
      if (d.transaksi_id === editingTxId) return false;
      if (d.status === "SELESAI" || d.status === "Dibatalkan" || d.status === "BATAL") return false;
      
      const dPhone = (d.hp_pengirim || "").replace(/\D/g, "");
      const dName = (d.nama_pengirim || "").trim().toLowerCase();
      
      const matchName = dName && namaPengirim.trim().toLowerCase() === dName;
      const matchPhone = normPhone && normPhone.length >= 8 && dPhone === normPhone;
      
      return matchName || matchPhone;
    });

    setDuplicateAlert(existingMatch || null);
  }, [namaPengirim, hpPengirim, drafts, editingTxId]);

  // Auto-Save Effect (Debounced 800ms)
  useEffect(() => {
    // Only auto-save if user has provided at least name, HP, or item name
    const hasAnyContent = namaPengirim.trim() || hpPengirim.trim() || namaBarang.trim() || namaPenerima.trim();
    if (!hasAnyContent || submittedTxId) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    setAutoSaveStatus("Menyimpan draft...");

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const calc = calcWeight();
        const payload = {
          transaksi_id: editingTxId,
          is_draft: true,
          status: "Draft",
          admin_id: session.user_id,
          outlet_id_tugas: activeOutletId,
          nama_pengirim: namaPengirim.trim(),
          hp_pengirim: hpPengirim.trim(),
          alamat_pengirim: alamatPengirim.trim(),
          nama_penerima: namaPenerima.trim(),
          hp_penerima: hpPenerima.trim(),
          alamat_penerima: alamatPenerima.trim(),
          alamat_penerima_asli: alamatPenerimaAsli || alamatPenerima.trim(),
          catatan_admin: catatanAdmin.trim(),
          nama_barang: namaBarang.trim(),
          ekspedisi,
          berat_timbangan: Number(beratKg) || 0,
          panjang_cm: Number(volP) || 0,
          lebar_cm: Number(volL) || 0,
          tinggi_cm: Number(volT) || 0,
          berat_volume: calc.berat_volume,
          dasar_berat: calc.dasar_berat,
          berat_kg: calc.berat_penagihan,
          volume: `${volP || 0} x ${volL || 0} x ${volT || 0}`,
          nilai_barang: getCleanNumberValue(nilaiBarangRaw),
          foto_paket_url: fotoPaketUrl,
          foto_resi_url: fotoResiUrl
        };

        const res = await callBackend("saveDataPreInput", payload);
        if (res && res.status === "success" && res.data) {
          const txId = res.data.transaksi_id;
          if (!editingTxId) setEditingTxId(txId);
          localStorage.setItem("active_draft_tx_id", txId);
          setAutoSaveStatus(`Tersimpan otomatis • ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`);
          
          // Refresh drafts quietly
          const draftsRes = await callBackend("getPreInputDrafts");
          if (draftsRes && draftsRes.status === "success" && Array.isArray(draftsRes.data)) {
            setDrafts(draftsRes.data);
          }
        }
      } catch (e) {
        console.error("Auto-save failed:", e);
        setAutoSaveStatus("Gagal menyimpan otomatis");
      }
    }, 800);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [
    namaPengirim, hpPengirim, alamatPengirim, 
    namaPenerima, hpPenerima, alamatPenerima, 
    namaBarang, ekspedisi, beratKg, volP, volL, volT, 
    nilaiBarangRaw, catatanAdmin, fotoPaketUrl, fotoResiUrl, 
    editingTxId, activeOutletId, session.user_id, submittedTxId, callBackend
  ]);

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
        handleSavePreInput(false);
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
    setNamaPengirim(draft.nama_pengirim || "");
    setHpPengirim(draft.hp_pengirim || "");
    setAlamatPengirim(draft.alamat_pengirim || "");
    setNamaPenerima(draft.nama_penerima || "");
    setHpPenerima(draft.hp_penerima || "");
    setAlamatPenerima(draft.alamat_penerima || "");
    setEkspedisi(draft.ekspedisi === "Cargo" ? "Cargo" : "Express");
    setNamaBarang(draft.nama_barang || "");
    setBeratKg(String(draft.berat_timbangan || draft.berat_kg || 0));
    setVolP(draft.panjang_cm ? String(draft.panjang_cm) : "");
    setVolL(draft.lebar_cm ? String(draft.lebar_cm) : "");
    setVolT(draft.tinggi_cm ? String(draft.tinggi_cm) : "");
    
    if (draft.nilai_barang) {
      setNilaiBarangRaw(Number(draft.nilai_barang).toLocaleString("id-ID"));
    } else {
      setNilaiBarangRaw("");
    }
    
    setFotoPaketUrl(draft.foto_paket_url || "");
    setFotoResiUrl(draft.foto_resi_url || "");
    setCatatanAdmin(draft.catatan_admin || "");
    setSubmittedTxId(null);
    setFormError(null);
  };

  // Click on a draft card to edit
  const handleSelectDraftToEdit = (draft: any) => {
    setEditingTxId(draft.transaksi_id);
    localStorage.setItem("active_draft_tx_id", draft.transaksi_id);
    populateFormFromDraft(draft);
    toast.info(`Mengedit draft: ${draft.transaksi_id}`);
    namaInputRef.current?.focus();
  };

  // Continue Draft to Resi & Bayar page
  const handleLanjutkanDraft = (draft: any) => {
    localStorage.setItem("pending_transaksi_id", draft.transaksi_id);
    onNavigate("transaksi");
  };

  // Cancel Draft (change status to Dibatalkan)
  const handleBatalkanDraft = async (txId: string) => {
    try {
      const res = await callBackend("updatePreInputStatus", {
        transaksi_id: txId,
        status: "Dibatalkan"
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

  // Manual Save Handler
  const handleSavePreInput = async (isDraftManual = false) => {
    setFormError(null);

    if (!namaPengirim.trim()) {
      setFormError("Nama pengirim wajib diisi!");
      return;
    }
    if (!hpPengirim.trim()) {
      setFormError("Nomor HP pengirim wajib diisi!");
      return;
    }
    if (!alamatPengirim.trim()) {
      setFormError("Alamat pengirim wajib diisi!");
      return;
    }
    if (!namaPenerima.trim()) {
      setFormError("Nama penerima wajib diisi!");
      return;
    }
    if (!hpPenerima.trim()) {
      setFormError("Nomor HP penerima wajib diisi!");
      return;
    }
    if (!alamatPenerima.trim()) {
      setFormError("Alamat penerima wajib diisi!");
      return;
    }
    if (!namaBarang.trim()) {
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
        outlet_id_tugas: activeOutletId,
        nama_pengirim: namaPengirim.trim(),
        hp_pengirim: hpPengirim.trim(),
        alamat_pengirim: alamatPengirim.trim(),
        nama_penerima: namaPenerima.trim(),
        hp_penerima: hpPenerima.trim(),
        alamat_penerima: alamatPenerima.trim(),
        alamat_penerima_asli: alamatPenerimaAsli || alamatPenerima.trim(),
        catatan_admin: catatanAdmin.trim(),
        nama_barang: namaBarang.trim(),
        ekspedisi,
        berat_timbangan: Number(beratKg) || 0,
        panjang_cm: Number(volP) || 0,
        lebar_cm: Number(volL) || 0,
        tinggi_cm: Number(volT) || 0,
        berat_volume: calc.berat_volume,
        dasar_berat: calc.dasar_berat,
        berat_kg: calc.berat_penagihan,
        volume: `${volP || 0} x ${volL || 0} x ${volT || 0}`,
        nilai_barang: getCleanNumberValue(nilaiBarangRaw),
        foto_paket_url: fotoPaketUrl,
        foto_resi_url: fotoResiUrl
      };

      const response = await callBackend("saveDataPreInput", payload);

      if (response.status === "success" && response.data) {
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
Nilai   : Rp ${getCleanNumberValue(nilaiBarangRaw).toLocaleString("id-ID")}
Catatan : ${catatanAdmin || "-"}
========================================`;

        setClearingText(textSummary);
        toast.success(`Pre-Input ${txId} berhasil disimpan!`);
        fetchDrafts();
      } else {
        setFormError(response.message || "Gagal menyimpan data pre-input.");
        toast.error(response.message || "Gagal menyimpan data pre-input.");
      }
    } catch (err: any) {
      setFormError(err.message || "Terjadi kesalahan jaringan.");
      toast.error(err.message || "Terjadi kesalahan jaringan.");
    }
  };

  // Format Currency
  const formatRupiahDisplay = (valStr: string) => {
    const cleaned = valStr.replace(/\D/g, "");
    if (!cleaned) return "";
    return Number(cleaned).toLocaleString("id-ID");
  };

  const handleNilaiBarangChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNilaiBarangRaw(formatRupiahDisplay(e.target.value));
  };

  // Select Customer from suggestion
  const selectCustomer = (cst: MasterCustomer) => {
    setNamaPengirim(cst.nama_pengirim);
    setHpPengirim(cst.no_hp);
    setAlamatPengirim(cst.alamat_pengirim);
    setSelectedCustomerId(cst.customer_id);
    setShowSuggestions(false);
  };

  const handleSenderChange = (val: string, type: "nama" | "hp" | "alamat") => {
    if (type === "nama") {
      setNamaPengirim(val);
      setSelectedCustomerId(null);
    } else if (type === "hp") {
      setHpPengirim(val.replace(/\D/g, ""));
      setSelectedCustomerId(null);
    } else if (type === "alamat") {
      setAlamatPengirim(val);
    }
  };

  // Auto fill Recipient from history click
  const selectRecipientFromHistory = (rec: RiwayatPenerima) => {
    setNamaPenerima(rec.nama_penerima);
    setHpPenerima(rec.no_hp_penerima);
    setAlamatPenerima(rec.alamat_penerima);
  };

  // AI Address Optimizer
  const handleOptimizeAddress = async () => {
    if (!alamatPenerima.trim()) {
      setAiNotice({ type: "error", text: "Alamat penerima kosong! Ketik alamat terlebih dahulu." });
      return;
    }

    setOptimizingAddress(true);
    setAiNotice(null);
    setSuggestedAddress(null);
    try {
      const response = await callBackend("perbaikiAlamatAI", { alamat: alamatPenerima });
      if (response.status === "success" && response.data) {
        setSuggestedAddress(response.data);
        setAiNotice({ type: "success", text: "Hasil perbaikan alamat oleh AI sudah siap! Tinjau di bawah." });
      } else {
        setAiNotice({ type: "error", text: response.message || "Gagal merapikan alamat." });
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

          if (response.status === "success" && response.data) {
            setValidationPopupData({
              type: "paket",
              previewUrl: response.data,
              detectedResiId: null
            });
            setShowValidationPopup(true);
          } else {
            setFormError(response.message || "Gagal mengunggah foto paket.");
            toast.error(response.message || "Gagal mengunggah foto paket.");
          }
        } catch (err: any) {
          setFormError(err.message || "Terjadi kesalahan saat mengunggah foto.");
          toast.error(err.message || "Terjadi kesalahan saat mengunggah foto.");
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
      const nameMatch = (d.nama_pengirim || "").toLowerCase().includes(q) || (d.nama_penerima || "").toLowerCase().includes(q);
      const phoneMatch = (d.hp_pengirim || "").includes(q) || (d.hp_penerima || "").includes(q);
      const itemMatch = (d.nama_barang || "").toLowerCase().includes(q);
      const addrMatch = (d.alamat_pengirim || "").toLowerCase().includes(q) || (d.alamat_penerima || "").toLowerCase().includes(q);
      const txMatch = (d.transaksi_id || "").toLowerCase().includes(q);

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
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      
      {/* HEADER SECTION & SHORTCUT TOOLBAR */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-red-50 text-[#E4002B] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest font-mono">
                OPERATIONAL WORKSPACE
              </span>
              {editingTxId && (
                <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2.5 py-1 rounded-full font-mono border border-blue-100">
                  EDITING: {editingTxId}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-800 font-sans mt-2">
              Pre-Input & Workspace Operational
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
              <span>Simpan Draft</span>
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
        <div className="bg-white rounded-2xl shadow-lg border border-green-100 p-6 sm:p-8 text-center animate-fade-in max-w-3xl mx-auto">
          <div className="mx-auto bg-green-50 text-green-600 rounded-full h-16 w-16 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-10 w-10 stroke-[2]" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">
            Pre-Input Berhasil Disimpan!
          </h2>
          <p className="text-xs text-green-600 font-mono font-bold mt-1">
            KODE PRE-INPUT: {submittedTxId}
          </p>
          <p className="text-xs text-gray-500 max-w-md mx-auto mt-2">
            Klik kotak kliring di bawah untuk menyalin otomatis seluruh ringkasan.
          </p>

          <div className="mt-6 relative max-w-lg mx-auto">
            <textarea
              ref={clearingTextRef}
              readOnly
              onClick={handleClearingBoxClick}
              value={clearingText}
              className="w-full h-48 bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl p-4 font-mono text-xs text-gray-700 leading-relaxed cursor-pointer focus:outline-none resize-none shadow-inner transition-colors duration-200"
            />
            <div className="absolute bottom-3 right-3 bg-gray-900/80 text-white rounded-lg py-1 px-2.5 flex items-center gap-1.5 text-[10px] pointer-events-none">
              <Clipboard className="h-3.5 w-3.5" />
              <span>{copiedNotification ? "Tersalin!" : "Klik untuk Salin"}</span>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4 max-w-lg mx-auto">
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* AREA KIRI: FORM PRE-INPUT (7 COLS) */}
          <div className="lg:col-span-7 space-y-6">

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
                      onChange={(e) => handleSenderChange(e.target.value, "nama")}
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
                      {customerSuggestions.map((cst) => (
                        <button
                          key={cst.customer_id}
                          type="button"
                          onClick={() => selectCustomer(cst)}
                          className="w-full text-left p-3 hover:bg-gray-50 text-xs transition-colors flex flex-col gap-0.5 cursor-pointer"
                        >
                          <span className="font-bold text-gray-800">{cst.nama_pengirim}</span>
                          <span className="text-gray-500">{cst.no_hp} • {cst.alamat_pengirim.slice(0, 45)}...</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* RECENT CUSTOMERS (MAX 5 PILLS) */}
                  {recentCustomers.length > 0 && !namaPengirim && (
                    <div className="mt-2 space-y-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Pelanggan Terakhir:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {recentCustomers.map((cst) => (
                          <button
                            key={cst.customer_id}
                            type="button"
                            onClick={() => selectCustomer(cst)}
                            className="px-2.5 py-1 bg-gray-100 hover:bg-red-50 hover:text-[#E4002B] text-gray-700 rounded-lg text-[11px] font-medium transition cursor-pointer"
                          >
                            + {cst.nama_pengirim} ({cst.no_hp})
                          </button>
                        ))}
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
                    onChange={(e) => handleSenderChange(e.target.value, "alamat")}
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

                {/* Nama Penerima */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Nama Penerima <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={namaPenerima}
                    onChange={(e) => setNamaPenerima(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B] focus:border-[#E4002B]"
                    placeholder="Silahkan masukan nama"
                  />
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
                    onChange={(e) => setAlamatPenerima(e.target.value)}
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
                    onChange={(e) => setNamaBarang(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B] focus:border-[#E4002B]"
                    placeholder="Contoh: Laptop Asus, Pakaian, Makanan"
                  />
                </div>

                {/* Berat & Volume Grid */}
                <div className="grid grid-cols-2 gap-4">
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
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Volume (P x L x T cm)
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={volP}
                        onChange={(e) => setVolP(e.target.value)}
                        className="w-12 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-center focus:ring-1 focus:ring-[#E4002B]"
                        placeholder="P"
                      />
                      <span className="text-gray-400 text-xs">x</span>
                      <input
                        type="number"
                        min="0"
                        value={volL}
                        onChange={(e) => setVolL(e.target.value)}
                        className="w-12 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-center focus:ring-1 focus:ring-[#E4002B]"
                        placeholder="L"
                      />
                      <span className="text-gray-400 text-xs">x</span>
                      <input
                        type="number"
                        min="0"
                        value={volT}
                        onChange={(e) => setVolT(e.target.value)}
                        className="w-12 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-center focus:ring-1 focus:ring-[#E4002B]"
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
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                    <span>Foto Fisik Paket</span>
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
                    <div className="p-1.5 bg-white border border-slate-200 rounded-lg flex items-center gap-2">
                      <img src={fotoPaketUrl} alt="Foto Paket" className="h-8 w-8 object-cover rounded" />
                      <span className="text-[10px] text-gray-500 truncate">{fotoPaketUrl}</span>
                    </div>
                  )}
                </div>

              </div>

              {/* ACTION BUTTONS */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleDraftBaru}
                  className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Reset Form
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePreInput(false)}
                  disabled={loading || uploadingFotoPaket}
                  className="flex-1 py-3.5 bg-[#E4002B] hover:bg-[#c20023] disabled:bg-gray-400 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition cursor-pointer text-sm"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Simpan Pre-Input (Siap Dibayar)</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>

          {/* AREA KANAN: OPERATIONAL WORKSPACE BOARD (5 COLS) */}
          <div className="lg:col-span-5 space-y-4">
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 space-y-4">
              
              {/* BOARD HEADER */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-red-50 p-1.5 rounded-lg text-[#E4002B]">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-sm">Workspace Active Drafts</h3>
                    <p className="text-[10px] text-gray-400">Papan pantau transaksi sebelum selesai</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="bg-red-50 text-[#E4002B] text-xs font-extrabold px-2 py-0.5 rounded-full font-mono">
                    {filteredDrafts.length}
                  </span>
                  <button
                    type="button"
                    onClick={fetchDrafts}
                    disabled={loadingDrafts}
                    className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-lg transition cursor-pointer"
                    title="Refresh Workspace"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingDrafts ? "animate-spin text-[#E4002B]" : ""}`} />
                  </button>
                </div>
              </div>

              {/* SEARCH BAR */}
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari Nama, WA, Barang, Alamat..."
                  className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
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

              {/* FILTER TABS */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs no-scrollbar">
                {["Semua", "Draft", "Siap Dibayar", "Diproses"].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilterStatus(tab)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] whitespace-nowrap transition cursor-pointer ${
                      filterStatus === tab
                        ? "bg-[#E4002B] text-white shadow-sm"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* DRAFTS LIST CARDS */}
              {loadingDrafts ? (
                <div className="py-12 text-center text-xs text-gray-400 flex flex-col items-center gap-2">
                  <RefreshCw className="h-5 w-5 animate-spin text-[#E4002B]" />
                  <span>Memuat workspace draft...</span>
                </div>
              ) : filteredDrafts.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200 space-y-1">
                  <p className="font-semibold text-gray-600">Belum ada Draft di Workspace</p>
                  <p className="text-[10px]">Isi form di sebelah kiri untuk membuat draft baru.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
                  {filteredDrafts.map((card) => {
                    const isCurrent = editingTxId === card.transaksi_id;
                    const dateObj = card.timestamp ? new Date(card.timestamp) : new Date();
                    const timeFormatted = dateObj.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

                    return (
                      <div
                        key={card.transaksi_id}
                        className={`p-3.5 bg-white rounded-xl border transition space-y-2.5 shadow-sm ${
                          isCurrent 
                            ? "border-[#E4002B] ring-2 ring-red-100 bg-red-50/20" 
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {/* CARD HEADER */}
                        <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-bold text-gray-900 text-xs">
                                {card.nama_pengirim || "Customer Umum"}
                              </h4>
                              {card.hp_pengirim && (
                                <span className="text-[10px] text-gray-500 font-mono">
                                  ({card.hp_pengirim})
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-gray-400 font-mono">
                              {card.transaksi_id} • {timeFormatted}
                            </span>
                          </div>

                          <div className="shrink-0">
                            {renderStatusBadge(card.status)}
                          </div>
                        </div>

                        {/* CARD BODY */}
                        <div className="text-xs space-y-1 text-gray-700">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase font-mono ${
                              card.ekspedisi === "Cargo" ? "bg-purple-100 text-purple-800" : "bg-[#E4002B]/10 text-[#E4002B]"
                            }`}>
                              {card.ekspedisi || "Express"}
                            </span>
                            <span className="font-bold text-gray-800 truncate">
                              {card.nama_barang || "Tanpa Nama Barang"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-gray-500 font-mono">
                            <span>Berat Penagihan: <strong className="text-gray-800">{card.berat_kg || card.berat_timbangan || 0} kg</strong></span>
                            <span>Kepada: <strong className="text-gray-800">{card.nama_penerima || "-"}</strong></span>
                          </div>

                          {card.alamat_penerima && (
                            <p className="text-[10px] text-gray-400 truncate">
                              📍 {card.alamat_penerima}
                            </p>
                          )}
                        </div>

                        {/* CARD FOOTER OPERATIONS */}
                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-1.5 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSelectDraftToEdit(card)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBatalkanDraft(card.transaksi_id)}
                              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                            >
                              <XCircle className="h-3 w-3" />
                              <span>Batalkan</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleLanjutkanDraft(card)}
                            className="px-3 py-1 bg-[#E4002B] hover:bg-[#c20023] text-white font-bold rounded-lg transition flex items-center gap-1 shadow-sm cursor-pointer"
                          >
                            <span>Lanjutkan</span>
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

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
                  src={validationPopupData.previewUrl} 
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
                  setFotoPaketUrl(validationPopupData.previewUrl);
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
