const fs = require("fs");
const file = "src/components/owner/DailyClosingPage.tsx";
let code = fs.readFileSync(file, "utf8");

// Remove everything between `// Multi-Admin Scope filtering` and `const displayTransactionCount = ...` except the first one.
// Actually, let's just use a regex to match the bad ones and remove them.

code = code.replace(/\/\/ Multi-Admin Scope filtering[\s\S]*?const displayTransactionCount =.*?;/g, "");

// Now we insert it cleanly exactly ONCE right after `const currentUserId = session?.user_id || session?.username || "SYSTEM";`
const insertTarget = 'const currentUserId = session?.user_id || session?.username || "SYSTEM";';

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

code = code.replace(insertTarget, insertTarget + "\n" + vars);

// Now, what about `const req = ...` in openSetoranModal?
// Let's make sure it's correct.
code = code.replace(/const myBreakdown = \(\!isOwner && closingStatusData\?\.admin_breakdown\)[\s\S]*?const required = req;/g, "const required = displayExpected;");
// wait, if I put the vars outside `openSetoranModal`, `displayExpected` will be accessible inside it! So `const required = displayExpected;` is perfect.

// Also, the previous script might have left some weird things in the JSX.
// Let's check where `displayExpected` is used.
fs.writeFileSync(file, code);
