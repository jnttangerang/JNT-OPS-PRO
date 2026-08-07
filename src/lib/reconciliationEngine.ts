import { 
  calculateFinancialSummary, 
  isTransactionValidForFinance 
} from "./financialEngine";
import { 
  checkDuplicateResi, 
  checkDuplicateTransaction, 
  checkDuplicateImport 
} from "./operationalEngine";
import { auditTransaction } from "./auditEngine";
import { logAuditEvent, getAuditTrail } from "./auditTrailEngine";

export type ReconciliationStatus = "MATCHED" | "WARNING" | "MISMATCH" | "CRITICAL";
export type ExceptionSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export interface ReconciliationException {
  id: string;
  type: string;
  severity: ExceptionSeverity;
  entity_type: string;
  entity_id: string;
  transaksi_id?: string;
  import_id?: string;

  field?: string;
  expected?: any;
  actual?: any;
  difference?: number;

  reason: string;
  source_a?: string;
  source_b?: string;

  recommendation: string;
}

export interface ReconciliationResult {
  reconciliation_id: string;
  executed_at: string;
  scope: "TRANSACTION" | "DAILY" | "OUTLET" | "GLOBAL";
  scope_id?: string;
  period_start?: string;
  period_end?: string;

  status: ReconciliationStatus;

  source_a: string;
  source_b: string;

  matched_count: number;
  unmatched_count: number;
  exception_count: number;

  expected_total: number;
  actual_total: number;
  variance_total: number;

  exceptions: ReconciliationException[];

  summary: {
    total_checked: number;
    total_matched: number;
    total_warning: number;
    total_error: number;
    total_critical: number;

    total_expected: number;
    total_actual: number;
    total_variance: number;
  };

  recommendations: string[];
}

function safeNum(val: any): number {
  if (val === null || val === undefined || isNaN(Number(val))) return 0;
  return Number(val);
}

