import { getOwnerClosingSummary } from "./src/lib/dailyClosingEngine";

// Could it be that extractBusinessDate fails if the date format is different?
console.log(getOwnerClosingSummary({
  MASTER_TRANSAKSI: [{
    tanggal_transaksi: "2026-08-29",
    //...
  }]
}, {}));
