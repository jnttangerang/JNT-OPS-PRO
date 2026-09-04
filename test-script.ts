import { generateClosingId, validateDailyClosing } from "./src/lib/dailyClosingEngine.js";
import type { ActorInfo, DailyClosingRecord } from "./src/lib/dailyClosingEngine.js";

function getDailyClosingRecord(db: any, outletId: string, tanggal: string) {
  const list = db.DailyClosing || [];
  const closingId = generateClosingId(outletId, tanggal);
  const found = list.find((item: any) => item.closing_id === closingId || (item.outlet_id === outletId && item.tanggal === tanggal));
  return found || null;
}

export function getDailyClosingStatus(db: any, outletId: string, tanggal: string) {
  const existing = getDailyClosingRecord(db, outletId, tanggal);
  const dummyActor: ActorInfo = { actor_id: "SYSTEM", actor_role: "SYSTEM" };

  if (existing && existing.status === "CLOSED") {
    const closingId = generateClosingId(outletId, tanggal);
    const dbClone = { ...db };
    dbClone.DailyClosing = (db.DailyClosing || []).filter((r: any) => r.closing_id !== closingId);
    if (db.DailyClosings) {
      dbClone.DailyClosings = dbClone.DailyClosing;
    }

    const valRes = validateDailyClosing(dbClone, { outlet_id: outletId, tanggal, actor: dummyActor }, { isDryRun: true });

    if (valRes.status === "error" || !valRes.data) {
      return {
        status: "success",
        data: existing,
        late_info: null
      };
    }

    const fresh = valRes.data;
    let late_info = null;

    if (fresh.transaction_count > existing.transaction_count) {
      late_info = {
        has_late_transactions: true,
        late_transaction_count: Math.max(0, fresh.transaction_count - existing.transaction_count),
        late_owner_deposit: Math.max(0, fresh.total_owner_deposit - existing.total_owner_deposit),
        late_cash_payment: Math.max(0, (fresh.total_cash_payment ?? 0) - (existing.total_cash_payment ?? 0))
      };
    }

    return { 
      status: "success", 
      data: existing,
      late_info 
    };
  }

  const valRes = validateDailyClosing(db, { outlet_id: outletId, tanggal, actor: dummyActor }, { isDryRun: true });
  return { status: "success", data: valRes.data };
}

// CASE A: CLOSED + LATE TRANSACTION
const dbA = {
  DailyClosing: [
    {
      closing_id: "CLS-OUT-002-2026-08-30",
      outlet_id: "OUT-002",
      tanggal: "2026-08-30",
      status: "CLOSED",
      transaction_count: 0,
      total_owner_deposit: 0,
      total_cash_payment: 0
    }
  ],
  MASTER_TRANSAKSI: [
    {
      resi_id: "LATE001",
      outlet_id: "OUT-002",
      tanggal: "2026-08-30",
      tanggal_transaksi: "2026-08-30",
      status_transaksi: "PAID",
      status_resi: "OK",
      status: "OK",
      metode_bayar: "Tunai",
      ongkir_customer: 10000,
      total_dibayar_customer: 10000,
      admin_id: "SYS"
    }
  ],
  Master_Setoran: []
};

// CASE B: CLOSED TANPA LATE TRANSACTION
const dbB = {
  DailyClosing: [
    {
      closing_id: "CLS-OUT-002-2026-08-30",
      outlet_id: "OUT-002",
      tanggal: "2026-08-30",
      status: "CLOSED",
      transaction_count: 2,
      total_owner_deposit: 20000,
      total_cash_payment: 20000
    }
  ],
  MASTER_TRANSAKSI: [
    {
      resi_id: "TRX001",
      outlet_id: "OUT-002",
      tanggal: "2026-08-30",
      tanggal_transaksi: "2026-08-30",
      status_transaksi: "PAID",
      status_resi: "OK",
      status: "OK",
      metode_bayar: "Tunai",
      ongkir_customer: 10000,
      total_dibayar_customer: 10000,
      admin_id: "SYS"
    },
    {
      resi_id: "TRX002",
      outlet_id: "OUT-002",
      tanggal: "2026-08-30",
      tanggal_transaksi: "2026-08-30",
      status_transaksi: "PAID",
      status_resi: "OK",
      status: "OK",
      metode_bayar: "Tunai",
      ongkir_customer: 10000,
      total_dibayar_customer: 10000,
      admin_id: "SYS"
    }
  ],
  Master_Setoran: []
};

// CASE C: NON-CLOSED
const dbC = {
  DailyClosing: [],
  MASTER_TRANSAKSI: [
    {
      resi_id: "TRX003",
      outlet_id: "OUT-002",
      tanggal: "2026-08-30",
      tanggal_transaksi: "2026-08-30",
      status_transaksi: "PAID",
      status_resi: "OK",
      status: "OK",
      metode_bayar: "Tunai",
      ongkir_customer: 15000,
      total_dibayar_customer: 15000,
      admin_id: "SYS"
    }
  ],
  Master_Setoran: []
};

function check(name: string, condition: boolean) {
  console.log(`${condition ? 'PASS' : 'FAIL'} - ${name}`);
}

const resA = getDailyClosingStatus(dbA, "OUT-002", "2026-08-30");
check("CASE A — CLOSED + late transaction", 
  resA.data.status === "CLOSED" && 
  resA.late_info?.has_late_transactions === true &&
  resA.late_info?.late_transaction_count === 1 &&
  resA.late_info?.late_owner_deposit > 0 &&
  resA.data.transaction_count === 0
);

const resB = getDailyClosingStatus(dbB, "OUT-002", "2026-08-30");
check("CASE B — CLOSED tanpa late transaction",
  resB.data.status === "CLOSED" &&
  resB.late_info === null
);

const resC = getDailyClosingStatus(dbC, "OUT-002", "2026-08-30");
check("CASE C — NON-CLOSED",
  resC.data && resC.data.status !== "CLOSED" &&
  resC.data.transaction_count === 1 &&
  !("late_info" in resC)
);

check("Frozen snapshot preservation",
  resA.data === dbA.DailyClosing[0] &&
  resA.data.transaction_count === 0
);

const dbNegative = JSON.parse(JSON.stringify(dbA));
dbNegative.DailyClosing[0].transaction_count = 5;
dbNegative.DailyClosing[0].total_owner_deposit = 50000;
dbNegative.DailyClosing[0].total_cash_payment = 50000;
const resNeg = getDailyClosingStatus(dbNegative, "OUT-002", "2026-08-30");
check("Negative delta protection",
  resNeg.late_info === null
);
