const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

const regex = /var dbExp = getSheetByName\("EXP_Resi"\)\.getDataRange\(\)\.getValues\(\);\n  var dbCrg = getSheetByName\("CRG_Resi"\)\.getDataRange\(\)\.getValues\(\);\n  var dbBackup = getSheetByName\("PreInput_Backup"\)\.getDataRange\(\)\.getValues\(\);\n  var dbOutlets = getSheetByName\("Outlets"\)\.getDataRange\(\)\.getValues\(\);\n  var dbLogs = getSheetByName\("AuditLogs"\)\.getDataRange\(\)\.getValues\(\);\n  var dbUsers = getSheetByName\("Users"\)\.getDataRange\(\)\.getValues\(\);/;

const replacement = `var dbExp = DatabaseService.getSheetData("EXP_Resi");
  var dbCrg = DatabaseService.getSheetData("CRG_Resi");
  var dbBackup = DatabaseService.getSheetData("PreInput_Backup");
  var dbOutlets = DatabaseService.getSheetData("Outlets");
  var dbLogs = DatabaseService.getSheetData("AuditLogs");
  var dbUsers = DatabaseService.getSheetData("Users");`;

code = code.replace(regex, replacement);

const regex2 = /var sheetExp = getSheetByName\("EXP_Resi"\);\n  var sheetCrg = getSheetByName\("CRG_Resi"\);\n  var dbExp = sheetExp\.getDataRange\(\)\.getValues\(\);\n  var dbCrg = sheetCrg\.getDataRange\(\)\.getValues\(\);\n  var dbBackup = getSheetByName\("PreInput_Backup"\)\.getDataRange\(\)\.getValues\(\);\n  var dbOutlets = getSheetByName\("Outlets"\)\.getDataRange\(\)\.getValues\(\);\n  var dbUsers = getSheetByName\("Users"\)\.getDataRange\(\)\.getValues\(\);/;

const replacement2 = `var dbExp = DatabaseService.getSheetData("EXP_Resi");
  var dbCrg = DatabaseService.getSheetData("CRG_Resi");
  var dbBackup = DatabaseService.getSheetData("PreInput_Backup");
  var dbOutlets = DatabaseService.getSheetData("Outlets");
  var dbUsers = DatabaseService.getSheetData("Users");`;
  
code = code.replace(regex2, replacement2);

fs.writeFileSync('Code.gs', code);
console.log("Dashboard fixed");
