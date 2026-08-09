const fs = require('fs');
let code = fs.readFileSync('src/components/owner/ManagementControlTowerPage.tsx', 'utf8');

code = code.replace(
  '<td className="p-3 text-right font-mono text-xs text-gray-600">{data.jumlah_express}</td>',
  '<td className="p-3 text-right font-mono text-xs text-gray-600">{data.jumlah_resi}</td>'
);
code = code.replace(
  '<td className="p-3 text-right font-mono text-xs text-gray-600">{data.jumlah_cargo}</td>',
  '<td className="p-3 text-right font-mono text-xs text-gray-600">-</td>'
);
code = code.replace(
  '<td className="p-3 text-right font-mono text-xs font-semibold text-blue-600">{formatCurrency(data.total_owner)}</td>',
  '<td className="p-3 text-right font-mono text-xs font-semibold text-blue-600">{formatCurrency(data.owner_deposit)}</td>'
);
code = code.replace(
  '<td className="p-3 text-right font-mono text-xs font-semibold text-emerald-600">{formatCurrency(data.total_outlet)}</td>',
  '<td className="p-3 text-right font-mono text-xs font-semibold text-emerald-600">{formatCurrency(data.outlet_cash)}</td>'
);

code = code.replace(
  '<th className="p-3 text-right">Express</th>',
  '<th className="p-3 text-right">Total Resi</th>'
);
code = code.replace(
  '<th className="p-3 text-right">Cargo</th>',
  '<th className="p-3 text-right">Refund/Batal</th>'
);

fs.writeFileSync('src/components/owner/ManagementControlTowerPage.tsx', code);
