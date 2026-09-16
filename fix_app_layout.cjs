const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(
  /<Layout session={session} onLogout={handleLogout}>\s*<LengkapiYoYiPage session={session} outlets={outlets} \/>\s*<\/Layout>/,
  '<LengkapiYoYiPage session={session} outlets={outlets} />'
);
fs.writeFileSync('src/App.tsx', code);
