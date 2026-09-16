const fs = require('fs');

let code = fs.readFileSync('src/components/admin/LengkapiYoYiPage.tsx', 'utf8');

// The error is because YoYiInlineRow is not declared as a React Functional Component with a key prop natively.
// We can fix this by typing it as React.FC or by adding key? to its interface.
code = code.replace(
  "function YoYiInlineRow({ tx, onUpdate }: { tx: any, onUpdate: () => void }) {",
  "function YoYiInlineRow({ tx, onUpdate }: { key?: string | number, tx: any, onUpdate: () => void }) {"
);

fs.writeFileSync('src/components/admin/LengkapiYoYiPage.tsx', code);
console.log("Fixed key interface");
