const fs = require("fs");
const file = "src/components/owner/DailyClosingPage.tsx";
let code = fs.readFileSync(file, "utf8");

const derivedVars = `
  // Multi-Admin Scope filtering
  const myBreakdown = (!isOwner && closingStatusData?.admin_breakdown)
    ? closingStatusData.admin_breakdown.find((a: any) => a.admin_id === currentUserId)
    : null;

  const displayExpected = isOwner 
    ? Number(closingStatusData?.setoran_required ?? closingStatusData?.total_cash_payment ?? 0)
    : Number(myBreakdown?.expected_cash ?? 0);
    
  const displayActual = isOwner
    ? Number(closingStatusData?.setoran_actual ?? 0)
    : Number(myBreakdown?.setoran_actual ?? 0);
    
  const displayVariance = isOwner
    ? Number(closingStatusData?.setoran_variance ?? 0)
    : Number(myBreakdown?.setoran_variance ?? 0);
    
  const displaySetoranStatus = isOwner
    ? (closingStatusData?.setoran_status || "PENDING")
    : (myBreakdown?.setoran_status || "PENDING");
    
  const displayCustomer = isOwner
    ? Number(closingStatusData?.total_customer ?? 0)
    : Number(myBreakdown?.customer_payment ?? 0);
    
  const displayOwnerDeposit = isOwner
    ? Number(closingStatusData?.total_owner_deposit ?? 0)
    : Number(myBreakdown?.owner_deposit ?? 0);
    
  const displayDigital = isOwner
    ? Number(closingStatusData?.total_digital_payment ?? 0)
    : Number(myBreakdown?.digital_payment ?? 0);
    
  const displayDfod = isOwner
    ? Number(closingStatusData?.total_dfod_outstanding ?? 0)
    : Number(myBreakdown?.dfod_outstanding ?? 0);
    
  const displayOutletCash = isOwner
    ? Number(closingStatusData?.total_outlet_cash ?? 0)
    : Number(myBreakdown?.outlet_cash ?? 0);
    
  const displayTransactionCount = isOwner
    ? Number(closingStatusData?.transaction_count ?? 0)
    : Number(myBreakdown?.jumlah_resi ?? 0);
`;

code = code.replace("  const statusVal = closingStatusData?.status || \"OPEN\";", derivedVars + "\n  const statusVal = closingStatusData?.status || \"OPEN\";");

code = code.replace(/Number\(closingStatusData\?\.setoran_required \?\? closingStatusData\?\.total_cash_payment \?\? 0\)/g, "displayExpected");
code = code.replace(/Number\(closingStatusData\?\.setoran_required \?\? 0\)/g, "displayExpected");
code = code.replace(/Number\(closingStatusData\?\.setoran_actual \?\? 0\)/g, "displayActual");
code = code.replace(/Number\(closingStatusData\?\.setoran_variance \?\? 0\)/g, "displayVariance");
code = code.replace(/closingStatusData\?\.setoran_variance \?\? 0/g, "displayVariance");
code = code.replace(/closingStatusData\?\.setoran_status === "MATCHED"/g, "displaySetoranStatus === \"MATCHED\" || displaySetoranStatus === \"OK\"");
code = code.replace(/closingStatusData\?\.setoran_status \|\| "PENDING"/g, "displaySetoranStatus");
code = code.replace(/closingStatusData\?\.setoran_status !== "MATCHED"/g, "displaySetoranStatus !== \"MATCHED\" && displaySetoranStatus !== \"OK\"");

code = code.replace(/Number\(closingStatusData\?\.total_customer \?\? 0\)/g, "displayCustomer");
code = code.replace(/Number\(closingStatusData\?\.total_owner_deposit \?\? 0\)/g, "displayOwnerDeposit");
code = code.replace(/Number\(closingStatusData\?\.total_digital_payment \?\? 0\)/g, "displayDigital");
code = code.replace(/Number\(closingStatusData\?\.total_dfod_outstanding \?\? 0\)/g, "displayDfod");
code = code.replace(/Number\(closingStatusData\?\.total_outlet_cash \?\? 0\)/g, "displayOutletCash");
code = code.replace(/closingStatusData\?\.transaction_count \?\? 0/g, "displayTransactionCount");

code = code.replace(/const required = displayExpected;/g, "const required = displayExpected;"); // just mapping what happened up there.

fs.writeFileSync(file, code);
