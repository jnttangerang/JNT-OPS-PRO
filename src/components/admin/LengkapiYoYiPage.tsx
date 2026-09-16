import React, { useState, useEffect } from 'react';
import { useAppsScript } from '../../hooks/useAppsScript';
import { CheckCircle, AlertTriangle, ChevronRight, Upload, X } from 'lucide-react';
import AdminDailySettlementView from '../owner/AdminDailySettlementView'; // or standard setoran
import { DollarSign, Loader2, Check } from 'lucide-react';

interface LengkapiYoYiPageProps {
  session: any;
  outlets: any[];
}

export default function LengkapiYoYiPage({ session, outlets }: LengkapiYoYiPageProps) {
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
      if (session.active_outlet_id) qs.append("outlet_id", session.active_outlet_id);
      
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
  }, [session.active_outlet_id]);

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
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Tanggal</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Progress</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Nominal Transaksi</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Wajib Setor Cash</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredSummary.map((s, idx) => {
              const isLengkap = s.transaksi_lengkap >= s.total_transaksi;
              const statusText = s.transaksi_lengkap === 0 ? "BELUM DIMULAI" : (isLengkap ? "LENGKAP" : "SEDANG DIKERJAKAN");
              return (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{s.tanggal}</td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{s.transaksi_lengkap} / {s.total_transaksi} transaksi</span>
                  </td>
                  <td className="px-6 py-4 font-medium">Rp {s.total_nominal.toLocaleString('id-ID')}</td>
                  <td className="px-6 py-4 font-medium text-red-600">Rp {s.wajib_setor.toLocaleString('id-ID')}</td>
                  <td className="px-6 py-4">
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
                  <td className="px-6 py-4 text-right">
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
          activeOutletId={session.active_outlet_id}
          activeOutletName={outlets.find(o => o.outlet_id === session.active_outlet_id)?.nama_outlet || ''}
          onSuccess={() => {
            setSetoranModalOpen(false);
            fetchSummary();
          }}
        />
      )}

    </div>
  );
}

