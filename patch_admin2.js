import fs from 'fs';

let code = fs.readFileSync('src/components/admin/AdminDashboardPage.tsx', 'utf-8');

code = code.replace(
  '  onNavigate: (view: string) => void;\n}',
  '  onNavigate: (view: string) => void;\n  onChangeActiveOutlet?: (id: string) => void;\n}'
);

code = code.replace(
  'export default function AdminDashboardPage({ session, activeOutletId, outlets, onNavigate }: AdminDashboardPageProps) {',
  'export default function AdminDashboardPage({ session, activeOutletId, outlets, onNavigate, onChangeActiveOutlet }: AdminDashboardPageProps) {'
);

const outletFilter = `
          <select 
            value={activeOutletId} 
            onChange={(e) => onChangeActiveOutlet && onChangeActiveOutlet(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none text-gray-700"
          >
            {session.role === "OWNER" && <option value="ALL">Semua Outlet (Global)</option>}
            {outlets.map((o) => (
              <option key={o.outlet_id} value={o.outlet_id}>{o.nama_outlet}</option>
            ))}
          </select>
`;

code = code.replace(
  '<div className="flex flex-wrap items-center gap-3">',
  '<div className="flex flex-wrap items-center gap-3">\n' + outletFilter
);

fs.writeFileSync('src/components/admin/AdminDashboardPage.tsx', code);
