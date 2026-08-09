const fs = require('fs');
let code = fs.readFileSync('src/components/owner/ManagementControlTowerPage.tsx', 'utf8');

code = code.replace(
  'Object.entries(summaryData.adminPerformance || {}).length === 0',
  '(summaryData.adminPerformance || []).length === 0'
);

code = code.replace(
  'Object.entries(summaryData.adminPerformance).map(([admin, data]: [string, any]) => (',
  '(summaryData.adminPerformance || []).map((data: any) => ('
);

code = code.replace(
  '<td className="p-3 font-bold text-gray-800 text-xs">{admin}</td>',
  '<td className="p-3 font-bold text-gray-800 text-xs">{data.admin_id}</td>'
);

// also fix the test cases
let testCode = fs.readFileSync('test_phase35_control_tower.ts', 'utf8');
testCode = testCode.replace(
  'sumA.data?.adminPerformance?.["ADM-1"]?.jumlah_transaksi === 1',
  'sumA.data?.adminPerformance?.find((a:any)=>a.admin_id==="ADM-1")?.jumlah_resi === 1'
);
testCode = testCode.replace(
  'sumB.data?.adminPerformance?.["ADM-1"]?.jumlah_transaksi === 1',
  'sumB.data?.adminPerformance?.find((a:any)=>a.admin_id==="ADM-1")?.jumlah_resi === 1'
);
fs.writeFileSync('test_phase35_control_tower.ts', testCode);
fs.writeFileSync('src/components/owner/ManagementControlTowerPage.tsx', code);
