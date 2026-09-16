const fs = require('fs');

let code = fs.readFileSync('Code.gs', 'utf8');

code = code.replace(
  'if (params.bukti_maps_url !== undefined) updateMap.bukti_maps_url = params.bukti_maps_url;',
  `if (params.bukti_maps_url !== undefined) updateMap.bukti_maps_url = params.bukti_maps_url;
    if (params.nama_pengirim !== undefined) updateMap.snapshot_nama_pengirim = params.nama_pengirim;
    if (params.hp_pengirim !== undefined) updateMap.snapshot_hp_pengirim = params.hp_pengirim;
    if (params.nama_penerima !== undefined) updateMap.snapshot_nama_penerima = params.nama_penerima;
    if (params.hp_penerima !== undefined) updateMap.snapshot_hp_penerima = params.hp_penerima;`
);

fs.writeFileSync('Code.gs', code);
console.log("Patched Code.gs names");
