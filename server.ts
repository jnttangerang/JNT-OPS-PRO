import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const isVercel = !!process.env.VERCEL;

// Directory for uploads
const uploadsDir = isVercel ? path.join("/tmp", "uploads") : path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// Database file path
const dbPath = isVercel ? path.join("/tmp", "db.json") : path.join(process.cwd(), "db.json");

// System instruction for Gemini Pakar Alamat J&T
const GEM_ALAMAT_SYSTEM_INSTRUCTION = 
  "Kamu adalah 'Pakar Alamat J&T', ahli perapihan alamat pengiriman di Indonesia. " +
  "Tugasmu: perbaiki ejaan/typo, lengkapi struktur alamat (nama jalan, nomor rumah, RT/RW, kelurahan, " +
  "kecamatan, kota/kabupaten, provinsi, kode pos bila bisa disimpulkan dari konteks), tanpa mengubah " +
  "makna atau menambah informasi yang tidak ada. Balas HANYA alamat hasil perbaikan dalam satu baris " +
  "teks, tanpa penjelasan, tanpa markdown, tanpa tanda kutip tambahan.";

// Initialize Gemini SDK lazily
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment secrets. Please set it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// SHA-256 simulation helper for password checking (or plain text/simple hash for mock)
function simulateHash(password: string): string {
  // Simple simulation of a hash (SHA-256)
  return "hash_" + password;
}

// Initial Database Seeding
const initialDb = {
  Users: [
    {
      user_id: "USR-001",
      username: "admin1",
      password_hash: "hash_admin123",
      role: "ADMIN",
      outlet_id_home: "OUT-001",
      nama_lengkap: "Siti Aminah (Karawaci)",
      status_aktif: "AKTIF",
      no_wa: "08111111111"
    },
    {
      user_id: "USR-002",
      username: "admin2",
      password_hash: "hash_admin123",
      role: "ADMIN",
      outlet_id_home: "OUT-002",
      nama_lengkap: "Budi Santoso (Cikokol)",
      status_aktif: "AKTIF",
      no_wa: "08222222222"
    },
    {
      user_id: "USR-003",
      username: "owner1",
      password_hash: "hash_owner123",
      role: "OWNER",
      outlet_id_home: "OUT-001",
      nama_lengkap: "Hendra Wijaya (Owner)",
      status_aktif: "AKTIF",
      no_wa: "08333333333"
    }
  ],
  Outlets: [
    {
      outlet_id: "OUT-001",
      nama_outlet: "J&T Express - Tangerang Karawaci",
      kode_outlet: "TGR01",
      no_wa_outlet: "081234567890",
      alamat_outlet: "Jl. Karawaci Raya No.12, Karawaci, Tangerang",
      latitude: -6.2088,
      longitude: 106.634,
      radius_operasional: 50,
      status_aktif: "AKTIF",
      target_express: 25,
      target_cargo: 15
    },
    {
      outlet_id: "OUT-002",
      nama_outlet: "J&T Express - Tangerang Cikokol",
      kode_outlet: "TGR02",
      no_wa_outlet: "081234567891",
      alamat_outlet: "Jl. M.H. Thamrin No.8, Cikokol, Tangerang",
      latitude: -6.2155,
      longitude: 106.638,
      radius_operasional: 50,
      status_aktif: "AKTIF",
      target_express: 20,
      target_cargo: 10
    },
    {
      outlet_id: "OUT-003",
      nama_outlet: "J&T Cargo - Tangerang Balaraja",
      kode_outlet: "TGR03",
      no_wa_outlet: "081234567892",
      alamat_outlet: "Jl. Raya Serang Km 24, Balaraja, Tangerang",
      latitude: -6.1944,
      longitude: 106.467,
      radius_operasional: 100,
      status_aktif: "AKTIF",
      target_express: 15,
      target_cargo: 30
    }
  ],
  SystemSettings: {
    id: "SETTING-1",
    apps_script_url: "",
    spreadsheet_id: "",
    folder_bukti_bayar_customer: "",
    folder_foto_paket: "",
    folder_foto_resi: "",
    folder_bukti_kas_masuk: "",
    folder_bukti_kas_keluar: "",
    folder_bukti_transfer_admin_owner: "",
    folder_bukti_transfer_owner_dp: ""
  },
  Master_Customer: [
    {
      customer_id: "CST-001",
      nama_pengirim: "Andi Wijaya",
      no_hp: "081234567890",
      alamat_pengirim: "Jl. Imam Bonjol No.45, Karawaci, Tangerang",
      outlet_id: "OUT-001",
      last_updated: "2026-07-04T12:00:00.000Z"
    },
    {
      customer_id: "CST-002",
      nama_pengirim: "Rina Kartika",
      no_hp: "087799887766",
      alamat_pengirim: "Perumahan Cikokol Indah Blok B5/10, Cikokol, Tangerang",
      outlet_id: "OUT-002",
      last_updated: "2026-07-04T13:30:00.000Z"
    },
    {
      customer_id: "CST-003",
      nama_pengirim: "CV Sinar Mandiri",
      no_hp: "0215551234",
      alamat_pengirim: "Kawasan Industri Balaraja Mas Blok C3, Balaraja, Tangerang",
      outlet_id: "OUT-003",
      last_updated: "2026-07-04T14:15:00.000Z"
    }
  ],
  Riwayat_Penerima: [
    {
      id: "REC-001",
      customer_id: "CST-001",
      nama_penerima: "Dewi Lestari",
      no_hp_penerima: "085211223344",
      alamat_penerima: "Jl. Sudirman No.99, Kebayoran Baru, Jakarta Selatan",
      tanggal_terakhir_kirim: "2026-07-04T12:05:00.000Z"
    },
    {
      id: "REC-002",
      customer_id: "CST-001",
      nama_penerima: "Eko Prasetyo",
      no_hp_penerima: "081944556677",
      alamat_penerima: "Jl. Diponegoro No.12, Menteng, Jakarta Pusat",
      tanggal_terakhir_kirim: "2026-07-03T10:00:00.000Z"
    },
    {
      id: "REC-003",
      customer_id: "CST-002",
      nama_penerima: "Farhan Siregar",
      no_hp_penerima: "081399881122",
      alamat_penerima: "Ruko Sentra Niaga Blok F-12, Manyar, Surabaya, Jawa Timur",
      tanggal_terakhir_kirim: "2026-07-04T13:35:00.000Z"
    },
    {
      id: "REC-004",
      customer_id: "CST-003",
      nama_penerima: "Toko Abadi Jaya",
      no_hp_penerima: "081122334455",
      alamat_penerima: "Jl. Malioboro No.87, Sosromenduran, Gedong Tengen, Yogyakarta",
      tanggal_terakhir_kirim: "2026-07-04T14:20:00.000Z"
    }
  ],
  PreInput_Backup: [
    {
      transaksi_id: "TRX-1719999001",
      timestamp: "2026-07-04T14:00:00.000Z",
      admin_id: "USR-001",
      outlet_id_tugas: "OUT-001",
      nama_pengirim: "Andi Wijaya",
      hp_pengirim: "081234567890",
      alamat_pengirim: "Jl. Imam Bonjol No.45, Karawaci, Tangerang",
      nama_penerima: "Dewi Lestari",
      hp_penerima: "085211223344",
      alamat_penerima: "Jl. Sudirman No.99, Kebayoran Baru, Jakarta Selatan",
      nama_barang: "Dokumen Kontrak Kerja",
      dasar_berat: "TIMBANGAN",
      berat_kg: 0.5,
      volume: "30 x 20 x 1",
      nilai_barang: 100000,
      foto_paket_url: "/uploads/seed_paket_doc.jpg",
      status: "SELESAI",
      catatan_admin: ""
    },
    {
      transaksi_id: "TRX-1719999002",
      timestamp: "2026-07-04T15:30:00.000Z",
      admin_id: "USR-002",
      outlet_id_tugas: "OUT-002",
      nama_pengirim: "Rina Kartika",
      hp_pengirim: "087799887766",
      alamat_pengirim: "Perumahan Cikokol Indah Blok B5/10, Cikokol, Tangerang",
      nama_penerima: "Farhan Siregar",
      hp_penerima: "081399881122",
      alamat_penerima: "Ruko Sentra Niaga Blok F-12, Manyar, Surabaya, Jawa Timur",
      nama_barang: "Kosmetik & Skincare",
      dasar_berat: "TIMBANGAN",
      berat_kg: 2,
      volume: "20 x 15 x 10",
      nilai_barang: 350000,
      foto_paket_url: "/uploads/seed_paket_cosmetic.jpg",
      status: "SELESAI",
      catatan_admin: ""
    },
    {
      transaksi_id: "TRX-1719999003",
      timestamp: "2026-07-04T16:15:00.000Z",
      admin_id: "USR-002",
      outlet_id_tugas: "OUT-003", // admin diperbantukan ke Balaraja
      nama_pengirim: "CV Sinar Mandiri",
      hp_pengirim: "0215551234",
      alamat_pengirim: "Kawasan Industri Balaraja Mas Blok C3, Balaraja, Tangerang",
      nama_penerima: "Toko Abadi Jaya",
      hp_penerima: "081122334455",
      alamat_penerima: "Jl. Malioboro No.87, Sosromenduran, Gedong Tengen, Yogyakarta",
      nama_barang: "Sparepart Mesin Bubut",
      dasar_berat: "TIMBANGAN",
      berat_kg: 45,
      volume: "60 x 50 x 40",
      nilai_barang: 2500000,
      foto_paket_url: "/uploads/seed_paket_cargo.jpg",
      status: "SELESAI",
      catatan_admin: ""
    },
    {
      transaksi_id: "TRX-1719999004",
      timestamp: "2026-07-04T18:00:00.000Z",
      admin_id: "USR-001",
      outlet_id_tugas: "OUT-001",
      nama_pengirim: "Andi Wijaya",
      hp_pengirim: "081234567890",
      alamat_pengirim: "Jl. Imam Bonjol No.45, Karawaci, Tangerang",
      nama_penerima: "Eko Prasetyo",
      hp_penerima: "081944556677",
      alamat_penerima: "Jl. Diponegoro No.12, Menteng, Jakarta Pusat",
      nama_barang: "Pakaian Anak-anak",
      dasar_berat: "TIMBANGAN",
      berat_kg: 1.5,
      volume: "25 x 18 x 5",
      nilai_barang: 200000,
      foto_paket_url: "",
      status: "PENDING",
      catatan_admin: ""
    }
  ],
  EXP_Resi: [
    {
      resi_id: "JT12345678901",
      transaksi_id: "TRX-1719999001",
      timestamp: "2026-07-04T14:10:00.000Z",
      admin_id_pencatat: "USR-001",
      outlet_id_input: "OUT-001",
      tipe_produk: "DOC",
      biaya_lain: 1000,
      biaya_asuransi: 200,
      ongkir_dasar: 11000,
      biaya_yoyi: 12200,
      total_dibayar_customer: 13000,
      pembulatan: 800,
      metode_bayar: "Tunai",
      bukti_bayar_url: "",
      biaya_amplop: 2000,
      biaya_packing: 3000,
      metode_bayar_tambahan: "Tunai",
      bukti_tambahan_url: "",
      grand_total: 18000,
      setoran_ke_owner: 13000,
      kas_operasional: 5000
    },
    {
      resi_id: "JT12345678902",
      transaksi_id: "TRX-1719999002",
      timestamp: "2026-07-04T15:45:00.000Z",
      admin_id_pencatat: "USR-002",
      outlet_id_input: "OUT-002",
      tipe_produk: "EZ",
      biaya_lain: 0,
      biaya_asuransi: 700,
      ongkir_dasar: 22000,
      biaya_yoyi: 22700,
      total_dibayar_customer: 23000,
      pembulatan: 300,
      metode_bayar: "QRIS",
      bukti_bayar_url: "/uploads/bukti_bayar_seed1.jpg",
      biaya_amplop: 0,
      biaya_packing: 0,
      metode_bayar_tambahan: "",
      bukti_tambahan_url: "",
      grand_total: 23000,
      setoran_ke_owner: 23000,
      kas_operasional: 0
    }
  ],
  CRG_Resi: [
    {
      resi_id: "JTC98765432101",
      transaksi_id: "TRX-1719999003",
      timestamp: "2026-07-04T16:30:00.000Z",
      admin_id_pencatat: "USR-002",
      outlet_id_input: "OUT-003",
      tipe_produk: "FastTrack",
      biaya_asuransi: 5000,
      ongkir_dasar: 180000,
      biaya_jtc: 185000,
      total_dibayar_customer: 185000,
      pembulatan: 0,
      metode_bayar: "Transfer",
      bukti_bayar_url: "/uploads/bukti_bayar_seed2.jpg",
      biaya_amplop: 0,
      biaya_packing: 15000,
      metode_bayar_tambahan: "Tunai",
      bukti_tambahan_url: "",
      grand_total: 200000,
      setoran_ke_owner: 185000,
      kas_operasional: 15000
    }
  ],
  AuditLogs: [
    {
      log_id: "LOG-001",
      timestamp: "2026-07-04T12:00:00.000Z",
      user_id: "USR-001",
      aksi: "LOGIN",
      detail: "Admin 'Siti Aminah' berhasil login.",
      outlet_id: "OUT-001"
    },
    {
      log_id: "LOG-002",
      timestamp: "2026-07-04T14:02:00.000Z",
      user_id: "USR-001",
      aksi: "PREINPUT_SIMPAN",
      detail: "Menyimpan data awal pre-input untuk pengirim 'Andi Wijaya' ke penerima 'Dewi Lestari' (TRX-1719999001)",
      outlet_id: "OUT-001"
    },
    {
      log_id: "LOG-003",
      timestamp: "2026-07-04T14:12:00.000Z",
      user_id: "USR-001",
      aksi: "TRANSAKSI_SIMPAN",
      detail: "Menyimpan resi Express 'JT12345678901' (DOC) untuk TRX-1719999001. Grand Total: Rp 18.000",
      outlet_id: "OUT-001"
    },
    {
      log_id: "LOG-004",
      timestamp: "2026-07-04T15:47:00.000Z",
      user_id: "USR-002",
      aksi: "TRANSAKSI_SIMPAN",
      detail: "Menyimpan resi Express 'JT12345678902' (EZ) untuk TRX-1719999002. Grand Total: Rp 23.000",
      outlet_id: "OUT-002"
    },
    {
      log_id: "LOG-005",
      timestamp: "2026-07-04T16:32:00.000Z",
      user_id: "USR-002",
      aksi: "TRANSAKSI_SIMPAN",
      detail: "Menyimpan resi Cargo 'JTC98765432101' (FastTrack) untuk TRX-1719999003. Grand Total: Rp 200.000",
      outlet_id: "OUT-003"
    }
  ]
};

// Ensure database file exists
const defaultReviews = [
  {
    id: "REV-101",
    outlet_id: "TGR044B",
    nama_outlet: "J&T Cargo Balaraja (TGR044B)",
    reviewer: "Ahmad Subarjo",
    stars: 5,
    text: "Pelayanan sangat baik dan cepat. Kirim motor pake J&T Cargo Balaraja aman tanpa lecet, harganya juga terjangkau. Recommended!",
    timestamp: "2026-07-05T09:12:00.000Z",
    status_analisis: "BELUM_DIANALISIS",
    analisis: null
  },
  {
    id: "REV-102",
    outlet_id: "JYT-CRG",
    nama_outlet: "J&T Cargo Jayanti Cikande",
    reviewer: "Indah Permata",
    stars: 1,
    text: "Paket kargo saya kenapa belum sampai rumah ya? Padahal di tracking sudah 3 hari di wilayah Cikande. Kurirnya malas antar kah?",
    timestamp: "2026-07-05T14:20:00.000Z",
    status_analisis: "BELUM_DIANALISIS",
    analisis: null
  },
  {
    id: "REV-103",
    outlet_id: "BLR-EXP",
    nama_outlet: "J&T Express Balaraja (MDP Pasir Jaha)",
    reviewer: "Yogi Pratama",
    stars: 1,
    text: "",
    timestamp: "2026-07-06T02:05:00.000Z",
    status_analisis: "BELUM_DIANALISIS",
    analisis: null
  },
  {
    id: "REV-104",
    outlet_id: "JYT-EXP",
    nama_outlet: "J&T Express Jayanti Cikande (MDP)",
    reviewer: "Supriadi",
    stars: 5,
    text: "Admin ramah dan cepat proses paketnya. Sangat terbantu kirim dokumen ke luar kota.",
    timestamp: "2026-07-06T05:30:00.000Z",
    status_analisis: "BELUM_DIANALISIS",
    analisis: null
  }
];

const defaultKategoriKeuangan = [
  // PENGELUARAN
  { id: "KAT-101", jenis: "PENGELUARAN", nama: "ATK", aktif: true, urutan: 1, created_at: "2026-07-26T00:00:00.000Z", updated_at: "2026-07-26T00:00:00.000Z", created_by: "SYSTEM" },
  { id: "KAT-102", jenis: "PENGELUARAN", nama: "Packing", aktif: true, urutan: 2, created_at: "2026-07-26T00:00:00.000Z", updated_at: "2026-07-26T00:00:00.000Z", created_by: "SYSTEM" },
  { id: "KAT-103", jenis: "PENGELUARAN", nama: "BBM", aktif: true, urutan: 3, created_at: "2026-07-26T00:00:00.000Z", updated_at: "2026-07-26T00:00:00.000Z", created_by: "SYSTEM" },
  { id: "KAT-104", jenis: "PENGELUARAN", nama: "Transport", aktif: true, urutan: 4, created_at: "2026-07-26T00:00:00.000Z", updated_at: "2026-07-26T00:00:00.000Z", created_by: "SYSTEM" },
  { id: "KAT-105", jenis: "PENGELUARAN", nama: "Parkir", aktif: true, urutan: 5, created_at: "2026-07-26T00:00:00.000Z", updated_at: "2026-07-26T00:00:00.000Z", created_by: "SYSTEM" },
  { id: "KAT-106", jenis: "PENGELUARAN", nama: "Listrik", aktif: true, urutan: 6, created_at: "2026-07-26T00:00:00.000Z", updated_at: "2026-07-26T00:00:00.000Z", created_by: "SYSTEM" },
  { id: "KAT-107", jenis: "PENGELUARAN", nama: "Internet", aktif: true, urutan: 7, created_at: "2026-07-26T00:00:00.000Z", updated_at: "2026-07-26T00:00:00.000Z", created_by: "SYSTEM" },
  { id: "KAT-108", jenis: "PENGELUARAN", nama: "Air Minum", aktif: true, urutan: 8, created_at: "2026-07-26T00:00:00.000Z", updated_at: "2026-07-26T00:00:00.000Z", created_by: "SYSTEM" },
  { id: "KAT-109", jenis: "PENGELUARAN", nama: "Konsumsi", aktif: true, urutan: 9, created_at: "2026-07-26T00:00:00.000Z", updated_at: "2026-07-26T00:00:00.000Z", created_by: "SYSTEM" },
  { id: "KAT-110", jenis: "PENGELUARAN", nama: "Maintenance", aktif: true, urutan: 10, created_at: "2026-07-26T00:00:00.000Z", updated_at: "2026-07-26T00:00:00.000Z", created_by: "SYSTEM" },
  { id: "KAT-111", jenis: "PENGELUARAN", nama: "Lainnya", aktif: true, urutan: 11, created_at: "2026-07-26T00:00:00.000Z", updated_at: "2026-07-26T00:00:00.000Z", created_by: "SYSTEM" },

  // PEMASUKAN
  { id: "KAT-201", jenis: "PEMASUKAN", nama: "Modal Owner", aktif: true, urutan: 1, created_at: "2026-07-26T00:00:00.000Z", updated_at: "2026-07-26T00:00:00.000Z", created_by: "SYSTEM" },
  { id: "KAT-202", jenis: "PEMASUKAN", nama: "Reward Pusat", aktif: true, urutan: 2, created_at: "2026-07-26T00:00:00.000Z", updated_at: "2026-07-26T00:00:00.000Z", created_by: "SYSTEM" },
  { id: "KAT-203", jenis: "PEMASUKAN", nama: "Insentif", aktif: true, urutan: 3, created_at: "2026-07-26T00:00:00.000Z", updated_at: "2026-07-26T00:00:00.000Z", created_by: "SYSTEM" },
  { id: "KAT-204", jenis: "PEMASUKAN", nama: "Cashback", aktif: true, urutan: 4, created_at: "2026-07-26T00:00:00.000Z", updated_at: "2026-07-26T00:00:00.000Z", created_by: "SYSTEM" },
  { id: "KAT-205", jenis: "PEMASUKAN", nama: "Pendapatan Lain", aktif: true, urutan: 5, created_at: "2026-07-26T00:00:00.000Z", updated_at: "2026-07-26T00:00:00.000Z", created_by: "SYSTEM" },
  { id: "KAT-206", jenis: "PEMASUKAN", nama: "Lainnya", aktif: true, urutan: 6, created_at: "2026-07-26T00:00:00.000Z", updated_at: "2026-07-26T00:00:00.000Z", created_by: "SYSTEM" }
];

function normalizePhone(phone: any): string {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = "62" + digits.slice(1);
  } else if (digits.startsWith("8")) {
    digits = "62" + digits;
  }
  return digits;
}

