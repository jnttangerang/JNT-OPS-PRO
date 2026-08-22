import React, { useState, useEffect } from "react";
import { Download, AlertTriangle, FileText, CheckCircle, RefreshCw, Layers, ArrowRight, X, Zap } from "lucide-react";
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
  const [textInput, setTextInput] = useState("");
  const [parsedData, setParsedData] = useState<YoYiParsedData | null>(null);
  const [parsingLocal, setParsingLocal] = useState(false);
  
  // Validation / errors
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTextInput("");
      setParsedData(null);
      setErrorMsg(null);
    }
  }, [isOpen]);

  const handleParse = async () => {
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!parsedData ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold text-slate-700">Paste Teks Rincian Pesanan YoYi</label>
                <span className="text-[10px] text-slate-400">Salin langsung dari aplikasi / pesan YoYi</span>
              </div>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="w-full h-56 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#E4002B]/30 focus:border-[#E4002B] placeholder:text-slate-400"
                placeholder="Rincian Pesanan&#10;Informasi Pesanan&#10;No. Pesanan: ...&#10;Pengirim: ...&#10;Penerima: ...&#10;Ongkir: ..."
              />
              <button
                type="button"
                onClick={handleParse}
                disabled={loading || !textInput.trim()}
                className="w-full py-3 bg-[#E4002B] hover:bg-[#c20023] text-white rounded-xl text-sm font-bold shadow-sm flex justify-center items-center gap-2 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {loading || parsingLocal ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                <span>{loading || parsingLocal ? "Mengekstrak Data..." : "Ekstrak Data YoYi"}</span>
              </button>
            </div>
          ) : (
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
                    {parsedData.nomor_resi}
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
                  &larr; Ulangi Paste Teks
                </button>
              </div>
            </div>
          )}
        </div>

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
