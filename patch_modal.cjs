const fs = require("fs");
let code = fs.readFileSync("src/components/ImportYoYiModal.tsx", "utf8");

code = code.replace(
  `<span className="text-slate-500">Ongkir YoYi:</span>`,
  `<span className="text-slate-500">Barang:</span>
                  <span className="font-bold text-slate-800">{parsedData.nama_barang || "-"}</span>
                  
                  <span className="text-slate-500">Tipe Produk:</span>
                  <span className="font-bold text-slate-800">{parsedData.tipe_produk || "-"}</span>
                  
                  <span className="text-slate-500">Admin/User:</span>
                  <span className="font-bold text-slate-800">{adminId}</span>

                  <span className="text-slate-500">Ongkir YoYi:</span>`
);

fs.writeFileSync("src/components/ImportYoYiModal.tsx", code);
console.log("ImportYoYiModal.tsx updated");
