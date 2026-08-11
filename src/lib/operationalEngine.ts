/**
 * PHASE 25 — OPERATIONAL ENGINE (BUSINESS RULES ENGINE)
 * Single Source of Truth for all operational business logic, validations,
 * state transitions, duplicate checks, snapshots, customer linking, and shipment mapping.
 *
 * Financial calculations are strictly delegated to financialEngine.ts.
 * Database writes are strictly handled by the Persistence Layer in endpoints.
 */

import { calculateFinancialSummary } from "./financialEngine";

// ==========================================
// PART 3 — STATE TRANSITION MATRIX & LIFECYCLE
// ==========================================

export const LIFECYCLE_ORDER: Record<string, number> = {
  DRAFT: 10,
  WAITING_PAYMENT: 20,
  PAID: 30,
  READY_PICKUP: 40,
  PICKED_UP: 50,
  IN_TRANSIT: 60,
  DELIVERED: 70,
  SELESAI: 70,
  CANCELLED: 99,
  BATAL: 99
};

export function normalizeLifecycleStatus(statusStr?: string): string {
  if (!statusStr) return "DRAFT";
  const s = statusStr.trim().toUpperCase();
  if (s === "DRAFT" || s === "DRAFT (BELUM BAYAR)" || s === "PENCATATAN" || s === "PRE INPUT" || s === "PENDING") return "DRAFT";
  if (s === "WAITING_PAYMENT" || s === "SIAP DIBAYAR" || s === "SIAP BAYAR" || s === "BELUM BAYAR") return "WAITING_PAYMENT";
  if (s === "PAID" || s === "LUNAS" || s === "SELESAI" || s === "RESI & BAYAR") return "PAID";
  if (s === "READY_PICKUP" || s === "SIAP_PICKUP" || s === "MENUNGGU_PICKUP" || s === "SCANNER") return "READY_PICKUP";
  if (s === "PICKED_UP" || s === "SUDAH_PICKUP" || s === "PICKUP") return "PICKED_UP";
  if (s === "IN_TRANSIT" || s === "DALAM_PROSES" || s === "PROSES_KIRIM") return "IN_TRANSIT";
  if (s === "DELIVERED" || s === "SUDAH_DIKIRIM" || s === "SELESAI_DIKIRIM") return "DELIVERED";
  if (s === "CANCELLED" || s === "BATAL" || s === "FAILED") return "CANCELLED";
  return s;
}

export function validateLifecycleTransition(currentStatus: string, targetStatus: string): { valid: boolean; sameStatus?: boolean; reason?: string } {
  const curr = normalizeLifecycleStatus(currentStatus);
  const target = normalizeLifecycleStatus(targetStatus);

  if (curr === target) {
    return { valid: true, sameStatus: true };
  }

  if (curr === "DELIVERED" || curr === "SELESAI") {
    return { valid: false, reason: "Transaksi yang sudah DELIVERED tidak dapat diubah lagi." };
  }

  if (curr === "CANCELLED" || curr === "BATAL") {
    return { valid: false, reason: "Transaksi yang sudah CANCELLED tidak dapat diubah lagi." };
  }

  if (target === "CANCELLED" || target === "BATAL") {
    return { valid: true };
  }

  const currLvl = LIFECYCLE_ORDER[curr] || 10;
  const targetLvl = LIFECYCLE_ORDER[target] || 10;

  if (targetLvl < currLvl) {
    return { valid: false, reason: `Mundur status dari ${curr} ke ${target} tidak diperbolehkan.` };
  }

  if (targetLvl - currLvl > 20) {
    return { valid: false, reason: `Transisi status dari ${curr} ke ${target} tidak valid! Harus mengikuti urutan progresif lifecycle.` };
  }

  return { valid: true };
}

export function validateStateTransition(currentStatus: string, targetStatus: string): { valid: boolean; message?: string } {
  const res = validateLifecycleTransition(currentStatus, targetStatus);
  if (!res.valid) {
    return { valid: false, message: res.reason };
  }
  return { valid: true };
}

// ==========================================
// PART 2 — VALIDATION RULES ENGINE
// ==========================================

