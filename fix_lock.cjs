const fs = require('fs');

let code = fs.readFileSync('Code.gs', 'utf8');

const txLockRegex = /checkTransactionLock: function\(dateStr, outletId\) \{[\s\S]*?return false; \/\/ UNLOCKED\n  \},/;
code = code.replace(txLockRegex, `checkTransactionLock: function(dateStr, outletId) {
     if (!dateStr) return false;
     var setoranData = DatabaseService.getSheetData("Master_Setoran");
     if (!setoranData || setoranData.length < 2) return false;
     var headers = setoranData[0];
     var dateIdx = headers.indexOf("tanggal");
     var outletIdx = headers.indexOf("outlet_id");
     var statusIdx = headers.indexOf("status");
     
     if (dateIdx === -1 || outletIdx === -1 || statusIdx === -1) return false;
     
     for (var i = 1; i < setoranData.length; i++) {
        var sDate = setoranData[i][dateIdx].toString();
        var sOutlet = setoranData[i][outletIdx].toString();
        var sStatus = setoranData[i][statusIdx].toString();
        
        if (sDate === dateStr && sOutlet === outletId) {
           if (sStatus === "DISETUJUI" || sStatus === "MENUNGGU_APPROVAL") {
               return true; // LOCKED
           }
        }
     }
     return false; // UNLOCKED
  },`);

fs.writeFileSync('Code.gs', code);
console.log("Patched lock logic to use headers");
