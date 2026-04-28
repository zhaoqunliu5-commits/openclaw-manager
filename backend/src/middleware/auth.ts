import { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.API_KEY || '';

  if (!apiKey) {
    next();
    return;
  }

  if (req.path === '/health' || req.path.startsWith('/api/notifications/stream')) {
    next();
    return;
  }

  const key = req.headers['x-api-key'] as string || req.query.apiKey as string;

  if (!key) {
    res.status(401).json({ error: 'API key required', message: 'Provide x-api-key header or apiKey query parameter' });
    return;
  }

  if (key !== apiKey) {
    res.status(403).json({ error: 'Invalid API key' });
    return;
  }

  next();
}
