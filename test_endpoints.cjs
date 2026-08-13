process.env.VERCEL = "1";
const app = require("./dist/server.cjs");
const http = require('http');

const server = http.createServer(app.default || app);
server.listen(3001, async () => {
  try {
    console.log("Fetching /api/getAuditTrail");
    const res = await fetch("http://localhost:3001/api/getAuditTrail", { method: "POST" });
    console.log("Status:", res.status);
    console.log("Body:", await res.text());
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
});
