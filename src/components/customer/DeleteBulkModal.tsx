import React, { useState } from "react";
import { AlertCircle, X, Trash2 } from "lucide-react";

export interface DeleteBulkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  count: number;
}

export default function DeleteBulkModal({ isOpen, onClose, onConfirm, count }: DeleteBulkModalProps) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden text-center p-6 relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors">
          <X size={20} />
        </button>
        <div className="mx-auto bg-red-50 w-16 h-16 rounded-full flex items-center justify-center text-red-500 mb-4">
          <AlertCircle size={32} />
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-2">Konfirmasi Hapus</h3>
        <p className="text-sm text-gray-600 mb-6">
          Yakin ingin menghapus <strong>{count}</strong> data pelanggan?
          {count > 100 && (
            <span className="block mt-2 text-red-500 font-bold">Peringatan: Anda akan menghapus data dalam jumlah besar!</span>
          )}
          <span className="block mt-1">Tindakan ini tidak dapat dibatalkan.</span>
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-4 py-2 font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors text-sm"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {loading ? "Menghapus..." : (
              <>
                <Trash2 size={16} />
                Hapus Data
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
