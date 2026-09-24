async function runUAT() {
  const API_BASE = "http://localhost:3000/api";
  console.log("--- STARTING PHASE 6 STEP 1 FINAL UAT ---");

  const sampleRows = [
    {
      outlet_id: "OUT-001",
      admin_id_terkait: "USR-002",
      tanggal_serah_terima: "2026-09-24",
      resi_id: "JD0591361094",
      sumber_order: "YoYi-WEB",
      waktu_pemesanan: "2026-09-24 11:20:00",
      metode_perhitungan: "Biaya oleh pengirim",
      status_waybill: "Delivered",
      waktu_serah_terima: "2026-09-24 13:00:00",
      operator_yoyi: "YOYI-OP-01",
      total_yoyi: 16400,
      imported_by: "owner"
    },
    {
      outlet_id: "OUT-001",
      admin_id_terkait: "USR-002",
      tanggal_serah_terima: "2026-09-24",
      resi_id: "JD0591209119",
      sumber_order: "YoYi-WEB",
      waktu_pemesanan: "2026-09-24 11:25:00",
      metode_perhitungan: "DFOD",
      status_waybill: "Delivered",
      waktu_serah_terima: "2026-09-24 13:05:00",
      operator_yoyi: "YOYI-OP-01",
      total_yoyi: 18200,
      imported_by: "owner"
    }
  ];

  console.log("\n1. POST /api/saveAuditYoyiBatch with 2 sample rows...");
  const saveRes = await fetch(`${API_BASE}/saveAuditYoyiBatch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_role: "OWNER",
      rows: sampleRows
    })
  });
  
  const saveResult = await saveRes.json();
  console.log("POST Response status:", saveRes.status);
  console.log("POST Response body:", JSON.stringify(saveResult, null, 2));

  if (saveResult.status !== "success") {
    console.error("Save failed. UAT can only fully pass if Code.gs has been deployed on the live Apps Script.");
    return;
  }

  console.log("\n2. GET /api/getAuditYoyiBatch to fetch all rows...");
  const getRes = await fetch(`${API_BASE}/getAuditYoyiBatch?user_role=OWNER`, {
    method: "GET"
  });
  const getResult = await getRes.json();
  console.log("GET Response status:", getRes.status);
  console.log("GET Response row count:", getResult.data ? getResult.data.length : "undefined");
  console.log("GET Response sample data:", JSON.stringify(getResult.data?.slice(-2), null, 2));

  console.log("\n3. Testing filters...");
  
  console.log("Filter: resi_id = JD0591361094");
  const filterRes1 = await fetch(`${API_BASE}/getAuditYoyiBatch?user_role=OWNER&resi_id=JD0591361094`);
  const filterResult1 = await filterRes1.json();
  console.log("Filter resi_id count:", filterResult1.data?.length);
  console.log("Filter resi_id records:", JSON.stringify(filterResult1.data, null, 2));

  console.log("Filter: outlet_id = OUT-001 & tanggal_serah_terima = 2026-09-24");
  const filterRes2 = await fetch(`${API_BASE}/getAuditYoyiBatch?user_role=OWNER&outlet_id=OUT-001&tanggal_serah_terima=2026-09-24`);
  const filterResult2 = await filterRes2.json();
  console.log("Filter multi count:", filterResult2.data?.length);
  console.log("Filter multi records:", JSON.stringify(filterResult2.data, null, 2));

  console.log("\n--- UAT RUN COMPLETED ---");
}

runUAT().catch(err => console.error("Error running UAT:", err));
