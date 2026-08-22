export interface YoYiParsedData {
  nomor_resi: string;
  nama_pengirim: string;
  no_hp_pengirim?: string;
  alamat_pengirim?: string;
  kode_pos_pengirim?: string;
  nama_penerima: string;
  no_hp_penerima?: string;
  alamat_penerima?: string;
  kode_pos_penerima?: string;
  tipe_produk?: string;
  ongkir_dasar: number;
  asuransi: number;
  biaya_lain: number;
  total_yoyi: number;
  metode_perhitungan: string;
  source_order?: string;
  nama_barang: string;
  berat_kg: number;
}

function parseCurrency(str: string): number {
  if (!str) return 0;
  // Clean currency symbols, commas, periods
  const cleaned = str.replace(/[^\d.,]/g, "").trim();
  if (!cleaned) return 0;
  // If format like 24.500 or 24,500
  const normalized = cleaned.replace(/[.,]/g, "");
  const num = parseInt(normalized, 10);
  return isNaN(num) ? 0 : num;
}

export function parseYoYiText(text: string): YoYiParsedData {
  const result: YoYiParsedData = {
    nomor_resi: "",
    nama_pengirim: "",
    no_hp_pengirim: "",
    alamat_pengirim: "",
    nama_penerima: "",
    no_hp_penerima: "",
    alamat_penerima: "",
    tipe_produk: "EZ",
    ongkir_dasar: 0,
    asuransi: 0,
    biaya_lain: 0,
    total_yoyi: 0,
    metode_perhitungan: "Normal",
    nama_barang: "Paket",
    berat_kg: 1,
  };

  if (!text || !text.trim()) return result;

  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // 1. Extract Resi ID
  const resiExplicit = text.match(/(?:No\.?\s*(?:Resi|Waybill|Tracking|Connote|Awb|Pesanan)|Resi|Waybill|Nomor\s*Resi)[:\s]*([A-Z0-9]{8,24})/i);
  if (resiExplicit) {
    result.nomor_resi = resiExplicit[1].trim().toUpperCase();
  } else {
    // Scan standalone resi format: JD..., JP..., JT..., JTC..., etc.
    const resiPattern = text.match(/\b(JD[0-9A-Z]{8,16}|JP[0-9A-Z]{8,16}|JT[0-9A-Z]{8,16}|JTC[0-9A-Z]{8,16})\b/i);
    if (resiPattern) {
      result.nomor_resi = resiPattern[1].trim().toUpperCase();
    }
  }

  // 2. Line by Line Scan for Financials (supports both vertical list & inline formats)
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const lower = line.toLowerCase();

    // Asuransi
    if (lower.includes("biaya asuransi") || lower.includes("asuransi (idr)") || lower.startsWith("asuransi")) {
      const inlineMatch = line.match(/[:\s]+(?:IDR|Rp\.?)?\s*([\d.,]+)/i);
      if (inlineMatch) {
        result.asuransi = parseCurrency(inlineMatch[1]);
      } else if (i + 1 < rawLines.length && /^[\d.,]+$/.test(rawLines[i + 1])) {
        result.asuransi = parseCurrency(rawLines[i + 1]);
      }

      // Check if the previous line was a lone number (which in YoYi vertical list is Ongkir Dasar)
      if (i > 0 && result.ongkir_dasar === 0 && /^[\d.,]+$/.test(rawLines[i - 1])) {
        result.ongkir_dasar = parseCurrency(rawLines[i - 1]);
      }
    }

    // Biaya Lain-lain
    if (lower.includes("biaya lain") || lower.includes("biaya lain-lain") || lower.includes("lain-lain (idr)")) {
      const inlineMatch = line.match(/[:\s]+(?:IDR|Rp\.?)?\s*([\d.,]+)/i);
      if (inlineMatch) {
        result.biaya_lain = parseCurrency(inlineMatch[1]);
      } else if (i + 1 < rawLines.length && /^[\d.,]+$/.test(rawLines[i + 1])) {
        result.biaya_lain = parseCurrency(rawLines[i + 1]);
      }
    }

    // Ongkir Dasar / Biaya Kirim
    if (lower.includes("ongkir dasar") || lower.includes("biaya kirim") || lower.includes("ongkos kirim") || lower.includes("tarif dasar")) {
      const inlineMatch = line.match(/[:\s]+(?:IDR|Rp\.?)?\s*([\d.,]+)/i);
      if (inlineMatch) {
        result.ongkir_dasar = parseCurrency(inlineMatch[1]);
      } else if (i + 1 < rawLines.length && /^[\d.,]+$/.test(rawLines[i + 1])) {
        result.ongkir_dasar = parseCurrency(rawLines[i + 1]);
      }
    }

    // Total YoYi / Perhitungan Biaya Pengiriman
    if (lower.includes("perhitungan biaya pengiriman") || lower.includes("total biaya") || lower.includes("total ongkir") || lower.includes("total (idr)")) {
      const inlineMatch = line.match(/[:\s]+(?:IDR|Rp\.?)?\s*([\d.,]+)/i);
      if (inlineMatch) {
        result.total_yoyi = parseCurrency(inlineMatch[1]);
      } else if (i + 1 < rawLines.length && /^[\d.,]+$/.test(rawLines[i + 1])) {
        result.total_yoyi = parseCurrency(rawLines[i + 1]);
      }
    }

    // Tipe Layanan / Produk
    if (lower.includes("layanan") || lower.includes("produk") || lower.includes("service")) {
      const prodMatch = line.match(/(?:Layanan|Produk|Service)[:\s]*([A-Z0-9_]+)/i);
      if (prodMatch) {
        result.tipe_produk = prodMatch[1].toUpperCase();
      }
    }

    // Berat
    if (lower.includes("berat") || lower.includes("weight")) {
      const bMatch = line.match(/(?:Berat(?:\s*Barang)?|Weight)[:\s]*([\d.,]+)\s*(?:kg|gram)?/i);
      if (bMatch) {
        const val = parseFloat(bMatch[1].replace(",", "."));
        if (!isNaN(val) && val > 0) result.berat_kg = val;
      } else if (i + 1 < rawLines.length) {
        const nextVal = parseFloat(rawLines[i + 1].replace(/[^\d.,]/g, "").replace(",", "."));
        if (!isNaN(nextVal) && nextVal > 0) result.berat_kg = nextVal;
      }
    }

    // Nama Barang
    if (lower.includes("nama barang") || lower.includes("deskripsi barang") || lower.includes("isi paket") || lower.includes("nama paket")) {
      const itemMatch = line.match(/(?:Nama\s*Barang|Deskripsi\s*Barang|Jenis\s*Barang|Isi\s*Paket|Nama\s*Paket)[:\s]*([^\n\r]+)/i);
      if (itemMatch && itemMatch[1].trim()) {
        result.nama_barang = itemMatch[1].trim().replace(/^[:\s-]+/, "");
      } else if (i + 1 < rawLines.length && rawLines[i + 1].length > 1) {
        result.nama_barang = rawLines[i + 1].replace(/^[:\s-]+/, "");
      }
    }

    // Shipper (Pengirim)
    if (lower.startsWith("pengirim") || lower.startsWith("nama pengirim") || lower.startsWith("shipper") || lower.startsWith("dari:")) {
      const cleanLine = line.replace(/^(?:pengirim|nama\s*pengirim|shipper|dari)[:\s]*/i, "").trim();
      if (cleanLine) {
        result.nama_pengirim = cleanLine.replace(/\([^\)]*\)/g, "").trim();
      } else if (i + 1 < rawLines.length) {
        result.nama_pengirim = rawLines[i + 1];
      }
    }

    // Receiver (Penerima)
    if (lower.startsWith("penerima") || lower.startsWith("nama penerima") || lower.startsWith("receiver") || lower.startsWith("consignee") || lower.startsWith("kepada:")) {
      const cleanLine = line.replace(/^(?:penerima|nama\s*penerima|receiver|consignee|kepada)[:\s]*/i, "").trim();
      if (cleanLine) {
        result.nama_penerima = cleanLine.replace(/\([^\)]*\)/g, "").trim();
      } else if (i + 1 < rawLines.length) {
        result.nama_penerima = rawLines[i + 1];
      }
    }
  }

  // 3. Fallbacks and Phone numbers
  if (!result.no_hp_pengirim) {
    const hpPengirim = text.match(/(?:(?:Telp|HP|No\.?\s*HP|Telepon)\s*(?:Pengirim)?|Pengirim[^\n\r]*?)[:\s]*(\+?62[\d\s-]{8,15}|08[\d\s-]{8,13})/i);
    if (hpPengirim) result.no_hp_pengirim = hpPengirim[1].replace(/[\s-]/g, "");
  }
  if (!result.no_hp_penerima) {
    const hpPenerima = text.match(/(?:(?:Telp|HP|No\.?\s*HP|Telepon)\s*(?:Penerima)?|Penerima[^\n\r]*?)[:\s]*(\+?62[\d\s-]{8,15}|08[\d\s-]{8,13})/i);
    if (hpPenerima) result.no_hp_penerima = hpPenerima[1].replace(/[\s-]/g, "");
  }

  // 4. Calculate total if not explicit
  if (result.total_yoyi <= 0) {
    if (result.ongkir_dasar > 0) {
      result.total_yoyi = result.ongkir_dasar + result.asuransi + result.biaya_lain;
    }
  } else if (result.ongkir_dasar <= 0 && result.total_yoyi > 0) {
    result.ongkir_dasar = Math.max(0, result.total_yoyi - result.asuransi - result.biaya_lain);
  }

  // 5. Detect Layanan from keywords if still default
  if (result.tipe_produk === "EZ") {
    if (/\b(CARGO|JTC|TRUCKING)\b/i.test(text)) result.tipe_produk = "Cargo";
    else if (/\b(DOC|DOKUMEN)\b/i.test(text)) result.tipe_produk = "DOC";
    else if (/\b(DFOD)\b/i.test(text)) result.tipe_produk = "DFOD";
    else if (/\b(SUPER|FASTTRACK|FAST)\b/i.test(text)) result.tipe_produk = "Super";
  }

  return result;
}
