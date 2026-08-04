export type UserRole = "ADMIN" | "OWNER";

export interface User {
  user_id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  outlet_id_home: string;
  nama_lengkap: string;
  status_aktif: "AKTIF" | "NON-AKTIF";
  no_wa?: string;
}

export interface Outlet {
  outlet_id: string;
  nama_outlet: string;
  kode_outlet?: string;
  no_wa_outlet?: string;
  alamat_outlet: string;
  latitude?: number;
  longitude?: number;
  radius_operasional?: number;
  status_aktif?: "AKTIF" | "NON-AKTIF";
  target_resi_harian?: number;
  target_resi_bulanan?: number;
  target_express?: number;
  target_cargo?: number;
}

export interface SystemSettings {
  id: string;
  apps_script_url?: string;
  spreadsheet_id?: string;
  divisor_express?: number;
  divisor_cargo?: number;
  folder_bukti_bayar_customer?: string;
  folder_foto_paket?: string;
  folder_foto_resi?: string;
  folder_bukti_kas_masuk?: string;
  folder_bukti_kas_keluar?: string;
  folder_bukti_transfer_admin_owner?: string;
  folder_bukti_transfer_owner_dp?: string;
}


export interface MasterCustomer {
  customer_id: string;
  nama: string;
  telepon: string;
  created_at?: string;
  updated_at?: string;
  status?: "AKTIF" | "NON-AKTIF";
  // Legacy fields fallback
  nama_pengirim?: string;
  no_hp?: string;
  alamat_pengirim?: string;
  outlet_id?: string;
  last_updated?: string;
}

export interface MasterPengirim {
  id: string;
  customer_id: string;
  nama: string;
  telepon: string;
  provinsi?: string;
  kabupaten?: string;
  kecamatan?: string;
  kelurahan?: string;
  kode_pos?: string;
  alamat: string;
  jumlah_pengiriman: number;
  tanggal_pertama: string;
  tanggal_terakhir: string;
  status: "AKTIF" | "NON-AKTIF";
  created_at: string;
  updated_at: string;
  outlet_id_asal?: string;
}

export interface MasterPenerima {
  id: string;
  customer_id: string;
  nama: string;
  telepon: string;
  provinsi?: string;
  kabupaten?: string;
  kecamatan?: string;
  kelurahan?: string;
  kode_pos?: string;
  alamat: string;
  jumlah_diterima: number;
  tanggal_pertama: string;
  tanggal_terakhir: string;
  status: "AKTIF" | "NON-AKTIF";
  created_at: string;
  updated_at: string;
  outlet_id_asal?: string;
}

export interface RiwayatPenerima {
  id: string;
  customer_id: string; // foreign key to MasterCustomer
  nama_penerima: string;
  no_hp_penerima: string;
  alamat_penerima: string;
  tanggal_terakhir_kirim: string;
}

export interface PreInputBackup {
  transaksi_id: string;
  timestamp: string;
  admin_id: string;
  outlet_id_tugas: string;
  nama_pengirim: string;
  hp_pengirim: string;
  alamat_pengirim: string;
  nama_penerima: string;
  hp_penerima: string;
  alamat_penerima: string;
  alamat_penerima_asli?: string;
  alamat_asli?: string;
  catatan_admin?: string;
  nama_barang: string;
  ekspedisi?: "Express" | "Cargo";
  berat_timbangan?: number;
  panjang_cm?: number;
  lebar_cm?: number;
  tinggi_cm?: number;
  berat_volume?: number;
  dasar_berat?: "TIMBANGAN" | "VOLUME";
  berat_kg: number;
  volume: string; // format: "P x L x T"
  nilai_barang: number;
  foto_paket_url: string;
  foto_resi_url?: string;
  status: "PENDING" | "SELESAI";
}

