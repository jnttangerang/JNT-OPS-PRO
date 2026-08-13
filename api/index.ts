import serverMod from '../dist/server.cjs';
const app = serverMod.default || serverMod;

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req: any, res: any) {
  // Extract path from Vercel rewrite query
  if (req.query && req.query.reqPath) {
    const p = req.query.reqPath;
    if (p.startsWith('uploads/')) {
      req.url = `/${p}`;
    } else {
      req.url = `/api/${p}`;
    }
  } else {
    // Fallback if Vercel doesn't pass query (e.g. direct /api/index access)
    if (req.url.startsWith('/api/uploads/')) {
      req.url = req.url.replace('/api/uploads/', '/uploads/');
    } else if (!req.url.startsWith('/api/') && !req.url.startsWith('/uploads/')) {
      req.url = `/api${req.url === '/' ? '' : req.url}`;
    }
  }
  
  return app(req, res);
}
