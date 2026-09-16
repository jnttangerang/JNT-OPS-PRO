const fs = require('fs');
let code = fs.readFileSync('src/components/admin/LengkapiYoYiPage.tsx', 'utf8');

code = code.replace(
  /if \(false\) \{\s*admin_id: session\.role === "ADMIN" \? session\.user_id : undefined,\s*outlet_id: session\.active_outlet_id\s*\};\)/g,
  ''
);

// I'll just rewrite the fetchSummary and fetchTransactions functions entirely.
code = code.replace(/const fetchSummary = async \(\) => \{[\s\S]*?\}\s*catch \(e\) \{/m, 
`const fetchSummary = async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      if (session.role === "ADMIN") qs.append("admin_id", session.user_id);
      if (session.active_outlet_id) qs.append("outlet_id", session.active_outlet_id);
      
      const resData = await fetch('/api/yoyi/summary?' + qs.toString());
      const res = await resData.json();
      
      if (res && res.status === 'success') {
        setSummary(res.data);
      }
    } catch (e) {`
);

code = code.replace(/const fetchTransactions = async \(\) => \{[\s\S]*?\}\s*catch \(e\) \{/m, 
`const fetchTransactions = async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      qs.append("tanggal", tanggal);
      if (session.role === "ADMIN") qs.append("admin_id", session.user_id);
      if (session.active_outlet_id) qs.append("outlet_id", session.active_outlet_id);

      const resData = await fetch('/api/yoyi/transactions?' + qs.toString());
      const res = await resData.json();

      if (res && res.status === 'success') {
        setTransactions(res.data);
      }
    } catch (e) {`
);

fs.writeFileSync('src/components/admin/LengkapiYoYiPage.tsx', code);
console.log("Fixed syntax");
