import { isTransactionValidForFinance, calculateFinancialSummary, calculateDailyFinancial } from "./src/lib/financialEngine";
import { extractBusinessDate } from "./src/utils/dateUtils";
import { validateDailyClosing } from "./src/lib/dailyClosingEngine";

const tx = {
  outlet_id: "OUT-002",
  admin_id: "USR_1786776882250",
  admin_name: "TIARA OLIVIA",
  tanggal_transaksi: "2026-08-29",
  no_resi: "JD0585316616",
  metode_bayar: "Tunai",
  tipe_produk: "DOC",
  ongkir_customer: 19000,
  amplop: 2000,
  total_customer: 19000,
  ongkir_yoyi: 19000,
  asuransi: 0,
  biaya_lain_yoyi: 0,
  wajib_setor_owner: 19000,
  kas_outlet: 2000,
  status_transaksi: "PAID",
  status_setoran: "PENDING",
  status_audit: "PENDING",
  status_sync: "LOCAL"
};

const db = {
  MASTER_TRANSAKSI: [tx],
  Setoran: []
};

console.log("extractBusinessDate(tx) =", extractBusinessDate(tx));
console.log("isTransactionValidForFinance(tx) =", isTransactionValidForFinance(tx));
const summary = calculateFinancialSummary(tx);
console.log("summary =", summary);

const val = validateDailyClosing(db, { outlet_id: "OUT-002", tanggal: "2026-08-29", actor: { actor_id: "X", actor_role: "OWNER" } }, { isDryRun: true });
console.log("val.data.total_owner_deposit =", val.data?.total_owner_deposit);
console.log("val.data.admin_breakdown =", JSON.stringify(val.data?.admin_breakdown, null, 2));

