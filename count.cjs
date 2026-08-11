const fs = require('fs');
const code = fs.readFileSync('Code.js', 'utf8');

let openBraces = 0;
let openParens = 0;
let openBrackets = 0;

for(let i=0; i<code.length; i++) {
  if (code[i] === '{') openBraces++;
  if (code[i] === '}') openBraces--;
  if (code[i] === '(') openParens++;
  if (code[i] === ')') openParens--;
  if (code[i] === '[') openBrackets++;
  if (code[i] === ']') openBrackets--;
}

console.log({ openBraces, openParens, openBrackets });
