import { Request, Response, NextFunction } from 'express';

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 5000) {
      console.warn(`[SLOW] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
}

export function globalErrorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const status = (err as { status?: number; statusCode?: number }).status || (err as { status?: number; statusCode?: number }).statusCode || 500;
  const message = status === 500 ? 'Internal server error' : getErrorMessage(err);

  if (status === 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(status).json({
    error: message,
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: (err as Error).stack }),
  });
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