export function validateStatus(status: string): { valid: boolean; message?: string } {
  const validStatuses = [
    "DRAFT", "WAITING_PAYMENT", "PAID", "READY_PICKUP", "PICKED_UP",
    "IN_TRANSIT", "DELIVERED", "SELESAI", "CANCELLED", "BATAL"
  ];
  const s = normalizeLifecycleStatus(status);
  if (!s || !validStatuses.includes(s)) {
    return { valid: false, message: `Status '${status}' tidak valid.` };
  }
  return { valid: true };
}

export function validateLifecycle(tx: any, targetStatus?: string): { valid: boolean; message?: string } {
  if (!tx) {
    return { valid: false, message: "Data transaksi tidak ditemukan." };
  }

  const currentStatus = tx.status_transaksi || tx.status || "DRAFT";
  if (targetStatus) {
    const res = validateLifecycleTransition(currentStatus, targetStatus);
    if (!res.valid) {
      return { valid: false, message: res.reason };
    }
  }

  return { valid: true };
}

export function validateResiFormat(noResi: string, ekspedisi?: string): { valid: boolean; message?: string } {
  if (!noResi || typeof noResi !== "string" || noResi.trim().length < 3) {
    return { valid: false, message: "Nomor resi tidak valid atau terlalu pendek." };
  }
  return { valid: true };
}

export function validateCustomerData(customer: any, roleLabel: string = "Pelanggan"): { valid: boolean; message?: string } {
  if (!customer) {
    return { valid: false, message: `Data ${roleLabel} wajib diisi.` };
  }
  if (!customer.nama || !customer.nama.trim()) {
    return { valid: false, message: `Nama ${roleLabel} wajib diisi.` };
  }
  if (!customer.no_hp && !customer.hp && !customer.telepon) {
    return { valid: false, message: `Nomor HP ${roleLabel} wajib diisi.` };
  }
  return { valid: true };
}

export function validateOutletData(outletId: string, outlets: any[] = []): { valid: boolean; message?: string } {
  if (!outletId) {
    return { valid: false, message: "Outlet ID wajib diisi." };
  }
  if (outlets.length > 0) {
    const exists = outlets.some((o: any) => o.outlet_id === outletId || o.id === outletId);
    if (!exists) {
      return { valid: false, message: `Outlet ID '${outletId}' tidak terdaftar.` };
    }
  }
  return { valid: true };
}

export function validateAdminData(adminId: string, users: any[] = []): { valid: boolean; message?: string } {
  if (!adminId) {
    return { valid: false, message: "Admin ID / Petugas wajib diisi." };
  }
  return { valid: true };
}

export function validateEkspedisi(ekspedisi: string): { valid: boolean; message?: string } {
  const eks = (ekspedisi || "").toUpperCase();
  if (!eks || (eks !== "EXPRESS" && eks !== "CARGO")) {
    return { valid: false, message: "Tipe ekspedisi harus 'EXPRESS' atau 'CARGO'." };
  }
  return { valid: true };
}

export function validateBarangData(barangData: any): { valid: boolean; message?: string } {
  if (!barangData) {
    return { valid: false, message: "Data barang/paket wajib diisi." };
  }
  if (!barangData.nama_barang && !barangData.nama) {
    return { valid: false, message: "Nama barang wajib diisi." };
  }
  return { valid: true };
}

export function validateCancel(tx: any): { valid: boolean; message?: string } {
  if (!tx) {
    return { valid: false, message: "Data transaksi tidak ditemukan." };
  }
  const status = normalizeLifecycleStatus(tx.status_transaksi || tx.status);
  if (status === "CANCELLED") {
    return { valid: false, message: "Transaksi sudah dibatalkan sebelumnya." };
  }
  return { valid: true };
}

export function validateDelete(tx: any): { valid: boolean; message?: string } {
  return validateCancel(tx);
}

// ==========================================
// PART 4 — DUPLICATE ENGINE
// ==========================================

export function checkDuplicateResi(db: any, noResi: string, excludeTxId?: string): { duplicate: boolean; existing?: any } {
  if (!noResi) return { duplicate: false };
  const resiUpper = noResi.trim().toUpperCase();
  const txs = db.MASTER_TRANSAKSI || db.EXP_Resi || [];
  
  const found = txs.find((tx: any) => {
    const r = (tx.no_resi || tx.resi_id || "").trim().toUpperCase();
    if (!r || r !== resiUpper) return false;
    if (excludeTxId) {
      const currentId = (tx.transaksi_id || tx.id || "").toString();
      if (currentId === excludeTxId.toString()) return false;
    }
    const st = normalizeLifecycleStatus(tx.status_transaksi || tx.status);
    return st !== "CANCELLED";
  });

  return { duplicate: !!found, existing: found };
}

