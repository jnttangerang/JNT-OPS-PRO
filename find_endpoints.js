import fs from 'fs';
const code = fs.readFileSync('server.ts', 'utf-8');

const adminIdx = code.indexOf('app.post("/api/getAdminDashboardData"');
const ownerIdx = code.indexOf('app.post("/api/getDashboardData"');

console.log('Admin index:', adminIdx);
console.log('Owner index:', ownerIdx);
