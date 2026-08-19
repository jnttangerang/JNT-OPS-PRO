const fs = require("fs");
let code = fs.readFileSync("Code.gs", "utf8");

code = code.replace(
  /asuransi: parsed\.asuransi,/,
  `biaya_asuransi: parsed.asuransi,`
);

code = code.replace(
  /metode_pembayaran_ongkir: input\.metode_bayar_ongkir,/,
  `metode_bayar: input.metode_bayar_ongkir,`
);

code = code.replace(
  /jumlah_dibayar_customer: input\.jumlah_dibayar,/,
  `total_dibayar_customer: input.jumlah_dibayar,`
);

fs.writeFileSync("Code.gs", code);
console.log("Code.gs payload mapping fixed");