function autoUpsertCustomerAndAddressBook(db: any, params: {
  nama_pengirim: string;
  hp_pengirim: string;
  alamat_pengirim: string;
  nama_penerima: string;
  hp_penerima: string;
  alamat_penerima: string;
  timestamp?: string;
}) {
  const nowStr = params.timestamp || new Date().toISOString();
  
  if (!db.MASTER_CUSTOMER) db.MASTER_CUSTOMER = [];
  if (!db.MASTER_PENGIRIM) db.MASTER_PENGIRIM = [];
  if (!db.MASTER_PENERIMA) db.MASTER_PENERIMA = [];

  // 1. SENDER: MASTER_CUSTOMER & MASTER_PENGIRIM
  const hpSenderClean = (params.hp_pengirim || "").trim();
  const hpSenderNorm = normalizePhone(hpSenderClean);
  const namaSenderClean = (params.nama_pengirim || "").trim();
  const alamatSenderClean = (params.alamat_pengirim || "").trim();

  let senderCustId = "";
  if (hpSenderClean || hpSenderNorm) {
    let custObj = db.MASTER_CUSTOMER.find((c: any) => 
      normalizePhone(c.telepon || c.no_hp) === hpSenderNorm
    );

    if (custObj) {
      if (namaSenderClean && custObj.nama !== namaSenderClean) {
        custObj.nama = namaSenderClean;
      }
      custObj.updated_at = nowStr;
      senderCustId = custObj.customer_id;
    } else {
      const count = db.MASTER_CUSTOMER.length + 1;
      senderCustId = "CUS" + String(count).padStart(6, "0");
      custObj = {
        customer_id: senderCustId,
        nama: namaSenderClean,
        telepon: hpSenderClean,
        created_at: nowStr,
        updated_at: nowStr,
        status: "AKTIF"
      };
      db.MASTER_CUSTOMER.push(custObj);
    }

    if (db.Master_Customer) {
      let legacyCust = db.Master_Customer.find((c: any) => normalizePhone(c.no_hp) === hpSenderNorm);
      if (legacyCust) {
        legacyCust.nama_pengirim = namaSenderClean;
        legacyCust.alamat_pengirim = alamatSenderClean;
        legacyCust.last_updated = nowStr;
      } else {
        db.Master_Customer.push({
          customer_id: senderCustId,
          nama_pengirim: namaSenderClean,
          no_hp: hpSenderClean,
          alamat_pengirim: alamatSenderClean,
          outlet_id: "OUT-001",
          last_updated: nowStr
        });
      }
    }

    if (alamatSenderClean) {
      let sndAddress = db.MASTER_PENGIRIM.find((p: any) => 
        (p.customer_id === senderCustId || normalizePhone(p.telepon) === hpSenderNorm) &&
        (p.alamat || "").trim().toLowerCase() === alamatSenderClean.toLowerCase()
      );

      if (sndAddress) {
        sndAddress.jumlah_pengiriman = (sndAddress.jumlah_pengiriman || 0) + 1;
        sndAddress.tanggal_terakhir = nowStr;
        sndAddress.updated_at = nowStr;
        sndAddress.nama = namaSenderClean;
        sndAddress.telepon = hpSenderClean;
      } else {
        const sndCount = db.MASTER_PENGIRIM.length + 1;
        const newSnd = {
          id: "SND-" + String(sndCount).padStart(6, "0"),
          customer_id: senderCustId,
          nama: namaSenderClean,
          telepon: hpSenderClean,
          provinsi: "",
          kabupaten: "",
          kecamatan: "",
          kelurahan: "",
          kode_pos: "",
          alamat: alamatSenderClean,
          jumlah_pengiriman: 1,
          tanggal_pertama: nowStr,
          tanggal_terakhir: nowStr,
          status: "AKTIF",
          created_at: nowStr,
          updated_at: nowStr
        };
        db.MASTER_PENGIRIM.push(newSnd);
      }
    }
  }

  // 2. RECIPIENT: MASTER_CUSTOMER & MASTER_PENERIMA
  const hpRecClean = (params.hp_penerima || "").trim();
  const hpRecNorm = normalizePhone(hpRecClean);
  const namaRecClean = (params.nama_penerima || "").trim();
  const alamatRecClean = (params.alamat_penerima || "").trim();

  let recCustId = "";
  if (hpRecClean || hpRecNorm) {
    let recCustObj = db.MASTER_CUSTOMER.find((c: any) => 
      normalizePhone(c.telepon || c.no_hp) === hpRecNorm
    );

    if (recCustObj) {
      if (namaRecClean && recCustObj.nama !== namaRecClean) {
        recCustObj.nama = namaRecClean;
      }
      recCustObj.updated_at = nowStr;
      recCustId = recCustObj.customer_id;
    } else {
      const count = db.MASTER_CUSTOMER.length + 1;
      recCustId = "CUS" + String(count).padStart(6, "0");
      recCustObj = {
        customer_id: recCustId,
        nama: namaRecClean,
        telepon: hpRecClean,
        created_at: nowStr,
        updated_at: nowStr,
        status: "AKTIF"
      };
      db.MASTER_CUSTOMER.push(recCustObj);
    }

    if (alamatRecClean) {
      let rcvAddress = db.MASTER_PENERIMA.find((r: any) => 
        (r.customer_id === recCustId || normalizePhone(r.telepon) === hpRecNorm) &&
        (r.alamat || "").trim().toLowerCase() === alamatRecClean.toLowerCase()
      );

      if (rcvAddress) {
        rcvAddress.jumlah_diterima = (rcvAddress.jumlah_diterima || 0) + 1;
        rcvAddress.tanggal_terakhir = nowStr;
        rcvAddress.updated_at = nowStr;
        rcvAddress.nama = namaRecClean;
        rcvAddress.telepon = hpRecClean;
      } else {
        const rcvCount = db.MASTER_PENERIMA.length + 1;
        const newRcv = {
          id: "RCV-" + String(rcvCount).padStart(6, "0"),
          customer_id: recCustId,
          nama: namaRecClean,
          telepon: hpRecClean,
          provinsi: "",
          kabupaten: "",
          kecamatan: "",
          kelurahan: "",
          kode_pos: "",
          alamat: alamatRecClean,
          jumlah_diterima: 1,
          tanggal_pertama: nowStr,
          tanggal_terakhir: nowStr,
          status: "AKTIF",
          created_at: nowStr,
          updated_at: nowStr
        };
        db.MASTER_PENERIMA.push(newRcv);
      }
    }

    if (db.Riwayat_Penerima) {
      let rPenerima = db.Riwayat_Penerima.find(
        (r: any) => (r.customer_id === senderCustId || r.customer_id === recCustId) && normalizePhone(r.no_hp_penerima) === hpRecNorm
      );
      if (rPenerima) {
        rPenerima.nama_penerima = namaRecClean;
        rPenerima.alamat_penerima = alamatRecClean;
        rPenerima.tanggal_terakhir_kirim = nowStr;
      } else {
        db.Riwayat_Penerima.push({
          id: "REC-" + String(Date.now()).slice(-5) + Math.floor(Math.random() * 10),
          customer_id: senderCustId || recCustId,
          nama_penerima: namaRecClean,
          no_hp_penerima: hpRecClean,
          alamat_penerima: alamatRecClean,
          tanggal_terakhir_kirim: nowStr
        });
      }
    }
  }

  return { senderCustId, recCustId };
}

function syncExistingDataToThreeLayers(db: any) {
  if (!db.MASTER_CUSTOMER) db.MASTER_CUSTOMER = [];
  if (!db.MASTER_PENGIRIM) db.MASTER_PENGIRIM = [];
  if (!db.MASTER_PENERIMA) db.MASTER_PENERIMA = [];

  if (db.MASTER_CUSTOMER.length === 0 && db.Master_Customer && db.Master_Customer.length > 0) {
    db.Master_Customer.forEach((c: any, idx: number) => {
      const custId = "CUS" + String(idx + 1).padStart(6, "0");
      const phone = (c.no_hp || c.telepon || "").trim();
      if (phone) {
        db.MASTER_CUSTOMER.push({
          customer_id: custId,
          nama: c.nama_pengirim || c.nama || "Customer",
          telepon: phone,
          created_at: c.last_updated || new Date().toISOString(),
          updated_at: c.last_updated || new Date().toISOString(),
          status: "AKTIF"
        });

        if (c.alamat_pengirim) {
          db.MASTER_PENGIRIM.push({
            id: "SND-" + String(idx + 1).padStart(6, "0"),
            customer_id: custId,
            nama: c.nama_pengirim || "Customer",
            telepon: phone,
            provinsi: "",
            kabupaten: "",
            kecamatan: "",
            kelurahan: "",
            kode_pos: "",
            alamat: c.alamat_pengirim,
            jumlah_pengiriman: 1,
            tanggal_pertama: c.last_updated || new Date().toISOString(),
            tanggal_terakhir: c.last_updated || new Date().toISOString(),
            status: "AKTIF",
            created_at: c.last_updated || new Date().toISOString(),
            updated_at: c.last_updated || new Date().toISOString()
          });
        }
      }
    });
  }

  if (db.PreInput_Backup && Array.isArray(db.PreInput_Backup)) {
    db.PreInput_Backup.forEach((pi: any) => {
      autoUpsertCustomerAndAddressBook(db, {
        nama_pengirim: pi.nama_pengirim,
        hp_pengirim: pi.hp_pengirim,
        alamat_pengirim: pi.alamat_pengirim,
        nama_penerima: pi.nama_penerima,
        hp_penerima: pi.hp_penerima,
        alamat_penerima: pi.alamat_penerima,
        timestamp: pi.timestamp
      });
    });
  }
}

function readDb() {
  if (!fs.existsSync(dbPath)) {
    const dbToSave = { ...initialDb, MapsReviews: defaultReviews, MasterKategoriKeuangan: defaultKategoriKeuangan };
    syncExistingDataToThreeLayers(dbToSave);
    fs.writeFileSync(dbPath, JSON.stringify(dbToSave, null, 2));
    return dbToSave;
  }
  try {
    const data = fs.readFileSync(dbPath, "utf-8");
    const parsed = JSON.parse(data);
    let updated = false;
    if (!parsed.MapsReviews) {
      parsed.MapsReviews = defaultReviews;
      updated = true;
    }
    if (!parsed.SetoranData) {
      parsed.SetoranData = [];
      updated = true;
    }
    if (!parsed.MasterKategoriKeuangan || !Array.isArray(parsed.MasterKategoriKeuangan) || parsed.MasterKategoriKeuangan.length === 0) {
      parsed.MasterKategoriKeuangan = defaultKategoriKeuangan;
      updated = true;
    }
    if (!parsed.MASTER_CUSTOMER || !Array.isArray(parsed.MASTER_CUSTOMER) || parsed.MASTER_CUSTOMER.length === 0) {
      syncExistingDataToThreeLayers(parsed);
      updated = true;
    }
    if (updated) {
      fs.writeFileSync(dbPath, JSON.stringify(parsed, null, 2));
    }
    return parsed;
  } catch (e) {
    console.error("Error reading database file, resetting to initial state", e);
    const dbToSave = { ...initialDb, MapsReviews: defaultReviews, MasterKategoriKeuangan: defaultKategoriKeuangan };
    syncExistingDataToThreeLayers(dbToSave);
    fs.writeFileSync(dbPath, JSON.stringify(dbToSave, null, 2));
    return dbToSave;
  }
}

function writeDb(data: any) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Log a dynamic audit event
function addAuditLog(userId: string, action: string, detail: string, outletId: string) {
  const db = readDb();
  const logId = "LOG-" + String(Date.now()).slice(-6) + Math.floor(Math.random() * 10);
  const newLog = {
    log_id: logId,
    timestamp: new Date().toISOString(),
    user_id: userId,
    aksi: action,
    detail: detail,
    outlet_id: outletId
  };
  db.AuditLogs.unshift(newLog); // Put new logs at the beginning
  writeDb(db);
}

// === API ROUTES ===

app.post("/api/ping", (req, res) => {
  return res.json({ status: "success", message: "pong" });
});

app.post("/api/testConnection", (req, res) => {
  return res.json({ status: "success", message: "Connection OK" });
});

// 1. LOGIN API
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ status: "error", message: "Username & Password wajib diisi" });
  }

  const db = readDb();
  // We check against the database
  const user = db.Users.find(
    (u: any) => u.username.toLowerCase() === username.toLowerCase()
  );

  if (!user || user.password_hash !== simulateHash(password)) {
    return res.status(401).json({ status: "error", message: "Username atau Password salah" });
  }

  if (user.status_aktif !== "AKTIF") {
    return res.status(403).json({ status: "error", message: "Akun Anda dinonaktifkan" });
  }

  // Record audit log
  addAuditLog(user.user_id, "LOGIN", `Pengguna '${user.nama_lengkap}' berhasil masuk.`, user.outlet_id_home);

  const session = {
    user_id: user.user_id,
    username: user.username,
    role: user.role,
    outlet_id_home: user.outlet_id_home,
    nama_lengkap: user.nama_lengkap
  };

  return res.json({ status: "success", message: "Login berhasil", data: session });
});

// 2. GET OUTLETS API

app.post("/api/updateSettingsOutlet", (req, res) => {
  const { user_id, outlets } = req.body;
  const db = readDb();
  
  const user = db.Users.find((u: any) => u.user_id === user_id);
  if (!user || user.role !== "OWNER") {
    return res.status(403).json({ status: "error", message: "Akses ditolak" });
  }

  if (Array.isArray(outlets)) {
    outlets.forEach(newOutlet => {
      const idx = db.Outlets.findIndex((o: any) => o.outlet_id === newOutlet.outlet_id);
      if (idx !== -1) {
        // Updated with new fields
        db.Outlets[idx] = { ...db.Outlets[idx], ...newOutlet };
      }
    });
    writeDb(db);
    return res.json({ status: "success", message: "Pengaturan berhasil disimpan" });
  }

  return res.status(400).json({ status: "error", message: "Data tidak valid" });
});

app.post("/api/testDriveConnection", (req, res) => {
  const { folderId } = req.body;
  if (!folderId || folderId.length < 10) {
    return res.json({ status: "error", message: "Folder ID invalid" });
  }
  
  // Simulate checking drive validation
  setTimeout(() => {
    res.json({ status: "success", message: "Folder ID valid" });
  }, 500);
});

app.post("/api/changePassword", (req, res) => {
  const { user_id, old_password, new_password } = req.body;
  const db = readDb();
  const user = db.Users.find((u: any) => u.user_id === user_id);
  if (!user) return res.json({ status: "error", message: "User tidak ditemukan" });
  
  // Note: in a real app, verify hash. We just check prefix/exact match for mock purposes.
  // Actually, since mock hashing was just "hash_" + password, we do a simple check.
  const oldHash = old_password.startsWith("hash_") ? old_password : "hash_" + old_password;
  if (user.password_hash !== oldHash && user.password_hash !== old_password) {
    return res.json({ status: "error", message: "Kata sandi lama salah" });
  }

  user.password_hash = "hash_" + new_password;
  writeDb(db);
  return res.json({ status: "success", message: "Kata sandi berhasil diubah" });
});

app.post("/api/getAllSettings", (req, res) => {
  const db = readDb();
  // Return users (without hashes), outlets, and system settings
  const safeUsers = db.Users.map((u: any) => {
    const { password_hash, ...rest } = u;
    return rest;
  });
  res.json({
    status: "success",
    data: {
      users: safeUsers,
      outlets: db.Outlets,
      systemSettings: db.SystemSettings || initialDb.SystemSettings
    }
  });
});

app.post("/api/saveAllSettings", (req, res) => {
  const { user_id, users, outlets, systemSettings } = req.body;
  const db = readDb();
  
  const caller = db.Users.find((u: any) => u.user_id === user_id);
  if (!caller) {
    return res.status(403).json({ status: "error", message: "Akses ditolak" });
  }
  
  const isOwner = caller.role === "OWNER";

  // Update Outlets (Owner only)
  if (isOwner && Array.isArray(outlets)) {
    outlets.forEach((newOutlet: any) => {
      const idx = db.Outlets.findIndex((o: any) => o.outlet_id === newOutlet.outlet_id);
      if (idx !== -1) {
        db.Outlets[idx] = { ...db.Outlets[idx], ...newOutlet };
      } else {
        db.Outlets.push(newOutlet);
      }
    });
  }

  // Update System Settings (Owner only)
  if (isOwner && systemSettings) {
    db.SystemSettings = { ...db.SystemSettings, ...systemSettings };
  }

  // Update Users (Admin can only update own password/WA. Owner can update all)
  if (Array.isArray(users)) {
    users.forEach((updatedUser: any) => {
      const idx = db.Users.findIndex((u: any) => u.user_id === updatedUser.user_id);
      if (idx !== -1) {
        if (isOwner) {
          // Owner can update anything
          db.Users[idx] = { ...db.Users[idx], ...updatedUser };
          // Keep password if not changed in frontend, frontend should not send it if empty
        } else {
          // Admin can only update themselves, and only no_wa / password
          if (updatedUser.user_id === caller.user_id) {
            if (updatedUser.no_wa !== undefined) db.Users[idx].no_wa = updatedUser.no_wa;
            if (updatedUser.password_hash) db.Users[idx].password_hash = updatedUser.password_hash;
          }
        }
      } else if (isOwner) {
        db.Users.push(updatedUser);
      }
    });
  }

  writeDb(db);
  return res.json({ status: "success", message: "Konfigurasi berhasil disimpan" });
});

app.get("/api/getOutlets", (req, res) => {
  const db = readDb();
  res.json({ status: "success", data: db.Outlets });
});
app.get("/api/outlets", (req, res) => {
  const db = readDb();
  res.json({ status: "success", data: db.Outlets });
});

// 3. GET ACTIVE USERS API
app.get("/api/getUsers", (req, res) => {
  const db = readDb();
  res.json({ status: "success", data: db.Users.filter((u: any) => u.status_aktif === "AKTIF") });
});
app.get("/api/users", (req, res) => {
  const db = readDb();
  res.json({ status: "success", data: db.Users.filter((u: any) => u.status_aktif === "AKTIF") });
});

