const fs = require('fs');
let code = fs.readFileSync('Code.gs', 'utf8');

// We can't easily run it locally because it requires SpreadsheetApp.
// But we don't need to run it, the instructions say the user will run it, or it will be auto-created when the system runs.
