const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardPage.tsx', 'utf8');

code = code.replace(/dashboardData\.target_harian\.current/g, '(dashboardData?.target_harian?.current || 0)');
code = code.replace(/dashboardData\.target_harian\.target/g, '(dashboardData?.target_harian?.target || 100)');

fs.writeFileSync('src/components/DashboardPage.tsx', code);
