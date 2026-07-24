import fs from 'fs';
let code = fs.readFileSync('src/components/DashboardPage.tsx', 'utf-8');

// The initial state uses ALL?
code = code.replace(
  `const [selectedOutletFilter, setSelectedOutletFilter] = useState("ALL");`,
  `const [selectedOutletFilter, setSelectedOutletFilter] = useState(outlets.length > 0 ? outlets[0].outlet_id : "");`
);

// Remove the option
code = code.replace(
  `              <option value="ALL">Semua Outlet (Gabungan)</option>\n`,
  ``
);

fs.writeFileSync('src/components/DashboardPage.tsx', code);
