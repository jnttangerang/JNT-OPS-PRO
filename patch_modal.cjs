const fs = require('fs');

let code = fs.readFileSync('src/components/BulkImportYoYiModal.tsx', 'utf8');

// 1. Fix getColValue
const newGetColValue = `  const getColValue = (row: any, aliases: string[]) => {
    const keys = Object.keys(row);
    // 1. Direct case-insensitive match
    for (const alias of aliases) {
      const key = keys.find(k => k.trim().toLowerCase() === alias.toLowerCase());
      if (key && row[key] !== undefined && row[key] !== "") return row[key];
    }
    
    const aggressiveNormalize = (str: string) => {
      // Replace all brackets/placeholders with space
      let s = str.toLowerCase().replace(/[\\(\\)\\[\\]\\{\\}\\?]/g, " ");
      // Remove known isolated unit words
      s = s.replace(/\\b(idr|kg|cm|cm2|cm3|rp)\\b/g, "");
      // Strip all non-alphanumeric
      return s.replace(/[^a-z0-9]/g, "");
    };

    // 2. Normalized match
    for (const alias of aliases) {
      const normAlias = aggressiveNormalize(alias);
      const key = keys.find(k => aggressiveNormalize(k) === normAlias);
      if (key && row[key] !== undefined && row[key] !== "") return row[key];
    }
    return "";
  };`;
code = code.replace(/const getColValue = \(row: any, aliases: string\[\]\) => \{[\s\S]*?return "";\n  \};/, newGetColValue);

// 2. Fix resi alias
code = code.replace(
  'const resi = getColValue(row, ["No. Pesanan", "Waybill", "Resi", "Awb", "Nomor Resi", "No Resi"]);',
  'const resi = getColValue(row, ["No. Resi", "Waybill", "Resi", "Awb", "Nomor Resi", "No Resi"]);'
);

// 3. Fix Waktu Pemesanan alias
code = code.replace(
  'const waktuRaw = getColValue(row, ["Waktu Pesanan", "Tanggal", "Waktu", "Created At"]);',
  'const waktuRaw = getColValue(row, ["Waktu pemesanan", "Waktu Pesanan", "Tanggal", "Waktu", "Created At"]);'
);

// 4. Fix Outlet Validation logic
const oldOutletLogic = `        let mapped_outlet_id = activeOutletId;
        if (kodeOutletRaw) {
          const rawOutlet = String(kodeOutletRaw).trim().toLowerCase();
          const found = outlets.find(o => Object.values(o).some(v => String(v).trim().toLowerCase() === rawOutlet));
          if (found) {
            mapped_outlet_id = found.outlet_id || found.id || rawOutlet; // Fallback to rawOutlet if key is missing but it matched
          } else if (rawOutlet === String(activeOutletId).trim().toLowerCase()) {
            mapped_outlet_id = activeOutletId;
          } else {
             is_skipped = true;
             skip_reason = "INVALID_OUTLET";
          }
        }`;
const newOutletLogic = `        let mapped_outlet_id = activeOutletId;
        if (kodeOutletRaw) {
          const rawOutlet = String(kodeOutletRaw).toLowerCase().replace(/^yz_\\s*/, '').replace(/\\s+/g, ' ').trim();
          
          // Try to find if rawOutlet contains our outlet name or vice versa
          const found = outlets.find(o => {
            if (!o.nama_outlet) return false;
            const normNama = String(o.nama_outlet).toLowerCase().replace(/\\s+/g, ' ').trim();
            return rawOutlet.includes(normNama) || normNama.includes(rawOutlet);
          });
          
          if (found) {
            // Found a matching outlet in the system
            if (found.outlet_id !== activeOutletId) {
               // The row belongs to a DIFFERENT outlet than the currently active one
               is_skipped = true;
               skip_reason = "INVALID_OUTLET";
            }
            // else: it matches activeOutletId, mapped_outlet_id remains activeOutletId (no skip)
          } 
          // if not found, we assume the format changed or it's just not mapped. 
          // We DO NOT skip, we just use activeOutletId.
        }`;
code = code.replace(oldOutletLogic, newOutletLogic);

fs.writeFileSync('src/components/BulkImportYoYiModal.tsx', code);
console.log("Patched BulkImportYoYiModal.tsx");
