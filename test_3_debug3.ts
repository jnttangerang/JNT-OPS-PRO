import { reconcileDaily } from './src/lib/reconciliationEngine';
const db = {
  MASTER_TRANSAKSI: [{
    id: "TRX-P30-01",
    no_resi: "JNT-P30-01",
    outlet_id: "OUT-A",
    tanggal_transaksi: "2026-08-07",
    created_at: "2026-08-07T10:00:00.000Z",
    status_transaksi: "PAID",
    pengirim_id: "SND-P30-01",
    penerima_id: "RCV-P30-01",
    snapshot_nama_pengirim: "Pengirim Alpha",
    snapshot_nama_penerima: "Penerima Beta",
    ongkir_customer: 25000,
    total_customer: 25000,
    packing: 0,
    amplop: 0,
    biaya_lain: 0,
    kas_outlet: 5000,
    potongan_diskon: 0,
    wajib_setor_owner: 19500
  }],
  MASTER_PENGIRIMAN: [{
    id: "SHP-P30-01",
    transaksi_id: "TRX-P30-01",
    no_resi: "JNT-P30-01",
    outlet_id: "OUT-A",
    tanggal_pengiriman: "2026-08-07",
    created_at: "2026-08-07T10:00:00.000Z",
    status_pengiriman: "PAID"
  }],
  ReconciliationExceptions: [],
  Master_Setoran: []
};
const res = reconcileDaily(db, "2026-08-07", "OUT-A");
console.log(res.exceptions);
