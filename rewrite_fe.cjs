const fs = require('fs');
let content = fs.readFileSync('src/lib/financialEngine.ts', 'utf8');

// just manually construct the file, it's safer.
// Wait, the file is not too long, but it's better to just do exact regex matching
content = content.replace(/function classifyPayment[\s\S]*?dfod_outstanding: 0\s*};\s*}/m, `function classifyPayment(owner_deposit: number, outlet_cash: number, rawMethodInput?: string, dfodNominal: number = 0) {
  const rawMethod = String(rawMethodInput || "").trim().toUpperCase();
  const isDigital = rawMethod === "QRIS" || rawMethod === "TRANSFER" || rawMethod === "ORDER BY APP" || rawMethod === "ORDER_BY_APP" || rawMethod === "APP";
  const isDfod = rawMethod === "DFOD" || rawMethod.includes("DFOD");

  if (isDfod) {
    return {
      cash_payment: 0,
      digital_payment: 0,
      dfod_outstanding: dfodNominal > 0 ? dfodNominal : owner_deposit,
      outlet_right_admin: outlet_cash,
      outlet_right_owner: 0
    };
  }

  if (isDigital) {
    return {
      cash_payment: 0,
      digital_payment: owner_deposit,
      dfod_outstanding: 0,
      outlet_right_admin: 0,
      outlet_right_owner: outlet_cash
    };
  }

  return {
    cash_payment: owner_deposit,
    digital_payment: 0,
    dfod_outstanding: 0,
    outlet_right_admin: outlet_cash,
    outlet_right_owner: 0
  };
}`);

fs.writeFileSync('src/lib/financialEngine.ts', content);
