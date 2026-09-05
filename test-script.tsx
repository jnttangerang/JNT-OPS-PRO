// Mock setup
const React = require('react');

// The function we are testing
function mapResponse(json: any) {
  const closingStatusMap: Record<string, any> = {};
  const o = { outlet_id: "OUT-001" };
  
  const record = json.data || json;
  closingStatusMap[o.outlet_id] = {
    ...record,
    late_info: json.late_info ?? null,
  };
  return closingStatusMap;
}

// Case A: CLOSED + late_info
const resA = mapResponse({
  status: "success",
  data: { status: "CLOSED", transaction_count: 5 },
  late_info: { has_late_transactions: true, late_transaction_count: 1, late_owner_deposit: 10000, late_cash_payment: 5000 }
});
console.assert(resA["OUT-001"].status === "CLOSED", "Case A failed status");
console.assert(resA["OUT-001"].late_info.has_late_transactions === true, "Case A failed late_info");

// Case B: CLOSED without late_info (null)
const resB = mapResponse({
  status: "success",
  data: { status: "CLOSED", transaction_count: 5 },
  late_info: null
});
console.assert(resB["OUT-001"].late_info === null, "Case B failed late_info");

// Case C: OPEN / No late info field
const resC = mapResponse({
  status: "success",
  data: { status: "OPEN", transaction_count: 5 }
});
console.assert(resC["OUT-001"].late_info === null, "Case C failed late_info");

// Test Logic for Alert UI
function shouldShowAlert(closingRec: any) {
  const bookStatus = closingRec?.status || "OPEN";
  return bookStatus === "CLOSED" && closingRec?.late_info?.has_late_transactions === true;
}

console.assert(shouldShowAlert(resA["OUT-001"]) === true, "Alert logic A failed");
console.assert(shouldShowAlert(resB["OUT-001"]) === false, "Alert logic B failed");
console.assert(shouldShowAlert(resC["OUT-001"]) === false, "Alert logic C failed");
console.assert(shouldShowAlert({ status: "CLOSED", late_info: { has_late_transactions: false }}) === false, "Alert logic C(2) failed");

console.log("All manual assertions passed.");
