import React, { useState, useEffect, useRef } from "react";
import { 
  Scan, AlertTriangle, ShieldCheck, HelpCircle, FileText, Landmark, Wallet, 
  ToggleLeft, ToggleRight, ArrowRight, CheckCircle, RefreshCw, Upload, Camera
} from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";
import useAppsScript from "../hooks/useAppsScript";
import { SessionData, Outlet, PreInputBackup } from "../types";
import { toast } from "../utils/toast";

interface TransaksiPageProps {
  session: SessionData;
  activeOutletId: string;
  onChangeActiveOutlet: (id: string) => void;
  outlets: Outlet[];
  onNavigate: (view: string) => void;
}

export default function TransaksiPage({
  session,
  activeOutletId,
  onChangeActiveOutlet,
  outlets,
  onNavigate
}: TransaksiPageProps) {
  const { callBackend, loading } = useAppsScript();

  // Load pending transaction
  const [pendingTxId, setPendingTxId] = useState<string | null>(null);
  const [preInputData, setPreInputData] = useState<PreInputBackup | null>(null);
  const [loadingPreInput, setLoadingPreInput] = useState(false);

  // Layout switcher
  const [jenisLayanan, setJenisLayanan] = useState<"Express" | "Cargo">("Express");

  // Scanner states
  const [resiId, setResiId] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [checkingResi, setCheckingResi] = useState(false);
  const [resiDuplicateError, setResiDuplicateError] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);

  // Common Financial inputs
  const [tipeProdukExp, setTipeProdukExp] = useState<"DOC" | "EZ" | "JSD" | "JND" | "ECO" | "HBO">("EZ");
  const [tipeProdukCrg, setTipeProdukCrg] = useState<"FastTrack" | "Motor">("FastTrack");

  // Motor Cargo details
  const [merkMotor, setMerkMotor] = useState("");
  const [ccMotor, setCcMotor] = useState("");
  const [tahunMotor, setTahunMotor] = useState("");
  const [kelengkapanMotor, setKelengkapanMotor] = useState<string[]>([]);
  const [kelengkapanLainnya, setKelengkapanLainnya] = useState("");

  // Cashier Pricing inputs (Express or Cargo base costs)
  const [biayaLainInput, setBiayaLainInput] = useState(""); // Only for Express. DOC auto Rp 1.000 & read-only
  const [biayaAsuransiInput, setBiayaAsuransiInput] = useState("");
  const [ongkirDasarInput, setOngkirDasarInput] = useState("");
  const [totalUangDibayarInput, setTotalUangDibayarInput] = useState("");
  const [metodeBayar, setMetodeBayar] = useState<"Tunai" | "QRIS" | "Transfer" | "Order by APP">("Tunai");

  // Upload proof of payment
  const [buktiBayarUrl, setBuktiBayarUrl] = useState("");
  const [uploadingBukti, setUploadingBukti] = useState(false);

  // Additional fees Surcharge group
  const [aktifkanBiayaTambahan, setAktifkanBiayaTambahan] = useState(false);
  const [biayaAmplopInput, setBiayaAmplopInput] = useState(""); // If DOC -> auto Rp 2.000 & read-only
  const [biayaPackingInput, setBiayaPackingInput] = useState("");
  const [metodeBayarTambahan, setMetodeBayarTambahan] = useState<"Tunai" | "QRIS" | "Transfer">("Tunai");
  const [buktiTambahanUrl, setBuktiTambahanUrl] = useState("");
  const [uploadingBuktiTambahan, setUploadingBuktiTambahan] = useState(false);

  // Submission results
  const [transactionSuccess, setTransactionSuccess] = useState(false);
  const [savedResiSummary, setSavedResiSummary] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Photos - Paket & Resi
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

  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);
  const cameraPaketInputRef = useRef<HTMLInputElement>(null);
  const cameraResiInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // 1. Recover pending pre-input from localstorage
  useEffect(() => {
    const pId = localStorage.getItem("pending_transaksi_id");
    if (pId) {
      setPendingTxId(pId);
      loadPreInputDetails(pId);
    }
  }, []);

  const loadPreInputDetails = async (txId: string) => {
    setLoadingPreInput(true);
    try {
      const response = await callBackend("getPreInput", { transaksi_id: txId });
      if (response.status === "success" && response.data) {
        setPreInputData(response.data);
        // Pre-fill fields where possible
        if (response.data.nilai_barang > 0) {
          // Auto estimate insurance (usually 0.2% of value, but we let user input, we can pre-seed with a simple calc)
          const insEstimate = Math.ceil(response.data.nilai_barang * 0.002);
          setBiayaAsuransiInput(insEstimate.toLocaleString("id-ID"));
        }
        // If package weight is high, suggest Cargo layout
        if (response.data.berat_kg >= 15) {
          setJenisLayanan("Cargo");
        }
        if (response.data.foto_paket_url) {
          setFotoPaketUrl(response.data.foto_paket_url);
        }
        if (response.data.foto_resi_url) {
          setFotoResiUrl(response.data.foto_resi_url);
        }
      }
    } catch (err) {
      console.error("Failed to load pre-input", err);
    } finally {
      setLoadingPreInput(false);
    }
  };

  // Remove pre-input filter to do manual entries
  const handleClearPreInputRef = () => {
    localStorage.removeItem("pending_transaksi_id");
    setPendingTxId(null);
    setPreInputData(null);
    setFotoPaketUrl("");
    setFotoResiUrl("");
  };

  // 2. Barcode scanner implementation
  useEffect(() => {
    if (!showScanner) {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => {
          console.error("Failed to clear html5-qrcode scanner", err);
        });
        scannerRef.current = null;
      }
      return;
    }

    setScanStatus("Menyiapkan kamera...");
    
    // Initialize scanner on the 'reader' element
    const scanner = new Html5QrcodeScanner(
      "reader",
      { 
        fps: 10, 
        qrbox: { width: 260, height: 180 },
        aspectRatio: 1.777778
      },
      /* verbose= */ false
    );
    
    scannerRef.current = scanner;

    scanner.render(
      async (decodedText) => {
        // Scan Success
        setResiId(decodedText);
        setScanStatus(`Resi terbaca: ${decodedText}`);
        setShowScanner(false);
        // Trigger duplicate verification automatically
        handleVerifyResi(decodedText);
      },
      (error) => {
        // Scan error is triggered frequently, we keep it silent or log simple message
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => {
          console.error("Failed to clear html5-qrcode scanner", err);
        });
        scannerRef.current = null;
      }
    };
  }, [showScanner]);

  // Verify unique resi to prevent fraud / duplicate bookings
  const handleVerifyResi = async (idToCheck: string) => {
    const id = idToCheck.trim().toUpperCase();
    if (!id) return;

    setCheckingResi(true);
    setResiDuplicateError(false);

    try {
      const response = await callBackend("checkDuplicateResi", { resi_id: id });
      if (response.status === "success") {
        if (response.isDuplicate) {
          setResiDuplicateError(true);
        } else {
          setResiDuplicateError(false);
        }
      }
    } catch (e) {
      console.error("Duplicate verification failed", e);
    } finally {
      setCheckingResi(false);
    }
  };

  // Auto-load scanned Resi ID from PreInput scanning
  useEffect(() => {
    const scanned = localStorage.getItem("scanned_resi_id");
    if (scanned) {
      setResiId(scanned.toUpperCase());
      handleVerifyResi(scanned);
      localStorage.removeItem("scanned_resi_id");
    }
  }, []);

  // Auto rules on DOC selected (Express)
  useEffect(() => {
    if (jenisLayanan === "Express") {
      if (tipeProdukExp === "DOC") {
        setBiayaLainInput("1.000"); // Auto Rp 1.000 & read-only
        if (aktifkanBiayaTambahan) {
          setBiayaAmplopInput("2.000"); // Auto Rp 2.000 & read-only for envelop cost
        }
      } else {
        setBiayaLainInput("");
        setBiayaAmplopInput("");
      }
    }
  }, [tipeProdukExp, jenisLayanan, aktifkanBiayaTambahan]);

  // CC limits or packing defaults for Motor
  useEffect(() => {
    if (jenisLayanan === "Cargo") {
      if (tipeProdukCrg === "Motor") {
        if (aktifkanBiayaTambahan) {
          // Packing cost default for motor is usually higher
          setBiayaPackingInput("50.000");
        }
      } else {
        setBiayaPackingInput("");
      }
    }
  }, [tipeProdukCrg, jenisLayanan, aktifkanBiayaTambahan]);

  // Utility to handle numeric string cleans
  const cleanNumber = (valStr: string): number => {
    return Number(valStr.replace(/\D/g, "")) || 0;
  };

  const formatThousandsInput = (valStr: string) => {
    const cleaned = valStr.replace(/\D/g, "");
    if (!cleaned) return "";
    return Number(cleaned).toLocaleString("id-ID");
  };

  // Core Financial Calculators (REAL TIME)
  const biayaLain = jenisLayanan === "Express" ? cleanNumber(biayaLainInput) : 0;
  const biayaAsuransi = cleanNumber(biayaAsuransiInput);
  const ongkirDasar = cleanNumber(ongkirDasarInput);

  // Biaya YoYi (for Express) or JTC (for Cargo)
  const biayaDasarLayanan = biayaLain + biayaAsuransi + ongkirDasar;

  const totalUangDibayarCustomer = cleanNumber(totalUangDibayarInput);
  const pembulatan = totalUangDibayarCustomer > 0 ? (totalUangDibayarCustomer - biayaDasarLayanan) : 0;

  // Surcharges
  const biayaAmplop = (aktifkanBiayaTambahan && jenisLayanan === "Express") ? cleanNumber(biayaAmplopInput) : 0;
  const biayaPacking = aktifkanBiayaTambahan ? cleanNumber(biayaPackingInput) : 0;
  const biayaTambahan = biayaAmplop + biayaPacking;

  // FINAL ALLOCATIONS
  const grandTotal = biayaDasarLayanan + pembulatan + biayaTambahan;
  const setoranKeOwner = biayaDasarLayanan + pembulatan;
  const kasOperasional = biayaTambahan;

  // Auto file-name generation and upload helper
  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>, isSurchargeProof: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formattedDate = new Date().toISOString().split("T")[0].replace(/-/g, ""); // YYYYMMDD
    const finalResiStr = resiId.trim() || "MOCK_RESI";

    // Auto-name per instructions: BB-YoYi_[Tanggal]_[NoResi] or BB-JTC_[Tanggal]_[NoResi] or BB-ADD_[Tanggal]_[NoResi]
    let generatedFileName = "";
    if (isSurchargeProof) {
      generatedFileName = `BB-ADD_${formattedDate}_${finalResiStr}`;
    } else {
      generatedFileName = `BB-${jenisLayanan === "Express" ? "YoYi" : "JTC"}_${formattedDate}_${finalResiStr}`;
    }

    if (isSurchargeProof) {
      setUploadingBuktiTambahan(true);
    } else {
      setUploadingBukti(true);
    }
    setFormError(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Str = reader.result as string;
        try {
          const response = await callBackend("uploadFile", {
            fileBase64: base64Str,
            fileName: generatedFileName,
            category: isSurchargeProof ? "BUKTI_ADD" : "BUKTI_BAYAR"
          });

          if (response.status === "success" && response.data) {
            if (isSurchargeProof) {
              setBuktiTambahanUrl(response.data);
            } else {
              setBuktiBayarUrl(response.data);
            }
          } else {
            setFormError(response.message || "Gagal mengunggah bukti bayar.");
          }
        } catch (err: any) {
          setFormError("Gagal mengunggah ke server: " + err.message);
        } finally {
          setUploadingBukti(false);
          setUploadingBuktiTambahan(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setFormError("Gagal membaca berkas: " + err.message);
      setUploadingBukti(false);
      setUploadingBuktiTambahan(false);
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
              body: JSON.stringify({ fileUrl: uploadedUrl, fileBase64: base64Str })
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

  const handleKelengkapanMotorChange = (item: string) => {
    if (kelengkapanMotor.includes(item)) {
      setKelengkapanMotor(kelengkapanMotor.filter((i) => i !== item));
    } else {
      setKelengkapanMotor([...kelengkapanMotor, item]);
    }
  };

  // Save Transaction Submission
  const handleSaveTransaksi = async () => {
    setFormError(null);

    // Hard validations
    if (!resiId.trim()) return setFormError("Nomor resi wajib diisi / discan terlebih dahulu!");
    if (resiDuplicateError) return setFormError("Resi sudah terdaftar! Masukkan resi lain.");
    if (ongkirDasar <= 0) return setFormError("Ongkir dasar wajib diisi!");
    if (totalUangDibayarCustomer <= 0) return setFormError("Total uang dibayar customer wajib diisi!");
    
    // Non-Cash payment verification
    if (metodeBayar !== "Tunai" && !buktiBayarUrl) {
      return setFormError(`Pembayaran '${metodeBayar}' wajib mengunggah bukti bayar!`);
    }

    if (aktifkanBiayaTambahan && metodeBayarTambahan !== "Tunai" && !buktiTambahanUrl) {
      return setFormError(`Pembayaran tambahan '${metodeBayarTambahan}' wajib mengunggah bukti tambahan!`);
    }

    // Cargo Motor validation
    if (jenisLayanan === "Cargo" && tipeProdukCrg === "Motor") {
      if (!merkMotor.trim()) return setFormError("Merk sepeda motor wajib diisi!");
    }

    // Assemble payload
    let finalKelengkapan = "";
    if (jenisLayanan === "Cargo" && tipeProdukCrg === "Motor") {
      let items = [...kelengkapanMotor];
      if (kelengkapanMotor.includes("Lainnya") && kelengkapanLainnya.trim()) {
        items = items.map((i) => i === "Lainnya" ? `Lainnya (${kelengkapanLainnya.trim()})` : i);
      }
      finalKelengkapan = items.join(", ");
    }

    const transactionData = {
      resi_id: resiId.trim().toUpperCase(),
      transaksi_id: pendingTxId || "",
      admin_id_pencatat: session.user_id,
      outlet_id_input: activeOutletId,
      tipe_produk: jenisLayanan === "Express" ? tipeProdukExp : tipeProdukCrg,
      
      // Cargo Motor specific attributes
      merk_motor: merkMotor || undefined,
      cc_motor: Number(ccMotor) || undefined,
      tahun_motor: Number(tahunMotor) || undefined,
      kelengkapan_motor: finalKelengkapan || undefined,

      biaya_lain: biayaLain,
      biaya_asuransi: biayaAsuransi,
      ongkir_dasar: ongkirDasar,
      biaya_yoyi: jenisLayanan === "Express" ? biayaDasarLayanan : 0,
      biaya_jtc: jenisLayanan === "Cargo" ? biayaDasarLayanan : 0,
      total_dibayar_customer: totalUangDibayarCustomer,
      pembulatan: pembulatan,
      metode_bayar: metodeBayar,
      bukti_bayar_url: buktiBayarUrl,

      // Additional costs Surcharge group
      biaya_amplop: biayaAmplop,
      biaya_packing: biayaPacking,
      metode_bayar_tambahan: aktifkanBiayaTambahan ? metodeBayarTambahan : "",
      bukti_tambahan_url: aktifkanBiayaTambahan ? buktiTambahanUrl : "",

      grand_total: grandTotal,
      setoran_ke_owner: setoranKeOwner,
      kas_operasional: kasOperasional,
      foto_paket_url: fotoPaketUrl || undefined,
      foto_resi_url: fotoResiUrl || undefined
    };

    try {
      const response = await callBackend("saveTransaksi", {
        jenis_layanan: jenisLayanan,
        data: transactionData
      });

      if (response.status === "success") {
        toast.success("Transaksi berhasil disimpan dan diselesaikan!");
        setTransactionSuccess(true);
        setSavedResiSummary(resiId.trim().toUpperCase());
        localStorage.removeItem("pending_transaksi_id"); // Clear reference
      } else {
        const msg = response.message || "Gagal menyimpan transaksi.";
        setFormError(msg);
        toast.error(msg);
      }
    } catch (e: any) {
      const msg = e.message || "Terjadi kesalahan koneksi saat menyimpan transaksi.";
      setFormError(msg);
      toast.error(msg);
    }
  };

  // Reset page to receive another
  const handleNextTransaction = () => {
    setTransactionSuccess(false);
    setSavedResiSummary(null);
    setResiId("");
    setPreInputData(null);
    setPendingTxId(null);
    setBiayaLainInput("");
    setBiayaAsuransiInput("");
    setOngkirDasarInput("");
    setTotalUangDibayarInput("");
    setMetodeBayar("Tunai");
    setBuktiBayarUrl("");
    setAktifkanBiayaTambahan(false);
    setBiayaAmplopInput("");
    setBiayaPackingInput("");
    setMetodeBayarTambahan("Tunai");
    setBuktiTambahanUrl("");
    setFotoPaketUrl("");
    setFotoResiUrl("");
    setMerkMotor("");
    setCcMotor("");
    setTahunMotor("");
    setKelengkapanMotor([]);
    setKelengkapanLainnya("");
    setResiDuplicateError(false);
    setFormError(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">

      {/* HEADER SECTION */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="bg-red-50 text-[#E4002B] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest font-mono">
              MODUL KEUANGAN & RESI
            </span>
            <h1 className="text-2xl font-bold text-gray-800 font-sans mt-2">
              Kalkulator Finansial & Input Resi
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Scan barcode resi J&T, validasi duplikat, hitung pembulatan bayar, dan pisahkan setoran owner harian.
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
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-[#E4002B] rounded-r-xl flex items-start gap-2 text-red-800 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[#E4002B] mt-0.5" />
          <div>
            <p className="font-semibold">Kesalahan Validasi</p>
            <p className="text-xs opacity-90 mt-0.5">{formError}</p>
          </div>
        </div>
      )}

      {/* RENDER TRANSACTION SUCCESS SCREEN */}
      {transactionSuccess ? (
        <div className="bg-white rounded-2xl shadow-lg border border-green-100 p-8 text-center animate-fade-in max-w-lg mx-auto">
          <div className="mx-auto bg-green-50 text-green-600 rounded-full h-16 w-16 flex items-center justify-center mb-4">
            <CheckCircle className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">
            Transaksi Resi Tersimpan!
          </h2>
          <p className="text-xs text-green-600 font-mono font-bold mt-1">
            RESI: {savedResiSummary}
          </p>
          
          <div className="my-6 p-4 bg-gray-50 rounded-xl border border-gray-100 text-left text-xs space-y-2">
            <div className="flex justify-between border-b border-gray-100 pb-1.5 text-gray-500 font-semibold">
              <span>Rincian Finansial</span>
              <span>Alokasi Dana</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Dibayar Customer:</span>
              <span className="font-bold text-gray-800">Rp {totalUangDibayarCustomer.toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between text-blue-600">
              <span>Wajib Setor ke Owner:</span>
              <span className="font-bold">Rp {setoranKeOwner.toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span>Kas Operasional Outlet:</span>
              <span className="font-bold">Rp {kasOperasional.toLocaleString("id-ID")}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleNextTransaction}
              className="py-3 bg-[#E4002B] hover:bg-[#c20023] font-semibold text-white rounded-xl shadow-md cursor-pointer transition duration-150 text-sm"
            >
              Proses Transaksi Baru
            </button>
            <button
              onClick={() => onNavigate("dashboard")}
              className="py-3 bg-gray-100 hover:bg-gray-200 font-semibold text-gray-700 rounded-xl transition duration-150 text-sm"
            >
              Lihat Dashboard Owner
            </button>
          </div>
        </div>
      ) : (
        /* RENDER TRANSACTION CALCULATOR FORM */
        <div className="space-y-6">

          {/* 1. DETEKSI PRE-INPUT COMPONENT CARD */}
          {pendingTxId && preInputData ? (
            <div className="bg-red-50/50 rounded-2xl border border-red-100 p-4 sm:p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <span className="animate-ping h-2.5 w-2.5 bg-[#E4002B] rounded-full inline-block shrink-0"></span>
                  <p className="text-xs font-bold text-[#E4002B] uppercase font-mono tracking-wider">
                    Terhubung Pre-Input Aktif: {pendingTxId}
                  </p>
                </div>
                <button
                  onClick={handleClearPreInputRef}
                  className="text-[10px] font-bold text-gray-400 hover:text-red-700 uppercase tracking-widest bg-white py-1 px-2.5 rounded-lg border border-gray-200 cursor-pointer"
                >
                  Lepas Filter Pre-Input
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-gray-700 bg-white p-3 rounded-xl border border-gray-100">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Pengirim</p>
                  <p className="font-bold text-gray-800 mt-0.5">{preInputData.nama_pengirim}</p>
                  <p className="text-gray-500 text-[11px]">{preInputData.hp_pengirim}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Penerima</p>
                  <p className="font-bold text-gray-800 mt-0.5">{preInputData.nama_penerima}</p>
                  <p className="text-gray-500 text-[11px] truncate" title={preInputData.alamat_penerima}>{preInputData.alamat_penerima}</p>
                  {preInputData.alamat_penerima_asli && (
                    <p className="text-[9px] text-amber-600 italic truncate mt-0.5" title={`Alamat Asli: ${preInputData.alamat_penerima_asli}`}>
                      Asli: {preInputData.alamat_penerima_asli}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Paket</p>
                  <p className="font-bold text-gray-800 mt-0.5 truncate">{preInputData.nama_barang}</p>
                  <p className="text-gray-500 text-[11px] font-mono">{preInputData.berat_kg} KG | {preInputData.volume} cm</p>
                </div>
              </div>
              {preInputData.catatan_admin && (
                <div className="mt-2.5 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 flex items-start gap-2">
                  <div className="font-bold uppercase tracking-wider text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono shrink-0 mt-0.5">
                    Catatan Admin
                  </div>
                  <div className="font-medium">{preInputData.catatan_admin}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 text-center text-xs text-gray-500">
              💡 Belum memilih Pre-Input pelanggan. Menjalankan mode input loket langsung (Direct Entry). 
              Anda bisa memilih untuk pre-input data pelanggan terlebih dahulu di halaman Pre-Input.
            </div>
          )}

          {/* MAIN GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* LEFT COLUMN: SCAN & CALCULATIONS */}
            <div className="space-y-6">

              {/* SECTION: SCAN BARCODE */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-1">
                  <div className="flex items-center gap-2">
                    <div className="bg-red-50 p-1.5 rounded-lg text-[#E4002B]">
                      <Scan className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold text-gray-800 text-sm">Scan Resi Barcode</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowScanner(!showScanner)}
                    className="text-xs font-bold text-[#E4002B] hover:text-[#c20023] bg-red-50 py-1 px-2.5 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>{showScanner ? "Tutup Scanner" : "Mulai Kamera Scan"}</span>
                  </button>
                </div>

                {/* Html5Qrcode Scanner Target div */}
                {showScanner && (
                  <div className="space-y-2 border border-gray-100 rounded-xl p-3 bg-gray-50 overflow-hidden">
                    <div id="reader" className="w-full"></div>
                    {scanStatus && (
                      <p className="text-[10px] text-center font-mono font-bold text-gray-500 animate-pulse">
                        {scanStatus}
                      </p>
                    )}
                  </div>
                )}

                {/* Resi Manual/Scanned Input */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Nomor Resi J&T <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={resiId}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setResiId(val);
                        // verify duplicates
                        handleVerifyResi(val);
                      }}
                      className={`w-full px-3 py-2.5 bg-gray-50 border rounded-xl text-sm font-mono tracking-wider text-gray-800 focus:outline-none focus:ring-1 ${
                        resiDuplicateError 
                          ? "border-red-400 focus:ring-red-500 focus:border-red-500 bg-red-50" 
                          : "border-gray-200 focus:ring-[#E4002B] focus:border-[#E4002B]"
                      }`}
                      placeholder="CONTOH: JT12345678901 / JTC98765432101"
                    />
                    {checkingResi && (
                      <div className="absolute right-3 inset-y-0 flex items-center">
                        <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* DUPLICATE WARNING */}
                  {resiDuplicateError && (
                    <div className="mt-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-1.5 animate-bounce">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-[#E4002B] mt-0.5" />
                      <div>
                        <p className="font-bold">⚠️ RESI SUDAH TERDAFTAR — Kemungkinan duplikat/fraud</p>
                        <p className="text-[10px] opacity-90 mt-0.5">
                          Nomor resi ini sudah tersimpan di database (EXP_Resi atau CRG_Resi). Silakan periksa barcode resi fisik kembali.
                        </p>
                      </div>
                    </div>
                  )}

                  {!resiDuplicateError && resiId.trim() && !checkingResi && (
                    <div className="mt-2 text-[10px] text-green-600 font-bold flex items-center gap-1 font-mono">
                      <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                      <span>Resi valid & siap diproses (Anti-Fraud Aman)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* DUAL CAMERA PHOTO CAPTURE */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-1">
                  <div className="bg-[#E4002B]/10 p-1.5 rounded-lg text-[#E4002B]">
                    <Camera className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">Foto Bukti Paket & Resi</h3>
                    <p className="text-[10px] text-gray-400">Ambil foto fisik paket & kertas resi J&T</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 1. Foto Paket */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                        1. Foto Fisik Paket
                      </span>
                      {fotoPaketUrl && (
                        <span className="px-1.5 py-0.5 bg-green-100 text-green-800 text-[9px] font-bold rounded-full">
                          Selesai
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 leading-normal">
                      Ambil foto seluruh permukaan fisik paket sebagai bukti pendukung.
                    </p>
                    
                    <button
                      type="button"
                      onClick={() => cameraPaketInputRef.current?.click()}
                      disabled={uploadingFotoPaket || analyzingResi}
                      className="w-full py-2 px-3 bg-white hover:bg-slate-50 disabled:bg-gray-100 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition duration-150 cursor-pointer shadow-sm"
                    >
                      <Camera className="h-3.5 w-3.5 text-[#E4002B]" />
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
                      <div className="flex items-center gap-2 justify-center text-[10px] text-gray-500 py-1">
                        <RefreshCw className="h-3 w-3 animate-spin text-[#E4002B]" />
                        <span>Mengunggah...</span>
                      </div>
                    )}

                    {fotoPaketUrl && (
                      <div className="p-1 bg-white border border-slate-200 rounded-lg flex items-center gap-2">
                        <img
                          src={fotoPaketUrl}
                          alt="Preview paket"
                          className="h-8 w-8 object-cover rounded border border-gray-200 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="overflow-hidden">
                          <p className="text-[10px] font-bold text-slate-800">Tersimpan</p>
                          <p className="text-[8px] text-gray-500 truncate">{fotoPaketUrl}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Foto Resi */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                        2. Foto Kertas Resi
                      </span>
                      {fotoResiUrl && (
                        <span className="px-1.5 py-0.5 bg-green-100 text-green-800 text-[9px] font-bold rounded-full">
                          Selesai
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 leading-normal">
                      Scan kertas resi yang dicetak untuk deteksi nomor resi & auto-fill.
                    </p>
                    
                    <button
                      type="button"
                      onClick={() => cameraResiInputRef.current?.click()}
                      disabled={uploadingFotoResi || analyzingResi}
                      className="w-full py-2 px-3 bg-white hover:bg-slate-50 disabled:bg-gray-100 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition duration-150 cursor-pointer shadow-sm"
                    >
                      <Camera className="h-3.5 w-3.5 text-orange-600" />
                      <span>
                        {analyzingResi ? "AI Membaca..." : uploadingFotoResi ? "Mengunggah..." : "Ambil Foto Resi (AI)"}
                      </span>
                    </button>

                    <input
                      type="file"
                      ref={cameraResiInputRef}
                      onChange={handleResiFileChange}
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                    />

                    {(uploadingFotoResi || analyzingResi) && (
                      <div className="flex items-center gap-2 justify-center text-[10px] text-gray-500 py-1">
                        <RefreshCw className="h-3 w-3 animate-spin text-orange-500" />
                        <span>{analyzingResi ? "AI Membaca..." : "Mengunggah..."}</span>
                      </div>
                    )}

                    {fotoResiUrl && (
                      <div className="p-1 bg-white border border-slate-200 rounded-lg flex items-center gap-2">
                        <img
                          src={fotoResiUrl}
                          alt="Preview resi"
                          className="h-8 w-8 object-cover rounded border border-gray-200 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="overflow-hidden">
                          <p className="text-[10px] font-bold text-orange-800">Tersimpan</p>
                          <p className="text-[8px] text-gray-500 truncate">{fotoResiUrl}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* FINANCIAL CALCULATORS FOR SERVICE CATEGORY */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                
                {/* Switcher & Tugas Dropdown */}
                <div className="flex gap-4 items-center border-b border-gray-100 pb-3 mb-2">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Jenis Layanan
                    </label>
                    <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                      <button
                        type="button"
                        onClick={() => setJenisLayanan("Express")}
                        className={`flex-1 text-center py-1.5 px-2 text-xs font-semibold rounded-lg cursor-pointer transition-all duration-150 ${
                          jenisLayanan === "Express" ? "bg-[#E4002B] text-white shadow" : "text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        Express
                      </button>
                      <button
                        type="button"
                        onClick={() => setJenisLayanan("Cargo")}
                        className={`flex-1 text-center py-1.5 px-2 text-xs font-semibold rounded-lg cursor-pointer transition-all duration-150 ${
                          jenisLayanan === "Cargo" ? "bg-[#E4002B] text-white shadow" : "text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        Cargo
                      </button>
                    </div>
                  </div>
                </div>

                {/* EXPRESS LAYOUT INPUTS */}
                {jenisLayanan === "Express" ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          Tipe Produk
                        </label>
                        <select
                          value={tipeProdukExp}
                          onChange={(e) => setTipeProdukExp(e.target.value as any)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl text-xs py-2.5 px-3 font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
                        >
                          <option value="EZ">EZ (Reguler)</option>
                          <option value="DOC">DOC (Dokumen)</option>
                          <option value="JSD">JSD (Same Day)</option>
                          <option value="JND">JND (Next Day)</option>
                          <option value="ECO">ECO (Ekonomi)</option>
                          <option value="HBO">HBO (High-Value)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          Biaya Lain-lain (Rp)
                        </label>
                        <input
                          type="text"
                          disabled={tipeProdukExp === "DOC"}
                          value={biayaLainInput}
                          onChange={(e) => setBiayaLainInput(formatThousandsInput(e.target.value))}
                          className="w-full px-3 py-2 bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* CARGO LAYOUT INPUTS (including Motor detailed check) */
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          Tipe Produk Cargo
                        </label>
                        <select
                          value={tipeProdukCrg}
                          onChange={(e) => setTipeProdukCrg(e.target.value as any)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl text-xs py-2.5 px-3 font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
                        >
                          <option value="FastTrack">FastTrack (Cargo Kilat)</option>
                          <option value="Motor">Motor (Kirim Kendaraan)</option>
                        </select>
                      </div>
                    </div>

                    {tipeProdukCrg === "Motor" && (
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3 animate-fade-in">
                        <p className="text-[10px] font-bold text-[#E4002B] uppercase tracking-wider font-mono">
                          Detail Surcharge Pengiriman Motor
                        </p>
                        
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1">Merk Motor</label>
                            <input
                              type="text"
                              value={merkMotor}
                              onChange={(e) => setMerkMotor(e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded p-1.5 text-xs text-gray-800 focus:outline-none"
                              placeholder="Honda, Yamaha, dll"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1">CC Motor</label>
                            <input
                              type="number"
                              value={ccMotor}
                              onChange={(e) => setCcMotor(e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded p-1.5 text-xs text-gray-800 focus:outline-none"
                              placeholder="150"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1">Tahun Motor</label>
                            <input
                              type="number"
                              value={tahunMotor}
                              onChange={(e) => setTahunMotor(e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded p-1.5 text-xs text-gray-800 focus:outline-none"
                              placeholder="2024"
                            />
                          </div>
                        </div>

                        {/* Checklist Kelengkapan */}
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-1">
                            Kelengkapan Motor (Multi-Pilih):
                          </label>
                          <div className="grid grid-cols-2 gap-1.5 mt-1 text-[11px] text-gray-700">
                            {["Kunci motor", "STNK", "BPKB", "Helm", "Lainnya"].map((item) => (
                              <label key={item} className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={kelengkapanMotor.includes(item)}
                                  onChange={() => handleKelengkapanMotorChange(item)}
                                  className="accent-[#E4002B] rounded"
                                />
                                <span>{item}</span>
                              </label>
                            ))}
                          </div>

                          {kelengkapanMotor.includes("Lainnya") && (
                            <input
                              type="text"
                              value={kelengkapanLainnya}
                              onChange={(e) => setKelengkapanLainnya(e.target.value)}
                              className="w-full mt-2 bg-white border border-gray-200 rounded p-1.5 text-xs text-gray-800 focus:outline-none"
                              placeholder="Sebutkan kelengkapan tambahan lainnya"
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Base price entry (Asuransi and Ongkir Dasar) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Biaya Asuransi (Rp)
                    </label>
                    <input
                      type="text"
                      value={biayaAsuransiInput}
                      onChange={(e) => setBiayaAsuransiInput(formatThousandsInput(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Ongkir Dasar (Rp) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={ongkirDasarInput}
                      onChange={(e) => setOngkirDasarInput(formatThousandsInput(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* REAL TIME OUTPUTS */}
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center text-xs">
                  <span className="font-semibold text-gray-600">
                    Total {jenisLayanan === "Express" ? "Biaya YoYi" : "Biaya JTC"} (Base):
                  </span>
                  <span className="font-bold text-gray-800 text-sm">
                    Rp {biayaDasarLayanan.toLocaleString("id-ID")}
                  </span>
                </div>

                {/* Uang Dibayar & Pembulatan */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Dibayar Customer (Rp) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={totalUangDibayarInput}
                      onChange={(e) => setTotalUangDibayarInput(formatThousandsInput(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 font-bold focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
                      placeholder="Contoh: 15.000"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Pembulatan / Lebih (Rp)
                    </label>
                    <div className="w-full px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-xs font-mono font-bold text-gray-600">
                      Rp {pembulatan.toLocaleString("id-ID")}
                    </div>
                  </div>
                </div>

                {/* Metode Bayar & Upload Bukti Non-Tunai */}
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Metode Pembayaran
                    </label>
                    <select
                      value={metodeBayar}
                      onChange={(e) => setMetodeBayar(e.target.value as any)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl text-xs py-2.5 px-3 font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
                    >
                      <option value="Tunai">Tunai (Cash)</option>
                      <option value="QRIS">QRIS Barcode</option>
                      <option value="Transfer">Transfer Bank</option>
                      <option value="Order by APP">Order by APP (Aplikasi J&T)</option>
                    </select>
                  </div>

                  {metodeBayar !== "Tunai" && (
                    <div className="bg-red-50/40 p-3.5 rounded-xl border border-red-100/50 space-y-2.5 animate-fade-in">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-red-800">
                          Wajib Upload Bukti {metodeBayar}
                        </span>
                        <span className="text-[9px] font-mono font-bold text-gray-400">
                          File: BB-{jenisLayanan === "Express" ? "YoYi" : "JTC"}_[Tgl]_[Resi]
                        </span>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => fileInputRef1.current?.click()}
                        disabled={uploadingBukti}
                        className="w-full py-2 bg-white hover:bg-gray-50 disabled:bg-gray-100 rounded-lg border border-dashed border-gray-300 text-xs font-semibold text-gray-600 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="h-4 w-4 text-[#E4002B]" />
                        <span>{uploadingBukti ? "Mengunggah..." : "Pilih / Ambil Foto Bukti"}</span>
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef1}
                        onChange={(e) => handleUploadProof(e, false)}
                        accept="image/*"
                        className="hidden"
                      />

                      {buktiBayarUrl && (
                        <div className="p-2 bg-white border border-gray-100 rounded-lg flex items-center gap-2">
                          <img src={buktiBayarUrl} alt="bukti" className="h-10 w-10 object-cover rounded" />
                          <span className="text-[10px] text-green-700 font-bold truncate">{buktiBayarUrl}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>

            </div>

            {/* RIGHT COLUMN: SURCHARGES & GRAND TOTALS */}
            <div className="space-y-6">

              {/* SECTION: SURCHARGE PACKING & AMPOULOPES (ADDITIONAL FEES) */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-1">
                  <div className="flex items-center gap-2">
                    <div className="bg-red-50 p-1.5 rounded-lg text-[#E4002B]">
                      <Wallet className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 text-sm">Grup Biaya Tambahan</h3>
                      <p className="text-[10px] text-gray-400">Kas operasional independen loket.</p>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setAktifkanBiayaTambahan(!aktifkanBiayaTambahan)}
                    className="focus:outline-none cursor-pointer"
                  >
                    {aktifkanBiayaTambahan ? (
                      <ToggleRight className="h-9 w-9 text-[#E4002B]" />
                    ) : (
                      <ToggleLeft className="h-9 w-9 text-gray-300" />
                    )}
                  </button>
                </div>

                {aktifkanBiayaTambahan ? (
                  <div className="space-y-4 animate-fade-in">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          Biaya Amplop (Rp)
                        </label>
                        <input
                          type="text"
                          disabled={jenisLayanan === "Express" && tipeProdukExp === "DOC"}
                          value={biayaAmplopInput}
                          onChange={(e) => setBiayaAmplopInput(formatThousandsInput(e.target.value))}
                          className="w-full px-3 py-2 bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          Biaya Packing (Rp)
                        </label>
                        <input
                          type="text"
                          value={biayaPackingInput}
                          onChange={(e) => setBiayaPackingInput(formatThousandsInput(e.target.value))}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          Metode Bayar Tambahan
                        </label>
                        <select
                          value={metodeBayarTambahan}
                          onChange={(e) => setMetodeBayarTambahan(e.target.value as any)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl text-xs py-2 px-3 font-semibold text-gray-700 focus:outline-none"
                        >
                          <option value="Tunai">Tunai</option>
                          <option value="QRIS">QRIS</option>
                          <option value="Transfer">Transfer</option>
                        </select>
                      </div>

                      {metodeBayarTambahan !== "Tunai" && (
                        <div className="bg-red-50/40 p-3 rounded-xl border border-red-100/50 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-bold text-red-800">Bukti Tambahan</span>
                            <span className="text-[9px] font-mono text-gray-400">File: BB-ADD_...</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => fileInputRef2.current?.click()}
                            disabled={uploadingBuktiTambahan}
                            className="w-full py-2 bg-white hover:bg-gray-50 rounded-lg border border-dashed border-gray-300 text-xs font-semibold text-gray-600 flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Upload className="h-4 w-4 text-[#E4002B]" />
                            <span>{uploadingBuktiTambahan ? "Mengunggah..." : "Pilih Bukti"}</span>
                          </button>
                          <input
                            type="file"
                            ref={fileInputRef2}
                            onChange={(e) => handleUploadProof(e, true)}
                            accept="image/*"
                            className="hidden"
                          />

                          {buktiTambahanUrl && (
                            <div className="p-2 bg-white border border-gray-100 rounded-lg flex items-center gap-2">
                              <img src={buktiTambahanUrl} alt="bukti" className="h-10 w-10 object-cover rounded" />
                              <span className="text-[10px] text-green-700 font-bold truncate">{buktiTambahanUrl}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic text-center py-2">
                    Biaya tambahan (Amplop & Packing) dinonaktifkan. Seluruh biaya dibebankan ke pos setoran owner.
                  </p>
                )}
              </div>

              {/* GRAND TOTALS & ALLOCATION STATS */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-2">
                  <div className="bg-red-50 p-1.5 rounded-lg text-[#E4002B]">
                    <Landmark className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold text-gray-800 text-sm">Alokasi & Grand Total</h3>
                </div>

                {/* Grand Total Show */}
                <div className="p-4 bg-gray-900 rounded-xl text-center text-white space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 font-mono">
                    Grand Total Tagihan Customer
                  </span>
                  <p className="text-3xl font-extrabold text-[#E4002B] font-mono">
                    Rp {grandTotal.toLocaleString("id-ID")}
                  </p>
                </div>

                {/* Split cards */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Setoran Owner Card */}
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-1">
                    <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider block">
                      Wajib Setor ke Owner
                    </span>
                    <p className="text-sm font-extrabold text-blue-800 font-mono">
                      Rp {setoranKeOwner.toLocaleString("id-ID")}
                    </p>
                    <span className="text-[9px] text-blue-500 block">
                      YoYi/JTC + Pembulatan
                    </span>
                  </div>

                  {/* Kas Operasional Card */}
                  <div className="p-3 bg-green-50 border border-green-100 rounded-xl space-y-1">
                    <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider block">
                      Kas Operasional Outlet
                    </span>
                    <p className="text-sm font-extrabold text-green-800 font-mono">
                      Rp {kasOperasional.toLocaleString("id-ID")}
                    </p>
                    <span className="text-[9px] text-green-500 block">
                      Amplop + Packing
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleSaveTransaksi}
                  disabled={loading || checkingResi || resiDuplicateError}
                  className="w-full py-4 bg-[#E4002B] hover:bg-[#c20023] disabled:bg-gray-400 text-white font-bold rounded-xl shadow-lg shadow-red-500/10 flex items-center justify-center gap-2 transition duration-150 cursor-pointer text-sm"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      <span>Sedang Menyimpan Transaksi...</span>
                    </>
                  ) : (
                    <>
                      <span>Simpan & Selesaikan Transaksi</span>
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
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
            {/* Header */}
            <div className="bg-slate-950 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold tracking-tight">Validasi Kualitas Foto</h3>
                <p className="text-xs text-slate-400">
                  {validationPopupData.type === "paket" ? "Verifikasi Foto Paket Fisik" : "Verifikasi Foto Kertas Resi"}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center">
                <img
                  src={validationPopupData.previewUrl}
                  alt="Validation Preview"
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              {validationPopupData.type === "resi" && validationPopupData.detectedResiId && (
                <div className="p-3 bg-orange-50 border border-orange-100 rounded-xl space-y-1">
                  <p className="text-xs font-bold text-orange-800 uppercase tracking-wider">AI Hasil Deteksi Resi J&T:</p>
                  <p className="text-sm font-mono font-bold text-slate-800">{validationPopupData.detectedResiId}</p>
                </div>
              )}

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
                      if (ext.resi_id) {
                        const rId = ext.resi_id.trim().toUpperCase();
                        setResiId(rId);
                        handleVerifyResi(rId);
                        toast.success(`Foto Resi berhasil disimpan! No Resi J&T terdeteksi: ${rId}`);
                      } else {
                        toast.success("Foto Resi berhasil disimpan!");
                      }
                    } else {
                      toast.success("Foto Resi berhasil disimpan!");
                    }
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
