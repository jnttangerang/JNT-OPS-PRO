const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Ensure we don't duplicate import in server.ts
// Just a safety check
