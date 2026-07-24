import React, { useState, useEffect } from "react";
import { 
  Truck, LogOut, User, MapPin, Clipboard, FileText, Landmark, BookOpen, AlertCircle, List, Star, Menu, X, Trash2
} from "lucide-react";
import useAppsScript from "./hooks/useAppsScript";
import LoginPage from "./components/LoginPage";
import PreInputPage from "./components/PreInputPage";
import TransaksiPage from "./components/TransaksiPage";
import DashboardPage from "./components/DashboardPage";
import AdminDashboardPage from "./components/admin/AdminDashboardPage";
import { LayoutDashboard, Settings } from "lucide-react";
import RiwayatTransaksiPage from "./components/RiwayatTransaksiPage";
import UlasanMapsPage from "./components/UlasanMapsPage";
import SettingOutletPage from "./components/owner/SettingOutletPage";
import ToastContainer from "./components/ToastContainer";
import { SessionData, Outlet } from "./types";
import { toast } from "./utils/toast";

export default function App() {
  const { callBackend } = useAppsScript();

  // Authentication State
  const [session, setSession] = useState<SessionData | null>(null);
  
  // Navigation State
  const [currentView, setCurrentView] = useState<string>("login");

  // Mobile Sidebar Drawer Toggle State
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Outlet State
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [activeOutletId, setActiveOutletId] = useState<string>("");

  // Loading indicator for initial settings
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Load active session from localStorage on start
  useEffect(() => {
    const savedSession = localStorage.getItem("jnt_session");
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession) as SessionData;
        setSession(parsed);
        setActiveOutletId(parsed.outlet_id_home);
        setCurrentView(parsed.role.toUpperCase() === "OWNER" ? "dashboard" : parsed.role.toUpperCase() === "ADMIN" ? "admin-dashboard" : "pre-input");
      } catch (e) {
        localStorage.removeItem("jnt_session");
      }
    }
  }, []);

  // Fetch Outlets from backend to populate tasks
  useEffect(() => {
    const fetchOutlets = async () => {
      setLoadingConfig(true);
      try {
        const response = await callBackend("getOutlets");
        if (response.status === "success" && response.data) {
          setOutlets(response.data);
          // If session exists, pre-set task location
          if (session) {
            setActiveOutletId(session.outlet_id_home);
          } else if (response.data.length > 0) {
            setActiveOutletId(response.data[0].outlet_id);
          }
        }
      } catch (err) {
        console.error("Failed to load outlets configuration", err);
      } finally {
        setLoadingConfig(false);
      }
    };

    fetchOutlets();
  }, [session]);

  const handleLoginSuccess = (userSession: SessionData) => {
    setSession(userSession);
    setActiveOutletId(userSession.outlet_id_home);
    localStorage.setItem("jnt_session", JSON.stringify(userSession));
    setCurrentView(userSession.role.toUpperCase() === "OWNER" ? "dashboard" : userSession.role.toUpperCase() === "ADMIN" ? "admin-dashboard" : "pre-input");
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem("jnt_session");
    localStorage.removeItem("pending_transaksi_id");
    setCurrentView("login");
    toast.info("Anda telah berhasil keluar dari akun.");
  };

  // Restrict Admin override options based on role lock
  const handleActiveOutletChange = (newId: string) => {
    if (!session) return;
    
    // ADMIN can only override if tasking is allowed, but we allow full dropdown selection 
    // per prompt instructions: "ADMIN: outlet_id_home terkunci, tapi ada Lokasi Tugas Aktif dropdown..."
    setActiveOutletId(newId);
  };

  const handleClearCache = () => {
    if (confirm("Apakah Anda yakin ingin menghapus seluruh cache dan data lokal aplikasi? Anda akan dialihkan ke halaman login.")) {
      localStorage.clear();
      sessionStorage.clear();
      setSession(null);
      setCurrentView("login");
      toast.success("Cache dan data lokal berhasil dibersihkan!");
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  };

  const navItems: Array<{ id: string; label: string; icon: React.ComponentType<any>; iconColor?: string }> = [];
  if (session) {
    if (session.role === "ADMIN") {
      navItems.push(
        { id: "admin-dashboard", label: "Dashboard", icon: Landmark },
        { id: "pre-input", label: "Pre-Input", icon: Clipboard },
        { id: "transaksi", label: "Resi & Bayar", icon: FileText },
        { id: "riwayat-transaksi", label: "Riwayat Transaksi", icon: List }
      );
    } else if (session.role === "OWNER") {
      navItems.push(
        { id: "dashboard", label: "Dashboard", icon: Landmark },
        { id: "riwayat-transaksi", label: "Riwayat Transaksi", icon: List },
        { id: "ulasan-maps", label: "Ulasan Maps", icon: Star, iconColor: "text-yellow-500 fill-yellow-500" },
        { id: "guide", label: "Deployment Guide", icon: BookOpen, iconColor: "text-emerald-600" }
      );
    }
  }

  const renderNavLinks = (onItemClick?: () => void) => {
    return navItems.map((item) => {
      const Icon = item.icon;
      const isActive = currentView === item.id;
      return (
        <button
          key={item.id}
          onClick={() => {
            setCurrentView(item.id);
            if (onItemClick) onItemClick();
          }}
          className={`w-full text-left py-3 px-4 rounded-xl flex items-center gap-3 transition-all text-xs font-bold cursor-pointer ${
            isActive 
              ? "bg-red-50 text-[#E4002B] border-l-4 border-[#E4002B] pl-3" 
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          <Icon className={`h-4.5 w-4.5 ${item.iconColor || ""}`} />
          <span>{item.label}</span>
        </button>
      );
    });
  };

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans">
      <ToastContainer />
      
      {/* DESKTOP SIDEBAR (md:flex) */}
      {session && (
        <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-64 bg-white border-r border-gray-150 z-30 flex-col justify-between shadow-sm">
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            {/* Header branding */}
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
              <div className="bg-[#E4002B] p-2 rounded-xl text-white shadow-md shadow-red-500/10">
                <Truck className="h-5 w-5 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-sm font-extrabold text-gray-800 tracking-tight font-sans">
                  J&T OPS PRO
                </span>
                <p className="text-[10px] text-gray-400 font-medium">Sistem Manajemen Outlet</p>
              </div>
            </div>

            {/* Profile Info Card inside Sidebar */}
            <div className="p-4 border-b border-gray-50 bg-slate-50/50 m-4 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="bg-[#E4002B]/10 p-2.5 rounded-xl text-[#E4002B]">
                  <User className="h-4 w-4" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-gray-800 truncate">{session.username}</p>
                  <span className="inline-block mt-0.5 bg-[#E4002B]/10 text-[#E4002B] text-[8px] font-extrabold font-mono px-1.5 py-0.5 rounded uppercase tracking-wider">
                    {session.role}
                  </span>
                </div>
              </div>

              {/* Active Task Info */}
              <div className="mt-4 pt-3 border-t border-slate-200/40 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                  <MapPin className="h-3.5 w-3.5 text-gray-400" />
                  <span>Lokasi Tugas:</span>
                </div>
                <p className="text-[11px] font-bold text-gray-700 font-mono pl-5 truncate">
                  {outlets.find((o) => o.outlet_id === activeOutletId)?.nama_outlet || activeOutletId}
                </p>
              </div>
            </div>

            {/* Nav Menu Links */}
            <nav className="px-4 py-2 space-y-1">
              {renderNavLinks()}
            </nav>
          </div>

          {/* Bottom logout and cache clear section */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/50 space-y-1">
            <button
              onClick={handleClearCache}
              className="w-full py-2.5 px-4 text-left text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-3 transition-colors cursor-pointer"
            >
              <Trash2 className="h-4.5 w-4.5 text-red-500" />
              <span>Hapus Cache</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full py-2.5 px-4 text-left text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-3 transition-colors cursor-pointer"
            >
              <LogOut className="h-4.5 w-4.5" />
              <span>Keluar Akun</span>
            </button>
          </div>
        </aside>
      )}

      {/* MOBILE STICKY HEADER (md:hidden) */}
      {session && (
        <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-150 z-30 px-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Tiny Logo */}
            <div className="flex items-center gap-2">
              <div className="bg-[#E4002B] p-1.5 rounded-lg text-white">
                <Truck className="h-4 w-4" />
              </div>
              <span className="text-xs font-black text-gray-800 tracking-tight">
                J&T OPS PRO
              </span>
              <span className="bg-red-50 text-[#E4002B] text-[8px] font-black px-1 rounded uppercase tracking-wider">
                {session.role}
              </span>
            </div>
          </div>

          {/* Active Location Display on mobile right */}
          <div className="flex items-center gap-1.5 text-[10px] bg-gray-50 py-1.5 px-2.5 rounded-lg border border-gray-100 max-w-[140px] truncate">
            <MapPin className="h-3 w-3 text-red-500 shrink-0" />
            <span className="font-bold text-gray-700 truncate">
              {outlets.find((o) => o.outlet_id === activeOutletId)?.nama_outlet || activeOutletId}
            </span>
          </div>
        </header>
      )}

      {/* MOBILE DRAWER OVERLAY */}
      {session && mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
          />

          {/* Drawer panel */}
          <div className="relative flex w-64 max-w-xs flex-col bg-white h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {/* Header / close */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-[#E4002B] p-2 rounded-xl text-white">
                  <Truck className="h-5 w-5" />
                </div>
                <span className="text-sm font-extrabold text-gray-800">
                  J&T OPS PRO
                </span>
              </div>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* User Profile */}
            <div className="p-4 border-b border-gray-50 bg-slate-50/50 m-3 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="bg-[#E4002B]/10 p-2 rounded-lg text-[#E4002B]">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-800">{session.username}</p>
                  <span className="bg-gray-150 text-gray-600 text-[8px] font-extrabold font-mono px-1 py-0.5 rounded uppercase tracking-wider">
                    {session.role}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-200/40 text-[10px] text-gray-500">
                <span className="font-semibold text-gray-400">Lokasi Tugas:</span>
                <p className="font-bold text-gray-700 font-mono mt-0.5">
                  {outlets.find((o) => o.outlet_id === activeOutletId)?.nama_outlet || activeOutletId}
                </p>
              </div>
            </div>

            {/* Menu Links */}
            <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
              {renderNavLinks(() => setMobileSidebarOpen(false))}
            </nav>

            {/* Footer / logout and cache clear inside drawer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 space-y-1">
              <button
                onClick={() => {
                  setMobileSidebarOpen(false);
                  handleClearCache();
                }}
                className="w-full py-2 px-4 text-left text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-3 transition-colors cursor-pointer"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
                <span>Hapus Cache</span>
              </button>
              <button
                onClick={() => {
                  setMobileSidebarOpen(false);
                  handleLogout();
                }}
                className="w-full py-2 px-4 text-left text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-3 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Keluar Akun</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BODY CONTENT - CONDITIONALLY RENDER VIEW */}
      <main className={`flex-1 pb-24 ${session ? "md:pl-64 pt-16 md:pt-0" : ""}`}>
        {currentView === "login" && !session && (
          <LoginPage onLoginSuccess={handleLoginSuccess} />
        )}

        {session && currentView === "pre-input" && (
          <PreInputPage
            session={session}
            activeOutletId={activeOutletId}
            onChangeActiveOutlet={handleActiveOutletChange}
            outlets={outlets}
            onNavigate={setCurrentView}
          />
        )}

        {session && currentView === "transaksi" && (
          <TransaksiPage
            session={session}
            activeOutletId={activeOutletId}
            onChangeActiveOutlet={handleActiveOutletChange}
            outlets={outlets}
            onNavigate={setCurrentView}
          />
        )}

        {session && currentView === "dashboard" && (
          <DashboardPage
            session={session}
            outlets={outlets}
          />
        )}
        
        {session && currentView === "admin-dashboard" && (
          <AdminDashboardPage
            session={session}
            activeOutletId={activeOutletId}
            outlets={outlets}
            onNavigate={setCurrentView}
            onChangeActiveOutlet={handleActiveOutletChange}
          />
        )}

        {session && currentView === "riwayat-transaksi" && (
          <RiwayatTransaksiPage
            session={session}
            outlets={outlets}
            activeOutletId={activeOutletId}
          />
        )}

        {session && currentView === "ulasan-maps" && (
          <UlasanMapsPage />
        )}

        {session && currentView === "guide" && (
          <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-150 p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-2">
                <BookOpen className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-gray-800">Panduan Deployment J&T Express & Cargo</h2>
              </div>

              <div className="text-xs text-gray-600 space-y-3 leading-relaxed">
                <p>
                  Aplikasi **J&T OPS PRO** ini telah didesain dengan arsitektur hibrida berkelas tinggi. Seluruh antarmuka dikodekan menggunakan **React 19** dan dikonfigurasi agar dapat dideploy ke **Google Apps Script** instan dengan performa tanpa cela.
                </p>

                <h3 className="font-bold text-gray-800 text-sm mt-4">Langkah 1: Setup Google Sheet</h3>
                <ol className="list-decimal pl-5 space-y-1.5 font-sans">
                  <li>Buat Spreadsheet baru di Google Drive Anda.</li>
                  <li>Buka Spreadsheet, lalu klik **Extensions** &gt; **Apps Script**.</li>
                  <li>Hapus kode bawaan di dalam editor script.</li>
                </ol>

                <h3 className="font-bold text-gray-800 text-sm mt-4">Langkah 2: Tambahkan Backend Script (`Code.gs`)</h3>
                <p>
                  Salin seluruh isi file <code className="bg-gray-100 px-1 font-mono text-red-700">Code.gs</code> yang telah dibuat di folder proyek Anda dan paste ke dalam file **Code.gs** di editor Google Apps Script Anda.
                </p>

                <h3 className="font-bold text-gray-800 text-sm mt-4">Langkah 3: Tambahkan Frontend (`Index.html`)</h3>
                <p>
                  Di editor Apps Script, klik tombol tambah file (+) &gt; pilih **HTML**, beri nama <code className="bg-gray-100 px-1 font-mono">Index</code>. Salin isi file <code className="bg-gray-100 px-1 font-mono text-[#E4002B]">Index.html</code> dari proyek ini dan paste ke file tersebut.
                </p>

                <h3 className="font-bold text-gray-800 text-sm mt-4">Langkah 4: Konfigurasi API Key Gemini</h3>
                <p>
                  Dapatkan API Key gratis untuk model Gemini di AI Studio. Di editor Apps Script Anda, buka **Project Settings** (ikon gir di sebelah kiri) &gt; **Script Properties** &gt; Tambahkan properti berikut:
                </p>
                <div className="bg-gray-900 text-white font-mono p-3 rounded-lg text-[11px] overflow-x-auto space-y-1">
                  <p><span className="text-[#E4002B]">GEMINI_API_KEY</span> = [Kunci API Gemini Anda]</p>
                  <p><span className="text-blue-400">DRIVE_FOLDER_ID</span> = [ID Folder Google Drive untuk upload foto - Opsional]</p>
                </div>

                <h3 className="font-bold text-gray-800 text-sm mt-4">Langkah 5: Publish / Deploy Aplikasi</h3>
                <ol className="list-decimal pl-5 space-y-1.5 font-sans">
                  <li>Klik tombol **Deploy** di kanan atas &gt; pilih **New Deployment**.</li>
                  <li>Pilih jenis deployment: **Web App**.</li>
                  <li>Ubah **Execute as:** menjadi **Me (email Anda)**.</li>
                  <li>Ubah **Who has access:** menjadi **Anyone** atau sesuaikan dengan outlet Anda.</li>
                  <li>Klik **Deploy**, berikan izin akses Google Drive & Sheets ketika diminta.</li>
                  <li>Salin **Web App URL** yang dihasilkan. Selamat! Aplikasi J&T OPS PRO Anda sudah bisa diakses online dari HP seluruh admin outlet.</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-gray-150 py-4 text-center text-[10px] text-gray-400 font-mono">
        <div>
          J&T OPS PRO © 2026. Dikembangkan untuk efisiensi operasional J&T Express & J&T Cargo.
        </div>
        <div className="mt-1 font-bold">
          Sistem Operasional & Pakar Alamat AI Aktif.
        </div>

      </footer>

    </div>
  );
}
