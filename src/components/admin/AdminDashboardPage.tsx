import React, { useState, useEffect } from "react";
import {
  Target, AlertTriangle, FileText, CheckCircle, Clock,
  RefreshCw, TrendingUp, DollarSign, Wallet, Users, AlertCircle, XCircle, ListCollapse
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import useAppsScript from "../../hooks/useAppsScript";
import { SessionData, Outlet } from "../../types";

interface AdminDashboardPageProps {
  session: SessionData;
  activeOutletId: string;
  outlets: Outlet[];
  onNavigate: (view: string) => void;
  onChangeActiveOutlet?: (id: string) => void;
}

export default function AdminDashboardPage({ session, activeOutletId, outlets, onNavigate, onChangeActiveOutlet }: AdminDashboardPageProps) {
  const { callBackend, loading } = useAppsScript();

  const [startDate, setStartDate] = useState(() => {
    return new Date().toISOString().split("T")[0]; // default today
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [data, setData] = useState<any>(null);

  const loadData = async () => {
    try {
      const res = await callBackend("getAdminDashboardData", {
        user_id: session.user_id,
        role: session.role,
        filterOutlet: activeOutletId,
        dateStart: startDate,
        dateEnd: endDate
      });
      if (res.status === "success") {
        setData(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOutletId, startDate, endDate]);

  if (!data) {
    return (
      <div className="flex justify-center py-20">
        <RefreshCw className="h-8 w-8 text-red-500 animate-spin" />
      </div>
    );
  }

  const { summary, targetHarian, byAdmin, byEkspedisi, statusSetoranList, aktivitasLogs, pembatalanLogs, grafik, alerts } = data;

  const totalSetoran = statusSetoranList.reduce((sum: number, s: any) => sum + s.total_setoran, 0);
  const sudahDisetor = statusSetoranList.filter((s:any) => s.status === "Sudah Disetujui").reduce((sum: number, s: any) => sum + s.total_setoran, 0);
  const sisaSetoran = totalSetoran - sudahDisetor;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 pb-24 space-y-6">
      
      {/* HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
            Dashboard Operasional Admin
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Outlet: {outlets.find(o => o.outlet_id === activeOutletId)?.nama_outlet || "Semua"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">

          <select 
            value={activeOutletId} 
            onChange={(e) => onChangeActiveOutlet && onChangeActiveOutlet(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none text-gray-700"
          >
            
            {outlets.map((o) => (
              <option key={o.outlet_id} value={o.outlet_id}>{o.nama_outlet}</option>
            ))}
          </select>

          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden text-xs">
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent px-3 py-2 outline-none text-gray-700"
            />
            <span className="text-gray-400 font-bold px-1">-</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent px-3 py-2 outline-none text-gray-700"
            />
          </div>
          <button 
            onClick={loadData}
            className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {alerts && alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-800">Alert Operasional</h4>
            <ul className="text-xs text-amber-700 list-disc list-inside mt-1">
              {alerts.map((a: string, i: number) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* TARGET & PROGRESS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-bold text-gray-800">Target Resi Hari Ini</h3>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress: {targetHarian.current} / {targetHarian.target}</span>
            <span className="font-bold">{Math.min(100, Math.round((targetHarian.current/targetHarian.target)*100))}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div 
              className="bg-indigo-500 h-3 rounded-full" 
              style={{ width: `${Math.min(100, Math.max(0, (targetHarian.current/targetHarian.target)*100))}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-gray-800">Progress Setoran (Terpilih)</h3>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Wajib: Rp {totalSetoran.toLocaleString('id-ID')} | Sisa: Rp {sisaSetoran.toLocaleString('id-ID')}</span>
            <span className="font-bold">{totalSetoran === 0 ? 0 : Math.round((sudahDisetor/totalSetoran)*100)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div 
              className="bg-emerald-500 h-3 rounded-full" 
              style={{ width: `${totalSetoran === 0 ? 0 : Math.min(100, Math.max(0, (sudahDisetor/totalSetoran)*100))}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* RINGKASAN HARI INI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
          <p className="text-xs font-bold text-gray-400 uppercase">Total Transaksi</p>
          <p className="text-2xl font-black text-gray-800 mt-1">{summary?.totalTransaksi || 0}</p>
          <FileText className="absolute right-[-10px] bottom-[-10px] h-16 w-16 text-gray-50 opacity-50" />
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
          <p className="text-xs font-bold text-gray-400 uppercase">Resi Express</p>
          <p className="text-2xl font-black text-red-600 mt-1">{summary?.totalResiExpress || 0}</p>
          <FileText className="absolute right-[-10px] bottom-[-10px] h-16 w-16 text-red-50 opacity-50" />
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
          <p className="text-xs font-bold text-gray-400 uppercase">Resi Cargo</p>
          <p className="text-2xl font-black text-blue-600 mt-1">{summary?.totalResiCargo || 0}</p>
          <FileText className="absolute right-[-10px] bottom-[-10px] h-16 w-16 text-blue-50 opacity-50" />
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
          <p className="text-xs font-bold text-gray-400 uppercase">Grand Total (Cust)</p>
          <p className="text-lg md:text-xl font-black text-emerald-600 mt-1 font-mono">
            Rp {(summary?.grandTotalCustomer || 0).toLocaleString("id-ID")}
          </p>
          <DollarSign className="absolute right-[-10px] bottom-[-10px] h-16 w-16 text-emerald-50 opacity-50" />
        </div>
      </div>

      {/* KEUANGAN HARI INI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-100 p-5 rounded-xl flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-blue-800 uppercase mb-1">WAJIB SETOR OWNER</h3>
            <p className="text-2xl font-black font-mono text-blue-900">Rp {(summary?.totalWajibSetorOwner || 0).toLocaleString("id-ID")}</p>
            <p className="text-[10px] text-blue-600 mt-1">Total YoYi/JTC + Pembulatan</p>
          </div>
          <div className="p-3 bg-blue-100 rounded-full">
            <DollarSign className="h-6 w-6 text-blue-600" />
          </div>
        </div>
        <div className="bg-green-50 border border-green-100 p-5 rounded-xl flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-green-800 uppercase mb-1">KAS OUTLET</h3>
            <p className="text-2xl font-black font-mono text-green-900">Rp {(summary?.totalKasOutlet || 0).toLocaleString("id-ID")}</p>
            <p className="text-[10px] text-green-600 mt-1">Packing + Amplop + Biaya Lainnya</p>
          </div>
          <div className="p-3 bg-green-100 rounded-full">
            <Wallet className="h-6 w-6 text-green-600" />
          </div>
        </div>
      </div>

      {/* BERDASARKAN EKSPEDISI & GRAFIK */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <ListCollapse className="h-4 w-4" /> Ringkasan Berdasarkan Ekspedisi
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 border border-gray-100 rounded-lg">
              <div>
                <p className="font-bold text-red-600 text-sm">Express</p>
                <p className="text-xs text-gray-500">{byEkspedisi?.Express?.resi || 0} Resi</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Setoran Owner</p>
                <p className="font-bold text-gray-800 font-mono">Rp {(byEkspedisi?.Express?.setoran || 0).toLocaleString("id-ID")}</p>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 border border-gray-100 rounded-lg">
              <div>
                <p className="font-bold text-blue-600 text-sm">Cargo</p>
                <p className="text-xs text-gray-500">{byEkspedisi?.Cargo?.resi || 0} Resi</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Setoran Owner</p>
                <p className="font-bold text-gray-800 font-mono">Rp {(byEkspedisi?.Cargo?.setoran || 0).toLocaleString("id-ID")}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Grafik Resi (7 Hari Terakhir)
          </h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafik} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: '8px' }} />
                <Bar dataKey="resi" name="Jumlah Resi" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* RINGKASAN BERDASARKAN ADMIN */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Users className="h-4 w-4" /> Ringkasan Berdasarkan Admin
        </h3>
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead>
            <tr className="bg-gray-50 text-gray-500 uppercase">
              <th className="p-3 font-semibold rounded-l-lg">Admin</th>
              <th className="p-3 font-semibold text-center">Express</th>
              <th className="p-3 font-semibold text-center">Cargo</th>
              <th className="p-3 font-semibold text-center">Total Resi</th>
              <th className="p-3 font-semibold text-right">Setoran Owner</th>
              <th className="p-3 font-semibold text-right rounded-r-lg">Kas Outlet</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {byAdmin.length === 0 ? (
              <tr><td colSpan={6} className="text-center p-4 text-gray-400">Tidak ada data</td></tr>
            ) : byAdmin.map((a:any) => (
              <tr key={a.admin_id} className="hover:bg-gray-50/50">
                <td className="p-3 font-bold text-gray-800">{a.nama}</td>
                <td className="p-3 text-center">{a.express}</td>
                <td className="p-3 text-center">{a.cargo}</td>
                <td className="p-3 text-center font-bold">{a.totalResi}</td>
                <td className="p-3 text-right font-mono text-blue-600">Rp {a.totalSetoranOwner.toLocaleString("id-ID")}</td>
                <td className="p-3 text-right font-mono text-green-600">Rp {a.kasOutlet.toLocaleString("id-ID")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>


      {/* RIWAYAT TRANSAKSI TERAKHIR */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <FileText className="h-4 w-4" /> Riwayat Transaksi Terakhir (10 Data)
          </h3>
          <button 
            onClick={() => onNavigate("riwayat-transaksi")}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            Lihat Semua <TrendingUp className="h-3 w-3" />
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 text-gray-500 uppercase">
                <th className="p-3 font-semibold rounded-l-lg">No Resi</th>
                <th className="p-3 font-semibold">Tipe</th>
                <th className="p-3 font-semibold">Tanggal & Jam</th>
                <th className="p-3 font-semibold text-right">Biaya Ongkir</th>
                <th className="p-3 font-semibold text-right">Kas Outlet</th>
                <th className="p-3 font-semibold text-right">Setoran Owner</th>
                <th className="p-3 font-semibold text-center rounded-r-lg">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.recentTransactions?.length === 0 ? (
                <tr><td colSpan={7} className="text-center p-4 text-gray-400">Tidak ada transaksi terkini</td></tr>
              ) : data.recentTransactions?.map((r: any) => (
                <tr key={r.resi_id} className="hover:bg-gray-50/50">
                  <td className="p-3 font-bold text-gray-800">{r.resi_id}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded font-bold text-[10px] ${r.tipe_layanan === 'Express' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                      {r.tipe_layanan}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600">
                    {new Date(r.timestamp).toLocaleDateString("id-ID")} <span className="text-gray-400 text-[10px] ml-1">{new Date(r.timestamp).toLocaleTimeString("id-ID", {hour:'2-digit', minute:'2-digit'})}</span>
                  </td>
                  <td className="p-3 text-right font-mono text-gray-700">Rp {(r.ongkir_dasar || 0).toLocaleString("id-ID")}</td>
                  <td className="p-3 text-right font-mono text-green-600">Rp {(r.kas_operasional || 0).toLocaleString("id-ID")}</td>
                  <td className="p-3 text-right font-mono text-blue-600">Rp {(r.setoran_ke_owner || 0).toLocaleString("id-ID")}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${r.status === 'BATAL' ? 'bg-red-100 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {r.status || 'AKTIF'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* STATUS SETORAN & RIWAYAT PEMBATALAN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-500" /> Status Setoran Harian
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
            {statusSetoranList.length === 0 ? (
              <p className="text-center text-xs text-gray-400">Belum ada transaksi</p>
            ) : statusSetoranList.map((s:any) => (
              <div key={s.date} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 border border-gray-100 rounded-lg gap-2">
                <div>
                  <p className="font-bold text-gray-800 text-sm">{s.date}</p>
                  <p className="text-[10px] text-gray-500">{s.transaksi.length} Transaksi</p>
                </div>
                <div className="text-left sm:text-right w-full sm:w-auto flex flex-row sm:flex-col justify-between sm:justify-center items-center sm:items-end">
                  <p className="font-bold text-gray-800 font-mono">Rp {s.total_setoran.toLocaleString("id-ID")}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold mt-1 inline-block
                    ${s.status === 'Belum Disetor' ? 'bg-red-50 text-red-600' : 
                      s.status === 'Menunggu ACC' ? 'bg-amber-50 text-amber-600' : 
                      'bg-emerald-50 text-emerald-600'}
                  `}>
                    {s.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" /> Riwayat Pembatalan
            </h3>
            <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">
              {pembatalanLogs.length} Batal
            </span>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2 text-xs">
            {pembatalanLogs.length === 0 ? (
              <p className="text-center text-xs text-gray-400">Tidak ada pembatalan</p>
            ) : pembatalanLogs.map((l:any) => (
              <div key={l.log_id} className="p-3 bg-red-50/50 border border-red-100 rounded-lg">
                <div className="flex justify-between font-bold text-gray-800 mb-1">
                  <span>{l.nama_lengkap}</span>
                  <span className="text-gray-500 font-normal">{new Date(l.timestamp).toLocaleString("id-ID")}</span>
                </div>
                <p className="text-gray-600">{l.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AKTIVITAS TERAKHIR */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-500" /> Aktivitas Terakhir (Log)
        </h3>
        <div className="space-y-2 max-h-60 overflow-y-auto text-xs pr-2">
          {aktivitasLogs.length === 0 ? (
            <p className="text-center text-gray-400 py-4">Belum ada aktivitas</p>
          ) : aktivitasLogs.map((log:any) => (
            <div key={log.log_id} className="flex justify-between items-center p-2.5 hover:bg-gray-50 rounded-lg border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 rounded font-bold text-[9px] ${
                  log.aksi.includes('BATAL') ? 'bg-red-100 text-red-700' :
                  log.aksi.includes('EDIT') ? 'bg-amber-100 text-amber-700' :
                  log.aksi.includes('INPUT') ? 'bg-emerald-100 text-emerald-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {log.aksi}
                </span>
                <span className="text-gray-700">{log.detail}</span>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-gray-800">{log.nama_lengkap}</p>
                <p className="text-[10px] text-gray-400">{new Date(log.timestamp).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
    </div>
  );
}
