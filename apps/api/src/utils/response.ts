import { Response } from 'express';
import { ApiSuccess } from '@smart-campus/shared-types';

/**
 * Envia resposta de sucesso no formato padrao do Smart Campus Core.
 * Formato: { data: T, meta: { correlationId, timestamp, totalCount? } }
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  totalCount?: number
): Response {
  const correlationId = res.req.correlationId || (res.req.headers['x-correlation-id'] as string) || 'N/A';
  const payload: ApiSuccess<T> = {
    data,
    meta: {
      correlationId,
      timestamp: new Date().toISOString(),
      ...(totalCount !== undefined ? { totalCount } : {}),
    },
  };
  return res.status(statusCode).json(payload);
}

/**
 * Envia resposta de erro no formato padrao do Smart Campus Core.
 * Formato FLAT (sem wrapper "error"): { code, message, details?, correlationId }
 */
export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: Array<{ path: string; message: string }>
): Response {
  const correlationId = res.req.correlationId || (res.req.headers['x-correlation-id'] as string) || 'N/A';
  return res.status(statusCode).json({
    code,
    message,
    ...(details ? { details } : {}),
    correlationId,
  });
}
