import React, { useState, useEffect } from "react";
import { LogIn, ShieldAlert, Truck, Lock, User, Briefcase, TrendingUp, UserCheck, Eye, EyeOff, ChevronDown, RefreshCw } from "lucide-react";
import useAppsScript from "../hooks/useAppsScript";
import { SessionData, Outlet } from "../types";
import { toast } from "../utils/toast";

interface LoginPageProps {
  onLoginSuccess: (session: SessionData, taskOutletId?: string) => void;
  outlets: Outlet[];
}

interface AdminUser {
  user_id?: string;
  username: string;
  nama_lengkap?: string;
  role?: string;
  status_aktif?: string;
  outlet_id_home?: string;
}

export default function LoginPage({ onLoginSuccess, outlets }: LoginPageProps) {
  const { callBackend, loading } = useAppsScript();
  const [selectedRole, setSelectedRole] = useState<"ADMIN" | "OWNER">("ADMIN");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [outletTugas, setOutletTugas] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminList, setAdminList] = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  const fetchActiveAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const res = await callBackend("getUsers");
      if (res && res.status === "success" && Array.isArray(res.data)) {
        const activeAdmins: AdminUser[] = res.data.filter((u: any) => {
          const rawStatus = (u.status_aktif !== undefined && u.status_aktif !== null) ? u.status_aktif.toString().trim().toUpperCase() : "AKTIF";
          const isInactive = (rawStatus === "NON-AKTIF" || rawStatus === "NONAKTIF" || rawStatus === "INAKTIF" || rawStatus === "TIDAK AKTIF" || rawStatus === "FALSE" || rawStatus === "0" || rawStatus === "DISABLED");
          const role = (u.role || "ADMIN").toString().toUpperCase();
          return !isInactive && role !== "OWNER";
        });
        setAdminList(activeAdmins);
      }
    } catch (err) {
      console.error("Gagal mengambil daftar admin:", err);
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    fetchActiveAdmins();
  }, [callBackend]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username || !password) {
      setError(selectedRole === "ADMIN" ? "Pilih admin dan masukkan password!" : "Username dan password wajib diisi!");
      return;
    }

    if (selectedRole === "ADMIN" && !outletTugas) {
      setError("Silakan pilih Outlet Tugas terlebih dahulu.");
      return;
    }

    try {
      // callBackend handles local / api fallback transparently
      const response = await callBackend("login", { username, password });
      if (response.status === "success" && response.data) {
        toast.success(`Selamat datang, ${response.data.nama_lengkap || response.data.username}!`);
        onLoginSuccess(response.data, outletTugas || undefined);
      } else {
        const msg = response.message || "Gagal masuk. Username atau password salah.";
        setError(msg);
        toast.error(msg);
      }
    } catch (err: any) {
      const msg = err.message || "Terjadi kesalahan koneksi ke server.";
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className={`w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border transition-all duration-300 ${
        selectedRole === "ADMIN" ? "border-red-100 shadow-red-500/5" : "border-neutral-200 shadow-neutral-950/5"
      }`}>
        
        {/* Banner J&T Brand */}
        <div className={`px-6 py-8 text-white text-center relative overflow-hidden transition-all duration-500 ${
          selectedRole === "ADMIN" ? "bg-[#E4002B]" : "bg-slate-900"
        }`}>
          <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-black/20 mix-blend-overlay"></div>
          {selectedRole === "OWNER" && (
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
          )}
          <div className="relative z-10 flex flex-col items-center">
            <div 
              className={`p-3 rounded-2xl shadow-md transition-all duration-500 transform ${
                selectedRole === "ADMIN" 
                  ? "bg-white text-[#E4002B] rotate-0" 
                  : "text-white scale-105"
              }`}
              style={selectedRole === "OWNER" ? { backgroundColor: "#fe0000" } : undefined}
            >
              {selectedRole === "ADMIN" ? (
                <Truck className="h-8 w-8 stroke-[2.5]" />
              ) : (
                <TrendingUp className="h-8 w-8 stroke-[2.5]" style={{ color: "#ffffff" }} />
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight font-sans mt-3 transition-all duration-300">
              {selectedRole === "ADMIN" ? "J&T OPS PRO" : "J&T OWNER"}
            </h1>
            <p 
              className={`text-xs mt-1 font-mono uppercase tracking-wider transition-all duration-300 ${
                selectedRole === "ADMIN" ? "text-red-100" : "text-[#ff0000] font-bold"
              }`}
              style={selectedRole === "OWNER" ? { color: "#ff0000", fontWeight: "bold" } : undefined}
            >
              {selectedRole === "ADMIN" ? "Sistem Operasional Outlet J&T" : "Dashboard Keuangan & Kinerja Bisnis"}
            </p>
          </div>
        </div>

        {/* Form Container */}
        <div className="p-6 sm:p-8">
          
          {/* Segmented Tab Controller */}
          <div className="flex p-1 bg-gray-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setSelectedRole("ADMIN");
                setUsername("");
                setPassword("");
              }}
              className={`flex-1 py-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                selectedRole === "ADMIN"
                  ? "bg-white text-[#E4002B] shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <UserCheck className="h-4 w-4" />
              <span>ADMIN</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedRole("OWNER");
                setUsername("owner");
                setPassword("owner123");
              }}
              className={`flex-1 py-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                selectedRole === "OWNER"
                  ? "bg-white text-[#171717] shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <Briefcase 
                className="h-4 w-4" 
                style={selectedRole === "OWNER" ? { color: "#171717", borderColor: "#171717" } : undefined}
              />
              <span style={selectedRole === "OWNER" ? { color: "#171717" } : undefined}>OWNER</span>
            </button>
          </div>

          <h2 className="text-sm font-bold text-gray-700 mb-6 text-center tracking-wide uppercase">
            {selectedRole === "ADMIN" ? "Masuk sebagai Admin" : "Masuk sebagai Owner"}
          </h2>

          {error && (
            <div className={`mb-5 p-4 bg-red-50 border-l-4 text-red-700 text-sm rounded-r-lg flex items-start gap-2 animate-pulse ${
              selectedRole === "ADMIN" ? "border-[#E4002B]" : "border-[#171717]"
            }`}>
              <ShieldAlert className={`h-5 w-5 shrink-0 mt-0.5 ${selectedRole === "ADMIN" ? "text-[#E4002B]" : "text-[#171717]"}`} />
              <div>
                <p className="font-semibold">Login Gagal</p>
                <p className="text-xs opacity-90 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {selectedRole === "ADMIN" ? "Nama Admin" : "Username"}
                </label>
                {selectedRole === "ADMIN" && (
                  <button
                    type="button"
                    onClick={fetchActiveAdmins}
                    disabled={loadingAdmins}
                    className="text-[11px] text-gray-400 hover:text-[#E4002B] flex items-center gap-1 transition-colors"
                    title="Segarkan daftar admin dari spreadsheet"
                  >
                    <RefreshCw className={`h-3 w-3 ${loadingAdmins ? "animate-spin text-[#E4002B]" : ""}`} />
                    <span>{loadingAdmins ? "Memuat..." : "Refresh"}</span>
                  </button>
                )}
              </div>

              {selectedRole === "ADMIN" ? (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <User className="h-5 w-5" />
                  </div>
                  <select
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E4002B] focus:border-transparent text-sm text-gray-800 transition-all duration-200 cursor-pointer appearance-none disabled:opacity-60"
                    disabled={loading || loadingAdmins}
                  >
                    {loadingAdmins ? (
                      <option value="">Memuat daftar admin...</option>
                    ) : adminList.length === 0 ? (
                      <option value="">-- Tidak ada admin aktif --</option>
                    ) : (
                      <>
                        <option value="" disabled hidden>
                          - Pilih nama admin -
                        </option>
                        {adminList.map((adm) => (
                          <option key={adm.user_id || adm.username} value={adm.username}>
                            {adm.nama_lengkap || adm.username}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <User className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#171717] focus:border-transparent text-sm text-gray-800 transition-all duration-200"
                    placeholder="Masukkan username"
                    autoFocus
                    disabled={loading}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-sm text-gray-800 transition-all duration-200 ${
                    selectedRole === "ADMIN" ? "focus:ring-[#E4002B]" : "focus:ring-[#171717]"
                  }`}
                  placeholder="••••••••"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  title={showPassword ? "Sembunyikan password" : "Lihat password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {selectedRole === "ADMIN" && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Outlet Tugas
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Truck className="h-5 w-5" />
                  </div>
                  <select
                    value={outletTugas}
                    onChange={(e) => setOutletTugas(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E4002B] focus:border-transparent text-sm text-gray-800 transition-all duration-200 cursor-pointer appearance-none disabled:opacity-60"
                    disabled={loading || outlets.length === 0}
                  >
                    {outlets.length === 0 ? (
                      <option value="">Memuat daftar outlet...</option>
                    ) : (
                      <>
                        <option value="" disabled hidden>
                          - Pilih outlet tugas -
                        </option>
                        {outlets.map((o) => (
                          <option key={o.outlet_id} value={o.outlet_id}>
                            {o.nama_outlet || o.outlet_id}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 text-white font-semibold rounded-xl active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer mt-2 shadow-lg ${
                loading
                  ? "bg-gray-400"
                  : selectedRole === "ADMIN"
                    ? "bg-[#E4002B] hover:bg-[#c20023] shadow-red-500/10"
                    : "bg-[#171717] hover:bg-neutral-800 shadow-neutral-950/10"
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  <span>Login</span>
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
