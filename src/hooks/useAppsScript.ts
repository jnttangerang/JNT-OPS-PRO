import { useState, useCallback } from "react";

// Extend window interface to support Google Apps Script native runner
declare global {
  interface Window {
    google?: {
      script: {
        run: {
          withSuccessHandler: (callback: (response: any) => void) => {
            withFailureHandler: (callback: (error: any) => void) => {
              execAction: (action: string, params: any) => void;
            };
          };
        };
      };
    };
  }
}

export function useAppsScript() {
  const [loading, setLoading] = useState(false);

  const callLocalApi = async <T = any>(action: string, params: any = {}, retries = 4): Promise<T> => {
    let url = `/api/${action}`;
    let method = "POST";
    let body: any = params;

    if (action === "getOutlets" || action === "getUsers") {
      url = `/api/${action}`;
      method = "GET";
      body = undefined;
    }

    const mutationActions = new Set([
      "updateTransaksi",
      "saveTransaksi",
      "deleteTransaksi",
      "submitDailyClosing",
      "reopenDailyClosing",
      "approveSetoran",
      "rejectSetoran",
      "createSetoran",
      "saveKeuanganOutlet",
      "updateKeuanganOutlet",
      "deleteKeuanganOutlet"
    ]);
    const isMutation = mutationActions.has(action);
    const maxRetries = isMutation ? 0 : Math.max(retries, 4);
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        const contentType = response.headers.get("content-type") || "";
        const text = await response.text();
        let json: any;
        try {
          if (!contentType.includes("application/json") && (text.trim().startsWith("<") || text.trim() === "")) {
            throw new Error("RELOAD_OR_HTML_RESPONSE");
          }
          json = JSON.parse(text);
        } catch {
          // If response is HTML/empty during server boot, reload or proxy glitch, retry with graceful backoff
          const isStartingServer = text.includes("Starting Server") || text.includes("<title>Starting Server") || (!contentType.includes("application/json") && text.trim().startsWith("<"));
          const maxEffectiveRetries = isStartingServer ? Math.max(maxRetries, 8) : maxRetries;
          if (attempt < maxEffectiveRetries) {
            const delay = isStartingServer ? 1000 : Math.min(400 * Math.pow(1.5, attempt), 2000);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          setLoading(false);
          if (isStartingServer) {
            console.warn(`[useAppsScript] Server sedang memulai (HTTP ${response.status}) untuk ${url}`);
            throw new Error(`Server sedang memulai, silakan tunggu beberapa saat.`);
          }
          console.error(`[useAppsScript] Non-JSON response for ${url} (HTTP ${response.status}):`, text.slice(0, 200));
          throw new Error(`Respons dari server lokal bukan JSON yang valid (HTTP ${response.status}).`);
        }
        setLoading(false);

        if (response.status !== 200 || json.status === "error") {
          throw new Error(json.message || `HTTP ${response.status} Error`);
        }

        return json as T;
      } catch (err: any) {
        const isServerStarting = err?.message?.includes("Server sedang memulai") || err?.message === "RELOAD_OR_HTML_RESPONSE";
        const maxEffectiveRetries = isServerStarting ? Math.max(maxRetries, 8) : maxRetries;
        if (attempt < maxEffectiveRetries && !err.message?.includes("Akses ditolak") && !err.message?.includes("HTTP 4")) {
          const delay = isServerStarting ? 1000 : Math.min(400 * Math.pow(1.5, attempt), 2000);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        setLoading(false);
        throw err;
      }
    }
    setLoading(false);
    throw new Error(`Gagal menghubungi endpoint /api/${action}.`);
  };

  const callBackend = useCallback(
    async <T = any>(action: string, params: any = {}): Promise<T> => {
      setLoading(true);

      // Core local actions handled instantly by Express API (< 20ms response time)
      const nodeOnlyActions = [
        "ping",
        "testConnection",
        "parseYoYiOrder",
        "perbaikiAlamatAI",
        "analyzeResiPhoto",
        "analyzeReview",
        "askAssistant",
        "syncGoogleReviews",
        "testDriveConnection",
        "getKeuanganOutlet",
        "saveKeuanganOutlet",
        "updateKeuanganOutlet",
        "deleteKeuanganOutlet",
        "getKategoriKeuangan",
        "saveKategoriKeuangan",
        "updateKategoriKeuangan",
        "deleteKategoriKeuangan",
        "backfillKeuanganOutlet",
        "apiBackfillKeuanganOutletFromTransactions",
        "saveTransaksi",
        "apiSaveTransaksi",
        "getRiwayatTransaksi",
        "getDetailTransaksi",
        "updateTransaksi",
        "deleteTransaksi",
        "uploadFile",
        "checkDuplicateResi",
        "importYoYi",
        "getPreInputDrafts",
        "getPreInput",
        "deletePreInput",
        "deletePreInputDraft",
        "saveDataPreInput",
        "savePreInput",
        "cleanupOldDrafts",
        "updatePreInputStatus",
        "getCustomersMaster",
        "getBukuPengirim",
        "getBukuPenerima",
        "searchCustomer",
        "getRiwayatPenerima",
        "getCustomerDetailFull",
        "deleteBulkCustomers",
        "updateCustomer",
        "importCustomerFromSheet",
        "getEXP_Resi",
        "getCRG_Resi",
        "getRecentActivities",
        "getDashboardData",
        "getAdminDashboardData",
        "getMasterTransaksi",
        "getOutlets",
        "getUsers",
        "getDailyClosingStatus",
        "submitDailyClosing",
        "reopenDailyClosing",
        "getAuditLogs",
        "getAuditData",
        "updateAuditDecision",
        "getSetoranHarian",
        "updateSetoranStatus",
        "getSetoranList",
        "getSetoranDetail",
        "createSetoran",
        "approveSetoran",
        "rejectSetoran",
        "getReportingSummary",
        "getReportingTransactions",
        "getSettings",
        "saveSettings",
        "getAllSettings",
        "saveAllSettings",
        "initDatabaseSheets",
        "login",
        "changePassword",
        "parseYoYiOrder",
        "parseYoYiScreenshot",
        "perbaikiAlamatAI",
        "analyzeResiPhoto"
      ];
      const isNodeOnlyAction = nodeOnlyActions.some((act) => action === act || action.startsWith(act + "/"));

      // Check if we are running in the Google Sheets Apps Script environment
      const isGoogleScript =
        typeof window !== "undefined" &&
        window.google &&
        window.google.script &&
        window.google.script.run &&
        !isNodeOnlyAction;

      if (isGoogleScript) {
        return new Promise<T>((resolve, reject) => {
          try {
            window.google!.script.run
              .withSuccessHandler((response: any) => {
                setLoading(false);
                if (response && response.status === "error") {
                  reject(new Error(response.message || "Terjadi kesalahan backend."));
                } else {
                  resolve(response);
                }
              })
              .withFailureHandler((err: any) => {
                setLoading(false);
                reject(err || new Error("Koneksi Apps Script gagal."));
              })
              .execAction(action, params);
          } catch (e) {
            setLoading(false);
            reject(e);
          }
        });
      }

      // If running in web/Express environment or action is handled locally, call local API directly for instant speed
      if (isNodeOnlyAction) {
        return await callLocalApi(action, params);
      }

      // External call to Google Apps Script Web App or Express Proxy (only when explicitly configured)
      try {
        const customUrl = typeof window !== "undefined" ? localStorage.getItem("APPS_SCRIPT_URL") : null;
        const envUrl = (import.meta as any).env?.VITE_APPS_SCRIPT_URL;
        const appsScriptUrl = customUrl || (envUrl && envUrl.trim() !== "" ? envUrl : null);

        if (appsScriptUrl) {
          let response: Response | null = null;
          try {
            response = await fetch(appsScriptUrl, {
              method: "POST",
              headers: {
                "Content-Type": "text/plain;charset=utf-8",
              },
              body: JSON.stringify({ action, data: params }),
            });
          } catch (netErr: any) {
            console.warn(`Direct browser fetch to Apps Script failed for '${action}' (${netErr.message}), trying server proxy...`);
            try {
              response = await fetch("/api/apps-script", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ action, data: params, appsScriptUrl }),
              });
            } catch (proxyErr: any) {
              console.warn(`Proxy fetch also failed for '${action}':`, proxyErr);
              return await callLocalApi(action, params);
            }
          }

          if (response && response.ok) {
            const text = await response.text();
            let json: any = null;
            try {
              json = JSON.parse(text);
            } catch {
              console.warn(`Response from Apps Script for '${action}' was not valid JSON (HTML received). Falling back to local Express API...`);
              return await callLocalApi(action, params);
            }

            if (json && json.status === "error") {
              const errMsg = json.message || "";
              if (errMsg.includes("Aksi tidak dikenali") || errMsg.includes("unrecognized") || errMsg.toLowerCase().includes("akses ditolak")) {
                console.warn(`Apps Script returned error '${errMsg}' for '${action}', falling back to local Express API...`);
                return await callLocalApi(action, params);
              }
              setLoading(false);
              throw new Error(errMsg || "Terjadi kesalahan backend Google Apps Script.");
            }
            setLoading(false);
            return json as T;
          } else {
            console.warn(`Apps Script HTTP status ${response?.status}, falling back to local Express API...`);
            return await callLocalApi(action, params);
          }
        } else {
          return await callLocalApi(action, params);
        }
      } catch (error: any) {
        setLoading(false);
        console.error(`API Error [${action}]:`, error);
        throw error;
      }
    },
    []
  );

  return { callBackend, loading };
}
export default useAppsScript;
