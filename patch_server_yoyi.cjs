const fs = require("fs");
let code = fs.readFileSync("server.ts", "utf8");

if (!code.includes("parseYoYiOrder")) {
  const parseActionString = `  "perbaikiAlamatAI",
  "parseYoYiOrder",`;
  code = code.replace(`  "perbaikiAlamatAI",`, parseActionString);

  const endpointStr = `
// YoYi Parsing AI
app.post("/api/parseYoYiOrder", async (req, res) => {
  const { text } = req.body;
  if (!text || text.trim().length === 0) {
    return res.status(400).json({ status: "error", message: "Teks pesanan tidak boleh kosong!" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ status: "error", message: "GEMINI_API_KEY belum dikonfigurasi di server." });
  }

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const prompt = \`Ekstrak informasi berikut dari teks Rincian Pesanan YoYi menjadi format JSON yang valid.
Pastikan tipe datanya sesuai. Output hanya JSON murni tanpa markdown/backticks.

Schema JSON:
{
  "nomor_resi": "string",
  "nama_pengirim": "string",
  "no_hp_pengirim": "string (opsional)",
  "alamat_pengirim": "string (opsional)",
  "nama_penerima": "string",
  "no_hp_penerima": "string (opsional)",
  "alamat_penerima": "string (opsional)",
  "tipe_produk": "string (opsional)",
  "ongkir_dasar": number (dari Ongkir Dasar),
  "asuransi": number (dari Biaya Asuransi),
  "biaya_lain": number (dari Biaya lain-lain),
  "total_yoyi": number (dari Perhitungan Biaya pengiriman),
  "metode_perhitungan": "string (DFOD atau Biaya oleh pengirim)",
  "nama_barang": "string",
  "berat_kg": number (dari Berat/Berat Barang dalam Kg)
}

Teks YoYi:
\${text}\`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
      }
    });

    const resultText = response.text || "";
    const parsedData = JSON.parse(resultText);

    res.json({ status: "success", data: parsedData });
  } catch (error: any) {
    console.error("parseYoYiOrder error:", error);
    res.status(500).json({ status: "error", message: error.message || "Gagal memproses dengan AI" });
  }
});

// 10. AI ADDRESS CORRECTION (GEMINI)
`;
  code = code.replace("// 10. AI ADDRESS CORRECTION (GEMINI)", endpointStr);
  fs.writeFileSync("server.ts", code);
  console.log("server.ts patched");
}
