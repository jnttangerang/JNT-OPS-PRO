import React, { useState, useEffect } from 'react';
import { useAppsScript } from '../../hooks/useAppsScript';
import { CheckCircle, AlertTriangle, ChevronRight, Upload, X, DollarSign, Loader2, Check, Edit3, ExternalLink } from 'lucide-react';
import { calculateFinancialSummary } from '../../lib/financialEngine';

interface LengkapiYoYiPageProps {
  session: any;
  outlets: any[];
  activeOutletId?: string;
}

export default function LengkapiYoYiPage({ session, outlets, activeOutletId }: LengkapiYoYiPageProps) {
  const { callBackend } = useAppsScript();
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'SEMUA' | 'BELUM' | 'LENGKAP'>('SEMUA');
  
  const [isSetoranModalOpen, setSetoranModalOpen] = useState(false);
  const [setoranTargetDate, setSetoranTargetDate] = useState<string | null>(null);
  const [setoranExpectedCash, setSetoranExpectedCash] = useState(0);
  const [setoranKasOutlet, setSetoranKasOutlet] = useState(0);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      if (session.role === "ADMIN") qs.append("admin_id", session.user_id);
      if (activeOutletId) qs.append("outlet_id", activeOutletId);
      
      const resData = await fetch('/api/yoyi/summary?' + qs.toString());
      const res = await resData.json();
      
      if (res && res.status === 'success') {
        setSummary(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [activeOutletId]);

  const filteredSummary = summary.filter(s => {
    const isLengkap = s.transaksi_lengkap >= s.total_transaksi;
    if (filterMode === 'BELUM') return !isLengkap;
    if (filterMode === 'LENGKAP') return isLengkap;
    return true;
  });
  
  const completedCount = summary.filter(s => s.transaksi_lengkap >= s.total_transaksi).length;

  const openSetoran = (date: string, expected: number, kas_outlet: number) => {
    setSetoranTargetDate(date);
    setSetoranExpectedCash(expected);
    setSetoranKasOutlet(kas_outlet);
    setSetoranModalOpen(true);
  };

  if (activeDate) {
    return <YoYiDetailView 
      tanggal={activeDate} 
      onBack={() => { setActiveDate(null); fetchSummary(); }} 
      session={session} 
      outlets={outlets}
      activeOutletId={activeOutletId}
      onSetoran={(expected, kas_outlet) => openSetoran(activeDate, expected, kas_outlet)}
    />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lengkapi Transaksi YoYi</h1>
          <p className="text-gray-500 mt-1">Periksa dan lengkapi bukti transaksi yang diimpor dari YoYi-WEB.</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-600">Progress Penyelesaian</p>
          <p className="text-xl font-bold text-blue-600">{completedCount} / {summary.length} tanggal selesai</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setFilterMode('SEMUA')} className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${filterMode === 'SEMUA' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Semua</button>
        <button onClick={() => setFilterMode('BELUM')} className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${filterMode === 'BELUM' ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Belum Lengkap</button>
        <button onClick={() => setFilterMode('LENGKAP')} className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${filterMode === 'LENGKAP' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Lengkap</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Tanggal</th>
              <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Progress</th>
              <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Total Nominal</th>
              <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Wajib Setor (Cash)</th>
              <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Kas Outlet</th>
              <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Status Transaksi</th>
              <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Status Setoran</th>
              <th className="px-5 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredSummary.map((s, idx) => {
              const isLengkap = s.transaksi_lengkap >= s.total_transaksi;
              const statusText = s.transaksi_lengkap === 0 ? "BELUM DIMULAI" : (isLengkap ? "LENGKAP" : "SEDANG DIKERJAKAN");
              const isSudahSetor = s.status_setoran === "SUDAH_SETOR" || s.status_setoran === "APPROVED";
              const isMenungguSetor = s.status_setoran === "MENUNGGU_APPROVAL";

              return (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4 font-medium text-gray-900">{s.tanggal}</td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-gray-600">{s.transaksi_lengkap} / {s.total_transaksi} transaksi</span>
                  </td>
                  <td className="px-5 py-4 font-medium text-gray-900">Rp {s.total_nominal.toLocaleString('id-ID')}</td>
                  <td className="px-5 py-4 font-medium text-red-600">Rp {s.wajib_setor.toLocaleString('id-ID')}</td>
                  <td className="px-5 py-4 font-medium text-emerald-600">Rp {(s.kas_outlet || 0).toLocaleString('id-ID')}</td>
                  <td className="px-5 py-4">
                    {isLengkap ? (
                      <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2.5 py-1 rounded-md text-xs font-semibold">
                        <CheckCircle className="w-3.5 h-3.5" /> LENGKAP
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md text-xs font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" /> {statusText}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {isSudahSetor ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md text-xs font-semibold">
                        <Check className="w-3.5 h-3.5" /> SUDAH SETOR
                      </span>
                    ) : isMenungguSetor ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md text-xs font-semibold">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> MENUNGGU APPROVAL
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md text-xs font-semibold">
                        BELUM SETOR
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button onClick={() => setActiveDate(s.tanggal)} className="inline-flex items-center gap-1 text-blue-600 font-medium text-sm hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                      Buka Detail <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      
      {isSetoranModalOpen && setoranTargetDate && (
        <InlineSetoranModal 
          isOpen={isSetoranModalOpen}
          onClose={() => setSetoranModalOpen(false)}
          targetDate={setoranTargetDate}
          expectedCash={setoranExpectedCash}
          outletCash={setoranKasOutlet}
          adminId={session.user_id}
          adminName={session.nama_lengkap}
          activeOutletId={activeOutletId}
          activeOutletName={outlets.find(o => o.outlet_id === activeOutletId)?.nama_outlet || ''}
          onSuccess={() => {
            setSetoranModalOpen(false);
            fetchSummary();
          }}
        />
      )}

    </div>
  );
}

function YoYiDetailView({ tanggal, onBack, session, outlets, onSetoran, activeOutletId }: any) {
  const { callBackend } = useAppsScript();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [criticalResis, setCriticalResis] = useState<string[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      qs.append("tanggal", tanggal);
      if (session.role === "ADMIN") qs.append("admin_id", session.user_id);
      if (activeOutletId) qs.append("outlet_id", activeOutletId);

      const resData = await fetch('/api/yoyi/transactions?' + qs.toString());
      const res = await resData.json();

      if (res && res.status === 'success') {
        setTransactions(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditYoyi = async () => {
    if (!activeOutletId || !tanggal) return;
    try {
      setAuditLoading(true);
      const qs = new URLSearchParams();
      qs.append("outlet_id", activeOutletId);
      qs.append("tanggal", tanggal);
      qs.append("user_role", session.role || "ADMIN");

      const resData = await fetch('/api/auditYoyiCompleteness?' + qs.toString());
      const res = await resData.json();

      if (res && res.status === "success" && Array.isArray(res.results)) {
        const missing = res.results
          .filter((r: any) => r.audit_status === "CRITICAL")
          .map((r: any) => r.resi_id);
        setCriticalResis(missing);
      } else {
        setCriticalResis([]);
      }
    } catch (e) {
      console.error("Gagal mengambil kelengkapan YoYi:", e);
      setCriticalResis([]);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchAuditYoyi();
  }, [tanggal, activeOutletId]);

  const allComplete = transactions.length > 0 && transactions.every(t => t.isLengkap);
  const finSummaries = transactions.map(t => calculateFinancialSummary(t));
  const totalNominal = finSummaries.reduce((sum, s) => sum + s.customer_payment, 0);
  const wajibSetor = finSummaries.reduce((sum, s) => sum + s.cash_payment, 0);
  const kasOutlet = finSummaries.reduce((sum, s) => sum + s.outlet_cash, 0);
  
  const statusSetoran = transactions[0]?.status_setoran || "BELUM_SETOR";
  const isSudahSetor = statusSetoran === "SUDAH_SETOR" || statusSetoran === "APPROVED";
  const isMenungguApproval = statusSetoran === "MENUNGGU_APPROVAL";

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors">
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Detail YoYi: {tanggal}</h2>
          <p className="text-sm text-gray-500">{transactions.length} transaksi diimpor</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status Transaksi</p>
          <div className="mt-2">
            {allComplete ? (
              <span className="inline-flex items-center gap-1.5 text-green-700 font-bold text-sm bg-green-50 px-2.5 py-1 rounded-lg">
                <CheckCircle className="w-4 h-4" /> LENGKAP
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-amber-700 font-bold text-sm bg-amber-50 px-2.5 py-1 rounded-lg">
                <AlertTriangle className="w-4 h-4" /> {transactions.filter(t => t.isLengkap).length}/{transactions.length} LENGKAP
              </span>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status Setoran</p>
          <div className="mt-2">
            {isSudahSetor ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-sm bg-emerald-50 px-2.5 py-1 rounded-lg">
                <Check className="w-4 h-4" /> SUDAH SETOR
              </span>
            ) : isMenungguApproval ? (
              <span className="inline-flex items-center gap-1.5 text-amber-700 font-bold text-sm bg-amber-50 px-2.5 py-1 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" /> MENUNGGU APPROVAL
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-gray-600 font-bold text-sm bg-gray-100 px-2.5 py-1 rounded-lg">
                BELUM SETOR
              </span>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Customer</p>
          <p className="text-lg font-bold text-gray-900 mt-1">Rp {totalNominal.toLocaleString('id-ID')}</p>
          <p className="text-xs text-gray-400 mt-0.5">{transactions.length} resi</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Wajib Setor (Cash)</p>
          <p className="text-lg font-bold text-red-600 mt-1">Rp {wajibSetor.toLocaleString('id-ID')}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">SUM cash_payment</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kas Outlet</p>
            <p className="text-lg font-bold text-emerald-600 mt-1">Rp {kasOutlet.toLocaleString('id-ID')}</p>
          </div>
          {allComplete && !isSudahSetor && !isMenungguApproval && (
            <button 
              onClick={() => onSetoran(wajibSetor, kasOutlet)}
              className="mt-2 w-full px-3 py-1.5 bg-gray-900 text-white rounded-lg font-semibold text-xs hover:bg-gray-800 transition-colors shadow-sm flex items-center justify-center gap-1"
            >
              <DollarSign className="w-3.5 h-3.5" /> Buat Setoran
            </button>
          )}
        </div>
      </div>

      {/* Admin Critical Banner for missing YoYi resis */}
      {criticalResis.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 text-red-900 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-red-900">{criticalResis.length} resi belum diinput ke sistem!</h4>
            <p className="text-xs text-red-700 font-medium">
              Silakan input transaksi berikut secara manual via workflow normal:
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {criticalResis.map((resi) => (
                <span key={resi} className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-800 font-mono text-[11px] font-extrabold rounded-md shadow-2xs border border-red-200 select-all transition-colors" title="Klik ganda untuk menyalin">
                  {resi}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="min-w-max w-full text-sm divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">No. Resi & Pengirim/Penerima</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Ongkir & Metode</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Biaya Tambahan</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Maps 5★</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Total Customer</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.map(tx => (
              <YoYiInlineRow key={tx.id || tx.no_resi} tx={tx} onUpdate={fetchTransactions} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function YoYiInlineRow({ tx, onUpdate }: { key?: string | number, tx: any, onUpdate: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  
  const [pengirim, setPengirim] = useState(tx.snapshot_nama_pengirim || tx.nama_pengirim || "");
  const [penerima, setPenerima] = useState(tx.snapshot_nama_penerima || tx.nama_penerima || "");
  
  const [ongkir, setOngkir] = useState(Number(tx.ongkir_customer ?? tx.ongkir_dasar ?? 0));
  const [mBayar, setMBayar] = useState(tx.metode_bayar || tx.metode_pembayaran_ongkir || "TUNAI");
  const [buktiBayar, setBuktiBayar] = useState(tx.bukti_bayar_url || "");
  
  const initialTambahan = Number(tx.biaya_lain || 0) + Number(tx.amplop || 0) + Number(tx.packing || 0);
  const [bTambahan, setBTambahan] = useState(initialTambahan);
  const [mTambahan, setMTambahan] = useState(tx.metode_bayar_tambahan || "TUNAI");
  const [buktiTambahan, setBuktiTambahan] = useState(tx.bukti_tambahan_url || "");
  
  const [maps5, setMaps5] = useState(tx.customer_maps_5star === true || tx.customer_maps_5star === "true");
  const [buktiMaps, setBuktiMaps] = useState(tx.bukti_maps_url || "");
  
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const totalCustomerPaid = Number(ongkir) + Number(bTambahan);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/yoyi/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaksi_id: tx.transaksi_id || tx.id,
          resi_id: tx.no_resi,
          nama_pengirim: pengirim,
          nama_penerima: penerima,
          ongkir_customer: Number(ongkir),
          metode_bayar: mBayar,
          bukti_bayar_url: buktiBayar,
          biaya_lain: Number(bTambahan),
          metode_bayar_tambahan: mTambahan,
          bukti_tambahan_url: buktiTambahan,
          customer_maps_5star: maps5,
          bukti_maps_url: buktiMaps
        })
      });
      const data = await res.json();
      if (data.status === "success") {
        setIsEditing(false);
        onUpdate();
      } else {
        alert("Gagal update: " + (data.message || "Unknown error"));
      }
    } catch (e: any) {
      alert("Gagal update: " + e.message);
    } finally {
      setSaving(false);
    }
  };
  
  const handleFileUpload = async (file: File, setter: (url: string) => void) => {
     if (!file) return;
     setUploading(true);
     const formData = new FormData();
     formData.append("file", file);
     try {
        const resData = await fetch("/api/upload", { method: "POST", body: formData });
        const res = await resData.json();
        if (res.status === 'success' && res.url) {
           setter(res.url);
        } else {
           alert("Upload gagal: " + (res.message || ""));
        }
     } catch (e: any) {
        alert("Upload gagal: " + e.message);
     } finally {
        setUploading(false);
     }
  };

  const FileUploader = ({ url, setUrl, label }: { url: string, setUrl: (s: string) => void, label?: string }) => {
    if (url) {
      return (
        <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline font-medium">
            <ExternalLink className="w-3 h-3" /> {label || "Lihat Bukti"}
          </a>
          {isEditing && (
            <button type="button" onClick={() => setUrl("")} className="text-red-500 hover:text-red-700 p-0.5">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      );
    }
    if (!isEditing) return <span className="text-gray-300 text-xs">-</span>;
    return (
      <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 text-xs transition-colors" title="Upload Bukti">
        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
        <span>Upload</span>
        <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0], setUrl); }} />
      </label>
    );
  };

  if (!isEditing) {
    return (
      <tr className="hover:bg-gray-50/80 transition-colors">
        <td className="px-4 py-3 align-top">
          <p className="font-mono font-bold text-gray-900">{tx.no_resi}</p>
          <div className="text-xs text-gray-600 mt-1 leading-relaxed">
            <div><span className="font-medium text-gray-400">Dari:</span> {pengirim || "-"}</div>
            <div><span className="font-medium text-gray-400">Ke:</span> {penerima || "-"}</div>
          </div>
        </td>
        <td className="px-4 py-3 align-top">
          <div className="font-semibold text-gray-900">Rp {Number(ongkir).toLocaleString('id-ID')}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${mBayar === 'TUNAI' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
              {mBayar}
            </span>
            {mBayar !== 'TUNAI' && <FileUploader url={buktiBayar} setUrl={setBuktiBayar} label="Bukti Bayar" />}
          </div>
        </td>
        <td className="px-4 py-3 align-top">
          <div className="font-semibold text-gray-900">Rp {Number(bTambahan).toLocaleString('id-ID')}</div>
          {bTambahan > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded">{mTambahan}</span>
              {mTambahan !== 'TUNAI' && <FileUploader url={buktiTambahan} setUrl={setBuktiTambahan} label="Bukti Tambahan" />}
            </div>
          )}
        </td>
        <td className="px-4 py-3 align-top text-center">
          {maps5 ? (
            <div className="flex flex-col items-center gap-1">
              <span className="inline-flex items-center gap-0.5 text-amber-500 font-bold text-xs bg-amber-50 px-2 py-0.5 rounded">
                ★ 5 Bintang
              </span>
              <FileUploader url={buktiMaps} setUrl={setBuktiMaps} label="Bukti Maps" />
            </div>
          ) : (
            <span className="text-gray-300 text-xs">-</span>
          )}
        </td>
        <td className="px-4 py-3 align-top text-right">
          <div className="font-bold text-gray-900">Rp {totalCustomerPaid.toLocaleString('id-ID')}</div>
        </td>
        <td className="px-4 py-3 align-top text-center">
          {tx.isLengkap ? (
            <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2.5 py-1 rounded text-xs font-bold">
              <CheckCircle className="w-3.5 h-3.5" /> LENGKAP
            </span>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5" /> KURANG
              </span>
              <span className="text-[10px] text-red-600 text-center max-w-[130px] leading-tight">{tx.alasan_belum_lengkap}</span>
            </div>
          )}
        </td>
        <td className="px-4 py-3 align-top text-center">
          <button 
            onClick={() => setIsEditing(true)} 
            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-blue-50/40 border-y-2 border-blue-200">
      <td className="px-4 py-3 align-top">
        <p className="font-mono font-bold text-gray-900 mb-2">{tx.no_resi}</p>
        <div className="space-y-1.5">
          <div>
            <label className="block text-[10px] font-semibold text-gray-500">Pengirim</label>
            <input type="text" value={pengirim} onChange={e => setPengirim(e.target.value)} placeholder="Nama Pengirim" className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 bg-white" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500">Penerima</label>
            <input type="text" value={penerima} onChange={e => setPenerima(e.target.value)} placeholder="Nama Penerima" className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 bg-white" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Ongkir (Rp)</label>
        <input type="number" value={ongkir} onChange={e => setOngkir(Number(e.target.value))} className="w-full text-xs px-2 py-1 border border-gray-300 rounded mb-1.5 focus:ring-1 focus:ring-blue-500 bg-white font-semibold" />
        <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Metode Bayar Ongkir</label>
        <select value={mBayar} onChange={e => setMBayar(e.target.value)} className="w-full text-xs px-2 py-1 border border-gray-300 rounded mb-1.5 focus:ring-1 focus:ring-blue-500 bg-white">
          <option value="TUNAI">TUNAI</option>
          <option value="QRIS">QRIS</option>
          <option value="TRANSFER">TRANSFER</option>
          <option value="APP">APP</option>
          <option value="DFOD">DFOD</option>
        </select>
        {mBayar !== 'TUNAI' && mBayar !== 'DFOD' && (
          <div className="mt-1">
            <label className="block text-[10px] font-semibold text-red-600 mb-0.5">Bukti Bayar Ongkir (Wajib)</label>
            <FileUploader url={buktiBayar} setUrl={setBuktiBayar} label="Bukti Bayar" />
          </div>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Biaya Tambahan (Rp)</label>
        <input type="number" value={bTambahan} onChange={e => setBTambahan(Number(e.target.value))} className="w-full text-xs px-2 py-1 border border-gray-300 rounded mb-1.5 focus:ring-1 focus:ring-blue-500 bg-white font-semibold" />
        {bTambahan > 0 && (
          <>
            <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Metode Tambahan</label>
            <select value={mTambahan} onChange={e => setMTambahan(e.target.value)} className="w-full text-xs px-2 py-1 border border-gray-300 rounded mb-1.5 focus:ring-1 focus:ring-blue-500 bg-white">
              <option value="TUNAI">TUNAI</option>
              <option value="QRIS">QRIS</option>
              <option value="TRANSFER">TRANSFER</option>
              <option value="APP">APP</option>
            </select>
            {mTambahan !== 'TUNAI' && (
              <div className="mt-1">
                <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Bukti Tambahan</label>
                <FileUploader url={buktiTambahan} setUrl={setBuktiTambahan} label="Bukti Tambahan" />
              </div>
            )}
          </>
        )}
      </td>
      <td className="px-4 py-3 align-top text-center">
        <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer bg-white px-2 py-1 rounded border border-gray-200">
          <input type="checkbox" checked={maps5} onChange={e => setMaps5(e.target.checked)} className="rounded text-amber-500 focus:ring-amber-500" />
          <span>★ 5 Bintang</span>
        </label>
        {maps5 && (
          <div className="mt-2 flex flex-col items-center">
            <span className="text-[10px] text-gray-500 mb-1">Bukti Ulasan:</span>
            <FileUploader url={buktiMaps} setUrl={setBuktiMaps} label="Bukti Maps" />
          </div>
        )}
      </td>
      <td className="px-4 py-3 align-top text-right">
        <span className="text-[10px] text-gray-400 block">Total Dihitung:</span>
        <div className="font-bold text-gray-900 text-sm mt-0.5">Rp {totalCustomerPaid.toLocaleString('id-ID')}</div>
      </td>
      <td className="px-4 py-3 align-top text-center">
        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-[11px] font-semibold rounded">
          Sedang Diedit
        </span>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-col gap-1.5">
          <button 
            onClick={handleSave} 
            disabled={saving} 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-2.5 py-1.5 rounded transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            <span>{saving ? 'Simpan...' : 'Simpan'}</span>
          </button>
          <button 
            onClick={() => setIsEditing(false)} 
            disabled={saving} 
            className="w-full bg-white hover:bg-gray-50 text-gray-600 font-semibold text-xs px-2.5 py-1.5 rounded border border-gray-300 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
        </div>
      </td>
    </tr>
  );
}



function InlineSetoranModal({ 
  isOpen, onClose, targetDate, expectedCash, outletCash,
  adminId, adminName, activeOutletId, activeOutletName, onSuccess
}: any) {
  const [nominalSetorInput, setNominalSetorInput] = React.useState(expectedCash);
  const [metodeSetoran, setMetodeSetoran] = React.useState("TUNAI");
  const [buktiTransferUrl, setBuktiTransferUrl] = React.useState("");
  const [setoranNotes, setSetoranNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    if (metodeSetoran === "TRANSFER" && !buktiTransferUrl) {
      alert("Bukti transfer wajib diunggah.");
      return;
    }
    if (metodeSetoran === "KAS_OUTLET" && nominalSetorInput > outletCash) {
      alert("Nominal melebihi sisa kas operasional.");
      return;
    }
    setSubmitting(true);
    try {
      const resData = await fetch("/api/createSetoran", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        outlet_id: activeOutletId,
        tanggal: targetDate,
        admin_id: adminId,
        nominal_setor: Number(nominalSetorInput),
        actual_cash: Number(nominalSetorInput),
        catatan: setoranNotes,
        metode_setor: metodeSetoran,
        bukti_url: buktiTransferUrl
      })});
      const res = await resData.json();
      if (res.status === "success") {
        onSuccess();
      } else {
        alert("Gagal setoran: " + res.message);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const resData = await fetch("/api/upload", { method: "POST", body: formData });
      const res = await resData.json();
      if (res.status === 'success' && res.url) {
        setBuktiTransferUrl(res.url);
      }
    } catch (e) {
      alert("Upload gagal");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-gray-800 text-sm">Buat Setoran (YoYi)</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Metode Setoran</label>
            <select value={metodeSetoran} onChange={e => setMetodeSetoran(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-emerald-500/20 focus:border-emerald-500 bg-gray-50">
              <option value="TUNAI">Tunai Fisik</option>
              <option value="TRANSFER">Transfer Bank</option>
              <option value="KAS_OUTLET">Tahan Kas Operasional</option>
            </select>
          </div>
          <div>
             <label className="block text-xs font-bold text-gray-700 mb-1">Nominal Setoran</label>
             <input type="number" value={nominalSetorInput} onChange={e => setNominalSetorInput(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-emerald-500/20 focus:border-emerald-500 bg-gray-50" />
          </div>
          {metodeSetoran === "TRANSFER" && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Bukti Transfer</label>
              {buktiTransferUrl ? (
                <div className="text-xs text-blue-600 truncate"><a href={buktiTransferUrl} target="_blank">Lihat Bukti</a> <button onClick={() => setBuktiTransferUrl("")} className="text-red-500 ml-2">X</button></div>
              ) : (
                <input type="file" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} className="text-xs w-full" />
              )}
            </div>
          )}
          <div>
             <label className="block text-xs font-bold text-gray-700 mb-1">Catatan</label>
             <textarea value={setoranNotes} onChange={e => setSetoranNotes(e.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-emerald-500/20 focus:border-emerald-500 bg-gray-50" />
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
           <button onClick={onClose} disabled={submitting} className="px-4 py-2 text-xs font-bold text-gray-600 rounded-lg hover:bg-gray-200">Batal</button>
           <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1">
             {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Simpan Setoran
           </button>
        </div>
      </div>
    </div>
  );
}
