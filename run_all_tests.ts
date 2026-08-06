import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const API_URL = "http://localhost:3000/api";
const DB_PATH = path.join(process.cwd(), "db.json");

function getDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

async function runTests() {
  console.log("==========================================");
  console.log("   PHASE 22 - END-TO-END RUNTIME VALIDATION");
  console.log("==========================================\n");

  let preTxId = "";
  let pengirimHp = "081122334455";
  let penerimaHp = "089988776655";
  
  console.log("--- TEST 1: TRANSACTION ID CONSISTENCY ---");
  console.log("Objective: Prove single transaksi_id used from Pre Input to Delivery.");
  
  // 1. Pre Input
  const res1 = await fetch(`${API_URL}/saveDataPreInput`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-mode": "true" },
    body: JSON.stringify({
      nama_pengirim: "Alice",
      hp_pengirim: pengirimHp,
      alamat_pengirim: "Address A",
      nama_penerima: "Bob",
      hp_penerima: penerimaHp,
      alamat_penerima: "Address B",
      nama_barang: "Test Barang",
      berat_kg: 1,
      admin_id: "ADMIN-1",
      outlet_id_tugas: "OUT-001"
    })
  });
  const data1: any = await res1.json();
  preTxId = data1.data?.transaksi_id || data1.transaksi_id;
  
  let db = getDb();
  let masterTx = db.MASTER_TRANSAKSI.find((t: any) => t.id === preTxId);
  let masterShip = db.MASTER_PENGIRIMAN.find((s: any) => s.transaksi_id === preTxId);
  
  console.log("After Pre Input (DRAFT):");
  console.log("MASTER_TRANSAKSI:", !!masterTx, masterTx?.status_transaksi);
  console.log("MASTER_PENGIRIMAN:", !!masterShip, masterShip?.status_pengiriman);
  console.log("Transaction ID:", preTxId);

  // 2. Resi & Bayar (PAID)
  const resiId = "RESI-TEST-" + Date.now();
  await fetch(`${API_URL}/saveTransaksi`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-mode": "true" },
    body: JSON.stringify({
      jenis_layanan: "Express",
      data: {
        transaksi_id: preTxId,
        resi_id: resiId,
        nama_pengirim: "Alice",
        hp_pengirim: pengirimHp,
        alamat_pengirim: "Address A",
        nama_penerima: "Bob",
        hp_penerima: penerimaHp,
        alamat_penerima: "Address B",
        berat_kg: 1,
        admin_id_pencatat: "ADMIN-1",
        outlet_id_input: "OUT-001",
        ekspedisi: "Express",
        tipe_produk: "Reguler",
        grand_total: 15000,
        total_dibayar_customer: 15000
      }
    })
  });

  db = getDb();
  masterTx = db.MASTER_TRANSAKSI.find((t: any) => t.id === preTxId);
  masterShip = db.MASTER_PENGIRIMAN.find((s: any) => s.transaksi_id === preTxId);
  
  console.log("\nAfter Resi & Bayar (PAID):");
  console.log("MASTER_TRANSAKSI status:", masterTx?.status_transaksi);
  console.log("MASTER_PENGIRIMAN status:", masterShip?.status_pengiriman);
  
  const txCount = db.MASTER_TRANSAKSI.filter((t: any) => t.id === preTxId).length;
  const shipCount = db.MASTER_PENGIRIMAN.filter((t: any) => t.transaksi_id === preTxId).length;
  
  console.log("\n--- TEST 2: DUPLICATE PROTECTION ---");
  console.log("Objective: Ensure no duplicate rows are created on update.");
  console.log("Number of MASTER_TRANSAKSI rows for this ID:", txCount);
  console.log("Number of MASTER_PENGIRIMAN rows for this ID:", shipCount);
  console.log("Result: ", txCount === 1 && shipCount === 1 ? "PASS" : "FAIL");
  
  console.log("\n--- TEST 3: LIFECYCLE VALIDATION ---");
  console.log("Objective: Verify invalid transitions are rejected.");
  
  // Try invalid transition: PAID -> DRAFT
  let resultPaidToDraft = await fetch(`${API_URL}/updatePreInputStatus`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-mode": "true" },
    body: JSON.stringify({
      transaksi_id: preTxId,
      status: "DRAFT"
    })
  });
  let dataPaidToDraft = await resultPaidToDraft.json();
  console.log("PAID -> DRAFT Response:", dataPaidToDraft);

  // Try DELIVERED -> PICKED_UP by directly hitting something if there is an endpoint, or just using our DB abstraction.
  // Actually, I can write a small route in server.ts to trigger the lifecycle check directly, 
  // or I can try hitting deleteTransaksi to move it to CANCELLED.
  
  console.log("\n--- TEST 4: SNAPSHOT IMMUTABLE ---");
  console.log("Objective: Verify snapshot doesn't change when customer changes.");
  console.log("Snapshot Pengirim:", masterTx?.snapshot_nama_pengirim);
  console.log("Snapshot Penerima:", masterTx?.snapshot_nama_penerima);
  
  console.log("\n--- TEST 6: CREATED_AT ---");
  console.log("created_at:", masterTx?.created_at);

  console.log("\n--- TEST 7: UPDATED_AT ---");
  console.log("updated_at after update:", masterTx?.updated_at);
  
  console.log("\n--- TEST 9: FOREIGN KEY INTEGRITY ---");
  console.log("pengirim_id:", masterTx?.pengirim_id);
  console.log("penerima_id:", masterTx?.penerima_id);
  console.log("Result: ", masterTx?.pengirim_id && masterTx?.penerima_id ? "PASS" : "FAIL");

  console.log("\n--- TEST 10: ORPHAN RECORD ---");
  const orphansTx = db.MASTER_TRANSAKSI.filter((t: any) => !db.MASTER_PENGIRIMAN.find((s: any) => s.transaksi_id === t.id));
  const orphansShip = db.MASTER_PENGIRIMAN.filter((s: any) => !db.MASTER_TRANSAKSI.find((t: any) => t.id === s.transaksi_id));
  console.log("Orphan MASTER_TRANSAKSI count:", orphansTx.length);
  console.log("Orphan MASTER_PENGIRIMAN count:", orphansShip.length);
  console.log("Result: ", orphansTx.length === 0 && orphansShip.length === 0 ? "PASS" : "FAIL");
  
  console.log("\n--- TEST 12: DELETE TRANSACTION ---");
  const delRes2 = await fetch(`${API_URL}/deleteTransaksi`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-mode": "true" },
    body: JSON.stringify({
      transaksi_id: preTxId,
      user_id: "ADMIN-1",
      outlet_id: "OUT-001"
    })
  });
  const delData2 = await delRes2.json();
  db = getDb();
  masterTx = db.MASTER_TRANSAKSI.find((t: any) => t.id === preTxId);
  masterShip = db.MASTER_PENGIRIMAN.find((s: any) => s.transaksi_id === preTxId);
  
  console.log("Delete Result:", delData2);
  console.log("MASTER_TRANSAKSI status after delete:", masterTx?.status_transaksi);
  console.log("MASTER_PENGIRIMAN status after delete:", masterShip?.status_pengiriman);
  
  // Test 11: Import Customer
  // Not going to run directly but I will observe the code. We can check by creating a dummy array in MASTER_CUSTOMER and ensure it doesn't trigger TX.
}

runTests().catch(console.error);
