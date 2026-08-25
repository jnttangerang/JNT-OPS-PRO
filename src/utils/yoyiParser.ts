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
  operator?: string;
  tanggal_transaksi?: string;
  jam_transaksi?: string;
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

  let currentSection: "pengirim" | "penerima" | "barang" | "biaya" | "operasi" | "" = "";

  // 1. Extract Resi ID
  const resiExplicit = text.match(/(?:No\.?\s*(?:Resi|Waybill|Tracking|Connote|Awb)|Resi|Waybill|Nomor\s*Resi)[:\s]*([A-Z0-9]{8,24})/i);
  if (resiExplicit) {
    result.nomor_resi = resiExplicit[1].trim().toUpperCase();
  } else {
    // Scan standalone resi format: JD..., JP..., JT..., JTC..., etc.
    const resiPattern = text.match(/\b(JD[0-9A-Z]{8,16}|JP[0-9A-Z]{8,16}|JT[0-9A-Z]{8,16}|JTC[0-9A-Z]{8,16})\b/i);
    if (resiPattern) {
      result.nomor_resi = resiPattern[1].trim().toUpperCase();
    }
  }

  // 2. Global Timestamp & Operator extraction from 'Buat pesanan baru' / Riwayat operasi
  const buatPesananMatch = text.match(/(?:Buat\s*pesanan\s*baru|Buat\s*order|Create\s*order|Pesanan\s*dibuat)[;:\s|]+([^;\n\r|]+?)[;:\s|]+(\d{4}[-/.]\d{2}[-/.]\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)/i);
  if (buatPesananMatch) {
    result.operator = buatPesananMatch[1].trim();
    result.tanggal_transaksi = buatPesananMatch[2].replace(/[.]/g, "-").replace(/\//g, "-");
    result.jam_transaksi = buatPesananMatch[3].trim();
  } else {
    // Fallback: search for direct date-time associated with 'Buat pesanan baru' or order time
    const genericOrderTimeMatch = text.match(/(?:Buat\s*pesanan\s*baru|Waktu\s*buat\s*pesanan|Waktu\s*order|Waktu\s*transaksi|Order\s*time|Created\s*at)[;:\s|]+(\d{4}[-/.]\d{2}[-/.]\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)/i);
    if (genericOrderTimeMatch) {
      result.tanggal_transaksi = genericOrderTimeMatch[1].replace(/[.]/g, "-").replace(/\//g, "-");
      result.jam_transaksi = genericOrderTimeMatch[2].trim();
    }
  }

  // Helper to check if a line looks like a known header or label
  const isHeaderLine = (lineStr: string) => {
    const l = lineStr.toLowerCase();
    return (
      l.startsWith("informasi") ||
      l.startsWith("pengirim") ||
      l.startsWith("penerima") ||
      l.startsWith("kode pos") ||
      l.startsWith("wilayah") ||
      l.startsWith("detail alamat") ||
      l.startsWith("alamat") ||
      l.startsWith("no.") ||
      l.startsWith("jenis barang") ||
      l.startsWith("nama barang") ||
      l.startsWith("berat") ||
      l.startsWith("ongkir") ||
      l.startsWith("biaya") ||
      l.startsWith("riwayat") ||
      l.startsWith("buat pesanan")
    );
  };

  // 3. Line by Line Scan for Financials, Addresses, & Items
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const lower = line.toLowerCase();

    // Context tracking for sections
    if (lower === "informasi pengirim" || lower.startsWith("informasi pengirim") || lower === "data pengirim") {
      currentSection = "pengirim";
    } else if (lower === "informasi penerima" || lower.startsWith("informasi penerima") || lower === "data penerima") {
      currentSection = "penerima";
    } else if (lower === "informasi barang" || lower.startsWith("informasi barang") || lower === "data barang") {
      currentSection = "barang";
    } else if (lower === "informasi biaya" || lower.startsWith("informasi biaya")) {
      currentSection = "biaya";
    } else if (lower.includes("riwayat operasi")) {
      currentSection = "operasi";
    }

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
      } else if (i + 1 < rawLines.length && /^[A-Z0-9_]{2,10}$/i.test(rawLines[i + 1])) {
        result.tipe_produk = rawLines[i + 1].toUpperCase();
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

    // Nama Barang / Jenis Barang / Isi Paket / Komoditi
    if (
      lower.includes("nama barang") ||
      lower.includes("deskripsi barang") ||
      lower.includes("isi paket") ||
      lower.includes("nama paket") ||
      lower.includes("jenis barang") ||
      lower.includes("komoditi")
    ) {
      const itemMatch = line.match(/(?:Nama\s*Barang|Deskripsi\s*Barang|Jenis\s*Barang|Isi\s*Paket|Nama\s*Paket|Komoditi)[:\s]*([^\n\r]*)/i);
      let val = itemMatch ? itemMatch[1].replace(/^[:\s-]+/, "").trim() : "";
      if (val && val !== "--" && val !== "-") {
        result.nama_barang = val;
      } else if (i + 1 < rawLines.length && rawLines[i + 1].length > 1 && !isHeaderLine(rawLines[i + 1])) {
        const nextVal = rawLines[i + 1].replace(/^[:\s-]+/, "").trim();
        if (nextVal && nextVal !== "--" && nextVal !== "-") {
          result.nama_barang = nextVal;
        }
      }
    }

    // Shipper (Pengirim)
    if (lower.startsWith("pengirim") || lower.startsWith("nama pengirim") || lower.startsWith("shipper") || lower.startsWith("dari:")) {
      currentSection = "pengirim";
      const cleanLine = line.replace(/^(?:pengirim|nama\s*pengirim|shipper|dari)[:\s]*/i, "").replace(/^[:\s-]+/, "").trim();
      if (cleanLine) {
        result.nama_pengirim = cleanLine.replace(/\([^\)]*\)/g, "").trim();
      } else if (i + 1 < rawLines.length && !isHeaderLine(rawLines[i + 1])) {
        result.nama_pengirim = rawLines[i + 1].trim();
      }
    }

    // Detail Alamat Pengirim
    if (
      lower.includes("detail alamat pengirim") ||
      lower.includes("alamat pengirim") ||
      ((lower === "detail alamat" || lower === "alamat" || lower.startsWith("detail alamat")) && currentSection === "pengirim")
    ) {
      const inlineMatch = line.match(/(?:Detail\s*)?Alamat(?:\s*Pengirim)?[:\s]*([^\n\r]*)/i);
      let val = inlineMatch ? inlineMatch[1].replace(/^[:\s-]+/, "").trim() : "";
      if (val && val !== "--" && val !== "-") {
        result.alamat_pengirim = val;
      } else if (i + 1 < rawLines.length && rawLines[i + 1].length > 1 && !isHeaderLine(rawLines[i + 1])) {
        result.alamat_pengirim = rawLines[i + 1].replace(/^[:\s-]+/, "").trim();
      }
    }

    // Receiver (Penerima)
    if (lower.startsWith("penerima") || lower.startsWith("nama penerima") || lower.startsWith("receiver") || lower.startsWith("consignee") || lower.startsWith("kepada:")) {
      currentSection = "penerima";
      const cleanLine = line.replace(/^(?:penerima|nama\s*penerima|receiver|consignee|kepada)[:\s]*/i, "").replace(/^[:\s-]+/, "").trim();
      if (cleanLine) {
        result.nama_penerima = cleanLine.replace(/\([^\)]*\)/g, "").trim();
      } else if (i + 1 < rawLines.length && !isHeaderLine(rawLines[i + 1])) {
        result.nama_penerima = rawLines[i + 1].trim();
      }
    }

    // Detail Alamat Penerima
    if (
      lower.includes("detail alamat penerima") ||
      lower.includes("alamat penerima") ||
      ((lower === "detail alamat" || lower === "alamat" || lower.startsWith("detail alamat")) && currentSection === "penerima")
    ) {
      const inlineMatch = line.match(/(?:Detail\s*)?Alamat(?:\s*Penerima)?[:\s]*([^\n\r]*)/i);
      let val = inlineMatch ? inlineMatch[1].replace(/^[:\s-]+/, "").trim() : "";
      if (val && val !== "--" && val !== "-") {
        result.alamat_penerima = val;
      } else if (i + 1 < rawLines.length && rawLines[i + 1].length > 1 && !isHeaderLine(rawLines[i + 1])) {
        result.alamat_penerima = rawLines[i + 1].replace(/^[:\s-]+/, "").trim();
      }
    }
    
    // Operator & Timestamp (Riwayat operasi line by line fallback)
    if (lower.includes("riwayat operasi") || lower.includes("buat pesanan baru")) {
      let targetLine = line;
      if (lower.includes("riwayat operasi") && i + 1 < rawLines.length) {
        targetLine = rawLines[i + 1];
      }
      const parts = targetLine.split(";");
      if (parts.length >= 2 && !result.operator) {
        result.operator = parts[1].trim();
      }
      if (parts.length >= 3 && (!result.tanggal_transaksi || !result.jam_transaksi)) {
        const dtStr = parts[2].trim();
        const dtParts = dtStr.split(" ");
        if (dtParts.length >= 2) {
          result.tanggal_transaksi = dtParts[0].replace(/[.]/g, "-").replace(/\//g, "-");
          result.jam_transaksi = dtParts[1].trim();
        }
      }
    }
  }

  // 4. Fallbacks and Phone numbers
  if (!result.no_hp_pengirim) {
    const hpPengirim = text.match(/(?:(?:Telp|HP|No\.?\s*HP|No\.?\s*Telepon)\s*(?:Pengirim)?|Pengirim[^\n\r]*?)[:\s]*(\+?62[\d\s-]{8,15}|08[\d\s-]{8,13})/i);
    if (hpPengirim) result.no_hp_pengirim = hpPengirim[1].replace(/[\s-]/g, "");
  }
  if (!result.no_hp_penerima) {
    const hpPenerima = text.match(/(?:(?:Telp|HP|No\.?\s*HP|No\.?\s*Telepon)\s*(?:Penerima)?|Penerima[^\n\r]*?)[:\s]*(\+?62[\d\s-]{8,15}|08[\d\s-]{8,13})/i);
    if (hpPenerima) result.no_hp_penerima = hpPenerima[1].replace(/[\s-]/g, "");
  }

  // 5. Calculate total if not explicit
  if (result.total_yoyi <= 0) {
    if (result.ongkir_dasar > 0) {
      result.total_yoyi = result.ongkir_dasar + result.asuransi + result.biaya_lain;
    }
  } else if (result.ongkir_dasar <= 0 && result.total_yoyi > 0) {
    result.ongkir_dasar = Math.max(0, result.total_yoyi - result.asuransi - result.biaya_lain);
  }

  // 6. Detect Layanan from keywords if still default
  if (result.tipe_produk === "EZ") {
    if (/\b(CARGO|JTC|TRUCKING)\b/i.test(text)) result.tipe_produk = "Cargo";
    else if (/\b(DOC|DOKUMEN)\b/i.test(text)) result.tipe_produk = "DOC";
    else if (/\b(DFOD)\b/i.test(text)) result.tipe_produk = "DFOD";
    else if (/\b(SUPER|FASTTRACK|FAST)\b/i.test(text)) result.tipe_produk = "Super";
  }

  return result;
}
