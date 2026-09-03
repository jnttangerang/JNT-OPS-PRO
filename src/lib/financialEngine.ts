export function safeNum(val: any): number {
  if (val === undefined || val === null || val === "") return 0;
  const parsed = Number(val);
  if (isNaN(parsed)) return 0;
  return parsed;
}

export function isDocumentTransaction(tx: any): boolean {
  if (!tx) return false;
  const normalize = (v?: any) => String(v || "").trim().toUpperCase();

  const tp = normalize(tx.tipe_produk);
  if (tp === "DOC" || tp === "DOKUMEN") return true;

  const jb = normalize(tx.jenis_barang);
  if (jb === "DOC" || jb === "DOKUMEN" || jb.includes("DOKUMEN")) return true;

  const ta = normalize(tx.tipe_asuransi);
  if (ta.includes("DOC") || ta.includes("DOKUMEN")) return true;

  const nb = normalize(tx.nama_barang);
  if (nb === "DOC" || nb === "DOKUMEN" || nb.startsWith("DOKUMEN ") || nb.endsWith(" DOKUMEN") || nb.includes("DOKUMEN")) return true;

  return false;
}

export function isTransactionValidForFinance(tx: any): boolean {
  const status = (tx.status_transaksi || tx.status || "").toUpperCase();
  if (status === "CANCELLED" || status === "BATAL" || status === "REVISED" || status === "FAILED" || status === "DRAFT") {
    return false;
  }
  return true;
}

function classifyPayment(owner_deposit: number, outlet_cash: number, rawMethodInput?: string, dfodNominal: number = 0) {
  const rawMethod = String(rawMethodInput || "").trim().toUpperCase();
  const isDigital = rawMethod === "QRIS" || rawMethod === "TRANSFER" || rawMethod === "ORDER BY APP" || rawMethod === "ORDER_BY_APP" || rawMethod === "APP";
  const isDfod = rawMethod === "DFOD" || rawMethod.includes("DFOD");

  if (isDfod) {
    return {
      cash_payment: 0,
      digital_payment: 0,
      dfod_outstanding: dfodNominal > 0 ? dfodNominal : owner_deposit,
      outlet_right_admin: outlet_cash,
      outlet_right_owner: 0
    };
  }

  if (isDigital) {
    return {
      cash_payment: 0,
      digital_payment: owner_deposit,
      dfod_outstanding: 0,
      outlet_right_admin: 0,
      outlet_right_owner: outlet_cash
    };
  }

  return {
    cash_payment: owner_deposit,
    digital_payment: 0,
    dfod_outstanding: 0,
    outlet_right_admin: outlet_cash,
    outlet_right_owner: 0
  };
}

export interface SingleFinancialSummary {
  customer_payment: number;
  owner_deposit: number;
  outlet_cash: number;
  rounding: number;
  cash_payment: number;
  digital_payment: number;
  dfod_outstanding: number;
  outlet_right_admin: number;
  outlet_right_owner: number;
}

export interface DailyFinancialSummary {
  total_customer: number;
  total_owner: number;
  total_outlet: number;
  total_cash_payment: number;
  total_digital_payment: number;
  total_dfod_outstanding: number;
  jumlah_transaksi: number;
  jumlah_express: number;
  jumlah_cargo: number;
  total_outlet_admin: number;
  total_outlet_owner: number;
}