// 1. Single Transaction Reconciliation
export function reconcileTransaction(db: any, transaksiId: string): ReconciliationResult {
  const now = new Date().toISOString();
  const reconId = "REC-TX-" + String(Date.now()).slice(-6) + Math.floor(Math.random() * 100);
  const exceptions: ReconciliationException[] = [];

  const allTx = db.MASTER_TRANSAKSI || [];
  const allShip = db.MASTER_PENGIRIMAN || [];
  const allSenders = db.MASTER_PENGIRIM || [];
  const allReceivers = db.MASTER_PENERIMA || [];
  const allSetoran = db.Master_Setoran || db.SetoranData || [];

  const tx = allTx.find((t: any) => t.id === transaksiId);
  const matchingShips = allShip.filter((s: any) => s.transaksi_id === transaksiId);

  let expectedTotal = 0;
  let actualTotal = 0;

  if (!tx) {
    // Check if orphan shipment exists
    if (matchingShips.length > 0) {
      exceptions.push({
        id: "EXC-" + Math.floor(Math.random() * 100000),
        type: "SHIPMENT_WITHOUT_TRANSACTION",
        severity: "ERROR",
        entity_type: "SHIPMENT",
        entity_id: matchingShips[0].id,
        transaksi_id: transaksiId,
        reason: `Shipment '${matchingShips[0].id}' refers to transaksi_id '${transaksiId}' but no matching MASTER_TRANSAKSI record exists.`,
        source_a: "MASTER_PENGIRIMAN",
        source_b: "MASTER_TRANSAKSI",
        recommendation: "Inspect MASTER_PENGIRIMAN for matching transaksi_id or recreate transaction record."
      });
    } else {
      exceptions.push({
        id: "EXC-" + Math.floor(Math.random() * 100000),
        type: "TRANSACTION_NOT_FOUND",
        severity: "ERROR",
        entity_type: "TRANSACTION",
        entity_id: transaksiId,
        transaksi_id: transaksiId,
        reason: `Transaction '${transaksiId}' does not exist in database.`,
        source_a: "MASTER_TRANSAKSI",
        recommendation: "Verify transaction_id parameter."
      });
    }
  } else {
    // A. Transaction <-> Shipment Check
    if (matchingShips.length === 0) {
      exceptions.push({
        id: "EXC-" + Math.floor(Math.random() * 100000),
        type: "TRANSACTION_WITHOUT_SHIPMENT",
        severity: "ERROR",
        entity_type: "TRANSACTION",
        entity_id: tx.id,
        transaksi_id: tx.id,
        reason: `Transaction '${tx.id}' exists in MASTER_TRANSAKSI but has no row in MASTER_PENGIRIMAN.`,
        source_a: "MASTER_TRANSAKSI",
        source_b: "MASTER_PENGIRIMAN",
        recommendation: "Inspect MASTER_PENGIRIMAN for matching transaksi_id."
      });
    } else if (matchingShips.length > 1) {
      const activeShips = matchingShips.filter((s: any) => s.status_pengiriman !== "BATAL" && s.status_pengiriman !== "CANCELLED");
      if (activeShips.length > 1) {
        exceptions.push({
          id: "EXC-" + Math.floor(Math.random() * 100000),
          type: "MULTIPLE_SHIPMENT_FOR_TRANSACTION",
          severity: "CRITICAL",
          entity_type: "TRANSACTION",
          entity_id: tx.id,
          transaksi_id: tx.id,
          reason: `Transaction '${tx.id}' has ${activeShips.length} active shipments in MASTER_PENGIRIMAN.`,
          source_a: "MASTER_PENGIRIMAN",
          recommendation: "Remove or cancel duplicate shipment records for this transaction."
        });
      }
    }

    // B. Customer FK Check
    if (tx.pengirim_id) {
      const senderExists = allSenders.some((s: any) => s.id === tx.pengirim_id);
      if (!senderExists) {
        exceptions.push({
          id: "EXC-" + Math.floor(Math.random() * 100000),
          type: "MISSING_SENDER",
          severity: "ERROR",
          entity_type: "CUSTOMER",
          entity_id: tx.pengirim_id,
          transaksi_id: tx.id,
          field: "pengirim_id",
          expected: tx.pengirim_id,
          actual: null,
          reason: `Sender ID '${tx.pengirim_id}' referenced in MASTER_TRANSAKSI does not exist in MASTER_PENGIRIM.`,
          source_a: "MASTER_TRANSAKSI",
          source_b: "MASTER_PENGIRIM",
          recommendation: "Verify pengirim_id reference."
        });
      }
    }

    if (tx.penerima_id) {
      const recExists = allReceivers.some((r: any) => r.id === tx.penerima_id);
      if (!recExists) {
        exceptions.push({
          id: "EXC-" + Math.floor(Math.random() * 100000),
          type: "MISSING_RECEIVER",
          severity: "ERROR",
          entity_type: "CUSTOMER",
          entity_id: tx.penerima_id,
          transaksi_id: tx.id,
          field: "penerima_id",
          expected: tx.penerima_id,
          actual: null,
          reason: `Receiver ID '${tx.penerima_id}' referenced in MASTER_TRANSAKSI does not exist in MASTER_PENERIMA.`,
          source_a: "MASTER_TRANSAKSI",
          source_b: "MASTER_PENERIMA",
          recommendation: "Verify penerima_id reference."
        });
      }
    }

    // C. Snapshot Consistency Check
    if (matchingShips.length > 0) {
      const ship = matchingShips[0];
      if (
        (tx.snapshot_nama_pengirim && ship.snapshot_nama_pengirim && tx.snapshot_nama_pengirim !== ship.snapshot_nama_pengirim) ||
        (tx.snapshot_nama_penerima && ship.snapshot_nama_penerima && tx.snapshot_nama_penerima !== ship.snapshot_nama_penerima)
      ) {
        exceptions.push({
          id: "EXC-" + Math.floor(Math.random() * 100000),
          type: "SNAPSHOT_MISMATCH",
          severity: "ERROR",
          entity_type: "TRANSACTION",
          entity_id: tx.id,
          transaksi_id: tx.id,
          field: "snapshot_nama",
          expected: tx.snapshot_nama_pengirim + " / " + tx.snapshot_nama_penerima,
          actual: ship.snapshot_nama_pengirim + " / " + ship.snapshot_nama_penerima,
          reason: `Snapshot customer between MASTER_TRANSAKSI and MASTER_PENGIRIMAN does not match.`,
          source_a: "MASTER_TRANSAKSI",
          source_b: "MASTER_PENGIRIMAN",
          recommendation: "Align transaction and shipment snapshots."
        });
      }
    }

    // D. Financial Recalculation Check
    const isValidForFinance = isTransactionValidForFinance(tx);
    const calcSummary = calculateFinancialSummary(tx);

    expectedTotal = calcSummary.customer_payment;
    actualTotal = safeNum(tx.total_customer);

    if (isValidForFinance) {
      // Check stored values vs calculated Financial Engine values
      // 1. wajib_setor_owner vs calcSummary.owner_deposit
      if (tx.wajib_setor_owner !== undefined && tx.wajib_setor_owner !== null) {
        const diffOwner = Math.abs(calcSummary.owner_deposit - safeNum(tx.wajib_setor_owner));
        if (diffOwner > 0.01) {
          exceptions.push({
            id: "EXC-" + Math.floor(Math.random() * 100000),
            type: "FINANCIAL_CALCULATION_MISMATCH",
            severity: diffOwner > 1000 ? "CRITICAL" : "ERROR",
            entity_type: "TRANSACTION",
            entity_id: tx.id,
            transaksi_id: tx.id,
            field: "wajib_setor_owner",
            expected: calcSummary.owner_deposit,
            actual: safeNum(tx.wajib_setor_owner),
            difference: diffOwner,
            reason: `Stored field 'wajib_setor_owner' (${tx.wajib_setor_owner}) differs from Financial Engine calculation (${calcSummary.owner_deposit}).`,
            source_a: "MASTER_TRANSAKSI",
            source_b: "FINANCIAL_ENGINE",
            recommendation: "Recalculate transaction using Financial Engine and inspect stored values."
          });
        }
      }

      // 2. kas_outlet vs calcSummary.outlet_cash
      if (tx.kas_outlet !== undefined && tx.kas_outlet !== null) {
        const diffOutlet = Math.abs(calcSummary.outlet_cash - safeNum(tx.kas_outlet));
        if (diffOutlet > 0.01) {
          exceptions.push({
            id: "EXC-" + Math.floor(Math.random() * 100000),
            type: "FINANCIAL_CALCULATION_MISMATCH",
            severity: diffOutlet > 1000 ? "CRITICAL" : "ERROR",
            entity_type: "TRANSACTION",
            entity_id: tx.id,
            transaksi_id: tx.id,
            field: "kas_outlet",
            expected: calcSummary.outlet_cash,
            actual: safeNum(tx.kas_outlet),
            difference: diffOutlet,
            reason: `Stored field 'kas_outlet' (${tx.kas_outlet}) differs from Financial Engine calculation (${calcSummary.outlet_cash}).`,
            source_a: "MASTER_TRANSAKSI",
            source_b: "FINANCIAL_ENGINE",
            recommendation: "Recalculate transaction using Financial Engine and inspect stored values."
          });
        }
      }

      // 3. total customer payment vs calcSummary.customer_payment
      const actualCustPayment = safeNum(tx.total_dibayar_customer || tx.total_customer);
      const expectedCustPayment = calcSummary.customer_payment;
      const isCustPaymentValid = (Math.abs(actualCustPayment - expectedCustPayment) <= 0.01) ||
        (Math.abs(actualCustPayment - calcSummary.owner_deposit) <= 0.01 && Math.abs(safeNum(tx.kas_outlet) - calcSummary.outlet_cash) <= 0.01);

      if (!isCustPaymentValid) {
        const diffCust = Math.abs(expectedCustPayment - actualCustPayment);
        exceptions.push({
          id: "EXC-" + Math.floor(Math.random() * 100000),
          type: "FINANCIAL_CALCULATION_MISMATCH",
          severity: diffCust > 1000 ? "CRITICAL" : "ERROR",
          entity_type: "TRANSACTION",
          entity_id: tx.id,
          transaksi_id: tx.id,
          field: "total_customer",
          expected: expectedCustPayment,
          actual: actualCustPayment,
          difference: diffCust,
          reason: `Stored field 'total_customer' (${actualCustPayment}) differs from Financial Engine calculation (${expectedCustPayment}).`,
          source_a: "MASTER_TRANSAKSI",
          source_b: "FINANCIAL_ENGINE",
          recommendation: "Recalculate transaction using Financial Engine and inspect stored values."
        });
      }

      // E. Outlet Cash Consistency Check
      const storedPacking = safeNum(tx.packing);
      const storedAmplop = safeNum(tx.amplop);
      const storedBiayaLain = safeNum(tx.biaya_lain);
      const sumKas = storedPacking + storedAmplop + storedBiayaLain;
      if (Math.abs(sumKas - safeNum(tx.kas_outlet)) > 0.01) {
        exceptions.push({
          id: "EXC-" + Math.floor(Math.random() * 100000),
          type: "OUTLET_CASH_MISMATCH",
          severity: "ERROR",
          entity_type: "TRANSACTION",
          entity_id: tx.id,
          transaksi_id: tx.id,
          field: "kas_outlet",
          expected: sumKas,
          actual: safeNum(tx.kas_outlet),
          difference: Math.abs(sumKas - safeNum(tx.kas_outlet)),
          reason: `Sum of packing + amplop + biaya_lain (${sumKas}) does not match stored kas_outlet (${tx.kas_outlet}).`,
          source_a: "MASTER_TRANSAKSI",
          source_b: "FINANCIAL_ENGINE",
          recommendation: "Verify outlet cash component details."
        });
      }

      // F. Owner Deposit & Approval Reconciliation
      const txDate = tx.created_at ? tx.created_at.split("T")[0] : (tx.tanggal_transaksi || "");
      const setoran = allSetoran.find((s: any) => (s.tanggal === txDate || s.date === txDate) && s.outlet_id === tx.outlet_id && s.status !== "DITOLAK");
      if (!setoran && (tx.status_transaksi === "PAID" || tx.status_transaksi === "SELESAI")) {
        exceptions.push({
          id: "EXC-" + Math.floor(Math.random() * 100000),
          type: "OWNER_DEPOSIT_MISSING",
          severity: "WARNING",
          entity_type: "TRANSACTION",
          entity_id: tx.id,
          transaksi_id: tx.id,
          reason: `Transaction is '${tx.status_transaksi}' but no active setoran record exists for outlet '${tx.outlet_id}' on date '${txDate}'.`,
          source_a: "MASTER_TRANSAKSI",
          source_b: "MASTER_SETORAN",
          recommendation: "Create setoran for outlet on transaction date."
        });
      }

      if (setoran && setoran.status === "DISETUJUI") {
        const auditLogs = getAuditTrail(db, { entity_id: setoran.setoran_id || setoran.id, event_type: "SETORAN_APPROVED" });
        if (auditLogs.length === 0) {
          exceptions.push({
            id: "EXC-" + Math.floor(Math.random() * 100000),
            type: "APPROVAL_EVIDENCE_MISSING",
            severity: "ERROR",
            entity_type: "SETORAN",
            entity_id: setoran.setoran_id || setoran.id || "",
            transaksi_id: tx.id,
            reason: `Setoran '${setoran.setoran_id}' is marked DISETUJUI but lacks SETORAN_APPROVED event in Audit Trail.`,
            source_a: "MASTER_SETORAN",
            source_b: "AUDIT_TRAIL",
            recommendation: "Review approval workflow and Audit Trail."
          });
        }
      }
    } else {
      // Transaction is invalid for finance (CANCELLED, FAILED, DRAFT, etc.)
      if (safeNum(tx.total_customer) > 0 || safeNum(tx.wajib_setor_owner) > 0) {
        // If it was wrongly included in an active setoran aggregate
        const txDate = tx.created_at ? tx.created_at.split("T")[0] : (tx.tanggal_transaksi || "");
        const activeSetoran = allSetoran.find((s: any) => (s.tanggal === txDate || s.date === txDate) && s.outlet_id === tx.outlet_id && s.status === "DISETUJUI");
        if (activeSetoran) {
          exceptions.push({
            id: "EXC-" + Math.floor(Math.random() * 100000),
            type: "INVALID_TRANSACTION_INCLUDED",
            severity: "CRITICAL",
            entity_type: "TRANSACTION",
            entity_id: tx.id,
            transaksi_id: tx.id,
            reason: `Invalid transaction (${tx.status_transaksi}) is included in active/approved setoran aggregate.`,
            source_a: "MASTER_TRANSAKSI",
            source_b: "FINANCIAL_ENGINE",
            recommendation: "Exclude invalid transaction from aggregate and inspect aggregation source."
          });
        }
      }
    }

    // G. Lifecycle Reconciliation
    if (matchingShips.length > 0) {
      const ship = matchingShips[0];
      const txStatus = tx.status_transaksi;
      const shipStatus = ship.status_pengiriman;
      if (txStatus === "CANCELLED" && shipStatus !== "CANCELLED" && shipStatus !== "BATAL") {
        exceptions.push({
          id: "EXC-" + Math.floor(Math.random() * 100000),
          type: "TRANSACTION_STATUS_MISMATCH",
          severity: "ERROR",
          entity_type: "TRANSACTION",
          entity_id: tx.id,
          transaksi_id: tx.id,
          field: "status_transaksi / status_pengiriman",
          expected: "CANCELLED",
          actual: shipStatus,
          reason: `Transaction is CANCELLED but Shipment is '${shipStatus}'.`,
          source_a: "MASTER_TRANSAKSI",
          source_b: "MASTER_PENGIRIMAN",
          recommendation: "Align shipment status with transaction lifecycle."
        });
      }
    }

    // H. Duplicate Check
    const dupCheck = checkDuplicateTransaction(db, tx.id);
    if (allTx.filter((t: any) => t.id === tx.id).length > 1) {
      exceptions.push({
        id: "EXC-" + Math.floor(Math.random() * 100000),
        type: "DUPLICATE_TRANSACTION_ID",
        severity: "CRITICAL",
        entity_type: "TRANSACTION",
        entity_id: tx.id,
        transaksi_id: tx.id,
        reason: `Duplicate rows found in MASTER_TRANSAKSI for ID '${tx.id}'.`,
        source_a: "MASTER_TRANSAKSI",
        recommendation: "Remove duplicate transaction records."
      });
    }

    if (tx.no_resi) {
      const dupResi = checkDuplicateResi(db, tx.no_resi, tx.id);
      if (dupResi.duplicate) {
        exceptions.push({
          id: "EXC-" + Math.floor(Math.random() * 100000),
          type: "DUPLICATE_ACTIVE_RESI",
          severity: "CRITICAL",
          entity_type: "TRANSACTION",
          entity_id: tx.id,
          transaksi_id: tx.id,
          field: "no_resi",
          expected: tx.no_resi,
          actual: dupResi.existing?.id,
          reason: `Resi '${tx.no_resi}' is also used by transaction '${dupResi.existing?.id || dupResi.existing?.transaksi_id}'.`,
          source_a: "MASTER_TRANSAKSI",
          recommendation: "Inspect duplicate resi assignment."
        });
      }
    }
  }

  const criticalCount = exceptions.filter(e => e.severity === "CRITICAL").length;
  const errorCount = exceptions.filter(e => e.severity === "ERROR").length;
  const warningCount = exceptions.filter(e => e.severity === "WARNING").length;

  let finalStatus: ReconciliationStatus = "MATCHED";
  if (criticalCount > 0) finalStatus = "CRITICAL";
  else if (errorCount > 0) finalStatus = "MISMATCH";
  else if (warningCount > 0) finalStatus = "WARNING";

  const result: ReconciliationResult = {
    reconciliation_id: reconId,
    executed_at: now,
    scope: "TRANSACTION",
    scope_id: transaksiId,
    status: finalStatus,
    source_a: "MASTER_TRANSAKSI",
    source_b: "OPERATIONAL_FINANCIAL_ENGINES",
    matched_count: exceptions.length === 0 ? 1 : 0,
    unmatched_count: exceptions.length > 0 ? 1 : 0,
    exception_count: exceptions.length,
    expected_total: expectedTotal,
    actual_total: actualTotal,
    variance_total: Math.abs(expectedTotal - actualTotal),
    exceptions,
    summary: {
      total_checked: 1,
      total_matched: exceptions.length === 0 ? 1 : 0,
      total_warning: warningCount,
      total_error: errorCount,
      total_critical: criticalCount,
      total_expected: expectedTotal,
      total_actual: actualTotal,
      total_variance: Math.abs(expectedTotal - actualTotal)
    },
    recommendations: Array.from(new Set(exceptions.map(e => e.recommendation)))
  };

  return result;
}

