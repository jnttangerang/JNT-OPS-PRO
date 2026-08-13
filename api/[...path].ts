import app from '../server.js';

export default function handler(req: any, res: any) {
  // If Vercel rewrites /uploads/* to /api/uploads/*, we need to strip /api 
  // so Express static middleware matches it correctly.
  if (req.url.startsWith('/api/uploads/')) {
    req.url = req.url.replace('/api/uploads/', '/uploads/');
  } else if (!req.url.startsWith('/api/') && !req.url.startsWith('/uploads/')) {
    req.url = `/api${req.url === '/' ? '' : req.url}`;
  }
  
  return app(req, res);
}