export function checkDuplicateCustomer(db: any, hp: string): { duplicate: boolean; existing?: any } {
  if (!hp) return { duplicate: false };
  const cleanHp = hp.replace(/[^0-9]/g, "");
  if (!cleanHp) return { duplicate: false };

  const customers = db.Master_Pelanggan || db.Customers || [];
  const found = customers.find((c: any) => {
    const cHp = (c.no_hp || c.hp || "").replace(/[^0-9]/g, "");
    return cHp && cHp === cleanHp;
  });

  return { duplicate: !!found, existing: found };
}

export function checkDuplicateTransaction(db: any, txId: string): { duplicate: boolean; existing?: any } {
  if (!txId) return { duplicate: false };
  const txs = db.MASTER_TRANSAKSI || [];
  const found = txs.find((tx: any) => (tx.transaksi_id || tx.id || "") === txId);
  return { duplicate: !!found, existing: found };
}

export function checkDuplicateImport(db: any, importId: string): { duplicate: boolean; existing?: any } {
  if (!importId) return { duplicate: false };
  const txs = db.MASTER_TRANSAKSI || [];
  const found = txs.find((tx: any) => tx.import_id === importId);
  return { duplicate: !!found, existing: found };
}

// ==========================================
// PART 5 — SNAPSHOT RULES ENGINE
// ==========================================

export function createCustomerSnapshot(nama: string, hp: string, alamat: string) {
  return {
    nama: (nama || "Umum").trim(),
    hp: (hp || "-").trim(),
    alamat: (alamat || "-").trim()
  };
}

export function createBarangSnapshot(nama: string, berat: number, volume: string, nilai?: number) {
  return {
    nama_barang: (nama || "Paket").trim(),
    berat_barang: Number(berat) || 0,
    volume_barang: volume || "0 x 0 x 0",
    nilai_barang: Number(nilai) || 0
  };
}

export function createOutletSnapshot(outletId: string, outlets: any[] = []) {
  const match = outlets.find((o: any) => o.outlet_id === outletId || o.id === outletId);
  return {
    outlet_id: outletId || "OUTLET",
    outlet_nama: match?.nama_outlet || match?.nama || outletId || "Outlet Tangerang"
  };
}

export function createAdminSnapshot(adminId: string, users: any[] = []) {
  const match = users.find((u: any) => u.admin_id === adminId || u.user_id === adminId || u.id === adminId);
  return {
    admin_id: adminId || "ADMIN",
    admin_nama: match?.nama || match?.username || adminId || "Petugas"
  };
}

// ==========================================
// PART 6 — SHIPMENT RULES (MASTER_PENGIRIMAN MAPPER)
// ==========================================

