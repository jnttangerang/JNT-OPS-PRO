const fs = require('fs');
let content = fs.readFileSync('Code.gs', 'utf-8');

const oldDedupPenerima = `        if (rName || rPhoneNorm) {
          if (rPhoneNorm && hpPenerimaMap[rPhoneNorm]) {
            var existingRIdx = hpPenerimaMap[rPhoneNorm]._rowIndex;`;

const newDedupPenerima = `        if (rName || rPhoneNorm) {
          var penerimaMatch = null;
          if (rPhoneNorm && hpPenerimaMap[rPhoneNorm]) {
            penerimaMatch = hpPenerimaMap[rPhoneNorm];
          } else if (!rPhoneNorm && rName) {
            var rKey = rName + "|||" + rAddr;
            if (nameAddrPenerimaMap[rKey]) {
              penerimaMatch = nameAddrPenerimaMap[rKey];
            }
          }

          if (penerimaMatch) {
            var existingRIdx = penerimaMatch._rowIndex;`;

if (content.includes(oldDedupPenerima)) {
  content = content.replace(oldDedupPenerima, newDedupPenerima);
  fs.writeFileSync('Code.gs', content);
  console.log("Fixed Penerima");
} else {
  console.log("Could not find Penerima block");
}
