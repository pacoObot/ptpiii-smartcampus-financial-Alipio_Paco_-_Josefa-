import { Router, Request, Response, NextFunction } from 'express';
import { createIncidentSchema, updateIncidentStatusSchema } from '@smart-campus/validation';
import { authenticate, authorize } from '../../../middlewares/auth';
import { sendSuccess } from '../../../utils/response';
import * as incidentsService from '../application/incidentsService';

const router = Router();

/**
 * GET /api/v1/incidents
 * Consulta de ocorrencias por utilizadores autenticados.
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await incidentsService.listAll();
    sendSuccess(res, list, 200, list.length);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/incidents/:id
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const incident = await incidentsService.findById(req.params.id);
    sendSuccess(res, incident, 200);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/incidents
 * Qualquer utilizador autenticado pode registar uma ocorrencia.
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createIncidentSchema.parse(req.body);
    const incident = await incidentsService.create({
      input,
      actorId: req.user!.id,
      correlationId: req.correlationId,
    });
    sendSuccess(res, incident, 201);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/incidents/:id/status
 * Roles: TECHNICIAN, COORDINATOR, ADMIN
 * Alterar o estado de uma ocorrencia (ex: OPEN -> IN_PROGRESS -> RESOLVED).
 */
router.patch('/:id/status', authenticate, authorize(['TECHNICIAN', 'COORDINATOR', 'ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateIncidentStatusSchema.parse(req.body);
    const updated = await incidentsService.updateStatus({
      id: req.params.id,
      input,
      actorId: req.user!.id,
      correlationId: req.correlationId,
    });
    sendSuccess(res, updated, 200);
  } catch (error) {
    next(error);
  }
});

export default router;
