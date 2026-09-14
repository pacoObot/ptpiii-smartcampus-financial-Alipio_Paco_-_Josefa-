import { Router, Request, Response, NextFunction } from 'express';
import {
  createMaintenanceRequestSchema,
  updateMaintenanceStatusSchema,
  addMaintenanceNoteSchema,
  filterMaintenanceQuerySchema,
} from '@smart-campus/validation';
import { authenticate, authorize } from '../../../middlewares/auth';
import { sendSuccess } from '../../../utils/response';
import * as maintenanceService from '../application/maintenanceService';

const router = Router();

/**
 * GET /api/v1/maintenance/stats
 * Resumo estatistico de pedidos por estado e prioridade.
 */
router.get('/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await maintenanceService.getStats();
    sendSuccess(res, stats, 200);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/maintenance
 * Lista todos os pedidos de manutencao com suporte a filtros.
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = filterMaintenanceQuerySchema.parse(req.query);
    const list = await maintenanceService.listRequests(filter);
    sendSuccess(res, list, 200, list.length);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/maintenance/:id
 * Consulta detalhada de um pedido especifico (por ID ou codigo MN-2026-001).
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request = await maintenanceService.getRequestById(req.params.id);
    sendSuccess(res, request, 200);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/maintenance
 * Registar novo pedido de manutencao/ocorrencia.
 * Qualquer utilizador autenticado pode reportar uma avaria.
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createMaintenanceRequestSchema.parse(req.body);
    const created = await maintenanceService.createRequest({
      input,
      actorId: req.user!.id,
      correlationId: req.correlationId,
    });
    sendSuccess(res, created, 201);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/maintenance/:id/status
 * Alterar estado do pedido e/ou atribuir tecnico.
 * Roles: TECHNICIAN, COORDINATOR, ADMIN
 */
router.patch('/:id/status', authenticate, authorize(['TECHNICIAN', 'COORDINATOR', 'ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateMaintenanceStatusSchema.parse(req.body);
    const updated = await maintenanceService.updateStatus({
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

/**
 * POST /api/v1/maintenance/:id/notes
 * Registar nota tecnica de intervencao.
 * Roles: TECHNICIAN, COORDINATOR, ADMIN
 */
router.post('/:id/notes', authenticate, authorize(['TECHNICIAN', 'COORDINATOR', 'ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = addMaintenanceNoteSchema.parse(req.body);
    const note = await maintenanceService.addNote({
      requestId: req.params.id,
      input,
      actorId: req.user!.id,
      correlationId: req.correlationId,
    });
    sendSuccess(res, note, 201);
  } catch (error) {
    next(error);
  }
});

export default router;
