import { 
  calculateFinancialSummary, 
  calculateDailyFinancial, 
  isTransactionValidForFinance 
} from "./financialEngine";

export type SettlementStatus =
  | "UNSETTLED"
  | "PENDING_DEPOSIT"
  | "DEPOSIT_RECORDED"
  | "MATCHED"
  | "MISMATCH"
  | "UNDER_REVIEW"
  | "RESOLVED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "SETTLED"
  | "REOPENED";

export interface SettlementRecord {
  settlement_id: string; // STL-${outlet_id}-${tanggal}
  outlet_id: string;
  tanggal: string;
  status: SettlementStatus;

  // Single Source of Truth from Financial Engine
  expected_owner_deposit: number;
  actual_owner_deposit: number;
  difference: number;
  deposit_status: "MATCHED" | "MISMATCH" | "MISSING" | "UNAPPROVED";

  // Financial details
  total_customer: number;
  total_outlet_cash: number;
  total_rounding: number;
  transaction_count: number;
  valid_financial_transaction_count: number;
  cancelled_transaction_count: number;

  // Setoran Reference
  setoran_id?: string;
  setoran_notes?: string;

  // Reconciliation summary
  reconciliation_status: "MATCHED" | "WARNING" | "MISMATCH" | "CRITICAL";
  open_exceptions_count: number;
  open_critical_count: number;
  open_error_count: number;
  open_warning_count: number;

  // Actor & Audit Metadata
  created_by: string;
  created_at: string;
  deposit_recorded_by?: string;
  deposit_recorded_at?: string;
  reconciled_by?: string;
  reconciled_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  approved_by?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  reopened_by?: string;
  reopened_at?: string;
  
  rejection_reason?: string;
  reopen_reason?: string;
  review_notes?: string;

  updated_at: string;
}

export function generateSettlementId(outletId: string, tanggal: string): string {
  const cleanOutlet = (outletId || "GLOBAL").trim().toUpperCase();
  const cleanDate = (tanggal || new Date().toISOString().split("T")[0]).trim();
  return `STL-${cleanOutlet}-${cleanDate}`;
}

