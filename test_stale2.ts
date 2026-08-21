import { getDailyClosingStatus, validateDailyClosing } from './src/lib/dailyClosingEngine';

let db: any = {
  MASTER_TRANSAKSI: [],
  DailyClosing: [{
    closing_id: "CLS-OUT-TEST-2026-08-21",
    outlet_id: "OUT-TEST",
    tanggal: "2026-08-21",
    status: "CLOSED",
    total_owner_deposit: 0,
    total_outlet_cash: 0,
    created_at: new Date().toISOString()
  }]
};

// 1. Add a new transaction AFTER the closing was CLOSED
db.MASTER_TRANSAKSI.push({
  id: 'TX-1',
  outlet_id: 'OUT-TEST',
  tanggal_transaksi: '2026-08-21',
  status_transaksi: 'PAID',
  wajib_setor_owner: 18000,
  kas_outlet: 10000,
  total_customer: 28000
});

// 2. Now get status again. Should return 0 since it is CLOSED.
let res = getDailyClosingStatus(db, 'OUT-TEST', '2026-08-21');
console.log('After new tx (CLOSED):', res.data.total_owner_deposit, res.data.total_outlet_cash);