// 3.5. GET ALL CUSTOMERS
app.post("/api/getCustomers", (req, res) => {
  const db = readDb();
  
  // Aggregate transactions to calculate "Jumlah Pengiriman", "Tanggal Terakhir Kirim", and "Tanggal Pertama Kirim"
  const preInputs = db.PreInput_Backup || [];
  const transExp = db.EXP_Resi || [];
  const transCrg = db.CRG_Resi || [];

  const customerStats = new Map<string, { total: number, first_date: string, last_date: string }>();

  // Map pre-inputs by hp_pengirim
  preInputs.forEach((pi: any) => {
    if (!pi.hp_pengirim) return;
    const hp = pi.hp_pengirim;
    const dateStr = pi.timestamp;
    if (!customerStats.has(hp)) {
      customerStats.set(hp, { total: 0, first_date: dateStr, last_date: dateStr });
    }
    const stat = customerStats.get(hp)!;
    stat.total += 1;
    if (new Date(dateStr) < new Date(stat.first_date)) stat.first_date = dateStr;
    if (new Date(dateStr) > new Date(stat.last_date)) stat.last_date = dateStr;
  });

  const customers = db.Master_Customer.map((c: any) => {
    const stats = customerStats.get(c.no_hp) || { total: 0, first_date: c.last_updated, last_date: c.last_updated };
    
    // Determine status: Baru (first sent within 7 days), Tidak Aktif (no send in 30 days), Aktif
    const now = new Date();
    const lastDate = new Date(stats.last_date || c.last_updated);
    const firstDate = new Date(stats.first_date || c.last_updated);
    
    const daysSinceLast = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysSinceFirst = Math.floor((now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

    let status = "Aktif";
    if (daysSinceLast > 30) {
      status = "Tidak Aktif";
    } else if (daysSinceFirst <= 7) {
      status = "Baru";
    }

    return {
      ...c,
      total_pengiriman: stats.total,
      tanggal_pertama_kirim: stats.first_date,
      tanggal_terakhir_kirim: stats.last_date,
      status
    };
  });
  
  return res.json({ status: "success", data: customers });
});

// 3.6. GET CUSTOMER HISTORY
app.post("/api/getCustomerHistory", (req, res) => {
  const { hp_pengirim } = req.body;
  if (!hp_pengirim) return res.json({ status: "success", data: [] });

  const db = readDb();
  
  // Find all PreInputs for this customer
  const preInputs = (db.PreInput_Backup || []).filter((pi: any) => pi.hp_pengirim === hp_pengirim);
  
  // Join with EXP_Resi and CRG_Resi
  const history = preInputs.map((pi: any) => {
    const exp = (db.EXP_Resi || []).find((e: any) => e.transaksi_id === pi.transaksi_id);
    const crg = (db.CRG_Resi || []).find((c: any) => c.transaksi_id === pi.transaksi_id);
    const resi = exp || crg;
    
    return {
      tanggal: pi.timestamp,
      no_resi: resi ? resi.resi_id : "-",
      tipe: exp ? "Express" : (crg ? "Cargo" : "-"),
      biaya: resi ? resi.total_dibayar_customer : 0,
      status: pi.status
    };
  }).sort((a: any, b: any) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

  return res.json({ status: "success", data: history });
});

// 3.7. GET BUKU PENGIRIM
app.post("/api/getBukuPengirim", (req, res) => {
  const { search } = req.body || {};
  const db = readDb();
  let list = db.MASTER_PENGIRIM || [];

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter((p: any) => 
      (p.nama || "").toLowerCase().includes(q) ||
      (p.telepon || "").toLowerCase().includes(q) ||
      (p.alamat || "").toLowerCase().includes(q)
    );
  }

  list = [...list].sort((a: any, b: any) => 
    new Date(b.tanggal_terakhir || 0).getTime() - new Date(a.tanggal_terakhir || 0).getTime()
  );

  return res.json({ status: "success", data: list });
});

// 3.8. GET BUKU PENERIMA
app.post("/api/getBukuPenerima", (req, res) => {
  const { search } = req.body || {};
  const db = readDb();
  let list = db.MASTER_PENERIMA || [];

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter((r: any) => 
      (r.nama || "").toLowerCase().includes(q) ||
      (r.telepon || "").toLowerCase().includes(q) ||
      (r.alamat || "").toLowerCase().includes(q)
    );
  }

  list = [...list].sort((a: any, b: any) => 
    new Date(b.tanggal_terakhir || 0).getTime() - new Date(a.tanggal_terakhir || 0).getTime()
  );

  return res.json({ status: "success", data: list });
});

// 3.9. GET CUSTOMERS MASTER
app.post("/api/getCustomersMaster", (req, res) => {
  const db = readDb();
  const customers = db.MASTER_CUSTOMER || [];
  const preInputs = db.PreInput_Backup || [];
  const expResi = db.EXP_Resi || [];
  const crgResi = db.CRG_Resi || [];
  const mapsReviews = db.MapsReviews || [];

  const statsMap = new Map<string, {
    total_resi: number;
    total_paket: number;
    total_ongkir: number;
    total_omzet: number;
    first_date: string;
    last_date: string;
    outlet_ids: Set<string>;
  }>();

  preInputs.forEach((pi: any) => {
    const hpNorm = normalizePhone(pi.hp_pengirim);
    if (!hpNorm) return;
    const exp = expResi.find((e: any) => e.transaksi_id === pi.transaksi_id);
    const crg = crgResi.find((c: any) => c.transaksi_id === pi.transaksi_id);
    const resi = exp || crg;

    const dateStr = pi.timestamp || new Date().toISOString();
    if (!statsMap.has(hpNorm)) {
      statsMap.set(hpNorm, {
        total_resi: 0,
        total_paket: 0,
        total_ongkir: 0,
        total_omzet: 0,
        first_date: dateStr,
        last_date: dateStr,
        outlet_ids: new Set()
      });
    }

    const st = statsMap.get(hpNorm)!;
    st.total_paket += 1;
    if (pi.outlet_id_tugas) st.outlet_ids.add(pi.outlet_id_tugas);
    if (resi) {
      st.total_resi += 1;
      st.total_ongkir += (resi.ongkir_dasar || 0);
      st.total_omzet += (resi.grand_total || resi.total_dibayar_customer || 0);
    }
    if (new Date(dateStr) < new Date(st.first_date)) st.first_date = dateStr;
    if (new Date(dateStr) > new Date(st.last_date)) st.last_date = dateStr;
  });

  const data = customers.map((c: any) => {
    const hp = (c.telepon || c.no_hp || "").trim();
    const hpNorm = normalizePhone(hp);
    const st = statsMap.get(hpNorm) || {
      total_resi: 0,
      total_paket: 0,
      total_ongkir: 0,
      total_omzet: 0,
      first_date: c.created_at || new Date().toISOString(),
      last_date: c.updated_at || new Date().toISOString(),
      outlet_ids: new Set()
    };

    const hasReview = mapsReviews.some((mr: any) => 
      (mr.author_name || "").toLowerCase().includes((c.nama || c.nama_pengirim || "").toLowerCase()) ||
      (mr.text || "").toLowerCase().includes((c.nama || c.nama_pengirim || "").toLowerCase())
    );

    return {
      customer_id: c.customer_id,
      nama: c.nama || c.nama_pengirim || "Customer",
      telepon: hp,
      created_at: c.created_at || st.first_date,
      updated_at: c.updated_at || st.last_date,
      status: c.status || "AKTIF",
      total_resi: st.total_resi,
      total_paket: st.total_paket,
      total_ongkir: st.total_ongkir,
      total_omzet: st.total_omzet,
      customer_sejak: st.first_date,
      last_shipment: st.last_date,
      maps_review_status: hasReview ? "Contributor" : "Belum Review",
      outlet_id: Array.from(st.outlet_ids)[0] || c.outlet_id || "OUT-001"
    };
  });

  data.sort((a: any, b: any) => new Date(b.last_shipment).getTime() - new Date(a.last_shipment).getTime());

  return res.json({ status: "success", data });
});

// 3.10. GET CUSTOMER DETAIL FULL (ANALYTICS & ADDRESSES)
app.post("/api/getCustomerDetailFull", (req, res) => {
  const { customer_id, telepon } = req.body || {};
  const db = readDb();
  const customers = db.MASTER_CUSTOMER || [];
  const senders = db.MASTER_PENGIRIM || [];
  const receivers = db.MASTER_PENERIMA || [];
  const preInputs = db.PreInput_Backup || [];
  const expResi = db.EXP_Resi || [];
  const crgResi = db.CRG_Resi || [];
  const mapsReviews = db.MapsReviews || [];

  const searchPhoneNorm = normalizePhone(telepon);
  let customer = customers.find((c: any) => 
    (customer_id && c.customer_id === customer_id) || 
    (searchPhoneNorm && normalizePhone(c.telepon || c.no_hp) === searchPhoneNorm)
  );

  if (!customer && telepon) {
    customer = {
      customer_id: customer_id || "CUS-UNKNOWN",
      nama: "Customer",
      telepon: telepon,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: "AKTIF"
    };
  } else if (!customer) {
    return res.status(404).json({ status: "error", message: "Customer tidak ditemukan" });
  }

  const phone = (customer.telepon || customer.no_hp || "").trim();
  const phoneNorm = normalizePhone(phone);
  const cId = customer.customer_id;

  const pengirim_addresses = senders.filter((s: any) => s.customer_id === cId || normalizePhone(s.telepon) === phoneNorm);
  const penerima_addresses = receivers.filter((r: any) => r.customer_id === cId || normalizePhone(r.telepon) === phoneNorm);

  const custPreInputs = preInputs.filter((pi: any) => normalizePhone(pi.hp_pengirim) === phoneNorm);

  let totalResi = 0;
  let totalPaket = custPreInputs.length;
  let totalOngkir = 0;
  let totalOmzet = 0;
  let totalBerat = 0;
  let firstDate = custPreInputs.length > 0 ? custPreInputs[0].timestamp : (customer.created_at || new Date().toISOString());
  let lastDate = custPreInputs.length > 0 ? custPreInputs[0].timestamp : (customer.updated_at || new Date().toISOString());

  const barangFreq: Record<string, number> = {};
  const destFreq: Record<string, number> = {};
  const dayFreq: Record<string, number> = {};
  const hourFreq: Record<string, number> = {};
  let expressCount = 0;
  let cargoCount = 0;

  const riwayat_pengiriman = custPreInputs.map((pi: any) => {
    const exp = expResi.find((e: any) => e.transaksi_id === pi.transaksi_id);
    const crg = crgResi.find((c: any) => c.transaksi_id === pi.transaksi_id);
    const resi = exp || crg;

    const dateObj = new Date(pi.timestamp);
    const dateStr = pi.timestamp;

    if (new Date(dateStr) < new Date(firstDate)) firstDate = dateStr;
    if (new Date(dateStr) > new Date(lastDate)) lastDate = dateStr;

    totalBerat += (Number(pi.berat_timbangan) || Number(pi.berat_kg) || 0);

    if (pi.nama_barang) {
      const bg = pi.nama_barang.trim();
      barangFreq[bg] = (barangFreq[bg] || 0) + 1;
    }
    if (pi.alamat_penerima) {
      const dest = pi.alamat_penerima.split(",").pop()?.trim() || pi.alamat_penerima.trim();
      destFreq[dest] = (destFreq[dest] || 0) + 1;
    }
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const dayName = dayNames[dateObj.getDay()];
    dayFreq[dayName] = (dayFreq[dayName] || 0) + 1;

    const hour = dateObj.getHours();
    const hourLabel = `${String(hour).padStart(2, '0')}:00 - ${String((hour + 1) % 24).padStart(2, '0')}:00`;
    hourFreq[hourLabel] = (hourFreq[hourLabel] || 0) + 1;

    let resiId = "-";
    let layanan = "-";
    let jenisProduk = "-";
    let totalBayar = 0;
    let admin = pi.admin_id || "SYSTEM";

    if (exp) {
      expressCount++;
      totalResi++;
      resiId = exp.resi_id;
      layanan = "Express";
      jenisProduk = exp.tipe_produk;
      totalBayar = exp.grand_total || exp.total_dibayar_customer;
      totalOngkir += (exp.ongkir_dasar || 0);
      totalOmzet += totalBayar;
      if (exp.admin_id_pencatat) admin = exp.admin_id_pencatat;
    } else if (crg) {
      cargoCount++;
      totalResi++;
      resiId = crg.resi_id;
      layanan = "Cargo";
      jenisProduk = crg.tipe_produk;
      totalBayar = crg.grand_total || crg.total_dibayar_customer;
      totalOngkir += (crg.ongkir_dasar || 0);
      totalOmzet += totalBayar;
      if (crg.admin_id_pencatat) admin = crg.admin_id_pencatat;
    }

    return {
      tanggal: pi.timestamp,
      no_resi: resiId,
      layanan: layanan,
      jenis_produk: jenisProduk,
      nama_barang: pi.nama_barang,
      berat_timbangan: pi.berat_timbangan,
      berat_penagihan: pi.berat_kg,
      dasar_berat: pi.dasar_berat || "TIMBANGAN",
      volume: pi.volume,
      total_bayar: totalBayar,
      status: pi.status,
      admin: admin
    };
  }).sort((a: any, b: any) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

  const getMostFrequent = (obj: Record<string, number>) => {
    let maxK = "-";
    let maxV = 0;
    Object.entries(obj).forEach(([k, v]) => {
      if (v > maxV) {
        maxV = v;
        maxK = k;
      }
    });
    return maxK;
  };

  const hasReview = mapsReviews.some((mr: any) => 
    (mr.author_name || "").toLowerCase().includes((customer.nama || customer.nama_pengirim || "").toLowerCase()) ||
    (mr.text || "").toLowerCase().includes((customer.nama || customer.nama_pengirim || "").toLowerCase())
  );

  return res.json({
    status: "success",
    data: {
      customer: {
        ...customer,
        nama: customer.nama || customer.nama_pengirim || "Customer",
        telepon: phone
      },
      pengirim_addresses,
      penerima_addresses,
      summary: {
        customer_sejak: firstDate,
        total_resi: totalResi,
        total_paket: totalPaket,
        total_ongkir: totalOngkir,
        total_omzet: totalOmzet,
        last_shipment: lastDate,
        maps_review_status: hasReview ? "Contributor" : "Belum Review"
      },
      analytics: {
        total_transaksi: totalResi || totalPaket,
        total_paket: totalPaket,
        total_ongkir: totalOngkir,
        berat_rata_rata: totalPaket > 0 ? Number((totalBerat / totalPaket).toFixed(2)) : 0,
        layanan_favorit: expressCount >= cargoCount ? (expressCount > 0 ? "Express" : "N/A") : "Cargo",
        barang_paling_sering: getMostFrequent(barangFreq),
        kota_tujuan_terbanyak: getMostFrequent(destFreq),
        hari_pengiriman_terbanyak: getMostFrequent(dayFreq),
        jam_pengiriman_terbanyak: getMostFrequent(hourFreq)
      },
      riwayat_pengiriman
    }
  });
});

// 4. SEARCH CUSTOMER
app.post("/api/searchCustomer", (req, res) => {
  const { query, outlet_id } = req.body;
  const db = readDb();
  const searchQ = (query || "").toLowerCase().trim();

  if (!searchQ) {
    return res.json({ status: "success", data: [] });
  }

  // Filter customers by name or phone matching partial
  const matching = db.Master_Customer.filter(
    (c: any) =>
      c.nama_pengirim.toLowerCase().includes(searchQ) ||
      c.no_hp.includes(searchQ)
  );

  return res.json({ status: "success", data: matching });
});

// 5. GET RIWAYAT PENERIMA
app.post("/api/getRiwayatPenerima", (req, res) => {
  const { customer_id } = req.body;
  const db = readDb();

  if (!customer_id) {
    return res.json({ status: "success", data: [] });
  }

  const matching = db.Riwayat_Penerima.filter(
    (r: any) => r.customer_id === customer_id
  ).sort(
    (a: any, b: any) => new Date(b.tanggal_terakhir_kirim).getTime() - new Date(a.tanggal_terakhir_kirim).getTime()
  );

  return res.json({ status: "success", data: matching });
});

// 6. CHECK DUPLICATE RESI
app.post("/api/checkDuplicateResi", (req, res) => {
  const { resi_id } = req.body;
  if (!resi_id) {
    return res.json({ status: "success", isDuplicate: false });
  }

  const db = readDb();
  const rid = resi_id.trim().toUpperCase();

  const inExp = db.EXP_Resi.some((r: any) => r.resi_id.toUpperCase() === rid);
  const inCrg = db.CRG_Resi.some((r: any) => r.resi_id.toUpperCase() === rid);

  return res.json({ status: "success", isDuplicate: inExp || inCrg });
});

// 7. SAVE DATA PREINPUT
app.post("/api/saveDataPreInput", (req, res) => {
  const {
    admin_id,
    outlet_id_tugas,
    nama_pengirim,
    hp_pengirim,
    alamat_pengirim,
    nama_penerima,
    hp_penerima,
    alamat_penerima,
    alamat_penerima_asli,
    alamat_asli,
    catatan_admin,
    nama_barang,
    ekspedisi,
    berat_timbangan,
    panjang_cm,
    lebar_cm,
    tinggi_cm,
    berat_kg,
    volume,
    nilai_barang,
    foto_paket_url,
    foto_resi_url
  } = req.body;

  if (!nama_pengirim || !hp_pengirim || !alamat_pengirim || !nama_penerima || !hp_penerima || !alamat_penerima || !nama_barang) {
    return res.status(400).json({ status: "error", message: "Seluruh data pengirim, penerima, dan nama barang wajib diisi!" });
  }

  const db = readDb();
  const txId = "TRX-" + Math.floor(Date.now() / 1000);

  // 1. Save PreInput Backup record
  const newPreInput = {
    transaksi_id: txId,
    timestamp: new Date().toISOString(),
    admin_id: admin_id || "SYSTEM",
    outlet_id_tugas: outlet_id_tugas || "OUT-001",
    nama_pengirim,
    hp_pengirim,
    alamat_pengirim,
    nama_penerima,
    hp_penerima,
    alamat_penerima,
    alamat_penerima_asli: alamat_penerima_asli || alamat_asli || "",
    alamat_asli: alamat_asli || alamat_penerima_asli || "",
    catatan_admin: catatan_admin || "",
    nama_barang,
    ekspedisi: ekspedisi || "Express",
    berat_timbangan: Number(berat_timbangan) || 0,
    panjang_cm: Number(panjang_cm) || 0,
    lebar_cm: Number(lebar_cm) || 0,
    tinggi_cm: Number(tinggi_cm) || 0,
    berat_volume: Number(req.body.berat_volume) || 0,
    dasar_berat: "TIMBANGAN",
      berat_kg: Number(berat_kg) || 0,
    volume: volume || "0 x 0 x 0",
    nilai_barang: Number(nilai_barang) || 0,
    foto_paket_url: foto_paket_url || "",
    foto_resi_url: foto_resi_url || "",
    status: "PENDING" as const
  };
  db.PreInput_Backup.unshift(newPreInput);

  writeDb(db);

  // Audit Log
  addAuditLog(
    admin_id || "SYSTEM",
    "PREINPUT_SIMPAN",
    `Mencatat pre-input '${nama_pengirim}' ke '${nama_penerima}' (${txId})`,
    outlet_id_tugas || "OUT-001"
  );

  return res.json({
    status: "success",
    message: "Data pre-input berhasil disimpan!",
    data: { transaksi_id: txId, preInput: newPreInput }
  });
});

// 8. GET PREINPUT DETAILS
app.post("/api/getPreInput", (req, res) => {
  const { transaksi_id } = req.body;
  if (!transaksi_id) {
    return res.status(400).json({ status: "error", message: "transaksi_id wajib diberikan" });
  }

  const db = readDb();
  const pre = db.PreInput_Backup.find((p: any) => p.transaksi_id === transaksi_id);
  if (!pre) {
    return res.status(404).json({ status: "error", message: "Transaksi Pre-Input tidak ditemukan" });
  }

  return res.json({ status: "success", data: pre });
});

// 9. SAVE TRANSAKSI (EXP_Resi or CRG_Resi)
app.post("/api/saveTransaksi", (req, res) => {
  const { jenis_layanan, data } = req.body;
  if (!jenis_layanan || !data) {
    return res.status(400).json({ status: "error", message: "Data transaksi tidak lengkap" });
  }

  const db = readDb();

  // Double check duplicates to avoid bypass
  const rid = (data.resi_id || "").trim().toUpperCase();
  const inExp = db.EXP_Resi.some((r: any) => r.resi_id.toUpperCase() === rid);
  const inCrg = db.CRG_Resi.some((r: any) => r.resi_id.toUpperCase() === rid);
  if (inExp || inCrg) {
    return res.status(400).json({ status: "error", message: "RESI SUDAH TERDAFTAR — Kemungkinan duplikat/fraud" });
  }

  const timestamp = new Date().toISOString();

  if (jenis_layanan === "Express") {
    const newExp = {
      resi_id: rid,
      transaksi_id: data.transaksi_id || "",
      timestamp,
      admin_id_pencatat: data.admin_id_pencatat,
      outlet_id_input: data.outlet_id_input,
      tipe_produk: data.tipe_produk,
      ekspedisi: data.ekspedisi || "Express",
      berat_timbangan: Number(data.berat_timbangan) || 0,
      panjang_cm: Number(data.panjang_cm) || 0,
      lebar_cm: Number(data.lebar_cm) || 0,
      tinggi_cm: Number(data.tinggi_cm) || 0,
      berat_volume: Number(data.berat_volume) || 0,
      dasar_berat: data.dasar_berat || "TIMBANGAN",
      berat_kg: Number(data.berat_kg) || 0,
      volume: data.volume || "0 x 0 x 0",
      biaya_lain: Number(data.biaya_lain) || 0,
      biaya_asuransi: Number(data.biaya_asuransi) || 0,
      ongkir_dasar: Number(data.ongkir_dasar) || 0,
      biaya_yoyi: Number(data.biaya_yoyi) || 0,
      total_dibayar_customer: Number(data.total_dibayar_customer) || 0,
      pembulatan: Number(data.pembulatan) || 0,
      metode_bayar: data.metode_bayar,
      bukti_bayar_url: data.bukti_bayar_url || "",
      biaya_amplop: Number(data.biaya_amplop) || 0,
      biaya_packing: Number(data.biaya_packing) || 0,
      metode_bayar_tambahan: data.metode_bayar_tambahan || "",
      bukti_tambahan_url: data.bukti_tambahan_url || "",
      grand_total: Number(data.grand_total) || 0,
      setoran_ke_owner: Number(data.setoran_ke_owner) || 0,
      kas_operasional: Number(data.kas_operasional) || 0
    };
    db.EXP_Resi.unshift(newExp);
  } else if (jenis_layanan === "Cargo") {
    const newCrg = {
      resi_id: rid,
      transaksi_id: data.transaksi_id || "",
      timestamp,
      admin_id_pencatat: data.admin_id_pencatat,
      outlet_id_input: data.outlet_id_input,
      tipe_produk: data.tipe_produk,
      ekspedisi: data.ekspedisi || "Cargo",
      berat_timbangan: Number(data.berat_timbangan) || 0,
      panjang_cm: Number(data.panjang_cm) || 0,
      lebar_cm: Number(data.lebar_cm) || 0,
      tinggi_cm: Number(data.tinggi_cm) || 0,
      berat_volume: Number(data.berat_volume) || 0,
      dasar_berat: data.dasar_berat || "TIMBANGAN",
      volume: data.volume || "0 x 0 x 0",
      merk_motor: data.merk_motor || "",
      cc_motor: Number(data.cc_motor) || 0,
      tahun_motor: Number(data.tahun_motor) || 0,
      kelengkapan_motor: data.kelengkapan_motor || "",
      biaya_asuransi: Number(data.biaya_asuransi) || 0,
      ongkir_dasar: Number(data.ongkir_dasar) || 0,
      biaya_jtc: Number(data.biaya_jtc) || 0,
      total_dibayar_customer: Number(data.total_dibayar_customer) || 0,
      pembulatan: Number(data.pembulatan) || 0,
      metode_bayar: data.metode_bayar,
      bukti_bayar_url: data.bukti_bayar_url || "",
      biaya_amplop: Number(data.biaya_amplop) || 0,
      biaya_packing: Number(data.biaya_packing) || 0,
      metode_bayar_tambahan: data.metode_bayar_tambahan || "",
      bukti_tambahan_url: data.bukti_tambahan_url || "",
      grand_total: Number(data.grand_total) || 0,
      setoran_ke_owner: Number(data.setoran_ke_owner) || 0,
      kas_operasional: Number(data.kas_operasional) || 0
    };
    db.CRG_Resi.unshift(newCrg);
  } else {
    return res.status(400).json({ status: "error", message: "Jenis layanan tidak valid" });
  }

  // Update PreInput_Backup status to SELESAI if transaction_id was pending
  let pre = null;
  if (data.transaksi_id) {
    pre = db.PreInput_Backup.find((p: any) => p.transaksi_id === data.transaksi_id);
    if (pre) {
      pre.status = "SELESAI";
    }
  }

  // Trigger Auto Upsert for Customer Master & Address Book (ONLY AFTER TRANSACTION IS SAVED)
  const senderName = pre?.nama_pengirim || data.nama_pengirim || "";
  const senderHp = pre?.hp_pengirim || data.hp_pengirim || "";
  const senderAddr = pre?.alamat_pengirim || data.alamat_pengirim || "";
  const recName = pre?.nama_penerima || data.nama_penerima || "";
  const recHp = pre?.hp_penerima || data.hp_penerima || "";
  const recAddr = pre?.alamat_penerima || data.alamat_penerima || "";

  if (senderHp || recHp) {
    autoUpsertCustomerAndAddressBook(db, {
      nama_pengirim: senderName,
      hp_pengirim: senderHp,
      alamat_pengirim: senderAddr,
      nama_penerima: recName,
      hp_penerima: recHp,
      alamat_penerima: recAddr,
      timestamp
    });
  }

  writeDb(db);

  // Audit Log
  addAuditLog(
    data.admin_id_pencatat,
    "TRANSAKSI_SIMPAN",
    `Simpan resi ${jenis_layanan} '${rid}' (${data.tipe_produk}). Grand Total: Rp ${Number(data.grand_total).toLocaleString("id-ID")}`,
    data.outlet_id_input
  );

  return res.json({
    status: "success",
    message: `Transaksi resi ${jenis_layanan} berhasil disimpan!`,
    data: { resi_id: rid }
  });
});

// 10. AI ADDRESS CORRECTION (GEMINI)
app.post("/api/perbaikiAlamatAI", async (req, res) => {
  const { alamat } = req.body;
  if (!alamat || alamat.trim().length === 0) {
    return res.status(400).json({ status: "error", message: "Teks alamat tidak boleh kosong!" });
  }

  try {
    const ai = getGeminiClient();
    const prompt = `Rapikan alamat berikut: "${alamat}"`;
    
    // According to Gemini-API guidelines, we use ai.models.generateContent
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: GEM_ALAMAT_SYSTEM_INSTRUCTION,
        temperature: 0.1, // lower temperature to make sure it doesn't invent details
      }
    });

    const result = response.text?.trim() || alamat;
    return res.json({ status: "success", data: result });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    // Custom friendly message for rate limits or other common errors
    let userMsg = "Gagal memproses perbaikan alamat via AI.";
    if (error.status === 429 || error.message?.includes("RESOURCE_EXHAUSTED") || error.message?.includes("Quota")) {
      userMsg = "Kuota AI gratis harian sudah tercapai, coba lagi beberapa saat lagi atau isi manual.";
    } else if (error.message?.includes("API key")) {
      userMsg = "API Key Gemini belum disetting di workspace. Silakan isi manual atau configure di Settings > Secrets.";
    } else {
      userMsg = `Terjadi kesalahan AI: ${error.message || "Unknown error"}. Silakan isi/rapikan manual.`;
    }

    return res.status(200).json({ status: "error", message: userMsg, data: alamat });
  }
});