const VALID_TRANSITIONS: Record<SettlementStatus, SettlementStatus[]> = {
  UNSETTLED: ["PENDING_DEPOSIT", "DEPOSIT_RECORDED", "MATCHED", "MISMATCH"],
  PENDING_DEPOSIT: ["DEPOSIT_RECORDED", "MATCHED", "MISMATCH"],
  DEPOSIT_RECORDED: ["MATCHED", "MISMATCH", "PENDING_APPROVAL", "APPROVED"],
  MATCHED: ["PENDING_APPROVAL", "APPROVED", "MISMATCH"],
  MISMATCH: ["UNDER_REVIEW", "DEPOSIT_RECORDED", "MATCHED", "PENDING_APPROVAL"],
  UNDER_REVIEW: ["RESOLVED", "PENDING_APPROVAL", "APPROVED"],
  RESOLVED: ["PENDING_APPROVAL", "APPROVED"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED"],
  REJECTED: ["UNDER_REVIEW"],
  APPROVED: ["SETTLED"],
  SETTLED: ["REOPENED"],
  REOPENED: ["UNDER_REVIEW", "PENDING_APPROVAL", "APPROVED"]
};

export function isValidSettlementTransition(fromStatus: SettlementStatus, toStatus: SettlementStatus): boolean {
  if (fromStatus === toStatus) return true;
  
  // Explicit forbidden illegal transitions
  if (fromStatus === "SETTLED" && toStatus === "UNSETTLED") return false;
  if (fromStatus === "APPROVED" && (toStatus === "PENDING_DEPOSIT" || toStatus === "DEPOSIT_RECORDED" || toStatus === "UNSETTLED")) return false;
  if (fromStatus === "MATCHED" && toStatus === "UNSETTLED") return false;
  if (fromStatus === "REJECTED" && toStatus === "SETTLED") return false;

  const allowed = VALID_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

export function calculateSettlementSummary(transactions: any[], actualDepositInput?: number) {
  let total_customer = 0;
  let total_owner_deposit = 0;
  let total_outlet_cash = 0;
  let total_rounding = 0;
  let transaction_count = 0;
  let valid_financial_transaction_count = 0;
  let cancelled_transaction_count = 0;

  for (const tx of (transactions || [])) {
    transaction_count++;
    if (!isTransactionValidForFinance(tx)) {
      cancelled_transaction_count++;
      continue;
    }
    valid_financial_transaction_count++;
    const summary = calculateFinancialSummary(tx);
    total_customer += summary.customer_payment;
    total_owner_deposit += summary.owner_deposit;
    total_outlet_cash += summary.outlet_cash;
    total_rounding += summary.rounding;
  }

  const expected_owner_deposit = total_owner_deposit;
  const actual_owner_deposit = actualDepositInput !== undefined && actualDepositInput !== null ? actualDepositInput : 0;
  const difference = actual_owner_deposit - expected_owner_deposit;

  let deposit_status: "MATCHED" | "MISMATCH" | "MISSING" | "UNAPPROVED" = "MATCHED";
  if (actualDepositInput === undefined || actualDepositInput === null) {
    deposit_status = "MISSING";
  } else if (Math.abs(difference) <= 0.01) {
    deposit_status = "MATCHED";
  } else {
    deposit_status = "MISMATCH";
  }

  return {
    expected_owner_deposit,
    actual_owner_deposit,
    difference,
    deposit_status,
    total_customer,
    total_outlet_cash,
    total_rounding,
    transaction_count,
    valid_financial_transaction_count,
    cancelled_transaction_count
  };
}

export function ensureSettlementTable(db: any): SettlementRecord[] {
  if (!db.Settlements) {
    db.Settlements = db.SettlementRecords || db.Settlement || [];
  }
  return db.Settlements;
}

export function filterOutletDateTransactions(db: any, outlet_id: string, tanggal: string): any[] {
  const allTx = db.MASTER_TRANSAKSI || [];
  return allTx.filter((tx: any) => {
    const d = tx.created_at ? tx.created_at.split("T")[0] : (tx.tanggal_transaksi || tx.tanggal || "");
    const outlet = tx.outlet_id || tx.kode_outlet || "";
    return outlet === outlet_id && d === tanggal;
  });
}

export function getSetoranRecord(db: any, outlet_id: string, tanggal: string): any | null {
  const allSetoran = db.Master_Setoran || db.SetoranData || db.Setoran || [];
  return allSetoran.find((s: any) => {
    const sDate = s.tanggal || s.date || "";
    const sOutlet = s.outlet_id || s.kode_outlet || "";
    return sOutlet === outlet_id && sDate === tanggal && s.status !== "DITOLAK";
  }) || null;
}

export function getSettlementRecord(db: any, outletId: string, tanggal: string): SettlementRecord | null {
  const list = ensureSettlementTable(db);
  const stlId = generateSettlementId(outletId, tanggal);
  return list.find((s: SettlementRecord) => s.settlement_id === stlId || (s.outlet_id === outletId && s.tanggal === tanggal)) || null;
}

export function processCreateSettlement(params: {
  outlet_id: string;
  tanggal: string;
  transactions: any[];
  setoranRecord?: any;
  actor: { actor_id: string; actor_name?: string; actor_role?: string };
  existingRecord?: SettlementRecord | null;
}): { status: "success" | "error"; message: string; data: SettlementRecord; isUpdate?: boolean } {
  const { outlet_id, tanggal, transactions, setoranRecord, actor, existingRecord } = params;
  const stlId = generateSettlementId(outlet_id, tanggal);
  const now = new Date().toISOString();

  let actualDeposit: number | undefined = undefined;
  let setoranId: string | undefined = undefined;
  if (setoranRecord) {
    actualDeposit = Number(setoranRecord.nominal ?? setoranRecord.jumlah_setoran ?? setoranRecord.jumlah_setor ?? 0);
    setoranId = setoranRecord.id || setoranRecord.setoran_id;
  } else if (existingRecord && existingRecord.actual_owner_deposit !== undefined) {
    actualDeposit = existingRecord.actual_owner_deposit;
    setoranId = existingRecord.setoran_id;
  }

  const calc = calculateSettlementSummary(transactions, actualDeposit);

  let status: SettlementStatus = "UNSETTLED";
  if (existingRecord) {
    status = existingRecord.status;
  } else if (actualDeposit !== undefined) {
    status = Math.abs(calc.difference) <= 0.01 ? "MATCHED" : "MISMATCH";
  } else {
    status = "UNSETTLED";
  }

  const record: SettlementRecord = {
    settlement_id: stlId,
    outlet_id,
    tanggal,
    status,
    expected_owner_deposit: calc.expected_owner_deposit,
    actual_owner_deposit: calc.actual_owner_deposit,
    difference: calc.difference,
    deposit_status: calc.deposit_status,
    total_customer: calc.total_customer,
    total_outlet_cash: calc.total_outlet_cash,
    total_rounding: calc.total_rounding,
    transaction_count: calc.transaction_count,
    valid_financial_transaction_count: calc.valid_financial_transaction_count,
    cancelled_transaction_count: calc.cancelled_transaction_count,
    setoran_id: setoranId,
    reconciliation_status: Math.abs(calc.difference) <= 0.01 ? "MATCHED" : "MISMATCH",
    open_exceptions_count: existingRecord?.open_exceptions_count || 0,
    open_critical_count: existingRecord?.open_critical_count || 0,
    open_error_count: existingRecord?.open_error_count || 0,
    open_warning_count: existingRecord?.open_warning_count || 0,
    created_by: existingRecord?.created_by || actor.actor_id,
    created_at: existingRecord?.created_at || now,
    updated_at: now
  };

  return {
    status: "success",
    message: existingRecord ? `Settlement '${stlId}' berhasil diperbarui.` : `Settlement '${stlId}' berhasil dibuat.`,
    data: record,
    isUpdate: !!existingRecord
  };
}

export function processRecordDeposit(params: {
  settlement: SettlementRecord;
  actual_amount: number;
  setoran_id?: string;
  notes?: string;
  actor: { actor_id: string; actor_name?: string; actor_role?: string };
}): { status: "success" | "error"; message: string; data?: SettlementRecord; error_code?: string } {
  const { settlement, actual_amount, setoran_id, notes, actor } = params;

  let targetStatus: SettlementStatus = "DEPOSIT_RECORDED";
  const diff = actual_amount - settlement.expected_owner_deposit;
  if (Math.abs(diff) <= 0.01) {
    targetStatus = "MATCHED";
  } else {
    targetStatus = "MISMATCH";
  }

  if (!isValidSettlementTransition(settlement.status, targetStatus)) {
    return {
      status: "error",
      error_code: "INVALID_STATE_TRANSITION",
      message: `Ilegal transition dari '${settlement.status}' ke '${targetStatus}'.`
    };
  }

  const now = new Date().toISOString();
  const updated: SettlementRecord = {
    ...settlement,
    actual_owner_deposit: actual_amount,
    difference: diff,
    deposit_status: Math.abs(diff) <= 0.01 ? "MATCHED" : "MISMATCH",
    status: targetStatus,
    setoran_id: setoran_id || settlement.setoran_id,
    setoran_notes: notes || settlement.setoran_notes,
    deposit_recorded_by: actor.actor_id,
    deposit_recorded_at: now,
    updated_at: now
  };

  return {
    status: "success",
    message: `Deposit disetorkan Rp ${actual_amount.toLocaleString('id-ID')}. Status settlement: ${targetStatus}`,
    data: updated
  };
}

export function processReconcileSettlement(params: {
  settlement: SettlementRecord;
  transactions: any[];
  actualDepositInput?: number;
  openExceptions?: any[];
  actor: { actor_id: string; actor_name?: string; actor_role?: string };
}): { status: "success" | "error"; message: string; data: SettlementRecord } {
  const { settlement, transactions, actualDepositInput, openExceptions, actor } = params;
  const actualDep = actualDepositInput !== undefined ? actualDepositInput : settlement.actual_owner_deposit;

  const calc = calculateSettlementSummary(transactions, actualDep);

  const exceptions = openExceptions || [];
  const open_critical_count = exceptions.filter((e: any) => e.severity === "CRITICAL" && e.status === "OPEN").length;
  const open_error_count = exceptions.filter((e: any) => e.severity === "ERROR" && e.status === "OPEN").length;
  const open_warning_count = exceptions.filter((e: any) => e.severity === "WARNING" && e.status === "OPEN").length;
  const open_exceptions_count = exceptions.filter((e: any) => e.status === "OPEN").length;

  let reconStatus: "MATCHED" | "WARNING" | "MISMATCH" | "CRITICAL" = "MATCHED";
  if (open_critical_count > 0) reconStatus = "CRITICAL";
  else if (open_error_count > 0 || Math.abs(calc.difference) > 0.01) reconStatus = "MISMATCH";
  else if (open_warning_count > 0) reconStatus = "WARNING";

  let nextStatus = settlement.status;
  if (Math.abs(calc.difference) <= 0.01 && open_critical_count === 0 && open_error_count === 0) {
    if (settlement.status === "DEPOSIT_RECORDED" || settlement.status === "MATCHED" || settlement.status === "UNDER_REVIEW" || settlement.status === "RESOLVED") {
      nextStatus = "PENDING_APPROVAL";
    }
  } else if (Math.abs(calc.difference) > 0.01 || open_critical_count > 0 || open_error_count > 0) {
    if (settlement.status !== "REJECTED" && settlement.status !== "SETTLED") {
      nextStatus = "MISMATCH";
    }
  }

  const now = new Date().toISOString();
  const updated: SettlementRecord = {
    ...settlement,
    expected_owner_deposit: calc.expected_owner_deposit,
    actual_owner_deposit: calc.actual_owner_deposit,
    difference: calc.difference,
    deposit_status: calc.deposit_status,
    total_customer: calc.total_customer,
    total_outlet_cash: calc.total_outlet_cash,
    total_rounding: calc.total_rounding,
    transaction_count: calc.transaction_count,
    valid_financial_transaction_count: calc.valid_financial_transaction_count,
    cancelled_transaction_count: calc.cancelled_transaction_count,
    reconciliation_status: reconStatus,
    open_exceptions_count,
    open_critical_count,
    open_error_count,
    open_warning_count,
    status: nextStatus,
    reconciled_by: actor.actor_id,
    reconciled_at: now,
    updated_at: now
  };

  return {
    status: "success",
    message: `Rekonsiliasi settlement selesai. Status: ${nextStatus}`,
    data: updated
  };
}

export function processApproveSettlement(params: {
  settlement: SettlementRecord;
  openExceptions?: any[];
  actor: { actor_id: string; actor_name?: string; actor_role?: string };
  allowSelfApproval?: boolean;
}): { status: "success" | "error"; message: string; data?: SettlementRecord; error_code?: string } {
  const { settlement, openExceptions, actor, allowSelfApproval } = params;

  // 1. Segregation of duties: Role check
  const role = (actor.actor_role || "").toUpperCase();
  if (role !== "OWNER") {
    return {
      status: "error",
      error_code: "UNAUTHORIZED_APPROVAL",
      message: "Akses ditolak: Hanya Owner atau Super Admin yang berhak menyetujui Settlement Keuangan."
    };
  }

  // 2. Self Approval Protection
  if (!allowSelfApproval && actor.actor_id) {
    if (settlement.created_by && actor.actor_id === settlement.created_by) {
      return {
        status: "error",
        error_code: "SELF_APPROVAL_PROHIBITED",
        message: "Self Approval dilarang: Pembuat settlement tidak boleh menyetujui settlement-nya sendiri."
      };
    }
    if (settlement.deposit_recorded_by && actor.actor_id === settlement.deposit_recorded_by) {
      return {
        status: "error",
        error_code: "SELF_APPROVAL_PROHIBITED",
        message: "Self Approval dilarang: Perekam deposit tidak boleh menyetujui settlement-nya sendiri."
      };
    }
  }

  // 3. Invalid Transition Check
  if (!isValidSettlementTransition(settlement.status, "APPROVED")) {
    return {
      status: "error",
      error_code: "INVALID_STATE_TRANSITION",
      message: `Sistem menolak approval. Transition ilegal dari '${settlement.status}' ke 'APPROVED'.`
    };
  }

  // 4. Financial Difference Check
  if (Math.abs(settlement.difference) > 0.01) {
    return {
      status: "error",
      error_code: "APPROVAL_REJECTED_MISMATCH",
      message: `Approval ditolak: Terdapat selisih deposit sebesar Rp ${settlement.difference.toLocaleString('id-ID')}.`
    };
  }

  // 5. Open Exceptions Check
  const openExceptionsList = openExceptions
    ? openExceptions.filter((e: any) => (!e.outlet_id || e.outlet_id === settlement.outlet_id) && (e.status === "OPEN" || e.status === "IN_REVIEW" || e.status === "REOPENED"))
    : null;
  const openCritical = openExceptionsList ? openExceptionsList.filter((e: any) => e.severity === "CRITICAL").length : settlement.open_critical_count;
  const openError = openExceptionsList ? openExceptionsList.filter((e: any) => e.severity === "ERROR").length : settlement.open_error_count;

  if (openCritical > 0) {
    return {
      status: "error",
      error_code: "APPROVAL_REJECTED_CRITICAL_EXCEPTIONS",
      message: "Approval ditolak: Masih terdapat exception CRITICAL yang belum selesai."
    };
  }

  if (openError > 0) {
    return {
      status: "error",
      error_code: "APPROVAL_REJECTED_ERROR_EXCEPTIONS",
      message: "Approval ditolak: Masih terdapat exception ERROR yang belum selesai."
    };
  }

  const now = new Date().toISOString();
  const updated: SettlementRecord = {
    ...settlement,
    status: "APPROVED",
    approved_by: actor.actor_id,
    approved_at: now,
    updated_at: now
  };

  return {
    status: "success",
    message: `Settlement '${settlement.settlement_id}' berhasil disetujui (APPROVED) oleh Owner.`,
    data: updated
  };
}

export function processRejectSettlement(params: {
  settlement: SettlementRecord;
  reason: string;
  actor: { actor_id: string; actor_name?: string; actor_role?: string };
}): { status: "success" | "error"; message: string; data?: SettlementRecord; error_code?: string } {
  const { settlement, reason, actor } = params;

  const role = (actor.actor_role || "").toUpperCase();
  if (role !== "OWNER") {
    return {
      status: "error",
      error_code: "UNAUTHORIZED_REJECTION",
      message: "Akses ditolak: Hanya Owner atau Super Admin yang dapat menolak settlement."
    };
  }

  if (!isValidSettlementTransition(settlement.status, "REJECTED")) {
    return {
      status: "error",
      error_code: "INVALID_STATE_TRANSITION",
      message: `Transition ilegal dari '${settlement.status}' ke 'REJECTED'.`
    };
  }

  const now = new Date().toISOString();
  const updated: SettlementRecord = {
    ...settlement,
    status: "REJECTED",
    rejected_by: actor.actor_id,
    rejected_at: now,
    rejection_reason: reason,
    updated_at: now
  };

  return {
    status: "success",
    message: `Settlement '${settlement.settlement_id}' telah DITOLAK oleh Owner.`,
    data: updated
  };
}

export function processReopenSettlement(params: {
  settlement: SettlementRecord;
  reason: string;
  actor: { actor_id: string; actor_name?: string; actor_role?: string };
}): { status: "success" | "error"; message: string; data?: SettlementRecord; error_code?: string } {
  const { settlement, reason, actor } = params;

  const role = (actor.actor_role || "").toUpperCase();
  if (role !== "OWNER") {
    return {
      status: "error",
      error_code: "UNAUTHORIZED_REOPEN",
      message: "Akses ditolak: Hanya Owner atau Super Admin yang berhak membuka kembali (REOPEN) settlement."
    };
  }

  if (!isValidSettlementTransition(settlement.status, "REOPENED")) {
    return {
      status: "error",
      error_code: "INVALID_STATE_TRANSITION",
      message: `Transition ilegal dari '${settlement.status}' ke 'REOPENED'.`
    };
  }

  const now = new Date().toISOString();
  const updated: SettlementRecord = {
    ...settlement,
    status: "REOPENED",
    reopened_by: actor.actor_id,
    reopened_at: now,
    reopen_reason: reason,
    updated_at: now
  };

  return {
    status: "success",
    message: `Settlement '${settlement.settlement_id}' telah DIBUKA KEMBALI (REOPENED).`,
    data: updated
  };
}

export function processSettleSettlement(params: {
  settlement: SettlementRecord;
  actor: { actor_id: string; actor_name?: string; actor_role?: string };
}): { status: "success" | "error"; message: string; data?: SettlementRecord; error_code?: string } {
  const { settlement, actor } = params;

  if (!isValidSettlementTransition(settlement.status, "SETTLED")) {
    return {
      status: "error",
      error_code: "INVALID_STATE_TRANSITION",
      message: `Transition ilegal dari '${settlement.status}' ke 'SETTLED'.`
    };
  }

  const now = new Date().toISOString();
  const updated: SettlementRecord = {
    ...settlement,
    status: "SETTLED",
    updated_at: now
  };

  return {
    status: "success",
    message: `Settlement '${settlement.settlement_id}' resmi ditutup/selesai (SETTLED).`,
    data: updated
  };
}
