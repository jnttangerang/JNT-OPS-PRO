import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, ShieldCheck, XCircle, FileText, Lock, Unlock } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  outletId: string;
  tanggal: string;
  session: any;
  onStatusChange?: (newStatus: string) => void;
}

export default function FinancialCloseCertificationModal({ isOpen, onClose, outletId, tanggal, session, onStatusChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      // Hit validate to ensure we have the latest controls and status.
      // Validate will create the record if it doesn't exist and re-run all 10 controls.
      const actorInfo = {
        actor_id: session?.user?.id || "OWN-01",
        actor_name: session?.user?.name || "Owner",
        actor_role: session?.role || "OWNER"
      };
      
      const res = await fetch("/api/financial-close/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: outletId,
          tanggal,
          ...actorInfo
        })
      });
      const data = await res.json();
      
      if (data.status === "success" || data.data) {
        setRecord(data.data);
        if (onStatusChange && data.data?.status) {
          onStatusChange(data.data.status);
        }
      } else {
        setError(data.message || "Gagal memuat status sertifikasi");
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setShowReopenModal(false);
      setReopenReason("");
    }
  }, [isOpen, outletId, tanggal]);

  const handleCertify = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const actorInfo = {
        actor_id: session?.user?.id || "OWN-01",
        actor_name: session?.user?.name || "Owner",
        actor_role: session?.role || "OWNER"
      };
      const res = await fetch("/api/financial-close/certify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: outletId,
          tanggal,
          ...actorInfo
        })
      });
      const data = await res.json();
      if (data.status === "success") {
        setRecord(data.data);
        if (onStatusChange) onStatusChange(data.data.status);
      } else {
        setError(data.message || "Gagal melakukan certify");
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopen = async () => {
    if (!reopenReason.trim()) {
      setError("Alasan reopen wajib diisi.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const actorInfo = {
        actor_id: session?.user?.id || "OWN-01",
        actor_name: session?.user?.name || "Owner",
        actor_role: session?.role || "OWNER"
      };
      const res = await fetch("/api/financial-close/reopen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: outletId,
          tanggal,
          reason: reopenReason,
          ...actorInfo
        })
      });
      const data = await res.json();
      if (data.status === "success") {
        setRecord(data.data);
        setShowReopenModal(false);
        if (onStatusChange) onStatusChange(data.data.status);
        // Re-validate to get current blocking reasons if any
        fetchStatus();
      } else {
        setError(data.message || "Gagal melakukan reopen");
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Financial Close Certification</h2>
              <p className="text-sm text-gray-500">
                Outlet: <span className="font-semibold text-gray-700">{outletId}</span> | 
                Tanggal: <span className="font-semibold text-gray-700">{tanggal}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-4">
              <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
              <p className="text-sm text-gray-500">Memuat status sertifikasi...</p>
            </div>
          ) : !record ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Data sertifikasi tidak ditemukan.</p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Status Banner */}
              <div className={`p-5 rounded-xl border ${
                record.status === 'CERTIFIED' ? 'bg-green-50 border-green-200' :
                record.status === 'READY_FOR_CERTIFICATION' ? 'bg-blue-50 border-blue-200' :
                record.status === 'BLOCKED' ? 'bg-red-50 border-red-200' :
                'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    {record.status === 'CERTIFIED' ? <CheckCircle className="h-6 w-6 text-green-600" /> :
                     record.status === 'READY_FOR_CERTIFICATION' ? <CheckCircle className="h-6 w-6 text-blue-600" /> :
                     record.status === 'BLOCKED' ? <XCircle className="h-6 w-6 text-red-600" /> :
                     <ShieldCheck className="h-6 w-6 text-gray-600" />}
                    
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{record.status.replace(/_/g, ' ')}</h3>
                      {record.status === 'CERTIFIED' && record.certified_at && (
                        <p className="text-sm text-gray-600">
                          Certified by {record.certified_by} pada {new Date(record.certified_at).toLocaleString('id-ID')}
                        </p>
                      )}
                    </div>
                  </div>

                  {record.status === 'READY_FOR_CERTIFICATION' && (
                    <button
                      onClick={handleCertify}
                      disabled={isSubmitting || session?.role !== "OWNER"}
                      className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2 transition-all"
                    >
                      <Lock className="h-4 w-4" />
                      CERTIFY
                    </button>
                  )}

                  {record.status === 'CERTIFIED' && (
                    <button
                      onClick={() => setShowReopenModal(true)}
                      disabled={isSubmitting || session?.role !== "OWNER"}
                      className="px-6 py-2.5 bg-yellow-500 text-white font-medium rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2 transition-all"
                    >
                      <Unlock className="h-4 w-4" />
                      REOPEN
                    </button>
                  )}
                  
                  {session?.role !== "OWNER" && (record.status === 'READY_FOR_CERTIFICATION' || record.status === 'CERTIFIED') && (
                    <div className="text-xs text-red-500 font-medium">Hanya OWNER yang dapat eksekusi</div>
                  )}
                </div>
              </div>

              {/* Blocking Reasons */}
              {record.blocking_reasons && record.blocking_reasons.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                  <h4 className="font-bold text-red-800 flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5" />
                    Blocking Reasons
                  </h4>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-red-700">
                    {record.blocking_reasons.map((r: string, idx: number) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 10 Control Checks */}
              <div>
                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-500" />
                  Control Checks
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {record.controls?.map((control: any, idx: number) => (
                    <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-gray-800 text-sm">
                          {control.control_name.replace(/_/g, ' ')}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{control.message}</div>
                      </div>
                      <div>
                        {control.status === "PASS" ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">PASS</span>
                        ) : control.status === "WARNING" ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">WARNING</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">FAIL</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
            </div>
          )}
        </div>
      </div>

      {/* Reopen Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <h3 className="font-bold text-lg text-gray-900">Reopen Certification</h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600 mb-4">
                Membuka kembali sertifikasi akan membatalkan status final dan mengharuskan validasi ulang. Silakan masukkan alasan reopen.
              </p>
              <textarea
                value={reopenReason}
                onChange={e => setReopenReason(e.target.value)}
                placeholder="Alasan reopen (wajib)..."
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none h-24"
              />
            </div>
            <div className="px-5 py-4 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setShowReopenModal(false)}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                Batal
              </button>
              <button
                onClick={handleReopen}
                disabled={!reopenReason.trim() || isSubmitting}
                className="px-4 py-2 bg-yellow-500 text-white font-medium rounded-lg hover:bg-yellow-600 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Memproses...' : 'Konfirmasi Reopen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
