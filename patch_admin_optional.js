import fs from 'fs';
let code = fs.readFileSync('src/components/admin/AdminDashboardPage.tsx', 'utf-8');

code = code.replace(/summary\.grandTotalCustomer\.toLocaleString/g, '(summary?.grandTotalCustomer || 0).toLocaleString');
code = code.replace(/summary\.totalWajibSetorOwner\.toLocaleString/g, '(summary?.totalWajibSetorOwner || 0).toLocaleString');
code = code.replace(/summary\.totalKasOutlet\.toLocaleString/g, '(summary?.totalKasOutlet || 0).toLocaleString');
code = code.replace(/summary\.totalTransaksi/g, 'summary?.totalTransaksi || 0');
code = code.replace(/summary\.totalResiExpress/g, 'summary?.totalResiExpress || 0');
code = code.replace(/summary\.totalResiCargo/g, 'summary?.totalResiCargo || 0');
code = code.replace(/byEkspedisi\.Express\.setoran\.toLocaleString/g, '(byEkspedisi?.Express?.setoran || 0).toLocaleString');
code = code.replace(/byEkspedisi\.Cargo\.setoran\.toLocaleString/g, '(byEkspedisi?.Cargo?.setoran || 0).toLocaleString');
code = code.replace(/byEkspedisi\.Express\.resi/g, 'byEkspedisi?.Express?.resi || 0');
code = code.replace(/byEkspedisi\.Cargo\.resi/g, 'byEkspedisi?.Cargo?.resi || 0');

fs.writeFileSync('src/components/admin/AdminDashboardPage.tsx', code);
