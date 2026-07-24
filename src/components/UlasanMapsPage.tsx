import React, { useState, useEffect } from "react";
import { 
  Star, Trash2, Plus, Sparkles, AlertTriangle, Check, Copy, ChevronDown, 
  ChevronUp, RefreshCw, Building, HelpCircle, Info, ShieldAlert, StarHalf
} from "lucide-react";
import { toast } from "../utils/toast";

interface ReviewAnalysis {
  category: "POSITIVE" | "MISPLACED" | "FAKE";
  reason: string;
  reply: string;
  appealDraftEnglish?: string | null;
  appealDraftIndonesian?: string | null;
}

interface MapsReview {
  id: string;
  outlet_id: string;
  nama_outlet: string;
  reviewer: string;
  stars: number;
  text: string;
  timestamp: string;
  status_analisis: "BELUM_DIANALISIS" | "SUDAH_DIANALISIS";
  analisis: ReviewAnalysis | null;
}

export default function UlasanMapsPage() {
  const [reviews, setReviews] = useState<MapsReview[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [filterOutlet, setFilterOutlet] = useState<string>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Q&A Collapse States
  const [qaOpen, setQaOpen] = useState<boolean>(false);
  
  // Simulation Form States
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [simName, setSimName] = useState<string>("");
  const [simStars, setSimStars] = useState<number>(5);
  const [simText, setSimText] = useState<string>("");
  const [simOutlet, setSimOutlet] = useState<string>("TGR044B");
  const [submittingSim, setSubmittingSim] = useState<boolean>(false);
  const [syncingGoogle, setSyncingGoogle] = useState<boolean>(false);

  const OUTLET_LIST = [
    { id: "TGR044B", name: "J&T Cargo Balaraja (TGR044B)" },
    { id: "JYT-CRG", name: "J&T Cargo Jayanti Cikande" },
    { id: "BLR-EXP", name: "J&T Express Balaraja (MDP Pasir Jaha)" },
    { id: "JYT-EXP", name: "J&T Express Jayanti Cikande (MDP)" }
  ];

  // Fetch reviews on mount
  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/getReviews");
      const json = await res.json();
      if (json.status === "success") {
        setReviews(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch reviews:", err);
    } finally {
      setLoading(false);
    }
  };

  // Sync with Google API
  const handleSyncGoogle = async () => {
    setSyncingGoogle(true);
    try {
      const res = await fetch("/api/syncGoogleReviews", { method: "POST" });
      const json = await res.json();
      if (json.status === "success") {
        toast.success(json.message);
        setReviews(json.data);
      } else {
        toast.error(json.message);
      }
    } catch (err) {
      console.error("Failed to sync google reviews:", err);
      toast.error("Terjadi kesalahan jaringan saat menarik data Google Maps.");
    } finally {
      setSyncingGoogle(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  // Trigger AI Analysis for a specific review
  const handleAnalyze = async (reviewId: string) => {
    setAnalyzingId(reviewId);
    try {
      const res = await fetch("/api/analyzeReview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reviewId })
      });
      const json = await res.json();
      if (json.status === "success") {
        // Update review state with results
        setReviews(prev => prev.map(r => r.id === reviewId ? {
          ...r,
          status_analisis: "SUDAH_DIANALISIS",
          analisis: json.data
        } : r));
      } else {
        toast.error(json.message || "Gagal menganalisis ulasan.");
      }
    } catch (err) {
      console.error("Error analyzing review:", err);
      toast.error("Terjadi kesalahan jaringan saat memanggil Gemini.");
    } finally {
      setAnalyzingId(null);
    }
  };

  // Submit Simulated Review
  const handleAddSimulatedReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simText && simStars < 4) {
      // Allow empty text for 1 star (fake review test cases)
    } else if (!simText && simStars >= 4) {
      toast.error("Masukkan teks ulasan untuk ulasan positif.");
      return;
    }

    setSubmittingSim(true);
    try {
      const res = await fetch("/api/addReview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: simOutlet,
          stars: simStars,
          text: simText,
          reviewer: simName.trim() || "Simulasi Pengguna"
        })
      });
      const json = await res.json();
      if (json.status === "success") {
        setReviews(prev => [json.data, ...prev]);
        setSimName("");
        setSimText("");
        setSimStars(5);
        setFormOpen(false);
        // Automatically trigger AI analysis on the newly created review
        handleAnalyze(json.data.id);
      }
    } catch (err) {
      console.error("Failed to add review simulation:", err);
    } finally {
      setSubmittingSim(false);
    }
  };

  // Delete review
  const handleDeleteReview = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus ulasan simulasi ini?")) return;
    try {
      const res = await fetch("/api/deleteReview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const json = await res.json();
      if (json.status === "success") {
        setReviews(prev => prev.filter(r => r.id !== id));
      }
    } catch (err) {
      console.error("Error deleting review:", err);
    }
  };

  const handleCopy = (text: string, elementId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(elementId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredReviews = filterOutlet === "ALL" 
    ? reviews 
    : reviews.filter(r => r.outlet_id === filterOutlet);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 font-sans" id="ulasan-maps-view">
      
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-red-600 to-[#E4002B] text-white rounded-3xl p-6 md:p-8 shadow-xl shadow-red-500/10 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-12 translate-y-12">
          <Building className="w-96 h-96" />
        </div>
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold font-mono tracking-wide uppercase">
            <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
            Asisten Reputasi Digital J&T
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">
            Manajemen & Analisis Ulasan Google Maps
          </h1>
          <p className="text-xs md:text-sm text-red-50/90 leading-relaxed font-medium">
            Monitor, analisis, dan tanggapi ulasan Google Maps dari 4 outlet J&T Anda secara cerdas menggunakan kecerdasan buatan Gemini AI. Otomatis tangani keluhan salah alamat serta draf banding ulasan palsu/spam.
          </p>
        </div>
      </div>

      {/* ALERT INFO */}
      <div className="bg-blue-50/60 border border-blue-150 rounded-2xl p-4 flex gap-3 text-xs text-blue-800 leading-relaxed">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block mb-0.5">Simulasi Dasbor Terintegrasi:</span>
          Daftar ulasan yang ditampilkan di bawah ini disimulasikan secara dinamis berdasarkan data profil Google Maps asli Anda. Anda dapat menganalisis dan menanggapi masing-masing ulasan menggunakan asisten kecerdasan buatan (AI) terintegrasi.
        </div>
      </div>

      {/* FILTER & ACTIONS BAR */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        
        {/* OUTLET FILTER TAB */}
        <div className="flex flex-wrap gap-1.5 bg-gray-100/80 p-1.5 rounded-2xl border border-gray-200">
          <button
            onClick={() => setFilterOutlet("ALL")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterOutlet === "ALL" 
                ? "bg-white text-[#E4002B] shadow-sm font-extrabold" 
                : "text-gray-600 hover:text-gray-800 hover:bg-white/40"
            }`}
          >
            Semua Outlet ({reviews.length})
          </button>
          {OUTLET_LIST.map((o) => {
            const count = reviews.filter(r => r.outlet_id === o.id).length;
            return (
              <button
                key={o.id}
                onClick={() => setFilterOutlet(o.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterOutlet === o.id 
                    ? "bg-white text-[#E4002B] shadow-sm font-extrabold" 
                    : "text-gray-600 hover:text-gray-800 hover:bg-white/40"
                }`}
              >
                {o.id === "TGR044B" ? "TGR044B (Cargo)" : o.id === "JYT-CRG" ? "Jayanti Cargo" : o.id === "BLR-EXP" ? "Balaraja Express" : "Jayanti Express"} ({count})
              </button>
            );
          })}
        </div>

        {/* BUTTON ADD SIMULATION */}
        <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
          <button
            onClick={handleSyncGoogle}
            disabled={syncingGoogle}
            className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncingGoogle ? "animate-spin" : ""}`} />
            {syncingGoogle ? "Menarik Data..." : "Tarik Ulasan Asli Google"}
          </button>

          <button
            onClick={() => setFormOpen(!formOpen)}
            className="flex items-center gap-2 bg-gray-900 text-white hover:bg-gray-800 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            Simulasikan Ulasan Baru
          </button>

          <button
            onClick={fetchReviews}
            disabled={loading}
            className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
            title="Refresh Data Lokal"
          >
            <RefreshCw className={`h-4 w-4 ${loading && !syncingGoogle ? "animate-spin" : ""}`} />
          </button>
        </div>

      </div>

      {/* COLLAPSIBLE ADD SIMULATED REVIEW FORM */}
      {formOpen && (
        <div className="bg-white rounded-2xl border border-gray-150 p-6 shadow-sm space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Plus className="h-4 w-4 text-[#E4002B]" />
              Form Simulasi Ulasan Baru Google Maps
            </h3>
            <button 
              onClick={() => setFormOpen(false)}
              className="text-gray-400 hover:text-gray-600 text-xs"
            >
              Batal
            </button>
          </div>

          <form onSubmit={handleAddSimulatedReview} className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            <div className="md:col-span-4 space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">Nama Pengulas (Google Account)</label>
              <input
                type="text"
                placeholder="Contoh: Budi Cahyono"
                value={simName}
                onChange={(e) => setSimName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-4 space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">Target Outlet J&T</label>
              <select
                value={simOutlet}
                onChange={(e) => setSimOutlet(e.target.value)}
                className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
              >
                {OUTLET_LIST.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4 space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">Rating Bintang (Stars)</label>
              <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setSimStars(star)}
                    className="p-0.5 text-gray-300 hover:scale-115 transition-transform"
                  >
                    <Star 
                      className={`h-5 w-5 ${
                        star <= simStars ? "text-yellow-400 fill-yellow-400" : "text-gray-200"
                      }`} 
                    />
                  </button>
                ))}
                <span className="text-xs font-bold text-gray-700 ml-2">{simStars} Bintang</span>
              </div>
            </div>

            <div className="md:col-span-12 space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">
                Teks Ulasan (Kosongkan jika ingin menyimulasikan ulasan bintang 1 spam/tanpa teks)
              </label>
              <textarea
                placeholder="Ketik isi ulasan disini... (misal keluhan salah alamat, ulasan positif, atau spam)"
                value={simText}
                onChange={(e) => setSimText(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-xl p-3 text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-12 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submittingSim}
                className="px-5 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-[#E4002B] disabled:opacity-50 cursor-pointer"
              >
                {submittingSim ? "Menambahkan..." : "Simpan & Analisis AI"}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* REVIEWS LIST */}
      <div className="space-y-6">
        
        {loading ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-gray-150 space-y-2">
            <RefreshCw className="h-8 w-8 text-red-500 animate-spin mx-auto" />
            <p className="text-xs font-semibold text-gray-500">Memuat data ulasan dari server...</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-gray-150 space-y-2">
            <Info className="h-8 w-8 text-gray-400 mx-auto" />
            <p className="text-sm font-bold text-gray-700">Tidak ada ulasan ditemukan</p>
            <p className="text-xs text-gray-400">Gunakan tombol "Simulasikan Ulasan Baru" di atas untuk menambahkan contoh kasus ulasan.</p>
          </div>
        ) : (
          filteredReviews.map((review) => {
            const isAnalyzing = analyzingId === review.id;
            
            return (
              <div 
                key={review.id} 
                className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                  review.status_analisis === "SUDAH_DIANALISIS" 
                    ? "border-gray-200 shadow-sm" 
                    : "border-yellow-200 bg-yellow-50/5/30 border-dashed"
                }`}
              >
                {/* Review Card Header */}
                <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-gray-100">
                  
                  <div className="space-y-1.5">
                    
                    {/* Stars and Reviewer */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star 
                            key={s} 
                            className={`h-4 w-4 ${
                              s <= review.stars ? "text-yellow-400 fill-yellow-400" : "text-gray-200"
                            }`} 
                          />
                        ))}
                      </div>
                      <span className="text-xs font-extrabold text-gray-800">{review.reviewer}</span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(review.timestamp).toLocaleDateString("id-ID", {
                          day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
                        })}
                      </span>
                    </div>

                    {/* Outlet Name Tag */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                      <Building className="h-3.5 w-3.5 text-gray-400" />
                      <span>{review.nama_outlet}</span>
                      <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase">{review.outlet_id}</span>
                    </div>

                    {/* Review Text */}
                    <div className="pt-2 text-xs text-gray-700 leading-relaxed font-normal">
                      {review.text ? (
                        <p className="italic bg-gray-50 p-3 rounded-xl border border-gray-150">
                          "{review.text}"
                        </p>
                      ) : (
                        <span className="text-gray-400 italic bg-gray-50/50 p-2 rounded-lg border border-gray-100 inline-block">
                          (Tidak meninggalkan teks ulasan, hanya peringkat bintang saja)
                        </span>
                      )}
                    </div>

                  </div>

                  {/* Actions right side */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-start">
                    
                    {/* Delete simulated review */}
                    <button
                      onClick={() => handleDeleteReview(review.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                      title="Hapus Ulasan Simulasi"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    {/* AI Trigger */}
                    <button
                      onClick={() => handleAnalyze(review.id)}
                      disabled={isAnalyzing}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        review.status_analisis === "SUDAH_DIANALISIS"
                          ? "bg-gray-100 hover:bg-gray-150 text-gray-700"
                          : "bg-gradient-to-r from-red-600 to-[#E4002B] hover:opacity-90 text-white shadow-md shadow-red-500/10"
                      }`}
                    >
                      {isAnalyzing ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Menganalisis...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
                          <span>{review.status_analisis === "SUDAH_DIANALISIS" ? "Ulangi Analisis AI" : "Mulai Analisis AI"}</span>
                        </>
                      )}
                    </button>

                  </div>

                </div>

                {/* AI Analysis Display Panel */}
                {review.status_analisis === "SUDAH_DIANALISIS" && review.analisis && (
                  <div className="bg-gray-50/50 p-5 md:p-6 border-t border-gray-100 space-y-5 animate-fadeIn">
                    
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                      
                      {/* Left: Metadata info */}
                      <div className="md:col-span-4 space-y-4">
                        
                        {/* Condition Badge */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">Kategori Terdeteksi</span>
                          {review.analisis.category === "POSITIVE" && (
                            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full text-xs font-extrabold uppercase">
                              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                              POSITIVE (Sangat Baik)
                            </span>
                          )}
                          {review.analisis.category === "MISPLACED" && (
                            <span className="inline-flex items-center gap-1.5 bg-yellow-50 text-yellow-800 border border-yellow-200 px-3 py-1.5 rounded-full text-xs font-extrabold uppercase">
                              <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                              MISPLACED (Salah Alamat)
                            </span>
                          )}
                          {review.analisis.category === "FAKE" && (
                            <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-full text-xs font-extrabold uppercase">
                              <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
                              FAKE/SPAM (Ulasan Palsu)
                            </span>
                          )}
                        </div>

                        {/* Reason / Explanation */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">Alasan Analisis AI</span>
                          <p className="text-xs text-gray-600 leading-relaxed font-medium bg-white p-3 rounded-xl border border-gray-150 shadow-xs">
                            {review.analisis.reason}
                          </p>
                        </div>

                        {/* Action Steps Recommendation */}
                        <div className="bg-white p-3.5 rounded-xl border border-gray-150 space-y-2">
                          <span className="text-[10px] font-extrabold text-gray-700 uppercase tracking-wider block">Rekomendasi Tindakan:</span>
                          <ul className="text-[11px] text-gray-500 space-y-1.5 list-disc list-inside">
                            {review.analisis.category === "POSITIVE" && (
                              <>
                                <li>Salin tanggapan di samping kanan.</li>
                                <li>Balas ulasan di Google Maps Dashboard untuk meningkatkan reputasi rating outlet Anda.</li>
                              </>
                            )}
                            {review.analisis.category === "MISPLACED" && (
                              <>
                                <li>Gunakan tanggapan klarifikasi di samping untuk mengedukasi pelanggan.</li>
                                <li>Laporkan ulasan sebagai <span className="font-bold text-red-600">"Off-topic"</span> via tombol bendera ulasan Google Maps karena pengantaran adalah wewenang pusat.</li>
                              </>
                            )}
                            {review.analisis.category === "FAKE" && (
                              <>
                                <li>Ulasan terdeteksi sebagai spam / kecurangan tanpa bukti transaksi.</li>
                                <li><span className="font-bold text-red-600">SANGAT PENTING:</span> Kirimkan draf banding resmi bahasa Inggris di bawah ini ke Google GBP Help Desk.</li>
                              </>
                            )}
                          </ul>
                        </div>

                      </div>

                      {/* Right: Responses / Appeal copy sections */}
                      <div className="md:col-span-8 space-y-4">
                        
                        {/* Indonesian Reply Output */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                              {review.analisis.category === "FAKE" ? "Respons Klarifikasi (Bahasa Indonesia)" : "Draf Balasan Ulasan Resmi (Bahasa Indonesia)"}
                            </span>
                            <button
                              onClick={() => handleCopy(review.analisis?.reply || "", `reply-${review.id}`)}
                              className="inline-flex items-center gap-1 text-[10px] text-red-600 font-bold hover:underline"
                            >
                              {copiedId === `reply-${review.id}` ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-500" />
                                  <span className="text-emerald-500">Tersalin!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>Salin Teks</span>
                                </>
                              )}
                            </button>
                          </div>
                          <div className="relative bg-white rounded-xl border border-gray-150 p-4 font-sans text-xs text-gray-700 leading-relaxed shadow-xs">
                            {review.analisis.reply}
                          </div>
                        </div>

                        {/* If FAKE, show Google Support official English appeal drafts */}
                        {review.analisis.category === "FAKE" && (
                          <div className="space-y-4 pt-2 border-t border-gray-100">
                            
                            {/* English Appeal Draft */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold text-[#E4002B] uppercase tracking-wider flex items-center gap-1">
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 animate-pulse" />
                                  Google Support Official Appeal (English Draft)
                                </span>
                                <button
                                  onClick={() => handleCopy(review.analisis?.appealDraftEnglish || "", `appeal-en-${review.id}`)}
                                  className="inline-flex items-center gap-1 text-[10px] text-red-600 font-bold hover:underline"
                                >
                                  {copiedId === `appeal-en-${review.id}` ? (
                                    <>
                                      <Check className="h-3 w-3 text-emerald-500" />
                                      <span className="text-emerald-500">Tersalin!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3" />
                                      <span>Salin Appeal</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <div className="bg-gray-900 text-gray-100 rounded-xl p-4 font-mono text-[11px] leading-relaxed max-h-48 overflow-y-auto">
                                {review.analisis.appealDraftEnglish}
                              </div>
                            </div>

                            {/* Indonesian translation of appeal */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                  Terjemahan Bahasa Indonesia Draf Banding Google Support
                                </span>
                                <button
                                  onClick={() => handleCopy(review.analisis?.appealDraftIndonesian || "", `appeal-id-${review.id}`)}
                                  className="inline-flex items-center gap-1 text-[10px] text-red-600 font-bold hover:underline"
                                >
                                  {copiedId === `appeal-id-${review.id}` ? (
                                    <>
                                      <Check className="h-3 w-3 text-emerald-500" />
                                      <span className="text-emerald-500">Tersalin!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3" />
                                      <span>Salin Terjemahan</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <div className="bg-white rounded-xl border border-gray-150 p-4 font-sans text-xs text-gray-600 leading-relaxed max-h-48 overflow-y-auto">
                                {review.analisis.appealDraftIndonesian}
                              </div>
                            </div>

                          </div>
                        )}

                      </div>

                    </div>

                  </div>
                )}

              </div>
            );
          })
        )}

      </div>

      {/* Q&A COLLAPSIBLE MODULE */}
      <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-xs">
        <button
          onClick={() => setQaOpen(!qaOpen)}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">
                Tanya Jawab (Q&A): Apakah Ulasan Google Maps Dapat Muncul Secara Otomatis?
              </h3>
              <p className="text-xs text-gray-400">
                Ketahui kelayakan teknis penarikan otomatis ulasan secara real-time.
              </p>
            </div>
          </div>
          {qaOpen ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
        </button>

        {qaOpen && (
          <div className="px-6 pb-6 border-t border-gray-100 pt-4 space-y-4 text-xs text-gray-600 leading-relaxed">
            <p>
              <strong>Jawaban Singkat:</strong> <span className="text-emerald-700 font-bold">Ya, sangat bisa!</span> Namun, untuk menarik data ulasan Google Maps secara otomatis dan real-time ke dalam aplikasi ini, terdapat beberapa detail penting yang perlu Anda ketahui:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-150 space-y-1.5">
                <span className="font-bold text-gray-800 text-xs block">1. Kebutuhan Google Business Profile API</span>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Google menyediakan API khusus bernama <strong>Google Business Profile API</strong> (sebelumnya Google My Business API) untuk mengelola ulasan bisnis Anda. Endpoint ini memerlukan otentikasi akun Google yang memiliki hak kepemilikan/pengelola atas 4 lokasi outlet J&T yang didaftarkan.
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-150 space-y-1.5">
                <span className="font-bold text-gray-800 text-xs block">2. Alur Integrasi Real-Time</span>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Pada lingkungan produksi di Vercel, kita dapat mengatur webhook dari Google Maps API atau melakukan polling berkala (misalnya setiap 1 jam sekali). Setiap ulasan baru yang dideteksi akan otomatis masuk ke tabel database, dikategorikan oleh Gemini AI, lalu memberi notifikasi ke admin J&T OPS PRO.
                </p>
              </div>
            </div>
            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 text-[11px] text-blue-800 flex gap-2">
              <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>Status Saat Ini:</strong> Anda telah dapat menarik data langsung menggunakan tombol <strong>"Tarik Ulasan Asli Google"</strong> dengan memanfaatkan Google Places API Key. Harap pastikan bahwa Anda telah mengisi <code>GOOGLE_API_KEY</code> di dalam pengaturan rahasia (Secrets) dan memasukkan ID Tempat (Place ID) asli dari outlet Anda di dalam backend.
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
