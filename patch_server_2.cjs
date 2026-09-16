const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  '// Trigger customer upsert pipeline asynchronously',
  `// Trigger customer upsert pipeline
    if (masterTx) {
      if (updates.nama_pengirim !== undefined) masterTx.snapshot_nama_pengirim = updates.nama_pengirim;
      if (updates.hp_pengirim !== undefined) masterTx.snapshot_hp_pengirim = updates.hp_pengirim;
      if (updates.nama_penerima !== undefined) masterTx.snapshot_nama_penerima = updates.nama_penerima;
      if (updates.hp_penerima !== undefined) masterTx.snapshot_hp_penerima = updates.hp_penerima;
      
      autoUpsertCustomerAndAddressBook(db, {
        outlet_id: masterTx.outlet_id || "OUTLET-YOYI",
        nama_pengirim: masterTx.snapshot_nama_pengirim,
        hp_pengirim: masterTx.snapshot_hp_pengirim,
        alamat_pengirim: masterTx.snapshot_alamat_pengirim,
        nama_penerima: masterTx.snapshot_nama_penerima,
        hp_penerima: masterTx.snapshot_hp_penerima,
        alamat_penerima: masterTx.snapshot_alamat_penerima
      });
      writeDb(db);
    }`
);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts customer upsert");
