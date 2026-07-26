const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

const regexExp = /  Master_Setoran: \["setoran_id", "tanggal", "outlet_id", "outlet_name", "admin_pembuat", "jumlah_resi", "total_setoran_owner", "total_kas_outlet", "status", "created_at", "approved_at", "approved_by", "catatan_owner"\],\n  Daily_Closing: \["closing_date", "outlet_id", "closed_by", "closed_at", "total_transactions", "total_customer_payment", "total_setoran_owner", "total_kas_operasional", "total_yoyi", "total_selisih", "status"\]\n\};/;
const replacementExp = `  Master_Setoran: ["setoran_id", "tanggal", "outlet_id", "outlet_name", "admin_pembuat", "jumlah_resi", "total_setoran_owner", "total_kas_outlet", "status", "created_at", "approved_at", "approved_by", "catatan_owner", "closing_status", "closing_at", "closing_by"]\n};`;

code = code.replace(regexExp, replacementExp);

fs.writeFileSync('Code.gs', code);
console.log("Patched DB_SCHEMA for Master_Setoran closing");
