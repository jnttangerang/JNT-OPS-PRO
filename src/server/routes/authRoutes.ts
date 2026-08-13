import { Router } from "express";

const router = Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ status: "error", message: "Username & Password wajib diisi" });
  }

  // AMBIL URL APPS SCRIPT DARI ENVIRONMENT (WAJIB!)
  const appsScriptUrl = process.env.APPS_SCRIPT_URL || process.env.VITE_APPS_SCRIPT_URL;
  if (!appsScriptUrl) {
    console.error("[FATAL] APPS_SCRIPT_URL tidak ditemukan di environment.");
    return res.status(500).json({ status: "error", message: "Konfigurasi server tidak lengkap." });
  }

  try {
    // SET TIMEOUT 15 DETIK AGAR TIDAK NGEFREEZE
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // PANGGIL CODE.GS (Google Sheets) UNTUK VALIDASI LOGIN
    const response = await fetch(appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ 
        action: "login", // Pastikan Code.gs punya handler untuk action "login"
        data: { username, password } 
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const text = await response.text();
    const json = JSON.parse(text);

    if (json && json.status === "success") {
      // Jika sukses, kirim data session ke frontend
      return res.json({ status: "success", message: "Login berhasil", data: json.data });
    } else {
      // Jika gagal (password salah, user tidak ditemukan, dll.)
      return res.status(401).json({ status: "error", message: json.message || "Username atau Password salah" });
    }
  } catch (err: any) {
    console.error("[Login Error] Gagal konek ke Google Sheets:", err.message);
    return res.status(500).json({ status: "error", message: "Gagal terhubung ke server database. Periksa koneksi internet." });
  }
});

export default router;
