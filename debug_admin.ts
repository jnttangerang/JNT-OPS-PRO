import { calculateAdminFinancial } from "./src/lib/financialEngine";
const txA = [
    { transaksi_id: "TX-1", outlet_id: "OUT-A", tanggal_transaksi: "2026-08-01", no_resi: "RESI-1", status_transaksi: "SUCCESS", grand_total: 10000, ongkir_dasar: 10000, layanan: "EZ", admin_id: "ADM-1" },
    { transaksi_id: "TX-2", outlet_id: "OUT-A", tanggal_transaksi: "2026-08-01", no_resi: "RESI-2", status_transaksi: "SUCCESS", grand_total: 15000, ongkir_dasar: 15000, layanan: "JTR", admin_id: "ADM-2" }
];
const txB = [
    { transaksi_id: "TX-3", outlet_id: "OUT-B", tanggal_transaksi: "2026-08-01", no_resi: "RESI-3", status_transaksi: "SUCCESS", grand_total: 20000, ongkir_dasar: 20000, layanan: "EZ", admin_id: "ADM-1" }
];
console.log("OUT-A:", JSON.stringify(calculateAdminFinancial(txA), null, 2));
console.log("OUT-B:", JSON.stringify(calculateAdminFinancial(txB), null, 2));
