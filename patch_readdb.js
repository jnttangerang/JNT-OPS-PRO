const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /if \(!parsed\.MASTER_TRANSAKSI \|\| !Array\.isArray\(parsed\.MASTER_TRANSAKSI\)\) \{/;
const replacement = `
    if (!parsed.Users || !Array.isArray(parsed.Users)) {
      parsed.Users = initialDb.Users;
      updated = true;
    }
    if (!parsed.Outlets || !Array.isArray(parsed.Outlets)) {
      parsed.Outlets = initialDb.Outlets;
      updated = true;
    }
    if (!parsed.SystemSettings) {
      parsed.SystemSettings = initialDb.SystemSettings;
      updated = true;
    }
    if (!parsed.MASTER_TRANSAKSI || !Array.isArray(parsed.MASTER_TRANSAKSI)) {`;

code = code.replace(regex, replacement);
fs.writeFileSync('server.ts', code);
