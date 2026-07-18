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

  const callBackend = useCallback(
    async <T = any>(action: string, params: any = {}): Promise<T> => {
      setLoading(true);

      // Certain actions should always run locally to utilize the updated node/Express server (e.g. Gemini 3.5 AI endpoints)
      const isLocalAction = action === "perbaikiAlamatAI" || action === "analyzeResiPhoto";

      // Check if we are running in the Google Sheets Apps Script environment
      const isGoogleScript =
        typeof window !== "undefined" &&
        window.google &&
        window.google.script &&
        window.google.script.run &&
        !isLocalAction;

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
      } else {
        // Fallback for Vercel (using VITE_APPS_SCRIPT_URL) or Local Vite + Express server
        try {
          const appsScriptUrl = !isLocalAction ? (import.meta as any).env.VITE_APPS_SCRIPT_URL : null;

          if (appsScriptUrl) {
            // External call to Google Apps Script Web App deployed on Vercel
            const response = await fetch(appsScriptUrl, {
              method: "POST",
              headers: {
                "Content-Type": "text/plain;charset=utf-8",
              },
              body: JSON.stringify({ action, data: params }),
            });
            
            const json = await response.json();
            setLoading(false);
            
            if (json && json.status === "error") {
              throw new Error(json.message || "Terjadi kesalahan backend.");
            }
            return json as T;
          } else {
            // Local Express Server Call
            let url = `/api/${action}`;
            let method = "POST";
            let body: any = params;

            // Some endpoints might be GET
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

            const json = await response.json();
            setLoading(false);

            if (response.status !== 200 || json.status === "error") {
              throw new Error(json.message || `HTTP ${response.status} Error`);
            }

            return json as T;
          }
        } catch (error: any) {
          setLoading(false);
          console.error(`Local/External API Fallback Error [${action}]:`, error);
          throw error;
        }
      }
    },
    []
  );

  return { callBackend, loading };
}
export default useAppsScript;
