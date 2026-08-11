import React, { useState, useEffect } from "react";
import { BookOpen, Search, X, MapPin, Phone, User, Check, ArrowRight } from "lucide-react";
import useAppsScript from "../hooks/useAppsScript";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface AddressBookDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  type: "PENGIRIM" | "PENERIMA";
  onSelect: (item: { nama: string; telepon: string; alamat: string }) => void;
}

export default function AddressBookDrawer({ isOpen, onClose, type, onSelect }: AddressBookDrawerProps) {
  const { callBackend } = useAppsScript();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAddresses();
    }
  }, [isOpen, type]);

  const loadAddresses = async () => {
    setLoading(true);
    try {
      const action = type === "PENGIRIM" ? "getBukuPengirim" : "getBukuPenerima";
      const res = await callBackend(action, { search });
      if (res && res.status === "success") {
        setItems(res.data || []);
      }
    } catch (e) {
      console.error("Error loading address book:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
  };

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      loadAddresses();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="bg-red-50 p-2 rounded-xl text-[#E4002B]">
              <BookOpen size={18} />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-sm">
                Buku {type === "PENGIRIM" ? "Pengirim" : "Penerima"}
              </h2>
              <p className="text-xs text-gray-500">Pilih dari daftar alamat tersimpan</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100 bg-white">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text"
              placeholder={`Cari nama, no telp, atau alamat ${type === "PENGIRIM" ? "pengirim" : "penerima"}...`}
              value={search}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-[#E4002B]"
            />
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center text-gray-400 py-10 text-xs">Memuat data alamat...</div>
          ) : items.length === 0 ? (
            <div className="text-center text-gray-400 py-10 text-xs border border-dashed border-gray-200 rounded-2xl bg-gray-50">
              Tidak ada data alamat yang cocok.
            </div>
          ) : (
            items.map((item, index) => {
              const count = type === "PENGIRIM" ? item.jumlah_pengiriman : item.jumlah_diterima;
              const formattedDate = item.tanggal_terakhir 
                ? format(new Date(item.tanggal_terakhir), "dd MMM yyyy", { locale: id }) 
                : "-";

              return (
                <div 
                  key={index}
                  className="bg-white border border-gray-150 rounded-xl p-3.5 shadow-sm hover:border-red-200 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-[#E4002B]" />
                        <span className="font-bold text-gray-800 text-xs">{item.nama || item.nama_pengirim || item.nama_penerima || "Tanpa Nama"}</span>
                      </div>
                      <span className="bg-red-50 text-[#E4002B] text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {count || 0}x {type === "PENGIRIM" ? "Kirim" : "Terima"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-600 font-mono">
                      <Phone size={12} className="text-gray-400" />
                      <span>{item.telepon || item.no_hp || item.hp_pengirim || item.hp_penerima || "-"}</span>
                    </div>

                    <div className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                      <MapPin size={12} className="text-gray-400 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{item.alamat || item.alamat_pengirim || item.alamat_penerima || "-"}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-50 flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">
                      Terakhir: <strong className="text-gray-600">{formattedDate}</strong>
                    </span>
                    <button
                      onClick={() => {
                        onSelect({
                          nama: item.nama || item.nama_pengirim || item.nama_penerima || "",
                          telepon: item.telepon || item.no_hp || item.hp_pengirim || item.hp_penerima || "",
                          alamat: item.alamat || item.alamat_pengirim || item.alamat_penerima || ""
                        });
                        onClose();
                      }}
                      className="bg-[#E4002B] text-white px-3 py-1.5 rounded-lg font-bold hover:bg-red-700 transition-colors flex items-center gap-1 cursor-pointer text-xs"
                    >
                      <span>Pilih Alamat</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
