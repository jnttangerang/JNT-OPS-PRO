import React, { useState, useEffect } from "react";
import { Settings, Save, AlertCircle } from "lucide-react";
import { useAppsScript } from "../../hooks/useAppsScript";
import { toast } from "../../utils/toast";
import { SessionData, Outlet } from "../../types";

interface SettingOutletPageProps {
  session: SessionData;
  outlets: Outlet[];
}

const SettingOutletPage: React.FC<SettingOutletPageProps> = ({ session, outlets }) => {
  const { callBackend } = useAppsScript();
  const [loading, setLoading] = useState(false);
  const [outletList, setOutletList] = useState<Outlet[]>([]);

  useEffect(() => {
    // Make a deep copy to allow editing
    setOutletList(JSON.parse(JSON.stringify(outlets)));
  }, [outlets]);

  const handleChange = (outletId: string, field: string, value: string) => {
    setOutletList((prev) =>
      prev.map((o) => {
        if (o.outlet_id === outletId) {
          return { ...o, [field]: parseInt(value) || 0 };
        }
        return o;
      })
    );
  };

  const handleSave = async () => {
    if (session.role !== "OWNER") {
      toast.error("Hanya Owner yang dapat menyimpan pengaturan.");
      return;
    }

    setLoading(true);
    try {
      const response = await callBackend("updateSettingsOutlet", {
        user_id: session.user_id,
        outlets: outletList,
      });

      if (response.status === "success") {
        toast.success("Pengaturan outlet berhasil disimpan!");
        // Typically we would trigger a re-fetch of outlets here, 
        // but it will happen on next reload. 
        setTimeout(() => window.location.reload(), 1000);
      } else {
        toast.error(response.message || "Gagal menyimpan pengaturan.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  };

  if (session.role !== "OWNER") {
    return (
      <div className="p-4 flex justify-center items-center h-full">
        <div className="bg-red-50 text-red-600 p-6 rounded-xl flex items-center gap-3">
          <AlertCircle />
          <span>Akses Ditolak. Halaman ini khusus untuk Owner.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Settings className="text-[#E4002B]" />
            Setting Outlet
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Atur parameter operasional masing-masing outlet.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-[#E4002B] hover:bg-red-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all justify-center disabled:opacity-50"
        >
          <Save size={18} />
          {loading ? "Menyimpan..." : "Simpan Pengaturan"}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Outlet
                </th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-1/4">
                  Target Resi Harian
                </th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-1/4">
                  Target Resi Bulanan
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {outletList.map((outlet) => (
                <tr key={outlet.outlet_id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-gray-800">{outlet.nama_outlet}</div>
                    <div className="text-xs text-gray-500 mt-1">{outlet.alamat_outlet}</div>
                  </td>
                  <td className="p-4">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={outlet.target_resi_harian || 0}
                        onChange={(e) => handleChange(outlet.outlet_id, "target_resi_harian", e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-[#E4002B] focus:ring-1 focus:ring-[#E4002B] transition-all"
                      />
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={outlet.target_resi_bulanan || 0}
                        onChange={(e) => handleChange(outlet.outlet_id, "target_resi_bulanan", e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-[#E4002B] focus:ring-1 focus:ring-[#E4002B] transition-all"
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {outletList.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-gray-500">
                    Tidak ada outlet yang ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SettingOutletPage;
