import React, { useState, useRef } from "react";
import { Upload, X, CheckCircle, AlertCircle, RefreshCw, Save, Search, Table as TableIcon } from "lucide-react";
import * as XLSX from "xlsx";
import useAppsScript from "../hooks/useAppsScript";
import { toast } from "../utils/toast";
import { getTodayWIB, getWIBDate, getWIBTime, normalizeYoYiTimestampToWIB } from "../utils/dateUtils";
import { isDocumentTransaction, calculateFinancialSummary } from "../lib/financialEngine";

interface BulkImportYoYiModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeOutletId: string;
  adminId: string;
  outlets: any[];
  users?: any[];
  onImportComplete: () => void;
}

interface ParsedRow {
  row_index: number;
  resi_id: string;
  tanggal_transaksi: string; // YYYY-MM-DD
  jam_transaksi: string; // HH:mm:ss
  sumber: string;
  pengirim: string;
  hp_pengirim: string;
  alamat_pengirim: string;
  penerima: string;
  hp_penerima: string;
  alamat_penerima: string;
  ongkir: number;
  asuransi: number;
  biaya_lain: number;
  total: number;
  status: string;
  operator: string;
  nama_barang: string;
  jenis_barang?: string;
  tipe_asuransi?: string;
  kode_outlet: string;
  tipe_produk: string;
  metode_bayar: string;
  metode_bayar_tambahan?: string;
  
  // Validation State
  is_valid: boolean;
  is_duplicate: boolean;
  is_skipped: boolean;
  skip_reason: string;
  mapped_outlet_id: string;
}

