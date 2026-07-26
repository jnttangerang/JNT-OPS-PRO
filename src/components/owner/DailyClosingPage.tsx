import React, { useState, useEffect } from "react";
import { Calendar, CheckCircle2, AlertTriangle, AlertCircle, Lock, Loader2, Store } from "lucide-react";
import { toast } from "../../utils/toast";

import useAppsScript from "../../hooks/useAppsScript";

export default function DailyClosingPage({ session, outlets }: { session: any, outlets: any[] }) {
  const { callBackend } = useAppsScript();
  const [closingDate, setClosingDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedOutlet, setSelectedOutlet] = useState(outlets[0]?.outlet_id || "");
  const [loading, setLoading] = useState(false);
  const [closingData, setClosingData] = useState<any>(null);

  useEffect(() => {
    if (closingDate && selectedOutlet) {
      validateClosing();
    }
  }, [closingDate, selectedOutlet]);

  const validateClosing = async () => {
    setLoading(true);
    setClosingData(null);
    try {
      const res = await callBackend("validateClosing", {
        closing_date: closingDate,
        outlet_id: selectedOutlet
      });
      if (res.status === "success") {
        setClosingData(res);
      } else {
        toast.error(res.message || "Gagal memvalidasi");
      }
    } catch (e: any) {
      toast.error(e.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteClosing = async () => {
    if (!confirm("Apakah Anda yakin ingin melakukan closing? Tindakan ini tidak dapat dibatalkan.")) return;
    
    setLoading(true);
    try {
      const res = await callBackend("executeClosing", {
        closing_date: closingDate,
        outlet_id: selectedOutlet,
        owner_id: session.user_id
      });
      if (res.status === "success") {
        toast.success("Closing berhasil");
        validateClosing();
      } else {
        toast.error(res.message || "Gagal melakukan closing");
      }
    } catch (e: any) {
      toast.error(e.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Daily Closing Engine</h1>
            <p className="text-sm text-gray-500">Validasi dan akhiri operasional harian</p>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <Store className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              {outlets.map(o => (
                <option key={o.outlet_id} value={o.outlet_id}>{o.nama_outlet}</option>
              ))}
            </select>
          </div>
          <div className="relative flex-1 md:flex-none">
            <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {loading && !closingData && (
        <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-gray-100">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
          <p className="text-sm text-gray-500 font-medium">Memvalidasi data operasional...</p>
        </div>
      )}

      {closingData && closingData.is_closed && (
        <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-emerald-900">Operasional Selesai (CLOSED)</h2>
            <p className="text-emerald-700 mt-1">
              Closing untuk tanggal {new Date(closingDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })} sudah dilakukan.
            </p>
          </div>
          <div className="max-w-md mx-auto grid grid-cols-2 gap-4 mt-6 text-left">
            <div className="bg-white/60 p-4 rounded-xl">
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Total Transaksi</p>
              <p className="text-xl font-black text-emerald-900">{closingData.data?.total_transactions || 0}</p>
            </div>
            <div className="bg-white/60 p-4 rounded-xl">
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Setoran Owner</p>
              <p className="text-xl font-black text-emerald-900">Rp {Number(closingData.data?.total_setoran_owner || 0).toLocaleString("id-ID")}</p>
            </div>
          </div>
        </div>
      )}

      {closingData && !closingData.is_closed && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Hasil Validasi Sistem</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${closingData.is_valid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {closingData.is_valid ? 'SIAP CLOSING' : 'BUTUH PERBAIKAN'}
                </span>
              </div>
              
              <div className="p-5">
                {!closingData.is_valid && closingData.validations?.length > 0 ? (
                  <div className="space-y-3">
                    {closingData.validations.map((v: any, idx: number) => (
                      <div key={idx} className="flex gap-3 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <span className="text-sm font-medium">{v.error}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-3">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="text-emerald-700 font-bold">Semua validasi operasional berhasil dilewati!</p>
                    <p className="text-sm text-emerald-600 mt-1">Tidak ada transaksi menggantung, selisih tidak terselesaikan, atau data tidak valid.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">Ringkasan Harian</h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Transaksi</span>
                  <span className="font-bold text-gray-900">{closingData.summary?.total_transactions || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Uang dari Customer</span>
                  <span className="font-bold text-gray-900">Rp {Number(closingData.summary?.total_customer_payment || 0).toLocaleString("id-ID")}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total YOYI/JTC</span>
                  <span className="font-bold text-gray-900">Rp {Number(closingData.summary?.total_yoyi || 0).toLocaleString("id-ID")}</span>
                </div>
                <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-900">Setoran Owner</span>
                  <span className="font-black text-blue-600">Rp {Number(closingData.summary?.total_setoran_owner || 0).toLocaleString("id-ID")}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-900">Kas Operasional</span>
                  <span className="font-black text-emerald-600">Rp {Number(closingData.summary?.total_kas_operasional || 0).toLocaleString("id-ID")}</span>
                </div>
              </div>
              <div className="p-5 bg-gray-50 border-t border-gray-100">
                <button
                  onClick={handleExecuteClosing}
                  disabled={!closingData.is_valid || loading}
                  className="w-full py-3 bg-gray-900 hover:bg-black text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  TUTUP HARI INI (CLOSE DAY)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
