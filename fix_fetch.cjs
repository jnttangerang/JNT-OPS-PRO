const fs = require('fs');

let code = fs.readFileSync('src/components/admin/LengkapiYoYiPage.tsx', 'utf8');

// Fix fetchSummary
code = code.replace(
  "const res = await callBackend('get', '/api/yoyi/summary', {",
  `const qs = new URLSearchParams({
        admin_id: session.role === "ADMIN" ? session.user_id : undefined,
        outlet_id: session.active_outlet_id
      } as any).toString();
      const resData = await fetch('/api/yoyi/summary?' + qs);
      const res = await resData.json();
      if (false) {`
);

// Fix fetchTransactions
code = code.replace(
  "const res = await callBackend('get', '/api/yoyi/transactions', {",
  `const qs = new URLSearchParams({
        tanggal,
        admin_id: session.role === "ADMIN" ? session.user_id : undefined,
        outlet_id: session.active_outlet_id
      } as any).toString();
      const resData = await fetch('/api/yoyi/transactions?' + qs);
      const res = await resData.json();
      if (false) {`
);

// Fix update transaction
code = code.replace(
  `await callBackend("post", "/api/yoyi/update", {`,
  `await fetch("/api/yoyi/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({`
);
code = code.replace(
  `bukti_maps_url: buktiMaps\n      });`,
  `bukti_maps_url: buktiMaps\n      })});`
);

// Fix callBackend createSetoran in InlineSetoranModal
code = code.replace(
  `const res = await callBackend("post", "/api/createSetoran", {`,
  `const res = await callBackend("createSetoran", {`
);

// Fix file upload
code = code.replace(
  `const res = await callBackend("post", "/api/upload", formData, { headers: { 'Content-Type': 'multipart/form-data' }});`,
  `const res = await uploadFile(file, "bukti_yoyi_" + Date.now());`
);

// Second upload replace for InlineSetoranModal
code = code.replace(
  `const res = await callBackend("post", "/api/upload", formData, { headers: { 'Content-Type': 'multipart/form-data' }});`,
  `const res = await uploadFile(file, "bukti_setoran_" + Date.now());`
);

fs.writeFileSync('src/components/admin/LengkapiYoYiPage.tsx', code);
console.log("Fixed fetch calls");
