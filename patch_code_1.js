const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf-8');

// 1. Insert helper functions
const helpers = `
// ==========================================
// HELPER DYNAMIC SCHEMA
// ==========================================

function getColIndex_(sheet, headerName) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return headers.indexOf(headerName); // 0-based
}

function rowToObject_(headers, row) {
  var obj = {};
  headers.forEach(function (h, i) { obj[h] = row[i]; });
  return obj;
}

`;

code = code.replace('// API HANDLERS & BUSINESS LOGIC', helpers + '// API HANDLERS & BUSINESS LOGIC');

// 2. Refactor handleRouting
code = code.replace(
  '    case "deleteTransaksi":\n      return apiDeleteTransaksi(params);',
  `    case "deleteTransaksi":\n      return apiDeleteTransaksi(params);\n    case "updateOutletTarget":\n      return apiUpdateOutletTarget(params);\n    case "getMapsReviews":\n      return apiGetMapsReviews(params);\n    case "saveMapsReview":\n      return apiSaveMapsReview(params);\n    case "getStatusSetoran":\n      return apiGetStatusSetoran(params);\n    case "saveSetoran":\n      return apiSaveSetoran(params);`
);

fs.writeFileSync('Code.gs', code);
