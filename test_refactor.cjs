const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

const databaseService = `
var DatabaseService = {
  getSheetData: function(sheetName) {
    return getSheetByName(sheetName).getDataRange().getValues();
  },
  
  insertRow: function(sheetName, rowDataMap) {
    var sheet = getSheetByName(sheetName);
    var schema = DB_SCHEMA[sheetName];
    var row = schema.map(function(col) { return rowDataMap[col] !== undefined ? rowDataMap[col] : ""; });
    sheet.insertRowAfter(1);
    sheet.getRange(2, 1, 1, row.length).setValues([row]);
  },
  
  appendRow: function(sheetName, rowDataMap) {
    var sheet = getSheetByName(sheetName);
    var schema = DB_SCHEMA[sheetName];
    var row = schema.map(function(col) { return rowDataMap[col] !== undefined ? rowDataMap[col] : ""; });
    sheet.appendRow(row);
  },
  
  updateRowByColumn: function(sheetName, searchColName, searchValue, updateDataMap) {
    var sheet = getSheetByName(sheetName);
    var data = sheet.getDataRange().getValues();
    var colIdx = getColIndex_(sheet, searchColName);
    if (colIdx === -1) return false;
    
    var foundRow = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][colIdx].toString().toUpperCase() === searchValue.toString().toUpperCase()) {
        foundRow = i + 1;
        break;
      }
    }
    
    if (foundRow === -1) return false;
    
    var colUpdates = Object.keys(updateDataMap);
    for (var j = 0; j < colUpdates.length; j++) {
      var cName = colUpdates[j];
      var cIdx = getColIndex_(sheet, cName);
      if (cIdx !== -1) {
        sheet.getRange(foundRow, cIdx + 1).setValue(updateDataMap[cName]);
      }
    }
    return true;
  },

  updateFullRowByColumn: function(sheetName, searchColName, searchValue, rowDataMap) {
     var sheet = getSheetByName(sheetName);
     var schema = DB_SCHEMA[sheetName];
     var data = sheet.getDataRange().getValues();
     var colIdx = getColIndex_(sheet, searchColName);
     if (colIdx === -1) return null;
     
     var foundRow = -1;
     var existingRowData = null;
     for (var i = 1; i < data.length; i++) {
       if (data[i][colIdx].toString().toUpperCase() === searchValue.toString().toUpperCase()) {
         foundRow = i + 1;
         existingRowData = data[i];
         break;
       }
     }
     if (foundRow === -1) return null;
     
     var mergedMap = {};
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
`;

console.log("Testing script generation");