// 2. Daily Reconciliation
export function reconcileDaily(db: any, dateStr: string, outletId?: string): ReconciliationResult {
  const now = new Date().toISOString();
  const reconId = "REC-DAY-" + String(Date.now()).slice(-6) + Math.floor(Math.random() * 100);
  const allExceptions: ReconciliationException[] = [];

  const allTx = db.MASTER_TRANSAKSI || [];
  const allShip = db.MASTER_PENGIRIMAN || [];

  // Filter transactions
  let dailyTx = allTx.filter((tx: any) => {
    const d = tx.created_at ? tx.created_at.split("T")[0] : (tx.tanggal_transaksi || "");
    if (d !== dateStr) return false;
    if (outletId && outletId !== "ALL" && tx.outlet_id !== outletId) return false;
    return true;
  });

  // Cross-outlet leak check: verify no transactions from other outlets contaminate requested outletId
  if (outletId && outletId !== "ALL") {
    const allDateTx = allTx.filter((tx: any) => {
      const d = tx.created_at ? tx.created_at.split("T")[0] : (tx.tanggal_transaksi || "");
      return d === dateStr;
    });
    const otherOutletTx = allDateTx.filter((t: any) => t.outlet_id && t.outlet_id !== outletId);
    if (otherOutletTx.length > 0) {
      for (const leak of otherOutletTx) {
        allExceptions.push({
          id: "EXC-" + Math.floor(Math.random() * 100000),
          type: "CROSS_OUTLET_DATA_LEAK",
          severity: "CRITICAL",
          entity_type: "TRANSACTION",
          entity_id: leak.id,
          transaksi_id: leak.id,
          reason: `Transaction '${leak.id}' belongs to outlet '${leak.outlet_id}' but cross-outlet contamination was detected during reconciliation for '${outletId}'.`,
          source_a: "MASTER_TRANSAKSI",
          recommendation: "Isolate outlet query filters to prevent cross-outlet data leak."
        });
      }
    }
  }

  // Also check orphan shipments for this date
  const orphanShips = allShip.filter((s: any) => {
    const d = s.created_at ? s.created_at.split("T")[0] : (s.tanggal_pengiriman || "");
    if (d !== dateStr) return false;
    if (outletId && outletId !== "ALL" && s.outlet_id !== outletId) return false;
    return !allTx.some((t: any) => t.id === s.transaksi_id);
  });

  for (const ship of orphanShips) {
    allExceptions.push({
      id: "EXC-" + Math.floor(Math.random() * 100000),
      type: "SHIPMENT_WITHOUT_TRANSACTION",
      severity: "ERROR",
      entity_type: "SHIPMENT",
      entity_id: ship.id,
      transaksi_id: ship.transaksi_id,
      reason: `Shipment '${ship.id}' exists on '${dateStr}' but has no matching transaction in MASTER_TRANSAKSI.`,
      source_a: "MASTER_PENGIRIMAN",
      source_b: "MASTER_TRANSAKSI",
      recommendation: "Inspect MASTER_PENGIRIMAN for matching transaksi_id."
    });
  }

  let totalExpected = 0;
  let totalActual = 0;
  let matchedCount = 0;

  for (const tx of dailyTx) {
    const txRes = reconcileTransaction(db, tx.id);
    if (txRes.exceptions.length === 0) {
      matchedCount++;
    } else {
      allExceptions.push(...txRes.exceptions);
    }

    if (isTransactionValidForFinance(tx)) {
      const calc = calculateFinancialSummary(tx);
      totalExpected += calc.customer_payment;
      totalActual += safeNum(tx.total_customer);
    }
  }

  const criticalCount = allExceptions.filter(e => e.severity === "CRITICAL").length;
  const errorCount = allExceptions.filter(e => e.severity === "ERROR").length;
  const warningCount = allExceptions.filter(e => e.severity === "WARNING").length;

  let finalStatus: ReconciliationStatus = "MATCHED";
  if (criticalCount > 0) finalStatus = "CRITICAL";
  else if (errorCount > 0) finalStatus = "MISMATCH";
  else if (warningCount > 0) finalStatus = "WARNING";

  return {
    reconciliation_id: reconId,
    executed_at: now,
    scope: "DAILY",
    scope_id: `${dateStr}_${outletId || "ALL"}`,
    period_start: dateStr,
    period_end: dateStr,
    status: finalStatus,
    source_a: "MASTER_TRANSAKSI",
    source_b: "FINANCIAL_OPERATIONAL_ENGINES",
    matched_count: matchedCount,
    unmatched_count: dailyTx.length - matchedCount + orphanShips.length,
    exception_count: allExceptions.length,
    expected_total: totalExpected,
    actual_total: totalActual,
    variance_total: Math.abs(totalExpected - totalActual),
    exceptions: allExceptions,
    summary: {
      total_checked: dailyTx.length + orphanShips.length,
      total_matched: matchedCount,
      total_warning: warningCount,
      total_error: errorCount,
      total_critical: criticalCount,
      total_expected: totalExpected,
      total_actual: totalActual,
      total_variance: Math.abs(totalExpected - totalActual)
    },
    recommendations: Array.from(new Set(allExceptions.map(e => e.recommendation)))
  };
}

