export const appsScriptProxy = async (action: string, data: any) => {
  const appsScriptUrl = process.env.APPS_SCRIPT_URL || process.env.VITE_APPS_SCRIPT_URL;
  if (!appsScriptUrl) {
    throw new Error("[FATAL] APPS_SCRIPT_URL tidak ditemukan di environment.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, data }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return await response.text();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};
