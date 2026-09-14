import { Router, Request, Response, NextFunction } from 'express';
import { createUserSchema } from '@smart-campus/validation';
import { authenticate, authorize } from '../../../middlewares/auth';
import { sendSuccess } from '../../../utils/response';
import * as usersService from '../application/usersService';

const router = Router();

/**
 * GET /api/v1/users
 * Roles: ADMIN, COORDINATOR
 * Lista todos os utilizadores sem passwords.
 */
router.get('/', authenticate, authorize(['ADMIN', 'COORDINATOR']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await usersService.listAll();
    sendSuccess(res, users, 200, users.length);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/users/:id
 * Roles: ADMIN, COORDINATOR
 */
router.get('/:id', authenticate, authorize(['ADMIN', 'COORDINATOR']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await usersService.findById(req.params.id);
    sendSuccess(res, user, 200);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/users
 * Roles: ADMIN
 * Cria um novo utilizador. Invariante: email unico.
 */
router.post('/', authenticate, authorize(['ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createUserSchema.parse(req.body);
    const user = await usersService.create({
      input,
      actorId: req.user!.id,
      correlationId: req.correlationId,
    });
    sendSuccess(res, user, 201);
  } catch (error) {
    next(error);
  }
});

export default router;