// 3. Outlet Reconciliation
export function reconcileOutlet(db: any, outletId: string, dateRange?: { start?: string; end?: string }): ReconciliationResult {
  const now = new Date().toISOString();
  const reconId = "REC-OUT-" + String(Date.now()).slice(-6) + Math.floor(Math.random() * 100);
  const allExceptions: ReconciliationException[] = [];

  const allTx = db.MASTER_TRANSAKSI || [];

  let outletTx = allTx.filter((tx: any) => tx.outlet_id === outletId);

  if (dateRange) {
    if (dateRange.start) {
      outletTx = outletTx.filter((tx: any) => {
        const d = tx.created_at ? tx.created_at.split("T")[0] : (tx.tanggal_transaksi || "");
        return d >= dateRange.start!;
      });
    }
    if (dateRange.end) {
      outletTx = outletTx.filter((tx: any) => {
        const d = tx.created_at ? tx.created_at.split("T")[0] : (tx.tanggal_transaksi || "");
        return d <= dateRange.end!;
      });
    }
  }

  let totalExpected = 0;
  let totalActual = 0;
  let matchedCount = 0;

  for (const tx of outletTx) {
    const txRes = reconcileTransaction(db, tx.id);
    if (txRes.exceptions.length === 0) {
      matchedCount++;
    } else {
      allExceptions.push(...txRes.exceptions);
    }

    if (isTransactionValidForFinance(tx)) {
      const calc = calculateFinancialSummary(tx);
      totalExpected += calc.customer_payment;
      totalActual += safeNum(tx.total_customer);
    }
  }

  const criticalCount = allExceptions.filter(e => e.severity === "CRITICAL").length;
  const errorCount = allExceptions.filter(e => e.severity === "ERROR").length;
  const warningCount = allExceptions.filter(e => e.severity === "WARNING").length;

  let finalStatus: ReconciliationStatus = "MATCHED";
  if (criticalCount > 0) finalStatus = "CRITICAL";
  else if (errorCount > 0) finalStatus = "MISMATCH";
  else if (warningCount > 0) finalStatus = "WARNING";

  return {
    reconciliation_id: reconId,
    executed_at: now,
    scope: "OUTLET",
    scope_id: outletId,
    period_start: dateRange?.start,
    period_end: dateRange?.end,
    status: finalStatus,
    source_a: "MASTER_TRANSAKSI",
    source_b: "FINANCIAL_OPERATIONAL_ENGINES",
    matched_count: matchedCount,
    unmatched_count: outletTx.length - matchedCount,
    exception_count: allExceptions.length,
    expected_total: totalExpected,
    actual_total: totalActual,
    variance_total: Math.abs(totalExpected - totalActual),
    exceptions: allExceptions,
    summary: {
      total_checked: outletTx.length,
      total_matched: matchedCount,
      total_warning: warningCount,
      total_error: errorCount,
      total_critical: criticalCount,
      total_expected: totalExpected,
      total_actual: totalActual,
      total_variance: Math.abs(totalExpected - totalActual)
    },
    recommendations: Array.from(new Set(allExceptions.map(e => e.recommendation)))
  };
}

