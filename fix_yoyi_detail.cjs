const fs = require('fs');

let code = fs.readFileSync('src/components/admin/LengkapiYoYiPage.tsx', 'utf8');

code = code.replace(
  'function YoYiDetailView({ tanggal, onBack, session, outlets, onSetoran }: any) {',
  'function YoYiDetailView({ tanggal, onBack, session, outlets, onSetoran, activeOutletId }: any) {'
);

code = code.replace(
  '<YoYiDetailView tanggal={activeDate} onBack={() => setActiveDate(null)} session={session} outlets={outlets} onSetoran={handleOpenSetoran} />',
  '<YoYiDetailView tanggal={activeDate} onBack={() => setActiveDate(null)} session={session} outlets={outlets} onSetoran={handleOpenSetoran} activeOutletId={activeOutletId} />'
);

fs.writeFileSync('src/components/admin/LengkapiYoYiPage.tsx', code);
console.log("Fixed YoYiDetailView props");
