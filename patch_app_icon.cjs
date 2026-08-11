const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'import { Lock, Shield, BarChart3, Bot, Sparkles } from "lucide-react";',
  'import { Lock, Shield, BarChart3, Bot, Sparkles, Activity } from "lucide-react";'
);

fs.writeFileSync('src/App.tsx', code);
