const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

const target = `  if (activeSetoran && activeSetoran.closing_status === "CLOSED") {
    return { 
      status: "success", 
      is_valid: true,
      is_closed: true,
      message: "Hari ini sudah di-closing",
      data: activeSetoran
    };
  }`;

const replacement = `  if (activeSetoran && activeSetoran.closing_status === "CLOSED") {
    activeSetoran.total_transactions = activeSetoran.jumlah_resi;
    return { 
      status: "success", 
      is_valid: true,
      is_closed: true,
      message: "Hari ini sudah di-closing",
      data: activeSetoran
    };
  }`;

code = code.replace(target, replacement);
fs.writeFileSync('Code.gs', code);
console.log("Patched apiValidateClosing mapping");