function YoYiDetailView({ tanggal, onBack, session, outlets, onSetoran }: any) {
  const { callBackend } = useAppsScript();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      qs.append("tanggal", tanggal);
      if (session.role === "ADMIN") qs.append("admin_id", session.user_id);
      if (session.active_outlet_id) qs.append("outlet_id", session.active_outlet_id);

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

  useEffect(() => {
    fetchTransactions();
  }, [tanggal]);

  const allComplete = transactions.length > 0 && transactions.every(t => t.isLengkap);
  const totalNominal = transactions.reduce((sum, t) => sum + (Number(t.total_customer) || 0), 0);
  const wajibSetor = transactions.reduce((sum, t) => sum + (Number(t.wajib_setor_owner) || 0), 0);
  const kasOutlet = transactions.reduce((sum, t) => sum + (Number(t.kas_outlet) || 0), 0);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors">
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Detail YoYi: {tanggal}</h2>
          <p className="text-sm text-gray-500">{transactions.length} transaksi</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <p className="text-sm font-medium text-gray-500">Status Transaksi</p>
          <div className="mt-1">
            {allComplete ? (
              <span className="inline-flex items-center gap-1.5 text-green-700 font-bold text-lg">
                <CheckCircle className="w-5 h-5" /> LENGKAP
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-amber-600 font-bold text-lg">
                <AlertTriangle className="w-5 h-5" /> BELUM LENGKAP
              </span>
            )}
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Total Nominal Transaksi</p>
          <p className="text-xl font-bold text-gray-900 mt-1">Rp {totalNominal.toLocaleString('id-ID')}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Wajib Setor Cash</p>
          <p className="text-xl font-bold text-red-600 mt-1">Rp {wajibSetor.toLocaleString('id-ID')}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
          <div>
            <p className="text-sm font-medium text-gray-500">Kas Outlet</p>
            <p className="text-xl font-bold text-green-600 mt-1">Rp {kasOutlet.toLocaleString('id-ID')}</p>
          </div>
          {allComplete && (
            <button 
              onClick={() => onSetoran(wajibSetor, kasOutlet)}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors shadow-sm"
            >
              Buat Setoran
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="min-w-max w-full text-sm divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Resi & Pengirim</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Ongkir & Metode</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Biaya Tambahan</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Maps 5★</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
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
  // no useAppsScript needed here anymore, or just keep it empty if unused
  const [isEditing, setIsEditing] = useState(false);
  
  const [pengirim, setPengirim] = useState(tx.snapshot_nama_pengirim || tx.nama_pengirim || "");
  const [penerima, setPenerima] = useState(tx.snapshot_nama_penerima || tx.nama_penerima || "");
  
  const [ongkir, setOngkir] = useState(tx.ongkir_customer || tx.ongkir_dasar || 0);
  const [mBayar, setMBayar] = useState(tx.metode_bayar || tx.metode_pembayaran_ongkir || "TUNAI");
  const [buktiBayar, setBuktiBayar] = useState(tx.bukti_bayar_url || "");
  
  const initialTambahan = Number(tx.biaya_lain || 0) + Number(tx.amplop || 0) + Number(tx.packing || 0);
  const [bTambahan, setBTambahan] = useState(initialTambahan);
  const [mTambahan, setMTambahan] = useState(tx.metode_bayar_tambahan || "TUNAI");
  const [buktiTambahan, setBuktiTambahan] = useState(tx.bukti_tambahan_url || "");
  
  const [maps5, setMaps5] = useState(tx.customer_maps_5star === true || tx.customer_maps_5star === "true");
  const [buktiMaps, setBuktiMaps] = useState(tx.bukti_maps_url || "");
  
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/yoyi/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        transaksi_id: tx.transaksi_id || tx.id,
        resi_id: tx.no_resi,
        nama_pengirim: pengirim,
        nama_penerima: penerima,
        ongkir_customer: ongkir,
        metode_bayar: mBayar,
        bukti_bayar_url: buktiBayar,
        biaya_lain: bTambahan,
        metode_bayar_tambahan: mTambahan,
        bukti_tambahan_url: buktiTambahan,
        customer_maps_5star: maps5,
        bukti_maps_url: buktiMaps
      })});
      setIsEditing(false);
      onUpdate();
    } catch (e) {
      alert("Gagal update");
    } finally {
      setSaving(false);
    }
  };
  
  const handleFileUpload = async (file: File, setter: (url: string) => void) => {
     if (!file) return;
     const formData = new FormData();
     formData.append("file", file);
     try {
        const resData = await fetch("/api/upload", { method: "POST", body: formData });
        const res = await resData.json();
        if (res.status === 'success' && res.url) {
           setter(res.url);
        }
     } catch (e) {
        alert("Upload gagal");
     }
  };

  const FileUploader = ({ url, setUrl }: { url: string, setUrl: (s:string)=>void }) => {
    if (url) return (
       <div className="flex items-center gap-1">
         <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">Lihat Bukti</a>
         {isEditing && <button onClick={() => setUrl("")} className="text-red-500"><X className="w-3 h-3" /></button>}
       </div>
    );
    if (!isEditing) return <span className="text-gray-400 text-xs">-</span>;
    return (
       <label className="cursor-pointer inline-flex items-center justify-center p-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition-colors" title="Upload Bukti">
         <Upload className="w-3.5 h-3.5" />
         <input type="file" className="hidden" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0], setUrl); }} />
       </label>
    );
  };

  if (!isEditing) {
    return (
      <tr className="hover:bg-gray-50 group">
        <td className="px-4 py-3 align-top">
          <p className="font-medium text-gray-900">{tx.no_resi}</p>
          <div className="text-xs text-gray-500 mt-0.5">
            <span className="font-medium">Dari:</span> {pengirim || "-"} <br/>
            <span className="font-medium">Ke:</span> {penerima || "-"}
          </div>
          <button onClick={() => setIsEditing(true)} className="text-xs text-blue-600 font-medium mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">Edit Data</button>
        </td>
        <td className="px-4 py-3 align-top">
          <div className="font-medium">Rp {Number(ongkir).toLocaleString('id-ID')}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{mBayar}</span>
            {mBayar !== 'TUNAI' && <FileUploader url={buktiBayar} setUrl={setBuktiBayar} />}
          </div>
        </td>
        <td className="px-4 py-3 align-top">
          <div className="font-medium">Rp {Number(bTambahan).toLocaleString('id-ID')}</div>
          {bTambahan > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{mTambahan}</span>
              {mTambahan !== 'TUNAI' && <FileUploader url={buktiTambahan} setUrl={setBuktiTambahan} />}
            </div>
          )}
        </td>
        <td className="px-4 py-3 align-top text-center">
          {maps5 ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-amber-500 font-bold text-lg">★</span>
              <FileUploader url={buktiMaps} setUrl={setBuktiMaps} />
            </div>
          ) : (
            <span className="text-gray-300 text-lg">★</span>
          )}
        </td>
        <td className="px-4 py-3 align-top text-center">
          {tx.isLengkap ? (
            <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded text-xs font-bold">✓ LENGKAP</span>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-1 rounded text-xs font-bold">⚠ KURANG</span>
              <span className="text-[10px] text-red-600 text-center max-w-[120px] leading-tight">{tx.alasan_belum_lengkap}</span>
            </div>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-blue-50/30 border-y border-blue-100 shadow-inner">
      <td className="px-4 py-3 align-top">
        <p className="font-medium text-gray-900 mb-2">{tx.no_resi}</p>
        <div className="space-y-2">
          <input type="text" value={pengirim} onChange={e => setPengirim(e.target.value)} placeholder="Nama Pengirim" className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500" />
          <input type="text" value={penerima} onChange={e => setPenerima(e.target.value)} placeholder="Nama Penerima" className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500" />
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <input type="number" value={ongkir} onChange={e => setOngkir(Number(e.target.value))} className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded mb-2 focus:ring-1 focus:ring-blue-500" />
        <div className="flex items-center gap-2">
          <select value={mBayar} onChange={e => setMBayar(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500">
            <option value="TUNAI">TUNAI</option>
            <option value="QRIS">QRIS</option>
            <option value="TRANSFER">TRANSFER</option>
            <option value="APP">APP</option>
            <option value="DFOD">DFOD</option>
          </select>
          {mBayar !== 'TUNAI' && mBayar !== 'DFOD' && <FileUploader url={buktiBayar} setUrl={setBuktiBayar} />}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <input type="number" value={bTambahan} onChange={e => setBTambahan(Number(e.target.value))} className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded mb-2 focus:ring-1 focus:ring-blue-500" />
        <div className="flex items-center gap-2">
          <select value={mTambahan} onChange={e => setMTambahan(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500">
            <option value="TUNAI">TUNAI</option>
            <option value="QRIS">QRIS</option>
            <option value="TRANSFER">TRANSFER</option>
            <option value="APP">APP</option>
          </select>
          {mTambahan !== 'TUNAI' && <FileUploader url={buktiTambahan} setUrl={setBuktiTambahan} />}
        </div>
      </td>
      <td className="px-4 py-3 align-top text-center">
        <div className="flex flex-col items-center gap-2">
          <label className="flex items-center gap-1 text-xs cursor-pointer">
            <input type="checkbox" checked={maps5} onChange={e => setMaps5(e.target.checked)} className="rounded text-amber-500 focus:ring-amber-500" />
            5★
          </label>
          {maps5 && <FileUploader url={buktiMaps} setUrl={setBuktiMaps} />}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-col gap-2">
          <button onClick={handleSave} disabled={saving} className="w-full bg-blue-600 text-white font-medium text-xs px-3 py-1.5 rounded hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
          <button onClick={() => setIsEditing(false)} disabled={saving} className="w-full bg-white text-gray-600 font-medium text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50">
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
