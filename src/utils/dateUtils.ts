/**
 * JNT OPS PRO - Unified Timezone & Business Date Utilities
 * Business Timezone: Asia/Jakarta (UTC+07:00 / WIB)
 * 
 * Rules:
 * 1. Absolute timestamps (created_at, approved_at, timestamp) are stored as ISO/instant.
 * 2. Business dates (tanggal_transaksi, tanggal_closing, tanggal_setoran) MUST follow Asia/Jakarta.
 * 3. Display dates & times MUST format in Asia/Jakarta with WIB indicator where applicable.
 */

export const BUSINESS_TIMEZONE = "Asia/Jakarta";

/**
 * Convert any Date, ISO string, timestamp number, or local string into Asia/Jakarta (WIB) date string 'YYYY-MM-DD'.
 */
export function getWIBDate(input?: Date | string | number | null): string {
  if (input === undefined || input === null || input === "") {
    input = new Date();
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    // Local date-time without timezone (e.g. from YoYi "2026-08-26 00:08:45" or "2026-08-26T00:08:45")
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(trimmed) && !trimmed.includes("Z") && !/[+-]\d{2}:\d{2}$/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
  }
  const d = typeof input === "object" && input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(d);
}

/**
 * Convert any Date, ISO string, timestamp number, or local string into Asia/Jakarta (WIB) time string 'HH:mm:ss'.
 */
export function getWIBTime(input?: Date | string | number | null): string {
  if (input === undefined || input === null || input === "") {
    input = new Date();
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    // Local date-time without timezone (e.g. from YoYi "2026-08-26 00:08:45")
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/.test(trimmed) && !trimmed.includes("Z") && !/[+-]\d{2}:\d{2}$/.test(trimmed)) {
      const timePart = trimmed.split(/[ T]/)[1] || "00:00:00";
      return timePart.length === 5 ? `${timePart}:00` : timePart.slice(0, 8);
    }
    // Pure time string HH:mm or HH:mm:ss
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      return trimmed.length === 5 ? `${trimmed}:00` : trimmed.slice(0, 8);
    }
  }
  const d = typeof input === "object" && input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "00:00:00";
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  return formatter.format(d);
}

/**
 * Get current business date in Asia/Jakarta as YYYY-MM-DD
 */
export function getTodayWIB(): string {
  return getWIBDate(new Date());
}

/**
 * Shift a YYYY-MM-DD date string by N days in Asia/Jakarta calendar safely
 */
export function shiftWIBDays(dateStr: string, days: number): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    dateStr = getTodayWIB();
  }
  const [y, m, d] = dateStr.trim().split("-").map(Number);
  // Construct at UTC 05:00:00 which corresponds to 12:00:00 WIB (noon) to avoid boundary drift
  const dt = new Date(Date.UTC(y, m - 1, d + days, 5, 0, 0));
  return getWIBDate(dt);
}

/**
 * Format a timestamp/date for display in Asia/Jakarta (WIB).
 * Example with time: "26/08/2026 00:08 WIB"
 * Example without time: "26/08/2026"
 */
export function formatWIBDisplay(input?: Date | string | number | null, includeTime: boolean = true): string {
  if (!input) return "-";
  const dateStr = getWIBDate(input);
  if (!dateStr) return "-";
  const [yyyy, mm, dd] = dateStr.split("-");
  if (!includeTime) {
    return `${dd}/${mm}/${yyyy}`;
  }
  const timeStr = getWIBTime(input).slice(0, 5); // HH:mm
  return `${dd}/${mm}/${yyyy} ${timeStr} WIB`;
}

/**
 * Format only the time in WIB.
 * Example: "00:08 WIB"
 */
export function formatWIBTime(input?: Date | string | number | null): string {
  if (!input) return "-";
  const timeStr = getWIBTime(input).slice(0, 5);
  return `${timeStr} WIB`;
}

/**
 * Extract business date from any transaction/setoran entity.
 * Priority: explicit business date (tanggal_transaksi / tanggal / date) -> fallback to parsed WIB date from timestamp/created_at
 */
export function extractBusinessDate(entity: any): string {
  if (!entity) return "";
  if (entity.tanggal_transaksi) return getWIBDate(entity.tanggal_transaksi);
  if (entity.tanggal) return getWIBDate(entity.tanggal);
  if (entity.date) return getWIBDate(entity.date);
  if (entity.created_at) return getWIBDate(entity.created_at);
  if (entity.timestamp) return getWIBDate(entity.timestamp);
  return "";
}

export interface SettlementAgingResult {
  diff_days: number;
  late_days: number;
  is_late: boolean;
  due_date: string;
  status_label: string;
  badge_variant: "success" | "warning" | "danger" | "neutral";
}

/**
 * Calculate settlement aging based on operational due date H+1 rule.
 * - Transaction Date: T
 * - Due Date: T + 1 day
 * - On-time: Submitted on T or T+1 (diff_days <= 1, late_days = 0)
 * - Late: Submitted or evaluated after T+1 (diff_days > 1, late_days = diff_days - 1)
 */
export function calculateSettlementAging(
  transactionDate: string,
  submissionTimestampOrDate?: string | Date | null,
  isSubmitted: boolean = true
): SettlementAgingResult {
  const txDate = getWIBDate(transactionDate);
  if (!txDate) {
    return {
      diff_days: 0,
      late_days: 0,
      is_late: false,
      due_date: "",
      status_label: "-",
      badge_variant: "neutral"
    };
  }

  const dueDate = shiftWIBDays(txDate, 1);
  const refDate = submissionTimestampOrDate 
    ? getWIBDate(submissionTimestampOrDate) 
    : getTodayWIB();

  const txParts = txDate.split("-").map(Number);
  const refParts = refDate.split("-").map(Number);
  const txUtc = Date.UTC(txParts[0], txParts[1] - 1, txParts[2]);
  const refUtc = Date.UTC(refParts[0], refParts[1] - 1, refParts[2]);
  const diffDays = Math.round((refUtc - txUtc) / 86400000);

  if (diffDays <= 0) {
    return {
      diff_days: diffDays,
      late_days: 0,
      is_late: false,
      due_date: dueDate,
      status_label: isSubmitted ? "TEPAT WAKTU" : "BELUM JATUH TEMPO",
      badge_variant: isSubmitted ? "success" : "neutral"
    };
  } else if (diffDays === 1) {
    return {
      diff_days: diffDays,
      late_days: 0,
      is_late: false,
      due_date: dueDate,
      status_label: isSubmitted ? "TEPAT WAKTU" : "JATUH TEMPO HARI INI",
      badge_variant: isSubmitted ? "success" : "warning"
    };
  } else {
    const lateDays = diffDays - 1;
    return {
      diff_days: diffDays,
      late_days: lateDays,
      is_late: true,
      due_date: dueDate,
      status_label: `TERLAMBAT ${lateDays} HARI`,
      badge_variant: "danger"
    };
  }
}

