const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

const regex = /case "saveTransaksi":\n      return apiSaveTransaksi\(params\);/;
const updates = `case "saveTransaksi":
      return apiSaveTransaksi(params);
    case "updateTransaksi":
      return apiUpdateTransaksi(params);`;

code = code.replace(regex, updates);

const apiUpdateFunc = `
/**
 * Mengupdate transaksi menggunakan TransactionService
 */
function apiUpdateTransaksi(params) {
  try {
    var result = TransactionService.updateTransaction(params.jenis_layanan, params.data);
    return { status: "success", message: "Transaksi berhasil diupdate!", data: result };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}
`;

code = code + "\n" + apiUpdateFunc;
fs.writeFileSync('Code.gs', code);
