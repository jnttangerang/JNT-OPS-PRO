const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function run() {
  const url = "https://script.google.com/macros/s/AKfycbwrxgBj-2fafmkJ00Mxhps1ykGS2x5r4X5f9nJ_KUeanN8gdCuxf9O4KucqrYWO-yeQXg/exec";
  
  // Let's test calling action "updateTransaksi"
  const payload = {
    action: "updateTransaksi",
    data: {
      jenis_layanan: "Express",
      data: {
        resi_id: "TEST-NONEXISTENT",
        metode_bayar: "QRIS"
      }
    }
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    console.log("Status:", resp.status);
    const text = await resp.text();
    console.log("Response text:", text);
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
