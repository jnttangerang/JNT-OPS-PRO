const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

// The apiSaveSetoran replacement was incomplete, let's just make it call DatabaseService composite update.
// First, add updateRowByComposite to DatabaseService.

const dbCompositeRegex = /insertRow: function\(sheetName, rowDataMap\) \{/;
code = code.replace(dbCompositeRegex, 
`updateRowByMultipleColumns: function(sheetName, searchCriteriaMap, updateDataMap) {
    var sheet = getSheetByName(sheetName);
    var data = sheet.getDataRange().getValues();
    
    // Find column indexes
    var keys = Object.keys(searchCriteriaMap);
    var colIdxs = {};
    for (var k = 0; k < keys.length; k++) {
       var idx = getColIndex_(sheet, keys[k]);
       if (idx === -1) return false;
       colIdxs[keys[k]] = idx;
    }
    
    var foundRow = -1;
    for (var i = 1; i < data.length; i++) {
      var match = true;
      for (var k = 0; k < keys.length; k++) {
         if (data[i][colIdxs[keys[k]]].toString() !== searchCriteriaMap[keys[k]].toString()) {
            match = false;
            break;
         }
      }
      if (match) {
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
  insertRow: function(sheetName, rowDataMap) {`);

const newApiSaveSetoran = `function apiSaveSetoran(params) {
  var criteria = { date: params.date, outlet_id: params.outlet_id };
  var updateData = { status: params.status };
  if (params.total_setoran !== undefined) updateData.total_setoran = params.total_setoran;
  
  var success = DatabaseService.updateRowByMultipleColumns("SetoranData", criteria, updateData);
  
  if (!success) {
    var setoranObj = {
      date: params.date,
      outlet_id: params.outlet_id,
      status: params.status || "Belum Disetor",
      total_setoran: params.total_setoran || 0
    };
    DatabaseService.appendRow("SetoranData", setoranObj);
  }
  return { status: "success", message: "Status setoran berhasil disimpan." };
}`;

// Need to replace the broken apiSaveSetoran
const brokenRegex = /function apiSaveSetoran\(params\) \{[\s\S]*?\}\n  \}\n\}/;
code = code.replace(brokenRegex, newApiSaveSetoran);

fs.writeFileSync('Code.gs', code);
console.log("Fixed composite setoran");
