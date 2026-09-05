function classifyOutletItem(nominal: number, metode: string): "OWNER" | "ADMIN" {
  if (nominal <= 0) return "ADMIN";
  const m = String(metode || "").trim().toUpperCase();
  const isDigital = m === "QRIS" || m === "TRANSFER"
                 || m === "ORDER BY APP" || m === "ORDER_BY_APP" || m === "APP";
  return isDigital ? "OWNER" : "ADMIN";
}

const matrix = [
  // [owner_metode, outlet_metode, expectedLokasiUang]
  ["Tunai", "Tunai",    "ADMIN"],  // uang outlet ada di kasir/admin
  ["Tunai", "QRIS",     "OWNER"],  // outlet dibayar QRIS → masuk OWNER
  ["QRIS",  "Tunai",    "ADMIN"],  // outlet tetap tunai
  ["QRIS",  "QRIS",     "OWNER"],  // outlet QRIS → OWNER
  ["Tunai", "",         "ADMIN"],  // tidak ada metode tambahan → default Tunai → ADMIN
  ["QRIS",  "",         "ADMIN"],  // sama, default Tunai → ADMIN (conservative)
  ["Tunai", "TRANSFER", "OWNER"],
];

let allPass = true;
for (const [ownerM, outletM, expected] of matrix) {
  const resolved = outletM || (2000 > 0 ? "Tunai" : "");
  const result = classifyOutletItem(2000, resolved);
  const pass = result === expected ? "PASS" : "FAIL";
  console.log(`${pass} owner=${ownerM} outlet=${outletM||"(kosong)"} → ${result}`);
  if (result !== expected) {
    allPass = false;
  }
}

if (!allPass) {
  process.exit(1);
}
