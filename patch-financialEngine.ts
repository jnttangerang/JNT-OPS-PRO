import fs from "fs";
const p = "./src/lib/financialEngine.ts";
let content = fs.readFileSync(p, "utf-8");

// Modify classifyPayment
content = content.replace(
  /function classifyPayment\(owner_deposit: number, outlet_cash: number, rawMethodInput\?: string, dfodNominal: number = 0\) {([\s\S]*?)return {([\s\S]*?)cash_payment: owner_deposit,([\s\S]*?)digital_payment: 0,([\s\S]*?)dfod_outstanding: 0,([\s\S]*?)outlet_right_admin: outlet_cash,([\s\S]*?)outlet_right_owner: 0([\s\S]*?)};\n}/m,
  `function classifyPayment(owner_deposit: number, outlet_cash: number, rawMethodInput?: string, dfodNominal: number = 0, outletMethod?: string) {
  const rawMethod = String(rawMethodInput || "").trim().toUpperCase();
  const isDigitalOwner = rawMethod === "QRIS" || rawMethod === "TRANSFER" || rawMethod === "ORDER BY APP" || rawMethod === "ORDER_BY_APP" || rawMethod === "APP";
  const isDfod = rawMethod === "DFOD" || rawMethod.includes("DFOD");

  const rawOutletMethod = String(outletMethod || "").trim().toUpperCase();
  const isDigitalOutlet = rawOutletMethod === "QRIS" || rawOutletMethod === "TRANSFER" || rawOutletMethod === "ORDER BY APP" || rawOutletMethod === "ORDER_BY_APP" || rawOutletMethod === "APP";

  let outlet_right_admin = 0;
  let outlet_right_owner = 0;

  if (isDigitalOutlet) {
    outlet_right_owner = outlet_cash;
    outlet_right_admin = 0;
  } else {
    outlet_right_admin = outlet_cash;
    outlet_right_owner = 0;
  }

  if (isDfod) {
    return {
      cash_payment: 0,
      digital_payment: 0,
      dfod_outstanding: dfodNominal > 0 ? dfodNominal : owner_deposit,
      outlet_right_admin: outlet_cash,
      outlet_right_owner: 0
    };
  }

  if (isDigitalOwner) {
    return {
      cash_payment: 0,
      digital_payment: owner_deposit,
      dfod_outstanding: 0,
      outlet_right_admin,
      outlet_right_owner
    };
  }

  return {
    cash_payment: owner_deposit,
    digital_payment: 0,
    dfod_outstanding: 0,
    outlet_right_admin,
    outlet_right_owner
  };
}`
);

// Add fields to DailyFinancialSummary
content = content.replace(
  /total_outlet_owner: number;\n}/g,
  "total_outlet_owner: number;\n  total_outlet_right_admin: number;\n  total_outlet_right_owner: number;\n}"
);

// Update calculateFinancialSummary return on zero
content = content.replace(
  /const classification = classifyPayment\(owner_deposit, outlet_cash, paymentMethod, isDfod \? \(biayaDasarLayanan \+ rounding\) : 0\);/g,
  `const outletMethod = tx.metode_bayar_tambahan || tx.metode_pembayaran_tambahan || "";
  const classification = classifyPayment(owner_deposit, outlet_cash, paymentMethod, isDfod ? (biayaDasarLayanan + rounding) : 0, outletMethod);`
);

// Update calculateDailyFinancial
content = content.replace(
  /let total_outlet_owner = 0;\n/g,
  "let total_outlet_owner = 0;\n  let total_outlet_right_admin = 0;\n  let total_outlet_right_owner = 0;\n"
);
content = content.replace(
  /total_outlet_admin \+= summary\.outlet_right_admin;\n    total_outlet_owner \+= summary\.outlet_right_owner;/g,
  "total_outlet_admin += summary.outlet_right_admin;\n    total_outlet_owner += summary.outlet_right_owner;\n    total_outlet_right_admin += summary.outlet_right_admin;\n    total_outlet_right_owner += summary.outlet_right_owner;"
);
content = content.replace(
  /total_outlet_admin,\n    total_outlet_owner,/g,
  "total_outlet_admin,\n    total_outlet_owner,\n    total_outlet_right_admin,\n    total_outlet_right_owner,"
);

// Update calculateAdminFinancial
content = content.replace(
  /jumlah_resi: 0\n      };/g,
  "jumlah_resi: 0,\n        outlet_right_admin: 0,\n        outlet_right_owner: 0\n      };"
);
content = content.replace(
  /result\[admin\]\.jumlah_resi\+\+;/g,
  "result[admin].outlet_right_admin += summary.outlet_right_admin;\n    result[admin].outlet_right_owner += summary.outlet_right_owner;\n    result[admin].jumlah_resi++;"
);

// Update calculateOutletFinancial
content = content.replace(
  /jumlah_cargo: 0\n      };/g,
  "jumlah_cargo: 0,\n        outlet_right_admin: 0,\n        outlet_right_owner: 0\n      };"
);
content = content.replace(
  /result\[outlet\]\.jumlah_resi\+\+;/g,
  "result[outlet].outlet_right_admin += summary.outlet_right_admin;\n    result[outlet].outlet_right_owner += summary.outlet_right_owner;\n    result[outlet].jumlah_resi++;"
);

fs.writeFileSync(p, content);
