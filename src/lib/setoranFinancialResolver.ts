/**
 * setoranFinancialResolver.ts
 * Single canonical resolver for actual cash and realization status in Setoran.
 *
 * Financial Phase 8 Contract:
 * - EXPECTED CASH: SUM(Financial Engine.cash_payment)
 * - ACTUAL CASH: SUM(Setoran_Realization.nominal) WHERE status === "DISETUJUI"
 * - VARIANCE: ACTUAL CASH - EXPECTED CASH
 * - STATUS: variance === 0 -> BALANCE, variance < 0 -> KURANG SETOR, variance > 0 -> LEBIH SETOR
 */

export interface SetoranActualCashResult {
  actual_cash: number;
  pending_cash: number;
  realization_count: number;
  approved_count: number;
  pending_count: number;
  rejected_count: number;
  has_realization: boolean;
  has_unapproved: boolean;
}

export function parseSafeNominal(val: any): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]+/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function getSetoranRealizations(db: any, setoranId?: string | null): any[] {
  if (!db || !setoranId) return [];
  const list = db.Setoran_Realization || [];
  const targetId = String(setoranId).trim();
  return list.filter((r: any) => String(r.setoran_id || "").trim() === targetId);
}

/**
 * Resolves actual cash strictly from approved Setoran_Realization records.
 * Canonical rules:
 * - Reads db.Setoran_Realization
 * - Filters by setoran_id
 * - Only status === "DISETUJUI" counts towards actual_cash
 * - Status === "MENUNGGU_APPROVAL" counts towards pending_cash
 * - Other statuses do not enter actual cash
 * - If no realization, actual_cash = 0
 * - Does NOT read Master_Setoran.actual_cash as canonical truth
 */
export function resolveSetoranActualCash(db: any, setoranId?: string | null): SetoranActualCashResult {
  const realizations = getSetoranRealizations(db, setoranId);
  let actual_cash = 0;
  let pending_cash = 0;
  let approved_count = 0;
  let pending_count = 0;
  let rejected_count = 0;

  for (const r of realizations) {
    const nominal = parseSafeNominal(r.nominal);
    const status = String(r.status || "").trim().toUpperCase();

    if (status === "DISETUJUI") {
      actual_cash += nominal;
      approved_count++;
    } else if (status === "MENUNGGU_APPROVAL") {
      pending_cash += nominal;
      pending_count++;
    } else if (status === "DITOLAK") {
      rejected_count++;
    }
  }

  return {
    actual_cash,
    pending_cash,
    realization_count: realizations.length,
    approved_count,
    pending_count,
    rejected_count,
    has_realization: realizations.length > 0,
    has_unapproved: pending_count > 0
  };
}

export function calculateSetoranVariance(actualCash: number, expectedCash: number): {
  variance: number;
  status: "BALANCE" | "KURANG_SETOR" | "LEBIH_SETOR";
  legacy_status: "MATCH" | "SHORT" | "OVER";
} {
  const diff = Number((actualCash - expectedCash).toFixed(2));
  const isMatch = Math.abs(diff) < 0.01;
  return {
    variance: diff,
    status: isMatch ? "BALANCE" : diff < 0 ? "KURANG_SETOR" : "LEBIH_SETOR",
    legacy_status: isMatch ? "MATCH" : diff < 0 ? "SHORT" : "OVER"
  };
}
