const fs = require('fs');
let code = fs.readFileSync('Code.js', 'utf8');

let stack = [];
for (let i = 0; i < code.length; i++) {
  if (code[i] === '{') {
     let context = code.substring(Math.max(0, i - 40), i).replace(/\n/g, ' ');
     stack.push(context);
  }
  if (code[i] === '}') {
     stack.pop();
  }
}
console.log("Unclosed blocks:");
stack.forEach(s => console.log(s));
