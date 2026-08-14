import React, { useState, useEffect } from "react";
import { X, Save } from "lucide-react";

export interface EditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedData: any) => Promise<void>;
  initialData: any | null;
  type: "SEMUA" | "PENGIRIM" | "PENERIMA";
}

export default function EditCustomerModal({ isOpen, onClose, onSave, initialData, type }: EditCustomerModalProps) {
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <h2 className="font-bold text-gray-800 text-sm">
            Edit Data {type === "SEMUA" ? "Customer" : type === "PENGIRIM" ? "Pengirim" : "Penerima"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Nama</label>
            <input
              type="text"
              name="nama"
              value={formData.nama || formData.nama_pengirim || formData.nama_penerima || ""}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl outline-none focus:border-red-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">No. HP / Telepon</label>
            <input
              type="text"
              name="telepon"
              value={formData.telepon || formData.no_hp || formData.hp_pengirim || formData.hp_penerima || ""}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl outline-none focus:border-red-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Alamat</label>
            <textarea
              name="alamat"
              value={formData.alamat || formData.alamat_pengirim || formData.alamat_penerima || ""}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl outline-none focus:border-red-500"
            ></textarea>
          </div>
          {type === "SEMUA" && (
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Status</label>
              <select
                name="status"
                value={formData.status || "AKTIF"}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl outline-none focus:border-red-500 bg-white"
              >
                <option value="AKTIF">AKTIF</option>
                <option value="NON-AKTIF">NON-AKTIF</option>
              </select>
            </div>
          )}
          <div className="pt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? "Menyimpan..." : (
                <>
                  <Save size={14} />
                  Simpan Perubahan
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
