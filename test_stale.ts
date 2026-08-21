import { getDailyClosingStatus, validateDailyClosing } from './src/lib/dailyClosingEngine';

let db: any = {
  MASTER_TRANSAKSI: [],
  DailyClosing: []
};

// 1. Validating when empty -> should return READY/BLOCKED with 0
let res = getDailyClosingStatus(db, 'OUT-TEST', '2026-08-21');
console.log('Empty snapshot:', res.data.total_owner_deposit, res.data.total_outlet_cash);

// 2. Now let's save a DailyClosing record to simulate existing record (like when someone validated earlier)
validateDailyClosing(db, { outlet_id: 'OUT-TEST', tanggal: '2026-08-21', actor: { actor_id: 'SYSTEM', actor_role: 'SYSTEM' } });

// 3. Add a new transaction AFTER the closing was created
db.MASTER_TRANSAKSI.push({
  id: 'TX-1',
  outlet_id: 'OUT-TEST',
  tanggal_transaksi: '2026-08-21',
  status_transaksi: 'PAID',
  wajib_setor_owner: 18000,
  kas_outlet: 10000,
  total_customer: 28000
});

// 4. Now get status again. Before fix, this would return 0. After fix, it should return 18000 and 10000.
res = getDailyClosingStatus(db, 'OUT-TEST', '2026-08-21');
console.log('After new tx:', res.data.total_owner_deposit, res.data.total_outlet_cash);
