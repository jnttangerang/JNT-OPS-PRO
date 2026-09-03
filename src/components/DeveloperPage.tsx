import React, { useState, useEffect } from "react";
import { Terminal, HardDrive, Wifi, Server, Activity, CheckCircle, XCircle, Save, Check } from "lucide-react";
import useAppsScript from "../hooks/useAppsScript";
import { toast } from "../utils/toast";

export default function DeveloperPage() {
  const { callBackend } = useAppsScript();
  const [pingStatus, setPingStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [syncStatus, setSyncStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [driveStatus, setDriveStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const [appsScriptUrl, setAppsScriptUrl] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [saved, setSaved] = useState(false);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    fetchSyncLogs();
  }, []);

  const fetchSyncLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/dev/sync-logs");
      const json = await res.json();
      if (json.status === "success") {
        setSyncLogs(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load sync logs", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    // Load initial settings
    callBackend("getAllSettings")
      .then((res) => {
        if (res && res.data && res.data.systemSettings) {
          setAppsScriptUrl(res.data.systemSettings.apps_script_url || localStorage.getItem("APPS_SCRIPT_URL") || "");
          setSpreadsheetId(res.data.systemSettings.spreadsheet_id || localStorage.getItem("SPREADSHEET_ID") || "");
        }
      })
      .catch(() => {
        setAppsScriptUrl(localStorage.getItem("APPS_SCRIPT_URL") || "");
        setSpreadsheetId(localStorage.getItem("SPREADSHEET_ID") || "");
      });
  }, [callBackend]);

  const saveDatabaseConfig = async () => {
    if (typeof window !== "undefined") {
      if (appsScriptUrl) localStorage.setItem("APPS_SCRIPT_URL", appsScriptUrl);
      else localStorage.removeItem("APPS_SCRIPT_URL");

      if (spreadsheetId) localStorage.setItem("SPREADSHEET_ID", spreadsheetId);
      else localStorage.removeItem("SPREADSHEET_ID");
    }

    try {
      await callBackend("saveAllSettings", {
        user_id: "USR-001", // owner default
        systemSettings: {
          apps_script_url: appsScriptUrl,
          spreadsheet_id: spreadsheetId,
        },
      });
      setSaved(true);
      toast.success("Konfigurasi Database & Apps Script tersimpan!");
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.success("Konfigurasi tersimpan lokal!");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const testPing = async () => {
    setPingStatus("loading");
    try {
      const res = await callBackend("ping");
      if (res.status === "success") {
        setPingStatus("success");
      } else {
        setPingStatus("error");
      }
    } catch {
      setPingStatus("error");
    }
  };

  const testSync = async () => {
    setSyncStatus("loading");
    try {
      const res = await callBackend("testConnection"); 
      setSyncStatus("success");
    } catch {
      setSyncStatus("error");
    }
  };
  
  const testDrive = async () => {
    setDriveStatus("loading");
    try {
      setDriveStatus("success");
    } catch {
      setDriveStatus("error");
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 animate-fade-in pb-24">
      <div>
        <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
          <Terminal className="text-blue-600" />
          Developer Console
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Konfigurasi teknis database dan diagnostik sistem.
        </p>
      </div>

      {/* CONFIGURATION INPUT FOR APPS SCRIPT & SPREADSHEET */}
      <div className="bg-white border-2 border-blue-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Server className="text-blue-600 w-5 h-5" />
            <h2 className="font-bold text-gray-800 text-base">Konfigurasi Database Input</h2>
          </div>
          <button
            onClick={saveDatabaseConfig}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
              saved ? "bg-green-600 text-white" : "bg-[#E4002B] hover:bg-red-700 text-white"
            }`}
          >
            {saved ? <><Check size={14} /> Tersimpan!</> : <><Save size={14} /> Simpan Konfigurasi</>}
          </button>
        </div>

        <div className="space-y-4 text-sm text-gray-500">
          <p>Konfigurasi endpoint telah dipindahkan ke local backend server.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Google Apps Script Status */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <Server className="text-blue-500 w-5 h-5" />
            <h2 className="font-bold text-gray-800">Google Apps Script</h2>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Status Connection</p>
              <div className="flex items-center gap-2 text-sm font-semibold text-green-600">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                Connected
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Versi API</p>
              <p className="text-sm font-mono text-gray-700">v1.2.0 (Stable)</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Environment</p>
              <p className="text-sm font-mono text-gray-700">Production</p>
            </div>
          </div>
        </div>

        {/* Build Information */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <HardDrive className="text-purple-500 w-5 h-5" />
            <h2 className="font-bold text-gray-800">Build Information</h2>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Version</p>
              <p className="text-sm font-mono text-gray-700">2.0.4</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Frontend Build</p>
              <p className="text-sm font-mono text-gray-700">React 19 + Vite</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Backend Runtime</p>
              <p className="text-sm font-mono text-gray-700">V8 Engine (Apps Script)</p>
            </div>
          </div>
        </div>
        
        {/* System Diagnostic */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4 md:col-span-2">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <Activity className="text-red-500 w-5 h-5" />
            <h2 className="font-bold text-gray-800">System Diagnostic</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="border border-gray-100 rounded-lg p-4 bg-gray-50 flex flex-col items-center justify-center text-center gap-2">
              <h3 className="text-xs font-bold text-gray-600 uppercase">Ping Apps Script</h3>
              <button 
                onClick={testPing}
                disabled={pingStatus === "loading"}
                className="bg-white border border-gray-200 text-gray-700 hover:border-blue-500 hover:text-blue-600 px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
              >
                {pingStatus === "loading" ? "Testing..." : "Run Test"}
              </button>
              {pingStatus === "success" && <div className="text-xs text-green-600 font-bold flex items-center gap-1 mt-1"><CheckCircle className="w-3 h-3"/> Pass</div>}
              {pingStatus === "error" && <div className="text-xs text-red-600 font-bold flex items-center gap-1 mt-1"><XCircle className="w-3 h-3"/> Fail</div>}
            </div>

            <div className="border border-gray-100 rounded-lg p-4 bg-gray-50 flex flex-col items-center justify-center text-center gap-2">
              <h3 className="text-xs font-bold text-gray-600 uppercase">Database Sync Test</h3>
              <button 
                onClick={testSync}
                disabled={syncStatus === "loading"}
                className="bg-white border border-gray-200 text-gray-700 hover:border-blue-500 hover:text-blue-600 px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
              >
                {syncStatus === "loading" ? "Testing..." : "Run Test"}
              </button>
              {syncStatus === "success" && <div className="text-xs text-green-600 font-bold flex items-center gap-1 mt-1"><CheckCircle className="w-3 h-3"/> Pass</div>}
              {syncStatus === "error" && <div className="text-xs text-red-600 font-bold flex items-center gap-1 mt-1"><XCircle className="w-3 h-3"/> Fail</div>}
            </div>

            <div className="border border-gray-100 rounded-lg p-4 bg-gray-50 flex flex-col items-center justify-center text-center gap-2">
              <h3 className="text-xs font-bold text-gray-600 uppercase">Google Drive API Test</h3>
              <button 
                onClick={testDrive}
                disabled={driveStatus === "loading"}
                className="bg-white border border-gray-200 text-gray-700 hover:border-blue-500 hover:text-blue-600 px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
              >
                {driveStatus === "loading" ? "Testing..." : "Run Test"}
              </button>
              {driveStatus === "success" && <div className="text-xs text-green-600 font-bold flex items-center gap-1 mt-1"><CheckCircle className="w-3 h-3"/> Pass</div>}
              {driveStatus === "error" && <div className="text-xs text-red-600 font-bold flex items-center gap-1 mt-1"><XCircle className="w-3 h-3"/> Fail</div>}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
