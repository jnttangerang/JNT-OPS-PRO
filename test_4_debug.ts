import { validateDailyClosing } from './src/lib/dailyClosingEngine';
import { resolveException } from './src/lib/reconciliationReviewEngine';

const db3: any = {
  MASTER_TRANSAKSI: [{
    id: "TRX-P30-ORPHAN",
    no_resi: "JNT-P30-ORPHAN",
    outlet_id: "OUT-A",
    tanggal_transaksi: "2026-08-07",
    created_at: "2026-08-07T12:00:00.000Z",
    status_transaksi: "PAID",
    pengirim_id: "SND-P30-01",
    penerima_id: "RCV-P30-01",
    snapshot_nama_pengirim: "Pengirim Alpha",
    snapshot_nama_penerima: "Penerima Beta",
    ongkir_customer: 15000,
    total_customer: 15000,
    packing: 0,
    amplop: 0,
    biaya_lain: 0,
    kas_outlet: 0,
    potongan_diskon: 0,
    wajib_setor_owner: 15000
  }],
  MASTER_PENGIRIMAN: [],
  ReconciliationExceptions: [],
  DailyClosing: [],
  AuditTrail: [],
  Master_Setoran: [{
    id: "SET-P30-01",
    outlet_id: "OUT-A",
    tanggal: "2026-08-07",
    nominal: 15000,
    status: "DISETUJUI"
  }]
};

const actorAdmin = { actor_id: "ADM-101", actor_name: "Admin Pusat", actor_role: "ADMIN" };
validateDailyClosing(db3, { outlet_id: "OUT-A", tanggal: "2026-08-07", actor: actorAdmin });

console.log('Exceptions before resolve:', db3.ReconciliationExceptions);

for (const exc of db3.ReconciliationExceptions) {
  const r = resolveException(db3, {
    exception_id: exc.exception_id,
    resolution: "RESOLVED",
    resolution_reason: "Telah diperbaiki.",
    actor: actorAdmin
  });
  console.log('Resolve result:', r);
}

db3.MASTER_PENGIRIMAN.push({
  id: "SHP-P30-ORPHAN",
  transaksi_id: "TRX-P30-ORPHAN",
  no_resi: "JNT-P30-ORPHAN",
  outlet_id: "OUT-A",
  tanggal_pengiriman: "2026-08-07",
  created_at: "2026-08-07T12:00:00.000Z",
  status_pengiriman: "PAID",
  snapshot_nama_pengirim: "Pengirim Alpha",
  snapshot_nama_penerima: "Penerima Beta"
});

const val4 = validateDailyClosing(db3, { outlet_id: "OUT-A", tanggal: "2026-08-07", actor: actorAdmin });
console.log('Val 4 blocking reasons:', val4.blocking_reasons);
console.log('Exceptions after val 4:', db3.ReconciliationExceptions);

