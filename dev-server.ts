import app from "./server.ts";
import { createServer as createViteServer } from "vite";

async function startDevServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });

  // Ensure unhandled API requests never fall through to Vite SPA index.html
  app.use("/api", (req, res) => {
    res.status(404).json({
      status: "error",
      message: `API endpoint '${req.originalUrl}' tidak ditemukan.`
    });
  });

  app.use(vite.middlewares);

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[DEV] Server J&T OPS PRO running on http://localhost:${PORT}`);
  });
}

startDevServer();
