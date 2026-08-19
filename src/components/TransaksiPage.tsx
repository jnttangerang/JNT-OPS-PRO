import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Scan, AlertTriangle, ShieldCheck, HelpCircle, FileText, Landmark, Wallet, 
  ToggleLeft, ToggleRight, ArrowRight, CheckCircle, RefreshCw, Upload, Camera,
  Lock, ArrowLeft, ChevronLeft, ChevronRight, Layers, CornerDownLeft, Check,
  Pencil, Trash2, History, ExternalLink, Clock, Download
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { format } from "date-fns";
import useAppsScript from "../hooks/useAppsScript";
import { SessionData, Outlet, PreInputBackup } from "../types";
import { toast } from "../utils/toast";
import { calculateWeight } from "../utils/weightCalculator";
import { getDisplayImageUrl } from "../utils/image";
import AddressBookDrawer from "./AddressBookDrawer";
import ImportYoYiModal, { YoYiImportQueueItem, YoYiParsedData } from "./ImportYoYiModal";

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
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [preInputData, setPreInputData] = useState<PreInputBackup | null>(null);
  const [loadingPreInput, setLoadingPreInput] = useState(false);

  
  // YoYi Import State
  const [isYoYiModalOpen, setIsYoYiModalOpen] = useState(false);
  const [yoyiQueue, setYoyiQueue] = useState<YoYiImportQueueItem[]>([]);
  
  useEffect(() => {
    const saved = localStorage.getItem("yoyi_import_queue");
    if (saved) {
      try { setYoyiQueue(JSON.parse(saved)); } catch(e) {}
    }
  }, []);

  const updateYoyiQueue = (newQ: YoYiImportQueueItem[]) => {
    setYoyiQueue(newQ);
    localStorage.setItem("yoyi_import_queue", JSON.stringify(newQ));
  };

  const handleAddYoYiToQueue = (item: YoYiImportQueueItem) => {
    if (yoyiQueue.length >= 20) {
      toast.error("Antrian penuh. Hapus draft terlebih dahulu.");
      return;
    }
    updateYoyiQueue([...yoyiQueue, item]);
  };

  const handleRemoveYoYi = (id: string) => {
    updateYoyiQueue(yoyiQueue.filter(q => q.queue_id !== id));
  };

  const handleClearAllYoYi = () => {
    if (window.confirm("Hapus semua draft antrian YoYi?")) {
      updateYoyiQueue([]);
      toast.info("Antrian draft YoYi telah dikosongkan.");
    }
  };

  const handleApplyYoYiToForm = async (parsed: YoYiParsedData) => {
    // 1. Set layanan & tipe produk
    setJenisLayanan("Express");
    setTipeProdukExp(parsed.tipe_produk || "EZ");

    // 2. Set resi & berat & dimensi
    const resiNum = (parsed.nomor_resi || "").trim().toUpperCase();
    setResiId(resiNum);
    setBeratKg(parsed.berat_kg ? parsed.berat_kg.toString() : "1");
    setVolP("");
    setVolL("");
    setVolT("");

    // 3. Set biaya
    setOngkirDasarInput(parsed.ongkir_dasar ? parsed.ongkir_dasar.toString() : "0");
    setBiayaAsuransiInput(parsed.asuransi ? parsed.asuransi.toString() : "0");
    setBiayaLainInput(parsed.biaya_lain ? parsed.biaya_lain.toString() : "0");

    // 4. Set metode bayar (DFOD detection)
    if (parsed.metode_perhitungan && parsed.metode_perhitungan.toUpperCase().includes("DFOD")) {
      setMetodeBayar("DFOD");
      setTotalUangDibayarInput("0");
    } else {
      setMetodeBayar("Tunai");
      const totalCost = Number(parsed.total_yoyi) || (Number(parsed.ongkir_dasar) + Number(parsed.asuransi) + Number(parsed.biaya_lain));
      setTotalUangDibayarInput(totalCost > 0 ? totalCost.toString() : "");
    }

    const txId = "PRE-YY-" + Math.floor(Date.now() / 1000) + "-" + Math.random().toString(36).substring(2, 5);

    // 5. Extract sender, receiver, and item name with support for all property aliases
    const parsedAny = parsed as any;
    const rawSender = (parsed.nama_pengirim || parsedAny.pengirim || parsedAny.shipper || parsedAny.sender || "").trim();
    const rawReceiver = (parsed.nama_penerima || parsedAny.penerima || parsedAny.consignee || parsedAny.receiver || "").trim();
    const rawItem = (parsed.nama_barang || parsedAny.deskripsi_barang || parsedAny.isi_paket || parsedAny.barang || parsedAny.item_name || parsedAny.komoditi || "").trim();

    const senderHp = (parsed.no_hp_pengirim || parsedAny.hp_pengirim || parsedAny.telepon_pengirim || parsedAny.telp_pengirim || "").trim();
    const senderAddress = (parsed.alamat_pengirim || parsedAny.address_pengirim || "").trim();
    const receiverHp = (parsed.no_hp_penerima || parsedAny.hp_penerima || parsedAny.telepon_penerima || parsedAny.telp_penerima || "").trim();
    const receiverAddress = (parsed.alamat_penerima || parsedAny.address_penerima || "").trim();

    // Do not fall back to generic placeholders if parsed data exists
    const senderName = rawSender || "Umum";
    const receiverName = rawReceiver || "Umum";
    const itemName = rawItem || "Paket";

    const syntheticPreInput: PreInputBackup = {
      transaksi_id: txId,
      timestamp: new Date().toISOString(),
      admin_id: session?.user_id || session?.username || "ADMIN",
      outlet_id_tugas: activeOutletId || "OUT-001",
      nama_pengirim: senderName,
      hp_pengirim: senderHp,
      alamat_pengirim: senderAddress,
      nama_penerima: receiverName,
      hp_penerima: receiverHp,
      alamat_penerima: receiverAddress,
      ekspedisi: "Express",
      berat_kg: Number(parsed.berat_kg) || 1,
      volume: "0 x 0 x 0",
      nama_barang: itemName,
      nilai_barang: 0,
      status: "PENDING",
      catatan_admin: `Import YoYi (${parsed.source_order || "YoYi App"})`,
      foto_paket_url: "",
      foto_resi_url: "",
      no_resi: resiNum
    };
    setPreInputData(syntheticPreInput);
    setPendingTxId(txId);
    localStorage.setItem("pending_transaksi_id", txId);

    // Also persist pre-input draft to backend so it's safely in db
    try {
      await callBackend("savePreInput", {
        transaksi_id: txId,
        admin_id: session?.user_id || "ADMIN",
        outlet_id_tugas: activeOutletId || "OUT-001",
        nama_pengirim: senderName,
        hp_pengirim: senderHp,
        alamat_pengirim: senderAddress,
        nama_penerima: receiverName,
        hp_penerima: receiverHp,
        alamat_penerima: receiverAddress,
        nama_barang: itemName,
        berat_kg: Number(parsed.berat_kg) || 1,
        volume: "0 x 0 x 0",
        nilai_barang: 0,
        ekspedisi: "Express",
        no_resi: resiNum,
        is_draft: true
      });
    } catch (err) {
      console.warn("Auto-save YoYi preInput draft warning:", err);
    }

    // 6. Check duplicate resi
    if (resiNum) {
      callBackend("checkDuplicateResi", { resi_id: resiNum })
        .then((res) => {
          if (res?.isDuplicate) {
            setDuplicateWarning(res.message || "Nomor resi ini sudah pernah diinput sebelumnya!");
          } else {
            setDuplicateWarning(null);
          }
        })
        .catch(() => {});
    }

    // 7. Scroll ke atas form
    window.scrollTo({ top: 0, behavior: "smooth" });

    toast.success(`Data YoYi (${resiNum}) berhasil diisi ke form. Lengkapi foto & pembayaran, lalu simpan.`);
  };

  // Draft Queue State
  const [draftQueue, setDraftQueue] = useState<PreInputBackup[]>([]);
  const [activeDraftIndex, setActiveDraftIndex] = useState<number>(0);

  // Layout switcher
  const [jenisLayanan, setJenisLayanan] = useState<"Express" | "Cargo">("Express");

  // Weight / Dimensions (Manual Input or Synced from Pre-Input)
  const [beratKg, setBeratKg] = useState("0");
  const [volP, setVolP] = useState("");
  const [volL, setVolL] = useState("");
  const [volT, setVolT] = useState("");
  const [sysConfig, setSysConfig] = useState<any>(null);

  useEffect(() => {
    callBackend("getAllSettings")
      .then((res) => {
        if (res?.data?.systemSettings) setSysConfig(res.data.systemSettings);
      })
      .catch(console.error);
  }, [callBackend]);

  const calculatedWeight = calculateWeight(
    parseFloat(beratKg) || 0,
    parseFloat(volP) || 0,
    parseFloat(volL) || 0,
    parseFloat(volT) || 0,
    jenisLayanan,
    sysConfig?.divisor_express || 6000,
    sysConfig?.divisor_cargo || 5000
  );

  // Scanner & Camera States
  const [resiId, setResiId] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [checkingResi, setCheckingResi] = useState(false);
  const [resiDuplicateError, setResiDuplicateError] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  
  const [initialCameraStep, setInitialCameraStep] = useState<1 | 2>(1);
  const [cameraStep, setCameraStep] = useState<1 | 2>(1);
  const cameraStepRef = useRef<1 | 2>(1);
  const layananRef = useRef<HTMLDivElement>(null);

  const startCamera = (step: 1 | 2 = 1) => {
    setInitialCameraStep(step);
    setShowScanner(true);
  };

  useEffect(() => {
    cameraStepRef.current = cameraStep;
  }, [cameraStep]);

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
  const [metodeBayar, setMetodeBayar] = useState<"Tunai" | "QRIS" | "Transfer" | "Order by APP" | "DFOD">("Tunai");

  // Upload proof of payment
  const [buktiBayarUrl, setBuktiBayarUrl] = useState("");
  const [uploadingBukti, setUploadingBukti] = useState(false);

  // Additional fees Surcharge group
  const [aktifkanBiayaTambahan, setAktifkanBiayaTambahan] = useState(true);
  const [biayaAmplopInput, setBiayaAmplopInput] = useState(""); // If DOC -> auto Rp 2.000
  const [biayaPackingInput, setBiayaPackingInput] = useState("");
  const [metodeBayarTambahan, setMetodeBayarTambahan] = useState<"Tunai" | "QRIS" | "Transfer">("Tunai");
  const [buktiTambahanUrl, setBuktiTambahanUrl] = useState("");
  const [uploadingBuktiTambahan, setUploadingBuktiTambahan] = useState(false);

  // Submission results
  const [transactionSuccess, setTransactionSuccess] = useState(false);
  const [savedResiSummary, setSavedResiSummary] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Photos - Paket & Resi
  const resiInputRef = useRef<HTMLInputElement>(null);
  const [fotoPaketUrl, setFotoPaketUrl] = useState("");
  const [fotoResiUrl, setFotoResiUrl] = useState("");
  const [fotoPaketBlob, setFotoPaketBlob] = useState<Blob | null>(null);
  const [fotoResiBlob, setFotoResiBlob] = useState<Blob | null>(null);
  const [fotoPaketPreview, setFotoPaketPreview] = useState("");
  const [fotoResiPreview, setFotoResiPreview] = useState("");
  const [uploadingFotoPaket, setUploadingFotoPaket] = useState(false);
  const [uploadingFotoResi, setUploadingFotoResi] = useState(false);

  const [successSheet, setSuccessSheet] = useState<{ resi: string; total: number } | null>(null);
  const [countdown, setCountdown] = useState(5);

  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);
  const fileInputPaketRef = useRef<HTMLInputElement>(null);
  const fileInputResiRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);


  const handlePasteImage = (e: React.ClipboardEvent, type: "paket" | "resi") => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const previewUrl = URL.createObjectURL(file);
          if (type === "paket") {
            if (fotoPaketPreview) URL.revokeObjectURL(fotoPaketPreview);
            setFotoPaketBlob(file);
            setFotoPaketPreview(previewUrl);
            setFotoPaketUrl("");
            toast.success("Gambar paket dipaste dari clipboard");
          } else {
            if (fotoResiPreview) URL.revokeObjectURL(fotoResiPreview);
            setFotoResiBlob(file);
            setFotoResiPreview(previewUrl);
            setFotoResiUrl("");
            toast.success("Gambar resi dipaste dari clipboard");
          }
        }
        break;
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "paket" | "resi") => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    if (type === "paket") {
      if (fotoPaketPreview) URL.revokeObjectURL(fotoPaketPreview);
      setFotoPaketBlob(file);
      setFotoPaketPreview(previewUrl);
      setFotoPaketUrl("");
      toast.success("Foto fisik paket berhasil dipilih");
    } else {
      if (fotoResiPreview) URL.revokeObjectURL(fotoResiPreview);
      setFotoResiBlob(file);
      setFotoResiPreview(previewUrl);
      setFotoResiUrl("");
      toast.success("Foto resi paket berhasil dipilih");
    }
    e.target.value = "";
  };

  // Fetch Queue of Drafts
  const fetchQueue = useCallback(async () => {
    try {
      const res = await callBackend("getPreInputDrafts", { outlet_id: activeOutletId });
      if (res && res.status === "success" && Array.isArray(res.data)) {
        const pendingList = res.data.filter((d: any) => 
          (d.status === "SIAP_DIBAYAR" || d.status === "PENDING" || d.status === "INPUT_YOYI" || d.status === "INPUT_JTC") &&
          d.status !== "SELESAI" && d.status !== "Dibatalkan"
        );
        setDraftQueue(pendingList);

        const pId = localStorage.getItem("pending_transaksi_id");
        if (pId) {
          const idx = pendingList.findIndex((d: any) => d.transaksi_id === pId);
          if (idx !== -1) {
            setActiveDraftIndex(idx);
          }
        }
      }
    } catch (err) {
      console.error("Gagal mengambil antrean draft:", err);
    }
  }, [callBackend, activeOutletId]);

  // Fetch Recent Activity / Riwayat Transaksi List
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState<boolean>(false);

  const fetchRecentActivities = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const res = await callBackend("getRiwayatTransaksi", { filterOutlet: activeOutletId });
      if (res && res.status === "success" && Array.isArray(res.data)) {
        setRecentActivities(res.data.slice(0, 5));
      }
    } catch (err) {
      console.error("Gagal mengambil riwayat transaksi terbaru:", err);
    } finally {
      setLoadingRecent(false);
    }
  }, [callBackend, activeOutletId]);

  useEffect(() => {
    fetchQueue();
    fetchRecentActivities();
  }, [fetchQueue, fetchRecentActivities]);

  useEffect(() => {
    if (successSheet) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          setSuccessSheet(null);
          handleNextTransaction();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setSuccessSheet(null);
          onNavigate("dashboard");
        }
      };
      window.addEventListener("keydown", handleKeyDown);

      const interval = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(interval);
            setSuccessSheet(null);
            handleNextTransaction();
            return 0;
          }
          return c - 1;
        });
      }, 1000);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        clearInterval(interval);
      };
    }
  }, [successSheet, onNavigate]);

  useEffect(() => {
    return () => {
      if (fotoPaketPreview) URL.revokeObjectURL(fotoPaketPreview);
      if (fotoResiPreview) URL.revokeObjectURL(fotoResiPreview);
    };
  }, [fotoPaketPreview, fotoResiPreview]);

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
      if (response && response.status === "success" && response.data) {
        const data = response.data;
        setPreInputData(data);
        if (data.ekspedisi) setJenisLayanan(data.ekspedisi);
        else if (data.berat_kg >= 15) setJenisLayanan("Cargo");

        setBeratKg(data.berat_timbangan?.toString() || data.berat_kg?.toString() || "0");
        setVolP(data.panjang_cm?.toString() || "");
        setVolL(data.lebar_cm?.toString() || "");
        setVolT(data.tinggi_cm?.toString() || "");

        // Pre-fill fields where possible
        if (data.nilai_barang > 0) {
          const insEstimate = Math.ceil(data.nilai_barang * 0.002);
          setBiayaAsuransiInput(insEstimate.toLocaleString("id-ID"));
        }
        if (data.no_resi) {
          setResiId(data.no_resi);
        } else {
          const storedResi = localStorage.getItem("pending_no_resi");
          if (storedResi) {
            setResiId(storedResi);
            localStorage.removeItem("pending_no_resi");
          }
        }
        if (data.foto_paket_url) {
          setFotoPaketUrl(data.foto_paket_url);
        }
        if (response.data.foto_resi_url) {
          setFotoResiUrl(response.data.foto_resi_url);
        }
      } else {
        localStorage.removeItem("pending_transaksi_id");
        setPendingTxId(null);
        setPreInputData(null);
      }
    } catch (err) {
      console.error("Failed to load pre-input", err);
      localStorage.removeItem("pending_transaksi_id");
      setPendingTxId(null);
      setPreInputData(null);
    } finally {
      setLoadingPreInput(false);
    }
  };

  // Select a draft index in the queue
  const handleSelectDraftIndex = (index: number) => {
    if (index < 0 || index >= draftQueue.length) return;
    const target = draftQueue[index];
    if (!target) return;

    setActiveDraftIndex(index);
    setPendingTxId(target.transaksi_id);
    localStorage.setItem("pending_transaksi_id", target.transaksi_id);
    loadPreInputDetails(target.transaksi_id);
    toast.info(`Membuka Draft (${index + 1}/${draftQueue.length}): ${target.transaksi_id}`);
  };

  const handleGoToNextDraft = () => {
    if (activeDraftIndex < draftQueue.length - 1) {
      handleSelectDraftIndex(activeDraftIndex + 1);
    } else {
      toast.info("Sudah berada di draft paling akhir dalam antrean.");
    }
  };

  const handleGoToPrevDraft = () => {
    if (activeDraftIndex > 0) {
      handleSelectDraftIndex(activeDraftIndex - 1);
    } else {
      toast.info("Sudah berada di draft pertama dalam antrean.");
    }
  };

  // Remove pre-input filter to do manual entries
  const handleClearPreInputRef = () => {
    localStorage.removeItem("pending_transaksi_id");
    setPendingTxId(null);
    setPreInputData(null);
    if (fotoPaketPreview) URL.revokeObjectURL(fotoPaketPreview);
    if (fotoResiPreview) URL.revokeObjectURL(fotoResiPreview);
    setFotoPaketPreview("");
    setFotoResiPreview("");
    setFotoPaketBlob(null);
    setFotoResiBlob(null);
    setFotoPaketUrl("");
    setFotoResiUrl("");
  };

  // 2. Barcode & Camera implementation
  const capturePhoto = async (type: "paket" | "resi", decodedResiId?: string) => {
    const video = document.querySelector("#reader video") as HTMLVideoElement;
    if (!video) {
      toast.error("Kamera tidak ditemukan.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;

      const previewUrl = URL.createObjectURL(blob);

      if (type === "paket") {
        if (fotoPaketPreview) URL.revokeObjectURL(fotoPaketPreview);
        setFotoPaketBlob(blob);
        setFotoPaketPreview(previewUrl); 
        setFotoPaketUrl(""); 
      } else {
        if (fotoResiPreview) URL.revokeObjectURL(fotoResiPreview);
        setFotoResiBlob(blob);
        setFotoResiPreview(previewUrl); 
        setFotoResiUrl(""); 
      }
      
      toast.success(`Foto ${type} berhasil ditangkap`);
    }, "image/jpeg", 0.8);
  };

  const stopCameraTracks = () => {
    const video = document.querySelector("#reader video") as HTMLVideoElement;
    if (video && video.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
  };

  useEffect(() => {
    if (!showScanner) {
      if (scannerRef.current) {
        const currentScanner = scannerRef.current;
        currentScanner.stop().then(() => {
          currentScanner.clear();
          stopCameraTracks();
        }).catch(err => {
          console.error("Failed to clear html5-qrcode scanner", err);
          currentScanner.clear();
          stopCameraTracks();
        });
        scannerRef.current = null;
      }
      return;
    }

    setCameraStep(initialCameraStep);
    if (initialCameraStep === 1) {
      setScanStatus("STEP 1: Foto fisik paket");
    } else {
      setScanStatus("STEP 2: Arahkan ke barcode resi");
    }
    
    // Initialize scanner on the 'reader' element
    const scanner = new Html5Qrcode("reader");
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: "environment" },
      { 
        fps: 10, 
        qrbox: { width: 260, height: 180 },
        aspectRatio: 1.777778
      },
      async (decodedText) => {
        if (cameraStepRef.current === 1) return; // Ignore barcodes in step 1
        
        // Scan Success in STEP 2
        setResiId(decodedText);
        setScanStatus(`Resi terbaca: ${decodedText}`);
        
        // auto capture resi
        await capturePhoto("resi", decodedText);
        
        setShowScanner(false);
        // Trigger duplicate verification automatically
        handleVerifyResi(decodedText);
        setTimeout(() => {
          layananRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      },
      (error) => {
        // Scan error is triggered frequently, we keep it silent or log simple message
      }
    ).catch(err => {
      console.error("Failed to start scanner", err);
      toast.error("Gagal membuka kamera. Periksa izin kamera.");
    });

    return () => {
      if (scannerRef.current) {
        const currentScanner = scannerRef.current;
        currentScanner.stop().then(() => {
          currentScanner.clear();
          stopCameraTracks();
        }).catch(err => {
          console.error("Failed to clear html5-qrcode scanner", err);
          currentScanner.clear();
          stopCameraTracks();
        });
        scannerRef.current = null;
      }
    };
  }, [showScanner]);

  // Verify unique resi to prevent fraud / duplicate bookings
  const handleVerifyResi = async (idToCheck: string) => {
    const id = (idToCheck || "").trim().toUpperCase();
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
        setBiayaLainInput("1.000"); // Auto Rp 1.000
        if (aktifkanBiayaTambahan) {
          setBiayaAmplopInput("2.000"); // Auto Rp 2.000
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
  const cleanNumber = (valStr: any): number => {
    return Number(String(valStr || "").replace(/\D/g, "")) || 0;
  };

  const formatThousandsInput = (valStr: any) => {
    const cleaned = String(valStr || "").replace(/\D/g, "");
    if (!cleaned) return "";
    return Number(cleaned).toLocaleString("id-ID");
  };

  // Core Financial Calculators (REAL TIME)
  const biayaLain = jenisLayanan === "Express" ? cleanNumber(biayaLainInput) : 0;
  const biayaAsuransi = cleanNumber(biayaAsuransiInput);
  const ongkirDasar = cleanNumber(ongkirDasarInput);

  // Biaya YoYi (for Express) or JTC (for Cargo)
  const biayaDasarLayanan = biayaLain + biayaAsuransi + ongkirDasar;
  const biayaDitagihkanLayanan = metodeBayar === "DFOD" ? 0 : biayaDasarLayanan;

  const totalUangDibayarCustomer = cleanNumber(totalUangDibayarInput);
  const pembulatan = totalUangDibayarCustomer > 0 ? (totalUangDibayarCustomer - biayaDitagihkanLayanan) : 0;

  // Surcharges
  const biayaAmplop = (aktifkanBiayaTambahan && jenisLayanan === "Express") ? cleanNumber(biayaAmplopInput) : 0;
  const biayaPacking = aktifkanBiayaTambahan ? cleanNumber(biayaPackingInput) : 0;
  const biayaTambahan = biayaAmplop + biayaPacking;

  // FINAL ALLOCATIONS
  const grandTotal = biayaDitagihkanLayanan + pembulatan + biayaTambahan;
  const setoranKeOwner = biayaDitagihkanLayanan + pembulatan;
  const kasOperasional = biayaTambahan;

  // Phase 15.2 - Lock Field & Step Validations
  const isLockedFromDraft = Boolean(pendingTxId && preInputData);

  const stepFotoPaket = Boolean(fotoPaketUrl || fotoPaketPreview);
  const stepFotoResi = Boolean(fotoResiUrl || fotoResiPreview);
  const stepBarcode = Boolean(resiId && resiId.trim() && !resiDuplicateError);
  const stepProdukYoYi = Boolean(
    (jenisLayanan === "Express" ? tipeProdukExp : tipeProdukCrg) && ongkirDasar > 0
  );
  const stepPembayaran = Boolean(
    (metodeBayar === "DFOD" ? (totalUangDibayarCustomer >= 0) : (totalUangDibayarCustomer >= biayaDasarLayanan && totalUangDibayarCustomer > 0)) &&
    (metodeBayar === "Tunai" || metodeBayar === "DFOD" || Boolean(buktiBayarUrl || fotoResiUrl || fotoResiPreview))
  );

  const isAllStepsValid = stepFotoPaket && stepFotoResi && stepBarcode && stepProdukYoYi && stepPembayaran;

  // Auto file-name generation and upload helper
  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>, isSurchargeProof: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formattedDate = new Date().toISOString().split("T")[0].replace(/-/g, ""); // YYYYMMDD
    const finalResiStr = (resiId || "").trim() || "MOCK_RESI";

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

  const handleKelengkapanMotorChange = (item: string) => {
    if (kelengkapanMotor.includes(item)) {
      setKelengkapanMotor(kelengkapanMotor.filter((i) => i !== item));
    } else {
      setKelengkapanMotor([...kelengkapanMotor, item]);
    }
  };

  const toBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // Save Transaction Submission
  const handleSaveTransaksi = async () => {
    setFormError(null);

    // Hard validations
    if (!stepFotoPaket) return setFormError("Foto Paket wajib ada sebelum menyimpan transaksi!");
    if (!stepFotoResi) return setFormError("Foto Resi wajib ada sebelum menyimpan transaksi!");
    if (!(resiId || "").trim()) return setFormError("Nomor resi wajib diisi / discan terlebih dahulu!");
    if (resiDuplicateError) return setFormError("Nomor resi sudah terdaftar (EXP_Resi/CRG_Resi). Gunakan resi baru.");

    // Pre-flight fresh duplicate verification
    try {
      const dupCheck = await callBackend("checkDuplicateResi", { resi_id: (resiId || "").trim().toUpperCase() });
      if (dupCheck && dupCheck.status === "success" && dupCheck.isDuplicate) {
        setResiDuplicateError(true);
        setFormError("⚠️ NOMOR RESI SUDAH TERDAFTAR — Kemungkinan duplikat/fraud. Silakan ganti dengan resi lain.");
        toast.error("Nomor resi sudah terdaftar!");
        return;
      }
    } catch (e) {
      console.warn("Pre-flight duplicate check warning:", e);
    }

    if (ongkirDasar <= 0) return setFormError("Ongkir dasar wajib diisi!");
    if (metodeBayar !== "DFOD" && totalUangDibayarCustomer <= 0) return setFormError("Total uang dibayar customer wajib diisi!");
    
    // Non-Cash payment verification
    if (metodeBayar !== "Tunai" && metodeBayar !== "DFOD" && !buktiBayarUrl) {
      return setFormError(`Pembayaran '${metodeBayar}' wajib mengunggah bukti bayar!`);
    }

    if (aktifkanBiayaTambahan && metodeBayarTambahan !== "Tunai" && !buktiTambahanUrl) {
      return setFormError(`Pembayaran tambahan '${metodeBayarTambahan}' wajib mengunggah bukti tambahan!`);
    }

    // Cargo Motor validation
    if (jenisLayanan === "Cargo" && tipeProdukCrg === "Motor") {
      if (!(merkMotor || "").trim()) return setFormError("Merk sepeda motor wajib diisi!");
    }

    // Assemble payload
    let finalKelengkapan = "";
    if (jenisLayanan === "Cargo" && tipeProdukCrg === "Motor") {
      let items = [...kelengkapanMotor];
      if (kelengkapanMotor.includes("Lainnya") && (kelengkapanLainnya || "").trim()) {
        items = items.map((i) => i === "Lainnya" ? `Lainnya (${(kelengkapanLainnya || "").trim()})` : i);
      }
      finalKelengkapan = items.join(", ");
    }

    // Upload Blob photos if they exist in memory
    let finalFotoPaketUrl = fotoPaketUrl;
    let finalFotoResiUrl = fotoResiUrl;

    if (fotoPaketBlob || fotoResiBlob) {
      const formattedDate = new Date().toISOString().split("T")[0].replace(/-/g, "");
      const resiPrefix = (resiId || "").trim() || `TMP_${Date.now()}`;

      try {
        if (fotoPaketBlob) {
          setUploadingFotoPaket(true);
          const b64 = await toBase64(fotoPaketBlob);
          const response = await callBackend("uploadFile", {
            fileBase64: b64,
            fileName: `FOTO_PAKET_${formattedDate}_${resiPrefix}`,
            category: "FOTO_PAKET"
          });
          if (response.status === "success" && response.data) {
            finalFotoPaketUrl = response.data;
            setFotoPaketUrl(response.data); // cache the remote URL
            setFotoPaketBlob(null); // free up the blob so we don't upload again
          }
        }

        if (fotoResiBlob) {
          setUploadingFotoResi(true);
          const b64 = await toBase64(fotoResiBlob);
          const response = await callBackend("uploadFile", {
            fileBase64: b64,
            fileName: `FOTO_RESI_${formattedDate}_${resiPrefix}`,
            category: "FOTO_RESI"
          });
          if (response.status === "success" && response.data) {
            finalFotoResiUrl = response.data;
            setFotoResiUrl(response.data);
            setFotoResiBlob(null);
          }
        }
      } catch (err: any) {
        setFormError("Gagal mengunggah foto saat menyimpan transaksi.");
        toast.error("Gagal mengunggah foto.");
        setUploadingFotoPaket(false);
        setUploadingFotoResi(false);
        return;
      }
      setUploadingFotoPaket(false);
      setUploadingFotoResi(false);
    }

    // Customer / Snapshot - Preserve active sender, receiver, and item name
    const currentResiUpper = (resiId || "").trim().toUpperCase();
    const matchingYoyi = yoyiQueue.find(
      (y) =>
        (y.resi || "").trim().toUpperCase() === currentResiUpper ||
        (y.parsed_data?.nomor_resi || "").trim().toUpperCase() === currentResiUpper
    );
    const activeSender = (preInputData?.nama_pengirim || matchingYoyi?.parsed_data?.nama_pengirim || "").trim();
    const activeSenderHp = (preInputData?.hp_pengirim || matchingYoyi?.parsed_data?.no_hp_pengirim || "").trim();
    const activeSenderAddr = (preInputData?.alamat_pengirim || matchingYoyi?.parsed_data?.alamat_pengirim || "").trim();

    const activeReceiver = (preInputData?.nama_penerima || matchingYoyi?.parsed_data?.nama_penerima || "").trim();
    const activeReceiverHp = (preInputData?.hp_penerima || matchingYoyi?.parsed_data?.no_hp_penerima || "").trim();
    const activeReceiverAddr = (preInputData?.alamat_penerima || matchingYoyi?.parsed_data?.alamat_penerima || "").trim();

    const activeItem = (preInputData?.nama_barang || matchingYoyi?.parsed_data?.nama_barang || "").trim();

    const now = new Date();
    const transactionData = {
      tanggal_transaksi: format(now, "yyyy-MM-dd"),
      jam_transaksi: format(now, "HH:mm"),
      resi_id: (resiId || "").trim().toUpperCase(),
      transaksi_id: pendingTxId || preInputData?.transaksi_id || ("TRX-YY-" + Math.floor(Date.now() / 1000) + "-" + Math.random().toString(36).substring(2, 5)),
      admin_id_pencatat: session.user_id,
      outlet_id_input: activeOutletId,
      activeOutletId: activeOutletId,
      outlet_id: activeOutletId,
      tipe_produk: jenisLayanan === "Express" ? tipeProdukExp : tipeProdukCrg,
      
      // Weight & Volume
      ekspedisi: jenisLayanan,
      berat_timbangan: Number(beratKg) || 0,
      panjang_cm: Number(volP) || 0,
      lebar_cm: Number(volL) || 0,
      tinggi_cm: Number(volT) || 0,
      berat_kg: calculatedWeight.berat_penagihan,
      volume: (Number(volP) * Number(volL) * Number(volT)).toString(),

      // Cargo Motor specific attributes
      merk_motor: merkMotor || undefined,
      cc_motor: Number(ccMotor) || undefined,
      tahun_motor: Number(tahunMotor) || undefined,
      kelengkapan_motor: finalKelengkapan || undefined,

      biaya_lain: biayaLain,
      ongkir_dasar: ongkirDasar,
      biaya_asuransi: biayaAsuransi,
      biaya_yoyi: jenisLayanan === "Express" ? biayaDasarLayanan : 0,
      biaya_jtc: jenisLayanan === "Cargo" ? biayaDasarLayanan : 0,

      // Explicit payment & surcharge fields
      metode_bayar: metodeBayar,
      metode_pembayaran_ongkir: metodeBayar,
      bukti_bayar_url: buktiBayarUrl,

      biaya_amplop: biayaAmplop,
      biayaAmplop: biayaAmplop,
      amplop: biayaAmplop,
      biaya_packing: biayaPacking,
      biayaPacking: biayaPacking,
      packing: biayaPacking,
      metode_pembayaran_tambahan: aktifkanBiayaTambahan ? metodeBayarTambahan : "",
      metode_bayar_tambahan: aktifkanBiayaTambahan ? metodeBayarTambahan : "",
      bukti_tambahan_url: aktifkanBiayaTambahan ? buktiTambahanUrl : "",

      jumlah_dibayar_customer: totalUangDibayarCustomer,
      total_dibayar_customer: totalUangDibayarCustomer,
      pembulatan: pembulatan,

      grand_total: grandTotal,
      setoran_ke_owner: setoranKeOwner,
      kas_operasional: kasOperasional,
      kas_outlet: kasOperasional,
      foto_paket_url: finalFotoPaketUrl || undefined,
      foto_resi_url: finalFotoResiUrl || undefined,

      // Customer / Snapshot
      nama_pengirim: activeSender || "Umum",
      hp_pengirim: activeSenderHp,
      alamat_pengirim: activeSenderAddr,
      nama_penerima: activeReceiver || "Umum",
      hp_penerima: activeReceiverHp,
      alamat_penerima: activeReceiverAddr,
      nama_barang: activeItem || "Paket"
    };

    try {
      const response = await callBackend("saveTransaksi", {
        jenis_layanan: jenisLayanan,
        data: transactionData
      });

      if (response.status === "success") {
        toast.success("Transaksi berhasil disimpan dan diselesaikan!");
        // Remove local pre-input reference
        localStorage.removeItem("pending_transaksi_id"); 
        
        // Refresh Recent Activity and Draft Queue immediately
        fetchRecentActivities();
        fetchQueue();

        // Show success sheet instead of immediate reset
        setSuccessSheet({ resi: (resiId || "").trim().toUpperCase(), total: grandTotal });
        setCountdown(5);
      } else {
        const msg = response.message || "Gagal menyimpan transaksi.";
        if (msg.includes("RESI SUDAH TERDAFTAR") || msg.includes("duplikat")) {
          setResiDuplicateError(true);
        }
        setFormError(msg);
        toast.error(msg);
      }
    } catch (e: any) {
      const msg = e.message || "Terjadi kesalahan koneksi saat menyimpan transaksi.";
      if (msg.includes("RESI SUDAH TERDAFTAR") || msg.includes("duplikat")) {
        setResiDuplicateError(true);
      }
      setFormError(msg);
      toast.error(msg);
    }
  };

  // Reset page to receive another / auto open next draft
  const handleNextTransaction = () => {
    const completedTxId = pendingTxId;
    const remainingQueue = draftQueue.filter((d) => d.transaksi_id !== completedTxId);
    setDraftQueue(remainingQueue);

    setTransactionSuccess(false);
    setSavedResiSummary(null);
    setResiId("");
    setBiayaLainInput("");
    setBiayaAsuransiInput("");
    setOngkirDasarInput("");
    setTotalUangDibayarInput("");
    setMetodeBayar("Tunai");
    setBuktiBayarUrl("");
    // We keep aktifkanBiayaTambahan true as per default
    setBiayaAmplopInput("");
    setBiayaPackingInput("");
    setMetodeBayarTambahan("Tunai");
    setBuktiTambahanUrl("");
    
    if (fotoPaketPreview) URL.revokeObjectURL(fotoPaketPreview);
    if (fotoResiPreview) URL.revokeObjectURL(fotoResiPreview);
    setFotoPaketPreview("");
    setFotoResiPreview("");
    setFotoPaketBlob(null);
    setFotoResiBlob(null);
    setFotoPaketUrl("");
    setFotoResiUrl("");
    setMerkMotor("");
    setCcMotor("");
    setTahunMotor("");
    setKelengkapanMotor([]);
    setKelengkapanLainnya("");
    setResiDuplicateError(false);
    setFormError(null);

    // Auto open next draft if available
    if (completedTxId && remainingQueue.length > 0) {
      const nextDraft = remainingQueue[0];
      toast.info(`🎉 Selesai! Otomatis membuka Draft berikutnya: ${nextDraft.transaksi_id}`);
      setActiveDraftIndex(0);
      setPendingTxId(nextDraft.transaksi_id);
      localStorage.setItem("pending_transaksi_id", nextDraft.transaksi_id);
      loadPreInputDetails(nextDraft.transaksi_id);
      setTimeout(() => {
        resiInputRef.current?.focus();
      }, 100);
      return;
    }

    if (completedTxId) {
      toast.info("✅ Seluruh antrean draft telah selesai diproses!");
    }
    setPreInputData(null);
    setPendingTxId(null);
    localStorage.removeItem("pending_transaksi_id");
    setTimeout(() => {
      resiInputRef.current?.focus();
    }, 100);
  };

  // Keyboard Shortcuts Listener (Phase 15.2 - Requirement #8)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (successSheet) {
          setSuccessSheet(null);
          handleNextTransaction();
          return;
        }
        onNavigate("pre-input");
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "Enter") {
          e.preventDefault();
          if (isAllStepsValid && !loading && !successSheet) {
            handleSaveTransaksi();
          } else {
            toast.error("Harap lengkapi semua langkah sebelum menyimpan.");
          }
        } else if (e.key === "ArrowRight") {
          const activeEl = document.activeElement;
          const isInputActive = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.tagName === "SELECT");
          if (!isInputActive) {
            e.preventDefault();
            handleGoToNextDraft();
          }
        } else if (e.key === "ArrowLeft") {
          const activeEl = document.activeElement;
          const isInputActive = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.tagName === "SELECT");
          if (!isInputActive) {
            e.preventDefault();
            handleGoToPrevDraft();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAllStepsValid, loading, successSheet, activeDraftIndex, draftQueue, onNavigate, fotoPaketUrl, fotoPaketPreview, fotoResiUrl, fotoResiPreview, resiId, resiDuplicateError, ongkirDasar, totalUangDibayarCustomer, biayaDasarLayanan, metodeBayar, buktiBayarUrl]);

  return (
    <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-6 py-5">

      {/* HEADER SECTION */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-red-50 text-[#E4002B] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest font-mono">
                MODUL KEUANGAN & RESI
              </span>
              {yoyiQueue.length > 0 && (
                <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                  {yoyiQueue.length} Antrian YoYi
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 font-sans mt-2">
              Kalkulator Finansial & Input Resi
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Scan barcode resi J&T, validasi duplikat, hitung pembulatan bayar, dan pisahkan setoran owner harian.
            </p>
          </div>

          {/* LOKASI TUGAS OVERRIDE */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setIsYoYiModalOpen(true);
              }}
              className="relative z-20 bg-white border border-[#E4002B] text-[#E4002B] hover:bg-red-50 text-xs px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" /> Import YoYi
            </button>

            <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 flex flex-col gap-0.5 sm:min-w-[220px]">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                Lokasi Tugas Aktif:
              </span>
              <select
                value={activeOutletId}
                onChange={(e) => onChangeActiveOutlet(e.target.value)}
                className="bg-transparent text-xs py-0.5 font-semibold text-gray-700 focus:outline-none cursor-pointer"
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
      </div>

      {/* 2-COLUMN MAIN LAYOUT (Kiri: Formulir & Kalkulator, Kanan: Sidebar Antrian YoYi & Riwayat) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* KOLOM UTAMA (KIRI) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">

          {formError && (
            <div className="p-4 bg-red-50 border-l-4 border-[#E4002B] rounded-r-xl flex items-start gap-2 text-red-800 text-sm shadow-xs">
              <AlertTriangle className="h-5 w-5 shrink-0 text-[#E4002B] mt-0.5" />
              <div>
                <p className="font-semibold">Kesalahan Validasi</p>
                <p className="text-xs opacity-90 mt-0.5">{formError}</p>
              </div>
            </div>
          )}

          {/* PHASE 15.2 - PROGRESS INDICATOR OPERASIONAL */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between gap-1 sm:gap-2 text-center overflow-x-auto pb-2">
            {[
              { label: "Draft", done: true, active: false },
              { label: "Foto Paket", done: stepFotoPaket, active: !stepFotoPaket },
              { label: "Foto Resi", done: stepFotoResi, active: stepFotoPaket && !stepFotoResi },
              { label: "Barcode", done: stepBarcode, active: stepFotoPaket && stepFotoResi && !stepBarcode },
              { label: "YoYi / JTC", done: stepProdukYoYi, active: stepFotoPaket && stepFotoResi && stepBarcode && !stepProdukYoYi },
              { label: "Pembayaran", done: stepPembayaran, active: stepFotoPaket && stepFotoResi && stepBarcode && stepProdukYoYi && !stepPembayaran },
              { label: "Selesai", done: isAllStepsValid, active: isAllStepsValid }
            ].map((item, idx, arr) => (
              <React.Fragment key={item.label}>
                <div className="flex flex-col items-center min-w-[70px]">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    item.done
                      ? "bg-green-600 text-white shadow-sm"
                      : item.active
                      ? "bg-[#E4002B] text-white animate-pulse"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    {item.done ? "✓" : idx + 1}
                  </div>
                  <span className={`text-[10px] font-bold mt-1.5 whitespace-nowrap ${
                    item.done ? "text-green-700" : item.active ? "text-[#E4002B]" : "text-gray-400"
                  }`}>
                    {item.label}
                  </span>
                </div>
                {idx < arr.length - 1 && (
                  <div className={`h-0.5 flex-1 min-w-[12px] my-auto ${
                    item.done ? "bg-green-500" : "bg-gray-200"
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* 1. DETEKSI PRE-INPUT COMPONENT CARD / FINALIZATION HEADER */}
          {pendingTxId && preInputData ? (
            <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="animate-ping h-2.5 w-2.5 bg-[#E4002B] rounded-full inline-block shrink-0"></span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-amber-400" />
                      <p className="text-xs font-bold text-amber-400 uppercase font-mono tracking-wider">
                        FINALISASI TRANSAKSI READ-ONLY — {pendingTxId}
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Identitas Pelanggan & Paket Terkunci dari Draft Workspace
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {draftQueue.length > 1 && (
                    <div className="flex items-center gap-1 mr-1">
                      <button
                        type="button"
                        onClick={handleGoToPrevDraft}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        title="Draft Sebelumnya (Ctrl+←)"
                      >
                        <ChevronLeft className="h-3 w-3" />
                        Prev
                      </button>
                      <button
                        type="button"
                        onClick={handleGoToNextDraft}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        title="Draft Berikutnya (Ctrl+→)"
                      >
                        Next
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigate("pre-input")}
                    className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-white/10 cursor-pointer"
                    title="Kembali ke Workspace (Esc)"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Kembali ke Workspace (Esc)
                  </button>
                  <button
                    type="button"
                    onClick={handleClearPreInputRef}
                    className="text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-wider bg-slate-800 py-1.5 px-2.5 rounded-lg border border-slate-700 cursor-pointer"
                  >
                    Lepas Draft
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1">
                    <Lock className="h-2.5 w-2.5 text-amber-400" /> Pengirim (Read-Only)
                  </p>
                  <p className="font-bold text-white mt-1 text-sm">{preInputData.nama_pengirim}</p>
                  <p className="text-slate-300 text-[11px] mt-0.5">{preInputData.hp_pengirim}</p>
                  <p className="text-slate-400 text-[11px] truncate mt-0.5" title={preInputData.alamat_pengirim}>
                    {preInputData.alamat_pengirim || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1">
                    <Lock className="h-2.5 w-2.5 text-amber-400" /> Penerima (Read-Only)
                  </p>
                  <p className="font-bold text-white mt-1 text-sm">{preInputData.nama_penerima}</p>
                  <p className="text-slate-300 text-[11px] mt-0.5">{preInputData.hp_penerima}</p>
                  <p className="text-slate-400 text-[11px] truncate mt-0.5" title={preInputData.alamat_penerima}>
                    {preInputData.alamat_penerima || "-"}
                  </p>
                  {preInputData.alamat_penerima_asli && (
                    <p className="text-[10px] text-amber-400 italic truncate mt-0.5" title={`Alamat Asli: ${preInputData.alamat_penerima_asli}`}>
                      Asli: {preInputData.alamat_penerima_asli}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1">
                    <Lock className="h-2.5 w-2.5 text-amber-400" /> Paket ({preInputData.ekspedisi})
                  </p>
                  <p className="font-bold text-white mt-1 text-sm truncate">{preInputData.nama_barang || "Barang Paket"}</p>
                  <p className="text-slate-300 text-[11px] font-mono mt-0.5">
                    Berat: {preInputData.berat_kg} KG | Dimensi: {preInputData.volume}
                  </p>
                  {preInputData.nilai_barang > 0 && (
                    <p className="text-amber-300 text-[11px] font-mono mt-0.5">
                      Nilai: Rp {preInputData.nilai_barang.toLocaleString("id-ID")}
                    </p>
                  )}
                </div>
              </div>
              {preInputData.catatan_admin && (
                <div className="mt-3 p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 flex items-start gap-2">
                  <div className="font-bold uppercase tracking-wider text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono shrink-0 mt-0.5">
                    Catatan Admin
                  </div>
                  <div className="font-medium">{preInputData.catatan_admin}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 text-center text-xs text-gray-500">
              💡 Belum memilih Pre-Input pelanggan. Menjalankan mode input langsung (Direct Entry). 
              Anda bisa memilih untuk pre-input data pelanggan terlebih dahulu di halaman Pre-Input.
            </div>
          )}

          {/* MAIN GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* LEFT COLUMN: SCAN & CALCULATIONS */}
            <div className="space-y-6">

              {/* SECTION: SCAN BARCODE & CAMERA */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                
                {/* Hidden File Inputs */}
                <input
                  ref={fileInputPaketRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, "paket")}
                />
                <input
                  ref={fileInputResiRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, "resi")}
                />

                {/* Scanner Main Action Buttons / Status */}
                {(!fotoPaketPreview && !fotoResiPreview && !fotoPaketUrl && !fotoResiUrl) ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => startCamera(1)}
                      className="w-full bg-[#E4002B] hover:bg-[#c20023] text-white py-3.5 px-3 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Camera className="h-4.5 w-4.5" />
                      <span>{showScanner && cameraStep === 1 ? "Tutup Kamera" : "Foto Paket & Scan"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startCamera(2)}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3.5 px-3 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Scan className="h-4.5 w-4.5 text-amber-400" />
                      <span>{showScanner && cameraStep === 2 ? "Tutup Kamera" : "Kamera Foto Resi"}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    <div className="w-full bg-green-50 text-green-700 py-2.5 px-3.5 rounded-xl font-bold text-sm border border-green-200 shadow-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4.5 w-4.5 text-green-600 shrink-0" />
                        <span>Foto / Resi Tersedia</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          type="button"
                          onClick={() => startCamera(2)}
                          className="text-xs bg-white text-gray-700 px-2.5 py-1.5 rounded-lg border border-gray-300 shadow-xs hover:bg-gray-50 flex items-center gap-1 cursor-pointer font-semibold"
                        >
                          <Camera className="h-3.5 w-3.5 text-[#E4002B]" /> Foto Resi
                        </button>
                        <button 
                          type="button"
                          onClick={() => startCamera(1)}
                          className="text-xs bg-white text-gray-700 px-2.5 py-1.5 rounded-lg border border-gray-300 shadow-xs hover:bg-gray-50 flex items-center gap-1 cursor-pointer font-semibold"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Scan Ulang
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Progress Tabs when Camera is open */}
                {showScanner && (
                  <div className="flex items-center justify-between bg-slate-100 p-1.5 rounded-xl gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCameraStep(1);
                        setScanStatus("STEP 1: Foto fisik paket");
                      }}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        cameraStep === 1 
                          ? "bg-[#E4002B] text-white shadow-xs" 
                          : (fotoPaketPreview || fotoPaketUrl) 
                          ? "bg-green-100 text-green-800" 
                          : "text-gray-600 hover:bg-slate-200"
                      }`}
                    >
                      {(fotoPaketPreview || fotoPaketUrl) ? <Check className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
                      <span>1. Foto Paket</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCameraStep(2);
                        setScanStatus("STEP 2: Foto Resi & Arahkan ke Barcode");
                      }}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        cameraStep === 2 
                          ? "bg-[#E4002B] text-white shadow-xs" 
                          : (fotoResiPreview || fotoResiUrl) 
                          ? "bg-green-100 text-green-800" 
                          : "text-gray-600 hover:bg-slate-200"
                      }`}
                    >
                      {(fotoResiPreview || fotoResiUrl) ? <Check className="w-3.5 h-3.5" /> : <Scan className="w-3.5 h-3.5" />}
                      <span>2. Foto Resi & Barcode</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowScanner(false)}
                      className="px-2.5 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                )}

                {/* Html5Qrcode Scanner Target div with Frame Overlay */}
                {showScanner && (
                  <div className="space-y-3 border border-gray-800 rounded-2xl p-3 bg-slate-950 overflow-hidden relative shadow-inner">
                    <div id="reader" className="w-full overflow-hidden rounded-xl [&_video]:w-full [&_video]:object-cover [&_video]:rounded-xl min-h-[280px]"></div>
                    
                    {/* Viewfinder Target Frame Overlay */}
                    <div className="absolute inset-x-8 top-6 bottom-20 pointer-events-none border-2 border-dashed border-white/60 rounded-2xl flex flex-col items-center justify-between p-3">
                      <div className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-white text-[11px] font-medium tracking-wide">
                        {cameraStep === 1 ? "📷 Frame Kamera Fisik Paket" : "📄 Frame Kamera Lembar Resi & Barcode"}
                      </div>
                      <div className="w-12 h-1 bg-white/40 rounded-full"></div>
                    </div>

                    {/* Snapshot Button Overlay */}
                    <div className="absolute inset-x-0 bottom-14 flex justify-center z-10">
                      {cameraStep === 1 ? (
                        <button 
                          type="button"
                          onClick={async () => {
                            await capturePhoto("paket");
                            setCameraStep(2);
                            setScanStatus("STEP 2: Posisikan lembar resi pada paket");
                          }}
                          className="bg-[#E4002B] hover:bg-[#c20023] text-white px-5 py-2.5 rounded-full font-bold text-sm shadow-xl flex items-center gap-2 cursor-pointer ring-4 ring-white/40"
                        >
                          <Camera className="w-4 h-4" /> Ambil Foto Paket
                        </button>
                      ) : (
                        <button 
                          type="button"
                          onClick={async () => {
                            await capturePhoto("resi");
                            setScanStatus("Foto Resi berhasil ditangkap");
                            setShowScanner(false);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-full font-bold text-sm shadow-xl flex items-center gap-2 cursor-pointer ring-4 ring-white/40"
                        >
                          <Camera className="w-4 h-4" /> Ambil Foto Resi
                        </button>
                      )}
                    </div>

                    {scanStatus && (
                      <div className="absolute bottom-3 inset-x-4 z-10">
                        <p className="text-xs text-center font-semibold text-white bg-black/70 backdrop-blur-sm py-1.5 px-3 rounded-lg border border-white/10 shadow-xs truncate">
                          {scanStatus}
                        </p>
                      </div>
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
                      ref={resiInputRef}
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
                      placeholder="CONTOH: JD12345678901"
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

                  {(!resiDuplicateError && (resiId || "").trim() && !checkingResi) ? (
                    <div className="mt-2 text-[10px] text-green-600 font-bold flex items-center gap-1 font-mono">
                      <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                      <span>Resi valid & siap diproses (Anti-Fraud Aman)</span>
                    </div>
                  ) : null}

                  {/* FOTO PAKET & FOTO RESI SECTION */}
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    
                    {/* CARD FOTO PAKET */}
                    <div 
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 focus-within:ring-2 focus-within:ring-[#E4002B]/30 outline-none"
                      onPaste={(e) => handlePasteImage(e, "paket")}
                      tabIndex={0}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Foto Fisik Paket <span className="font-normal text-[9px] text-gray-500 ml-1">(Klik area ini lalu Ctrl+V untuk Paste)</span></span>
                        {(fotoPaketPreview || fotoPaketUrl) && (
                          <span className="text-[10px] text-green-700 font-bold bg-green-100 px-1.5 py-0.5 rounded">
                            ✓ Siap Upload
                          </span>
                        )}
                      </div>

                      {uploadingFotoPaket ? (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 py-4 justify-center">
                          <RefreshCw className="h-4 w-4 animate-spin text-[#E4002B]" /> Mengunggah...
                        </div>
                      ) : (fotoPaketPreview || fotoPaketUrl) ? (
                        <div className="flex items-start gap-3">
                          <img 
                            src={getDisplayImageUrl(fotoPaketPreview || fotoPaketUrl)} 
                            alt="Paket" 
                            className="h-[76px] w-[76px] object-cover rounded-lg border border-gray-200 shadow-xs shrink-0" 
                            referrerPolicy="no-referrer" 
                          />
                          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                            <button 
                              type="button" 
                              onClick={() => startCamera(1)} 
                              className="text-[11px] text-gray-700 bg-white border border-gray-300 px-2.5 py-1 rounded-lg shadow-xs hover:bg-gray-50 flex items-center gap-1 w-fit cursor-pointer font-medium"
                            >
                              <Camera className="h-3.5 w-3.5 text-[#E4002B]" /> Kamera Ulang
                            </button>
                            <button 
                              type="button" 
                              onClick={() => fileInputPaketRef.current?.click()} 
                              className="text-[11px] text-gray-700 bg-white border border-gray-300 px-2.5 py-1 rounded-lg shadow-xs hover:bg-gray-50 flex items-center gap-1 w-fit cursor-pointer font-medium"
                            >
                              <Upload className="h-3.5 w-3.5 text-gray-500" /> Ganti Berkas
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => startCamera(1)}
                            className="w-full py-2 bg-white border border-gray-300 hover:border-gray-400 rounded-lg text-xs font-semibold text-gray-700 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Camera className="h-3.5 w-3.5 text-[#E4002B]" /> Ambil Foto (Kamera)
                          </button>
                          <button
                            type="button"
                            onClick={() => fileInputPaketRef.current?.click()}
                            className="w-full py-2 bg-white border border-gray-300 hover:border-gray-400 rounded-lg text-xs font-semibold text-gray-700 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Upload className="h-3.5 w-3.5 text-gray-500" /> Upload Berkas Paket
                          </button>
                        </div>
                      )}
                    </div>

                    {/* CARD FOTO RESI */}
                    <div 
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 focus-within:ring-2 focus-within:ring-[#E4002B]/30 outline-none"
                      onPaste={(e) => handlePasteImage(e, "resi")}
                      tabIndex={0}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Foto Resi Pada Paket <span className="font-normal text-[9px] text-gray-500 ml-1">(Klik area ini lalu Ctrl+V untuk Paste)</span></span>
                        {(fotoResiPreview || fotoResiUrl) && (
                          <span className="text-[10px] text-green-700 font-bold bg-green-100 px-1.5 py-0.5 rounded">
                            ✓ Siap Upload
                          </span>
                        )}
                      </div>

                      {uploadingFotoResi ? (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 py-4 justify-center">
                          <RefreshCw className="h-4 w-4 animate-spin text-orange-500" /> Mengunggah...
                        </div>
                      ) : (fotoResiPreview || fotoResiUrl) ? (
                        <div className="flex items-start gap-3">
                          <img 
                            src={getDisplayImageUrl(fotoResiPreview || fotoResiUrl)} 
                            alt="Resi" 
                            className="h-[76px] w-[76px] object-cover rounded-lg border border-gray-200 shadow-xs shrink-0" 
                            referrerPolicy="no-referrer" 
                          />
                          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                            <button 
                              type="button" 
                              onClick={() => startCamera(2)} 
                              className="text-[11px] text-gray-700 bg-white border border-gray-300 px-2.5 py-1 rounded-lg shadow-xs hover:bg-gray-50 flex items-center gap-1 w-fit cursor-pointer font-medium"
                            >
                              <Camera className="h-3.5 w-3.5 text-[#E4002B]" /> Kamera Ulang
                            </button>
                            <button 
                              type="button" 
                              onClick={() => fileInputResiRef.current?.click()} 
                              className="text-[11px] text-gray-700 bg-white border border-gray-300 px-2.5 py-1 rounded-lg shadow-xs hover:bg-gray-50 flex items-center gap-1 w-fit cursor-pointer font-medium"
                            >
                              <Upload className="h-3.5 w-3.5 text-gray-500" /> Ganti Berkas
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => startCamera(2)}
                            className="w-full py-2 bg-white border border-gray-300 hover:border-gray-400 rounded-lg text-xs font-semibold text-gray-700 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Camera className="h-3.5 w-3.5 text-[#E4002B]" /> Ambil Foto Resi (Kamera)
                          </button>
                          <button
                            type="button"
                            onClick={() => fileInputResiRef.current?.click()}
                            className="w-full py-2 bg-white border border-gray-300 hover:border-gray-400 rounded-lg text-xs font-semibold text-gray-700 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Upload className="h-3.5 w-3.5 text-[#E4002B]" /> Upload Foto Resi
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </div>

              {/* FINANCIAL CALCULATORS FOR SERVICE CATEGORY */}
              <div ref={layananRef} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                
                {/* Switcher & Tugas Dropdown */}
                <div className="flex gap-4 items-center border-b border-gray-100 pb-3 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Jenis Layanan
                      </label>
                      {isLockedFromDraft && (
                        <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                          <Lock className="h-3 w-3" /> Terkunci dari Workspace
                        </span>
                      )}
                    </div>
                    <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                      <button
                        type="button"
                        disabled={isLockedFromDraft}
                        onClick={() => setJenisLayanan("Express")}
                        className={`flex-1 text-center py-1.5 px-2 text-xs font-semibold rounded-lg transition-all duration-150 ${
                          isLockedFromDraft ? "cursor-not-allowed opacity-80 " : "cursor-pointer "
                        }${
                          jenisLayanan === "Express" ? "bg-[#E4002B] text-white shadow" : "text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        Express
                      </button>
                      <button
                        type="button"
                        disabled={isLockedFromDraft}
                        onClick={() => setJenisLayanan("Cargo")}
                        className={`flex-1 text-center py-1.5 px-2 text-xs font-semibold rounded-lg transition-all duration-150 ${
                          isLockedFromDraft ? "cursor-not-allowed opacity-80 " : "cursor-pointer "
                        }${
                          jenisLayanan === "Cargo" ? "bg-[#E4002B] text-white shadow" : "text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        Cargo
                      </button>
                    </div>
                  </div>
                </div>

                {/* Berat & Volume Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Berat Timbangan (KG)
                      </label>
                      {isLockedFromDraft && <Lock className="h-3 w-3 text-amber-500" />}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        disabled={isLockedFromDraft}
                        value={beratKg}
                        onChange={(e) => setBeratKg(e.target.value)}
                        className={`w-full pl-3 pr-10 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-1 ${
                          isLockedFromDraft
                            ? "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed font-bold"
                            : "bg-gray-50 border-gray-200 text-gray-800 focus:ring-[#E4002B] focus:border-[#E4002B]"
                        }`}
                        placeholder="0.0"
                      />
                      <div className="absolute right-3 inset-y-0 flex items-center text-xs text-gray-400 font-bold">
                        KG
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider truncate" title="Volume Paket (P x L x T cm)">
                        Volume Paket (P x L x T cm)
                      </label>
                      {isLockedFromDraft && <Lock className="h-3 w-3 text-amber-500 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1 w-full">
                      <input
                        type="number"
                        min="0"
                        disabled={isLockedFromDraft}
                        value={volP}
                        onChange={(e) => setVolP(e.target.value)}
                        className={`flex-1 min-w-0 p-2 border rounded-lg text-xs text-center focus:ring-1 focus:outline-none ${
                          isLockedFromDraft
                            ? "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed font-bold"
                            : "bg-gray-50 border-gray-200 text-gray-800 focus:ring-[#E4002B]"
                        }`}
                        placeholder="P"
                      />
                      <span className="text-gray-400 text-xs shrink-0">x</span>
                      <input
                        type="number"
                        min="0"
                        disabled={isLockedFromDraft}
                        value={volL}
                        onChange={(e) => setVolL(e.target.value)}
                        className={`flex-1 min-w-0 p-2 border rounded-lg text-xs text-center focus:ring-1 focus:outline-none ${
                          isLockedFromDraft
                            ? "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed font-bold"
                            : "bg-gray-50 border-gray-200 text-gray-800 focus:ring-[#E4002B]"
                        }`}
                        placeholder="L"
                      />
                      <span className="text-gray-400 text-xs shrink-0">x</span>
                      <input
                        type="number"
                        min="0"
                        disabled={isLockedFromDraft}
                        value={volT}
                        onChange={(e) => setVolT(e.target.value)}
                        className={`flex-1 min-w-0 p-2 border rounded-lg text-xs text-center focus:ring-1 focus:outline-none ${
                          isLockedFromDraft
                            ? "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed font-bold"
                            : "bg-gray-50 border-gray-200 text-gray-800 focus:ring-[#E4002B]"
                        }`}
                        placeholder="T"
                      />
                    </div>
                  </div>
                </div>

                {/* Calculated Results (Read-only) */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 grid grid-cols-3 gap-2 text-center mb-4">
                  <div>
                    <span className="block text-[10px] font-bold text-gray-400 uppercase">Berat Volume</span>
                    <span className="block text-sm font-bold text-gray-700">{calculatedWeight.berat_volume} kg</span>
                  </div>
                  <div className="border-l border-gray-200">
                    <span className="block text-[10px] font-bold text-gray-400 uppercase">Dasar Perhitungan</span>
                    <span className="block text-sm font-bold text-blue-600">{calculatedWeight.dasar_berat}</span>
                  </div>
                  <div className="border-l border-gray-200">
                    <span className="block text-[10px] font-bold text-[#E4002B] uppercase">Berat Penagihan</span>
                    <span className="block text-sm font-black text-[#E4002B]">{calculatedWeight.berat_penagihan} kg</span>
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
                      Pembulatan (Rp)
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
                      <option value="DFOD">DFOD (Bayar Tujuan)</option>
                    </select>
                  </div>

                  {metodeBayar !== "Tunai" && metodeBayar !== "DFOD" && (
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
                          <img src={getDisplayImageUrl(buktiBayarUrl)} alt="bukti" className="h-10 w-10 object-cover rounded" referrerPolicy="no-referrer" />
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
                      <p className="text-[10px] text-gray-400">Kas operasional Outlet.</p>
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
                          value={biayaAmplopInput}
                          onChange={(e) => setBiayaAmplopInput(formatThousandsInput(e.target.value))}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#E4002B]"
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
                              <img src={getDisplayImageUrl(buktiTambahanUrl)} alt="bukti" className="h-10 w-10 object-cover rounded" referrerPolicy="no-referrer" />
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

                {/* VALIDATION CHECKLIST FOR FINALIZATION MODE */}
                {!isAllStepsValid && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Langkah Finalisasi Belum Selesai (Simpan Aktif Jika Semua ✓):</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${stepFotoPaket ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800 border border-amber-300"}`}>
                        {stepFotoPaket ? "✓" : "⏳"} Foto Paket
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${stepFotoResi ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800 border border-amber-300"}`}>
                        {stepFotoResi ? "✓" : "⏳"} Foto Resi
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${stepBarcode ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800 border border-amber-300"}`}>
                        {stepBarcode ? "✓" : "⏳"} Scan Barcode
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${stepProdukYoYi ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800 border border-amber-300"}`}>
                        {stepProdukYoYi ? "✓" : "⏳"} Layanan YoYi
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${stepPembayaran ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800 border border-amber-300"}`}>
                        {stepPembayaran ? "✓" : "⏳"} Pembayaran
                      </span>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSaveTransaksi}
                  disabled={!isAllStepsValid || loading || checkingResi || resiDuplicateError}
                  className={`w-full py-4 font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition duration-150 text-sm ${
                    !isAllStepsValid || loading || checkingResi || resiDuplicateError
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed shadow-none"
                      : "bg-[#E4002B] hover:bg-[#c20023] text-white cursor-pointer shadow-red-500/10"
                  }`}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      <span>Sedang Menyimpan Transaksi...</span>
                    </>
                  ) : (
                    <>
                      <span>Simpan & Selesaikan Transaksi</span>
                      <span className="text-[11px] bg-white/20 px-1.5 py-0.5 rounded font-mono ml-1">Ctrl + Enter</span>
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </div>

            </div>

          </div>

          {/* PHASE 15.2 SHORTCUT INFO BAR */}
          <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-wrap items-center justify-center gap-4 text-[11px] text-gray-600 font-medium">
            <span className="flex items-center gap-1.5">
              <kbd className="bg-white border border-gray-300 px-1.5 py-0.5 rounded text-[10px] font-mono shadow-sm">Ctrl + Enter</kbd>
              <span>Simpan Transaksi</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="bg-white border border-gray-300 px-1.5 py-0.5 rounded text-[10px] font-mono shadow-sm">Ctrl + →</kbd>
              <span>Draft Berikutnya</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="bg-white border border-gray-300 px-1.5 py-0.5 rounded text-[10px] font-mono shadow-sm">Ctrl + ←</kbd>
              <span>Draft Sebelumnya</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="bg-white border border-gray-300 px-1.5 py-0.5 rounded text-[10px] font-mono shadow-sm">Esc</kbd>
              <span>Kembali ke Workspace</span>
            </span>
          </div>

        </div>
        {/* End of Left / Main Column */}

        {/* SIDEBAR COLUMN (KANAN): Antrian YoYi & Riwayat Transaksi Terbaru */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6 lg:sticky lg:top-4">

          {/* 1. KARTU ANTRIAN YOYI (DRAFT SELECTOR) */}
          <div className="bg-white rounded-2xl shadow-sm border border-orange-200 overflow-hidden">
            <div className="px-4 py-3.5 bg-orange-50/90 border-b border-orange-200/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="bg-orange-100 p-1.5 rounded-lg text-orange-600">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-gray-900">Draft YoYi ({yoyiQueue.length})</h3>
                  <p className="text-[10px] text-gray-500 font-medium">Klik untuk isi ke form</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {yoyiQueue.length > 0 && (
                  <button 
                    type="button"
                    onClick={handleClearAllYoYi} 
                    className="text-[10px] text-slate-500 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 px-2 py-1 rounded-lg font-semibold transition-colors cursor-pointer"
                    title="Kosongkan semua draft antrian"
                  >
                    Hapus Semua
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => setIsYoYiModalOpen(true)}
                  className="text-[11px] bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1.5 rounded-lg font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  <span>+ Import</span>
                </button>
              </div>
            </div>

            <div className="p-3 max-h-[380px] overflow-y-auto space-y-2.5">
              {yoyiQueue.length === 0 ? (
                <div className="py-7 px-4 text-center">
                  <div className="w-9 h-9 mx-auto mb-2 rounded-full bg-orange-50 text-orange-400 flex items-center justify-center">
                    <Layers className="w-4.5 h-4.5" />
                  </div>
                  <p className="text-xs font-semibold text-gray-700">Tidak ada antrian draft YoYi</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 mb-3">Impor paket dari teks YoYi untuk isi otomatis form</p>
                  <button
                    type="button"
                    onClick={() => setIsYoYiModalOpen(true)}
                    className="text-xs text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Import Data YoYi</span>
                  </button>
                </div>
              ) : (
                yoyiQueue.map(q => (
                  <div 
                    key={q.queue_id} 
                    className="p-3 border rounded-xl text-xs flex flex-col gap-1.5 transition-all bg-white border-orange-100 hover:border-orange-300 shadow-xs"
                  >
                    <div className="flex justify-between items-start font-bold text-gray-800">
                      <span className="tracking-wide text-xs font-mono text-slate-900 font-bold">{q.resi}</span>
                      <span className="text-[#d50000] font-bold text-xs">
                        Rp {(q.parsed_data.total_yoyi || q.parsed_data.ongkir_dasar || 0).toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-600 flex items-center gap-1.5 overflow-hidden">
                      <span className="truncate font-medium text-slate-700 max-w-[45%]" title={q.parsed_data.nama_pengirim || "Pengirim"}>
                        {q.parsed_data.nama_pengirim || "Pengirim"}
                      </span>
                      <span className="text-gray-400 font-bold shrink-0">→</span>
                      <span className="truncate font-semibold text-slate-900 max-w-[45%]" title={q.parsed_data.nama_penerima || "Penerima"}>
                        {q.parsed_data.nama_penerima || "Penerima"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-gray-500 pt-0.5">
                      <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                        {q.parsed_data.tipe_produk || "EZ"} {q.parsed_data.berat_kg ? `• ${q.parsed_data.berat_kg} kg` : ""}
                      </span>
                      <span className="text-orange-600 font-semibold">
                        {q.parsed_data.metode_perhitungan || "Normal"}
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-1.5 pt-1.5 border-t border-slate-100">
                      <button 
                        type="button"
                        onClick={() => handleRemoveYoYi(q.queue_id)} 
                        title="Hapus Draft"
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          handleApplyYoYiToForm(q.parsed_data);
                        }} 
                        className="inline-flex items-center gap-1 text-[11px] bg-[#E4002B] hover:bg-[#c20023] text-white px-3 py-1 rounded-lg font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        <ArrowRight className="w-3 h-3" />
                        <span>Pilih / Isi ke Form</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. KARTU RIWAYAT TRANSAKSI TERBARU */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3.5 bg-gray-50/90 border-b border-gray-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-red-50 text-[#E4002B] flex items-center justify-center font-bold">
                  <History className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-gray-900 tracking-tight">Riwayat Transaksi</h3>
                  <p className="text-[10px] text-gray-500 font-medium">Transaksi tersimpan di database</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => fetchRecentActivities()}
                  disabled={loadingRecent}
                  className="p-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1 cursor-pointer shadow-xs disabled:opacity-50"
                  title="Segarkan Riwayat"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingRecent ? "animate-spin text-[#E4002B]" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate("riwayat-transaksi")}
                  className="px-2 py-1 text-[11px] font-bold text-[#E4002B] bg-red-50 border border-red-200/60 rounded-lg hover:bg-red-100/70 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Semua</span>
                  <ExternalLink className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>

            <div className="p-3 max-h-[440px] overflow-y-auto space-y-2">
              {loadingRecent && recentActivities.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="h-5 w-5 animate-spin text-[#E4002B]" />
                  <span>Memuat riwayat transaksi...</span>
                </div>
              ) : recentActivities.length === 0 ? (
                <div className="py-7 text-center text-gray-400 text-xs">
                  Belum ada transaksi tersimpan untuk outlet ini hari ini.
                </div>
              ) : (
                recentActivities.map((tx: any, idx: number) => {
                  const resi = tx.resi_id || tx.no_resi || tx.id || "-";
                  const formattedTime = tx.timestamp 
                    ? new Date(tx.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                    : "-";
                  const pengirim = tx.pengirim || tx.snapshot_nama_pengirim || "-";
                  const penerima = tx.penerima || tx.snapshot_nama_penerima || "-";
                  const grandTotal = Number(tx.grand_total || tx.total_bayar || tx.total_customer_bayar || 0);
                  const tipe = tx.tipe || tx.jenis_layanan || "Express";
                  const status = tx.status_resi || tx.status || "AKTIF";
                  const metode = tx.metode_bayar || tx.metode_pembayaran_ongkir || "Tunai";

                  return (
                    <div 
                      key={tx.transaksi_id || resi || idx} 
                      className="p-3 border border-gray-100 rounded-xl bg-white hover:border-gray-200 hover:shadow-xs transition-all space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-xs text-gray-900 tracking-tight">{resi}</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                          status === "BATAL" || status === "Dibatalkan"
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}>
                          {status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-600">
                        <span className="truncate max-w-[45%]" title={pengirim}>{pengirim}</span>
                        <span className="text-gray-300 font-bold">→</span>
                        <span className="truncate max-w-[45%] font-medium text-gray-800" title={penerima}>{penerima}</span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-gray-50 text-[10px]">
                        <div className="flex items-center gap-1.5 text-gray-500">
                          <span className={`px-1.5 py-0.2 rounded font-bold ${
                            tipe.toLowerCase().includes("cargo") 
                              ? "bg-amber-50 text-amber-700 border border-amber-200" 
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}>
                            {tipe}
                          </span>
                          <span>•</span>
                          <span>{metode}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5 font-mono text-gray-400">
                            <Clock className="w-2.5 h-2.5" />
                            {formattedTime}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-[#E4002B] text-xs">
                          Rp {grandTotal.toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
        {/* End of Sidebar Column */}

      </div>
      {/* End of Grid */}

      {/* Form Ends Here */}

      {/* SUCCESS ACTION SHEET */}
      {successSheet && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-black text-gray-800 tracking-tight">Transaksi Berhasil Disimpan</h2>
              
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3 mt-4 text-left">
                <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nomor Resi</span>
                  <span className="text-sm font-bold text-gray-800 font-mono">{successSheet.resi}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Bayar</span>
                  <span className="text-lg font-black text-[#E4002B] font-mono">Rp {successSheet.total.toLocaleString("id-ID")}</span>
                </div>
              </div>
              
              <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSuccessSheet(null);
                    onNavigate("riwayat-transaksi");
                  }}
                  className="w-full py-3.5 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl shadow-sm hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <History className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">Riwayat Transaksi</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSuccessSheet(null);
                    handleNextTransaction();
                  }}
                  className="w-full py-3.5 bg-[#E4002B] text-white font-bold rounded-xl shadow-md hover:bg-[#c20023] transition-colors cursor-pointer flex items-center justify-center gap-2 relative overflow-hidden"
                >
                  <span className="text-sm relative z-10">Transaksi Baru</span>
                  <span className="hidden sm:inline relative z-10 text-[9px] bg-red-800/50 px-1.5 py-0.5 rounded text-white/90 font-mono">Enter</span>
                  <div className="absolute left-0 bottom-0 top-0 bg-black/10 z-0 transition-all duration-1000 ease-linear" style={{ width: `${(countdown / 5) * 100}%` }}></div>
                </button>
              </div>
              
              <p className="text-[10px] text-gray-400 font-medium">
                Melanjutkan otomatis dalam <strong className="text-[#E4002B]">{countdown}</strong> detik...
              </p>
            </div>
          </div>
        </div>
      )}


      <ImportYoYiModal 
        isOpen={isYoYiModalOpen} 
        onClose={() => setIsYoYiModalOpen(false)} 
        activeOutletId={activeOutletId} 
        adminId={session?.user_id || session?.username || ""} 
        onApplyToForm={handleApplyYoYiToForm}
      />
    </div>
  );
}