const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

const regex = /case "rejectSetoran":\s*return apiRejectSetoran\(params\);/;
const replacement = `case "rejectSetoran":
      return apiRejectSetoran(params);
    case "getAuditData":
      return apiGetAuditData(params);`;

if (code.match(regex)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('Code.gs', code);
  console.log("Patched doPost");
} else {
  console.log("Could not find regex in doPost.");
}
