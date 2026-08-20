export function safeNum(val: any): number {
  if (val === undefined || val === null || val === "") return 0;
  const parsed = Number(val);
  if (isNaN(parsed)) return 0;
  return parsed;
}

export function isTransactionValidForFinance(tx: any): boolean {
  const status = (tx.status_transaksi || tx.status || "").toUpperCase();
  if (status === "CANCELLED" || status === "BATAL" || status === "REVISED" || status === "FAILED" || status === "DRAFT") {
    return false;
  }
  return true;
}

export function calculateFinancialSummary(tx: any) {
  if (!isTransactionValidForFinance(tx)) {
    return {
      customer_payment: 0,
      owner_deposit: 0,
      outlet_cash: 0,
      rounding: 0
    };
  }

  // If transaction already has computed SSOT fields, trust them directly
  const hasSSOT = tx.wajib_setor_owner !== undefined || tx.kas_outlet !== undefined || tx.kas_operasional !== undefined;
  
  if (hasSSOT) {
    const owner_deposit = safeNum(tx.wajib_setor_owner ?? tx.setoran_owner ?? tx.setoran_ke_owner ?? 0);
    const packing = safeNum(tx.biaya_packing ?? tx.packing ?? 0);
    const amplop = safeNum(tx.biaya_amplop ?? tx.amplop ?? 0);
    
    let outlet_cash = safeNum(tx.kas_outlet ?? tx.kas_operasional ?? 0);
    if (outlet_cash === 0) {
      outlet_cash = packing + amplop;
    }
    
    const customer_payment = safeNum(tx.jumlah_dibayar_customer ?? tx.grand_total ?? tx.total_customer ?? tx.total_dibayar_customer ?? (owner_deposit + outlet_cash));
    const rounding = safeNum(tx.pembulatan ?? 0);
    
    return {
      customer_payment,
      owner_deposit,
      outlet_cash,
      rounding
    };
  }

  // Pure inputs
  const ongkir_customer = safeNum(tx.ongkir_customer || tx.ongkir_dasar);
  const asuransi = safeNum(tx.asuransi || tx.biaya_asuransi);
  const biaya_lain = safeNum(tx.biaya_lain);
  const amplop = safeNum(tx.amplop || tx.biaya_amplop);
  const packing = safeNum(tx.packing || tx.biaya_packing);
  
  // Total Uang Dibayar Customer
  const total_customer = safeNum(tx.grand_total || tx.total_customer || tx.total_dibayar_customer);
  
  // Biaya Dasar Layanan
  const biayaDasarLayanan = ongkir_customer + asuransi + biaya_lain;
  
  // Surcharges / Kas Operasional Outlet
  const biayaTambahan = amplop + packing;

  // Subtotal sebelum pembulatan
  const subtotal = biayaDasarLayanan + biayaTambahan;
  
  // Pembulatan (Rounding)
  let rounding = 0;
  if (total_customer > 0) {
    rounding = total_customer - subtotal;
    if (rounding < 0) rounding = 0;
  } else {
    rounding = safeNum(tx.pembulatan);
  }
  
  // Setoran Ke Owner = Biaya Dasar Layanan + Pembulatan
  const owner_deposit = tx.wajib_setor_owner !== undefined && tx.wajib_setor_owner !== null && safeNum(tx.wajib_setor_owner) > 0 && Math.abs(safeNum(tx.wajib_setor_owner) - (biayaDasarLayanan + rounding)) <= 0.01
    ? safeNum(tx.wajib_setor_owner)
    : (biayaDasarLayanan + rounding);
  
  // Customer Payment Total
  const customer_payment = total_customer > 0 ? total_customer : (owner_deposit + biayaTambahan);
  
  return {
    customer_payment: customer_payment,
    owner_deposit: owner_deposit,
    outlet_cash: biayaTambahan,
    rounding: rounding
  };
}

export function calculateDailyFinancial(transactions: any[]) {
  let total_customer = 0;
  let total_owner = 0;
  let total_outlet = 0;
  let jumlah_transaksi = 0;
  let jumlah_express = 0;
  let jumlah_cargo = 0;

  for (const tx of transactions) {
    if (!isTransactionValidForFinance(tx)) continue;
    
    const summary = calculateFinancialSummary(tx);
    total_customer += summary.customer_payment;
    total_owner += summary.owner_deposit;
    total_outlet += summary.outlet_cash;
    jumlah_transaksi++;

    const eks = (tx.ekspedisi || "").toUpperCase();
    if (eks === "EXPRESS") jumlah_express++;
    else if (eks === "CARGO") jumlah_cargo++;
  }

  return {
    total_customer,
    total_owner,
    total_outlet,
    jumlah_transaksi,
    jumlah_express,
    jumlah_cargo
  };
}

export function calculateAdminFinancial(transactions: any[]) {
  const result: Record<string, any> = {};
  for (const tx of transactions) {
    if (!isTransactionValidForFinance(tx)) continue;
    const admin = tx.admin_id || "UNKNOWN";
    if (!result[admin]) {
      result[admin] = {
        admin_id: admin,
        customer_payment: 0,
        owner_deposit: 0,
        outlet_cash: 0,
        jumlah_resi: 0
      };
    }
    const summary = calculateFinancialSummary(tx);
    result[admin].customer_payment += summary.customer_payment;
    result[admin].owner_deposit += summary.owner_deposit;
    result[admin].outlet_cash += summary.outlet_cash;
    result[admin].jumlah_resi++;
  }
  return Object.values(result);
}

export function calculateOutletFinancial(transactions: any[]) {
  const result: Record<string, any> = {};
  for (const tx of transactions) {
    if (!isTransactionValidForFinance(tx)) continue;
    const outlet = tx.outlet_id || "UNKNOWN";
    if (!result[outlet]) {
      result[outlet] = {
        outlet_id: outlet,
        customer_payment: 0,
        owner_deposit: 0,
        outlet_cash: 0,
        jumlah_resi: 0,
        jumlah_express: 0,
        jumlah_cargo: 0
      };
    }
    const summary = calculateFinancialSummary(tx);
    result[outlet].customer_payment += summary.customer_payment;
    result[outlet].owner_deposit += summary.owner_deposit;
    result[outlet].outlet_cash += summary.outlet_cash;
    result[outlet].jumlah_resi++;

    const eks = (tx.ekspedisi || "").toUpperCase();
    if (eks === "EXPRESS") result[outlet].jumlah_express++;
    else if (eks === "CARGO") result[outlet].jumlah_cargo++;
  }
  return Object.values(result);
}
