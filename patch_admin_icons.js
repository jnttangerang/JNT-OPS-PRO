import fs from 'fs';
let code = fs.readFileSync('src/components/admin/AdminDashboardPage.tsx', 'utf-8');

code = code.replace(
  'RefreshCw, TrendingUp, DollarSign, Wallet, Users, AlertCircle, XCircle',
  'RefreshCw, TrendingUp, DollarSign, Wallet, Users, AlertCircle, XCircle, ListCollapse'
);
fs.writeFileSync('src/components/admin/AdminDashboardPage.tsx', code);
