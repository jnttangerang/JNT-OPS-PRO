const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

if (!code.includes('/api/yoyi/summary')) {
  const yoyiRoutes = `
// ==========================================
// YOYI COMPLETION ENDPOINTS
// ==========================================

function isYoyiTx(tx: any) {
  if (!tx) return false;
  const sumber = (tx.sumber_data || "").toUpperCase();
  const catatan = (tx.catatan_admin || "").toUpperCase();
  const catatanTx = (tx.catatan || "").toUpperCase();
  return sumber.includes("YOYI") || catatan.includes("YOYI") || catatanTx.includes("YOYI");
}

function checkYoyiCompletion(tx: any) {
  let isLengkap = true;
  let alasan = [];
  
  // 1. Metode Bayar Ongkir
  const mBayar = (tx.metode_bayar || tx.metode_pembayaran_ongkir || "TUNAI").toUpperCase();
  if (mBayar !== "TUNAI" && mBayar !== "CASH" && mBayar !== "DFOD") {
    if (!tx.bukti_bayar_url || tx.bukti_bayar_url.trim() === "") {
      isLengkap = false;
      alasan.push("Bukti Ongkir (" + mBayar + ")");
    }
  }

  // 2. Biaya Tambahan
  const bLain = Number(tx.biaya_lain || 0) + Number(tx.amplop || tx.biaya_amplop || 0) + Number(tx.packing || tx.biaya_packing || 0);
  if (bLain > 0) {
    const mTambahan = (tx.metode_bayar_tambahan || "TUNAI").toUpperCase();
    if (mTambahan !== "TUNAI" && mTambahan !== "CASH") {
      if (!tx.bukti_tambahan_url || tx.bukti_tambahan_url.trim() === "") {
        isLengkap = false;
        alasan.push("Bukti Tambahan (" + mTambahan + ")");
      }
    }
  }

  // 3. Maps 5 Star
  if (tx.customer_maps_5star === true || tx.customer_maps_5star === "true") {
    if (!tx.bukti_maps_url || tx.bukti_maps_url.trim() === "") {
      isLengkap = false;
      alasan.push("Bukti Maps");
    }
  }

  return { isLengkap, alasan: alasan.join(", ") };
}

app.get("/api/yoyi/summary", async (req, res) => {
  const db = readDb(); // Could sync if needed, but for speed let's just read
  const admin_id = req.query.admin_id;
  const outlet_id = req.query.outlet_id;
  
  const yoyiTx = (db.MASTER_TRANSAKSI || []).filter((tx: any) => {
    if (!isYoyiTx(tx)) return false;
    if (outlet_id && tx.outlet_id !== outlet_id) return false;
    // Admins only see their own, Owner sees all
    if (admin_id) {
       const user = (db.Users || []).find((u: any) => u.user_id === admin_id);
       if (user && user.role === "ADMIN") {
         const txAdmin = tx.admin_pembuat || tx.admin_id || tx.user_id || tx.created_by || "UNKNOWN";
         if (txAdmin !== user.user_id && txAdmin !== user.username && txAdmin !== user.nama_lengkap) {
           return false;
         }
       }
    }
    return true;
  });

  const dateMap: Record<string, any> = {};

  for (const tx of yoyiTx) {
    const tgl = extractBusinessDate(tx);
    if (!tgl) continue;

    if (!dateMap[tgl]) {
      dateMap[tgl] = {
        tanggal: tgl,
        total_transaksi: 0,
        transaksi_lengkap: 0,
        total_nominal: 0,
        wajib_setor: 0,
        kas_outlet: 0
      };
    }
    
    dateMap[tgl].total_transaksi++;
    
    const sum = calculateFinancialSummary(tx);
    dateMap[tgl].total_nominal += sum.customer_payment;
    dateMap[tgl].wajib_setor += sum.cash_payment;
    dateMap[tgl].kas_outlet += sum.outlet_cash;

    const { isLengkap } = checkYoyiCompletion(tx);
    if (isLengkap) {
      dateMap[tgl].transaksi_lengkap++;
    }
  }

  const resultList = Object.values(dateMap).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  
  return res.json({ status: "success", data: resultList });
});

app.get("/api/yoyi/transactions", async (req, res) => {
  const db = readDb();
  const { tanggal, admin_id, outlet_id } = req.query;
  
  if (!tanggal) return res.status(400).json({ status: "error", message: "Tanggal wajib diisi" });

  const txList = (db.MASTER_TRANSAKSI || []).filter((tx: any) => {
    if (!isYoyiTx(tx)) return false;
    if (extractBusinessDate(tx) !== tanggal) return false;
    if (outlet_id && tx.outlet_id !== outlet_id) return false;
    if (admin_id) {
       const user = (db.Users || []).find((u: any) => u.user_id === admin_id);
       if (user && user.role === "ADMIN") {
         const txAdmin = tx.admin_pembuat || tx.admin_id || tx.user_id || tx.created_by || "UNKNOWN";
         if (txAdmin !== user.user_id && txAdmin !== user.username && txAdmin !== user.nama_lengkap) {
           return false;
         }
       }
    }
    return true;
  }).map((tx: any) => {
    const { isLengkap, alasan } = checkYoyiCompletion(tx);
    return { ...tx, isLengkap, alasan_belum_lengkap: alasan };
  });

  return res.json({ status: "success", data: txList });
});

app.post("/api/yoyi/update", async (req, res) => {
  const { transaksi_id, resi_id, ...updates } = req.body;
  if (!transaksi_id && !resi_id) return res.status(400).json({ status: "error", message: "transaksi_id atau resi_id diperlukan" });
  
  try {
    const appsScriptRes = await callAppsScript("updateYoYiTransaction", req.body);
    if (appsScriptRes.status !== "success") {
      return res.status(500).json(appsScriptRes);
    }
    
    // Update local cache
    const db = readDb();
    const masterTx = (db.MASTER_TRANSAKSI || []).find((t: any) => t.id === transaksi_id || t.transaksi_id === transaksi_id || t.no_resi === resi_id);
    if (masterTx) {
       Object.assign(masterTx, appsScriptRes.data);
       writeDb(db);
    }
    
    // Trigger customer upsert pipeline asynchronously
    if (masterTx) {
      callAppsScript("apiSaveTransaksi", { jenis_layanan: "Express", data: masterTx }).catch(e => console.error("Trigger customer upsert failed", e));
    }
    
    return res.json(appsScriptRes);
  } catch (e: any) {
    return res.status(500).json({ status: "error", message: e.message });
  }
});
`;
  
  // Inject before "app.listen"
  code = code.replace(/app\.listen\(PORT,/g, yoyiRoutes + '\napp.listen(PORT,');
  fs.writeFileSync('server.ts', code);
  console.log("Patched server.ts successfully");
} else {
  console.log("Already patched server.ts");
}
