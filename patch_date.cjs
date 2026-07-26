const fs = require('fs');
let code = fs.readFileSync('src/components/owner/DailyClosingPage.tsx', 'utf8');

code = code.replace(/import \{ format \} from "date-fns";\nimport \{ id \} from "date-fns\/locale";\n/, "");

// replace format(new Date(), "yyyy-MM-dd") with new Date().toISOString().split('T')[0]
code = code.replace(/format\(new Date\(\), "yyyy-MM-dd"\)/, `new Date().toISOString().split('T')[0]`);

// replace format(new Date(closingDate), "dd MMMM yyyy", { locale: id }) with new Date(closingDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
code = code.replace(/format\(new Date\(closingDate\), "dd MMMM yyyy", \{ locale: id \}\)/, `new Date(closingDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })`);

fs.writeFileSync('src/components/owner/DailyClosingPage.tsx', code);
console.log("Patched DailyClosingPage to remove date-fns");