// 10.5 AI RESI PHOTO ANALYSIS & EXTRACT (GEMINI)
app.post("/api/analyzeResiPhoto", async (req, res) => {
  const { fileBase64, fileUrl } = req.body;
  if (!fileBase64 && !fileUrl) {
    return res.status(400).json({ status: "error", message: "Foto resi (base64 atau fileUrl) wajib disertakan!" });
  }

  try {
    let base64Data = "";
    let mimeType = "image/jpeg";

    if (fileBase64) {
      const matches = fileBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        base64Data = matches[2];
      } else {
        base64Data = fileBase64;
      }
    } else if (fileUrl) {
      const filename = path.basename(fileUrl);
      const localFilePath = path.join(uploadsDir, filename);
      if (fs.existsSync(localFilePath)) {
        const fileBuffer = fs.readFileSync(localFilePath);
        base64Data = fileBuffer.toString("base64");
        if (filename.toLowerCase().endsWith(".png")) mimeType = "image/png";
        else if (filename.toLowerCase().endsWith(".gif")) mimeType = "image/gif";
      } else {
        return res.status(404).json({ status: "error", message: "File resi tidak ditemukan di server" });
      }
    }

    const ai = getGeminiClient();
    const systemInstruction = 
      "Kamu adalah 'AI Barcode & Data Paket Extractor'. Tugasmu adalah membaca foto resi fisik/resi kertas pengiriman J&T (Express atau Cargo) " +
      "dan mengekstrak data dari teks di foto tersebut.\n" +
      "Tugasmu:\n" +
      "1. Cari nomor resi J&T (biasanya 12 digit angka, atau diawali JT/JTC/JP/etc. diikuti angka, atau barcode ID). Masukkan ke 'resi_id'. Jika tidak yakin atau tidak ada, kosongkan atau biarkan null.\n" +
      "2. Ekstrak data Pengirim: nama, nomor HP/telepon, dan alamat lengkap. Masukkan ke 'nama_pengirim', 'hp_pengirim', 'alamat_pengirim'.\n" +
      "3. Ekstrak data Penerima: nama, nomor HP/telepon, dan alamat lengkap. Masukkan ke 'nama_penerima', 'hp_penerima', 'alamat_penerima'.\n" +
      "4. Ekstrak nama barang/paket bila tertulis di kertas resi. Masukkan ke 'nama_barang'.\n" +
      "Perhatikan: Jangan mengada-ada informasi. Jika informasi tertentu tidak ditemukan, kembalikan string kosong atau null.";

    const imagePart = {
      inlineData: {
        mimeType,
        data: base64Data
      }
    };
    const textPart = {
      text: "Silakan analisis foto resi ini dan ekstrak seluruh data paket & resi_id."
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            resi_id: { type: Type.STRING },
            nama_pengirim: { type: Type.STRING },
            hp_pengirim: { type: Type.STRING },
            alamat_pengirim: { type: Type.STRING },
            nama_penerima: { type: Type.STRING },
            hp_penerima: { type: Type.STRING },
            alamat_penerima: { type: Type.STRING },
            nama_barang: { type: Type.STRING }
          }
        }
      }
    });

    const resultText = response.text?.trim() || "{}";
    const extractedData = JSON.parse(resultText);
    return res.json({ status: "success", data: extractedData });
  } catch (error: any) {
    console.error("Gemini API Analyze Error:", error);
    let userMsg = "Gagal memproses analisis foto resi via AI.";
    if (error.status === 429 || error.message?.includes("RESOURCE_EXHAUSTED") || error.message?.includes("Quota")) {
      userMsg = "Kuota AI gratis harian sudah tercapai, coba lagi beberapa saat lagi atau isi manual.";
    } else if (error.message?.includes("API key")) {
      userMsg = "API Key Gemini belum disetting di workspace. Silakan isi manual.";
    } else {
      userMsg = `Terjadi kesalahan AI: ${error.message || "Unknown error"}. Silakan isi manual.`;
    }
    return res.status(200).json({ status: "error", message: userMsg });
  }
});

// 11. UPLOAD FILE (BASE64)
app.post("/api/uploadFile", (req, res) => {
  const { fileBase64, fileName, category } = req.body;
  if (!fileBase64) {
    return res.status(400).json({ status: "error", message: "File data (base64) tidak boleh kosong" });
  }

  const db = readDb();
  const sysConfig = db.SystemSettings || initialDb.SystemSettings;
  
  // Mapping category to Google Drive folder config (simulated for Local File System)
  let targetFolderId = "";
  switch (category) {
    case "BUKTI_BAYAR": targetFolderId = sysConfig.folder_bukti_bayar_customer || ""; break;
    case "FOTO_PAKET": targetFolderId = sysConfig.folder_foto_paket || ""; break;
    case "FOTO_RESI": targetFolderId = sysConfig.folder_foto_resi || ""; break;
    case "KAS_MASUK": targetFolderId = sysConfig.folder_bukti_kas_masuk || ""; break;
    case "KAS_KELUAR": targetFolderId = sysConfig.folder_bukti_kas_keluar || ""; break;
    case "BUKTI_ADD": targetFolderId = sysConfig.folder_bukti_bayar_customer || ""; break;
    default: targetFolderId = "";
  }
  
  // Requirement: Hardcode folder ID is not allowed. We simulate reading from DB config here.
  // In a real environment (Apps Script), we would use GoogleDriveApp.getFolderById(targetFolderId).

  try {
    // Extract format and data
    const matches = fileBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let ext = "png";
    let buffer;

    if (matches && matches.length === 3) {
      const mime = matches[1];
      if (mime.includes("jpeg") || mime.includes("jpg")) ext = "jpg";
      else if (mime.includes("gif")) ext = "gif";
      buffer = Buffer.from(matches[2], "base64");
    } else {
      // Direct base64 string
      buffer = Buffer.from(fileBase64, "base64");
    }

    const uniqueId = String(Date.now());
    const finalFileName = `${category || "DOC"}_${uniqueId}_${fileName || "file"}.${ext}`;
    const filePath = path.join(uploadsDir, finalFileName);

    fs.writeFileSync(filePath, buffer);

    // Return the accessible local url
    const fileUrl = `/uploads/${finalFileName}`;
    return res.json({ status: "success", data: fileUrl, message: "Upload berhasil!" });
  } catch (err: any) {
    console.error("File upload error:", err);
    return res.status(500).json({ status: "error", message: "Gagal menyimpan file: " + err.message });
  }
});

