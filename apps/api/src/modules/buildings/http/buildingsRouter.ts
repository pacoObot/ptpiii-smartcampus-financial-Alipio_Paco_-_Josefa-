import { Router, Request, Response, NextFunction } from 'express';
import { createBuildingSchema } from '@smart-campus/validation';
import { authenticate, authorize } from '../../../middlewares/auth';
import { sendSuccess } from '../../../utils/response';
import * as buildingsService from '../application/buildingsService';

const router = Router();

/**
 * GET /api/v1/buildings
 * Todos os utilizadores autenticados podem consultar edificios.
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await buildingsService.listAll();
    sendSuccess(res, list, 200, list.length);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/buildings/:id
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const building = await buildingsService.findById(req.params.id);
    sendSuccess(res, building, 200);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/buildings
 * Roles permitidas: COORDINATOR, ADMIN
 */
router.post('/', authenticate, authorize(['COORDINATOR', 'ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createBuildingSchema.parse(req.body);
    const building = await buildingsService.create({
      input,
      actorId: req.user!.id,
      correlationId: req.correlationId,
    });
    sendSuccess(res, building, 201);
  } catch (error) {
    next(error);
  }
});

export default router;
