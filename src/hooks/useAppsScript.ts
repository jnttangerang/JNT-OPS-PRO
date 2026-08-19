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

  const callLocalApi = async <T = any>(action: string, params: any = {}): Promise<T> => {
    let url = `/api/${action}`;
    let method = "POST";
    let body: any = params;

    if (action === "getOutlets" || action === "getUsers") {
      url = `/api/${action}`;
      method = "GET";
      body = undefined;
    }

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      setLoading(false);
      throw new Error(`Respons dari server lokal bukan JSON yang valid (HTTP ${response.status}).`);
    }
    setLoading(false);

    if (response.status !== 200 || json.status === "error") {
      throw new Error(json.message || `HTTP ${response.status} Error`);
    }

    return json as T;
  };

  const callBackend = useCallback(
    async <T = any>(action: string, params: any = {}): Promise<T> => {
      setLoading(true);

      // Utility actions that are handled locally on Node/Express server
      const nodeOnlyActions = [
        "ping",
        "testConnection",
        "updateSettingsOutlet",
        "testDriveConnection",
        "changePassword",
        "getAllSettings",
        "saveAllSettings",
        "getOutlets",
        "getUsers",
        "getCustomers",
        "getCustomerHistory",
        "getBukuPengirim",
        "getBukuPenerima",
        "deleteBulkCustomers",
        "updateCustomer",
        "getCustomersMaster",
        "getCustomerDetailFull",
        "searchCustomer",
        "getRiwayatPenerima",
        "checkDuplicateResi",
        "deletePreInputDraft",
        "saveDataPreInput",
        "savePreInput",
        "getPreInputDrafts",
        "updatePreInputStatus",
        "getPreInput",
        "getPreInputDetails",
        "saveTransaksi",
        "apiSaveTransaksi",
        "importYoYi",
        "parseYoYiOrder",
        "perbaikiAlamatAI",
        "analyzeResiPhoto",
        "uploadFile",
        "initDatabaseSheets",
        "getAdminDashboardData",
        "getDashboardData",
        "getRiwayatTransaksi",
        "deleteTransaksi",
        "getDetailTransaksi",
        "updateTransaksi",
        "syncGoogleReviews",
        "addReview",
        "deleteReview",
        "analyzeReview",
        "getSetoranList",
        "getSetoranDetail",
        "createSetoran",
        "approveSetoran",
        "rejectSetoran",
        "auditTrail",
        "getAuditTrail",
        "getAuditTrailByTransaction",
        "getAuditTrailByCustomer",
        "getAuditTrailByImport",
        "reconstructTransactionHistory",
        "reconstructHistory",
        "auditTransaction",
        "getAuditData",
        "updateAuditDecision",
        "validateClosing",
        "executeClosing",
        "getReportingSummary",
        "getReportingTransactions",
        "getReportingSettlement",
        "getReportingAudit",
        "dailySummary",
        "apiDailySummary",
        "detectAnomalies",
        "apiDetectAnomalies",
        "askAssistant",
        "apiAskAssistant",
        "getKategoriKeuangan",
        "saveKategoriKeuangan",
        "updateKategoriKeuangan",
        "setKategoriAktif",
        "getKeuanganOutlet",
        "saveKeuanganOutlet",
        "updateKeuanganOutlet",
        "deleteKeuanganOutlet",
        "apps-script",
        "reconcileTransaction",
        "reconcileDaily",
        "reconcileOutlet",
        "getReconciliationSummary",
        "reconciliation",
        "reconciliation/syncExceptions",
        "reconciliation/review",
        "reconciliation/resolve",
        "reconciliation/reopen",
        "reconciliation/exceptions",
        "reconciliation/closingStatus",
        "dailyClosing",
        "dailyClosing/validate",
        "dailyClosing/close",
        "dailyClosing/status",
        "dailyClosing/reopen",
        "settlement",
        "settlement/create",
        "settlement/recordDeposit",
        "settlement/reconcile",
        "settlement/approve",
        "settlement/reject",
        "settlement/reopen",
        "settlement/list",
        "settlement/status",
        "financial-close",
        "financial-close/validate",
        "financial-close/certify",
        "financial-close/reopen",
        "financial-close/report",
        "management",
        "management/decisions/sync",
        "management/decision/acknowledge",
        "management/decision/assign",
        "management/decision/start",
        "management/decision/resolve",
        "management/decision/reopen",
        "management/decision/escalate",
        "control",
        "control/action/execute",
        "workflow",
        "workflow/create",
        "workflow/assign",
        "workflow/start",
        "workflow/resolve",
        "workflow/verify",
        "workflow/reopen",
        "workflow/close",
        "intelligence",
        "management-review",
        "management-review/create",
        "management-review/analyze",
        "management-review/decision",
        "management-review/complete",
        "management-review/reopen"
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

      // External call to Google Apps Script Web App or Express Proxy
      try {
        const customUrl = typeof window !== "undefined" ? localStorage.getItem("APPS_SCRIPT_URL") : null;
        const envUrl = (import.meta as any).env?.VITE_APPS_SCRIPT_URL;
        const defaultUrl = "https://script.google.com/macros/s/AKfycbwrxgBj-2fafmkJ00Mxhps1ykGS2x5r4X5f9nJ_KUeanN8gdCuxf9O4KucqrYWO-yeQXg/exec";
        const appsScriptUrl = !isNodeOnlyAction ? (customUrl || (envUrl && envUrl.trim() !== "" ? envUrl : defaultUrl)) : null;

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
