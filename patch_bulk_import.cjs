const fs = require('fs');

let code = fs.readFileSync('src/components/BulkImportYoYiModal.tsx', 'utf8');

// Fix P0-1: Outlet validation
code = code.replace(
  /const found = outlets\.find\(o =>[\s\S]*?\);\s*if \(found\) \{\s*mapped_outlet_id = found\.outlet_id;\s*\} else \{\s*is_skipped = true;\s*skip_reason = "INVALID_OUTLET";\s*\}/m,
  `const rawOutlet = String(kodeOutletRaw).trim().toLowerCase();
          const found = outlets.find(o => Object.values(o).some(v => String(v).trim().toLowerCase() === rawOutlet));
          if (found) {
            mapped_outlet_id = found.outlet_id || found.id || rawOutlet; // Fallback to rawOutlet if key is missing but it matched
          } else if (rawOutlet === String(activeOutletId).trim().toLowerCase()) {
            mapped_outlet_id = activeOutletId;
          } else {
             is_skipped = true;
             skip_reason = "INVALID_OUTLET";
          }`
);

// Fix P0-2: Remove mass metode_bayar_tambahan
code = code.replace(/const \[metodeBayarTambahanDefault, setMetodeBayarTambahanDefault\] = useState<string>\("QRIS"\);/, '');

code = code.replace(
  /const resolvedMetodeTambahan = row\.metode_bayar_tambahan \|\|[\s\S]*?"QRIS";/m,
  `const resolvedMetodeTambahan = row.metode_bayar_tambahan || "";`
);

code = code.replace(
  /<div className="bg-amber-50\/70 border border-amber-200\/80 rounded-xl p-3\.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">[\s\S]*?<\/div>\s*<\/div>/,
  ''
);

code = code.replace(
  /<span className="text-xs text-gray-500 font-medium">Metode Tambahan: <span className="font-bold text-indigo-600 font-mono">\{metodeBayarTambahanDefault\}<\/span><\/span>/,
  ''
);

code = code.replace(
  /\{row\.metode_bayar_tambahan \|\| \(metodeBayarTambahanDefault === "IKUT_ONGKIR" \? row\.metode_bayar : metodeBayarTambahanDefault\)\}/,
  '{row.metode_bayar_tambahan || "-"}'
);

fs.writeFileSync('src/components/BulkImportYoYiModal.tsx', code);
console.log("Patched BulkImportYoYiModal");