// 4. Calculate Summary Helper
export function calculateReconciliationSummary(results: ReconciliationResult[]) {
  let totalChecked = 0;
  let totalMatched = 0;
  let totalWarning = 0;
  let totalError = 0;
  let totalCritical = 0;
  let totalExpected = 0;
  let totalActual = 0;

  for (const r of results) {
    totalChecked += r.summary.total_checked;
    totalMatched += r.summary.total_matched;
    totalWarning += r.summary.total_warning;
    totalError += r.summary.total_error;
    totalCritical += r.summary.total_critical;
    totalExpected += r.summary.total_expected;
    totalActual += r.summary.total_actual;
  }

  return {
    total_checked: totalChecked,
    total_matched: totalMatched,
    total_warning: totalWarning,
    total_error: totalError,
    total_critical: totalCritical,
    total_expected: totalExpected,
    total_actual: totalActual,
    total_variance: Math.abs(totalExpected - totalActual)
  };
}

// 5. Audit Trail Integration Helper
export function logReconciliationExecution(db: any, result: ReconciliationResult, actorId: string = "SYSTEM") {
  const eventType = result.status === "CRITICAL" ? "RECONCILIATION_CRITICAL" : "RECONCILIATION_EXECUTED";
  logAuditEvent(db, {
    actor_id: actorId,
    event_type: eventType,
    entity_type: "RECONCILIATION",
    entity_id: result.reconciliation_id,
    action: "RUN_RECONCILIATION",
    result: result.status === "CRITICAL" ? "CRITICAL" : (result.status === "MISMATCH" ? "FAILED" : "SUCCESS"),
    source: "RECONCILIATION_ENGINE",
    metadata: {
      scope: result.scope,
      scope_id: result.scope_id,
      status: result.status,
      matched_count: result.matched_count,
      unmatched_count: result.unmatched_count,
      exception_count: result.exception_count,
      variance_total: result.variance_total
    }
  });
}
