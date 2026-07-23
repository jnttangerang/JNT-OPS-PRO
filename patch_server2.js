import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

const targetStr = `      targetHarian: {
        target: targetHarian,
        current: currentResiToday
      }
    }
  });`;
  
const replacementStr = `      targetHarian: {
        target: targetHarian,
        current: currentResiToday
      },
      recentTransactions: filtered.sort((a:any, b:any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10)
    }
  });`;

code = code.replace(targetStr, replacementStr);
fs.writeFileSync('server.ts', code);
