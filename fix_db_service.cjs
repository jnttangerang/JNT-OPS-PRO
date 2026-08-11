const fs = require('fs');
let code = fs.readFileSync('Code.js', 'utf8');

const targetStr = '     var mergedMap = {};\n\n\n\nvar TransactionService = {';
const replacement = `     var mergedMap = {};
     schema.forEach(function(col, idx) {
       mergedMap[col] = existingRowData[idx];
     });
     for (var key in rowDataMap) {
       mergedMap[key] = rowDataMap[key];
     }
     
     var row = schema.map(function(col) { return mergedMap[col] !== undefined ? mergedMap[col] : ""; });
     sheet.getRange(foundRow, 1, 1, row.length).setValues([row]);
     return mergedMap;
  },
  
  findRowByColumn: function(sheetName, searchColName, searchValue) {
    var sheet = getSheetByName(sheetName);
    var schema = DB_SCHEMA[sheetName];
    var data = sheet.getDataRange().getValues();
    var colIdx = getColIndex_(sheet, searchColName);
    if (colIdx === -1) return null;
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][colIdx].toString().toUpperCase() === searchValue.toString().toUpperCase()) {
        var obj = {};
        for (var j = 0; j < schema.length; j++) {
           obj[schema[j]] = data[i][j];
        }
        return obj;
      }
    }
    return null;
  },
  
  appendAudit: function(userId, action, detail, outletId) {
    var logObj = {
      log_id: "LOG-" + new Date().getTime().toString().slice(-6),
      timestamp: new Date().toISOString(),
      user_id: userId || "SYSTEM",
      aksi: action,
      detail: detail,
      outlet_id: outletId || "OUT-001"
    };
    this.appendRow("AuditLogs", logObj);
  }
};

var TransactionService = {`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replacement);
  fs.writeFileSync('Code.js', code);
  console.log("Restored DatabaseService!");
} else {
  console.log("Target string not found, wait let's use regex.");
  const rx = /     var mergedMap = \{\};\s*var TransactionService = \{/;
  if (rx.test(code)) {
    code = code.replace(rx, replacement);
    fs.writeFileSync('Code.js', code);
    console.log("Restored DatabaseService via regex!");
  } else {
    console.log("Still not found.");
  }
}
