// http/financialRouter.ts
// Camada HTTP: rotas Express do modulo financeiro
// Cada rota: 1) autentica, 2) autoriza, 3) valida com Zod, 4) chama o service

import { Router, Request, Response, NextFunction } from 'express';
import {
  createDebtSchema,
  createPaymentSchema,
  createAnalysisRequestSchema,
  resolveAnalysisRequestSchema,
  updateFinancialPolicySchema,
} from '@smart-campus/validation';
import { authenticate, authorize } from '../../../middlewares/auth';
import { sendSuccess, sendError } from '../../../utils/response';
import * as financialService from '../application/financialService';

const router = Router();

// =============================================================================
// DEBTS — Dividas
// Exercicio 3: create + list/get com validacao Zod
// =============================================================================

/**
 * GET /api/v1/financial/debts
 * Lista todas as dividas. FINANCE e ADMIN veem tudo; STUDENT ve apenas as suas.
 */
router.get('/debts', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.user!.role === 'STUDENT' ? req.user!.id : (req.query.studentId as string | undefined);
    const debts = await financialService.listDebts(studentId);
    sendSuccess(res, debts, 200, debts.length);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/financial/debts/:id
 * Consultar uma divida especifica por ID.
 */
router.get('/debts/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const debt = await financialService.getDebtById(req.params.id);
    sendSuccess(res, debt, 200);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/financial/debts
 * Registar nova divida. Apenas FINANCE e ADMIN (INV-3).
 * Validacao Zod rejeita campos em falta com erro 400 estruturado (Exercicio 3).
 */
router.post('/debts', authenticate, authorize(['FINANCE', 'ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Zod valida o body — se falhar, lanca ZodError que o errorHandler converte em 400
    const input = createDebtSchema.parse(req.body);
    const debt = await financialService.createDebt(input, req.user!.id, req.correlationId);
    sendSuccess(res, debt, 201);
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// PAYMENTS — Pagamentos
// Exercicio 5: Transaccao ACID dentro do service
// =============================================================================

/**
 * POST /api/v1/financial/payments
 * Confirmar pagamento e regularizar divida (transaccao atomica). Apenas FINANCE e ADMIN.
 */
router.post('/payments', authenticate, authorize(['FINANCE', 'ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createPaymentSchema.parse(req.body);
    const resultado = await financialService.createPayment(input, req.user!.id, req.correlationId);
    sendSuccess(res, resultado, 201);
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// FINANCIAL STATUS — Estado Financeiro do Estudante
// =============================================================================

/**
 * GET /api/v1/financial/students/:studentId/status
 * Consultar estado financeiro de um estudante (ponto de integracao inter-modulos).
 * STUDENT so ve o proprio; FINANCE, ADMIN e modulos internos veem qualquer um.
 */
router.get('/students/:studentId/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;

    // INV-5: STUDENT so pode ver o seu proprio estado
    if (req.user!.role === 'STUDENT' && req.user!.id !== studentId) {
      sendError(res, 403, 'FORBIDDEN', 'Nao pode consultar o estado financeiro de outro estudante.');
      return;
    }

    const status = await financialService.getStudentStatus(studentId);
    sendSuccess(res, status, 200);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/financial/students/:studentId/history
 * Historico completo de dividas e pagamentos do estudante.
 */
router.get('/students/:studentId/history', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;

    if (req.user!.role === 'STUDENT' && req.user!.id !== studentId) {
      sendError(res, 403, 'FORBIDDEN', 'Nao pode consultar o historico financeiro de outro estudante.');
      return;
    }

    const history = await financialService.getStudentHistory(studentId);
    sendSuccess(res, history, 200);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/financial/students/:studentId/notifications
 * Notificacoes financeiras do estudante.
 */
router.get('/students/:studentId/notifications', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;

    if (req.user!.role === 'STUDENT' && req.user!.id !== studentId) {
      sendError(res, 403, 'FORBIDDEN', 'Nao pode consultar as notificacoes de outro estudante.');
      return;
    }

    const notifications = await financialService.getStudentNotifications(studentId);
    sendSuccess(res, notifications, 200, notifications.length);
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// ANALYSIS REQUESTS — Pedidos de Analise / Contestacoes
// Exercicio 4: PATCH com regra de negocio (nao pode resolver o que ja foi decidido)
// =============================================================================

/**
 * POST /api/v1/financial/analysis-requests
 * Submeter contestacao de divida. Apenas STUDENT (INV-5).
 */
router.post('/analysis-requests', authenticate, authorize(['STUDENT']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createAnalysisRequestSchema.parse(req.body);
    const ar = await financialService.createAnalysisRequest(input, req.user!.id, req.correlationId);
    sendSuccess(res, ar, 201);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/financial/analysis-requests/:id
 * Resolver contestacao: PROCEDENTE ou IMPROCEDENTE. Apenas FINANCE e ADMIN (INV-3).
 * Exercicio 4: regra de negocio — nao pode resolver uma contestacao ja decidida.
 */
router.patch('/analysis-requests/:id', authenticate, authorize(['FINANCE', 'ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = resolveAnalysisRequestSchema.parse(req.body);
    const ar = await financialService.resolveAnalysisRequest(req.params.id, input, req.user!.id, req.correlationId);
    sendSuccess(res, ar, 200);
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// REPORTS — Relatorio Financeiro
// =============================================================================

/**
 * GET /api/v1/financial/reports
 * Relatorio agregado de dividas e pendencias. Apenas FINANCE e ADMIN.
 */
router.get('/reports', authenticate, authorize(['FINANCE', 'ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await financialService.getReport();
    sendSuccess(res, report, 200);
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// POLICIES — Politica Financeira
// Exercicio 4: GET e PATCH com regra de acesso (apenas ADMIN)
// =============================================================================

/**
 * GET /api/v1/financial/policies/:policyId
 * Consultar politica financeira activa.
 */
router.get('/policies/:policyId', authenticate, authorize(['ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const policy = await financialService.getPolicy(req.params.policyId);
    sendSuccess(res, policy, 200);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/financial/policies/:policyId
 * Actualizar politica de bloqueio e tolerancia. Apenas ADMIN.
 */
router.patch('/policies/:policyId', authenticate, authorize(['ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateFinancialPolicySchema.parse(req.body);
    const policy = await financialService.updatePolicy(req.params.policyId, input, req.user!.id, req.correlationId);
    sendSuccess(res, policy, 200);
  } catch (error) {
    next(error);
  }
});

export default router;
