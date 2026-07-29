import React, { useState, useEffect } from "react";
import { Settings, Save, AlertCircle, Building2, User as UserIcon, Users, HardDrive, FileText, CheckCircle, XCircle, Search, Plus, Key, Lock, Check, Tags, BookOpen } from "lucide-react";
import useAppsScript from "../../hooks/useAppsScript";
import { toast } from "../../utils/toast";
import { SessionData, Outlet, User, SystemSettings } from "../../types";
import MasterKategoriKeuanganPage from "./MasterKategoriKeuanganPage";
import DeploymentGuide from "./DeploymentGuide";

interface SettingsPageProps {
  session: SessionData;
  outlets: Outlet[];
}

const Modal = ({ title, onClose, onSubmit, children, ctaText = "Simpan", loading = false }: any) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <h3 className="font-bold text-gray-800">{title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle size={20} /></button>
      </div>
      <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
        {children}
      </div>
      <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
        <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg disabled:opacity-50">Batal</button>
        <button onClick={onSubmit} disabled={loading} className="px-4 py-2 text-sm font-bold text-white bg-[#E4002B] hover:bg-red-700 rounded-lg disabled:opacity-50 min-w-[100px] flex justify-center items-center">
          {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : ctaText}
        </button>
      </div>
    </div>
  </div>
);

type TabKey = "outlet" | "user" | "kategori" | "drive" | "standards" | "guide";

