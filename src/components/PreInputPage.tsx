import React, { useState, useEffect, useRef } from "react";
import { 
  User, Phone, MapPin, Sparkles, Camera, Image as ImageIcon, 
  Save, ArrowLeft, CheckCircle2, Clipboard, ChevronRight, RefreshCw, AlertCircle
} from "lucide-react";
import useAppsScript from "../hooks/useAppsScript";
import { SessionData, Outlet, MasterCustomer, RiwayatPenerima } from "../types";
import { toast } from "../utils/toast";

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
  const [analyzingResi, setAnalyzingResi] = useState(false);

  // States for Popup Validasi Kualitas Foto
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

  const [catatanAdmin, setCatatanAdmin] = useState("");

  // Success and Clearing Screen States
  const [submittedTxId, setSubmittedTxId] = useState<string | null>(null);
  const [clearingText, setClearingText] = useState("");
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Refs for uploads and auto-select
  const cameraPaketInputRef = useRef<HTMLInputElement>(null);
  const cameraResiInputRef = useRef<HTMLInputElement>(null);
  const clearingTextRef = useRef<HTMLTextAreaElement>(null);
  const suggestionContainerRef = useRef<HTMLDivElement>(null);

  // 1. Debounced Customer Search on Sender Name
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
  }, [namaPengirim, selectedCustomerId]);

  // Handle clicking outside customer suggestions to close them
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionContainerRef.current && !suggestionContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch Recipient History once selectedCustomerId changes
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
  }, [selectedCustomerId]);

  // Utility to format Rupiah as user types (thousands separator)
  const formatRupiahDisplay = (valStr: string) => {
    const cleaned = valStr.replace(/\D/g, "");
    if (!cleaned) return "";
    return Number(cleaned).toLocaleString("id-ID");
  };

  const handleNilaiBarangChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const formatted = formatRupiahDisplay(rawVal);
    setNilaiBarangRaw(formatted);
  };

  // Convert Rp string formatted back to integer
  const getCleanNumberValue = (rpStr: string): number => {
    return Number(rpStr.replace(/\D/g, "")) || 0;
  };

  // Handle Suggestion Click
  const selectCustomer = (cst: MasterCustomer) => {
    setNamaPengirim(cst.nama_pengirim);
    setHpPengirim(cst.no_hp);
    setAlamatPengirim(cst.alamat_pengirim);
    setSelectedCustomerId(cst.customer_id);
    setShowSuggestions(false);
  };

  // Reset sender link if editing fields manually
  const handleSenderChange = (val: string, type: "nama" | "hp" | "alamat") => {
    if (type === "nama") {
      setNamaPengirim(val);
      setSelectedCustomerId(null); // Reset linkage
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

  // 2. Gemini Address Optimization
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
        setAiNotice({ type: "success", text: "Hasil perbaikan alamat oleh AI sudah siap! Tinjau dan konfirmasi di bawah." });
      } else {
        setAiNotice({ type: "error", text: response.message || "Gagal merapikan alamat." });
      }
    } catch (err: any) {
      setAiNotice({
        type: "error",
        text: err.message || "Limit harian sudah tercapai, coba lagi beberapa saat lagi atau isi manual."
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
      setAiNotice({ type: "success", text: "Berhasil menggunakan alamat versi AI! Alamat asli disimpan di sistem." });
    }
  };

  // 3. Dual Camera-Only File Upload & AI Scanning handlers
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
            // Show Validation Popup immediately
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
          setFormError("Gagal mengunggah ke server: " + err.message);
          toast.error("Gagal mengunggah: " + err.message);
        } finally {
          setUploadingFotoPaket(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setFormError("Gagal membaca file: " + err.message);
      setUploadingFotoPaket(false);
    }
  };

  const handleResiFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFotoResi(true);
    setAnalyzingResi(true);
    setFormError(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Str = reader.result as string;
        try {
          // 1. Upload File
          const responseUpload = await callBackend("uploadFile", {
            fileBase64: base64Str,
            fileName: file.name,
            category: "FOTO_RESI"
          });

          if (responseUpload.status === "success" && responseUpload.data) {
            const uploadedUrl = responseUpload.data;

            // 2. Analyze via server endpoint
            const responseAnalyze = await fetch("/api/analyzeResiPhoto", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fileUrl: uploadedUrl })
            });

            const jsonAnalyze = await responseAnalyze.json();
            if (jsonAnalyze.status === "success" && jsonAnalyze.data) {
              const ext = jsonAnalyze.data;
              setValidationPopupData({
                type: "resi",
                previewUrl: uploadedUrl,
                detectedResiId: ext.resi_id || null,
                extractedInfo: ext
              });
              setShowValidationPopup(true);
            } else {
              // Show validation even if analyze fails so user can continue
              setValidationPopupData({
                type: "resi",
                previewUrl: uploadedUrl,
                detectedResiId: null,
                extractedInfo: null
              });
              setShowValidationPopup(true);
              toast.info("Analisis AI resi gagal atau tidak lengkap. Anda masih bisa melanjutkan.");
            }
          } else {
            setFormError(responseUpload.message || "Gagal mengunggah foto resi.");
            toast.error(responseUpload.message || "Gagal mengunggah foto resi.");
          }
        } catch (err: any) {
          setFormError("Gagal mengolah resi: " + err.message);
          toast.error("Gagal mengolah resi: " + err.message);
        } finally {
          setUploadingFotoResi(false);
          setAnalyzingResi(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setFormError("Gagal membaca file: " + err.message);
      setUploadingFotoResi(false);
      setAnalyzingResi(false);
    }
  };

  // 4. Save Pre Input Form
  const handleSavePreInput = async () => {
    setFormError(null);

    // Validations
    if (!namaPengirim.trim()) return setFormError("Nama pengirim wajib diisi!");
    if (!hpPengirim.trim()) return setFormError("Nomor HP pengirim wajib diisi!");
    if (!alamatPengirim.trim()) return setFormError("Alamat pengirim wajib diisi!");
    if (!namaPenerima.trim()) return setFormError("Nama penerima wajib diisi!");
    if (!hpPenerima.trim()) return setFormError("Nomor HP penerima wajib diisi!");
    if (!alamatPenerima.trim()) return setFormError("Alamat penerima wajib diisi!");
    if (!namaBarang.trim()) return setFormError("Nama barang paket wajib diisi!");

    const vol = `${volP || "0"} x ${volL || "0"} x ${volT || "0"}`;
    const valueNum = getCleanNumberValue(nilaiBarangRaw);

    const payload = {
      admin_id: session.user_id,
      outlet_id_tugas: activeOutletId,
      nama_pengirim: namaPengirim.trim(),
      hp_pengirim: hpPengirim.trim(),
      alamat_pengirim: alamatPengirim.trim(),
      nama_penerima: namaPenerima.trim(),
      hp_penerima: hpPenerima.trim(),
      alamat_penerima: alamatPenerima.trim(),
      alamat_penerima_asli: alamatPenerimaAsli || "",
      alamat_asli: alamatPenerimaAsli || "",
      catatan_admin: catatanAdmin.trim(),
      nama_barang: namaBarang.trim(),
      berat_kg: Number(beratKg) || 0,
      volume: vol,
      nilai_barang: valueNum,
      foto_paket_url: fotoPaketUrl,
      foto_resi_url: fotoResiUrl
    };

    try {
      const response = await callBackend("saveDataPreInput", payload);
      if (response.status === "success" && response.data) {
        toast.success("Pre-Input berhasil disimpan!");
        const txId = response.data.transaksi_id;
        setSubmittedTxId(txId);

        // Generate monospaced clearing output
        const photoStatus = fotoPaketUrl ? "ADA (UPLOADED)" : "TIDAK ADA FOTO";
        const formattedValStr = valueNum > 0 ? `Rp ${valueNum.toLocaleString("id-ID")}` : "Rp 0 (Tidak diasuransikan)";
        const volStr = volP || volL || volT ? `${vol} cm` : "N/A";
        
        const output = `---
PENGIRIM: ${namaPengirim.trim()} (${hpPengirim.trim()}) - ${alamatPengirim.trim()}
PENERIMA: ${namaPenerima.trim()} (${hpPenerima.trim()}) - ${alamatPenerima.trim()}
PAKET: ${namaBarang.trim()} | ${photoStatus} | ${beratKg} KG | Vol: ${volStr} | ${formattedValStr}
---`;
        setClearingText(output);
      } else {
        const msg = response.message || "Gagal menyimpan data pre-input.";
        setFormError(msg);
        toast.error(msg);
      }
    } catch (err: any) {
      const msg = err.message || "Terjadi kesalahan saat menyimpan ke database.";
      setFormError(msg);
      toast.error(msg);
    }
  };

  // Clicking clearing box triggers auto-select and copy
  const handleClearingBoxClick = () => {
    if (clearingTextRef.current) {
      clearingTextRef.current.select();
      try {
        navigator.clipboard.writeText(clearingText);
        setCopiedNotification(true);
        setTimeout(() => setCopiedNotification(false), 2000);
      } catch (err) {
        // Fallback
      }
    }
  };

  // Reset form to write another client
  const handleResetForm = () => {
    setNamaPengirim("");
    setHpPengirim("");
    setAlamatPengirim("");
    setSelectedCustomerId(null);
    setNamaPenerima("");
    setHpPenerima("");
    setAlamatPenerima("");
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
  };

  const handleLanjutResi = () => {
    if (submittedTxId) {
      localStorage.setItem("pending_transaksi_id", submittedTxId);
      onNavigate("transaksi");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      
      {/* HEADER SECTION */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="bg-red-50 text-[#E4002B] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest font-mono">
              MODUL PENCATATAN AWAL
            </span>
            <h1 className="text-2xl font-bold text-gray-800 font-sans mt-2">
              Pre-Input Pelanggan & Paket
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Input data awal paket dan rapikan alamat dengan AI sebelum dicetak resi di outlet.
            </p>
          </div>

          {/* LOKASI TUGAS OVERRIDE */}
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex flex-col gap-1 sm:min-w-[240px]">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
              Lokasi Tugas Aktif:
            </span>
            <select
              value={activeOutletId}
              onChange={(e) => onChangeActiveOutlet(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg text-xs py-1.5 px-2.5 font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
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

      {formError && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-[#E4002B] rounded-r-xl flex items-start gap-2 text-red-800 text-sm animate-bounce">
          <AlertCircle className="h-5 w-5 shrink-0 text-[#E4002B] mt-0.5" />
          <div>
            <p className="font-semibold">Mohon Lengkapi Form</p>
            <p className="text-xs opacity-90 mt-0.5">{formError}</p>
          </div>
        </div>
      )}

      {/* RENDER CLEARING LAYAR / KOTAK KLIRING (IF SUCCESSFUL) */}
      {submittedTxId ? (
        <div className="bg-white rounded-2xl shadow-lg border border-green-100 p-6 sm:p-8 text-center animate-fade-in">
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
            Klik kotak kliring di bawah untuk menyalin otomatis seluruh ringkasan. Tempel ke WhatsApp pelanggan atau teruskan langsung ke outlet keuangan.
          </p>

          {/* Kotak Kliring Monospace */}
          <div className="mt-6 relative max-w-lg mx-auto">
            <textarea
              ref={clearingTextRef}
              readOnly
              onClick={handleClearingBoxClick}
              value={clearingText}
              className="w-full h-44 bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl p-4 font-mono text-xs text-gray-700 leading-relaxed cursor-pointer focus:outline-none resize-none shadow-inner transition-colors duration-200"
            />
            <div className="absolute bottom-3 right-3 bg-gray-900/80 text-white rounded-lg py-1 px-2.5 flex items-center gap-1.5 text-[10px] pointer-events-none">
              <Clipboard className="h-3.5 w-3.5" />
              <span>{copiedNotification ? "Tersalin!" : "Klik untuk Salin"}</span>
            </div>
          </div>

          {/* NAVIGATION BUTTONS */}
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4 max-w-lg mx-auto">
            <button
              onClick={handleResetForm}
              className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 font-semibold text-gray-700 rounded-xl transition duration-150 text-sm"
            >
              Input Pelanggan Baru
            </button>
            <button
              onClick={handleLanjutResi}
              className="flex-1 py-3 px-4 bg-[#E4002B] hover:bg-[#c20023] font-semibold text-white rounded-xl shadow-md shadow-red-500/10 flex items-center justify-center gap-2 transition duration-150 text-sm"
            >
              <span>Lanjut Input Resi & Finansial</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        /* RENDER PRIMARY INPUT FORM */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* LEFT COLUMN: SENDER FORM */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-2">
                <div className="bg-red-50 p-1.5 rounded-lg text-[#E4002B]">
                  <User className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-gray-800 text-sm">Data Pengirim</h3>
              </div>

              {/* Nama Pengirim dengan Suggestions */}
              <div className="relative" ref={suggestionContainerRef}>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Nama Pengirim <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
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
                        className="w-full text-left p-3 hover:bg-gray-50 text-xs transition-colors duration-150 flex flex-col gap-0.5"
                      >
                        <span className="font-bold text-gray-800">{cst.nama_pengirim}</span>
                        <span className="text-gray-500">{cst.no_hp} • {cst.alamat_pengirim.slice(0, 45)}...</span>
                      </button>
                    ))}
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
                  placeholder="Nama jalan, nomor rumah, RT/RW, desa/kelurahan, kecamatan, kab/kota, provinsi, kodepos."
                />
              </div>
            </div>

            {/* Riwayat Penerima untuk Pengirim Ini */}
            {selectedCustomerId && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-700">Riwayat Penerima</span>
                    <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono">
                      {riwayatPenerima.length}
                    </span>
                  </div>
                  {loadingHistory && <RefreshCw className="h-3 w-3 text-gray-400 animate-spin" />}
                </div>

                {riwayatPenerima.length > 0 ? (
                  <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto pr-1">
                    {riwayatPenerima.map((rec) => (
                      <button
                        key={rec.id}
                        type="button"
                        onClick={() => selectRecipientFromHistory(rec)}
                        className="w-full text-left py-2 hover:bg-gray-50 text-[11px] flex flex-col gap-0.5 group rounded px-1 transition-colors"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-gray-800 group-hover:text-[#E4002B]">{rec.nama_penerima}</span>
                          <span className="text-[9px] text-gray-400 font-mono">
                            {rec.tanggal_terakhir_kirim ? new Date(rec.tanggal_terakhir_kirim).toLocaleDateString("id-ID") : ""}
                          </span>
                        </div>
                        <span className="text-gray-500">{rec.no_hp_penerima} • {rec.alamat_penerima.slice(0, 50)}...</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-2 italic">
                    {loadingHistory ? "Sedang memuat riwayat..." : "Belum ada riwayat penerima terdaftar."}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: RECIPIENT & PACKAGE FORM */}
          <div className="space-y-6">
            
            {/* DATA PENERIMA */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-2">
                <div className="bg-red-50 p-1.5 rounded-lg text-[#E4002B]">
                  <User className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-gray-800 text-sm">Data Penerima</h3>
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
                    className="flex items-center gap-1 text-[11px] font-bold text-[#E4002B] hover:text-[#c20023] focus:outline-none bg-red-50 hover:bg-red-100 py-1 px-2.5 rounded-lg transition-colors cursor-pointer disabled:bg-gray-100 disabled:text-gray-400"
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
                  rows={3}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B] focus:border-[#E4002B] resize-none"
                  placeholder="Ketik alamat tidak rapi / acak di sini. Tekan tombol AI di atas untuk merapikan otomatis."
                />

                {aiNotice && (
                  <div className={`mt-2 p-2.5 rounded-lg text-xs flex items-start gap-1.5 ${
                    aiNotice.type === "success" 
                      ? "bg-green-50 text-green-800 border border-green-100" 
                      : "bg-amber-50 text-amber-900 border border-amber-100"
                  }`}>
                    <Sparkles className={`h-4 w-4 shrink-0 mt-0.5 ${aiNotice.type === "success" ? "text-green-600" : "text-amber-600"}`} />
                    <span>{aiNotice.text}</span>
                  </div>
                )}

                {suggestedAddress && (
                  <div className="mt-4 p-4 bg-amber-50/40 border border-amber-200/80 rounded-xl space-y-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="bg-amber-100 p-1 rounded-lg text-amber-700 animate-pulse">
                          <Sparkles className="h-3.5 w-3.5 fill-amber-500 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-800 tracking-wide">
                            Rekomendasi Alamat Rapih J&T AI
                          </p>
                          <p className="text-[10px] text-gray-500">
                            Struktur alamat telah dianalisis dan dirapikan otomatis oleh AI Asisten.
                          </p>
                        </div>
                      </div>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded uppercase tracking-wider shrink-0">
                        AI SUGGESTION
                      </span>
                    </div>
                    
                    <div className="bg-white p-3 rounded-lg border border-amber-100/80 text-xs text-gray-700 font-mono leading-relaxed shadow-inner break-words relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
                      <div className="pl-2">
                        {suggestedAddress}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1 border-t border-amber-100/50">
                      <div className="flex items-start gap-1 text-[10px] text-gray-500 leading-normal max-w-sm">
                        <span className="text-amber-600 font-bold shrink-0">Catatan:</span>
                        <span>Alamat asli Anda akan diarsipkan secara otomatis ke kolom <code className="bg-amber-100/60 px-1 rounded font-mono text-amber-800">alamat_asli</code> untuk audit / pembanding.</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyAiAddress}
                        className="w-full sm:w-auto py-2 px-4 bg-gradient-to-r from-[#E4002B] to-[#c20023] hover:from-[#c20023] hover:to-[#a0001c] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] cursor-pointer shrink-0"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Gunakan Alamat versi AI</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* DATA PAKET */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-2">
                <div className="bg-red-50 p-1.5 rounded-lg text-[#E4002B]">
                  <Clipboard className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-gray-800 text-sm">Data Paket</h3>
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
                  placeholder="Contoh: Sepatu Olahraga Nike, Dokumen, dll."
                />
              </div>

              {/* Berat & Volume Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Berat Aktual (KG)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={beratKg}
                      onChange={(e) => setBeratKg(e.target.value)}
                      className="w-full pl-3 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B] focus:border-[#E4002B]"
                      placeholder="0.0"
                    />
                    <div className="absolute right-3 inset-y-0 flex items-center text-xs text-gray-400 font-bold">
                      KG
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Volume Paket (P x L x T)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={volP}
                      onChange={(e) => setVolP(e.target.value)}
                      className="w-12 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-center text-gray-800 focus:ring-1 focus:ring-[#E4002B] focus:outline-none"
                      placeholder="P"
                    />
                    <span className="text-gray-400 text-xs">x</span>
                    <input
                      type="number"
                      value={volL}
                      onChange={(e) => setVolL(e.target.value)}
                      className="w-12 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-center text-gray-800 focus:ring-1 focus:ring-[#E4002B] focus:outline-none"
                      placeholder="L"
                    />
                    <span className="text-gray-400 text-xs">x</span>
                    <input
                      type="number"
                      value={volT}
                      onChange={(e) => setVolT(e.target.value)}
                      className="w-12 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-center text-gray-800 focus:ring-1 focus:ring-[#E4002B] focus:outline-none"
                      placeholder="T"
                    />
                    <span className="text-[10px] text-gray-400 font-bold ml-1">cm</span>
                  </div>
                </div>
              </div>

              {/* Nilai Barang (Asuransi) */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Nilai Barang (Harga Rp)
                </label>
                <div className="relative">
                  <div className="absolute left-3 inset-y-0 flex items-center text-gray-400 text-xs font-bold">
                    Rp
                  </div>
                  <input
                    type="text"
                    value={nilaiBarangRaw}
                    onChange={handleNilaiBarangChange}
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B] focus:border-[#E4002B]"
                    placeholder="Contoh: 150.000"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  Digunakan untuk perhitungan asuransi saat transaksi di sistem J&T.
                </p>
              </div>

              {/* Catatan Admin */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Catatan Admin (Internal) - Opsional
                </label>
                <textarea
                  value={catatanAdmin}
                  onChange={(e) => setCatatanAdmin(e.target.value)}
                  rows={2}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B] focus:border-[#E4002B] resize-none"
                  placeholder="Masukkan catatan admin (misal: perlu packing kayu tambahan, alamat di-update via AI, dll)"
                />
              </div>

              {/* CAMERA PHOTO CAPTURE */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Pengambilan Foto Bukti Paket (Hanya Kamera Langsung)
                </label>
                
                {/* Foto Paket */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Foto Fisik Paket
                    </span>
                    {fotoPaketUrl && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 text-[10px] font-bold rounded-full">
                        Selesai
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 leading-normal">
                    Ambil foto seluruh permukaan fisik paket sebagai bukti pendukung.
                  </p>
                  
                  <button
                    type="button"
                    onClick={() => cameraPaketInputRef.current?.click()}
                    disabled={uploadingFotoPaket}
                    className="w-full py-2.5 px-3 bg-white hover:bg-slate-50 disabled:bg-gray-100 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 transition duration-150 cursor-pointer shadow-sm"
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

                  {uploadingFotoPaket && (
                    <div className="flex items-center gap-2 justify-center text-[11px] text-gray-500 py-1">
                      <RefreshCw className="h-3 w-3 animate-spin text-[#E4002B]" />
                      <span>Mengunggah foto paket...</span>
                    </div>
                  )}

                  {fotoPaketUrl && (
                    <div className="p-1.5 bg-white border border-slate-200 rounded-lg flex items-center gap-2.5">
                      <img
                        src={fotoPaketUrl}
                        alt="Preview paket"
                        className="h-10 w-10 object-cover rounded border border-gray-200 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="overflow-hidden">
                        <p className="text-[11px] font-bold text-slate-800">Foto Tersimpan</p>
                        <p className="text-[9px] text-gray-500 truncate">{fotoPaketUrl}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* BUTTON SAVE */}
            <button
              onClick={handleSavePreInput}
              disabled={loading || uploadingFotoPaket}
              className="w-full py-4 bg-[#E4002B] hover:bg-[#c20023] disabled:bg-gray-400 text-white font-bold rounded-xl shadow-lg shadow-red-500/10 flex items-center justify-center gap-2 transition duration-150 cursor-pointer text-sm"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Sedang Menyimpan Pre-Input...</span>
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  <span>Simpan Data</span>
                </>
              )}
            </button>
          </div>

        </div>
      )}

      {/* Validasi Kualitas Foto Popup */}
      {showValidationPopup && validationPopupData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="bg-[#E4002B] px-6 py-4 text-white">
              <h3 className="text-lg font-bold tracking-tight">Validasi Kualitas Foto</h3>
              <p className="text-xs text-red-100 mt-0.5">
                {validationPopupData.type === "paket" ? "Verifikasi Foto Paket Fisik" : "Verifikasi Foto Kertas Resi"}
              </p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {validationPopupData.type === "resi" && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm space-y-1">
                  <span className="font-semibold text-orange-800 block text-xs uppercase tracking-wider">Hasil Deteksi Resi J&T</span>
                  <p className="text-base font-mono font-bold text-slate-900">
                    Resi: <span className="text-red-600 underline font-extrabold">{validationPopupData.detectedResiId || "TIDAK TERDETEKSI (Tetap Lanjut/Input Manual)"}</span>
                  </p>
                  {validationPopupData.extractedInfo && (
                    <div className="mt-2 pt-2 border-t border-orange-200 text-xs text-slate-700 space-y-1">
                      <div><span className="font-semibold">Pengirim:</span> {validationPopupData.extractedInfo.nama_pengirim || "-"}</div>
                      <div><span className="font-semibold">Penerima:</span> {validationPopupData.extractedInfo.nama_penerima || "-"}</div>
                      <div><span className="font-semibold">Barang:</span> {validationPopupData.extractedInfo.nama_barang || "-"}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Photo Preview */}
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
                  Apakah Foto {validationPopupData.type === "paket" ? "Paket" : "Resi"} terlihat jelas, terang, dan tidak buram?
                </p>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 px-6 py-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowValidationPopup(false);
                  setValidationPopupData(null);
                  toast.info("Silakan ambil ulang foto.");
                  if (validationPopupData.type === "paket") {
                    cameraPaketInputRef.current?.click();
                  } else {
                    cameraResiInputRef.current?.click();
                  }
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Buram / Retake
              </button>
              <button
                type="button"
                onClick={() => {
                  if (validationPopupData.type === "paket") {
                    setFotoPaketUrl(validationPopupData.previewUrl);
                    toast.success("Foto Paket berhasil disimpan!");
                  } else {
                    setFotoResiUrl(validationPopupData.previewUrl);
                    if (validationPopupData.extractedInfo) {
                      const ext = validationPopupData.extractedInfo;
                      if (ext.nama_pengirim) setNamaPengirim(ext.nama_pengirim);
                      if (ext.hp_pengirim) setHpPengirim(ext.hp_pengirim);
                      if (ext.alamat_pengirim) setAlamatPengirim(ext.alamat_pengirim);
                      if (ext.nama_penerima) setNamaPenerima(ext.nama_penerima);
                      if (ext.hp_penerima) setHpPenerima(ext.hp_penerima);
                      if (ext.alamat_penerima) setAlamatPenerima(ext.alamat_penerima);
                      if (ext.nama_barang) setNamaBarang(ext.nama_barang);
                      
                      if (ext.resi_id) {
                        localStorage.setItem("scanned_resi_id", ext.resi_id);
                      }
                    }
                    toast.success("Foto Resi berhasil disimpan & Data diekstrak!");
                  }
                  setShowValidationPopup(false);
                  setValidationPopupData(null);
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-[#E4002B] py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#c20023] transition-colors cursor-pointer"
              >
                Jelas & Simpan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
