import React, { useState, useEffect } from "react";
import { SessionData, Outlet } from "../../types";
import useAppsScript from "../../hooks/useAppsScript";
import { toast } from "../../utils/toast";
import {
  Sparkles,
  Bot,
  Search,
  Send,
  Copy,
  Check,
  AlertTriangle,
  FileText,
  TrendingUp,
  ShieldAlert,
  HelpCircle,
  RefreshCw,
  Clock,
  CheckCircle2,
  Building2,
  UserCheck,
  ChevronRight,
  Info,
  DollarSign
} from "lucide-react";

interface OwnerAIAssistantPageProps {
  session: SessionData;
  outlets: Outlet[];
}

export default function OwnerAIAssistantPage({ session, outlets }: OwnerAIAssistantPageProps) {
  const { callBackend } = useAppsScript();

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [anomaliesLoading, setAnomaliesLoading] = useState(false);

  const [aiResponse, setAiResponse] = useState<{
    question: string;
    answer: string;
    timestamp: string;
  } | null>(null);

  const [dailySummary, setDailySummary] = useState<{
    date: string;
    summary_text: string;
    metrics: any;
    timestamp: string;
  } | null>(null);

  const [anomaliesData, setAnomaliesData] = useState<{
    anomalies: any[];
    recommendations: string[];
    timestamp: string;
  } | null>(null);

  const [copied, setCopied] = useState(false);

  const suggestedQuestions = [
    "Berapa omzet hari ini?",
    "Siapa operator paling aktif minggu ini?",
    "Outlet mana omzet tertinggi bulan ini?",
    "Berapa transaksi cargo kemarin?",
    "Apakah ada selisih hari ini?",
    "Setoran mana yang belum disetujui?"
  ];

  // Auto load daily summary & anomaly check on initial view
  useEffect(() => {
    fetchDailySummary();
    fetchAnomalies();
  }, []);

  const fetchDailySummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await callBackend<{ status: string; data: any }>("apiDailySummary", {});
      if (res && res.status === "success" && res.data) {
        setDailySummary(res.data);
      }
    } catch (err: any) {
      console.error("Failed to fetch daily summary:", err);
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchAnomalies = async () => {
    setAnomaliesLoading(true);
    try {
      const res = await callBackend<{ status: string; data: any }>("apiDetectAnomalies", {});
      if (res && res.status === "success" && res.data) {
        setAnomaliesData(res.data);
      }
    } catch (err: any) {
      console.error("Failed to fetch anomalies:", err);
    } finally {
      setAnomaliesLoading(false);
    }
  };

  const handleAskQuestion = async (qToAsk?: string) => {
    const query = (qToAsk || question).trim();
    if (!query) {
      toast.error("Masukkan pertanyaan terlebih dahulu.");
      return;
    }

    setLoading(true);
    try {
      const res = await callBackend<{ status: string; data: any }>("apiAskAssistant", { question: query });
      if (res && res.status === "success" && res.data) {
        setAiResponse({
          question: query,
          answer: res.data.answer,
          timestamp: res.data.timestamp
        });
        setQuestion("");
      } else {
        toast.error("Gagal mendapatkan respons AI Assistant.");
      }
    } catch (err: any) {
      toast.error("Terjadi kesalahan koneksi AI Assistant: " + (err.message || err));
    } flexFinally();
  };

  const flexFinally = () => {
    setLoading(false);
  };

  const handleCopyAnswer = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Hasil analisis disalin ke clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTextWithBold = (text: string) => {
    // Simple formatter for **text** and bullet points
    return text.split("\n").map((line, idx) => {
      const isBullet = line.trim().startsWith("•") || line.trim().startsWith("-") || line.trim().startsWith("*");
      const cleanLine = line.replace(/^[•\-\*]\s*/, "");
      
      const parts = cleanLine.split(/(\*\*.*?\*\*)/g);
      const formattedParts = parts.map((part, pIdx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={pIdx} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      if (isBullet) {
        return (
          <li key={idx} className="ml-4 list-disc text-slate-700 my-1 leading-relaxed">
            {formattedParts}
          </li>
        );
      }
      return (
        <p key={idx} className={`my-1 text-slate-700 leading-relaxed ${line.trim() === "" ? "h-2" : ""}`}>
          {formattedParts}
        </p>
      );
    });
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-red-800 via-red-700 to-rose-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Bot className="w-8 h-8 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">AI Audit Assistant</h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-400/20 text-amber-200 border border-amber-300/30 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Phase 9 — Read Only
                </span>
              </div>
              <p className="text-red-100 text-sm mt-0.5">
                Asisten operasional khusus Owner untuk analisis transaksi, deteksi anomali, dan pemahaman laporan harian.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => { fetchDailySummary(); fetchAnomalies(); }}
              disabled={summaryLoading || anomaliesLoading}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium border border-white/20 transition flex items-center gap-2 backdrop-blur-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${summaryLoading || anomaliesLoading ? "animate-spin" : ""}`} />
              Refresh Analisis
            </button>
          </div>
        </div>

        {/* Read-Only Disclaimer Pill */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2 text-xs text-red-200">
          <Info className="w-4 h-4 text-amber-300 shrink-0" />
          <span>
            <strong>Prinsip Keamanan:</strong> AI Assistant tidak pernah mengubah database, tidak mengeksekusi approval/rejection, dan murni menyajikan analisis berdasarkan data terdaftar.
          </span>
        </div>
      </div>

      {/* Main Grid: Left/Center Content vs Right Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left/Center Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Question Input Box */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Search className="w-4 h-4 text-red-600" />
                Tanyakan Apapun ke AI Assistant
              </label>
              <span className="text-xs text-slate-400">Natural Language Query</span>
            </div>

            <div className="relative">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Contoh: Berapa total omzet hari ini? Atau: Outlet mana yang memiliki omset tertinggi minggu ini?"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAskQuestion();
                  }
                }}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 text-slate-800 text-sm resize-none pr-12 shadow-inner"
              />
              <button
                onClick={() => handleAskQuestion()}
                disabled={loading || !question.trim()}
                className="absolute right-3 bottom-3 p-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white rounded-lg transition shadow-sm"
                title="Kirim Pertanyaan"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-slate-500 font-medium">Aksi Cepat:</span>
              <button
                onClick={() => handleAskQuestion("Berapa omzet hari ini?")}
                className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium rounded-lg border border-red-200 transition"
              >
                💰 Omzet Hari Ini
              </button>
              <button
                onClick={() => handleAskQuestion("Apakah ada setoran yang belum disetujui?")}
                className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-medium rounded-lg border border-amber-200 transition"
              >
                📋 Status Setoran Pending
              </button>
              <button
                onClick={() => handleAskQuestion("Apakah ada selisih hari ini?")}
                className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-medium rounded-lg border border-rose-200 transition"
              >
                ⚠️ Selisih Margin
              </button>
            </div>
          </div>

          {/* AI Response Card (If user asked a question) */}
          {aiResponse && (
            <div className="bg-white rounded-2xl border border-red-200 shadow-md p-6 space-y-4 relative overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs">
                    AI
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Hasil Analisis AI</h3>
                    <p className="text-xs text-slate-500">Pertanyaan: "{aiResponse.question}"</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyAnswer(aiResponse.answer)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition text-xs flex items-center gap-1 border border-slate-200"
                    title="Salin Jawaban"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Tersalin" : "Salin"}</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-sm space-y-1">
                {formatTextWithBold(aiResponse.answer)}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Dianalisis pada: {new Date(aiResponse.timestamp).toLocaleString("id-ID")}
                </span>
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Direct Business Engine Read
                </span>
              </div>
            </div>
          )}

          {/* Daily Operational Summary Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Daily Operational Summary</h2>
                  <p className="text-xs text-slate-500">Ringkasan transaksi, omset, dan setoran terupdate</p>
                </div>
              </div>

              {dailySummary && (
                <span className="text-xs font-semibold px-2.5 py-1 bg-red-50 text-red-700 rounded-lg border border-red-100">
                  Tanggal: {dailySummary.date}
                </span>
              )}
            </div>

            {summaryLoading ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-red-600" />
                <p className="text-xs">Menganalisis data operasional harian...</p>
              </div>
            ) : dailySummary ? (
              <div className="space-y-4">
                {/* Metrics Row */}
                {dailySummary.metrics && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <p className="text-xs text-slate-500 font-medium">Total Transaksi</p>
                      <p className="text-lg font-bold text-slate-900 mt-0.5">{dailySummary.metrics.total_transaksi} resi</p>
                      <p className="text-[10px] text-slate-400">{dailySummary.metrics.express} Ex, {dailySummary.metrics.cargo} Crg</p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <p className="text-xs text-slate-500 font-medium">Omset Customer</p>
                      <p className="text-lg font-bold text-red-700 mt-0.5">
                        Rp {Number(dailySummary.metrics.omset || 0).toLocaleString("id-ID")}
                      </p>
                      <p className="text-[10px] text-slate-400">Total penerimaan</p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <p className="text-xs text-slate-500 font-medium">Setoran Owner</p>
                      <p className="text-lg font-bold text-emerald-700 mt-0.5">
                        Rp {Number(dailySummary.metrics.setoran_owner || 0).toLocaleString("id-ID")}
                      </p>
                      <p className="text-[10px] text-slate-400">Nett disetor ke owner</p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <p className="text-xs text-slate-500 font-medium">Setoran Pending</p>
                      <p className={`text-lg font-bold mt-0.5 ${dailySummary.metrics.pending_settlements > 0 ? "text-amber-600" : "text-slate-700"}`}>
                        {dailySummary.metrics.pending_settlements} berkas
                      </p>
                      <p className="text-[10px] text-slate-400">Menunggu approval</p>
                    </div>
                  </div>
                )}

                {/* AI Summary Text */}
                <div className="bg-red-50/50 rounded-xl p-4 border border-red-100 text-sm space-y-1">
                  {formatTextWithBold(dailySummary.summary_text)}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 text-sm">
                Data ringkasan tidak tersedia.
              </div>
            )}
          </div>

          {/* Anomaly Detection & Recommendations Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Deteksi Anomali & Rekomendasi Owner</h2>
                  <p className="text-xs text-slate-500">Pemeriksaan otomatis potensi selisih, koreksi, dan penolakan setoran</p>
                </div>
              </div>

              <button
                onClick={fetchAnomalies}
                disabled={anomaliesLoading}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${anomaliesLoading ? "animate-spin" : ""}`} />
                Pindai Ulang
              </button>
            </div>

            {anomaliesLoading ? (
              <div className="py-10 text-center text-slate-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-600" />
                <p className="text-xs">Memindai anomali finansial & operasional...</p>
              </div>
            ) : anomaliesData ? (
              <div className="space-y-5">
                
                {/* List of Anomalies */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Anomali Terdeteksi</h3>
                  
                  {anomaliesData.anomalies.length === 0 ? (
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-3 text-emerald-800 text-xs">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>Tidak ditemukan anomali berisiko. Seluruh operasional dan transaksi berjalan normal.</span>
                    </div>
                  ) : (
                    anomaliesData.anomalies.map((item: any, idx: number) => {
                      const isHigh = item.severity === "HIGH";
                      const isMedium = item.severity === "MEDIUM";

                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-xl border ${
                            isHigh
                              ? "bg-rose-50/70 border-rose-200"
                              : isMedium
                              ? "bg-amber-50/70 border-amber-200"
                              : "bg-slate-50 border-slate-200"
                          } space-y-2`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className={`w-4 h-4 ${isHigh ? "text-rose-600" : isMedium ? "text-amber-600" : "text-slate-500"}`} />
                              <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isHigh ? "bg-rose-600 text-white" : isMedium ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-700"
                            }`}>
                              {item.severity}
                            </span>
                          </div>

                          <p className="text-xs text-slate-700 leading-relaxed">{item.description}</p>

                          {item.items && item.items.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-200/60 text-[11px] text-slate-600 space-y-1">
                              <p className="font-semibold text-slate-700">Sampel Item Terkait:</p>
                              <ul className="list-disc pl-4 space-y-0.5">
                                {item.items.slice(0, 3).map((sub: any, sIdx: number) => (
                                  <li key={sIdx}>
                                    {sub.resi_id || sub.setoran_id || "Item"} — {sub.outlet || "Outlet"}: {sub.selisih ? `Selisih Rp ${sub.selisih.toLocaleString("id-ID")}` : sub.total ? `Total Rp ${sub.total.toLocaleString("id-ID")}` : sub.alasan || "Perlu review"}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Owner Recommendations */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Rekomendasi Tindakan Owner
                  </h3>

                  <div className="bg-amber-50/60 rounded-xl p-4 border border-amber-200/80 space-y-2 text-xs text-slate-800">
                    {anomaliesData.recommendations.map((rec: string, rIdx: number) => (
                      <div key={rIdx} className="flex items-start gap-2">
                        <ChevronRight className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 text-sm">
                Data anomali belum dimuat.
              </div>
            )}
          </div>

        </div>

        {/* Right Sidebar Column */}
        <div className="space-y-6">
          
          {/* Suggested Questions List */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-red-600" />
              Pertanyaan Rekomendasi
            </h3>
            <p className="text-xs text-slate-500">Klik salah satu pertanyaan untuk langsung menanyakan ke AI:</p>

            <div className="space-y-2">
              {suggestedQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAskQuestion(q)}
                  disabled={loading}
                  className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-red-50 hover:border-red-200 border border-slate-200 text-xs font-medium text-slate-800 transition flex items-center justify-between group"
                >
                  <span className="group-hover:text-red-700 transition">{q}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-red-600 group-hover:translate-x-0.5 transition shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* AI Capabilities Overview Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Kapabilitas AI Assistant
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-md bg-red-100 text-red-700 flex items-center justify-center shrink-0 font-bold text-[10px]">1</div>
                <div>
                  <p className="font-semibold text-slate-900">Daily Operational Summary</p>
                  <p className="text-slate-500 text-[11px]">Konsolidasi total transaksi, omset, setoran owner, dan kas operasional.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold text-[10px]">2</div>
                <div>
                  <p className="font-semibold text-slate-900">Anomaly Detection</p>
                  <p className="text-slate-500 text-[11px]">Menditeksi selisih margin, koreksi berulang, resi batal, & setoran ditolak.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-[10px]">3</div>
                <div>
                  <p className="font-semibold text-slate-900">Natural Language Query</p>
                  <p className="text-slate-500 text-[11px]">Menjawab pertanyaan tentang omset, performa outlet, dan operator aktif.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 font-bold text-[10px]">4</div>
                <div>
                  <p className="font-semibold text-slate-900">Owner Recommendations</p>
                  <p className="text-slate-500 text-[11px]">Saran taktis non-prediktif untuk membantu keputusan persetujuan owner.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-[10px]">5</div>
                <div>
                  <p className="font-semibold text-slate-900">Explain Numbers</p>
                  <p className="text-slate-500 text-[11px]">Menjelaskan asal usul rumus dan perhitungan angka pada laporan.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Architecture Hierarchy Info */}
          <div className="bg-slate-900 text-slate-300 rounded-2xl p-5 space-y-3 text-xs shadow-lg">
            <h4 className="font-bold text-white flex items-center gap-2">
              <Bot className="w-4 h-4 text-amber-400" />
              Hirarki Arsitektur Sesuai Spec
            </h4>
            
            <div className="font-mono text-[11px] bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-300 space-y-1">
              <p>Database</p>
              <p className="text-slate-500 pl-2">↓ Transaction</p>
              <p className="text-slate-500 pl-4">↓ Settlement</p>
              <p className="text-slate-500 pl-6">↓ Audit</p>
              <p className="text-slate-500 pl-8">↓ Closing</p>
              <p className="text-slate-500 pl-10">↓ Reporting</p>
              <p className="text-amber-400 font-bold pl-12">↓ AI Assistant (Top Layer)</p>
            </div>

            <p className="text-slate-400 text-[11px] leading-relaxed">
              AI Assistant duduk tepat di atas Reporting Layer. AI tidak pernah membypass Reporting atau menyentuh Transaction Engine secara langsung.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
