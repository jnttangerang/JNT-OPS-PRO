const fs = require("fs");
const file = "src/components/owner/DailyClosingPage.tsx";
let code = fs.readFileSync(file, "utf8");

// Remove everything from the first `// Multi-Admin Scope filtering` to the last `const displayTransactionCount = ...`
const re = /\/\/ Multi-Admin Scope filtering[\s\S]*?const displayTransactionCount =.*?;/g;
code = code.replace(re, "");

const vars = `
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

// Insert it right after `const statusVal = closingStatusData?.status || "OPEN";`
code = code.replace(/const statusVal = closingStatusData\?\.status \|\| "OPEN";/g, 'const statusVal = closingStatusData?.status || "OPEN";\n' + vars);

fs.writeFileSync(file, code);