export function calculateFinancialSummary(tx: any[]): DailyFinancialSummary;
export function calculateFinancialSummary(tx: any): SingleFinancialSummary;
export function calculateFinancialSummary(tx: any): any {
  if (!tx) {
    return {
      customer_payment: 0,
      owner_deposit: 0,
      outlet_cash: 0,
      rounding: 0,
      cash_payment: 0,
      digital_payment: 0,
      dfod_outstanding: 0,
      outlet_right_admin: 0,
      outlet_right_owner: 0
    };
  }

  if (Array.isArray(tx)) {
    return calculateDailyFinancial(tx);
  }

  if (!isTransactionValidForFinance(tx)) {
    return {
      customer_payment: 0,
      owner_deposit: 0,
      outlet_cash: 0,
      rounding: 0,
      cash_payment: 0,
      digital_payment: 0,
      dfod_outstanding: 0,
      outlet_right_admin: 0,
      outlet_right_owner: 0
    };
  }

  const paymentMethod = tx.metode_bayar || tx.metode_pembayaran_ongkir || tx.metode_bayar_ongkir || "";
  const isDoc = isDocumentTransaction(tx);
  const isDfod = String(paymentMethod).trim().toUpperCase().includes("DFOD");

  // Pure inputs
  let ongkir_customer = safeNum(tx.ongkir_customer ?? tx.ongkir_dasar ?? tx.ongkir ?? tx.biaya_kirim ?? tx.biaya_ongkir ?? tx.ongkir_yoyi);
  const asuransi = safeNum(tx.biaya_asuransi ?? tx.asuransi);
  let biaya_lain = safeNum(tx.biaya_lain !== undefined && tx.biaya_lain !== null && tx.biaya_lain !== "" ? tx.biaya_lain : tx.biaya_lain_yoyi);

  if (isDoc && biaya_lain === 0) {
    const refWajibSetor = safeNum(tx.wajib_setor_owner ?? tx.setoran_ke_owner ?? tx.setoran_owner ?? 0);
    const currentSum = ongkir_customer + asuransi;
    if (refWajibSetor > 0) {
      if (currentSum + 1000 === refWajibSetor) {
        biaya_lain = 1000;
      }
    } else {
      biaya_lain = 1000;
    }
  }

  const rawAmplop = safeNum(tx.amplop ?? tx.biaya_amplop);
  const amplop = (isDoc && rawAmplop === 0) ? 2000 : rawAmplop;
  const packing = safeNum(tx.packing ?? tx.biaya_packing);
  const biaya_tambahan_direct = safeNum(tx.biaya_tambahan ?? tx.surcharge);
  
  // Biaya Dasar Layanan (Ongkir Dasar + Asuransi + Biaya Lain-lain)
  const biayaDasarLayanan = ongkir_customer + asuransi + biaya_lain;
  
  // Surcharges / Kas Operasional Outlet (Amplop + Packing)
  const biayaTambahan = (amplop + packing > 0) ? (amplop + packing) : biaya_tambahan_direct;

  // 1. Explicit Grand Total
  let grandTotal = safeNum(tx.grand_total ?? tx.total_customer);
  
  // 2. Base payment for shipment (Dibayar Customer)
  const dibayarCustomer = safeNum(tx.total_dibayar_customer ?? tx.jumlah_dibayar_customer ?? tx.total_bayar ?? tx.total_biaya ?? tx.total_diterima);
  
  // 3. Rounding calculation
  let rounding = safeNum(tx.pembulatan ?? tx.rounding);
  
  if (grandTotal > 0) {
    const subtotal = (isDfod ? 0 : biayaDasarLayanan) + biayaTambahan;
    if (grandTotal > subtotal && rounding === 0 && !isDfod) {
      rounding = grandTotal - subtotal;
    }
  } else if (dibayarCustomer > 0 && !isDfod) {
    if (dibayarCustomer > biayaDasarLayanan && rounding === 0) {
      rounding = dibayarCustomer - biayaDasarLayanan;
    }
    grandTotal = dibayarCustomer + biayaTambahan;
  } else {
    grandTotal = (isDfod ? 0 : (biayaDasarLayanan + rounding)) + biayaTambahan;
  }

  // Wajib Setor Owner = Biaya Dasar Layanan + Pembulatan (for Non-DFOD)
  // For DFOD, owner deposit to be submitted by origin outlet is 0
  const owner_deposit = isDfod ? 0 : (biayaDasarLayanan + rounding);
  const outlet_cash = biayaTambahan;
  const customer_payment = isDfod ? outlet_cash : (owner_deposit + outlet_cash);
  
  const classification = classifyPayment(owner_deposit, outlet_cash, paymentMethod, isDfod ? (biayaDasarLayanan + rounding) : 0);
  
  return {
    customer_payment: customer_payment,
    owner_deposit: owner_deposit,
    outlet_cash: outlet_cash,
    rounding: rounding,
    cash_payment: classification.cash_payment,
    digital_payment: classification.digital_payment,
    dfod_outstanding: classification.dfod_outstanding,
    outlet_right_admin: classification.outlet_right_admin,
    outlet_right_owner: classification.outlet_right_owner
  };
}

