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

function classifyPayment(owner_deposit: number, rawMethodInput?: string) {
  const rawMethod = String(rawMethodInput || "").trim().toUpperCase();
  const isDigital = rawMethod === "QRIS" || rawMethod === "TRANSFER" || rawMethod === "ORDER BY APP" || rawMethod === "ORDER_BY_APP" || rawMethod === "APP";
  const isDfod = rawMethod === "DFOD" || rawMethod.includes("DFOD");

  if (isDfod) {
    return {
      cash_payment: 0,
      digital_payment: 0,
      dfod_outstanding: owner_deposit
    };
  }
  if (isDigital) {
    return {
      cash_payment: 0,
      digital_payment: owner_deposit,
      dfod_outstanding: 0
    };
  }
  return {
    cash_payment: owner_deposit,
    digital_payment: 0,
    dfod_outstanding: 0
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
      dfod_outstanding: 0
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
      dfod_outstanding: 0
    };
  }

  const paymentMethod = tx.metode_bayar || tx.metode_pembayaran_ongkir || tx.metode_bayar_ongkir || "";
  const isDoc = isDocumentTransaction(tx);

  // Pure inputs
  const ongkir_customer = safeNum(tx.ongkir_customer ?? tx.ongkir_dasar ?? tx.biaya_kirim ?? tx.ongkir_yoyi ?? tx.biaya_ongkir ?? tx.ongkir);
  const asuransi = safeNum(tx.asuransi ?? tx.biaya_asuransi);
  const rawBiayaLain = safeNum(tx.biaya_lain ?? tx.biaya_lain_yoyi);
  const biaya_lain = (isDoc && rawBiayaLain === 0) ? 1000 : rawBiayaLain;
  const rawAmplop = safeNum(tx.amplop ?? tx.biaya_amplop);
  const amplop = (isDoc && rawAmplop === 0) ? 2000 : rawAmplop;
  const packing = safeNum(tx.packing ?? tx.biaya_packing);
  const biaya_tambahan_direct = safeNum(tx.biaya_tambahan ?? tx.surcharge);
  
  // Total Uang Dibayar Customer
  const total_customer = safeNum(tx.grand_total ?? tx.total_customer ?? tx.total_dibayar_customer ?? tx.jumlah_dibayar_customer ?? tx.total_bayar ?? tx.total_biaya ?? tx.total_diterima);
  
  // Biaya Dasar Layanan
  const biayaDasarLayanan = ongkir_customer + asuransi + biaya_lain;
  
  // Surcharges / Kas Operasional Outlet
  const biayaTambahan = (amplop + packing > 0) ? (amplop + packing) : biaya_tambahan_direct;

  // Subtotal sebelum pembulatan
  const subtotal = biayaDasarLayanan + biayaTambahan;
  
  // Pembulatan (Rounding) -> Wajib Setor OWNER
  let rounding = 0;
  if (total_customer > 0) {
    rounding = total_customer - subtotal;
    if (rounding < 0) rounding = 0;
  } else {
    rounding = safeNum(tx.pembulatan ?? tx.rounding);
  }
  
  // Setoran Ke Owner = Biaya Dasar Layanan + Pembulatan
  const owner_deposit = biayaDasarLayanan + rounding;
  
  // Customer Payment Total
  const customer_payment = total_customer > 0 ? total_customer : (owner_deposit + biayaTambahan);
  const classification = classifyPayment(owner_deposit, paymentMethod);
  
  return {
    customer_payment: customer_payment,
    owner_deposit: owner_deposit,
    outlet_cash: biayaTambahan,
    rounding: rounding,
    cash_payment: classification.cash_payment,
    digital_payment: classification.digital_payment,
    dfod_outstanding: classification.dfod_outstanding
  };
}

export function calculateDailyFinancial(transactions: any[]) {
  let total_customer = 0;
  let total_owner = 0;
  let total_outlet = 0;
  let total_cash_payment = 0;
  let total_digital_payment = 0;
  let total_dfod_outstanding = 0;
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

