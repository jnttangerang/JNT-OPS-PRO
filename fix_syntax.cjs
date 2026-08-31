const fs = require('fs');
let content = fs.readFileSync('src/lib/financialEngine.ts', 'utf8');

// replace the duplicated block
content = content.replace(`  return {
    cash_payment: owner_deposit,
    digital_payment: 0,
    dfod_outstanding: 0,
    outlet_right_admin: outlet_cash,
    outlet_right_owner: 0
  };
}  return {
    cash_payment: owner_deposit,
    digital_payment: 0,
    dfod_outstanding: 0
  };
}`, `  return {
    cash_payment: owner_deposit,
    digital_payment: 0,
    dfod_outstanding: 0,
    outlet_right_admin: outlet_cash,
    outlet_right_owner: 0
  };
}`);

fs.writeFileSync('src/lib/financialEngine.ts', content);
