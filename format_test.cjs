const fs = require('fs');
let code = fs.readFileSync('Code.js', 'utf8');

// Try to parse using esprima or just use prettier or simply look at the file.
// Since we don't have esprima, let's write a simple indenter to find where it breaks.
let open = 0;
let lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
  let l = lines[i];
  for (let c of l) {
    if (c === '{') open++;
    if (c === '}') open--;
  }
  if (open < 0) {
    console.log("Negative open braces at line " + (i + 1));
    break;
  }
}
console.log("Final open braces:", open);
if (open > 0) {
  // Let's print the last 50 lines to see if a function wasn't closed.
  // Actually, we can just print the names of functions and their brace count.
  let counts = {};
  let currentFunc = null;
  let currentFuncOpen = 0;
  for (let i = 0; i < lines.length; i++) {
     let m = lines[i].match(/function\s+(\w+)\s*\(/);
     if (m) {
        if (currentFunc) {
           // console.log(currentFunc, currentFuncOpen);
        }
        currentFunc = m[1];
        currentFuncOpen = 0;
     }
     for (let c of lines[i]) {
       if (c === '{') currentFuncOpen++;
       if (c === '}') currentFuncOpen--;
     }
     if (currentFunc && currentFuncOpen === 0 && currentFunc) {
         currentFunc = null;
     }
  }
  if (currentFunc) {
      console.log("Unclosed function:", currentFunc);
  }
}
