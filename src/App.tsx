import React, { useState, useEffect } from "react";
import { 
  Truck, LogOut, User, MapPin, Clipboard, FileText, Landmark, BookOpen, AlertCircle, List, Star
} from "lucide-react";
import useAppsScript from "./hooks/useAppsScript";
import LoginPage from "./components/LoginPage";
import PreInputPage from "./components/PreInputPage";
import TransaksiPage from "./components/TransaksiPage";
import DashboardPage from "./components/DashboardPage";
import RiwayatTransaksiPage from "./components/RiwayatTransaksiPage";
import UlasanMapsPage from "./components/UlasanMapsPage";
import ToastContainer from "./components/ToastContainer";
import { SessionData, Outlet } from "./types";
import { toast } from "./utils/toast";

export default function App() {
  const { callBackend } = useAppsScript();

  // Authentication State
  const [session, setSession] = useState<SessionData | null>(null);
  
  // Navigation State
  const [currentView, setCurrentView] = useState<string>("login");

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
        setCurrentView(parsed.role === "OWNER" ? "dashboard" : "pre-input");
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
    setCurrentView(userSession.role === "OWNER" ? "dashboard" : "pre-input");
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

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans">
      <ToastContainer />
      
      {/* HEADER BAR (Only visible when logged in) */}
      {session && (
        <header className="bg-white border-b border-gray-150 sticky top-0 z-50 shadow-sm">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex justify-between items-center h-16">
              
              {/* Logo Identity */}
              <div className="flex items-center gap-2.5">
                <div className="bg-[#E4002B] p-2 rounded-xl text-white shadow-md shadow-red-500/10">
                  <Truck className="h-5 w-5 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-sm font-extrabold text-gray-800 tracking-tight font-sans">
                    J&T OPS PRO
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="bg-gray-150 text-gray-600 text-[8px] font-bold font-mono px-1 py-0.5 rounded uppercase tracking-wider">
                      {session.role}
                    </span>
                    <span className="text-[9px] text-gray-400">
                      • {session.username}
                    </span>
                  </div>
                </div>
              </div>

              {/* Navigation Menu Links */}
              <nav className="hidden md:flex items-center gap-1 text-xs font-semibold text-gray-600">
                {session.role !== "OWNER" && (
                  <>
                    <button
                      onClick={() => setCurrentView("pre-input")}
                      className={`py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer ${
                        currentView === "pre-input" ? "bg-red-50 text-[#E4002B]" : "hover:bg-gray-50"
                      }`}
                    >
                      <Clipboard className="h-4 w-4" />
                      <span>Pre-Input</span>
                    </button>

                    <button
                      onClick={() => setCurrentView("transaksi")}
                      className={`py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer ${
                        currentView === "transaksi" ? "bg-red-50 text-[#E4002B]" : "hover:bg-gray-50"
                      }`}
                    >
                      <FileText className="h-4 w-4" />
                      <span>Input Resi & Finansial</span>
                    </button>
                  </>
                )}

                {session.role !== "ADMIN" && (
                  <>
                    <button
                      onClick={() => setCurrentView("dashboard")}
                      className={`py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer ${
                        currentView === "dashboard" ? "bg-red-50 text-[#E4002B]" : "hover:bg-gray-50"
                      }`}
                    >
                      <Landmark className="h-4 w-4" />
                      <span>Dashboard</span>
                    </button>

                    <button
                      onClick={() => setCurrentView("riwayat-transaksi")}
                      className={`py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer ${
                        currentView === "riwayat-transaksi" ? "bg-red-50 text-[#E4002B]" : "hover:bg-gray-50"
                      }`}
                    >
                      <List className="h-4 w-4" />
                      <span>Riwayat Transaksi</span>
                    </button>

                    <button
                      onClick={() => setCurrentView("ulasan-maps")}
                      className={`py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer ${
                        currentView === "ulasan-maps" ? "bg-red-50 text-[#E4002B]" : "hover:bg-gray-50"
                      }`}
                    >
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <span>Ulasan Maps</span>
                    </button>

                    <button
                      onClick={() => setCurrentView("guide")}
                      className={`py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer ${
                        currentView === "guide" ? "bg-red-50 text-[#E4002B]" : "hover:bg-gray-50"
                      }`}
                    >
                      <BookOpen className="h-4 w-4 text-emerald-600" />
                      <span>Deployment Guide</span>
                    </button>
                  </>
                )}
              </nav>

              {/* Session Control / Log Out */}
              <div className="flex items-center gap-3">
                
                {/* Active Task Info Indicator */}
                <div className="hidden sm:flex items-center gap-1.5 text-xs bg-gray-50 py-1.5 px-3 rounded-xl border border-gray-100">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-400">Tugas:</span>
                  <span className="font-bold text-gray-700 font-mono">
                    {outlets.find((o) => o.outlet_id === activeOutletId)?.nama_outlet || activeOutletId}
                  </span>
                </div>

                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                  title="Keluar dari Akun"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>

            </div>
          </div>
        </header>
      )}

      {/* MOBILE HEADER SUB-NAVBAR (Only visible on screens < md) */}
      {session && (
        <div className="md:hidden bg-white border-b border-gray-100 flex overflow-x-auto divide-x divide-gray-100 text-center font-semibold text-[11px] text-gray-600">
          {session.role !== "OWNER" && (
            <>
              <button
                onClick={() => setCurrentView("pre-input")}
                className={`flex-1 py-3 px-1.5 flex flex-col items-center gap-1 ${
                  currentView === "pre-input" ? "text-[#E4002B] bg-red-50/50" : ""
                }`}
              >
                <Clipboard className="h-4 w-4" />
                <span>Pre-Input</span>
              </button>
              
              <button
                onClick={() => setCurrentView("transaksi")}
                className={`flex-1 py-3 px-1.5 flex flex-col items-center gap-1 ${
                  currentView === "transaksi" ? "text-[#E4002B] bg-red-50/50" : ""
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>Resi & Bayar</span>
              </button>
            </>
          )}

          {session.role !== "ADMIN" && (
            <>
              <button
                onClick={() => setCurrentView("dashboard")}
                className={`flex-1 py-3 px-1.5 flex flex-col items-center gap-1 ${
                  currentView === "dashboard" ? "text-[#E4002B] bg-red-50/50" : ""
                }`}
              >
                <Landmark className="h-4 w-4" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => setCurrentView("riwayat-transaksi")}
                className={`flex-1 py-3 px-1.5 flex flex-col items-center gap-1 ${
                  currentView === "riwayat-transaksi" ? "text-[#E4002B] bg-red-50/50" : ""
                }`}
              >
                <List className="h-4 w-4" />
                <span>Riwayat</span>
              </button>

              <button
                onClick={() => setCurrentView("ulasan-maps")}
                className={`flex-1 py-3 px-1.5 flex flex-col items-center gap-1 ${
                  currentView === "ulasan-maps" ? "text-[#E4002B] bg-red-50/50" : ""
                }`}
              >
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                <span>Ulasan</span>
              </button>

              <button
                onClick={() => setCurrentView("guide")}
                className={`flex-1 py-3 px-1.5 flex flex-col items-center gap-1 ${
                  currentView === "guide" ? "text-emerald-700 bg-emerald-50/30" : ""
                }`}
              >
                <BookOpen className="h-4 w-4 text-emerald-600" />
                <span>Guide</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* BODY CONTENT - CONDITIONALLY RENDER VIEW */}
      <main className="flex-1 pb-12">
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

        {session && currentView === "riwayat-transaksi" && (
          <RiwayatTransaksiPage
            session={session}
            outlets={outlets}
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
          Sistem Deteksi Duplikasi & Pakar Alamat AI Aktif.
        </div>

      </footer>

    </div>
  );
}
