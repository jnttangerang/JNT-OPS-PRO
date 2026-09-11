import React, { useState, useEffect, useRef } from "react";
import { MasterTransaksi, EXPResi, User, Outlet, PromoReviewValidation } from "../types";
import { Check, X, Upload, FileText, AlertTriangle, Filter, Search, Copy, CheckCircle, Clock } from "lucide-react";
import { toast } from "../utils/toast";

interface Props {
  session: User | null;
  outlets: Outlet[];
}

export default function ValidasiPromo5Bintang({ session, outlets }: Props) {
  const [candidates, setCandidates] = useState<EXPResi[]>([]);
  const [validations, setValidations] = useState<PromoReviewValidation[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<EXPResi | null>(null);
  
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
  
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewerName, setReviewerName] = useState("");
  const [reviewUrl, setReviewUrl] = useState("");
  
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedValidation, setSelectedValidation] = useState<PromoReviewValidation | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = session?.role === "ADMIN";
  const isOwner = session?.role === "OWNER";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch transactions (EXP_Resi) to find candidates
      // Note: We'll fetch all EXP_Resi to filter candidates.
      // A better way is to call a backend API, but for this Phase we can reuse the global data if accessible, or just make an API.
      // Wait, there is no direct GET /api/getEXP_Resi from frontend? Let's check `api/getEXP_Resi`.
      
      const resExp = await fetch("/api/getEXP_Resi");
      if (!resExp.ok) throw new Error("Gagal mengambil data transaksi");
      const dataExp = await resExp.json();
      
      const resVal = await fetch("/api/getPromoReviewValidations");
      if (!resVal.ok) throw new Error("Gagal mengambil data validasi");
      const dataVal = await resVal.json();

      const allExp: EXPResi[] = dataExp.data || [];
      const allVal: PromoReviewValidation[] = dataVal.data || [];

      // Filter candidates: VIP + EZ + discount > 0
      const cands = allExp.filter(tx => {
        const source = (tx.source_order || "VIP").toUpperCase();
        const type = (tx.tipe_produk || "EZ").toUpperCase();
        const discount = tx.discount_from_yoyi || 0;
        
        // Match conditions
        if (source !== "VIP" || type !== "EZ" || discount <= 0) return false;
        
        // Make sure it hasn't been submitted (PENDING or APPROVED)
        const existing = allVal.find(v => v.resi_id === tx.resi_id && (v.status === "PENDING" || v.status === "APPROVED"));
        if (existing) return false;
        
        return true;
      });

      setCandidates(cands);
      setValidations(allVal);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setEvidenceFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEvidencePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitValidation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidate) return;
    if (!evidencePreview) {
      toast.error("Bukti ulasan 5★ wajib diupload!");
      return;
    }

    try {
      toast.info("Mengunggah bukti...");
      
      // Upload evidence
      const uploadRes = await fetch("/api/uploadFile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64: evidencePreview,
          fileName: `FOTO_PROMO_${selectedCandidate.resi_id}`,
          category: "BUKTI_PROMO"
        })
      });
      const uploadData = await uploadRes.json();
      if (uploadData.status !== "success") {
        toast.error(uploadData.message);
        return;
      }

      const evidenceUrl = uploadData.data;

      // Submit validation
      const submitRes = await fetch("/api/submitPromoReviewValidation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: selectedCandidate.transaksi_id,
          resi_id: selectedCandidate.resi_id,
          admin_id: session?.user_id || session?.username || "ADMIN",
          evidence_file_url: evidenceUrl,
          review_rating: reviewRating,
          reviewer_name: reviewerName,
          review_url: reviewUrl
        })
      });
      const submitData = await submitRes.json();
      
      if (submitData.status === "success") {
        toast.success("Pengajuan validasi berhasil dikirim!");
        setIsSubmitModalOpen(false);
        fetchData();
      } else {
        toast.error(submitData.message);
      }
    } catch (err: any) {
      toast.error("Terjadi kesalahan sistem: " + err.message);
    }
  };

  const handleApprove = async (validationId: string) => {
    if (!window.confirm("Setujui promo diskon untuk transaksi ini?")) return;
    
    try {
      const res = await fetch("/api/approvePromoReviewValidation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          validation_id: validationId,
          owner_id: session?.user_id || session?.username || "OWNER"
        })
      });
      const data = await res.json();
      if (data.status === "success") {
        toast.success("Promo berhasil disetujui (Status PENDING -> APPROVED)!");
        setIsReviewModalOpen(false);
        fetchData();
      } else {
        toast.error(data.message);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleReject = async (validationId: string) => {
    if (!rejectionReason.trim()) {
      toast.error("Alasan penolakan wajib diisi!");
      return;
    }
    if (!window.confirm("Tolak promo diskon ini?")) return;
    
    try {
      const res = await fetch("/api/rejectPromoReviewValidation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          validation_id: validationId,
          owner_id: session?.user_id || session?.username || "OWNER",
          reason: rejectionReason
        })
      });
      const data = await res.json();
      if (data.status === "success") {
        toast.success("Promo berhasil ditolak!");
        setIsReviewModalOpen(false);
        fetchData();
      } else {
        toast.error(data.message);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* KANDIDAT PROMO (DILIHAT OLEH SEMUA, TAPI HANYA ADMIN YG BIASA SUBMIT) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Kandidat Promo (Menunggu Pengajuan Bukti)
            </h2>
            <p className="text-xs text-gray-500 mt-1">Transaksi VIP + EZ yang memiliki diskon dari YoYi namun belum diajukan buktinya.</p>
          </div>
          <div className="text-xs font-mono bg-white px-3 py-1 rounded border border-gray-200 font-bold">
            {candidates.length} Kandidat
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 bg-gray-50 uppercase">
              <tr>
                <th className="px-4 py-3 border-b">No. Resi</th>
                <th className="px-4 py-3 border-b">Outlet</th>
                <th className="px-4 py-3 border-b">Sumber / Tipe</th>
                <th className="px-4 py-3 border-b text-right">Diskon YoYi</th>
                <th className="px-4 py-3 border-b">Status</th>
                <th className="px-4 py-3 border-b text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-xs">Memuat kandidat...</td></tr>
              ) : candidates.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-xs italic">Tidak ada kandidat promo tersedia.</td></tr>
              ) : (
                candidates.map((c, idx) => (
                  <tr key={idx} className="border-b border-gray-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-gray-800">{c.resi_id}</td>
                    <td className="px-4 py-3 text-xs">{c.outlet_id_input}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold">{c.source_order || "VIP"}</span>
                        <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded text-[10px] font-bold">{c.tipe_produk || "EZ"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                      Rp {(c.discount_from_yoyi || 0).toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] font-bold">KANDIDAT</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button 
                        disabled={!isAdmin}
                        onClick={() => {
                          setSelectedCandidate(c);
                          setEvidenceFile(null);
                          setEvidencePreview(null);
                          setReviewerName("");
                          setReviewUrl("");
                          setReviewRating(5);
                          setIsSubmitModalOpen(true);
                        }}
                        className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${isAdmin ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                      >
                        Upload Bukti
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RIWAYAT / DAFTAR VALIDASI PROMO */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              Daftar Pengajuan Validasi 5★
            </h2>
          </div>
          <div className="text-xs font-mono bg-white px-3 py-1 rounded border border-gray-200 font-bold">
            {validations.length} Pengajuan
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 bg-gray-50 uppercase">
              <tr>
                <th className="px-4 py-3 border-b">No. Resi</th>
                <th className="px-4 py-3 border-b">Diskon YoYi (Fakta)</th>
                <th className="px-4 py-3 border-b">Waktu Pengajuan</th>
                <th className="px-4 py-3 border-b">Oleh</th>
                <th className="px-4 py-3 border-b">Status</th>
                <th className="px-4 py-3 border-b text-center">Aksi (Owner)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-xs">Memuat pengajuan...</td></tr>
              ) : validations.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-xs italic">Belum ada pengajuan validasi.</td></tr>
              ) : (
                validations.map((v, idx) => (
                  <tr key={idx} className="border-b border-gray-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-gray-800">{v.resi_id}</td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-600">Rp {v.discount_from_yoyi.toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(v.submitted_at).toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium">{v.submitted_by}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                        v.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                        v.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button 
                        onClick={() => {
                          setSelectedValidation(v);
                          setRejectionReason("");
                          setIsReviewModalOpen(true);
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm"
                      >
                        Buka Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* MODAL SUBMIT (ADMIN) */}
      {isSubmitModalOpen && selectedCandidate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-500" />
                Upload Bukti Ulasan 5★
              </h3>
              <button onClick={() => setIsSubmitModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmitValidation} className="p-5 overflow-y-auto space-y-4">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-800">
                Resi: <strong className="font-mono">{selectedCandidate.resi_id}</strong><br/>
                Diskon dari YoYi: <strong className="font-mono">Rp {(selectedCandidate.discount_from_yoyi||0).toLocaleString("id-ID")}</strong>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Bukti Screenshot (Wajib)</label>
                <input 
                  type="file" 
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                {evidencePreview ? (
                  <div className="relative rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                    <img src={evidencePreview} alt="Preview" className="w-full h-48 object-contain" />
                    <button 
                      type="button" 
                      onClick={() => { setEvidenceFile(null); setEvidencePreview(null); if(fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-lg shadow-sm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-600">Klik untuk memilih foto/screenshot</p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG, JPEG (Max 5MB)</p>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nama Reviewer (Opsional)</label>
                  <input type="text" value={reviewerName} onChange={e=>setReviewerName(e.target.value)} className="w-full border-gray-300 rounded-lg text-sm p-2 bg-gray-50 focus:bg-white border focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="Misal: Budi Santoso" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Rating</label>
                  <select value={reviewRating} onChange={e=>setReviewRating(Number(e.target.value))} className="w-full border-gray-300 rounded-lg text-sm p-2 bg-gray-50 focus:bg-white border focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                    <option value={5}>5 Bintang ⭐️⭐️⭐️⭐️⭐️</option>
                    <option value={4}>4 Bintang ⭐️⭐️⭐️⭐️</option>
                    <option value={3}>3 Bintang ⭐️⭐️⭐️</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Link URL Ulasan (Opsional)</label>
                <input type="text" value={reviewUrl} onChange={e=>setReviewUrl(e.target.value)} className="w-full border-gray-300 rounded-lg text-sm p-2 bg-gray-50 focus:bg-white border focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="https://maps.google.com/..." />
              </div>

              <div className="pt-2">
                <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm">
                  Ajukan Validasi Promo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* MODAL REVIEW / DETAIL (OWNER) */}
      {isReviewModalOpen && selectedValidation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-gray-900">Detail Validasi Promo 5★</h3>
              <button onClick={() => setIsReviewModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  selectedValidation.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                  selectedValidation.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  Status: {selectedValidation.status}
                </span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(selectedValidation.submitted_at).toLocaleString("id-ID")}
                </span>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 grid grid-cols-2 gap-y-2 text-xs">
                <div>
                  <span className="text-gray-500 block">No. Resi</span>
                  <span className="font-mono font-bold text-gray-900">{selectedValidation.resi_id}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Diskon dari YoYi</span>
                  <span className="font-mono font-bold text-emerald-600">Rp {selectedValidation.discount_from_yoyi.toLocaleString("id-ID")}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Sumber / Tipe</span>
                  <span className="font-bold">{selectedValidation.source_order} / {selectedValidation.tipe_produk}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Diajukan Oleh</span>
                  <span className="font-bold text-gray-900">{selectedValidation.submitted_by}</span>
                </div>
                {selectedValidation.reviewer_name && (
                  <div>
                    <span className="text-gray-500 block">Nama Reviewer</span>
                    <span className="font-bold">{selectedValidation.reviewer_name}</span>
                  </div>
                )}
                {selectedValidation.review_rating && (
                  <div>
                    <span className="text-gray-500 block">Rating Diajukan</span>
                    <span className="font-bold text-amber-500">{selectedValidation.review_rating} Bintang</span>
                  </div>
                )}
              </div>

              {selectedValidation.evidence_file_url && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Bukti Screenshot</label>
                  <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                    <img src={selectedValidation.evidence_file_url} alt="Bukti" className="max-h-64 object-contain" />
                  </div>
                  {selectedValidation.evidence_file_url && (
                    <a href={selectedValidation.evidence_file_url} target="_blank" rel="noreferrer" className="text-indigo-600 text-[10px] mt-1 inline-block hover:underline">Buka Gambar Penuh</a>
                  )}
                </div>
              )}

              {selectedValidation.status === "PENDING" && isOwner && (
                <div className="pt-2 space-y-3">
                  <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-800 leading-tight">
                      <strong>Perhatian:</strong> Menyetujui (Approve) form ini berarti OWNER menyatakan bukti valid. 
                      Namun, **Sistem Keuangan/Master Transaksi belum akan memotong uang (diskon) secara otomatis** sampai Phase 3 diluncurkan. 
                      Approve ini murni validasi bisnis saja.
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Alasan Penolakan (Wajib jika REJECT)</label>
                    <input 
                      type="text" 
                      value={rejectionReason} 
                      onChange={e=>setRejectionReason(e.target.value)} 
                      placeholder="Misal: Bukti screenshot buram, rating cuma 4 bintang..."
                      className="w-full text-xs p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleReject(selectedValidation.id)} className="flex-1 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-lg text-sm shadow-sm transition-colors">
                      Tolak (REJECT)
                    </button>
                    <button onClick={() => handleApprove(selectedValidation.id)} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm shadow-sm transition-colors">
                      Setujui (APPROVE)
                    </button>
                  </div>
                </div>
              )}

              {selectedValidation.status !== "PENDING" && (
                <div className="bg-gray-100 p-3 rounded-lg text-xs space-y-1">
                  <p><span className="text-gray-500">Direview Oleh:</span> <strong>{selectedValidation.reviewed_by}</strong></p>
                  <p><span className="text-gray-500">Waktu Review:</span> <strong>{selectedValidation.reviewed_at ? new Date(selectedValidation.reviewed_at).toLocaleString("id-ID") : "-"}</strong></p>
                  {selectedValidation.status === "REJECTED" && (
                    <p className="text-red-700 mt-1 bg-red-50 p-2 rounded border border-red-100">
                      <strong>Alasan Penolakan:</strong> {selectedValidation.rejection_reason}
                    </p>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
