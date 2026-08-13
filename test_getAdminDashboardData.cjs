process.env.VERCEL = "1";
const app = require('./dist/server.cjs');
const http = require('http');

const server = http.createServer(app.default || app);
server.listen(3001, async () => {
  try {
    const res = await fetch("http://localhost:3001/api/getAdminDashboardData", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: "admin1", role: "ADMIN", filterOutlet: "", dateStart: "2026-08-13", dateEnd: "2026-08-13" })
    });
    console.log("Status:", res.status);
    console.log("Body:", await res.text());
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
});