export function buildShipmentObject(tx: any, existingShipment?: any) {
  const now = new Date().toISOString();
  const txId = tx.transaksi_id || tx.id;
  const statusTx = normalizeLifecycleStatus(tx.status_transaksi || tx.status || "WAITING_PAYMENT");

  let statusPengiriman = existingShipment?.status_pengiriman || "WAITING_PAYMENT";
  let pickupStatus = existingShipment?.status_pickup || "BELUM_PICKUP";
  let deliveryStatus = existingShipment?.status_delivery || "BELUM_DIKIRIM";

  if (statusTx === "PAID" || statusTx === "SELESAI") {
    statusPengiriman = existingShipment?.status_pengiriman && existingShipment.status_pengiriman !== "WAITING_PAYMENT"
      ? existingShipment.status_pengiriman
      : "READY_PICKUP";
    pickupStatus = "SIAP_PICKUP";
  } else if (statusTx === "READY_PICKUP") {
    statusPengiriman = "READY_PICKUP";
    pickupStatus = "SIAP_PICKUP";
  } else if (statusTx === "PICKED_UP") {
    statusPengiriman = "PICKED_UP";
    pickupStatus = "PICKED_UP";
  } else if (statusTx === "IN_TRANSIT") {
    statusPengiriman = "IN_TRANSIT";
    pickupStatus = "PICKED_UP";
    deliveryStatus = "DALAM_PROSES";
  } else if (statusTx === "DELIVERED") {
    statusPengiriman = "DELIVERED";
    pickupStatus = "PICKED_UP";
    deliveryStatus = "SUDAH_DIKIRIM";
  } else if (statusTx === "CANCELLED") {
    statusPengiriman = "CANCELLED";
    pickupStatus = "BATAL";
    deliveryStatus = "BATAL";
  }

  return {
    transaksi_id: txId,
    no_resi: tx.no_resi || tx.resi_id || "-",
    status_pengiriman: statusPengiriman,
    status_pickup: pickupStatus,
    status_delivery: deliveryStatus,
    
    snapshot_nama_pengirim: tx.snapshot_nama_pengirim || "Umum",
    snapshot_hp_pengirim: tx.snapshot_hp_pengirim || "-",
    snapshot_alamat_pengirim: tx.snapshot_alamat_pengirim || "-",
    
    snapshot_nama_penerima: tx.snapshot_nama_penerima || "Umum",
    snapshot_hp_penerima: tx.snapshot_hp_penerima || "-",
    snapshot_alamat_penerima: tx.snapshot_alamat_penerima || "-",
    
    outlet_id: tx.outlet_id,
    admin_id: tx.admin_id,
    ekspedisi: tx.ekspedisi,
    tipe_produk: tx.tipe_produk || "Reguler",
    
    nama_barang: tx.nama_barang || "Paket",
    berat_barang: Number(tx.berat_barang) || 0,
    volume_barang: tx.volume_barang || "0 x 0 x 0",
    nilai_barang: Number(tx.nilai_barang) || 0,
    jumlah_paket: Number(tx.jumlah_paket) || 1,
    
    foto_barang: tx.foto_barang || "",
    foto_resi: tx.foto_resi || "",
    
    created_at: existingShipment?.created_at || tx.created_at || now,
    updated_at: now
  };
}

// ==========================================
// PART 7 — CUSTOMER RULES ENGINE
// ==========================================

