app.all("/api/getRiwayatTransaksi", async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const queryOrBody = { ...(req.query || {}), ...(req.body || {}) };
  console.log("--> /api/getRiwayatTransaksi called with params:", queryOrBody);
  try {
    const RIWAYAT_SYNC_TTL_MS = 5000;
    const now = Date.now();
    const lastSync = (global as any)._lastRiwayatSync || 0;

    // Gracefully handle network latency scenarios:
    // 1. If a sync is currently in-flight, queue onto the existing promise so subsequent calls await completion
    //    without spawning duplicate concurrent syncs or causing data reconciliation race conditions.
    // 2. Bound sync waiting to 2.5s maximum so request never times out or drops to gateway error.
    if ((global as any)._riwayatSyncPromise) {
      try {
        await Promise.race([
          (global as any)._riwayatSyncPromise,
          new Promise((resolve) => setTimeout(resolve, 2500))
        ]);
      } catch (err: any) {
        console.warn("Queued riwayat sync completed with error:", err?.message || err);
      }
    } else if (now - lastSync > RIWAYAT_SYNC_TTL_MS) {
      const syncP = (async () => {
        try {
          await syncDbWithAppsScript(readDb(), { force: true });
        } finally {
          (global as any)._lastRiwayatSync = Date.now();
          (global as any)._riwayatSyncPromise = null;
        }
      })();
      (global as any)._riwayatSyncPromise = syncP;
      try {
        await Promise.race([
          syncP,
          new Promise((resolve) => setTimeout(resolve, 2500))
        ]);
      } catch (err: any) {
        console.warn("Auto-sync riwayat error:", err?.message || err);
      }
    }

    const db = readDb();
    const { filterOutlet: reqOutlet, activeOutletId, tanggal_awal: rawAwal, tanggal_akhir: rawAkhir, filterStatus } = queryOrBody;
    const filterOutlet = reqOutlet || activeOutletId || "ALL";
    const tanggal_awal = rawAwal ? String(rawAwal).slice(0, 10) : undefined;
    const tanggal_akhir = rawAkhir ? String(rawAkhir).slice(0, 10) : undefined;

    const checkDateMatch = (txOrTimestamp: any) => {
      if (!tanggal_awal && !tanggal_akhir) return true;
      let d = "";
      if (typeof txOrTimestamp === "object" && txOrTimestamp !== null) {
        d = extractBusinessDate(txOrTimestamp) || (txOrTimestamp.tanggal_transaksi ? getWIBDate(txOrTimestamp.tanggal_transaksi) : "") || getWIBDate(txOrTimestamp.created_at || txOrTimestamp.timestamp);
      } else {
        d = getWIBDate(txOrTimestamp);
      }
      if (!d) return true;
      if (tanggal_awal && d < tanggal_awal) return false;
      if (tanggal_akhir && d > tanggal_akhir) return false;
      return true;
    };

    const outletMap: Record<string, string> = {};
    (db.Outlets || []).forEach((o: any) => {
      outletMap[o.outlet_id] = o.nama_outlet;
    });

    const userMap: Record<string, string> = {};
    (db.Users || []).forEach((u: any) => {
      userMap[u.user_id] = u.nama_lengkap || u.username || u.user_id;
    });

    const backupMap: Record<string, any> = {};
    const backupByResi = new Map<string, any>();
    (db.PreInput_Backup || []).forEach((b: any) => {
      if (b.transaksi_id) {
        backupMap[b.transaksi_id] = b;
      }
      const rId = (b.no_resi || b.resi_id || "").toUpperCase();
      if (rId) backupByResi.set(rId, b);
    });

    const masterByResi = new Map<string, any>();
    (db.MASTER_TRANSAKSI || []).forEach((tx: any) => {
      const rId = (tx.no_resi || tx.resi_id || tx.id || "").toUpperCase();
      if (rId) masterByResi.set(rId, tx);
      const tId = (tx.transaksi_id || tx.id || "").toUpperCase();
      if (tId) masterByResi.set(tId, tx);
    });

    const filtered = (db.MASTER_TRANSAKSI || []).filter((tx: any) => {
      const txOutlet = tx.outlet_id || tx.outlet_id_input || tx.outlet_id_tugas;
      if (filterOutlet && filterOutlet !== "ALL" && txOutlet !== filterOutlet) return false;
      if (filterStatus && filterStatus !== "ALL") {
        const status = (tx.status_transaksi || tx.status || tx.status_resi || "").toUpperCase();
        if (status !== filterStatus.toUpperCase()) return false;
      }
      if (!checkDateMatch(tx)) return false;
      return true;
    });

    const seenKeys = new Set<string>();

    const formatWibImportedAt = (raw?: string) => {
      if (!raw) return undefined;
      if (raw.includes("Z") || (raw.includes("T") && raw.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/))) {
        return `${getWIBDate(raw)} ${getWIBTime(raw)}`;
      }
      return raw;
    };

    const transaksiList = filtered.map((tx: any) => {
      const sum = calculateFinancialSummary(tx);
      const txId = tx.id || tx.transaksi_id || "";
      const p = backupMap[txId];
      const resiId = tx.no_resi || tx.resi_id || tx.id;
      if (resiId) seenKeys.add(resiId.toUpperCase());
      if (txId) seenKeys.add(txId.toUpperCase());

      const tipeProduk = tx.tipe_produk || p?.tipe_produk || ((tx.ekspedisi || "EXPRESS").toUpperCase() === "CARGO" ? "Cargo" : "EZ");
      const jenisBarang = tx.jenis_barang || p?.jenis_barang || (tipeProduk === "DOC" ? "DOKUMEN" : "BARANG");
      const metodeBayar = tx.metode_bayar || tx.metode_pembayaran_ongkir || p?.metode_bayar || "Tunai";

      const txDate = extractBusinessDate(tx) || extractBusinessDate(p) || (tx.tanggal_transaksi ? getWIBDate(tx.tanggal_transaksi) : "") || getTodayWIB();
      const txTime = tx.jam_transaksi || p?.jam_transaksi || tx.timestamp?.split("T")[1]?.slice(0, 8) || "00:00:00";
      const displayTime = `${txDate} ${txTime}`;
      const txTimestamp = `${txDate}T${txTime}`;
      const rawImported = tx.imported_at || p?.imported_at || tx.created_at || tx.timestamp;
      const importedAt = formatWibImportedAt(rawImported);

      const txOutlet = tx.outlet_id || tx.outlet_id_input || tx.outlet_id_tugas || "";
      const txAdmin = tx.admin_id || tx.admin_pembuat || tx.user_id || tx.admin_id_pencatat || "";

      return {
        resi_id: resiId,
        transaksi_id: txId,
        transaction_time: displayTime,
        imported_at: importedAt,
        timestamp: txTimestamp,
        tanggal_transaksi: txDate,
        jam_transaksi: txTime,
        admin: userMap[txAdmin] || txAdmin,
        outlet: outletMap[txOutlet] || txOutlet,
        tipe: (tx.ekspedisi || "EXPRESS").toUpperCase() === "CARGO" ? "Cargo" : "Express",
        tipe_produk: tipeProduk,
        jenis_barang: jenisBarang,
        metode_bayar: metodeBayar,
        metode_bayar_tambahan: tx.metode_pembayaran_tambahan || tx.metode_bayar_tambahan || "",
        ongkir_dasar: Number(tx.ongkir_customer || tx.ongkir_dasar || 0),
        biaya_asuransi: Number(tx.asuransi || tx.biaya_asuransi || 0),
        biaya_lain: Number(tx.biaya_lain || 0),
        biaya_amplop: Number(tx.biaya_amplop || tx.amplop || 0),
        biaya_packing: Number(tx.biaya_packing || tx.packing || 0),
        pembulatan: Number(tx.pembulatan || 0),
        wajib_setor_owner: Number(tx.wajib_setor_owner || sum.owner_deposit || 0),
        kas_operasional: Number(tx.kas_outlet || sum.outlet_cash || 0),
        grand_total: sum.customer_payment || Number(tx.total_customer) || Number(tx.grand_total) || Number(tx.jumlah_dibayar_customer) || 0,
        pengirim: tx.snapshot_nama_pengirim || tx.nama_pengirim || tx.pengirim || p?.nama_pengirim || "",
        penerima: tx.snapshot_nama_penerima || tx.nama_penerima || tx.penerima || p?.nama_penerima || "",
        hp_pengirim: tx.snapshot_hp_pengirim || tx.hp_pengirim || p?.hp_pengirim || "",
        hp_penerima: tx.snapshot_hp_penerima || tx.hp_penerima || p?.hp_penerima || "",
        nama_barang: tx.nama_barang || p?.nama_barang || "-",
        status_resi: tx.status_resi || tx.status_transaksi || tx.status || "AKTIF"
      };
    });

  // Ensure any transactions in EXP_Resi not in MASTER_TRANSAKSI are also included
  (db.EXP_Resi || []).forEach((r: any) => {
    const resiKey = (r.resi_id || "").toUpperCase();
    const txKey = (r.transaksi_id || "").toUpperCase();
    const masterTx = masterByResi.get(resiKey) || masterByResi.get(txKey);

    if ((resiKey && !seenKeys.has(resiKey)) && (!txKey || !seenKeys.has(txKey))) {
      const rOutlet = r.outlet_id_input || r.outlet_id || masterTx?.outlet_id || masterTx?.outlet_id_input || "";
      if (!filterOutlet || filterOutlet === "ALL" || rOutlet === filterOutlet) {
        if (!checkDateMatch(masterTx || r)) return;
        if (resiKey) seenKeys.add(resiKey);
        if (txKey) seenKeys.add(txKey);
        const p = backupMap[r.transaksi_id] || backupByResi.get(resiKey) || (masterTx ? backupMap[masterTx.transaksi_id] : null);
        const tipeProduk = r.tipe_produk || masterTx?.tipe_produk || p?.tipe_produk || "EZ";
        const jenisBarang = r.jenis_barang || masterTx?.jenis_barang || p?.jenis_barang || (tipeProduk === "DOC" ? "DOKUMEN" : "BARANG");
        const metodeBayar = r.metode_bayar || masterTx?.metode_bayar || p?.metode_bayar || "Tunai";

        const rDate = masterTx?.tanggal_transaksi || p?.tanggal_transaksi || r.tanggal_transaksi || r.timestamp?.split("T")[0] || r.created_at?.split("T")[0] || getTodayWIB();
        const rTime = masterTx?.jam_transaksi || p?.jam_transaksi || r.jam_transaksi || r.timestamp?.split("T")[1]?.slice(0, 8) || "00:00:00";
        const rTxTime = `${rDate} ${rTime}`;
        const rTxTimestamp = `${rDate}T${rTime}`;
        const rImportedAt = r.imported_at || masterTx?.imported_at || p?.imported_at || r.created_at || r.timestamp;

        transaksiList.push({
          resi_id: r.resi_id || masterTx?.no_resi,
          transaksi_id: r.transaksi_id || masterTx?.transaksi_id || "",
          transaction_time: rTxTime,
          imported_at: rImportedAt,
          timestamp: rTxTimestamp,
          tanggal_transaksi: rDate,
          jam_transaksi: rTime,
          admin: userMap[r.admin_id_pencatat || masterTx?.admin_id] || r.admin_id_pencatat || masterTx?.admin_id,
          outlet: outletMap[r.outlet_id_input || masterTx?.outlet_id] || r.outlet_id_input || masterTx?.outlet_id,
          tipe: "Express",
          tipe_produk: tipeProduk,
          jenis_barang: jenisBarang,
          metode_bayar: metodeBayar,
          grand_total: Number(masterTx?.total_customer || masterTx?.grand_total || r.grand_total) || 0,
          pengirim: masterTx?.snapshot_nama_pengirim || r.nama_pengirim || p?.nama_pengirim || "",
          penerima: masterTx?.snapshot_nama_penerima || r.nama_penerima || p?.nama_penerima || "",
          hp_pengirim: masterTx?.snapshot_hp_pengirim || r.hp_pengirim || p?.hp_pengirim || "",
          hp_penerima: masterTx?.snapshot_hp_penerima || r.hp_penerima || p?.hp_penerima || "",
          nama_barang: masterTx?.nama_barang || r.nama_barang || p?.nama_barang || "-",
          status_resi: masterTx?.status_resi || masterTx?.status_transaksi || r.status_resi || r.status || "AKTIF"
        });
      }
    }
  });

  // Ensure any transactions in CRG_Resi not in MASTER_TRANSAKSI are also included
  (db.CRG_Resi || []).forEach((c: any) => {
    const resiKey = (c.resi_id || "").toUpperCase();
    const txKey = (c.transaksi_id || "").toUpperCase();
    const masterTx = masterByResi.get(resiKey) || masterByResi.get(txKey);

    if ((resiKey && !seenKeys.has(resiKey)) && (!txKey || !seenKeys.has(txKey))) {
      const cOutlet = c.outlet_id_input || c.outlet_id || masterTx?.outlet_id || masterTx?.outlet_id_input || "";
      if (!filterOutlet || filterOutlet === "ALL" || cOutlet === filterOutlet) {
        if (!checkDateMatch(masterTx || c)) return;
        if (resiKey) seenKeys.add(resiKey);
        if (txKey) seenKeys.add(txKey);
        const p = backupMap[c.transaksi_id] || backupByResi.get(resiKey) || (masterTx ? backupMap[masterTx.transaksi_id] : null);
        const tipeProduk = c.tipe_produk || masterTx?.tipe_produk || p?.tipe_produk || "Cargo";
        const jenisBarang = c.jenis_barang || masterTx?.jenis_barang || p?.jenis_barang || "BARANG";
        const metodeBayar = c.metode_bayar || masterTx?.metode_bayar || p?.metode_bayar || "Tunai";

        const cDate = masterTx?.tanggal_transaksi || p?.tanggal_transaksi || c.tanggal_transaksi || c.timestamp?.split("T")[0] || c.created_at?.split("T")[0] || getTodayWIB();
        const cTime = masterTx?.jam_transaksi || p?.jam_transaksi || c.jam_transaksi || c.timestamp?.split("T")[1]?.slice(0, 8) || "00:00:00";
        const cTxTime = `${cDate} ${cTime}`;
        const cTxTimestamp = `${cDate}T${cTime}`;
        const cImportedAt = c.imported_at || masterTx?.imported_at || p?.imported_at || c.created_at || c.timestamp;

        transaksiList.push({
          resi_id: c.resi_id || masterTx?.no_resi,
          transaksi_id: c.transaksi_id || masterTx?.transaksi_id || "",
          transaction_time: cTxTime,
          imported_at: cImportedAt,
          timestamp: cTxTimestamp,
          tanggal_transaksi: cDate,
          jam_transaksi: cTime,
          admin: userMap[c.admin_id_pencatat || masterTx?.admin_id] || c.admin_id_pencatat || masterTx?.admin_id,
          outlet: outletMap[c.outlet_id_input || masterTx?.outlet_id] || c.outlet_id_input || masterTx?.outlet_id,
          tipe: "Cargo",
          tipe_produk: tipeProduk,
          jenis_barang: jenisBarang,
          metode_bayar: metodeBayar,
          grand_total: Number(masterTx?.total_customer || masterTx?.grand_total || c.grand_total) || 0,
          pengirim: masterTx?.snapshot_nama_pengirim || c.nama_pengirim || p?.nama_pengirim || "",
          penerima: masterTx?.snapshot_nama_penerima || c.nama_penerima || p?.nama_penerima || "",
          hp_pengirim: masterTx?.snapshot_hp_pengirim || c.hp_pengirim || p?.hp_pengirim || "",
          hp_penerima: masterTx?.snapshot_hp_penerima || c.hp_penerima || p?.hp_penerima || "",
          nama_barang: masterTx?.nama_barang || c.nama_barang || p?.nama_barang || "-",
          status_resi: masterTx?.status_resi || masterTx?.status_transaksi || c.status_resi || c.status || "AKTIF"
        });
      }
    }
  });

  transaksiList.sort((a: any, b: any) => {
    const timeA = (a.transaction_time || a.timestamp || "").replace("T", " ");
    const timeB = (b.transaction_time || b.timestamp || "").replace("T", " ");
    return timeB.localeCompare(timeA);
  });



  return res.json({
