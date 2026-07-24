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
      status_aktif: "AKTIF"
    },
    {
      user_id: "USR-002",
      username: "admin2",
      password_hash: "hash_admin123",
      role: "ADMIN",
      outlet_id_home: "OUT-002",
      nama_lengkap: "Budi Santoso (Cikokol)",
      status_aktif: "AKTIF"
    },
    {
      user_id: "USR-003",
      username: "owner1",
      password_hash: "hash_owner123",
      role: "OWNER",
      outlet_id_home: "OUT-001",
      nama_lengkap: "Hendra Wijaya (Owner)",
      status_aktif: "AKTIF"
    }
  ],
  Outlets: [
    {
      outlet_id: "OUT-001",
      nama_outlet: "J&T Express - Tangerang Karawaci",
      alamat_outlet: "Jl. Karawaci Raya No.12, Karawaci, Tangerang"
    },
    {
      outlet_id: "OUT-002",
      nama_outlet: "J&T Express - Tangerang Cikokol",
      alamat_outlet: "Jl. M.H. Thamrin No.8, Cikokol, Tangerang"
    },
    {
      outlet_id: "OUT-003",
      nama_outlet: "J&T Cargo - Tangerang Balaraja",
      alamat_outlet: "Jl. Raya Serang Km 24, Balaraja, Tangerang"
    }
  ],
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

function readDb() {
  if (!fs.existsSync(dbPath)) {
    const dbToSave = { ...initialDb, MapsReviews: defaultReviews };
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
    if (updated) {
      fs.writeFileSync(dbPath, JSON.stringify(parsed, null, 2));
    }
    return parsed;
  } catch (e) {
    console.error("Error reading database file, resetting to initial state", e);
    const dbToSave = { ...initialDb, MapsReviews: defaultReviews };
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
        db.Outlets[idx].target_resi_harian = newOutlet.target_resi_harian;
        db.Outlets[idx].target_resi_bulanan = newOutlet.target_resi_bulanan;
      }
    });
    writeDb(db);
    return res.json({ status: "success", message: "Pengaturan berhasil disimpan" });
  }

  return res.status(400).json({ status: "error", message: "Data tidak valid" });
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
    berat_kg: Number(berat_kg) || 0,
    volume: volume || "0 x 0 x 0",
    nilai_barang: Number(nilai_barang) || 0,
    foto_paket_url: foto_paket_url || "",
    foto_resi_url: foto_resi_url || "",
    status: "PENDING" as const
  };
  db.PreInput_Backup.unshift(newPreInput);

  // 2. Add or update Master_Customer
  let customer = db.Master_Customer.find(
    (c: any) => c.no_hp === hp_pengirim
  );

  const nowStr = new Date().toISOString();
  if (customer) {
    customer.nama_pengirim = nama_pengirim;
    customer.alamat_pengirim = alamat_pengirim;
    customer.outlet_id = outlet_id_tugas || customer.outlet_id;
    customer.last_updated = nowStr;
  } else {
    customer = {
      customer_id: "CST-" + String(Date.now()).slice(-5),
      nama_pengirim,
      no_hp: hp_pengirim,
      alamat_pengirim,
      outlet_id: outlet_id_tugas || "OUT-001",
      last_updated: nowStr
    };
    db.Master_Customer.push(customer);
  }

  // 3. Add or update Riwayat_Penerima
  let rPenerima = db.Riwayat_Penerima.find(
    (r: any) => r.customer_id === customer.customer_id && r.no_hp_penerima === hp_penerima
  );

  if (rPenerima) {
    rPenerima.nama_penerima = nama_penerima;
    rPenerima.alamat_penerima = alamat_penerima;
    rPenerima.tanggal_terakhir_kirim = nowStr;
  } else {
    rPenerima = {
      id: "REC-" + String(Date.now()).slice(-5) + Math.floor(Math.random() * 10),
      customer_id: customer.customer_id,
      nama_penerima,
      no_hp_penerima: hp_penerima,
      alamat_penerima,
      tanggal_terakhir_kirim: nowStr
    };
    db.Riwayat_Penerima.push(rPenerima);
  }

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
  if (data.transaksi_id) {
    const pre = db.PreInput_Backup.find((p: any) => p.transaksi_id === data.transaksi_id);
    if (pre) {
      pre.status = "SELESAI";
    }
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
    total_kas_operasional: totalKasOperasional
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
    targetTotal = outlet?.target_resi_harian || 50;
  } else {
    targetTotal = outlets.reduce((sum: number, o: any) => sum + (o.target_resi_harian || 50), 0);
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