export default function BulkImportYoYiModal({ isOpen, onClose, activeOutletId, adminId, outlets, users = [], onImportComplete }: BulkImportYoYiModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { callBackend } = useAppsScript();
  
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [metodeBayarTambahanDefault, setMetodeBayarTambahanDefault] = useState<string>("QRIS");
  
  // Summary
  const totalRows = parsedData.length;
  const readyRows = parsedData.filter(r => r.is_valid && !r.is_duplicate && !r.is_skipped).length;
  const duplicateRows = parsedData.filter(r => r.is_duplicate).length;
  const skippedRows = parsedData.filter(r => r.is_skipped).length;

  const resetState = () => {
    setFile(null);
    setParsedData([]);
    setImportProgress(0);
    setIsImporting(false);
    setIsParsing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    if (isImporting) {
      toast.error("Tunggu proses import selesai.");
      return;
    }
    resetState();
    onClose();
  };

  const parseCurrency = (val: any): number => {
    if (!val) return 0;
    if (typeof val === "number") return val;
    const str = String(val).replace(/[^\d.,-]/g, "").trim();
    if (!str) return 0;
    const normalized = str.replace(/[.,]/g, "");
    const num = parseInt(normalized, 10);
    return isNaN(num) ? 0 : num;
  };
  
  const parseDateAndExtract = (val: any) => {
    if (!val) return { tanggal: getTodayWIB(), jam: "00:00:00" };
    
    // Check if it's an Excel serial date number
    if (typeof val === "number") {
      // Excel epoch is 1899-12-30
      const date = new Date((val - (25567 + 2)) * 86400 * 1000); // the +2 is for the 1900 leap year bug
      if (!isNaN(date.getTime())) {
         return {
           tanggal: getWIBDate(date),
           jam: getWIBTime(date)
         };
      }
    }
    
    const str = String(val).trim();
    const parts = str.split(" ");
    let tanggalRaw = parts[0] || getTodayWIB();
    let jamRaw = parts[1] || "00:00:00";
    
    // Normalize YYYY-MM-DD
    if (tanggalRaw.includes("/")) {
      const p = tanggalRaw.split("/");
      if (p.length === 3) {
        // Assume DD/MM/YYYY
        if (p[0].length === 2 && p[2].length === 4) {
          tanggalRaw = `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
        }
      }
    }
    
    const normalized = normalizeYoYiTimestampToWIB(tanggalRaw, jamRaw);
    
    return { tanggal: normalized.tanggal_transaksi, jam: normalized.jam_transaksi };
  };

  const getColValue = (row: any, aliases: string[]) => {
    for (const alias of aliases) {
      const key = Object.keys(row).find(k => k.trim().toLowerCase() === alias.toLowerCase());
      if (key && row[key] !== undefined && row[key] !== "") return row[key];
    }
    return "";
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFile(file);
    setIsParsing(true);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      
      const parsed: ParsedRow[] = [];
      let resiListToCheck: string[] = [];
      
      for (let i = 0; i < json.length; i++) {
        const row: any = json[i];
        
        const resi = getColValue(row, ["No. Pesanan", "Waybill", "Resi", "Awb", "Nomor Resi", "No Resi"]);
        if (!resi) continue; 
        
        const waktuRaw = getColValue(row, ["Waktu Pesanan", "Tanggal", "Waktu", "Created At"]);
        const { tanggal, jam } = parseDateAndExtract(waktuRaw);
        
        const sumber = getColValue(row, ["Sumber", "Source"]);
        const status = getColValue(row, ["Status", "Status Paket"]);
        const pengirim = getColValue(row, ["Nama Pengirim", "Pengirim", "Sender", "Nama"]);
        const hpPengirim = getColValue(row, ["No. HP Pengirim", "Telp Pengirim", "No HP Pengirim", "HP Pengirim", "Telepon Pengirim", "Phone Pengirim", "Sender Phone", "Sender Contact", "No. Telepon Pengirim", "No. HP", "No HP"]);
        const alamatPengirim = getColValue(row, ["Alamat Pengirim", "Alamat", "Alamat Asal"]);
        const penerima = getColValue(row, ["Nama Penerima", "Penerima", "Receiver", "Nama Tujuan"]);
        const hpPenerima = getColValue(row, ["No. HP Penerima", "Telp Penerima", "No HP Penerima", "HP Penerima", "Telepon Penerima", "Phone Penerima", "Receiver Phone", "Receiver Contact", "No. Telepon Penerima"]);
        const alamatPenerima = getColValue(row, ["Alamat Penerima", "Alamat Tujuan", "Destinasi"]);
        
        const ongkir = parseCurrency(getColValue(row, ["Biaya Pengiriman", "Ongkir", "Biaya", "Perhitungan Biaya pengiriman", "Ongkir Dasar"]));
        const asuransi = parseCurrency(getColValue(row, ["Asuransi", "Biaya Asuransi"]));
        const total = parseCurrency(getColValue(row, ["Total", "Grand Total", "Total Tagihan", "Perhitungan Biaya pengiriman"]));
        const biayaLain = total > 0 ? (total - (ongkir + asuransi)) : 0;
        
        const operator = getColValue(row, ["Operator", "Admin", "Nama Operator"]);
        const jenisBarang = getColValue(row, ["Jenis Barang", "Tipe Barang", "Kategori Barang", "Jenis Paket"]);
        const namaBarang = getColValue(row, ["Nama Barang", "Isi Paket", "Deskripsi", "Deskripsi Barang", "Barang", "Nama Paket", "Komoditi"]);
        const tipeAsuransi = getColValue(row, ["Tipe Asuransi", "Asuransi Tipe", "Jenis Asuransi"]);
        const tipeProduk = getColValue(row, ["Tipe Produk", "Tipe", "Layanan", "Jenis Layanan"]);
        const rawMetode = getColValue(row, ["Metode Pembayaran", "Pembayaran", "Metode Bayar", "Payment Method", "Tipe Pembayaran", "Cara Bayar"]);
        const rawMetodeTambahan = getColValue(row, ["Metode Bayar Tambahan", "Metode Pembayaran Tambahan", "Cara Bayar Tambahan", "Payment Method Tambahan", "Metode Tambahan"]);
        const isDfodDetected = String(rawMetode).toUpperCase().includes("DFOD") || String(tipeProduk).toUpperCase().includes("DFOD") || String(sumber).toUpperCase().includes("DFOD");
        const metodeBayar = isDfodDetected ? "DFOD" : (rawMetode || "Tunai");
        
        const kodeOutletRaw = getColValue(row, ["Outlet", "Kode Outlet", "Nama Outlet", "Kode Tempat"]);
        
        let is_skipped = false;
        let skip_reason = "";
        
        if (status.toLowerCase().includes("batal") || status.toLowerCase().includes("cancel")) {
          is_skipped = true;
          skip_reason = "TRANSACTION_CANCELLED";
        }
        
        if (!["yoyi-web", "vip", "app"].includes(String(sumber).trim().toLowerCase()) && sumber !== "") {
          is_skipped = true;
          skip_reason = "UNSUPPORTED_SOURCE";
        }
        
        let mapped_outlet_id = activeOutletId;
        if (kodeOutletRaw) {
          const found = outlets.find(o => 
            (o.kode_outlet && o.kode_outlet.toLowerCase() === String(kodeOutletRaw).trim().toLowerCase()) ||
            (o.nama_outlet && o.nama_outlet.toLowerCase() === String(kodeOutletRaw).trim().toLowerCase()) ||
            (o.outlet_id && o.outlet_id.toLowerCase() === String(kodeOutletRaw).trim().toLowerCase())
          );
          if (found) {
            mapped_outlet_id = found.outlet_id;
          } else {
             is_skipped = true;
             skip_reason = "INVALID_OUTLET";
          }
        }
        
        const resiClean = String(resi).trim().toUpperCase();
        
        parsed.push({
          row_index: i + 1,
          resi_id: resiClean,
          tanggal_transaksi: tanggal,
          jam_transaksi: jam,
          sumber: String(sumber).trim(),
          pengirim: String(pengirim).trim() || "Umum",
          hp_pengirim: String(hpPengirim).trim(),
          alamat_pengirim: String(alamatPengirim).trim(),
          penerima: String(penerima).trim() || "Umum",
          hp_penerima: String(hpPenerima).trim(),
          alamat_penerima: String(alamatPenerima).trim(),
          ongkir,
          asuransi,
          biaya_lain: Math.max(0, biayaLain),
          total,
          status: String(status).trim(),
          operator: String(operator).trim(),
          nama_barang: String(namaBarang).trim() || "Paket",
          jenis_barang: String(jenisBarang).trim(),
          tipe_asuransi: String(tipeAsuransi).trim(),
          kode_outlet: String(kodeOutletRaw).trim(),
          mapped_outlet_id,
          tipe_produk: String(tipeProduk).trim() || "EZ",
          metode_bayar: String(metodeBayar).trim(),
          metode_bayar_tambahan: rawMetodeTambahan ? String(rawMetodeTambahan).trim() : undefined,
          is_valid: !is_skipped,
          is_duplicate: false,
          is_skipped,
          skip_reason
        });
        
        resiListToCheck.push(resiClean);
      }
      
      // Batch duplicate check using single call
      let duplicateMap: Record<string, boolean> = {};
      try {
         // Instead of creating a new API, we will just call a fast batch duplicate checker if it exists, 
         // OR we just pull the recent transactions. Since we don't have a batch check API, 
         // we can check them in small batches or create a custom query to our backend.
         // Wait, the instructions say "reuse duplicate validation existing".
         // The existing validation is `checkDuplicateResi` (which is singular).
         // To avoid overloading the Apps Script server with 500 requests, we'll execute them in chunks of 5.
         
         const chunkSize = 5;
         for (let i = 0; i < resiListToCheck.length; i += chunkSize) {
            const chunk = resiListToCheck.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (rid) => {
               const res = await callBackend("checkDuplicateResi", { resi: rid });
               if (res?.isDuplicate) {
                 duplicateMap[rid] = true;
               }
            }));
         }
      } catch (err) {
         console.error("Duplicate check error:", err);
      }
      
      // Update parsed data with duplicate status
      const finalParsed = parsed.map(r => {
        if (duplicateMap[r.resi_id]) {
           return { ...r, is_duplicate: true, is_valid: false, is_skipped: true, skip_reason: "DUPLICATE_RESI" };
        }
        return r;
      });
      
      setParsedData(finalParsed);
      setIsParsing(false);
      
    } catch (err: any) {
      console.error(err);
      toast.error("Gagal membaca file XLSX/TSV: " + err.message);
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    const rowsToImport = parsedData.filter(r => r.is_valid && !r.is_duplicate && !r.is_skipped);
    if (rowsToImport.length === 0) {
      toast.info("Tidak ada data valid yang bisa diimport.");
      return;
    }
    
    setIsImporting(true);
    let successCount = 0;
    
    // Process sequentially to prevent DB race conditions and adhere to concurrency rules
    for (let i = 0; i < rowsToImport.length; i++) {
      const row = rowsToImport[i];
      
      // Calculate Financials according to SSOT (DFOD and DOKUMEN rules)
      const isDoc = isDocumentTransaction(row);
      const isDfod = String(row.metode_bayar || "").toUpperCase().includes("DFOD");
      
      const biayaAmplop = isDoc ? 2000 : 0;
      const biayaPacking = 0;
      const biayaLain = (isDoc && row.biaya_lain === 0) ? 1000 : row.biaya_lain;

      const metodeBayarOngkir = isDfod ? "DFOD" : (row.metode_bayar || "Tunai");
      const resolvedMetodeTambahan = row.metode_bayar_tambahan || 
        (metodeBayarTambahanDefault === "IKUT_ONGKIR" ? (isDfod ? "Tunai" : metodeBayarOngkir) : metodeBayarTambahanDefault) || 
        "QRIS";

      const summary = calculateFinancialSummary({
        ...row,
        ongkir_dasar: row.ongkir,
        biaya_asuransi: row.asuransi,
        biaya_lain: biayaLain,
        biaya_amplop: biayaAmplop,
        biaya_packing: biayaPacking,
        pembulatan: 0,
        metode_bayar: metodeBayarOngkir,
        metode_bayar_tambahan: resolvedMetodeTambahan
      });

      const setoranKeOwner = isDfod ? 0 : summary.owner_deposit;
      
      let resolvedAdminId = adminId;
      if (row.operator && users && users.length > 0) {
        const normOperator = row.operator.trim().toUpperCase();
        const matchedUser = users.find(u => 
          (u.nama_lengkap || "").trim().toUpperCase() === normOperator ||
          (u.username || "").trim().toUpperCase() === normOperator
        );
        if (matchedUser) {
          resolvedAdminId = matchedUser.user_id;
        }
      }
      
      const transactionData = {
        resi_id: row.resi_id,
        ekspedisi: "Express",
        tipe_produk: (row.tipe_produk === "DOC" || row.tipe_produk === "DOKUMEN") ? "DOC" : (row.tipe_produk || "EZ"),
        jenis_barang: row.jenis_barang || "",
        berat_kg: 1,
        ongkir_dasar: row.ongkir,
        biaya_asuransi: row.asuransi,
        biaya_lain: biayaLain,
        biaya_amplop: biayaAmplop,
        biaya_packing: biayaPacking,
        metode_bayar: metodeBayarOngkir,
        metode_bayar_ongkir: metodeBayarOngkir,
        metode_pembayaran_ongkir: metodeBayarOngkir,
        metode_bayar_tambahan: resolvedMetodeTambahan,
        metode_pembayaran_tambahan: resolvedMetodeTambahan,
        pembulatan: summary.rounding || 0,
        jumlah_dibayar_customer: isDfod ? 0 : (Number(row.ongkir || 0) + Number(row.asuransi || 0) + biayaLain + (summary.rounding || 0)),
        grand_total: summary.customer_payment,
        setoran_ke_owner: setoranKeOwner,
        kas_operasional: summary.outlet_cash,
        kas_outlet: summary.outlet_cash,
        nama_pengirim: row.pengirim,
        hp_pengirim: row.hp_pengirim,
        alamat_pengirim: row.alamat_pengirim,
        nama_penerima: row.penerima,
        hp_penerima: row.hp_penerima,
        alamat_penerima: row.alamat_penerima,
        nama_barang: row.nama_barang,
        tanggal_transaksi: row.tanggal_transaksi,
        jam_transaksi: row.jam_transaksi,
        timestamp: `${row.tanggal_transaksi}T${row.jam_transaksi}`,
        imported_at: `${getWIBDate(new Date())} ${getWIBTime(new Date())}`,
        outlet_id_input: row.mapped_outlet_id,
        admin_id_pencatat: resolvedAdminId,
        operator_nama: row.operator,
        catatan_admin: `Bulk Import YoYi | Operator: ${row.operator || "Unknown"}`,
        sumber_data: row.sumber || "YoYi-WEB"
      };
      
      try {
         const res = await callBackend("saveTransaksi", {
           jenis_layanan: "Express",
           data: transactionData
         });
         if (res && res.status === "success") {
            successCount++;
         }
      } catch (err) {
         console.warn(`Row ${row.resi_id} import failed:`, err);
      }
      
      setImportProgress(Math.round(((i + 1) / rowsToImport.length) * 100));
    }
    
    // Create Audit Log for Bulk Import
    try {
      await callBackend("saveAuditLog", {
        action: "BULK_IMPORT_YOYI",
        detail: `Berhasil mengimport ${successCount} dari ${rowsToImport.length} transaksi secara bulk. (Duplikat: ${duplicateRows}, Skipped: ${skippedRows})`,
        admin_id: adminId,
        outlet_id: activeOutletId
      });
    } catch(e) {}
    
    setIsImporting(false);
    toast.success(`Berhasil mengimport ${successCount} transaksi.`);
    onImportComplete();
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose}></div>
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Bulk Import YoYi (.xlsx / .tsv)</h2>
            <p className="text-xs text-gray-500 mt-1">Import massal transaksi dari eksport file YoYi-WEB atau VIP.</p>
          </div>
          <button 
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-white">
          {!file && (
            <div 
              className="border-2 border-dashed border-gray-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center hover:bg-red-50/30 hover:border-red-200 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4 text-[#E4002B]">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Pilih File XLSX atau TSV</h3>
              <p className="text-sm text-gray-500 mb-6 max-w-md">
                Hanya mendukung format eksport resmi dari YoYi-WEB. Transaksi dengan status dibatalkan atau duplikat akan dilewati.
              </p>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".xlsx, .xls, .tsv, .csv" 
                onChange={handleFileUpload}
              />
              <button className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md hover:bg-gray-800 transition-colors">
                Browse File
              </button>
            </div>
          )}
          
          {isParsing && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <RefreshCw className="w-10 h-10 text-[#E4002B] animate-spin mb-4" />
              <p className="font-bold text-gray-800">Membaca File...</p>
              <p className="text-sm text-gray-500">Memeriksa duplikat dan validasi data (Mohon tunggu)</p>
            </div>
          )}
          
          {file && !isParsing && parsedData.length > 0 && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs text-gray-500 font-semibold mb-1">Total Baris</p>
                  <p className="text-xl font-bold text-gray-900">{totalRows}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                  <p className="text-xs text-emerald-600 font-semibold mb-1">Siap Import (Valid)</p>
                  <p className="text-xl font-bold text-emerald-700">{readyRows}</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                  <p className="text-xs text-amber-600 font-semibold mb-1">Duplikat (Skip)</p>
                  <p className="text-xl font-bold text-amber-700">{duplicateRows}</p>
                </div>
                <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
                  <p className="text-xs text-rose-600 font-semibold mb-1">Invalid / Batal (Skip)</p>
                  <p className="text-xl font-bold text-rose-700">{skippedRows - duplicateRows}</p>
                </div>
              </div>

              {/* Settings and Options */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-amber-900">Metode Bayar Tambahan (Amplop / Packing)</p>
                  <p className="text-[11px] text-amber-700">Pilih metode pembayaran default untuk biaya amplop dokumen & packing:</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={metodeBayarTambahanDefault}
                    onChange={(e) => setMetodeBayarTambahanDefault(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-gray-800 shadow-xs focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="QRIS">QRIS (Default)</option>
                    <option value="Tunai">Tunai (Cash)</option>
                    <option value="Transfer">Transfer Bank</option>
                    <option value="IKUT_ONGKIR">Sama dengan Metode Ongkir</option>
                  </select>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TableIcon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-bold text-gray-800">Data Preview (50 Baris Pertama)</span>
                  </div>
                  <span className="text-xs text-gray-500 font-medium">Metode Tambahan: <span className="font-bold text-indigo-600 font-mono">{metodeBayarTambahanDefault}</span></span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-gray-50/50 text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">No Resi</th>
                        <th className="px-4 py-3 font-semibold">Tanggal</th>
                        <th className="px-4 py-3 font-semibold">Outlet</th>
                        <th className="px-4 py-3 font-semibold">Layanan</th>
                        <th className="px-4 py-3 font-semibold">Metode Ongkir</th>
                        <th className="px-4 py-3 font-semibold">Metode Tambahan</th>
                        <th className="px-4 py-3 font-semibold">Ongkir</th>
                        <th className="px-4 py-3 font-semibold">Operator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {parsedData.slice(0, 50).map((row, idx) => (
                        <tr key={idx} className={row.is_valid ? "hover:bg-gray-50" : "bg-red-50/30"}>
                          <td className="px-4 py-3">
                            {row.is_valid && !row.is_duplicate ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold text-[10px]">
                                <CheckCircle className="w-3 h-3" /> READY
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 px-2 py-0.5 rounded font-bold text-[10px]">
                                <AlertCircle className="w-3 h-3" /> {row.skip_reason}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-gray-800">{row.resi_id}</td>
                          <td className="px-4 py-3 text-gray-600">{row.tanggal_transaksi}</td>
                          <td className="px-4 py-3 text-gray-600">{row.mapped_outlet_id}</td>
                          <td className="px-4 py-3 text-gray-600 font-semibold">{row.tipe_produk}</td>
                          <td className="px-4 py-3">
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-[11px]">
                              {row.metode_bayar}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold text-[11px]">
                              {row.metode_bayar_tambahan || (metodeBayarTambahanDefault === "IKUT_ONGKIR" ? row.metode_bayar : metodeBayarTambahanDefault)}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-gray-800">
                            Rp {row.ongkir.toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-3 text-gray-600 font-semibold">{row.operator || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedData.length > 50 && (
                    <div className="px-4 py-3 text-center text-xs text-gray-500 border-t border-gray-100">
                      Menampilkan 50 baris pertama dari {parsedData.length} baris...
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <button 
            onClick={resetState}
            disabled={isImporting}
            className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
          >
            Reset
          </button>
          
          <button
            onClick={handleImport}
            disabled={!file || readyRows === 0 || isImporting || isParsing}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#E4002B] hover:bg-[#c20023] text-white rounded-xl font-bold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Mengimpor... {importProgress}%</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Import {readyRows} Transaksi</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
