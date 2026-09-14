import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../../middlewares/auth';
import { sendSuccess } from '../../../utils/response';
import * as dashboardService from '../application/dashboardService';

const router = Router();

/**
 * GET /api/v1/dashboard
 * Resumo operacional do campus para todos os utilizadores autenticados.
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await dashboardService.getSummary();
    sendSuccess(res, summary, 200);
  } catch (error) {
    next(error);
  }
});

export default router;
