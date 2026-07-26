const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

const regex = /\/\*\*\n \* Menggunakan getColIndex_\(\) untuk mencari kolom status_resi sebelum menulis "BATAL"\n \*\/\nfunction apiDeleteTransaksi\(params\) \{[\s\S]*?return \{ status: "success", message: "Transaksi berhasil dibatalkan" \};\n\}/;

const newCode = `/**
 * Menghapus transaksi menggunakan TransactionService
 */
function apiDeleteTransaksi(params) {
  try {
    var result = TransactionService.deleteTransaction(params.resi_id, params.user_id, params.outlet_id, params.tipe);
    return { status: "success", message: result.message };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}`;

code = code.replace(regex, newCode);
fs.writeFileSync('Code.gs', code);
