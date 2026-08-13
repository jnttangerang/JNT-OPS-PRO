import serverMod from '../dist/server.cjs';

const app = serverMod.default || serverMod;

// Disable Vercel's default body parser so Express can handle it
export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req: any, res: any) {
  if (req.url.startsWith('/api/uploads/')) {
    req.url = req.url.replace('/api/uploads/', '/uploads/');
  } else if (!req.url.startsWith('/api/') && !req.url.startsWith('/uploads/')) {
    req.url = `/api${req.url === '/' ? '' : req.url}`;
  }
  
  return app(req, res);
}
