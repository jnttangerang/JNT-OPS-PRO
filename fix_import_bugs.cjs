const fs = require('fs');
let content = fs.readFileSync('Code.gs', 'utf-8');

// 1. Add sanitizeString_ helper just before normalizePhone_
if (!content.includes('function sanitizeString_')) {
  content = content.replace(
    'function normalizePhone_',
    'function sanitizeString_(str) {\n  if (str === null || str === undefined) return "";\n  var s = String(str).trim();\n  if (s === "-") return "";\n  return s;\n}\n\nfunction normalizePhone_'
  );
}

// 2. Add Name+Addr maps
content = content.replace(
  'var hpPengirimMap = {};',
  'var hpPengirimMap = {};\n    var nameAddrPengirimMap = {};'
);
content = content.replace(
  'hpPengirimMap[hpNorm] = row;\n      }',
  'hpPengirimMap[hpNorm] = row;\n      }\n      var nameAddrKey = sanitizeString_(row.nama) + "|||" + sanitizeString_(row.alamat);\n      nameAddrPengirimMap[nameAddrKey] = row;'
);

content = content.replace(
  'var hpPenerimaMap = {};',
  'var hpPenerimaMap = {};\n    var nameAddrPenerimaMap = {};'
);
content = content.replace(
  'hpPenerimaMap[hpNorm] = row;\n      }',
  'hpPenerimaMap[hpNorm] = row;\n      }\n      var nameAddrKey = sanitizeString_(row.nama) + "|||" + sanitizeString_(row.alamat);\n      nameAddrPenerimaMap[nameAddrKey] = row;'
);

// 3. Update the loop to use sanitizeString_ and correct addr fields
const oldParsingBlock = `        if (useEditedRows) {
          var ed = params.editedRows[r];
          sName = ed.namaPengirim || "";
          sPhone = ed.noHpPengirim || "";
          rName = ed.namaPenerima || "";
          rPhone = ed.noHpPenerima || "";
          sAddr = ed.alamat || "";
          rAddr = ed.alamat || "";
        } else {
          var dr = rawData[r];
          sName = idxSndName !== -1 ? dr[idxSndName].toString().trim() : "";
          sPhone = idxSndPhone !== -1 ? dr[idxSndPhone].toString().trim() : "";
          sAddr = idxSndAddr !== -1 ? dr[idxSndAddr].toString().trim() : "";
          sZip = idxSndZip !== -1 ? dr[idxSndZip].toString().trim() : "";

          rName = idxRcvName !== -1 ? dr[idxRcvName].toString().trim() : "";
          rPhone = idxRcvPhone !== -1 ? dr[idxRcvPhone].toString().trim() : "";
          rAddr = idxRcvAddr !== -1 ? dr[idxRcvAddr].toString().trim() : "";
          rZip = idxRcvZip !== -1 ? dr[idxRcvZip].toString().trim() : "";
        }

        if (!sName && !sPhone && !rName && !rPhone) {
          continue;
        }
        if (sName === "-" && sPhone === "-" && rName === "-" && rPhone === "-") {
          continue;
        }

        var sPhoneNorm = normalizePhone_(sPhone);
        var rPhoneNorm = normalizePhone_(rPhone);`;

const newParsingBlock = `        if (useEditedRows) {
          var ed = params.editedRows[r];
          sName = sanitizeString_(ed.namaPengirim);
          sPhone = sanitizeString_(ed.noHpPengirim);
          rName = sanitizeString_(ed.namaPenerima);
          rPhone = sanitizeString_(ed.noHpPenerima);
          sAddr = sanitizeString_(ed.alamatPengirim || ed.alamat); // Fallback to ed.alamat if UI is not updated
          rAddr = sanitizeString_(ed.alamatPenerima || ed.alamat);
        } else {
          var dr = rawData[r];
          sName = sanitizeString_(idxSndName !== -1 ? dr[idxSndName] : "");
          sPhone = sanitizeString_(idxSndPhone !== -1 ? dr[idxSndPhone] : "");
          sAddr = sanitizeString_(idxSndAddr !== -1 ? dr[idxSndAddr] : "");
          sZip = sanitizeString_(idxSndZip !== -1 ? dr[idxSndZip] : "");

          rName = sanitizeString_(idxRcvName !== -1 ? dr[idxRcvName] : "");
          rPhone = sanitizeString_(idxRcvPhone !== -1 ? dr[idxRcvPhone] : "");
          rAddr = sanitizeString_(idxRcvAddr !== -1 ? dr[idxRcvAddr] : "");
          rZip = sanitizeString_(idxRcvZip !== -1 ? dr[idxRcvZip] : "");
        }

        var sPhoneNorm = normalizePhone_(sPhone);
        var rPhoneNorm = normalizePhone_(rPhone);

        if (!sName && !sPhoneNorm && !rName && !rPhoneNorm) {
          continue;
        }`;

content = content.replace(oldParsingBlock, newParsingBlock);

// 4. Update Dedup logic Pengirim
const oldDedupPengirim = `        if (sName || sPhoneNorm) {
          if (sPhoneNorm && hpPengirimMap[sPhoneNorm]) {
            // Update
            var existingIdx = hpPengirimMap[sPhoneNorm]._rowIndex;`;

const newDedupPengirim = `        if (sName || sPhoneNorm) {
          var pengirimMatch = null;
          if (sPhoneNorm && hpPengirimMap[sPhoneNorm]) {
            pengirimMatch = hpPengirimMap[sPhoneNorm];
          } else if (!sPhoneNorm && sName) {
            var sKey = sName + "|||" + sAddr;
            if (nameAddrPengirimMap[sKey]) {
              pengirimMatch = nameAddrPengirimMap[sKey];
            }
          }

          if (pengirimMatch) {
            // Update
            var existingIdx = pengirimMatch._rowIndex;`;

content = content.replace(oldDedupPengirim, newDedupPengirim);

// 5. Update Dedup logic Penerima
const oldDedupPenerima = `        if (rName || rPhoneNorm) {
          if (rPhoneNorm && hpPenerimaMap[rPhoneNorm]) {
            // Update
            var existingIdx = hpPenerimaMap[rPhoneNorm]._rowIndex;`;

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
            // Update
            var existingIdx = penerimaMatch._rowIndex;`;

content = content.replace(oldDedupPenerima, newDedupPenerima);

fs.writeFileSync('Code.gs', content);
console.log("Done");
