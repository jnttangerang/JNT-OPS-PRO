const fs = require("fs");
const code = fs.readFileSync("src/components/owner/DailyClosingPage.tsx", "utf8");

let braces = 0;
let parens = 0;
let lastLine = 0;

const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{') braces++;
    if (line[j] === '}') braces--;
    if (line[j] === '(') parens++;
    if (line[j] === ')') parens--;
  }
}
console.log({ braces, parens });
