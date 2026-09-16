const fs = require('fs');
let code = fs.readFileSync('src/components/admin/LengkapiYoYiPage.tsx', 'utf8');

// Fix key prop issue
code = code.replace(
  /<YoYiInlineRow key=\{tx\.id \|\| tx\.no_resi\} tx=\{tx\} onUpdate=\{fetchTransactions\} \/>/g,
  '<YoYiInlineRow key={tx.id || tx.no_resi} tx={tx} onUpdate={fetchTransactions} />'
);

fs.writeFileSync('src/components/admin/LengkapiYoYiPage.tsx', code);