const SettingsPage: React.FC<SettingsPageProps> = ({ session, outlets }) => {
  const { callBackend } = useAppsScript();
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>(session.role === "OWNER" ? "outlet" : "user");
  
  const [outletList, setOutletList] = useState<Outlet[]>([]);
  const [userList, setUserList] = useState<User[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [driveValidation, setDriveValidation] = useState<Record<string, "none" | "loading" | "success" | "error">>({});
  
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [adminSaving, setAdminSaving] = useState(false);

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({});
  
  const [showAddOutletModal, setShowAddOutletModal] = useState(false);
  const [newOutlet, setNewOutlet] = useState<Partial<Outlet>>({});

  const [showResetPasswordModal, setShowResetPasswordModal] = useState<string | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState("");
  const [confirmResetPasswordVal, setConfirmResetPasswordVal] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setFetching(true);
    try {
      const response = await callBackend("getAllSettings");
      if (response.status === "success" && response.data) {
        setOutletList(response.data.outlets || []);
        setUserList(response.data.users || []);
        setSystemSettings(response.data.systemSettings || null);
      }
    } catch (e) {
      console.error(e);
      toast.error("Gagal memuat pengaturan.");
    } finally {
      setFetching(false);
    }
  };

  const markSaved = (id: string) => {
    setSavedStatus(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setSavedStatus(prev => ({ ...prev, [id]: false }));
    }, 3000);
  };

  const handleChangeOutlet = (outletId: string, field: keyof Outlet, value: any) => {
    setOutletList(prev => prev.map(o => o.outlet_id === outletId ? { ...o, [field]: value } : o));
  };

  const handleChangeUser = (userId: string, field: keyof User, value: any) => {
    setUserList(prev => prev.map(u => u.user_id === userId ? { ...u, [field]: value } : u));
  };

  const handleChangeDrive = (field: keyof SystemSettings, value: string) => {
    if (systemSettings) {
      setSystemSettings({ ...systemSettings, [field]: value });
      setDriveValidation(prev => ({ ...prev, [field]: "none" }));
    }
  };

  const handleTestConnection = async (field: string, folderId: string) => {
    if (!folderId) {
      toast.error("Folder ID kosong.");
      return;
    }
    setDriveValidation(prev => ({ ...prev, [field]: "loading" }));
    try {
      const response = await callBackend("testDriveConnection", { folderId });
      if (response.status === "success") {
        setDriveValidation(prev => ({ ...prev, [field]: "success" }));
      } else {
        setDriveValidation(prev => ({ ...prev, [field]: "error" }));
      }
    } catch (e) {
      setDriveValidation(prev => ({ ...prev, [field]: "error" }));
    }
  };

  const saveDriveItem = async (field: keyof SystemSettings) => {
    if (!systemSettings) return;
    try {
      const val = systemSettings[field];
      if (field === "apps_script_url" && typeof window !== "undefined") {
        if (val) localStorage.setItem("APPS_SCRIPT_URL", val as string);
        else localStorage.removeItem("APPS_SCRIPT_URL");
      }
      if (field === "spreadsheet_id" && typeof window !== "undefined") {
        if (val) localStorage.setItem("SPREADSHEET_ID", val as string);
        else localStorage.removeItem("SPREADSHEET_ID");
      }

      const partialSettings = { [field]: val };
      const response = await callBackend("saveAllSettings", {
        user_id: session.user_id,
        systemSettings: partialSettings,
      });
      if (response.status === "success") {
        markSaved(`drive_${field}`);
        toast.success("Pengaturan tersimpan!");
      } else {
        toast.error("Gagal menyimpan pengaturan");
      }
    } catch(e) {
      toast.error("Kesalahan jaringan");
    }
  };

  const saveSingleUser = async (user: User) => {
    try {
      const response = await callBackend("saveAllSettings", {
        user_id: session.user_id,
        users: [user],
      });
      if (response.status === "success") {
        markSaved(`user_${user.user_id}`);
        toast.success("User tersimpan!");
      } else {
        toast.error("Gagal menyimpan User");
      }
    } catch(e) {
      toast.error("Kesalahan jaringan");
    }
  };

  const saveSingleOutlet = async (outlet: Outlet) => {
    try {
      const response = await callBackend("saveAllSettings", {
        user_id: session.user_id,
        outlets: [outlet],
      });
      if (response.status === "success") {
        markSaved(`outlet_${outlet.outlet_id}`);
        toast.success("Outlet tersimpan!");
      } else {
        toast.error("Gagal menyimpan Outlet");
      }
    } catch(e) {
      toast.error("Kesalahan jaringan");
    }
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password_hash || !newUser.role || !newUser.outlet_id_home) {
      toast.error("Lengkapi data user");
      return;
    }
    const userToSave = {
      ...newUser,
      user_id: "USR_" + Date.now(),
      status_aktif: "AKTIF",
      password_hash: "hash_" + newUser.password_hash, 
    } as User;
    
    try {
      const response = await callBackend("saveAllSettings", {
        user_id: session.user_id,
        users: [userToSave],
      });
      if (response.status === "success") {
        toast.success("User berhasil ditambahkan!");
        setUserList([userToSave, ...userList]);
        setShowAddUserModal(false);
        setNewUser({});
      } else {
        toast.error("Gagal menambah User");
      }
    } catch(e) {
      toast.error("Kesalahan jaringan");
    }
  };

  const handleAddOutlet = async () => {
    if (!newOutlet.nama_outlet || !newOutlet.kode_outlet) {
      toast.error("Lengkapi Nama dan Kode Outlet");
      return;
    }
    const outletToSave = {
      ...newOutlet,
      outlet_id: "OUT_" + Date.now(),
      status_aktif: "AKTIF"
    } as Outlet;

    try {
      const response = await callBackend("saveAllSettings", {
        user_id: session.user_id,
        outlets: [outletToSave],
      });
      if (response.status === "success") {
        toast.success("Outlet berhasil ditambahkan!");
        setOutletList([...outletList, outletToSave]);
        setShowAddOutletModal(false);
        setNewOutlet({});
      } else {
        toast.error("Gagal menambah Outlet");
      }
    } catch(e) {
      toast.error("Kesalahan jaringan");
    }
  };

  const handleResetPassword = async () => {
    if (resetPasswordVal !== confirmResetPasswordVal) {
      toast.error("Konfirmasi password tidak cocok");
      return;
    }
    if (!resetPasswordVal) {
      toast.error("Password tidak boleh kosong");
      return;
    }
    const user = userList.find(u => u.user_id === showResetPasswordModal);
    if (!user) return;

    try {
      const updated = { ...user, password_hash: "hash_" + resetPasswordVal };
      const response = await callBackend("saveAllSettings", {
        user_id: session.user_id,
        users: [updated],
      });
      if (response.status === "success") {
        toast.success("Password direset!");
        handleChangeUser(updated.user_id, "password_hash", updated.password_hash);
        setShowResetPasswordModal(null);
        setResetPasswordVal("");
        setConfirmResetPasswordVal("");
      } else {
        toast.error("Gagal mereset password");
      }
    } catch(e) {
      toast.error("Kesalahan jaringan");
    }
  };

  const handleAdminChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password tidak cocok");
      return;
    }
    if (!oldPassword || !newPassword) {
      toast.error("Lengkapi form password");
      return;
    }
    setAdminSaving(true);
    try {
      const response = await callBackend("changePassword", {
        user_id: session.user_id,
        old_password: oldPassword,
        new_password: newPassword
      });
      if (response.status === "success") {
        toast.success("Kata sandi berhasil diubah");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        markSaved("admin_password");
      } else {
        toast.error(response.message || "Kata sandi lama salah");
      }
    } catch(e) {
      toast.error("Kesalahan jaringan");
    } finally {
      setAdminSaving(false);
    }
  };

  if (fetching) {
    return <div className="p-8 text-center text-gray-500">Memuat konfigurasi...</div>;
  }

  // ==== RENDER ADMIN ====
  if (session.role === "ADMIN") {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto space-y-6 animate-fade-in pb-24">
        <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2 mb-6">
          <Settings className="text-[#E4002B]" />
          Pengaturan Akun
        </h1>
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
            <div className="bg-gray-100 p-3 rounded-xl text-gray-700">
              <Lock size={24} />
            </div>
            <div>
              <h2 className="font-bold text-gray-800">Ubah Kata Sandi</h2>
              <p className="text-xs text-gray-500">Pastikan Anda menggunakan kata sandi yang kuat.</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Kata Sandi Lama</label>
              <input 
                type="password" 
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#E4002B] outline-none" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Kata Sandi Baru</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#E4002B] outline-none" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Konfirmasi Kata Sandi</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#E4002B] outline-none" 
              />
            </div>
            <div className="pt-2">
              <button
                onClick={handleAdminChangePassword}
                disabled={adminSaving}
                className="bg-[#E4002B] hover:bg-red-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all w-full md:w-auto disabled:opacity-50 min-w-[150px]"
              >
                {savedStatus["admin_password"] ? (
                  <><Check size={18} /> Tersimpan</>
                ) : (
                  <><Save size={18} /> Simpan Perubahan</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==== RENDER OWNER ====
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Settings className="text-[#E4002B]" />
            Configuration Center
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Pusat pengaturan sistem operasional J&T OPS PRO.
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-6">
          {/* MASTER DATA */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2">Master Data</h3>
            <button
              onClick={() => setActiveTab("outlet")}
              className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors ${activeTab === "outlet" ? "bg-[#E4002B] text-white shadow-md border-l-4 border-red-700" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-100"}`}
            >
              <Building2 size={18} /> Master Outlet
            </button>
            <button
              onClick={() => setActiveTab("user")}
              className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors ${activeTab === "user" ? "bg-[#E4002B] text-white shadow-md border-l-4 border-red-700" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-100"}`}
            >
              <Users size={18} /> Master User
            </button>
            <button
              onClick={() => setActiveTab("kategori")}
              className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors ${activeTab === "kategori" ? "bg-purple-600 text-white shadow-md border-l-4 border-purple-800" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-100"}`}
            >
              <Tags size={18} /> Kategori Keuangan
            </button>
          </div>

          {/* STORAGE & DATABASE */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2">Storage & Database</h3>
            <button
              onClick={() => setActiveTab("drive")}
              className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors ${activeTab === "drive" ? "bg-[#E4002B] text-white shadow-md border-l-4 border-red-700" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-100"}`}
            >
              <HardDrive size={18} /> Database & Drive
            </button>
          </div>

          {/* DOKUMENTASI */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2">Dokumentasi</h3>
            <button
              onClick={() => setActiveTab("standards")}
              className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors ${activeTab === "standards" ? "bg-[#E4002B] text-white shadow-md border-l-4 border-red-700" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-100"}`}
            >
              <FileText size={18} /> Naming Standard
            </button>
            <button
              onClick={() => setActiveTab("guide")}
              className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors ${activeTab === "guide" ? "bg-emerald-600 text-white shadow-md border-l-4 border-emerald-800" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-100"}`}
            >
              <BookOpen size={18} /> Deployment Guide
            </button>
          </div>
        </div>

        <div className="flex-1 w-full min-w-0">
          
          {/* TAB: OUTLET */}
          {activeTab === "outlet" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-gray-50 p-4 border border-gray-200 rounded-xl">
                <div>
                  <h2 className="font-bold text-gray-800">Daftar Outlet</h2>
                  <p className="text-xs text-gray-500">Kelola operasional dan target per outlet.</p>
                </div>
                <button 
                  onClick={() => setShowAddOutletModal(true)}
                  className="bg-white border border-gray-200 text-gray-700 hover:border-[#E4002B] hover:text-[#E4002B] px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-sm"
                >
                  <Plus size={16} /> Tambah Outlet
                </button>
              </div>

              {outletList.map((o) => (
                <div key={o.outlet_id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 border-b border-gray-100 pb-3 mb-4">
                    <div className="bg-gray-100 p-2 rounded-lg text-gray-600">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">{o.nama_outlet}</h3>
                      <p className="text-xs text-gray-500 font-mono">{o.kode_outlet}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nama Outlet</label>
                      <input 
                        type="text" 
                        value={o.nama_outlet} 
                        onChange={(e) => handleChangeOutlet(o.outlet_id, "nama_outlet", e.target.value)} 
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Kode Outlet</label>
                      <input 
                        type="text" 
                        value={o.kode_outlet || ""} 
                        onChange={(e) => handleChangeOutlet(o.outlet_id, "kode_outlet", e.target.value)} 
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nomor WA Outlet</label>
                      <input 
                        type="text" 
                        value={o.no_wa_outlet || ""} 
                        onChange={(e) => handleChangeOutlet(o.outlet_id, "no_wa_outlet", e.target.value)} 
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" 
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Alamat Outlet</label>
                      <input 
                        type="text" 
                        value={o.alamat_outlet} 
                        onChange={(e) => handleChangeOutlet(o.outlet_id, "alamat_outlet", e.target.value)} 
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Status</label>
                      <select 
                        value={o.status_aktif || "AKTIF"} 
                        onChange={(e) => handleChangeOutlet(o.outlet_id, "status_aktif", e.target.value as any)} 
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none"
                      >
                        <option value="AKTIF">AKTIF</option>
                        <option value="NON-AKTIF">NON-AKTIF</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Target Harian Express</label>
                      <input 
                        type="number" 
                        value={o.target_express || 0} 
                        onChange={(e) => handleChangeOutlet(o.outlet_id, "target_express", Number(e.target.value))} 
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Target Harian Cargo</label>
                      <input 
                        type="number" 
                        value={o.target_cargo || 0} 
                        onChange={(e) => handleChangeOutlet(o.outlet_id, "target_cargo", Number(e.target.value))} 
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" 
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-2 border-t border-gray-50">
                    <button 
                      onClick={() => saveSingleOutlet(o)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors min-w-[120px] ${savedStatus[`outlet_${o.outlet_id}`] ? "bg-green-100 text-green-700" : "bg-gray-100 hover:bg-gray-200 text-gray-800"}`}
                    >
                      {savedStatus[`outlet_${o.outlet_id}`] ? (
                        <><Check size={16} /> Tersimpan</>
                      ) : (
                        <><Save size={16} /> Simpan</>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: USER */}
          {activeTab === "user" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-gray-50 p-4 border border-gray-200 rounded-xl">
                <div>
                  <h2 className="font-bold text-gray-800">Daftar Pengguna</h2>
                  <p className="text-xs text-gray-500">Kelola akun Admin dan Owner.</p>
                </div>
                <button 
                  onClick={() => setShowAddUserModal(true)}
                  className="bg-white border border-gray-200 text-gray-700 hover:border-[#E4002B] hover:text-[#E4002B] px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-sm"
                >
                  <Plus size={16} /> Tambah User
                </button>
              </div>

              {userList.map((u) => (
                <div key={u.user_id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-gray-100 p-2 rounded-lg text-gray-600">
                        <UserIcon size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800">{u.username}</h3>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${u.role === 'OWNER' ? 'bg-red-100 text-[#E4002B]' : 'bg-blue-100 text-blue-700'}`}>
                          {u.role}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowResetPasswordModal(u.user_id)}
                      className="text-xs font-bold text-gray-500 hover:text-gray-800 flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200"
                    >
                      <Key size={14} /> Reset Password
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nama Lengkap</label>
                      <input 
                        type="text" 
                        value={u.nama_lengkap} 
                        onChange={(e) => handleChangeUser(u.user_id, "nama_lengkap", e.target.value)} 
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nomor WhatsApp</label>
                      <input 
                        type="text" 
                        value={u.no_wa || ""} 
                        onChange={(e) => handleChangeUser(u.user_id, "no_wa", e.target.value)} 
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" 
                        placeholder="08..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Role</label>
                      <select 
                        value={u.role} 
                        onChange={(e) => handleChangeUser(u.user_id, "role", e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none"
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="OWNER">OWNER</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Outlet Penugasan</label>
                      <select 
                        value={u.outlet_id_home} 
                        onChange={(e) => handleChangeUser(u.user_id, "outlet_id_home", e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none"
                      >
                        {outlets.map(o => <option key={o.outlet_id} value={o.outlet_id}>{o.nama_outlet}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Status</label>
                      <select 
                        value={u.status_aktif || "AKTIF"} 
                        onChange={(e) => handleChangeUser(u.user_id, "status_aktif", e.target.value as any)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none"
                      >
                        <option value="AKTIF">AKTIF</option>
                        <option value="NON-AKTIF">NON-AKTIF</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-2 border-t border-gray-50">
                    <button 
                      onClick={() => saveSingleUser(u)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors min-w-[120px] ${savedStatus[`user_${u.user_id}`] ? "bg-green-100 text-green-700" : "bg-gray-100 hover:bg-gray-200 text-gray-800"}`}
                    >
                      {savedStatus[`user_${u.user_id}`] ? (
                        <><Check size={16} /> Tersimpan</>
                      ) : (
                        <><Save size={16} /> Simpan</>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: KATEGORI KEUANGAN */}
          {activeTab === "kategori" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-0 overflow-hidden">
              <MasterKategoriKeuanganPage session={session} />
            </div>
          )}

          {/* TAB: DRIVE & DATABASE */}
          {activeTab === "drive" && systemSettings && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-sm text-blue-800">
                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                <p>Konfigurasi Database Google Apps Script, Spreadsheet ID, dan Folder Google Drive untuk menyimpan data serta file unggahan operasional outlet secara otomatis.</p>
              </div>

              {/* DATABASE & APPS SCRIPT INTEGRATION */}
              <div className="bg-white border-2 border-blue-100 rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-800 text-base flex items-center gap-2 border-b border-gray-100 pb-2">
                  <HardDrive className="text-blue-600" size={18} />
                  Integrasi Database Spreadsheet
                </h3>

                {/* ID Spreadsheet Database */}
                <div className="flex flex-col gap-2">
                  <div>
                    <label className="block font-bold text-gray-800 text-sm">ID Spreadsheet Database</label>
                    <p className="text-xs text-gray-500">ID unik Google Sheet yang dipakai sebagai database utama (diambil dari URL Spreadsheet antara /d/ dan /edit).</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <input 
                      type="text" 
                      value={(systemSettings as any).spreadsheet_id || ""} 
                      onChange={(e) => handleChangeDrive("spreadsheet_id", e.target.value)} 
                      placeholder="1a2b3c4d5e6f7g8h9i0j..."
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none font-mono min-w-0"
                    />
                    <button 
                      onClick={() => saveDriveItem("spreadsheet_id")}
                      className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors shrink-0 ${savedStatus["drive_spreadsheet_id"] ? "bg-green-100 text-green-700" : "bg-[#E4002B] hover:bg-red-700 text-white"}`}
                    >
                      {savedStatus["drive_spreadsheet_id"] ? <><Check size={14} /> Oke</> : <><Save size={14} /> Simpan</>}
                    </button>
                  </div>
                </div>
              </div>

              {/* FOLDER DRIVE OPERASIONAL */}
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider pt-2">Folder Google Drive Operasional</h3>

              {[
                { key: "folder_bukti_bayar_customer", label: "Bukti Bayar Customer", desc: "Screenshot bukti transfer customer (Pre-Input)." },
                { key: "folder_foto_paket", label: "Foto Paket", desc: "Foto fisik paket sebelum dikirim." },
                { key: "folder_foto_resi", label: "Foto Resi", desc: "Foto resi fisik yang tercetak." },
                { key: "folder_bukti_kas_masuk", label: "Bukti Kas Masuk", desc: "Pemasukan operasional harian outlet." },
                { key: "folder_bukti_kas_keluar", label: "Bukti Kas Keluar", desc: "Pengeluaran operasional (seperti bensin, ATK)." },
                { key: "folder_bukti_transfer_admin_owner", label: "Setoran Admin → Owner", desc: "Bukti transfer setoran shift admin." },
                { key: "folder_bukti_transfer_owner_dp", label: "Setoran Owner → DP/Gudang", desc: "Bukti transfer owner ke rekening perusahaan." },
              ].map((item) => (
                <div key={item.key} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="block font-bold text-gray-800 text-sm mb-1">{item.label}</label>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <input 
                        type="text" 
                        value={(systemSettings as any)[item.key] || ""} 
                        onChange={(e) => handleChangeDrive(item.key as keyof SystemSettings, e.target.value)} 
                        placeholder="Misal: 1A2b3C4d5E6f7G8h9I0j..."
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none font-mono min-w-0"
                      />
                      <div className="flex gap-2 shrink-0">
                        <button 
                          onClick={() => handleTestConnection(item.key, (systemSettings as any)[item.key])}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5"
                        >
                          {driveValidation[item.key] === "loading" ? (
                            <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
                          ) : (
                            <Search size={14} />
                          )}
                          Test
                        </button>
                        <button 
                          onClick={() => saveDriveItem(item.key as keyof SystemSettings)}
                          className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors min-w-[100px] ${savedStatus[`drive_${item.key}`] ? "bg-green-100 text-green-700" : "bg-[#E4002B] hover:bg-red-700 text-white"}`}
                        >
                          {savedStatus[`drive_${item.key}`] ? (
                            <><Check size={14} /> Oke</>
                          ) : (
                            <><Save size={14} /> Simpan</>
                          )}
                        </button>
                      </div>
                    </div>
                    {/* Validation Status */}
                    {driveValidation[item.key] === "success" && (
                      <div className="text-xs font-bold text-green-600 flex items-center gap-1.5 animate-fade-in">
                        <CheckCircle size={14} /> ✅ Connected
                      </div>
                    )}
                    {driveValidation[item.key] === "error" && (
                      <div className="text-xs font-bold text-red-600 flex items-center gap-1.5 animate-fade-in">
                        <XCircle size={14} /> ❌ Folder tidak ditemukan
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: STANDARDS */}
          {activeTab === "standards" && (
            <div className="space-y-6">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-black text-gray-800 mb-4 border-b border-gray-200 pb-2">Standar Penamaan File Operasional</h2>
                <p className="text-sm text-gray-600 mb-6">
                  Sistem J&T OPS PRO secara otomatis akan menggunakan format penamaan berikut saat mengunggah file ke Google Drive agar rapi dan mudah dicari.
                </p>

                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-gray-800 mb-2 uppercase text-xs tracking-wider">Customer</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <span className="text-xs text-gray-500 block mb-1">Bukti Bayar Customer</span>
                        <code className="text-sm font-bold text-[#E4002B]">BB_Cust_[Tanggal]_[NoResi]</code>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 mb-2 uppercase text-xs tracking-wider">Operasional Paket</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <span className="text-xs text-gray-500 block mb-1">Foto Paket</span>
                        <code className="text-sm font-bold text-blue-600">Paket_[NoResi]</code>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <span className="text-xs text-gray-500 block mb-1">Foto Resi</span>
                        <code className="text-sm font-bold text-blue-600">Resi_[NoResi]</code>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 mb-2 uppercase text-xs tracking-wider">Keuangan & Kas</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <span className="text-xs text-gray-500 block mb-1">Kas Masuk</span>
                        <code className="text-sm font-bold text-green-600">Kas_Income_[Tanggal]_[NoUrut]</code>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <span className="text-xs text-gray-500 block mb-1">Kas Keluar</span>
                        <code className="text-sm font-bold text-orange-600">Kas_Outcome_[Tanggal]_[NoUrut]</code>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 mb-2 uppercase text-xs tracking-wider">Setoran</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <span className="text-xs text-gray-500 block mb-1">Setoran Admin ke Owner</span>
                        <code className="text-sm font-bold text-purple-600">STR_Admin_[Tanggal]_[KodeOutlet]_[NamaAdmin]_[NoUrut]</code>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <span className="text-xs text-gray-500 block mb-1">Setoran Owner ke DP/Gudang Pusat</span>
                        <code className="text-sm font-bold text-purple-800">STR_DP_[Tanggal]_[KodeOutlet]_[NoUrut]</code>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: GUIDE */}
          {activeTab === "guide" && (
            <DeploymentGuide />
          )}

        </div>
      </div>

      {/* MODALS */}
      
      {/* Add User Modal */}
      {showAddUserModal && (
        <Modal 
          title="Tambah User Baru" 
          onClose={() => setShowAddUserModal(false)}
          onSubmit={handleAddUser}
          ctaText="Simpan User"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Username</label>
              <input type="text" value={newUser.username || ""} onChange={e => setNewUser({...newUser, username: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nama Lengkap</label>
              <input type="text" value={newUser.nama_lengkap || ""} onChange={e => setNewUser({...newUser, nama_lengkap: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nomor WA</label>
              <input type="text" value={newUser.no_wa || ""} onChange={e => setNewUser({...newUser, no_wa: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Password Baru</label>
              <input type="password" value={newUser.password_hash || ""} onChange={e => setNewUser({...newUser, password_hash: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Role</label>
                <select value={newUser.role || ""} onChange={e => setNewUser({...newUser, role: e.target.value as any})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none">
                  <option value="">-- Pilih --</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="OWNER">OWNER</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Outlet</label>
                <select value={newUser.outlet_id_home || ""} onChange={e => setNewUser({...newUser, outlet_id_home: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none">
                  <option value="">-- Pilih --</option>
                  {outlets.map(o => <option key={o.outlet_id} value={o.outlet_id}>{o.nama_outlet}</option>)}
                </select>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Outlet Modal */}
      {showAddOutletModal && (
        <Modal 
          title="Tambah Outlet Baru" 
          onClose={() => setShowAddOutletModal(false)}
          onSubmit={handleAddOutlet}
          ctaText="Simpan Outlet"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nama Outlet</label>
                <input type="text" value={newOutlet.nama_outlet || ""} onChange={e => setNewOutlet({...newOutlet, nama_outlet: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Kode Outlet</label>
                <input type="text" value={newOutlet.kode_outlet || ""} onChange={e => setNewOutlet({...newOutlet, kode_outlet: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Alamat Outlet</label>
              <input type="text" value={newOutlet.alamat_outlet || ""} onChange={e => setNewOutlet({...newOutlet, alamat_outlet: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nomor WA</label>
              <input type="text" value={newOutlet.no_wa_outlet || ""} onChange={e => setNewOutlet({...newOutlet, no_wa_outlet: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Latitude</label>
                <input type="number" value={newOutlet.latitude || ""} onChange={e => setNewOutlet({...newOutlet, latitude: Number(e.target.value)})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Longitude</label>
                <input type="number" value={newOutlet.longitude || ""} onChange={e => setNewOutlet({...newOutlet, longitude: Number(e.target.value)})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Radius (meter)</label>
                <input type="number" value={newOutlet.radius_operasional || ""} onChange={e => setNewOutlet({...newOutlet, radius_operasional: Number(e.target.value)})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Target Express</label>
                <input type="number" value={newOutlet.target_express || ""} onChange={e => setNewOutlet({...newOutlet, target_express: Number(e.target.value)})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Target Cargo</label>
                <input type="number" value={newOutlet.target_cargo || ""} onChange={e => setNewOutlet({...newOutlet, target_cargo: Number(e.target.value)})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && (
        <Modal 
          title="Reset Password Pengguna" 
          onClose={() => setShowResetPasswordModal(null)}
          onSubmit={handleResetPassword}
          ctaText="Reset Password"
        >
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-100 p-3 rounded-lg text-sm text-orange-800">
              Anda akan mereset password untuk user ini.
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Password Baru</label>
              <input type="password" value={resetPasswordVal} onChange={e => setResetPasswordVal(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Konfirmasi Password Baru</label>
              <input type="password" value={confirmResetPasswordVal} onChange={e => setConfirmResetPasswordVal(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#E4002B] outline-none" />
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default SettingsPage;
