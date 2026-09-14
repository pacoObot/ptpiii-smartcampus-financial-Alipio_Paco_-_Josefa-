import { Router, Request, Response, NextFunction } from 'express';
import { loginSchema, refreshTokenSchema } from '@smart-campus/validation';
import { authenticate } from '../../../middlewares/auth';
import { sendSuccess, sendError } from '../../../utils/response';
import * as authService from '../application/authService';

const router = Router();

/**
 * POST /api/v1/auth/login
 * Nao requer autenticacao.
 * Devolve: { data: { user, tokens: { accessToken, refreshToken } } }
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login({ ...input, correlationId: req.correlationId });
    sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/refresh
 * Nao requer autenticacao.
 * Devolve: { data: { tokens: { accessToken, refreshToken } } }
 */
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = refreshTokenSchema.parse(req.body);
    const tokens = await authService.refresh({ refreshToken: input.refreshToken, correlationId: req.correlationId });
    sendSuccess(res, { tokens }, 200);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/logout
 * Requer autenticacao.
 * Revoga o refresh token fornecido.
 */
router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      sendError(res, 400, 'VALIDATION_ERROR', 'O campo refreshToken e obrigatorio.');
      return;
    }
    await authService.logout({
      actorId: req.user!.id,
      refreshToken,
      correlationId: req.correlationId,
    });
    sendSuccess(res, { message: 'Sessao terminada com sucesso.' }, 200);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/me
 * Requer autenticacao.
 * Devolve o perfil do utilizador autenticado.
 */
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getMe({ actorId: req.user!.id });
    sendSuccess(res, user, 200);
  } catch (error) {
    next(error);
  }
});

export default router;
