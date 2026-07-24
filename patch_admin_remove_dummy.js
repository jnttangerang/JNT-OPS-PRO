import fs from 'fs';
let code = fs.readFileSync('src/components/admin/AdminDashboardPage.tsx', 'utf-8');

const regex = /catch \(e\) \{\s*console\.error\(e\);\s*setData\(\{[\s\S]*?\}\);\s*\}/;
code = code.replace(regex, 'catch (e) {\n      console.error(e);\n    }');

fs.writeFileSync('src/components/admin/AdminDashboardPage.tsx', code);
