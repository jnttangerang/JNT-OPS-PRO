export type UserRole = "ADMIN" | "OWNER";

export interface User {
  user_id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  outlet_id_home: string;
  nama_lengkap: string;
  status_aktif: "AKTIF" | "NON-AKTIF";
}

export interface Outlet {
  outlet_id: string;
  nama_outlet: string;
  alamat_outlet: string;
}

export interface MasterCustomer {
  customer_id: string;
  nama_pengirim: string;
  no_hp: string;
  alamat_pengirim: string;
  outlet_id: string;
  last_updated: string;
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
  berat_kg: number;
  volume: string; // format: "P x L x T"
  nilai_barang: number;
  foto_paket_url: string;
  status: "PENDING" | "SELESAI";
}

export interface EXPResi {
  resi_id: string;
  transaksi_id: string;
  timestamp: string;
  admin_id_pencatat: string;
  outlet_id_input: string;
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
}
