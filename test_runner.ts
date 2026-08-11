import fetch from "node-fetch";

const API_URL = "http://localhost:3000/api";

async function runTests() {
  console.log("Starting End-to-End Runtime Validation...\n");

  let txId = "";
  let resiId = "RESI-" + Date.now();
  let pengirimHp = "081234567890";
  let penerimaHp = "089876543210";

  // Test 1: Pre Input (DRAFT)
  console.log("--- TEST 1: CREATE DRAFT (Pre Input) ---");
  const preInputRes = await fetch(`${API_URL}/saveDataPreInput`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nama_pengirim: "Budi",
      hp_pengirim: pengirimHp,
      alamat_pengirim: "Jakarta",
      nama_penerima: "Susi",
      hp_penerima: penerimaHp,
      alamat_penerima: "Bandung",
      berat_kg: 1,
      admin_id: "ADMIN-1",
      outlet_id_tugas: "OUT-001"
    })
  });
  const preInputData: any = await preInputRes.json();
  console.log("Pre Input Result:", preInputData);
  txId = preInputData.transaksi_id || preInputData.data?.transaksi_id;

  // Let's get the transaction from db
  // Since db is in memory or local, let's add a debug endpoint or we can use getRiwayatTransaksi
  const riwayatRes = await fetch(`${API_URL}/getRiwayatTransaksi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit: 100 })
  });
  const riwayatData: any = await riwayatRes.json();
  const txRecord = riwayatData.data?.find((t: any) => t.transaksi_id === txId || t.id === txId);
  console.log("Transaction Record after Pre Input:", txRecord);


  // Test 2: Resi & Bayar (PAID)
  console.log("\n--- TEST 2: RESI & BAYAR (PAID) ---");
  const saveTxRes = await fetch(`${API_URL}/saveTransaksi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transaksi_id: txId,
      resi_id: resiId,
      nama_pengirim: "Budi",
      hp_pengirim: pengirimHp,
      alamat_pengirim: "Jakarta",
      nama_penerima: "Susi",
      hp_penerima: penerimaHp,
      alamat_penerima: "Bandung",
      berat_kg: 1,
      admin_id_pencatat: "ADMIN-1",
      outlet_id_input: "OUT-001",
      ekspedisi: "Express",
      tipe_produk: "Reguler",
      grand_total: 10000,
      total_dibayar_customer: 10000
    })
  });
  const saveTxData = await saveTxRes.json();
  console.log("Save Transaksi Result:", saveTxData);

  // Test 3: Delete Transaction (CANCELLED)
  console.log("\n--- TEST 3: DELETE TRANSACTION (CANCELLED) ---");
  const delRes = await fetch(`${API_URL}/deleteTransaksi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transaksi_id: txId,
      user_id: "ADMIN-1",
      outlet_id: "OUT-001"
    })
  });
  const delData = await delRes.json();
  console.log("Delete Result:", delData);

}

runTests().catch(console.error);
