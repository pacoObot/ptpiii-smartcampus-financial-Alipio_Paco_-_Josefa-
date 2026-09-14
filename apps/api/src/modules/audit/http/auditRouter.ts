import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../../middlewares/auth';
import { sendSuccess } from '../../../utils/response';
import * as auditService from '../application/auditService';

const router = Router();

/**
 * GET /api/v1/audit-events
 * Roles: ADMIN, COORDINATOR
 * Consulta de eventos de auditoria registrados no sistema.
 */
router.get('/', authenticate, authorize(['ADMIN', 'COORDINATOR']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const events = await auditService.listAll();
    sendSuccess(res, events, 200, events.length);
  } catch (error) {
    next(error);
  }
});

export default router;
