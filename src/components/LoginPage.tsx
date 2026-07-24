import React, { useState } from "react";
import { LogIn, ShieldAlert, Truck, Lock, User, Briefcase, TrendingUp, UserCheck } from "lucide-react";
import useAppsScript from "../hooks/useAppsScript";
import { SessionData } from "../types";
import { toast } from "../utils/toast";

interface LoginPageProps {
  onLoginSuccess: (session: SessionData) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const { callBackend, loading } = useAppsScript();
  const [selectedRole, setSelectedRole] = useState<"ADMIN" | "OWNER">("ADMIN");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username || !password) {
      setError("Username dan password wajib diisi!");
      return;
    }

    try {
      // callBackend handles local / api fallback transparently
      const response = await callBackend("login", { username, password });
      if (response.status === "success" && response.data) {
        toast.success(`Selamat datang, ${response.data.username}!`);
        onLoginSuccess(response.data);
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
                if (username === "" || username === "owner1") {
                  setUsername("admin1");
                  setPassword("admin123");
                }
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
                if (username === "" || username === "admin1") {
                  setUsername("owner1");
                  setPassword("owner123");
                }
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
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <User className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-sm text-gray-800 transition-all duration-200 ${
                    selectedRole === "ADMIN" ? "focus:ring-[#E4002B]" : "focus:ring-[#171717]"
                  }`}
                  placeholder={selectedRole === "ADMIN" ? "Masukkan username" : "Masukkan username"}
                  autoFocus
                  disabled={loading}
                />
              </div>
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
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-sm text-gray-800 transition-all duration-200 ${
                    selectedRole === "ADMIN" ? "focus:ring-[#E4002B]" : "focus:ring-[#171717]"
                  }`}
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>
            </div>

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
                  <span>Login Sistem</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Info Box for Demo */}
          <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
            <span className="text-[11px] uppercase tracking-wider text-gray-400 font-bold block mb-2">
              Akun Uji Coba (Demo Credentials)
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <button
                type="button"
                onClick={() => {
                  setSelectedRole("ADMIN");
                  setUsername("admin1");
                  setPassword("admin123");
                }}
                className={`p-2 rounded-lg border text-left transition-all duration-200 cursor-pointer ${
                  selectedRole === "ADMIN"
                    ? "bg-red-50/50 border-red-200 shadow-sm"
                    : "bg-white border-gray-100 opacity-60 hover:opacity-100"
                }`}
              >
                <p className={`font-semibold ${selectedRole === "ADMIN" ? "text-red-700" : "text-gray-700"}`}>Role Admin:</p>
                <p className="mt-0.5">User: <code className="bg-white/80 px-1 rounded border border-gray-100 font-mono">admin1</code></p>
                <p>Pass: <code className="bg-white/80 px-1 rounded border border-gray-100 font-mono">admin123</code></p>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setSelectedRole("OWNER");
                  setUsername("owner1");
                  setPassword("owner123");
                }}
                className={`p-2 rounded-lg border text-left transition-all duration-200 cursor-pointer ${
                  selectedRole === "OWNER"
                    ? "bg-neutral-50/80 border-neutral-300 shadow-sm"
                    : "bg-white border-gray-100 opacity-60 hover:opacity-100"
                }`}
              >
                <p className={`font-semibold ${selectedRole === "OWNER" ? "text-neutral-900" : "text-gray-700"}`}>Role Owner:</p>
                <p className="mt-0.5">User: <code className="bg-white/80 px-1 rounded border border-gray-100 font-mono">owner1</code></p>
                <p>Pass: <code className="bg-white/80 px-1 rounded border border-gray-100 font-mono">owner123</code></p>
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">
              *Klik kartu akun demo di atas untuk mengisi formulir otomatis
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
