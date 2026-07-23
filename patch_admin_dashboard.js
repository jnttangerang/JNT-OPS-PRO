import fs from 'fs';
let code = fs.readFileSync('src/components/admin/AdminDashboardPage.tsx', 'utf-8');

// Remove selectedAdmin state
code = code.replace(/const \[selectedAdmin, setSelectedAdmin\] = useState\("ALL"\);\n\s*/, '');

// Remove filterAdmin from callBackend payload
code = code.replace(/filterAdmin: selectedAdmin,\n\s*/, '');

// Remove selectedAdmin from useEffect dependency array
code = code.replace(/, selectedAdmin\]\);/, ']);');

// Remove select UI for selectedAdmin
const selectUI = `          <select \n            value={selectedAdmin} \n            onChange={(e) => setSelectedAdmin(e.target.value)}\n            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none text-gray-700"\n          >\n            <option value="ALL">Semua Admin</option>\n            {byAdmin.map((a:any) => (\n              <option key={a.admin_id} value={a.admin_id}>{a.nama}</option>\n            ))}\n          </select>\n`;
code = code.replace(selectUI, '');

fs.writeFileSync('src/components/admin/AdminDashboardPage.tsx', code);
