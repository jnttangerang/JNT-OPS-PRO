import { getOwnerClosingSummary } from "./src/lib/dailyClosingEngine";
const db = {
  MASTER_TRANSAKSI: [{
    outlet_id: "OUT-002",
    admin_id: "USR_1786776882250",
    tanggal_transaksi: "2026-08-29",
    status_transaksi: "PAID",
    wajib_setor_owner: 19000,
    ongkir_customer: 19000,
    biaya_lain: 0,
    amplop: 2000,
    total_customer: 19000
  }],
  Users: [{ user_id: "USR_1786776882250" }]
};

console.log(JSON.stringify(getOwnerClosingSummary(db, { date_start: "2026-08-29", date_end: "2026-08-29" }), null, 2));
