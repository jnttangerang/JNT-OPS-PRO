import React, { useState, useEffect, useRef } from "react";
import { 
  Download, 
  AlertTriangle, 
  FileText, 
  CheckCircle, 
  RefreshCw, 
  ArrowRight, 
  X, 
  Zap, 
  ClipboardPaste,
  Image as ImageIcon,
  UploadCloud,
  Trash2,
  Sparkles
} from "lucide-react";
import useAppsScript from "../hooks/useAppsScript";
import { toast } from "../utils/toast";
import { parseYoYiText, YoYiParsedData } from "../utils/yoyiParser";

export type { YoYiParsedData };

export interface YoYiImportQueueItem {
  queue_id: string;
  created_at: string;
  outlet_id?: string;
  admin_id?: string;
  resi: string;
  parsed_data: YoYiParsedData;
}

interface ImportYoYiModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeOutletId: string;
  adminId: string;
  onApplyToForm: (data: YoYiParsedData) => void;
}

export default function ImportYoYiModal({ 
  isOpen, 
  onClose, 
  activeOutletId, 
  adminId, 
  onApplyToForm
}: ImportYoYiModalProps) {
  const { callBackend, loading } = useAppsScript();
  
  // Tab State: "paste" | "screenshot"
  const [activeTab, setActiveTab] = useState<"paste" | "screenshot">("paste");
  
  // Text Tab State
  const [textInput, setTextInput] = useState("");
  const [parsingLocal, setParsingLocal] = useState(false);
  
  // Screenshot Tab State
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsingImage, setParsingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Common Parsed Result & Error State
  const [parsedData, setParsedData] = useState<YoYiParsedData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTextInput("");
      setSelectedImageFile(null);
      setImagePreviewUrl(null);
      setImageBase64(null);
      setParsedData(null);
      setErrorMsg(null);
      setActiveTab("paste");
    }
  }, [isOpen]);

  // Clean up object URL preview on unmount or file change
  useEffect(() => {
    return () => {
      if (imagePreviewUrl && imagePreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  // Handle Text Parsing
  const handleParseText = async () => {
    if (!textInput.trim()) {
      setErrorMsg("Teks pesanan tidak boleh kosong");
      return;
    }
    setErrorMsg(null);
    setParsingLocal(true);

    // 1. Fast instant local regex parse (0ms)
    try {
      const localResult = parseYoYiText(textInput);
      if (localResult.nomor_resi || localResult.total_yoyi > 0 || localResult.ongkir_dasar > 0 || localResult.nama_pengirim || localResult.nama_penerima) {
        setParsedData(localResult);
        setParsingLocal(false);
        return;
      }
    } catch (err) {
      console.warn("Local parse note:", err);
    }

    // 2. Fallback to server parse if local regex found no structured data
    try {
      const res = await callBackend("parseYoYiOrder", { text: textInput });
      if (res.status === "success" && res.data) {
        setParsedData(res.data);
      } else {
        throw new Error(res.message || "Gagal memparsing data");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Gagal membaca data. Pastikan teks berisi detail pesanan YoYi yang lengkap.");
    } finally {
      setParsingLocal(false);
    }
  };

  // Process selected image file
  const processImageFile = (file: File) => {
    setErrorMsg(null);
    
    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
      setErrorMsg("Format file tidak didukung. Harap upload gambar JPG, PNG, atau WEBP.");
      return;
    }

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("Ukuran file terlalu besar. Maksimal ukuran gambar adalah 10MB.");
      return;
    }

    if (file.size === 0) {
      setErrorMsg("File gambar kosong atau rusak.");
      return;
    }

    setSelectedImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setImagePreviewUrl(previewUrl);

    // Convert to Base64 data URL
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Str = event.target?.result as string;
      setImageBase64(base64Str);
    };
    reader.onerror = () => {
      setErrorMsg("Gagal membaca file gambar.");
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processImageFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processImageFile(files[0]);
    }
  };

  const handleClearImage = () => {
    setSelectedImageFile(null);
    if (imagePreviewUrl && imagePreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl(null);
    setImageBase64(null);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle Screenshot OCR via Gemini AI
  const handleParseScreenshot = async () => {
    if (!imageBase64) {
      setErrorMsg("Silakan upload screenshot detail transaksi YoYi terlebih dahulu.");
      return;
    }
    setErrorMsg(null);
    setParsingImage(true);

    try {
      const res = await callBackend("parseYoYiScreenshot", { imageBase64 });
      if (res.status === "success" && res.data) {
        setParsedData(res.data);
        toast.success("Berhasil mengekstrak data dari screenshot!");
      } else {
        throw new Error(res.message || "Gambar tidak terbaca, silakan coba dengan gambar yang lebih jelas.");
      }
    } catch (e: any) {
      const msg = e.message || "Gambar tidak terbaca, silakan coba dengan gambar yang lebih jelas.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setParsingImage(false);
    }
  };

  const handleApply = () => {
    if (!parsedData) return;
    if (!parsedData.nomor_resi) {
      setErrorMsg("Nomor resi tidak ditemukan dalam data YoYi.");
      return;
    }

    onApplyToForm(parsedData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#E4002B]/10 p-2 rounded-xl text-[#E4002B]">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                Import Data Pesanan YoYi
              </h3>
              <p className="text-[11px] text-slate-500">
                Ekstrak detail pesanan untuk mengisi form Resi & Bayar secara otomatis
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher (Only if parsedData is not yet displayed) */}
        {!parsedData && (
          <div className="flex border-b border-slate-200 bg-slate-50/70 px-5 pt-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab("paste");
                setErrorMsg(null);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-t border-x ${
                activeTab === "paste"
                  ? "bg-white text-[#E4002B] border-slate-200 -mb-px shadow-xs"
                  : "bg-transparent text-slate-500 hover:text-slate-800 border-transparent"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Paste Teks</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("screenshot");
                setErrorMsg(null);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-t border-x relative ${
                activeTab === "screenshot"
                  ? "bg-white text-[#E4002B] border-slate-200 -mb-px shadow-xs"
                  : "bg-transparent text-slate-500 hover:text-slate-800 border-transparent"
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>Upload Screenshot</span>
              <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-red-100 text-[#E4002B] px-1.5 py-0.5 rounded-full">
                <Sparkles className="w-2.5 h-2.5" />
                OCR AI
              </span>
            </button>
          </div>
        )}

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!parsedData ? (
            activeTab === "paste" ? (
              /* TAB 1: PASTE TEKS */
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-slate-700">Paste Teks Rincian Pesanan YoYi</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 hidden sm:inline">Salin langsung dari aplikasi / pesan YoYi</span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          setTextInput(text);
                        } catch (err) {
                          toast.error("Izin clipboard dibatasi. Silakan tekan Ctrl+V (Windows) atau Cmd+V (Mac) secara manual.");
                          document.getElementById("yoyi-paste-textarea")?.focus();
                        }
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm cursor-pointer"
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" />
                      Paste
                    </button>
                  </div>
                </div>
                <textarea
                  id="yoyi-paste-textarea"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="w-full h-52 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#E4002B]/30 focus:border-[#E4002B] placeholder:text-slate-400"
                  placeholder="Rincian Pesanan&#10;Informasi Pesanan&#10;No. Pesanan: ...&#10;Pengirim: ...&#10;Penerima: ...&#10;Ongkir: ..."
                />
                <button
                  type="button"
                  onClick={handleParseText}
                  disabled={loading || parsingLocal || !textInput.trim()}
                  className="w-full py-3 bg-[#E4002B] hover:bg-[#c20023] text-white rounded-xl text-sm font-bold shadow-sm flex justify-center items-center gap-2 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {loading || parsingLocal ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  <span>{loading || parsingLocal ? "Mengekstrak Data..." : "Ekstrak Data YoYi"}</span>
                </button>
              </div>
            ) : (
              /* TAB 2: UPLOAD SCREENSHOT */
              <div className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {!imagePreviewUrl ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                      isDragging
                        ? "border-[#E4002B] bg-red-50/50 scale-[0.99]"
                        : "border-slate-300 hover:border-[#E4002B] bg-slate-50/50 hover:bg-slate-50"
                    }`}
                  >
                    <div className="w-14 h-14 rounded-2xl bg-[#E4002B]/10 text-[#E4002B] flex items-center justify-center shadow-xs">
                      <UploadCloud className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Tarik & Lepas screenshot YoYi disini, atau <span className="text-[#E4002B] underline">Pilih File</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Format didukung: JPG, PNG, WEBP (Maksimal 10MB)
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] text-slate-600 font-medium shadow-2xs">
                      <Sparkles className="w-3 h-3 text-[#E4002B]" />
                      <span>Gemini AI OCR otomatis membaca nomor resi, pengirim, penerima, dan tarif</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative border border-slate-200 rounded-2xl p-3 bg-slate-50 flex items-center gap-4">
                      <div className="w-20 h-24 bg-white rounded-xl overflow-hidden border border-slate-200 shrink-0 flex items-center justify-center">
                        <img 
                          src={imagePreviewUrl} 
                          alt="Screenshot Preview" 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {selectedImageFile?.name || "Screenshot YoYi"}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {selectedImageFile ? (selectedImageFile.size / 1024).toFixed(1) + " KB" : ""}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-[11px] text-slate-600 hover:text-slate-900 font-semibold underline cursor-pointer"
                          >
                            Ganti Gambar
                          </button>
                          <span className="text-slate-300">•</span>
                          <button
                            type="button"
                            onClick={handleClearImage}
                            className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            Hapus
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleParseScreenshot}
                      disabled={loading || parsingImage || !imageBase64}
                      className="w-full py-3 bg-[#E4002B] hover:bg-[#c20023] text-white rounded-xl text-sm font-bold shadow-sm flex justify-center items-center gap-2 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {loading || parsingImage ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Membaca Screenshot dengan Gemini AI... (2-5 detik)</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>Ekstrak Data dari Screenshot</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )
          ) : (
            /* PREVIEW PARSED DATA */
            <div className="space-y-4">
              {/* Status Header */}
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Data YoYi berhasil diekstrak! Periksa data di bawah lalu terapkan ke Form.</span>
              </div>

              {/* Preview Cards Grid */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Hasil Ekstrak Data</h4>
                  <span className="text-xs font-mono font-bold text-[#E4002B] bg-red-50 px-2 py-0.5 rounded border border-red-100">
                    {parsedData.nomor_resi || "TANPA RESI"}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Pengirim</span>
                    <p className="font-bold text-slate-800">{parsedData.nama_pengirim || "-"}</p>
                    {parsedData.no_hp_pengirim && <p className="text-slate-500 font-mono text-[11px]">{parsedData.no_hp_pengirim}</p>}
                    {parsedData.alamat_pengirim && <p className="text-slate-600 text-[11px] line-clamp-2">{parsedData.alamat_pengirim}</p>}
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Penerima</span>
                    <p className="font-bold text-slate-800">{parsedData.nama_penerima || "-"}</p>
                    {parsedData.no_hp_penerima && <p className="text-slate-500 font-mono text-[11px]">{parsedData.no_hp_penerima}</p>}
                    {parsedData.alamat_penerima && <p className="text-slate-600 text-[11px] line-clamp-2">{parsedData.alamat_penerima}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Berat / Barang</span>
                    <span className="font-bold text-slate-800">{parsedData.berat_kg || 1} kg</span>
                    <span className="text-[10px] text-slate-500 block truncate">{parsedData.nama_barang || "Paket"}</span>
                  </div>

                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Layanan</span>
                    <span className="font-bold text-slate-800">{parsedData.tipe_produk || "EZ"}</span>
                    <span className="text-[10px] text-emerald-600 font-semibold block">{parsedData.metode_perhitungan || "Normal"}</span>
                  </div>

                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Ongkir Dasar</span>
                    <span className="font-bold text-slate-800 font-mono">Rp {parsedData.ongkir_dasar?.toLocaleString("id-ID") || 0}</span>
                    <span className="text-[10px] text-slate-400 block">Asuransi: Rp {parsedData.asuransi?.toLocaleString("id-ID") || 0}</span>
                  </div>

                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Total Ongkir YoYi</span>
                    <span className="font-extrabold text-[#E4002B] font-mono text-sm">
                      Rp {parsedData.total_yoyi?.toLocaleString("id-ID") || parsedData.ongkir_dasar?.toLocaleString("id-ID") || 0}
                    </span>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => setParsedData(null)}
                  className="text-[11px] text-blue-600 font-semibold hover:underline block pt-1 cursor-pointer"
                >
                  &larr; {activeTab === "screenshot" ? "Ulangi Upload Screenshot" : "Ulangi Paste Teks"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {parsedData && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Batal
            </button>

            <div className="flex items-center w-full sm:w-auto">
              <button
                type="button"
                onClick={handleApply}
                className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-bold text-white bg-[#E4002B] hover:bg-[#c20023] rounded-xl shadow-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>Gunakan Data / Isi ke Form</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
