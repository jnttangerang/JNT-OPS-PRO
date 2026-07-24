const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf-8');

function replaceFunction(code, funcName, newImpl) {
  const regex = new RegExp(`function ${funcName}\\s*\\([^{]*\\)\\s*\\{`);
  const match = code.match(regex);
  if (!match) return code;
  
  let startIndex = match.index;
  let braceCount = 0;
  let endIndex = -1;
  let started = false;
  
  for (let i = startIndex; i < code.length; i++) {
    if (code[i] === '{') {
      braceCount++;
      started = true;
    } else if (code[i] === '}') {
      braceCount--;
    }
    
    if (started && braceCount === 0) {
      endIndex = i;
      break;
    }
  }
  
  if (endIndex !== -1) {
    return code.substring(0, startIndex) + newImpl + code.substring(endIndex + 1);
  }
  return code;
}

const writeAuditLogImpl = `function writeAuditLog(userId, action, detail, outletId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("AuditLogs");
    if (!sheet) {
      // Jaga-jaga jika terhapus
      sheet = ss.insertSheet("AuditLogs");
      sheet.appendRow(DB_SCHEMA.AuditLogs);
    }
    
    var logObj = {
      log_id: "LOG-" + new Date().getTime().toString().slice(-6),
      timestamp: new Date().toISOString(),
      user_id: userId || "SYSTEM",
      aksi: action,
      detail: detail,
      outlet_id: outletId || ""
    };
    
    var row = DB_SCHEMA.AuditLogs.map(function(col) { return logObj[col] !== undefined ? logObj[col] : ""; });
    sheet.appendRow(row);
  } catch (e) {
    Logger.log("Gagal writeAuditLog: " + e.toString());
  }
}`;

code = replaceFunction(code, 'writeAuditLog', writeAuditLogImpl);
fs.writeFileSync('Code.gs', code);
