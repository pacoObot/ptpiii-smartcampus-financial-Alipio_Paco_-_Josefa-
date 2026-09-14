import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  let correlationId = req.headers['x-correlation-id'] as string;
  if (!correlationId) {
    correlationId = crypto.randomUUID();
  }
  req.headers['x-correlation-id'] = correlationId;
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
}