export function processCustomerRules(db: any, senderInput: any, recipientInput: any) {
  if (!db.Master_Pelanggan) db.Master_Pelanggan = [];

  let pengirim_id = senderInput?.id || senderInput?.pengirim_id || "";
  let penerima_id = recipientInput?.id || recipientInput?.penerima_id || "";

  // Upsert Pengirim
  if (senderInput && senderInput.nama) {
    const sHp = (senderInput.hp || senderInput.no_hp || "").replace(/[^0-9]/g, "");
    let match = db.Master_Pelanggan.find((c: any) => {
      if (pengirim_id && (c.id === pengirim_id || c.pelanggan_id === pengirim_id)) return true;
      const cHp = (c.no_hp || c.hp || "").replace(/[^0-9]/g, "");
      return sHp && cHp && cHp === sHp;
    });

    if (match) {
      match.nama = senderInput.nama.trim();
      match.alamat = (senderInput.alamat || match.alamat || "-").trim();
      match.updated_at = new Date().toISOString();
      pengirim_id = match.id || match.pelanggan_id;
    } else if (senderInput.nama.trim()) {
      pengirim_id = "SND-" + String(db.Master_Pelanggan.length + 1).padStart(6, "0");
      const newCust = {
        id: pengirim_id,
        pelanggan_id: pengirim_id,
        nama: senderInput.nama.trim(),
        no_hp: senderInput.hp || senderInput.no_hp || "-",
        alamat: senderInput.alamat || "-",
        tipe: "PENGIRIM",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.Master_Pelanggan.push(newCust);
    }
  }

  // Upsert Penerima
  if (recipientInput && recipientInput.nama) {
    const rHp = (recipientInput.hp || recipientInput.no_hp || "").replace(/[^0-9]/g, "");
    let match = db.Master_Pelanggan.find((c: any) => {
      if (penerima_id && (c.id === penerima_id || c.pelanggan_id === penerima_id)) return true;
      const cHp = (c.no_hp || c.hp || "").replace(/[^0-9]/g, "");
      return rHp && cHp && cHp === rHp;
    });

    if (match) {
      match.nama = recipientInput.nama.trim();
      match.alamat = (recipientInput.alamat || match.alamat || "-").trim();
      match.updated_at = new Date().toISOString();
      penerima_id = match.id || match.pelanggan_id;
    } else if (recipientInput.nama.trim()) {
      penerima_id = "RCV-" + String(db.Master_Pelanggan.length + 1).padStart(6, "0");
      const newCust = {
        id: penerima_id,
        pelanggan_id: penerima_id,
        nama: recipientInput.nama.trim(),
        no_hp: recipientInput.hp || recipientInput.no_hp || "-",
        alamat: recipientInput.alamat || "-",
        tipe: "PENERIMA",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.Master_Pelanggan.push(newCust);
    }
  }

  return { pengirim_id, penerima_id };
}

// ==========================================
// PART 9 — TRANSACTION DOMAIN ASSEMBLER
// ==========================================

export function assembleTransactionDomain(params: {
  inputData: any;
  existingTx?: any;
  existingShipment?: any;
  db: any;
  isResiBayar?: boolean;
}): {
  transactionObject: any;
  shipmentObject: any;
  financialSummary: any;
  errors: string[];
} {
  const { inputData, existingTx, existingShipment, db, isResiBayar } = params;
  const errors: string[] = [];

  // 1. Validation
  if (isResiBayar) {
    const noResi = inputData.no_resi || inputData.resi_id;
    const resiVal = validateResiFormat(noResi);
    if (!resiVal.valid && resiVal.message) errors.push(resiVal.message);

    const dup = checkDuplicateResi(db, noResi, inputData.transaksi_id || inputData.id || existingTx?.id);
    if (dup.duplicate) {
      errors.push(`Nomor resi ${noResi} sudah terdaftar pada transaksi lain.`);
    }
  }

  if (existingTx) {
    const lifecycleVal = validateLifecycle(existingTx, inputData.status_transaksi || inputData.status);
    if (!lifecycleVal.valid && lifecycleVal.message) {
      errors.push(lifecycleVal.message);
    }
  }

  // 2. Customer Rules
  const senderInfo = {
    nama: inputData.nama_pengirim || inputData.snapshot_nama_pengirim || existingTx?.snapshot_nama_pengirim,
    hp: inputData.hp_pengirim || inputData.snapshot_hp_pengirim || existingTx?.snapshot_hp_pengirim,
    alamat: inputData.alamat_pengirim || inputData.snapshot_alamat_pengirim || existingTx?.snapshot_alamat_pengirim,
    id: inputData.pengirim_id || existingTx?.pengirim_id
  };

  const recipientInfo = {
    nama: inputData.nama_penerima || inputData.snapshot_nama_penerima || existingTx?.snapshot_nama_penerima,
    hp: inputData.hp_penerima || inputData.snapshot_hp_penerima || existingTx?.snapshot_hp_penerima,
    alamat: inputData.alamat_penerima || inputData.snapshot_alamat_penerima || existingTx?.snapshot_alamat_penerima,
    id: inputData.penerima_id || existingTx?.penerima_id
  };

  const { pengirim_id, penerima_id } = processCustomerRules(db, senderInfo, recipientInfo);

  // 3. Snapshots
  const senderSnap = createCustomerSnapshot(senderInfo.nama, senderInfo.hp, senderInfo.alamat);
  const recipientSnap = createCustomerSnapshot(recipientInfo.nama, recipientInfo.hp, recipientInfo.alamat);
  const barangSnap = createBarangSnapshot(
    inputData.nama_barang || existingTx?.nama_barang,
    inputData.berat_kg || inputData.berat_barang || existingTx?.berat_barang,
    inputData.volume || inputData.volume_barang || existingTx?.volume_barang,
    inputData.nilai_barang || existingTx?.nilai_barang
  );

  // 4. Financial Engine Integration (PART 8)
  const financialSummary = calculateFinancialSummary({
    ...existingTx,
    ...inputData,
    total_customer: inputData.total_dibayar_customer ?? inputData.grand_total ?? inputData.total_customer ?? existingTx?.total_customer,
    ongkir_dasar: inputData.ongkir_dasar ?? inputData.ongkir_customer ?? existingTx?.ongkir_customer,
    biaya_asuransi: inputData.biaya_asuransi ?? inputData.asuransi ?? existingTx?.asuransi,
    biaya_lain: inputData.biaya_lain ?? existingTx?.biaya_lain,
    biaya_amplop: inputData.biaya_amplop ?? inputData.amplop ?? existingTx?.amplop,
    biaya_packing: inputData.biaya_packing ?? inputData.packing ?? existingTx?.packing
  });

  // 5. Assemble Transaction Object
  const now = new Date().toISOString();
  const txId = inputData.transaksi_id || inputData.id || existingTx?.id || "TRX-" + Date.now();
  const statusTx = isResiBayar ? "PAID" : normalizeLifecycleStatus(inputData.status_transaksi || inputData.status || existingTx?.status_transaksi || "WAITING_PAYMENT");

  const transactionObject = {
    id: txId,
    transaksi_id: txId,
    import_id: inputData.import_id || existingTx?.import_id || "",
    outlet_id: inputData.outlet_id || existingTx?.outlet_id || "OUTLET",
    admin_id: inputData.admin_id || existingTx?.admin_id || "ADMIN",
    
    tanggal_transaksi: (inputData.tanggal || inputData.tanggal_transaksi || existingTx?.tanggal_transaksi || now).split("T")[0],
    jam_transaksi: (inputData.jam || inputData.jam_transaksi || existingTx?.jam_transaksi || now.split("T")[1] || "00:00:00").substring(0, 8),
    created_at: existingTx?.created_at || now,
    updated_at: now,
    
    no_resi: inputData.no_resi || inputData.resi_id || existingTx?.no_resi || "-",
    ekspedisi: (inputData.ekspedisi || existingTx?.ekspedisi || "EXPRESS").toUpperCase(),
    tipe_produk: inputData.tipe_produk || existingTx?.tipe_produk || "Reguler",
    
    pengirim_id: pengirim_id || existingTx?.pengirim_id || "",
    penerima_id: penerima_id || existingTx?.penerima_id || "",
    
    snapshot_nama_pengirim: senderSnap.nama,
    snapshot_hp_pengirim: senderSnap.hp,
    snapshot_alamat_pengirim: senderSnap.alamat,
    
    snapshot_nama_penerima: recipientSnap.nama,
    snapshot_hp_penerima: recipientSnap.hp,
    snapshot_alamat_penerima: recipientSnap.alamat,
    
    nama_barang: barangSnap.nama_barang,
    berat_barang: barangSnap.berat_barang,
    volume_barang: barangSnap.volume_barang,
    nilai_barang: barangSnap.nilai_barang,
    jumlah_paket: Number(inputData.jumlah_paket || existingTx?.jumlah_paket) || 1,
    
    metode_bayar: inputData.metode_bayar || existingTx?.metode_bayar || "Tunai",
    
    // Financial Pure Inputs
    ongkir_customer: Number(inputData.ongkir_dasar ?? inputData.ongkir_customer ?? existingTx?.ongkir_customer) || 0,
    packing: Number(inputData.biaya_packing ?? inputData.packing ?? existingTx?.packing) || 0,
    amplop: Number(inputData.biaya_amplop ?? inputData.amplop ?? existingTx?.amplop) || 0,
    biaya_lain: Number(inputData.biaya_lain ?? existingTx?.biaya_lain) || 0,
    total_customer: financialSummary.customer_payment,
    
    ongkir_yoyi: Number(inputData.biaya_yoyi ?? existingTx?.ongkir_yoyi) || 0,
    asuransi: Number(inputData.biaya_asuransi ?? inputData.asuransi ?? existingTx?.asuransi) || 0,
    biaya_lain_yoyi: Number(inputData.biaya_jtc ?? inputData.biaya_lain_yoyi ?? existingTx?.biaya_lain_yoyi) || 0,
    
    wajib_setor_owner: financialSummary.owner_deposit,
    kas_outlet: financialSummary.outlet_cash,
    
    foto_barang: inputData.foto_paket_url || inputData.foto_barang || existingTx?.foto_barang || "",
    foto_resi: inputData.foto_resi_url || inputData.foto_resi || existingTx?.foto_resi || "",
    
    status_transaksi: statusTx,
    status: statusTx,
    sumber_data: isResiBayar ? "Resi & Bayar" : (existingTx?.sumber_data || "Pre-Input"),
    catatan: inputData.catatan || existingTx?.catatan || ""
  };

  // 6. Assemble Shipment Object (PART 6)
  const shipmentObject = buildShipmentObject(transactionObject, existingShipment);

  return {
    transactionObject,
    shipmentObject,
    financialSummary,
    errors
  };
}
