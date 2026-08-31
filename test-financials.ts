import { calculateFinancialSummary } from './src/lib/financialEngine';

// CASE A - Tunai
const txTunai = {
  resi_id: "JD0585403447",
  metode_bayar: "Tunai",
  ongkir_dasar: 11000,
  asuransi: 1000,
  pembulatan: 0,
  packing: 15000,
  amplop: 0,
  total_customer: 27000,
  wajib_setor_owner: 12000
};

// CASE B - QRIS/Transfer
const txQris = {
  resi_id: "JD_QRIS_123",
  metode_bayar: "QRIS",
  ongkir_dasar: 11000,
  asuransi: 1000,
  pembulatan: 0,
  packing: 15000,
  amplop: 0,
  total_customer: 27000,
  wajib_setor_owner: 12000
};

console.log("=== CASE A: TUNAI ===");
const sumTunai = calculateFinancialSummary(txTunai as any);
console.log(sumTunai);

console.log("\n=== CASE B: QRIS ===");
const sumQris = calculateFinancialSummary(txQris as any);
console.log(sumQris);
