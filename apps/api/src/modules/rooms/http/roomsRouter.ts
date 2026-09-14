import { Router, Request, Response, NextFunction } from 'express';
import { createRoomSchema } from '@smart-campus/validation';
import { authenticate, authorize } from '../../../middlewares/auth';
import { sendSuccess } from '../../../utils/response';
import * as roomsService from '../application/roomsService';

const router = Router();

/**
 * GET /api/v1/rooms
 * Consulta publica para utilizadores autenticados.
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await roomsService.listAll();
    sendSuccess(res, list, 200, list.length);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/rooms/:id
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const room = await roomsService.findById(req.params.id);
    sendSuccess(res, room, 200);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/rooms
 * Roles: ADMIN, COORDINATOR, TECHNICIAN
 */
router.post('/', authenticate, authorize(['ADMIN', 'COORDINATOR', 'TECHNICIAN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createRoomSchema.parse(req.body);
    const room = await roomsService.create({
      input,
      actorId: req.user!.id,
      correlationId: req.correlationId,
    });
    sendSuccess(res, room, 201);
  } catch (error) {
    next(error);
  }
});

export default router;