export interface EXPResi {
  resi_id: string;
  transaksi_id: string;
  timestamp: string;
  admin_id_pencatat: string;
  outlet_id_input: string;
  ekspedisi?: "Express" | "Cargo";
  berat_timbangan?: number;
  panjang_cm?: number;
  lebar_cm?: number;
  tinggi_cm?: number;
  berat_volume?: number;
  dasar_berat?: "TIMBANGAN" | "VOLUME";
  berat_kg: number;
  tipe_produk: "DOC" | "EZ" | "JSD" | "JND" | "ECO" | "HBO";
  biaya_lain: number;
  biaya_asuransi: number;
  ongkir_dasar: number;
  biaya_yoyi: number;
  total_dibayar_customer: number;
  pembulatan: number;
  metode_bayar: "Tunai" | "QRIS" | "Transfer" | "Order by APP";
  bukti_bayar_url: string;
  biaya_amplop: number;
  biaya_packing: number;
  metode_bayar_tambahan: "Tunai" | "QRIS" | "Transfer" | "";
  bukti_tambahan_url: string;
  grand_total: number;
  setoran_ke_owner: number;
  kas_operasional: number;
}

export interface CRGResi {
  resi_id: string;
  transaksi_id: string;
  timestamp: string;
  admin_id_pencatat: string;
  outlet_id_input: string;
  ekspedisi?: "Express" | "Cargo";
  berat_timbangan?: number;
  panjang_cm?: number;
  lebar_cm?: number;
  tinggi_cm?: number;
  berat_volume?: number;
  dasar_berat?: "TIMBANGAN" | "VOLUME";
  berat_kg: number;
  tipe_produk: "FastTrack" | "Motor";
  merk_motor?: string;
  cc_motor?: number;
  tahun_motor?: number;
  kelengkapan_motor?: string; // comma-separated check items
  biaya_asuransi: number;
  ongkir_dasar: number;
  biaya_jtc: number;
  total_dibayar_customer: number;
  pembulatan: number;
  metode_bayar: "Tunai" | "QRIS" | "Transfer" | "Order by APP";
  bukti_bayar_url: string;
  biaya_amplop: number;
  biaya_packing: number;
  metode_bayar_tambahan: "Tunai" | "QRIS" | "Transfer" | "";
  bukti_tambahan_url: string;
  grand_total: number;
  setoran_ke_owner: number;
  kas_operasional: number;
}

export interface AuditLog {
  log_id: string;
  timestamp: string;
  user_id: string;
  aksi: string;
  detail: string;
  outlet_id: string;
}

export interface DashboardData {
  summary: {
    total_omset: number;
    total_transaksi: number;
    total_setoran_owner: number;
    total_kas_operasional: number;
  };
  chart_data: {
    daily_trends: Array<{
      date: string;
      Express: number;
      Cargo: number;
    }>;
    payment_shares: Array<{
      name: string;
      value: number;
    }>;
  };
  audit_logs: AuditLog[];
  monthly_reports?: Array<{
    month: string;
    total_omset: number;
    outlets: Array<{
      outlet_id: string;
      nama_outlet: string;
      omset: number;
      transaksi: number;
    }>;
  }>;
  target_harian?: {
    target: number;
    current: number;
  };
}

export interface SessionData {
  user_id: string;
  username: string;
  role: UserRole;
  outlet_id_home: string;
  nama_lengkap: string;
}

export interface DatabaseSchema {
  Users: User[];
  Outlets: Outlet[];
  Master_Customer: MasterCustomer[];
  Riwayat_Penerima: RiwayatPenerima[];
  PreInput_Backup: PreInputBackup[];
  EXP_Resi: EXPResi[];
  CRG_Resi: CRGResi[];
  AuditLogs: AuditLog[];
  SystemSettings?: SystemSettings;
  MASTER_KATEGORI_KEUANGAN?: KategoriKeuangan[];
  KEUANGAN_OUTLET?: KeuanganOutlet[];
}

export interface KategoriKeuangan {
  id: string;
  jenis: "PEMASUKAN" | "PENGELUARAN";
  nama: string;
  aktif: boolean;
  urutan: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface KeuanganOutlet {
  id: string;
  tanggal: string;
  outlet_id: string;
  jenis: "PEMASUKAN" | "PENGELUARAN";
  kategori_id: string;
  nominal: number;
  deskripsi?: string;
  bukti_url?: string;
  dibuat_oleh: string;
  created_at: string;
  aktif: boolean;
  kategori_nama?: string;
  nama_outlet?: string;
}
