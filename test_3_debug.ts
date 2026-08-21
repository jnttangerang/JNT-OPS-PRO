import { validateDailyClosing } from './src/lib/dailyClosingEngine';
import { reconcileDaily } from './src/lib/reconciliationEngine';
import { syncReconciliationExceptions, getClosingReconciliationStatus } from './src/lib/reconciliationReviewEngine';

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
    wajib_setor_owner: 19500 // Original 20000, minus 500
  }],
  MASTER_PENGIRIMAN: [{
    id: "SHP-P30-01",
    transaksi_id: "TRX-P30-01",
    no_resi: "JNT-P30-01",
    outlet_id: "OUT-A",
    tanggal_pengiriman: "2026-08-07",
    created_at: "2026-08-07T10:00:00.000Z",
    status_pengiriman: "PAID",
    snapshot_nama_pengirim: "Pengirim Alpha",
    snapshot_nama_penerima: "Penerima Beta"
  }],
  ReconciliationExceptions: [],
  DailyClosing: [],
  AuditTrail: [],
  Master_Setoran: [{
    id: "SET-P30-01",
    outlet_id: "OUT-A",
    tanggal: "2026-08-07",
    nominal: 20000,
    status: "DISETUJUI"
  }]
};

// First run validateDailyClosing
const val3 = validateDailyClosing(db, { outlet_id: "OUT-A", tanggal: "2026-08-07", actor: { actor_id: "SYSTEM", actor_role: "SYSTEM" } });
console.log('val3 blocking_reasons:', val3.blocking_reasons);