// 11.5 INIT DATABASE SHEETS (SEED)
app.post("/api/initDatabaseSheets", (req, res) => {
  try {
    const dbToSave = { ...initialDb, MapsReviews: defaultReviews };
    writeDb(dbToSave);
    return res.json({ status: "success", message: "Database re-seeded successfully." });
  } catch (error: any) {
    console.error("Error seeding database:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
});


// 12.5 GET ADMIN DASHBOARD DATA

// --- DASHBOARD HELPERS ---
function getCombinedTransactions(db: any) {
  const combined: any[] = [];
  db.EXP_Resi.forEach((r: any) => {
    if (r.status !== "BATAL") {
      combined.push({
        ...r,
        tipe_layanan: "Express",
        pengirim: db.PreInput_Backup?.find((p: any) => p.transaksi_id === r.transaksi_id)?.nama_pengirim || "Umum",
        penerima: db.PreInput_Backup?.find((p: any) => p.transaksi_id === r.transaksi_id)?.nama_penerima || "Umum",
      });
    }
  });
  db.CRG_Resi.forEach((r: any) => {
    if (r.status !== "BATAL") {
      combined.push({
        ...r,
        tipe_layanan: "Cargo",
        pengirim: db.PreInput_Backup?.find((p: any) => p.transaksi_id === r.transaksi_id)?.nama_pengirim || "Umum",
        penerima: db.PreInput_Backup?.find((p: any) => p.transaksi_id === r.transaksi_id)?.nama_penerima || "Umum",
      });
    }
  });
  return combined;
}

function filterTransactions(combined: any[], filterOutlet: string, dateStart?: string, dateEnd?: string, filterTipeLayanan?: string) {
  let filtered = combined;
  if (filterOutlet && filterOutlet !== "ALL") {
    filtered = filtered.filter((r: any) => r.outlet_id_input === filterOutlet);
  }
  if (filterTipeLayanan && filterTipeLayanan !== "ALL") {
    filtered = filtered.filter((r: any) => r.tipe_layanan === filterTipeLayanan);
  }
  if (dateStart) {
    const start = new Date(dateStart).getTime();
    filtered = filtered.filter((r: any) => new Date(r.timestamp).getTime() >= start);
  }
  if (dateEnd) {
    const end = new Date(dateEnd).getTime() + 86400000;
    filtered = filtered.filter((r: any) => new Date(r.timestamp).getTime() <= end);
  }
  return filtered;
}

function calculateDashboardSummary(filtered: any[]) {
  const totalTransaksi = filtered.length;
  const totalResiExpress = filtered.filter((r: any) => r.tipe_layanan === "Express").length;
  const totalResiCargo = filtered.filter((r: any) => r.tipe_layanan === "Cargo").length;
  const totalOmsetGlobal = filtered.reduce((sum: number, r: any) => sum + (r.grand_total || 0), 0);
  const totalSetoranOwner = filtered.reduce((sum: number, r: any) => sum + (r.setoran_ke_owner || 0), 0);
  const totalKasOperasional = filtered.reduce((sum: number, r: any) => sum + (r.kas_operasional || 0), 0);
  
  return {
    totalTransaksi,
    totalResiExpress,
    totalResiCargo,
    grandTotalCustomer: totalOmsetGlobal,
    total_omset: totalOmsetGlobal,
    totalWajibSetorOwner: totalSetoranOwner,
    total_setoran_owner: totalSetoranOwner,
    totalKasOutlet: totalKasOperasional,
    total_kas_operasional: totalKasOperasional,
    total_transaksi: totalTransaksi
  };
}

function calculateByAdmin(filtered: any[], users: any[]) {
  const adminMap: Record<string, any> = {};
  filtered.forEach((r: any) => {
    const admin = r.admin_id_pencatat;
    if (!adminMap[admin]) {
      const user = users.find((u: any) => u.user_id === admin);
      adminMap[admin] = {
        admin_id: admin,
        nama: user ? user.nama_lengkap : admin,
        express: 0,
        cargo: 0,
        totalResi: 0,
        totalSetoranOwner: 0,
        kasOutlet: 0
      };
    }
    if (r.tipe_layanan === "Express") adminMap[admin].express++;
    if (r.tipe_layanan === "Cargo") adminMap[admin].cargo++;
    adminMap[admin].totalResi++;
    adminMap[admin].totalSetoranOwner += r.setoran_ke_owner || 0;
    adminMap[admin].kasOutlet += r.kas_operasional || 0;
  });
  return Object.values(adminMap).sort((a: any, b: any) => b.totalResi - a.totalResi);
}

function calculateByEkspedisi(filtered: any[]) {
  const totalResiExpress = filtered.filter((r: any) => r.tipe_layanan === "Express").length;
  const totalResiCargo = filtered.filter((r: any) => r.tipe_layanan === "Cargo").length;
  return {
    Express: {
      resi: totalResiExpress,
      omset: filtered.filter((r: any) => r.tipe_layanan === "Express").reduce((sum: number, r: any) => sum + (r.grand_total || 0), 0),
      setoran: filtered.filter((r: any) => r.tipe_layanan === "Express").reduce((sum: number, r: any) => sum + (r.setoran_ke_owner || 0), 0),
    },
    Cargo: {
      resi: totalResiCargo,
      omset: filtered.filter((r: any) => r.tipe_layanan === "Cargo").reduce((sum: number, r: any) => sum + (r.grand_total || 0), 0),
      setoran: filtered.filter((r: any) => r.tipe_layanan === "Cargo").reduce((sum: number, r: any) => sum + (r.setoran_ke_owner || 0), 0),
    }
  };
}

function calculateGrafik(combined: any[], filterOutlet: string) {
  const last7Days: any[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    let dayTotalResi = 0;
    let daySetoran = 0;
    combined.forEach((r: any) => {
      if (r.timestamp.startsWith(dateStr) && (!filterOutlet || filterOutlet === "ALL" || r.outlet_id_input === filterOutlet)) {
        dayTotalResi++;
        daySetoran += r.setoran_ke_owner || 0;
      }
    });
    last7Days.push({
      date: dateStr,
      resi: dayTotalResi,
      setoran: daySetoran
    });
  }
  return last7Days;
}

function calculateStatusSetoran(filtered: any[], dbSetoranData: any[], filterOutlet: string) {
  const setoranMap: Record<string, any> = {};
  filtered.forEach((r: any) => {
    const dateStr = r.timestamp.split("T")[0];
    if (!setoranMap[dateStr]) {
      const existing = (dbSetoranData || []).find((s:any) => s.date === dateStr && (!filterOutlet || filterOutlet === "ALL" || s.outlet_id === r.outlet_id_input || s.outlet_id === filterOutlet));
      setoranMap[dateStr] = {
        date: dateStr,
        total_setoran: 0,
        status: existing ? existing.status : "Belum Disetor",
        transaksi: []
      };
    }
    setoranMap[dateStr].total_setoran += r.setoran_ke_owner || 0;
    setoranMap[dateStr].transaksi.push(r.resi_id);
  });
  return Object.values(setoranMap).sort((a:any, b:any) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function calculateTargetHarian(combined: any[], filterOutlet: string, outlets: any[]) {
  const todayStr = new Date().toISOString().split("T")[0];
  const currentResiToday = combined.filter((r:any) => r.timestamp.startsWith(todayStr) && (!filterOutlet || filterOutlet === "ALL" || r.outlet_id_input === filterOutlet)).length;
  
  let targetTotal = 0;
  if (filterOutlet && filterOutlet !== "ALL") {
    const outlet = outlets.find((o: any) => o.outlet_id === filterOutlet);
    targetTotal = (outlet?.target_express || 0) + (outlet?.target_cargo || 0) || outlet?.target_resi_harian || 50;
  } else {
    targetTotal = outlets.reduce((sum: number, o: any) => sum + ((o.target_express || 0) + (o.target_cargo || 0) || o.target_resi_harian || 50), 0);
  }

  return {
    target: targetTotal,
    current: currentResiToday
  };
}
// --- END DASHBOARD HELPERS ---

app.post("/api/getAdminDashboardData", (req, res) => {
  try {
    const { user_id, role, filterOutlet, dateStart, dateEnd } = req.body;

    if (role !== "ADMIN" && role !== "OWNER") {
      return res.status(403).json({ status: "error", message: "Akses ditolak." });
    }

    const db = readDb();
    
    // Safely fallback undefined arrays to empty arrays to prevent crashes on Vercel old db.json cache
    db.EXP_Resi = db.EXP_Resi || [];
    db.CRG_Resi = db.CRG_Resi || [];
    db.PreInput_Backup = db.PreInput_Backup || [];
    db.Users = db.Users || [];
    db.Outlets = db.Outlets || [];
    db.AuditLogs = db.AuditLogs || [];
    db.SetoranData = db.SetoranData || [];

    const combined = getCombinedTransactions(db);
    const filtered = filterTransactions(combined, filterOutlet, dateStart, dateEnd);

    const summary = calculateDashboardSummary(filtered);
    const byAdmin = calculateByAdmin(filtered, db.Users);
    const byEkspedisi = calculateByEkspedisi(filtered);
    const grafik = calculateGrafik(combined, filterOutlet);
    const statusSetoranList = calculateStatusSetoran(filtered, db.SetoranData, filterOutlet);
    const targetHarian = calculateTargetHarian(combined, filterOutlet, db.Outlets);

    // Aktivitas Terakhir (Audit Logs)
    let logs = db.AuditLogs;
    if (filterOutlet && filterOutlet !== "ALL") {
      logs = logs.filter((log: any) => log.outlet_id === filterOutlet);
    }
    if (dateStart) {
      const start = new Date(dateStart).getTime();
      logs = logs.filter((log: any) => log.timestamp && new Date(log.timestamp).getTime() >= start);
    }
    if (dateEnd) {
      const end = new Date(dateEnd).getTime() + 86400000;
      logs = logs.filter((log: any) => log.timestamp && new Date(log.timestamp).getTime() <= end);
    }
    
    const userMap: Record<string, string> = {};
    db.Users.forEach((u: any) => userMap[u.user_id] = u.nama_lengkap);
    const aktivitasLogs = logs.slice(0, 50).map((log: any) => ({
      ...log,
      nama_lengkap: userMap[log.user_id] || "Sistem"
    }));

    // Riwayat Pembatalan
    const cancelLogs = db.AuditLogs.filter((l: any) => l.aksi === "BATAL_TRANSAKSI" && (filterOutlet === "ALL" || !filterOutlet || l.outlet_id === filterOutlet));
    const pembatalanLogs = cancelLogs.map((l:any) => ({
      ...l,
      nama_lengkap: userMap[l.user_id] || "Sistem"
    }));

    // Alert Operasional
    const alerts: string[] = [];
    if (statusSetoranList.some((s:any) => s.status === "Belum Disetor" && s.total_setoran > 0)) {
      alerts.push("Belum setor owner");
    }

    return res.json({
      status: "success",
      data: {
        summary,
        byAdmin,
        byEkspedisi,
        statusSetoranList,
        aktivitasLogs,
        grafik,
        pembatalanLogs,
        alerts,
        targetHarian,
        recentTransactions: filtered.sort((a:any, b:any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()).slice(0, 10)
      }
    });
  } catch (error: any) {
    console.error("CRASH in getAdminDashboardData:", error);
    return res.status(500).json({ status: "error", message: "Runtime crash: " + error.message, stack: error.stack });
  }
});

// 12. GET DASHBOARD DATA (OWNER EXCLUSIVE)
app.post("/api/getDashboardData", (req, res) => {
  const { user_id, role, filterOutlet, filterTipeLayanan, dateStart, dateEnd } = req.body;

  if (role !== "OWNER") {
    return res.status(403).json({ status: "error", message: "Akses ditolak. Hanya untuk OWNER." });
  }

  const db = readDb();
  const combined = getCombinedTransactions(db);
  const filtered = filterTransactions(combined, filterOutlet, dateStart, dateEnd, filterTipeLayanan);
  
  const summary = calculateDashboardSummary(filtered);
  const target_harian = calculateTargetHarian(combined, filterOutlet, db.Outlets);

  // Per-outlet stats (for charts)
  const outletOmsetMap: { [key: string]: { nama: string; omset: number; setoran: number; kas: number; count: number } } = {};
  
  // Pre-populate with all outlets
  db.Outlets.forEach((o: any) => {
    outletOmsetMap[o.outlet_id] = {
      nama: o.nama_outlet.replace("J&T Express - ", "").replace("J&T Cargo - ", ""),
      omset: 0,
      setoran: 0,
      kas: 0,
      count: 0
    };
  });

  filtered.forEach((r: any) => {
    const outId = r.outlet_id_input;
    if (outletOmsetMap[outId]) {
      outletOmsetMap[outId].omset += r.grand_total || 0;
      outletOmsetMap[outId].setoran += r.setoran_ke_owner || 0;
      outletOmsetMap[outId].kas += r.kas_operasional || 0;
      outletOmsetMap[outId].count += 1;
    } else {
      outletOmsetMap[outId] = {
        nama: outId,
        omset: r.grand_total || 0,
        setoran: r.setoran_ke_owner || 0,
        kas: r.kas_operasional || 0,
        count: 1
      };
    }
  });

  // Daily transaction trends (past 7 days or matching date range)
  const dailyMap: { [key: string]: { date: string; Express: number; Cargo: number; total: number } } = {};
  filtered.forEach((r: any) => {
    const dateStr = r.timestamp.split("T")[0]; // YYYY-MM-DD
    if (!dailyMap[dateStr]) {
      dailyMap[dateStr] = { date: dateStr, Express: 0, Cargo: 0, total: 0 };
    }
    const type = r.tipe_layanan as "Express" | "Cargo";
    dailyMap[dateStr][type] += r.grand_total || 0;
    dailyMap[dateStr].total += r.grand_total || 0;
  });

  const daily_trends = Object.keys(dailyMap)
    .sort()
    .map((key) => dailyMap[key]);

  // Filter audit logs
  let filteredLogs = db.AuditLogs;
  if (filterOutlet && filterOutlet !== "ALL") {
    filteredLogs = filteredLogs.filter((log: any) => log.outlet_id === filterOutlet);
  }
  if (dateStart) {
    const start = new Date(dateStart).getTime();
    filteredLogs = filteredLogs.filter((log: any) => new Date(log.timestamp).getTime() >= start);
  }
  if (dateEnd) {
    const end = new Date(dateEnd).getTime() + 86400000;
    filteredLogs = filteredLogs.filter((log: any) => new Date(log.timestamp).getTime() <= end);
  }

  // Map user IDs to names for readability in logs
  const userMap: { [key: string]: string } = {};
  db.Users.forEach((u: any) => {
    userMap[u.user_id] = u.nama_lengkap;
  });

  const audit_logs = filteredLogs.slice(0, 50).map((log: any) => ({
    ...log,
    nama_lengkap: userMap[log.user_id] || "Sistem"
  }));

  // Monthly reports
  const monthlyMap: { [key: string]: { month: string; total_omset: number; outletsMap: { [oid: string]: { outlet_id: string; nama_outlet: string; omset: number; transaksi: number } } } } = {};
  filtered.forEach((r: any) => {
    const monthStr = r.timestamp.substring(0, 7); // YYYY-MM
    if (!monthlyMap[monthStr]) {
      monthlyMap[monthStr] = { month: monthStr, total_omset: 0, outletsMap: {} };
    }
    monthlyMap[monthStr].total_omset += r.grand_total || 0;
    
    const outId = r.outlet_id_input;
    if (!monthlyMap[monthStr].outletsMap[outId]) {
      const outletName = db.Outlets.find((o: any) => o.outlet_id === outId)?.nama_outlet || outId;
      monthlyMap[monthStr].outletsMap[outId] = {
        outlet_id: outId,
        nama_outlet: outletName.replace("J&T Express - ", "").replace("J&T Cargo - ", ""),
        omset: 0,
        transaksi: 0
      };
    }
    monthlyMap[monthStr].outletsMap[outId].omset += r.grand_total || 0;
    monthlyMap[monthStr].outletsMap[outId].transaksi += 1;
  });
  
  const monthly_reports = Object.values(monthlyMap).map(m => ({
    month: m.month,
    total_omset: m.total_omset,
    outlets: Object.values(m.outletsMap).sort((a:any, b:any) => b.omset - a.omset)
  })).sort((a, b) => b.month.localeCompare(a.month));

  const paymentMap: Record<string, number> = {};
  filtered.forEach((r: any) => {
    const metode = r.metode_bayar || "Lainnya";
    paymentMap[metode] = (paymentMap[metode] || 0) + (r.grand_total || 0);
  });
  const payment_shares = Object.keys(paymentMap).map(k => ({ name: k, value: paymentMap[k] }));

  return res.json({
    status: "success",
    data: {
      summary,
      chart_data: {
        daily_trends,
        payment_shares
      },
      audit_logs,
      monthly_reports,
      target_harian
    }
  });
});

app.post("/api/getRiwayatTransaksi", (req, res) => {
  const db = readDb();
  const { filterOutlet } = req.body;

  const allExp = db.EXP_Resi.map((r: any) => ({ ...r, tipe: "Express" }));
  const allCargo = db.CRG_Resi.map((r: any) => ({ ...r, tipe: "Cargo" }));
  const allTrans = [...allExp, ...allCargo];

  const filtered = allTrans.filter(r => {
    if (filterOutlet && filterOutlet !== "ALL") {
      return r.outlet_id_input === filterOutlet;
    }
    return true;
  });

  const outletMap: Record<string, string> = {};
  db.Outlets.forEach((o: any) => {
    outletMap[o.outlet_id] = o.nama_outlet;
  });

  const userMap: Record<string, string> = {};
  db.Users.forEach((u: any) => {
    userMap[u.user_id] = u.username;
  });

  const preInputMap: Record<string, any> = {};
  db.PreInput_Backup.forEach((p: any) => {
    preInputMap[p.transaksi_id] = p;
  });

  const transaksiList = filtered.map(r => {
    const p = preInputMap[r.transaksi_id] || {};
    return {
      resi_id: r.resi_id,
      transaksi_id: r.transaksi_id,
      timestamp: r.timestamp,
      admin: userMap[r.admin_id_pencatat] || r.admin_id_pencatat,
      outlet: outletMap[r.outlet_id_input] || r.outlet_id_input,
      tipe: r.tipe,
      grand_total: r.grand_total,
      pengirim: p.nama_pengirim || "",
      penerima: p.nama_penerima || "",
      status_resi: r.status || "AKTIF"
    };
  });

  transaksiList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return res.json({
    status: "success",
    data: transaksiList
  });
});

app.post("/api/deleteTransaksi", (req, res) => {
  const db = readDb();
  const { resi_id, user_id, outlet_id, tipe } = req.body;

  if (!resi_id || !user_id) {
    return res.status(400).json({ status: "error", message: "Parameter resi_id dan user_id diperlukan" });
  }

  let found = false;

  if (tipe === "Express") {
    const idx = db.EXP_Resi.findIndex((r: any) => r.resi_id === resi_id);
    if (idx !== -1) {
      db.EXP_Resi[idx].status = "BATAL";
      found = true;
    }
  } else if (tipe === "Cargo") {
    const idx = db.CRG_Resi.findIndex((r: any) => r.resi_id === resi_id);
    if (idx !== -1) {
      db.CRG_Resi[idx].status = "BATAL";
      found = true;
    }
  } else {
    // If tipe is not provided, try both
    let idx = db.EXP_Resi.findIndex((r: any) => r.resi_id === resi_id);
    if (idx !== -1) {
      db.EXP_Resi[idx].status = "BATAL";
      found = true;
    } else {
      idx = db.CRG_Resi.findIndex((r: any) => r.resi_id === resi_id);
      if (idx !== -1) {
        db.CRG_Resi[idx].status = "BATAL";
        found = true;
      }
    }
  }

  if (!found) {
    return res.status(404).json({ status: "error", message: "Transaksi tidak ditemukan" });
  }

  // Record audit log
  const newLog = {
    log_id: "LOG-" + Date.now(),
    timestamp: new Date().toISOString(),
    user_id: user_id,
    aksi: "BATAL_TRANSAKSI",
    detail: `Membatalkan resi ${resi_id}`,
    outlet_id: outlet_id || "ALL"
  };
  db.AuditLogs.unshift(newLog);

  writeDb(db);

  return res.json({
    status: "success",
    message: "Transaksi berhasil dibatalkan"
  });
});

// === MAPS REVIEWS API ENDPOINTS ===

// Get all reviews
app.get("/api/getReviews", (req, res) => {
  try {
    const db = readDb();
    return res.json({ status: "success", data: db.MapsReviews || [] });
  } catch (err: any) {
    console.error("Error in getReviews:", err);
    return res.status(500).json({ status: "error", message: "Gagal memuat ulasan Maps" });
  }
});

// Sync real reviews from Google API (Places API)
app.post("/api/syncGoogleReviews", async (req, res) => {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ 
      status: "error", 
      message: "API Key Google belum diatur. Silakan tambahkan GOOGLE_API_KEY di pengaturan rahasia (Secrets)." 
    });
  }

// PENTING: Ganti nilai place_id di bawah ini dengan Place ID asli dari masing-masing outlet Google Maps Anda
  const OUTLET_PLACES = [
    { outlet_id: "TGR044B", place_id: "ChIJ84S51fP3aS4RdSj_yVN_eBc", name: "J&T Cargo Balaraja (TGR044B)" },
    { outlet_id: "JYT-CRG", place_id: "ChIJb7EAt4b3aS4R_G_pWhfWPhg", name: "J&T Cargo Jayanti Cikande" },
    { outlet_id: "BLR-EXP", place_id: "ChIJRz_t7wT4aS4RL6fPclj2B1k", name: "J&T Express Balaraja (MDP Pasir Jaha)" },
    { outlet_id: "JYT-EXP", place_id: "ChIJmZatX4f3aS4Re06D67jOa_0", name: "J&T Express Jayanti Cikande (MDP)" }
  ];

  try {
    const db = readDb();
    if (!db.MapsReviews) db.MapsReviews = [];

    let newReviewsCount = 0;

    let errorMessages: string[] = [];

    // Fetch ulasan untuk setiap outlet dari Google Places API
    // Catatan: Google Business Profile API (mybusiness.googleapis.com) wajib pakai OAuth 2.0. 
    // Karena Anda menggunakan API Key, endpoint yang bisa menarik ulasan dengan API Key adalah Google Places API.
    for (const outlet of OUTLET_PLACES) {
      if (outlet.place_id.includes("Ganti")) continue; // Skip jika belum diganti

      const url = `https://places.googleapis.com/v1/places/${outlet.place_id}?languageCode=id`;
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'reviews'
          }
        });
        const data = await response.json() as any;
        
        console.log(`[SYNC] Response for ${outlet.outlet_id}:`, response.status, data.error ? data.error.message : "OK");

        if (data.error && data.error.message) {
          errorMessages.push(`Outlet ${outlet.outlet_id}: ${data.error.message}`);
        }

        if (data.reviews) {
          for (const rev of data.reviews) {
            // rev.publishTime is ISO string in New API, authorAttribution.displayName, rating, text.text
            const revTime = rev.publishTime || new Date().toISOString();
            const uniqueId = `REAL-${outlet.outlet_id}-${revTime}`;
            
            // Cek apakah ulasan sudah pernah disimpan
            const exists = db.MapsReviews.find((r: any) => r.id === uniqueId);
            if (!exists) {
              db.MapsReviews.unshift({
                id: uniqueId,
                outlet_id: outlet.outlet_id,
                nama_outlet: outlet.name,
                reviewer: rev.authorAttribution?.displayName || "Anonim",
                stars: rev.rating,
                text: rev.originalText?.text || rev.text?.text || "",
                timestamp: revTime,
                status_analisis: "BELUM_DIANALISIS",
                analisis: null
              });
              newReviewsCount++;
            }
          }
        }
      } catch (err: any) {
        console.error(`[SYNC] Error fetching for ${outlet.outlet_id}:`, err.message);
      }
    }

    if (newReviewsCount > 0) {
      writeDb(db);
    }

    if (errorMessages.length > 0 && newReviewsCount === 0) {
      return res.status(400).json({
        status: "error",
        message: `Gagal menarik ulasan dari Google API. Error:\n${errorMessages[0]}`
      });
    }

    return res.json({ 
      status: "success", 
      message: `Berhasil menarik ${newReviewsCount} ulasan baru dari Google Maps.` + (errorMessages.length > 0 ? ` (Beberapa outlet gagal ditarik)` : ""),
      data: db.MapsReviews 
    });
  } catch (err: any) {
    console.error("Error syncing Google reviews:", err);
    return res.status(500).json({ status: "error", message: "Gagal menarik data dari Google API" });
  }
});

// Add a new review
app.post("/api/addReview", (req, res) => {
  const { outlet_id, stars, text, reviewer } = req.body;
  if (!outlet_id || !stars) {
    return res.status(400).json({ status: "error", message: "Outlet ID dan Rating Bintang wajib diisi" });
  }

  try {
    const db = readDb();
    
    // Map outlet ID to proper outlet name
    const outletMapping: Record<string, string> = {
      "TGR044B": "J&T Cargo Balaraja (TGR044B)",
      "JYT-CRG": "J&T Cargo Jayanti Cikande",
      "BLR-EXP": "J&T Express Balaraja (MDP Pasir Jaha)",
      "JYT-EXP": "J&T Express Jayanti Cikande (MDP)"
    };

    const nama_outlet = outletMapping[outlet_id] || outlet_id;

    const newReview = {
      id: "REV-" + Date.now() + Math.floor(Math.random() * 10),
      outlet_id,
      nama_outlet,
      reviewer: reviewer || "Pelanggan Anonim",
      stars: Number(stars),
      text: text || "",
      timestamp: new Date().toISOString(),
      status_analisis: "BELUM_DIANALISIS",
      analisis: null
    };

    if (!db.MapsReviews) {
      db.MapsReviews = [];
    }

    db.MapsReviews.unshift(newReview);
    writeDb(db);

    return res.json({ status: "success", message: "Ulasan simulasi berhasil ditambahkan!", data: newReview });
  } catch (err: any) {
    console.error("Error adding review:", err);
    return res.status(500).json({ status: "error", message: "Gagal menambahkan ulasan" });
  }
});

// Delete a review
app.post("/api/deleteReview", (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ status: "error", message: "ID ulasan wajib disertakan" });
  }

  try {
    const db = readDb();
    if (!db.MapsReviews) db.MapsReviews = [];

    const initialLength = db.MapsReviews.length;
    db.MapsReviews = db.MapsReviews.filter((r: any) => r.id !== id);

    if (db.MapsReviews.length === initialLength) {
      return res.status(404).json({ status: "error", message: "Ulasan tidak ditemukan" });
    }

    writeDb(db);
    return res.json({ status: "success", message: "Ulasan berhasil dihapus!" });
  } catch (err: any) {
    console.error("Error deleting review:", err);
    return res.status(500).json({ status: "error", message: "Gagal menghapus ulasan" });
  }
});

