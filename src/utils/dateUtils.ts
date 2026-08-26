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
