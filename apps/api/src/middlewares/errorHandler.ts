import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { ZodError } from 'zod';

export function errorHandlerMiddleware(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, 400, 'VALIDATION_ERROR', 'Dados de entrada invalidos.', details);
    return;
  }

  const statusCode = (err as { statusCode?: number }).statusCode || 500;
  const code = (err as { code?: string }).code || 'INTERNAL_SERVER_ERROR';
  const message = err instanceof Error ? err.message : 'Erro interno do servidor';

  sendError(res, statusCode, code, message);
}
