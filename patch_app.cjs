const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('LengkapiYoYiPage')) {
  code = code.replace(
    'import UlasanMapsPage from "./components/UlasanMapsPage";',
    'import UlasanMapsPage from "./components/UlasanMapsPage";\nimport LengkapiYoYiPage from "./components/admin/LengkapiYoYiPage";'
  );
  
  code = code.replace(
    '<Route path="/riwayat-transaksi" element={',
    '<Route path="/lengkapi-yoyi" element={\n                <Layout session={session} onLogout={handleLogout}>\n                  <LengkapiYoYiPage session={session} outlets={outlets} />\n                </Layout>\n              } />\n              <Route path="/riwayat-transaksi" element={'
  );
  
  fs.writeFileSync('src/App.tsx', code);
  console.log("Patched App.tsx successfully");
} else {
  console.log("Already patched App.tsx");
}
