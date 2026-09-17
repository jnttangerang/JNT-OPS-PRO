const fs = require('fs');

let codeApp = fs.readFileSync('src/App.tsx', 'utf8');
codeApp = codeApp.replace(
  '<LengkapiYoYiPage session={session} outlets={outlets} />',
  '<LengkapiYoYiPage session={session} outlets={outlets} activeOutletId={activeOutletId} />'
);
fs.writeFileSync('src/App.tsx', codeApp);

let codeYoyi = fs.readFileSync('src/components/admin/LengkapiYoYiPage.tsx', 'utf8');
codeYoyi = codeYoyi.replace(
  'interface LengkapiYoYiPageProps {\n  session: any;\n  outlets: any[];\n}',
  'interface LengkapiYoYiPageProps {\n  session: any;\n  outlets: any[];\n  activeOutletId?: string;\n}'
);
codeYoyi = codeYoyi.replace(
  'export default function LengkapiYoYiPage({ session, outlets }: LengkapiYoYiPageProps) {',
  'export default function LengkapiYoYiPage({ session, outlets, activeOutletId }: LengkapiYoYiPageProps) {'
);
codeYoyi = codeYoyi.replace(/session\.active_outlet_id/g, 'activeOutletId');

fs.writeFileSync('src/components/admin/LengkapiYoYiPage.tsx', codeYoyi);
console.log("Fixed activeOutletId");
