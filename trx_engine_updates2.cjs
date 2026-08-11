const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

const regex2 = /saveTransaction: function\(jenisLayanan, data\) \{/;

const updates2 = `
  validateTransaction: function(resiId, dbExpRaw, dbCrgRaw) {
    var upperResi = (resiId || "").trim().toUpperCase();
    for (var i = 1; i < dbExpRaw.length; i++) {
      if (dbExpRaw[i][0].toString().toUpperCase() === upperResi) return false;
    }
    for (var j = 1; j < dbCrgRaw.length; j++) {
      if (dbCrgRaw[j][0].toString().toUpperCase() === upperResi) return false;
    }
    return true;
  },

  saveTransaction: function(jenisLayanan, data) {`;

code = code.replace(regex2, updates2);

// replace validateTransaction call to this.validateTransaction
code = code.replace(/!validateTransaction\(resiId, dbExpRaw, dbCrgRaw\)/g, '!this.validateTransaction(resiId, dbExpRaw, dbCrgRaw)');

fs.writeFileSync('Code.gs', code);
