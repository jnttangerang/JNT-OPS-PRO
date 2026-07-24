import fs from 'fs';

// 1. App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf-8');
appCode = appCode.replace(
  '<RiwayatTransaksiPage\n            session={session}\n            outlets={outlets}\n          />',
  '<RiwayatTransaksiPage\n            session={session}\n            outlets={outlets}\n            activeOutletId={activeOutletId}\n          />'
);
fs.writeFileSync('src/App.tsx', appCode);

// 2. RiwayatTransaksiPage.tsx
let rtCode = fs.readFileSync('src/components/RiwayatTransaksiPage.tsx', 'utf-8');
rtCode = rtCode.replace(
  'interface RiwayatTransaksiPageProps {\n  session: SessionData;\n  outlets: Outlet[];\n}',
  'interface RiwayatTransaksiPageProps {\n  session: SessionData;\n  outlets: Outlet[];\n  activeOutletId?: string;\n}'
);
rtCode = rtCode.replace(
  'export default function RiwayatTransaksiPage({ session, outlets }: RiwayatTransaksiPageProps) {',
  'export default function RiwayatTransaksiPage({ session, outlets, activeOutletId }: RiwayatTransaksiPageProps) {'
);
rtCode = rtCode.replace(
  'const [filterOutlet, setFilterOutlet] = useState<string>("ALL");',
  'const [filterOutlet, setFilterOutlet] = useState<string>(session.role === "OWNER" ? "ALL" : (activeOutletId || session.outlet_id_home));'
);

fs.writeFileSync('src/components/RiwayatTransaksiPage.tsx', rtCode);