// Analyze review with Gemini API
app.post("/api/analyzeReview", async (req, res) => {
  const { id, stars, text } = req.body;

  // We can analyze a saved review (by id) or on-the-fly review (by stars and text)
  let rating = stars;
  let reviewText = text;
  let savedReview: any = null;
  const db = readDb();

  if (id) {
    savedReview = (db.MapsReviews || []).find((r: any) => r.id === id);
    if (savedReview) {
      rating = savedReview.stars;
      reviewText = savedReview.text;
    } else {
      return res.status(404).json({ status: "error", message: "Ulasan tidak ditemukan di database" });
    }
  }

  if (rating === undefined || rating === null) {
    return res.status(400).json({ status: "error", message: "Rating bintang wajib diisi" });
  }

  try {
    const ai = getGeminiClient();
    
    const systemInstruction = 
      "Kamu adalah asisten ahli reputasi digital untuk J&T. Tugasmu adalah menganalisis ulasan pelanggan di Google Maps untuk outlet J&T dan menentukan kategori ulasan serta menghasilkan tanggapan otomatis.\n" +
      "Input yang kamu terima berupa: Rating Bintang (1-5) dan Teks Ulasan.\n\n" +
      "Kamu harus mengkategorikannya menjadi salah satu dari 3 kondisi berikut:\n" +
      "1. 'POSITIVE': Rating 4-5 bintang. Hasilkan balasan terima kasih yang hangat, variatif, 100% alami (seperti ditulis manusia), ramah, dan profesional dalam Bahasa Indonesia.\n" +
      "2. 'MISPLACED': Rating 1-3 bintang yang isinya mengeluhkan tentang pengantaran paket ke rumah/kurir pengantar/paket belum sampai ke rumah/kurir tidak sopan saat mengantar ke alamat rumah. Hasilkan klarifikasi sopan dalam Bahasa Indonesia bahwa outlet kami hanya melayani penerimaan pengiriman paket (drop-off/pickup/pencatatan awal), bukan pengantaran ke alamat rumah penerima (handling kurir pengantaran dilakukan oleh pihak pusat/gudang sortir utama J&T). Berikan saran/imbauan bagi pengguna untuk melaporkan ulasan ini sebagai 'Off-topic' (Tidak relevan) ke Google Maps.\n" +
      "3. 'FAKE': Rating 1 bintang dengan teks kosong (tidak ada teks ulasan), teks yang tidak jelas/malicious/tidak masuk akal, atau tidak berhubungan dengan transaksi di cabang kami. Nyatakan secara sopan dalam Bahasa Indonesia bahwa tidak ada riwayat transaksi dengan nama/detail tersebut di database outlet kami. Hasilkan draf banding resmi dalam Bahasa Inggris (Official Appeal Draft) yang ditujukan kepada Google Support untuk menghapus ulasan ini berdasarkan kebijakan 'Fake Engagement' Google Maps. Sertakan pula terjemahan draf banding tersebut ke dalam Bahasa Indonesia.\n\n" +
      "Format output wajib berupa JSON objek murni dengan struktur berikut:\n" +
      "{\n" +
      "  \"category\": \"POSITIVE\" | \"MISPLACED\" | \"FAKE\",\n" +
      "  \"reason\": \"Penjelasan singkat dalam Bahasa Indonesia mengapa ulasan dikategorikan demikian\",\n" +
      "  \"reply\": \"Teks tanggapan resmi dalam Bahasa Indonesia (untuk POSITIVE dan MISPLACED). Untuk FAKE, tanggapan singkat klarifikasi bahwa tidak ada riwayat transaksi di database kami.\",\n" +
      "  \"appealDraftEnglish\": \"Draf banding resmi dalam Bahasa Inggris (hanya diisi untuk kategori FAKE, kosongkan atau null untuk kategori lain)\",\n" +
      "  \"appealDraftIndonesian\": \"Terjemahan draf banding ke Bahasa Indonesia (hanya diisi untuk kategori FAKE, kosongkan atau null untuk kategori lain)\"\n" +
      "}";

    const prompt = `Rating Bintang: ${rating}\nTeks Ulasan: "${reviewText || ""}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    });

    const aiOutputText = response.text?.trim();
    if (!aiOutputText) {
      throw new Error("Gemini returned empty response text");
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(aiOutputText);
    } catch (parseErr) {
      console.error("Failed to parse Gemini output as JSON, raw text:", aiOutputText);
      // Fallback parsing or construction
      parsedResult = {
        category: rating >= 4 ? "POSITIVE" : (reviewText ? "MISPLACED" : "FAKE"),
        reason: "Gagal mengurai respons JSON otomatis dari AI.",
        reply: aiOutputText,
        appealDraftEnglish: null,
        appealDraftIndonesian: null
      };
    }

    // Save back to DB if analyzing a saved review
    if (savedReview) {
      savedReview.status_analisis = "SUDAH_DIANALISIS";
      savedReview.analisis = parsedResult;
      
      // Sync change back to db array
      const idx = db.MapsReviews.findIndex((r: any) => r.id === savedReview.id);
      if (idx !== -1) {
        db.MapsReviews[idx] = savedReview;
      }
      writeDb(db);
    }

    return res.json({ status: "success", data: parsedResult, review: savedReview });
  } catch (error: any) {
    console.error("Gemini analyzeReview Error:", error);
    let errorMsg = "Gagal memproses analisis ulasan via AI.";
    if (error.status === 429 || error.message?.includes("Quota") || error.message?.includes("RESOURCE_EXHAUSTED")) {
      errorMsg = "Kuota AI gratis harian sudah tercapai, coba lagi beberapa saat lagi.";
    } else if (error.message?.includes("API key")) {
      errorMsg = "API Key Gemini belum diatur. Silakan periksa konfigurasi di Settings > Secrets.";
    } else {
      errorMsg = `Kesalahan AI: ${error.message || "Unknown error"}`;
    }
    return res.status(200).json({ status: "error", message: errorMsg });
  }
});


// ==========================================
// MOCK ENDPOINTS FOR PHASE 5, 6, 7
// ==========================================

app.post("/api/getSetoranList", (req, res) => {
  const db = readDb();
  let setoranData = db.Master_Setoran || [];
  
  const { outlet_id, status, date_start, date_end } = req.body;
  
  let list = setoranData.filter(s => {
    if (outlet_id && outlet_id !== "ALL" && s.outlet_id !== outlet_id) return false;
    if (status && status !== "ALL" && s.status !== status) return false;
    if (date_start && s.tanggal < date_start) return false;
    if (date_end && s.tanggal > date_end) return false;
    return true;
  });
  
  list = list.reverse(); // newest first
  return res.json({ status: "success", data: list });
});

app.post("/api/getSetoranDetail", (req, res) => {
  const db = readDb();
  const { setoran_id, tanggal, outlet_id } = req.body;
  
  let header = null;
  if (setoran_id) {
    header = (db.Master_Setoran || []).find(s => s.setoran_id === setoran_id);
  } else if (tanggal && outlet_id) {
    header = (db.Master_Setoran || []).find(s => s.tanggal === tanggal && s.outlet_id === outlet_id && s.status !== "DITOLAK");
  }
  
  if (!header) return res.json({ status: "error", message: "Data setoran tidak ditemukan" });
  
  const hTanggal = header.tanggal;
  const hOutletId = header.outlet_id;
  
  let txList = [];
  let expData = db.EXP_Resi || [];
  let crgData = db.CRG_Resi || [];
  
  expData.forEach(tx => {
    let txDate = tx.timestamp ? tx.timestamp.split("T")[0] : "";
    if (txDate === hTanggal && tx.outlet_id_input === hOutletId && tx.status_resi !== "BATAL") {
      txList.push({ ...tx, tipe_layanan: "Express" });
    }
  });
  
  crgData.forEach(tx => {
    let txDate = tx.timestamp ? tx.timestamp.split("T")[0] : "";
    if (txDate === hTanggal && tx.outlet_id_input === hOutletId && tx.status_resi !== "BATAL") {
      txList.push({ ...tx, tipe_layanan: "Cargo" });
    }
  });
  
  return res.json({ status: "success", data: { header, transactions: txList } });
});

app.post("/api/createSetoran", (req, res) => {
  const db = readDb();
  const { outlet_id, tanggal, admin_id } = req.body;
  const adminPembuat = admin_id || "SYSTEM";
  
  if (!outlet_id || !tanggal) {
    return res.json({ status: "error", message: "Parameter outlet_id dan tanggal diperlukan." });
  }
  
  let existing = (db.Master_Setoran || []).find(s => s.tanggal === tanggal && s.outlet_id === outlet_id && s.status !== "DITOLAK");
  if (existing) {
    return res.json({ status: "error", message: "Setoran untuk tanggal ini sudah ada dan tidak dalam status DITOLAK." });
  }
  
  let outletName = outlet_id;
  let outData = (db.Outlets || []).find(o => o.outlet_id === outlet_id);
  if (outData) outletName = outData.nama_outlet;
  
  let txList = [];
  let totalSetoranOwner = 0;
  let totalKasOutlet = 0;
  
  (db.EXP_Resi || []).forEach(tx => {
    let txDate = tx.timestamp ? tx.timestamp.split("T")[0] : "";
    if (txDate === tanggal && tx.outlet_id_input === outlet_id && tx.status_resi !== "BATAL") {
      txList.push(tx);
      totalSetoranOwner += Number(tx.setoran_ke_owner) || 0;
      totalKasOutlet += Number(tx.kas_operasional) || 0;
    }
  });
  
  (db.CRG_Resi || []).forEach(tx => {
    let txDate = tx.timestamp ? tx.timestamp.split("T")[0] : "";
    if (txDate === tanggal && tx.outlet_id_input === outlet_id && tx.status_resi !== "BATAL") {
      txList.push(tx);
      totalSetoranOwner += Number(tx.setoran_ke_owner) || 0;
      totalKasOutlet += Number(tx.kas_operasional) || 0;
    }
  });
  
  if (txList.length === 0) {
    return res.json({ status: "error", message: "Tidak ada transaksi valid untuk disetor pada tanggal ini." });
  }
  
  const setoranObj = {
    setoran_id: "SET-" + Date.now(),
    tanggal,
    outlet_id,
    outlet_name: outletName,
    admin_pembuat: adminPembuat,
    jumlah_resi: txList.length,
    total_setoran_owner: totalSetoranOwner,
    total_kas_outlet: totalKasOutlet,
    status: "MENUNGGU_APPROVAL",
    created_at: new Date().toISOString(),
    approved_at: "",
    approved_by: "",
    catatan_owner: "",
    closing_status: "",
    closing_at: "",
    closing_by: ""
  };
  
  if (!db.Master_Setoran) db.Master_Setoran = [];
  db.Master_Setoran.push(setoranObj);
  writeDb(db);
  
  return res.json({ status: "success", message: "Setoran berhasil dibuat", data: setoranObj });
});

app.post("/api/approveSetoran", (req, res) => {
  const db = readDb();
  const { setoran_id, admin_id, catatan } = req.body;
  
  const s = (db.Master_Setoran || []).find(s => s.setoran_id === setoran_id);
  if (!s) return res.json({ status: "error", message: "Data setoran tidak ditemukan" });
  if (s.status === "DISETUJUI") return res.json({ status: "error", message: "Sudah disetujui sebelumnya." });
  
  s.status = "DISETUJUI";
  s.approved_at = new Date().toISOString();
  s.approved_by = admin_id;
  s.catatan_owner = catatan || "";
  
  writeDb(db);
  return res.json({ status: "success", message: "Setoran berhasil disetujui", data: s });
});

app.post("/api/rejectSetoran", (req, res) => {
  const db = readDb();
  const { setoran_id, admin_id, catatan } = req.body;
  
  if (!catatan) return res.json({ status: "error", message: "Catatan penolakan diperlukan" });
  
  const s = (db.Master_Setoran || []).find(s => s.setoran_id === setoran_id);
  if (!s) return res.json({ status: "error", message: "Data setoran tidak ditemukan" });
  if (s.status === "DISETUJUI") return res.json({ status: "error", message: "Setoran yang sudah disetujui tidak dapat ditolak." });
  
  s.status = "DITOLAK";
  s.approved_at = new Date().toISOString();
  s.approved_by = admin_id;
  s.catatan_owner = catatan;
  
  writeDb(db);
  return res.json({ status: "success", message: "Setoran ditolak", data: s });
});

app.post("/api/getAuditData", (req, res) => {
  const db = readDb();
  const { outlet_id, date_start, date_end } = req.body;
  
  let list = [];
  let expData = db.EXP_Resi || [];
  let crgData = db.CRG_Resi || [];
  
  const processTx = (tx, tipe) => {
    if (outlet_id && outlet_id !== "ALL" && tx.outlet_id_input !== outlet_id) return;
    let txDate = tx.timestamp ? tx.timestamp.split("T")[0] : "";
    if (date_start && txDate < date_start) return;
    if (date_end && txDate > date_end) return;
    if (tx.status_resi === "BATAL") return;
    
    let sStatus = "BELUM_ADA_SETORAN";
    let setoranData = (db.Master_Setoran || []).find(s => s.tanggal === txDate && s.outlet_id === tx.outlet_id_input && s.status !== "DITOLAK");
    if (setoranData) sStatus = setoranData.status;
    
    let tBayar = Number(tx.total_dibayar_customer) || 0;
    let yoyi = tipe === "EXP" ? (Number(tx.biaya_yoyi) || 0) : (Number(tx.biaya_jtc) || 0);
    let selisih = tBayar - yoyi;
    let totalCust = tBayar;
    
    let auditStatus = "BELUM_DIAUDIT";
    if (tx.owner_audit_status) {
       auditStatus = tx.owner_audit_status;
    } else if (sStatus === "DISETUJUI") {
       if (totalCust === 0) auditStatus = "PERLU_REVIEW";
       else if (selisih < 0) auditStatus = "SELISIH";
       else auditStatus = "SESUAI";
    }
    
    list.push({
      resi_id: tx.resi_id,
      transaksi_id: tx.transaksi_id,
      tipe: tipe,
      outlet_id: tx.outlet_id_input,
      tanggal: txDate,
      total_customer: totalCust,
      total_yoyi: yoyi,
      selisih: selisih,
      setoran_owner: tx.setoran_ke_owner || 0,
      kas_operasional: tx.kas_operasional || 0,
      setoran_status: sStatus,
      audit_status: auditStatus,
      audit_note: tx.owner_audit_note || "",
      audited_by: tx.owner_audited_by || "",
      timestamp: tx.timestamp
    });
  };
  
  expData.forEach(tx => processTx(tx, "EXP"));
  crgData.forEach(tx => processTx(tx, "CRG"));
  
  list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  let summary = {
    total_transaksi: list.length,
    total_express: list.filter(x => x.tipe === "EXP").length,
    total_cargo: list.filter(x => x.tipe === "CRG").length,
    total_setoran_owner: list.reduce((acc, val) => acc + val.setoran_owner, 0),
    total_kas_operasional: list.reduce((acc, val) => acc + val.kas_operasional, 0),
    total_customer_payment: list.reduce((acc, val) => acc + val.total_customer, 0),
    total_yoyi: list.reduce((acc, val) => acc + val.total_yoyi, 0),
    total_selisih: list.reduce((acc, val) => acc + val.selisih, 0)
  };

  return res.json({ status: "success", data: { summary, detail: list } });
});

app.post("/api/updateAuditDecision", (req, res) => {
  const db = readDb();
  const { resi_id, audit_status, audit_note, owner_id } = req.body;
  
  if (!resi_id || !audit_status) return res.json({ status: "error", message: "resi_id dan audit_status diperlukan" });
  
  let tx = (db.EXP_Resi || []).find(r => r.resi_id === resi_id);
  if (!tx) tx = (db.CRG_Resi || []).find(r => r.resi_id === resi_id);
  
  if (!tx) return res.json({ status: "error", message: "Data transaksi tidak ditemukan" });
  
  tx.owner_audit_status = audit_status;
  tx.owner_audit_note = audit_note || "";
  tx.owner_audited_by = owner_id || "OWNER";
  tx.owner_audited_at = new Date().toISOString();
  
  writeDb(db);
  return res.json({ status: "success", message: "Keputusan audit berhasil disimpan" });
});

app.post("/api/validateClosing", (req, res) => {
  const db = readDb();
  const closingDate = req.body.closing_date;
  const outletId = req.body.outlet_id;
  
  if (!closingDate || !outletId) {
    return res.json({ status: "error", message: "closing_date dan outlet_id diperlukan" });
  }
  
  let setoranData = db.Master_Setoran || [];
  let relatedSetorans = setoranData.filter(s => s.tanggal === closingDate && s.outlet_id === outletId);
  let activeSetoran = relatedSetorans.find(s => s.status !== "DITOLAK");
  
  if (activeSetoran && activeSetoran.closing_status === "CLOSED") {
    activeSetoran.total_transactions = activeSetoran.jumlah_resi;
    return res.json({ 
      status: "success", 
      is_valid: true,
      is_closed: true,
      message: "Hari ini sudah di-closing",
      data: activeSetoran
    });
  }
  
  let validations = [];
  let isSuccess = true;
  
  let setoranDisetujui = relatedSetorans.filter(s => s.status === "DISETUJUI");
  let setoranMenunggu = relatedSetorans.filter(s => s.status === "MENUNGGU_APPROVAL");
  let setoranDitolak = relatedSetorans.filter(s => s.status === "DITOLAK");
  
  let activeTransactions = [];
  let resiSet = {};
  let duplicateResiCount = 0;
  
  let summary = {
    total_transactions: 0,
    total_customer_payment: 0,
    total_setoran_owner: 0,
    total_kas_operasional: 0,
    total_yoyi: 0,
    total_selisih: 0
  };
  
  const processTx = (tx, tipe) => {
    let txDate = tx.timestamp ? tx.timestamp.split("T")[0] : "";
    if (txDate === closingDate && tx.outlet_id_input === outletId && tx.status_resi !== "BATAL") {
      activeTransactions.push(tx);
      summary.total_transactions++;
      summary.total_customer_payment += (Number(tx.total_dibayar_customer) || 0);
      summary.total_setoran_owner += (Number(tx.setoran_ke_owner) || 0);
      summary.total_kas_operasional += (Number(tx.kas_operasional) || 0);
      
      let yoyi = tipe === "EXP" ? (Number(tx.biaya_yoyi) || 0) : (Number(tx.biaya_jtc) || 0);
      summary.total_yoyi += yoyi;
      
      if (resiSet[tx.resi_id]) duplicateResiCount++;
      else resiSet[tx.resi_id] = true;
    }
  };
  
  (db.EXP_Resi || []).forEach(tx => processTx(tx, "EXP"));
  (db.CRG_Resi || []).forEach(tx => processTx(tx, "CRG"));
  
  summary.total_selisih = summary.total_customer_payment - summary.total_yoyi;
  
  if (activeTransactions.length > 0) {
    if (setoranDisetujui.length === 0 && setoranMenunggu.length === 0 && setoranDitolak.length === 0) {
      isSuccess = false;
      validations.push({ error: "Belum ada setoran yang dibuat untuk hari ini." });
    }
    if (setoranMenunggu.length > 0) {
      isSuccess = false;
      validations.push({ error: "Ada " + setoranMenunggu.length + " setoran yang masih menunggu approval owner." });
    }
    if (setoranDitolak.length > 0) {
      isSuccess = false;
      validations.push({ error: "Ada " + setoranDitolak.length + " setoran yang ditolak owner dan belum diselesaikan." });
    }
    if (activeSetoran && activeSetoran.status !== "DISETUJUI") {
       isSuccess = false;
       validations.push({ error: "Setoran untuk hari ini harus disetujui (DISETUJUI) sebelum closing." });
    }
  }
  
  if (duplicateResiCount > 0) {
    isSuccess = false;
    validations.push({ error: "Ditemukan " + duplicateResiCount + " resi ganda." });
  }
  
  let missingOp = 0, missingOutlet = 0, missingPayment = 0, missingCust = 0, invalidCalc = 0, invalidStatus = 0;
  
  activeTransactions.forEach(tx => {
    if (!tx.admin_id_pencatat) missingOp++;
    if (!tx.outlet_id_input) missingOutlet++;
    if (!tx.metode_bayar) missingPayment++;
    if (!tx.status_resi) invalidStatus++;
    
    let bayar = Number(tx.total_dibayar_customer);
    let setoran = Number(tx.setoran_ke_owner);
    if (isNaN(bayar) || isNaN(setoran) || typeof tx.total_dibayar_customer === "undefined") {
      invalidCalc++;
    }
    
    let foundCust = false;
    let pre = (db.PreInput_Backup || []).find(p => p.transaksi_id === tx.transaksi_id);
    if (pre && pre.nama_pengirim && pre.nama_penerima) foundCust = true;
    if (!foundCust) missingCust++;
  });
  
  if (missingOp > 0) { isSuccess = false; validations.push({ error: "Ditemukan " + missingOp + " transaksi tanpa operator." }); }
  if (missingOutlet > 0) { isSuccess = false; validations.push({ error: "Ditemukan " + missingOutlet + " transaksi tanpa outlet." }); }
  if (missingPayment > 0) { isSuccess = false; validations.push({ error: "Ditemukan " + missingPayment + " transaksi tanpa metode bayar." }); }
  if (missingCust > 0) { isSuccess = false; validations.push({ error: "Ditemukan " + missingCust + " transaksi tanpa data pelanggan (pengirim/penerima)." }); }
  if (invalidCalc > 0) { isSuccess = false; validations.push({ error: "Ditemukan " + invalidCalc + " transaksi dengan kalkulasi finansial tidak valid." }); }
  if (invalidStatus > 0) { isSuccess = false; validations.push({ error: "Ditemukan " + invalidStatus + " transaksi dengan status tidak valid." }); }
  
  return res.json({
    status: "success",
    is_valid: isSuccess,
    is_closed: false,
    validations: validations,
    summary: summary,
    active_setoran_id: activeSetoran ? activeSetoran.setoran_id : null
  });
});

app.post("/api/executeClosing", (req, res) => {
  const db = readDb();
  const { owner_id, closing_date, outlet_id } = req.body;
  
  if (!closing_date || !outlet_id) return res.json({ status: "error", message: "closing_date dan outlet_id diperlukan" });
  
  let activeSetoran = (db.Master_Setoran || []).find(s => s.tanggal === closing_date && s.outlet_id === outlet_id && s.status !== "DITOLAK");
  if (!activeSetoran) return res.json({ status: "error", message: "Tidak ada setoran yang bisa di-closing." });
  if (activeSetoran.closing_status === "CLOSED") return res.json({ status: "error", message: "Hari ini sudah di-closing." });
  
  activeSetoran.closing_status = "CLOSED";
  activeSetoran.closing_at = new Date().toISOString();
  activeSetoran.closing_by = owner_id || "SYSTEM";
  
  writeDb(db);
  return res.json({ status: "success", message: "Closing harian berhasil diselesaikan.", data: activeSetoran });
});

// ==========================================
// PHASE 8 — REPORTING & ANALYTICS ENDPOINTS
// ==========================================

function getReportingRawTransactions(db: any) {
  const backupMap: Record<string, any> = {};
  (db.PreInput_Backup || []).forEach((p: any) => {
    backupMap[p.transaksi_id] = p;
  });

  const userMap: Record<string, string> = {};
  (db.Users || []).forEach((u: any) => {
    userMap[u.user_id] = u.nama_lengkap || u.username;
  });

  const outletMap: Record<string, string> = {};
  (db.Outlets || []).forEach((o: any) => {
    outletMap[o.outlet_id] = o.nama_outlet;
  });

  const raw: any[] = [];

  // Express
  (db.EXP_Resi || []).forEach((r: any) => {
    if (r.status_resi !== "BATAL" && r.status !== "BATAL") {
      const txDate = r.timestamp ? r.timestamp.split("T")[0] : "";
      const pre = backupMap[r.transaksi_id];
      const custPay = Number(r.total_dibayar_customer) || Number(r.grand_total) || 0;
      const yoyi = Number(r.biaya_yoyi) || 0;
      const selisih = custPay - yoyi;
      const setoranOwner = Number(r.setoran_ke_owner) || 0;
      const kasOperasional = Number(r.kas_operasional) || 0;

      const setoranObj = (db.Master_Setoran || []).find((s: any) => s.tanggal === txDate && s.outlet_id === r.outlet_id_input && s.status !== "DITOLAK");
      const settlementStatus = setoranObj ? setoranObj.status : "BELUM_ADA_SETORAN";

      let auditStatus = "BELUM_DIAUDIT";
      if (r.owner_audit_status) {
        auditStatus = r.owner_audit_status;
      } else if (settlementStatus === "DISETUJUI") {
        if (custPay === 0) auditStatus = "PERLU_REVIEW";
        else if (selisih < 0) auditStatus = "SELISIH";
        else auditStatus = "SESUAI";
      }

      raw.push({
        resi_id: r.resi_id,
        transaksi_id: r.transaksi_id,
        timestamp: r.timestamp || new Date().toISOString(),
        tanggal: txDate,
        admin_id: r.admin_id_pencatat,
        admin_nama: userMap[r.admin_id_pencatat] || r.admin_id_pencatat || "System",
        outlet_id: r.outlet_id_input,
        outlet_nama: outletMap[r.outlet_id_input] || r.outlet_id_input || "Outlet",
        tipe_layanan: "Express",
        tipe_produk: r.tipe_produk || "EXPRESS",
        total_customer: custPay,
        total_yoyi: yoyi,
        selisih: selisih,
        setoran_owner: setoranOwner,
        kas_operasional: kasOperasional,
        settlement_status: settlementStatus,
        audit_status: auditStatus,
        pengirim: pre?.nama_pengirim || "Umum",
        penerima: pre?.nama_penerima || "Umum",
        metode_bayar: r.metode_bayar || "Tunai"
      });
    }
  });

  // Cargo
  (db.CRG_Resi || []).forEach((r: any) => {
    if (r.status_resi !== "BATAL" && r.status !== "BATAL") {
      const txDate = r.timestamp ? r.timestamp.split("T")[0] : "";
      const pre = backupMap[r.transaksi_id];
      const custPay = Number(r.total_dibayar_customer) || Number(r.grand_total) || 0;
      const yoyi = Number(r.biaya_jtc) || 0;
      const selisih = custPay - yoyi;
      const setoranOwner = Number(r.setoran_ke_owner) || 0;
      const kasOperasional = Number(r.kas_operasional) || 0;

      const setoranObj = (db.Master_Setoran || []).find((s: any) => s.tanggal === txDate && s.outlet_id === r.outlet_id_input && s.status !== "DITOLAK");
      const settlementStatus = setoranObj ? setoranObj.status : "BELUM_ADA_SETORAN";

      let auditStatus = "BELUM_DIAUDIT";
      if (r.owner_audit_status) {
        auditStatus = r.owner_audit_status;
      } else if (settlementStatus === "DISETUJUI") {
        if (custPay === 0) auditStatus = "PERLU_REVIEW";
        else if (selisih < 0) auditStatus = "SELISIH";
        else auditStatus = "SESUAI";
      }

      raw.push({
        resi_id: r.resi_id,
        transaksi_id: r.transaksi_id,
        timestamp: r.timestamp || new Date().toISOString(),
        tanggal: txDate,
        admin_id: r.admin_id_pencatat,
        admin_nama: userMap[r.admin_id_pencatat] || r.admin_id_pencatat || "System",
        outlet_id: r.outlet_id_input,
        outlet_nama: outletMap[r.outlet_id_input] || r.outlet_id_input || "Outlet",
        tipe_layanan: "Cargo",
        tipe_produk: r.tipe_produk || "CARGO",
        total_customer: custPay,
        total_yoyi: yoyi,
        selisih: selisih,
        setoran_owner: setoranOwner,
        kas_operasional: kasOperasional,
        settlement_status: settlementStatus,
        audit_status: auditStatus,
        pengirim: pre?.nama_pengirim || "Umum",
        penerima: pre?.nama_penerima || "Umum",
        metode_bayar: r.metode_bayar || "Tunai"
      });
    }
  });

  return raw.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function filterReportingTransactions(transactions: any[], filters: any) {
  const {
    date_start, dateStart,
    date_end, dateEnd,
    outlet_id, filterOutlet,
    operator_id, filterOperator,
    service_type, filterServiceType,
    settlement_status, filterSettlementStatus,
    audit_status, filterAuditStatus
  } = filters || {};

  const start = date_start || dateStart || "";
  const end = date_end || dateEnd || "";
  const out = outlet_id || filterOutlet || "ALL";
  const op = operator_id || filterOperator || "ALL";
  const sType = service_type || filterServiceType || "ALL";
  const setStat = settlement_status || filterSettlementStatus || "ALL";
  const audStat = audit_status || filterAuditStatus || "ALL";

  return transactions.filter((r) => {
    if (out !== "ALL" && r.outlet_id !== out) return false;
    if (op !== "ALL" && r.admin_id !== op && !r.admin_nama.toLowerCase().includes(op.toLowerCase())) return false;
    if (sType !== "ALL" && r.tipe_layanan !== sType) return false;
    if (setStat !== "ALL" && r.settlement_status !== setStat) return false;
    if (audStat !== "ALL" && r.audit_status !== audStat) return false;
    if (start && r.tanggal < start) return false;
    if (end && r.tanggal > end) return false;
    return true;
  });
}

app.post("/api/getReportingSummary", (req, res) => {
  const db = readDb();
  const allTx = getReportingRawTransactions(db);
  const filtered = filterReportingTransactions(allTx, req.body);

  // Overall Stats
  const total_transaksi = filtered.length;
  const total_express = filtered.filter(r => r.tipe_layanan === "Express").length;
  const total_cargo = filtered.filter(r => r.tipe_layanan === "Cargo").length;
  const total_customer_payment = filtered.reduce((acc, r) => acc + r.total_customer, 0);
  const total_yoyi = filtered.reduce((acc, r) => acc + r.total_yoyi, 0);
  const total_setoran_owner = filtered.reduce((acc, r) => acc + r.setoran_owner, 0);
  const total_kas_operasional = filtered.reduce((acc, r) => acc + r.kas_operasional, 0);
  const total_selisih = total_customer_payment - total_yoyi;

  // 1. Daily Report (per outlet, per tanggal)
  const dailyMap: Record<string, any> = {};
  filtered.forEach((r) => {
    const key = `${r.tanggal}_${r.outlet_id}`;
    if (!dailyMap[key]) {
      dailyMap[key] = {
        tanggal: r.tanggal,
        outlet_id: r.outlet_id,
        nama_outlet: r.outlet_nama,
        total_transaksi: 0,
        express: 0,
        cargo: 0,
        total_customer_payment: 0,
        total_yoyi: 0,
        total_setoran_owner: 0,
        total_kas_operasional: 0,
        total_selisih: 0
      };
    }
    const d = dailyMap[key];
    d.total_transaksi++;
    if (r.tipe_layanan === "Express") d.express++;
    if (r.tipe_layanan === "Cargo") d.cargo++;
    d.total_customer_payment += r.total_customer;
    d.total_yoyi += r.total_yoyi;
    d.total_setoran_owner += r.setoran_owner;
    d.total_kas_operasional += r.kas_operasional;
    d.total_selisih += r.selisih;
  });
  const daily_report = Object.values(dailyMap).sort((a: any, b: any) => b.tanggal.localeCompare(a.tanggal));

  // 2. Outlet Report
  const outletMap: Record<string, any> = {};
  filtered.forEach((r) => {
    if (!outletMap[r.outlet_id]) {
      outletMap[r.outlet_id] = {
        outlet_id: r.outlet_id,
        nama_outlet: r.outlet_nama,
        total_transaksi: 0,
        omset: 0,
        setoran: 0,
        kas_outlet: 0,
        selisih: 0
      };
    }
    const o = outletMap[r.outlet_id];
    o.total_transaksi++;
    o.omset += r.total_customer;
    o.setoran += r.setoran_owner;
    o.kas_outlet += r.kas_operasional;
    o.selisih += r.selisih;
  });
  const outlet_report = Object.values(outletMap).sort((a: any, b: any) => b.omset - a.omset);

  // 3. Operator Report
  const operatorMap: Record<string, any> = {};
  filtered.forEach((r) => {
    if (!operatorMap[r.admin_id]) {
      operatorMap[r.admin_id] = {
        admin_id: r.admin_id,
        nama_operator: r.admin_nama,
        total_transaksi: 0,
        express: 0,
        cargo: 0,
        omset: 0,
        kas_operasional: 0
      };
    }
    const op = operatorMap[r.admin_id];
    op.total_transaksi++;
    if (r.tipe_layanan === "Express") op.express++;
    if (r.tipe_layanan === "Cargo") op.cargo++;
    op.omset += r.total_customer;
    op.kas_operasional += r.kas_operasional;
  });
  const operator_report = Object.values(operatorMap).sort((a: any, b: any) => b.total_transaksi - a.total_transaksi);

  // 4. Audit Summary
  const audit_summary = {
    total_transaksi,
    total_audited: filtered.filter(r => r.audit_status !== "BELUM_DIAUDIT").length,
    sesuai: filtered.filter(r => r.audit_status === "SESUAI").length,
    selisih: filtered.filter(r => r.audit_status === "SELISIH").length,
    perlu_review: filtered.filter(r => r.audit_status === "PERLU_REVIEW").length,
    belum_diaudit: filtered.filter(r => r.audit_status === "BELUM_DIAUDIT").length
  };

  // 5. Analytics
  const highest_outlet = outlet_report.length > 0 ? outlet_report[0] : null;
  const highest_operator = operator_report.length > 0 ? operator_report[0] : null;

  const dateRevenueMap: Record<string, number> = {};
  filtered.forEach((r) => {
    dateRevenueMap[r.tanggal] = (dateRevenueMap[r.tanggal] || 0) + r.total_customer;
  });
  let highest_revenue_date: any = null;
  Object.keys(dateRevenueMap).forEach((d) => {
    if (!highest_revenue_date || dateRevenueMap[d] > highest_revenue_date.omset) {
      highest_revenue_date = { tanggal: d, omset: dateRevenueMap[d] };
    }
  });

  const uniqueDays = Object.keys(dateRevenueMap).length;
  const avg_transactions_per_day = uniqueDays > 0 ? Math.round((total_transaksi / uniqueDays) * 10) / 10 : 0;
  const avg_customer_payment = total_transaksi > 0 ? Math.round(total_customer_payment / total_transaksi) : 0;

  // Master Setoran avg
  const setorans = db.Master_Setoran || [];
  const validSetorans = setorans.filter((s: any) => s.status !== "DITOLAK");
  const totalSetoranAmt = validSetorans.reduce((acc: number, s: any) => acc + (Number(s.total_setoran_owner) || 0), 0);
  const avg_settlement = validSetorans.length > 0 ? Math.round(totalSetoranAmt / validSetorans.length) : 0;

  const analytics = {
    highest_outlet,
    highest_operator,
    highest_revenue_date,
    avg_transactions_per_day,
    avg_customer_payment,
    avg_settlement
  };

  // 6. Charts Data
  const dailyChartMap: Record<string, any> = {};
  filtered.forEach((r) => {
    if (!dailyChartMap[r.tanggal]) {
      dailyChartMap[r.tanggal] = {
        date: r.tanggal,
        total: 0,
        express: 0,
        cargo: 0,
        omset: 0,
        setoran: 0,
        kas: 0
      };
    }
    const dc = dailyChartMap[r.tanggal];
    dc.total++;
    if (r.tipe_layanan === "Express") dc.express++;
    if (r.tipe_layanan === "Cargo") dc.cargo++;
    dc.omset += r.total_customer;
    dc.setoran += r.setoran_owner;
    dc.kas += r.kas_operasional;
  });

  const chartDates = Object.keys(dailyChartMap).sort();
  const daily_transactions = chartDates.map(d => ({
    date: d,
    total: dailyChartMap[d].total,
    express: dailyChartMap[d].express,
    cargo: dailyChartMap[d].cargo
  }));

  const daily_revenue = chartDates.map(d => ({
    date: d,
    omset: dailyChartMap[d].omset,
    setoran: dailyChartMap[d].setoran,
    kas: dailyChartMap[d].kas
  }));

  const express_vs_cargo = [
    { name: "Express", value: total_express },
    { name: "Cargo", value: total_cargo }
  ];

  const setDistMap: Record<string, number> = {
    "DISETUJUI": 0,
    "MENUNGGU_APPROVAL": 0,
    "DITOLAK": 0,
    "BELUM_ADA_SETORAN": 0
  };
  filtered.forEach((r) => {
    setDistMap[r.settlement_status] = (setDistMap[r.settlement_status] || 0) + 1;
  });
  const settlement_status_chart = [
    { name: "Disetujui", value: setDistMap["DISETUJUI"] },
    { name: "Menunggu Approval", value: setDistMap["MENUNGGU_APPROVAL"] },
    { name: "Ditolak", value: setDistMap["DITOLAK"] },
    { name: "Belum Ada Setoran", value: setDistMap["BELUM_ADA_SETORAN"] }
  ];

  return res.json({
    status: "success",
    data: {
      summary: {
        total_transaksi,
        total_express,
        total_cargo,
        total_customer_payment,
        total_yoyi,
        total_setoran_owner,
        total_kas_operasional,
        total_selisih
      },
      daily_report,
      outlet_report,
      operator_report,
      audit_summary,
      analytics,
      charts: {
        daily_transactions,
        daily_revenue,
        express_vs_cargo,
        settlement_status: settlement_status_chart
      }
    }
  });
});

app.post("/api/getReportingTransactions", (req, res) => {
  const db = readDb();
  const allTx = getReportingRawTransactions(db);
  const filtered = filterReportingTransactions(allTx, req.body);
  return res.json({ status: "success", data: filtered });
});

app.post("/api/getReportingSettlement", (req, res) => {
  const db = readDb();
  const { date_start, dateStart, date_end, dateEnd, outlet_id, filterOutlet, settlement_status, filterSettlementStatus } = req.body || {};
  const start = date_start || dateStart || "";
  const end = date_end || dateEnd || "";
  const out = outlet_id || filterOutlet || "ALL";
  const stat = settlement_status || filterSettlementStatus || "ALL";

  let list = db.Master_Setoran || [];
  list = list.filter((s: any) => {
    if (out !== "ALL" && s.outlet_id !== out) return false;
    if (stat !== "ALL" && s.status !== stat) return false;
    if (start && s.tanggal < start) return false;
    if (end && s.tanggal > end) return false;
    return true;
  });

  const total_records = list.length;
  const total_disetujui = list.filter((s: any) => s.status === "DISETUJUI").length;
  const total_menunggu = list.filter((s: any) => s.status === "MENUNGGU_APPROVAL").length;
  const total_ditolak = list.filter((s: any) => s.status === "DITOLAK").length;
  const total_amount_disetujui = list.filter((s: any) => s.status === "DISETUJUI").reduce((acc: number, s: any) => acc + (Number(s.total_setoran_owner) || 0), 0);
  const total_amount_menunggu = list.filter((s: any) => s.status === "MENUNGGU_APPROVAL").reduce((acc: number, s: any) => acc + (Number(s.total_setoran_owner) || 0), 0);

  return res.json({
    status: "success",
    data: {
      summary: {
        total_records,
        total_disetujui,
        total_menunggu,
        total_ditolak,
        total_amount_disetujui,
        total_amount_menunggu
      },
      detail: list.reverse()
    }
  });
});

app.post("/api/getReportingAudit", (req, res) => {
  const db = readDb();
  const allTx = getReportingRawTransactions(db);
  const filtered = filterReportingTransactions(allTx, req.body);

  const total_transaksi = filtered.length;
  const total_audited = filtered.filter(r => r.audit_status !== "BELUM_DIAUDIT").length;
  const sesuai = filtered.filter(r => r.audit_status === "SESUAI").length;
  const selisih = filtered.filter(r => r.audit_status === "SELISIH").length;
  const perlu_review = filtered.filter(r => r.audit_status === "PERLU_REVIEW").length;
  const belum_diaudit = filtered.filter(r => r.audit_status === "BELUM_DIAUDIT").length;

  return res.json({
    status: "success",
    data: {
      summary: {
        total_transaksi,
        total_audited,
        sesuai,
        selisih,
        perlu_review,
        belum_diaudit
      },
      detail: filtered
    }
  });
});

// ==========================================
// PHASE 9 — AI AUDIT ASSISTANT ENDPOINTS
// ==========================================

function getAIAssistantContext(db: any) {
  const allTx = getReportingRawTransactions(db);

  // Totals
  const total_transaksi = allTx.length;
  const total_express = allTx.filter(r => r.tipe_layanan === "Express").length;
  const total_cargo = allTx.filter(r => r.tipe_layanan === "Cargo").length;
  const total_omset = allTx.reduce((acc, r) => acc + r.total_customer, 0);
  const total_setoran_owner = allTx.reduce((acc, r) => acc + r.setoran_owner, 0);
  const total_kas = allTx.reduce((acc, r) => acc + r.kas_operasional, 0);
  const total_selisih = allTx.reduce((acc, r) => acc + r.selisih, 0);

  // Date map
  const dateMap: Record<string, any> = {};
  allTx.forEach(r => {
    if (!dateMap[r.tanggal]) {
      dateMap[r.tanggal] = { count: 0, omset: 0, express: 0, cargo: 0, setoran: 0 };
    }
    dateMap[r.tanggal].count++;
    dateMap[r.tanggal].omset += r.total_customer;
    if (r.tipe_layanan === "Express") dateMap[r.tanggal].express++;
    if (r.tipe_layanan === "Cargo") dateMap[r.tanggal].cargo++;
    dateMap[r.tanggal].setoran += r.setoran_owner;
  });

  // Outlets
  const outletMap: Record<string, any> = {};
  allTx.forEach(r => {
    if (!outletMap[r.outlet_id]) {
      outletMap[r.outlet_id] = { nama: r.outlet_nama, count: 0, omset: 0, setoran: 0 };
    }
    outletMap[r.outlet_id].count++;
    outletMap[r.outlet_id].omset += r.total_customer;
    outletMap[r.outlet_id].setoran += r.setoran_owner;
  });

  // Operators
  const opMap: Record<string, any> = {};
  allTx.forEach(r => {
    if (!opMap[r.admin_id]) {
      opMap[r.admin_id] = { nama: r.admin_nama, count: 0, omset: 0 };
    }
    opMap[r.admin_id].count++;
    opMap[r.admin_id].omset += r.total_customer;
  });

  // Settlements
  const setorans = db.Master_Setoran || [];
  const pending_setoran = setorans.filter((s: any) => s.status === "MENUNGGU_APPROVAL");
  const rejected_setoran = setorans.filter((s: any) => s.status === "DITOLAK");
  const approved_setoran = setorans.filter((s: any) => s.status === "DISETUJUI");

  // Audits / Anomalies
  const resiPerluReview = allTx.filter(r => r.audit_status === "PERLU_REVIEW");
  const resiSelisih = allTx.filter(r => r.audit_status === "SELISIH");

  // Batal list
  const expBatal = (db.EXP_Resi || []).filter((r: any) => r.status_resi === "BATAL" || r.status === "BATAL");
  const crgBatal = (db.CRG_Resi || []).filter((r: any) => r.status_resi === "BATAL" || r.status === "BATAL");
  const totalBatal = expBatal.length + crgBatal.length;

  return {
    summary: {
      total_transaksi,
      total_express,
      total_cargo,
      total_omset,
      total_setoran_owner,
      total_kas,
      total_selisih,
      total_batal: totalBatal
    },
    dates: dateMap,
    outlets: Object.values(outletMap).sort((a: any, b: any) => b.omset - a.omset),
    operators: Object.values(opMap).sort((a: any, b: any) => b.count - a.count),
    settlements: {
      total: setorans.length,
      pending: pending_setoran.length,
      pending_list: pending_setoran.map((s: any) => ({ setoran_id: s.setoran_id, tanggal: s.tanggal, outlet: s.outlet_name || s.outlet_id, total: s.total_setoran_owner })),
      rejected: rejected_setoran.length,
      rejected_list: rejected_setoran.map((s: any) => ({ setoran_id: s.setoran_id, tanggal: s.tanggal, outlet: s.outlet_name || s.outlet_id, total: s.total_setoran_owner, alasan: s.alasan_penolakan })),
      approved: approved_setoran.length
    },
    audits: {
      perlu_review_count: resiPerluReview.length,
      selisih_count: resiSelisih.length,
      perlu_review_samples: resiPerluReview.slice(0, 5).map(r => ({ resi_id: r.resi_id, outlet: r.outlet_nama, total: r.total_customer })),
      selisih_samples: resiSelisih.slice(0, 5).map(r => ({ resi_id: r.resi_id, outlet: r.outlet_nama, selisih: r.selisih }))
    }
  };
}

async function handleAIAssistantQuestion(question: string, db: any) {
  const context = getAIAssistantContext(db);
  const prompt = `
Kamu adalah 'AI Audit Assistant' resmi untuk Owner J&T Express Tangerang Barat.
Tugasmu: Menjawab pertanyaan owner mengenai performa bisnis, omset, audit, setoran, dan transaksi berdasarkan data real berikut:

[DATA OPERASIONAL BUSINESS SNAPSHOT]
${JSON.stringify(context, null, 2)}

[ATURAN UTAMA]:
1. Jawab HANYA berdasarkan data resmi di atas.
2. JANGAN MENGARANG ATAU MEMBUAT ANGKAMU SENDIRI.
3. Jika data tidak tersedia atau tidak tercantum dalam snapshot, jawab persis: "Data tidak tersedia."
4. Sertakan penjelasan darimana angka tersebut dihitung jika ditanyakan.
5. Gunakan format mata uang Rupiah (Rp) untuk nominal finansial.
6. Jawaban harus padat, profesional, dan langsung pada poin tanpa basa-basi berlebihan.

Pertanyaan Owner: "${question}"
`;

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });
    return response.text || "Data tidak tersedia.";
  } catch (err: any) {
    console.error("Gemini Assistant Error:", err?.message || err);
    // Rule-based fallback for simple queries
    const qLower = question.toLowerCase();
    if (qLower.includes("omset")) {
      return `Total omset customer terdaftar saat ini adalah Rp ${context.summary.total_omset.toLocaleString("id-ID")}. (Perhitungan dari seluruh resi Express & Cargo yang tidak dibatalkan).`;
    }
    if (qLower.includes("transaksi") || qLower.includes("resi")) {
      return `Total transaksi terdaftar: ${context.summary.total_transaksi} resi (${context.summary.total_express} Express, ${context.summary.total_cargo} Cargo).`;
    }
    if (qLower.includes("operator") || qLower.includes("admin")) {
      const topOp = context.operators[0];
      return topOp ? `Operator paling aktif: ${topOp.nama} dengan total ${topOp.count} transaksi (omset Rp ${topOp.omset.toLocaleString("id-ID")}).` : "Data tidak tersedia.";
    }
    if (qLower.includes("outlet")) {
      const topOut = context.outlets[0];
      return topOut ? `Outlet dengan omset tertinggi: ${topOut.nama} dengan omset Rp ${topOut.omset.toLocaleString("id-ID")} (${topOut.count} transaksi).` : "Data tidak tersedia.";
    }
    if (qLower.includes("setoran") || qLower.includes("belum disetujui")) {
      return `Terdapat ${context.settlements.pending} setoran menunggu approval owner, dan ${context.settlements.rejected} setoran ditolak.`;
    }
    if (qLower.includes("selisih") || qLower.includes("audit")) {
      return `Audit menemukan ${context.audits.selisih_count} resi dengan selisih nominal dan ${context.audits.perlu_review_count} resi perlu review.`;
    }
    return "Data tidak tersedia saat ini. Silakan coba kembali beberapa saat lagi.";
  }
}

const handleDailySummaryRequest = async (req: any, res: any) => {
  const db = readDb();
  const context = getAIAssistantContext(db);

  // Get date requested or latest available date
  const dateKeys = Object.keys(context.dates).sort().reverse();
  const targetDate = req.body?.date || (dateKeys.length > 0 ? dateKeys[0] : new Date().toISOString().split("T")[0]);
  const dateInfo = context.dates[targetDate] || { count: 0, omset: 0, express: 0, cargo: 0, setoran: 0 };

  const prompt = `
Kamu adalah AI Audit Assistant untuk Owner J&T.
Buatkan 'Daily Operational Summary' singkat untuk tanggal ${targetDate} berdasarkan data berikut:
- Total Transaksi: ${dateInfo.count} resi (${dateInfo.express} Express, ${dateInfo.cargo} Cargo)
- Total Omset Customer: Rp ${dateInfo.omset.toLocaleString("id-ID")}
- Total Setoran Owner: Rp ${dateInfo.setoran.toLocaleString("id-ID")}
- Setoran Menunggu Approval: ${context.settlements.pending}
- Setoran Ditolak: ${context.settlements.rejected}
- Resi Perlu Review Audit: ${context.audits.perlu_review_count}
- Resi Selisih: ${context.audits.selisih_count}

Format dalam 5-6 bullet point yang sangat jelas, profesional, dan ringkas dalam Bahasa Indonesia.
`;

  let summaryText = "";
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });
    summaryText = response.text || "";
  } catch (err) {
    summaryText = `📊 **Ringkasan Operasional Hari Ini (${targetDate})**:\n` +
      `• **Total Transaksi**: ${dateInfo.count} resi (${dateInfo.express} Express, ${dateInfo.cargo} Cargo)\n` +
      `• **Total Omset Customer**: Rp ${dateInfo.omset.toLocaleString("id-ID")}\n` +
      `• **Setoran Owner**: Rp ${dateInfo.setoran.toLocaleString("id-ID")}\n` +
      `• **Setoran Menunggu Approval**: ${context.settlements.pending} berkas\n` +
      `• **Item Perlu Review Audit**: ${context.audits.perlu_review_count} resi`;
  }

  return res.json({
    status: "success",
    data: {
      date: targetDate,
      summary_text: summaryText,
      metrics: {
        total_transaksi: dateInfo.count,
        express: dateInfo.express,
        cargo: dateInfo.cargo,
        omset: dateInfo.omset,
        setoran_owner: dateInfo.setoran,
        pending_settlements: context.settlements.pending,
        audit_review_count: context.audits.perlu_review_count
      },
      timestamp: new Date().toISOString()
    }
  });
};

const handleDetectAnomaliesRequest = async (req: any, res: any) => {
  const db = readDb();
  const context = getAIAssistantContext(db);

  const anomalies: any[] = [];
  const recommendations: string[] = [];

  // Rule 1: Rejected settlements
  if (context.settlements.rejected > 0) {
    anomalies.push({
      type: "SETORAN_DITOLAK",
      severity: "HIGH",
      title: `${context.settlements.rejected} Setoran Ditolak Owner`,
      description: `Terdapat setoran outlet yang telah ditolak oleh owner dan membutuhkan revisi ulang oleh kasir outlet.`,
      items: context.settlements.rejected_list
    });
    recommendations.push("Instruksikan kasir outlet terkait untuk melakukan perbaikan dan mengajukan ulang setoran yang ditolak.");
  }

  // Rule 2: Pending settlements
  if (context.settlements.pending > 0) {
    anomalies.push({
      type: "SETORAN_PENDING",
      severity: "MEDIUM",
      title: `${context.settlements.pending} Setoran Menunggu Approval`,
      description: `Ada setoran harian outlet yang belum diverifikasi dan disetujui owner.`,
      items: context.settlements.pending_list
    });
    recommendations.push("Segera lakukan pemeriksaan berkas dan verifikasi bukti transfer setoran pada menu Persetujuan Setoran.");
  }

  // Rule 3: Resi Perlu Review Audit
  if (context.audits.perlu_review_count > 0) {
    anomalies.push({
      type: "AUDIT_PERLU_REVIEW",
      severity: "MEDIUM",
      title: `${context.audits.perlu_review_count} Resi Pembayaran Customer Rp 0`,
      description: `Ditemukan resi berstatus aktif yang dicatat dengan total pembayaran customer Rp 0. Perlu konfirmasi apakah VOID atau diskon.`,
      items: context.audits.perlu_review_samples
    });
    recommendations.push("Lakukan audit ulang pada resi bernilai Rp 0 untuk memastikan tidak ada kesalahan input pembayaran kupon/kredit.");
  }

  // Rule 4: Resi Selisih Margin
  if (context.audits.selisih_count > 0) {
    anomalies.push({
      type: "AUDIT_SELISIH",
      severity: "HIGH",
      title: `${context.audits.selisih_count} Resi Mengalami Selisih Margin`,
      description: `Ditemukan ketidaksesuaian antara tagihan customer dengan tarif dasar YOYI/JTC.`,
      items: context.audits.selisih_samples
    });
    recommendations.push("Periksa detail biaya timbangan dan diskon khusus pada resi berstatus SELISIH.");
  }

  // Rule 5: Transaksi Batal
  if (context.summary.total_batal > 0) {
    anomalies.push({
      type: "TRANSAKSI_BATAL",
      severity: "LOW",
      title: `${context.summary.total_batal} Transaksi Dibatalkan (BATAL)`,
      description: `Jumlah total resi yang dibatalkan oleh operator.`,
      items: []
    });
  }

  if (recommendations.length === 0) {
    recommendations.push("Seluruh operasional berjalan normal. Tidak ditemukan anomali signifikan hari ini.");
  }

  return res.json({
    status: "success",
    data: {
      anomalies,
      recommendations,
      timestamp: new Date().toISOString()
    }
  });
};

const handleAskAssistantRequest = async (req: any, res: any) => {
  const db = readDb();
  const question = req.body?.question || req.body?.prompt || "";
  if (!question || typeof question !== "string" || !question.trim()) {
    return res.json({
      status: "error",
      message: "Pertanyaan tidak boleh kosong."
    });
  }

  const answer = await handleAIAssistantQuestion(question.trim(), db);

  const suggestedQuestions = [
    "Berapa total omset hari ini?",
    "Siapa operator paling aktif minggu ini?",
    "Outlet mana yang memiliki omset tertinggi?",
    "Apakah ada setoran yang belum disetujui?",
    "Berapa banyak resi cargo yang terinput?",
    "Apakah ada selisih margin dalam transaksi?"
  ];

  return res.json({
    status: "success",
    data: {
      question,
      answer,
      timestamp: new Date().toISOString(),
      suggested_questions: suggestedQuestions
    }
  });
};

// === MASTER KATEGORI KEUANGAN ENDPOINTS ===

const handleGetKategoriKeuangan = (req: any, res: any) => {
  const db = readDb();
  const list = db.MasterKategoriKeuangan || [];
  const formatted = list.map((item: any) => ({
    id: String(item.id),
    jenis: String(item.jenis),
    nama: String(item.nama),
    aktif: Boolean(item.aktif),
    urutan: Number(item.urutan) || 0,
    created_at: item.created_at || "",
    updated_at: item.updated_at || "",
    created_by: item.created_by || ""
  }));
  formatted.sort((a: any, b: any) => a.urutan - b.urutan);
  return res.json({ status: "success", data: formatted });
};

const handleSaveKategoriKeuangan = (req: any, res: any) => {
  const db = readDb();
  const { nama, jenis, urutan, created_by } = req.body || {};
  const trimmedNama = (nama || "").trim();
  const upperJenis = (jenis || "").trim().toUpperCase();

  if (!trimmedNama) {
    return res.json({ status: "error", message: "Nama kategori wajib diisi." });
  }
  if (upperJenis !== "PEMASUKAN" && upperJenis !== "PENGELUARAN") {
    return res.json({ status: "error", message: "Jenis kategori harus PEMASUKAN atau PENGELUARAN." });
  }
  if (upperJenis === "PEMASUKAN" && (trimmedNama.toLowerCase() === "packing" || trimmedNama.toLowerCase() === "amplop")) {
    return res.json({ status: "error", message: "Kategori 'Packing' & 'Amplop' berasal dari transaksi paket dan tidak boleh dijadikan Pemasukan manual." });
  }

  const list = db.MasterKategoriKeuangan || [];
  const isDuplicate = list.some((item: any) => 
    item.jenis.toUpperCase() === upperJenis && item.nama.toLowerCase() === trimmedNama.toLowerCase()
  );
  if (isDuplicate) {
    return res.json({ status: "error", message: `Kategori '${trimmedNama}' sudah terdaftar untuk ${upperJenis}.` });
  }

  let finalUrutan = parseInt(urutan, 10);
  if (isNaN(finalUrutan)) {
    const sameJenis = list.filter((item: any) => item.jenis.toUpperCase() === upperJenis);
    finalUrutan = sameJenis.length + 1;
  }

  const newId = `KAT-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100)}`;
  const nowStr = new Date().toISOString();

  const newItem = {
    id: newId,
    jenis: upperJenis,
    nama: trimmedNama,
    aktif: true,
    urutan: finalUrutan,
    created_at: nowStr,
    updated_at: nowStr,
    created_by: created_by || "OWNER"
  };

  db.MasterKategoriKeuangan.push(newItem);
  writeDb(db);

  return res.json({ status: "success", message: "Kategori berhasil ditambahkan.", data: newItem });
};

const handleUpdateKategoriKeuangan = (req: any, res: any) => {
  const db = readDb();
  const { id, nama, urutan, aktif } = req.body || {};
  const trimmedId = (id || "").trim();
  const trimmedNama = (nama || "").trim();

  if (!trimmedId) {
    return res.json({ status: "error", message: "ID kategori wajib diisi." });
  }
  if (!trimmedNama) {
    return res.json({ status: "error", message: "Nama kategori tidak boleh kosong." });
  }

  const list = db.MasterKategoriKeuangan || [];
  const target = list.find((item: any) => item.id === trimmedId);
  if (!target) {
    return res.json({ status: "error", message: "Kategori tidak ditemukan." });
  }

  if (target.jenis.toUpperCase() === "PEMASUKAN" && (trimmedNama.toLowerCase() === "packing" || trimmedNama.toLowerCase() === "amplop")) {
    return res.json({ status: "error", message: "Kategori 'Packing' & 'Amplop' berasal dari transaksi paket dan tidak boleh dijadikan Pemasukan manual." });
  }

  const isDuplicate = list.some((item: any) => 
    item.id !== trimmedId && item.jenis.toUpperCase() === target.jenis.toUpperCase() && item.nama.toLowerCase() === trimmedNama.toLowerCase()
  );
  if (isDuplicate) {
    return res.json({ status: "error", message: `Kategori '${trimmedNama}' sudah ada untuk ${target.jenis}.` });
  }

  target.nama = trimmedNama;
  if (!isNaN(parseInt(urutan, 10))) {
    target.urutan = parseInt(urutan, 10);
  }
  if (aktif !== undefined) {
    target.aktif = Boolean(aktif);
  }
  target.updated_at = new Date().toISOString();

  writeDb(db);
  return res.json({ status: "success", message: "Kategori berhasil diperbarui.", data: target });
};

const handleSetKategoriAktif = (req: any, res: any) => {
  const db = readDb();
  const { id, aktif } = req.body || {};
  const trimmedId = (id || "").trim();

  if (!trimmedId) {
    return res.json({ status: "error", message: "ID kategori wajib diisi." });
  }

  const list = db.MasterKategoriKeuangan || [];
  const target = list.find((item: any) => item.id === trimmedId);
  if (!target) {
    return res.json({ status: "error", message: "Kategori tidak ditemukan." });
  }

  target.aktif = aktif !== undefined ? Boolean(aktif) : !target.aktif;
  target.updated_at = new Date().toISOString();

  writeDb(db);
  return res.json({ status: "success", message: "Status kategori berhasil diperbarui." });
};

app.post("/api/dailySummary", handleDailySummaryRequest);
app.post("/api/apiDailySummary", handleDailySummaryRequest);

app.post("/api/detectAnomalies", handleDetectAnomaliesRequest);
app.post("/api/apiDetectAnomalies", handleDetectAnomaliesRequest);

app.post("/api/askAssistant", handleAskAssistantRequest);
app.post("/api/apiAskAssistant", handleAskAssistantRequest);

app.get("/api/getKategoriKeuangan", handleGetKategoriKeuangan);
app.post("/api/getKategoriKeuangan", handleGetKategoriKeuangan);
app.post("/api/saveKategoriKeuangan", handleSaveKategoriKeuangan);
app.post("/api/updateKategoriKeuangan", handleUpdateKategoriKeuangan);
app.post("/api/setKategoriAktif", handleSetKategoriAktif);

// === KEUANGAN OUTLET (LEDGER) ENDPOINTS ===

const handleGetKeuanganOutlet = (req: any, res: any) => {
  const db = readDb();
  const params = { ...req.query, ...req.body };
  const list = db.KeuanganOutlet || [];
  const catList = db.MasterKategoriKeuangan || [];
  const outletList = db.Outlets || [];

  const catMap: Record<string, any> = {};
  catList.forEach((c: any) => { catMap[c.id] = c; });

  const outletMap: Record<string, string> = {};
  outletList.forEach((o: any) => { outletMap[o.outlet_id] = o.nama_outlet || o.outlet_id; });

  let filtered = list.filter((item: any) => {
    const isAktif = item.aktif === true || item.aktif === "TRUE" || item.aktif === "true" || item.aktif === undefined;
    if (!isAktif && !params.include_inactive) return false;

    const itemTanggal = (item.tanggal || "").toString().slice(0, 10);
    if (params.tanggal_awal && itemTanggal < params.tanggal_awal) return false;
    if (params.tanggal_akhir && itemTanggal > params.tanggal_akhir) return false;

    if (params.outlet_id && params.outlet_id !== "ALL" && item.outlet_id !== params.outlet_id) return false;
    if (params.jenis && params.jenis !== "ALL" && (item.jenis || "").toUpperCase() !== params.jenis.toUpperCase()) return false;
    if (params.kategori_id && params.kategori_id !== "ALL" && item.kategori_id !== params.kategori_id) return false;

    return true;
  });

  const formatted = filtered.map((item: any) => {
    const catObj = catMap[item.kategori_id] || {};
    return {
      id: String(item.id),
      tanggal: String(item.tanggal || "").slice(0, 10),
      outlet_id: String(item.outlet_id || ""),
      nama_outlet: outletMap[item.outlet_id] || item.outlet_id || "",
      jenis: String(item.jenis || catObj.jenis || "PENGELUARAN").toUpperCase(),
      kategori_id: String(item.kategori_id || ""),
      kategori_nama: catObj.nama || item.kategori_id || "-",
      nominal: Number(item.nominal) || 0,
      deskripsi: String(item.deskripsi || ""),
      bukti_url: String(item.bukti_url || ""),
      dibuat_oleh: String(item.dibuat_oleh || ""),
      created_at: String(item.created_at || ""),
      aktif: item.aktif !== false && item.aktif !== "FALSE"
    };
  });

  formatted.sort((a: any, b: any) => {
    if (a.created_at && b.created_at) {
      return b.created_at.localeCompare(a.created_at);
    }
    return b.tanggal.localeCompare(a.tanggal);
  });

  return res.json({ status: "success", data: formatted });
};

// Helper to check if an outlet date is closed via Daily Closing
function isOutletDateClosed(db: any, outletId: string, tanggal: string): boolean {
  if (!outletId || !tanggal) return false;
  const setorans = db.Master_Setoran || [];
  return setorans.some((s: any) => s.outlet_id === outletId && (s.tanggal || "").toString().slice(0, 10) === tanggal && s.closing_status === "CLOSED");
}

const handleSaveKeuanganOutlet = (req: any, res: any) => {
  const db = readDb();
  const { kategori_id, nominal, tanggal, outlet_id, deskripsi, bukti_url, dibuat_oleh, user_id, user_role, role } = req.body || {};

  const currentRole = (user_role || role || "").toUpperCase();
  if (currentRole && currentRole !== "OWNER" && currentRole !== "ADMIN") {
    return res.json({ status: "error", message: "Akses ditolak. Perlu wewenang Owner atau Admin." });
  }

  const trimmedKategoriId = (kategori_id || "").trim();
  const numNominal = Number(nominal) || 0;
  const trimmedTanggal = (tanggal || "").trim().slice(0, 10);
  const trimmedOutletId = (outlet_id || "").trim();

  if (!trimmedKategoriId) return res.json({ status: "error", message: "Kategori wajib dipilih." });
  if (!trimmedTanggal) return res.json({ status: "error", message: "Tanggal wajib diisi (YYYY-MM-DD)." });
  if (!trimmedOutletId) return res.json({ status: "error", message: "Outlet wajib dipilih." });
  if (numNominal <= 0) return res.json({ status: "error", message: "Nominal harus lebih besar dari 0." });

  // Daily Closing check
  if (isOutletDateClosed(db, trimmedOutletId, trimmedTanggal)) {
    return res.json({ status: "error", message: "Kas outlet hari tersebut sudah ditutup." });
  }

  const catList = db.MasterKategoriKeuangan || [];
  const catObj = catList.find((c: any) => c.id === trimmedKategoriId);

  if (!catObj) return res.json({ status: "error", message: "Kategori tidak ditemukan." });
  if (!catObj.aktif) return res.json({ status: "error", message: `Kategori '${catObj.nama}' sedang tidak aktif.` });

  const upperJenis = String(catObj.jenis).toUpperCase();
  const newId = `KNG-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100)}`;
  const nowStr = new Date().toISOString();

  const newItem = {
    id: newId,
    tanggal: trimmedTanggal,
    outlet_id: trimmedOutletId,
    jenis: upperJenis,
    kategori_id: trimmedKategoriId,
    nominal: numNominal,
    deskripsi: (deskripsi || "").trim(),
    bukti_url: (bukti_url || "").trim(),
    dibuat_oleh: dibuat_oleh || user_id || currentRole || "SYSTEM",
    created_at: nowStr,
    aktif: true
  };

  if (!db.KeuanganOutlet) db.KeuanganOutlet = [];
  db.KeuanganOutlet.push(newItem);
  writeDb(db);

  return res.json({ status: "success", message: "Catatan keuangan berhasil disimpan.", data: newItem });
};

const handleUpdateKeuanganOutlet = (req: any, res: any) => {
  const db = readDb();
  const { id, kategori_id, nominal, tanggal, outlet_id, deskripsi, bukti_url, user_role, role } = req.body || {};

  const currentRole = (user_role || role || "").toUpperCase();
  if (currentRole && currentRole !== "OWNER" && currentRole !== "ADMIN") {
    return res.json({ status: "error", message: "Akses ditolak. Perlu wewenang Owner atau Admin." });
  }

  const trimmedId = (id || "").trim();
  const trimmedKategoriId = (kategori_id || "").trim();
  const numNominal = Number(nominal) || 0;
  const trimmedTanggal = (tanggal || "").trim().slice(0, 10);
  const trimmedOutletId = (outlet_id || "").trim();

  if (!trimmedId) return res.json({ status: "error", message: "ID transaksi keuangan wajib diisi." });
  if (!trimmedKategoriId) return res.json({ status: "error", message: "Kategori wajib dipilih." });
  if (!trimmedTanggal) return res.json({ status: "error", message: "Tanggal wajib diisi (YYYY-MM-DD)." });
  if (numNominal <= 0) return res.json({ status: "error", message: "Nominal harus lebih besar dari 0." });

  const list = db.KeuanganOutlet || [];
  const target = list.find((item: any) => item.id === trimmedId);
  if (!target) return res.json({ status: "error", message: "Catatan keuangan tidak ditemukan." });

  // Daily Closing check for existing target date/outlet and updated date/outlet
  const targetOldTanggal = (target.tanggal || "").toString().slice(0, 10);
  if (isOutletDateClosed(db, target.outlet_id, targetOldTanggal) || isOutletDateClosed(db, trimmedOutletId || target.outlet_id, trimmedTanggal)) {
    return res.json({ status: "error", message: "Kas outlet hari tersebut sudah ditutup." });
  }

  const catList = db.MasterKategoriKeuangan || [];
  const catObj = catList.find((c: any) => c.id === trimmedKategoriId);

  if (!catObj) return res.json({ status: "error", message: "Kategori tidak ditemukan." });
  if (!catObj.aktif) return res.json({ status: "error", message: `Kategori '${catObj.nama}' sedang tidak aktif.` });

  target.tanggal = trimmedTanggal;
  target.jenis = String(catObj.jenis).toUpperCase();
  target.kategori_id = trimmedKategoriId;
  target.nominal = numNominal;
  target.deskripsi = (deskripsi || "").trim();
  target.bukti_url = (bukti_url || "").trim();
  if (trimmedOutletId) {
    target.outlet_id = trimmedOutletId;
  }

  writeDb(db);
  return res.json({ status: "success", message: "Catatan keuangan berhasil diperbarui.", data: target });
};

const handleDeleteKeuanganOutlet = (req: any, res: any) => {
  const db = readDb();
  const { id, user_role, role } = req.body || {};
  const currentRole = (user_role || role || "").toUpperCase();
  if (currentRole && currentRole !== "OWNER" && currentRole !== "ADMIN") {
    return res.json({ status: "error", message: "Akses ditolak. Perlu wewenang Owner atau Admin." });
  }

  const trimmedId = (id || "").trim();

  if (!trimmedId) return res.json({ status: "error", message: "ID transaksi keuangan wajib diisi." });

  const list = db.KeuanganOutlet || [];
  const target = list.find((item: any) => item.id === trimmedId);
  if (!target) return res.json({ status: "error", message: "Catatan keuangan tidak ditemukan." });

  // Daily Closing check
  const targetOldTanggal = (target.tanggal || "").toString().slice(0, 10);
  if (isOutletDateClosed(db, target.outlet_id, targetOldTanggal)) {
    return res.json({ status: "error", message: "Kas outlet hari tersebut sudah ditutup." });
  }

  target.aktif = false;
  writeDb(db);
  return res.json({ status: "success", message: "Catatan keuangan berhasil dinonaktifkan." });
};

app.get("/api/getKeuanganOutlet", handleGetKeuanganOutlet);
app.post("/api/getKeuanganOutlet", handleGetKeuanganOutlet);
app.post("/api/saveKeuanganOutlet", handleSaveKeuanganOutlet);
app.post("/api/updateKeuanganOutlet", handleUpdateKeuanganOutlet);
app.post("/api/deleteKeuanganOutlet", handleDeleteKeuanganOutlet);



// === PRODUCTION STANDALONE INTEGRATION ===

if (!isVercel && process.env.NODE_ENV === "production") {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server J&T OPS PRO running on http://localhost:${PORT}`);
  });
}

export default app;
