import { calculateFinancialSummary } from "./src/lib/financialEngine.js";

const base = {
  ongkir_yoyi: 8300, biaya_lain_yoyi: 0, asuransi: 0,
  amplop: 2000, packing: 0, status_transaksi: "PAID"
};

const cases = [
  { ...base, metode_bayar: "Tunai",    metode_bayar_tambahan: "Tunai",    label: "Tunai+Tunai" },
  { ...base, metode_bayar: "Tunai",    metode_bayar_tambahan: "QRIS",     label: "Tunai+QRIS" },
  { ...base, metode_bayar: "QRIS",     metode_bayar_tambahan: "Tunai",    label: "QRIS+Tunai" },
  { ...base, metode_bayar: "QRIS",     metode_bayar_tambahan: "QRIS",     label: "QRIS+QRIS" },
];

for (const c of cases) {
  const r = calculateFinancialSummary(c);
  console.log(c.label, {
    cash: r.cash_payment,
    digital: r.digital_payment,
    outlet_admin: r.outlet_right_admin,
    outlet_owner: r.outlet_right_owner,
    total_check: (r.cash_payment + r.digital_payment + r.outlet_right_admin + r.outlet_right_owner)
  });
}
