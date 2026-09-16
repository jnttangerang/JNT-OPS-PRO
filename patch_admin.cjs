const fs = require('fs');
let code = fs.readFileSync('src/components/admin/AdminDashboardPage.tsx', 'utf8');

if (!code.includes('/lengkapi-yoyi')) {
  // Add another card in quick actions
  const replacement = `
          <QuickActionCard 
            icon={<CheckCircle className="w-5 h-5 text-indigo-600" />} 
            title="Lengkapi YoYi" 
            desc="Lengkapi bukti transaksi YoYi per tanggal."
            onClick={() => navigate('/lengkapi-yoyi')}
          />
          <QuickActionCard 
            icon={<MapPin className="w-5 h-5 text-amber-600" />}`;
            
  code = code.replace('<QuickActionCard \n            icon={<MapPin className="w-5 h-5 text-amber-600" />}', replacement);
  
  if (code.includes('import { CheckCircle')) {
     // already imported
  } else if (code.includes('import { ')) {
     code = code.replace('import { ', 'import { CheckCircle, ');
  }
  
  fs.writeFileSync('src/components/admin/AdminDashboardPage.tsx', code);
  console.log("Patched AdminDashboardPage.tsx successfully");
} else {
  console.log("Already patched AdminDashboardPage.tsx");
}