export function calculateDailyFinancial(transactions: any[]) {
  let total_customer = 0;
  let total_owner = 0;
  let total_outlet = 0;
  let total_cash_payment = 0;
  let total_digital_payment = 0;
  let total_dfod_outstanding = 0;
  let total_outlet_admin = 0;
  let total_outlet_owner = 0;
  let jumlah_transaksi = 0;
  let jumlah_express = 0;
  let jumlah_cargo = 0;

  for (const tx of (transactions || [])) {
    if (!isTransactionValidForFinance(tx)) continue;
    
    const summary = calculateFinancialSummary(tx);
    total_customer += summary.customer_payment;
    total_owner += summary.owner_deposit;
    total_outlet += summary.outlet_cash;
    total_cash_payment += summary.cash_payment;
    total_digital_payment += summary.digital_payment;
    total_dfod_outstanding += summary.dfod_outstanding;
    total_outlet_admin += summary.outlet_right_admin;
    total_outlet_owner += summary.outlet_right_owner;
    jumlah_transaksi++;

    const eks = (tx.ekspedisi || "").toUpperCase();
    if (eks === "EXPRESS") jumlah_express++;
    else if (eks === "CARGO") jumlah_cargo++;
  }

  return {
    total_customer,
    total_owner,
    total_outlet,
    total_cash_payment,
    total_digital_payment,
    total_dfod_outstanding,
    total_outlet_admin,
    total_outlet_owner,
    jumlah_transaksi,
    jumlah_express,
    jumlah_cargo
  };
}

export function calculateAdminFinancial(transactions: any[]) {
  const result: Record<string, any> = {};
  for (const tx of (transactions || [])) {
    if (!isTransactionValidForFinance(tx)) continue;
    const admin = tx.admin_id || "UNKNOWN";
    if (!result[admin]) {
      result[admin] = {
        admin_id: admin,
        customer_payment: 0,
        owner_deposit: 0,
        outlet_cash: 0,
        cash_payment: 0,
        digital_payment: 0,
        dfod_outstanding: 0,
        jumlah_resi: 0
      };
    }
    const summary = calculateFinancialSummary(tx);
    result[admin].customer_payment += summary.customer_payment;
    result[admin].owner_deposit += summary.owner_deposit;
    result[admin].outlet_cash += summary.outlet_cash;
    result[admin].cash_payment += summary.cash_payment;
    result[admin].digital_payment += summary.digital_payment;
    result[admin].dfod_outstanding += summary.dfod_outstanding;
    result[admin].jumlah_resi++;
  }
  return Object.values(result);
}

export function calculateOutletFinancial(transactions: any[]) {
  const result: Record<string, any> = {};
  for (const tx of (transactions || [])) {
    if (!isTransactionValidForFinance(tx)) continue;
    const outlet = tx.outlet_id || "UNKNOWN";
    if (!result[outlet]) {
      result[outlet] = {
        outlet_id: outlet,
        customer_payment: 0,
        owner_deposit: 0,
        outlet_cash: 0,
        cash_payment: 0,
        digital_payment: 0,
        dfod_outstanding: 0,
        jumlah_resi: 0,
        jumlah_express: 0,
        jumlah_cargo: 0
      };
    }
    const summary = calculateFinancialSummary(tx);
    result[outlet].customer_payment += summary.customer_payment;
    result[outlet].owner_deposit += summary.owner_deposit;
    result[outlet].outlet_cash += summary.outlet_cash;
    result[outlet].cash_payment += summary.cash_payment;
    result[outlet].digital_payment += summary.digital_payment;
    result[outlet].dfod_outstanding += summary.dfod_outstanding;
    result[outlet].jumlah_resi++;

    const eks = (tx.ekspedisi || "").toUpperCase();
    if (eks === "EXPRESS") result[outlet].jumlah_express++;
    else if (eks === "CARGO") result[outlet].jumlah_cargo++;
  }
  return Object.values(result);
}

