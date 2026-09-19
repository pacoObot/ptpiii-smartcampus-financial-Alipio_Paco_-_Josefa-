// application/financialService.ts
// Camada de aplicacao: casos de uso do modulo financeiro

import { Prisma } from '@prisma/client';
import { dispatchNotificationSafely } from './notificationDeliveryService';
import { CreateDebtInput, CreatePaymentInput, CreateAnalysisRequestInput, ResolveAnalysisRequestInput, UpdateFinancialPolicyInput } from '@smart-campus/validation';
import {
  generateCode,
  calculateSlaDueDate,
  toDebtDto,
  toPaymentDto,
  toFinancialStatusDto,
  toAnalysisRequestDto,
  toNotificationDto,
  toPolicyDto,
} from '../domain/financial.domain';
import { FinancialStatusSummaryDto, FinancialHistoryDto } from '@smart-campus/shared-types';
import { auditLog } from '../../../utils/audit';
import { prisma } from '../infrastructure/financialRepository';

interface FinancialAuditCommand {
  action: string;
  resourceId: string;
  actorId: string;
  correlationId: string;
  payload?: Record<string, unknown>;
}

async function auditFinancial(command: FinancialAuditCommand): Promise<void> {
  await auditLog({
    action: command.action,
    module: 'financial',
    resourceId: command.resourceId,
    actorId: command.actorId,
    correlationId: command.correlationId,
    payload: command.payload,
  });

  await prisma.auditEvent.create({
    data: {
      action: command.action,
      module: 'financial',
      resourceId: command.resourceId,
      userId: command.actorId,
      correlationId: command.correlationId,
      payload: (command.payload ?? {}) as Prisma.InputJsonValue,
    },
  });
}

// Funcao auxiliar: recalcula e actualiza o estado financeiro do estudante (INV-1, INV-6)
async function recalcularEstado(tx: Prisma.TransactionClient, studentId: string) {
  const dividas_vencidas = await tx.debt.count({
    where: { studentId, status: 'VENCIDA' },
  });

  const novoEstado = dividas_vencidas > 0 ? 'BLOCKED' : 'ACTIVE';

  await tx.financialStatus.upsert({
    where: { studentId },
    create: { studentId, status: novoEstado },
    update: {
      status: novoEstado,
      blockedAt: novoEstado === 'BLOCKED' ? new Date() : null,
      reason: novoEstado === 'BLOCKED'
        ? `Estudante possui ${dividas_vencidas} divida(s) vencida(s)`
        : null,
    },
  });

  return novoEstado;
}

// =============================================================================
// DEBTS — Dividas
// =============================================================================

// Listar todas as dividas (com filtro opcional por studentId)
export async function listDebts(studentId?: string) {
  const debts = await prisma.debt.findMany({
    where: studentId ? { studentId } : undefined,
    orderBy: { createdAt: 'desc' },
  });
  return debts.map(toDebtDto);
}

// Criar nova divida — POST /api/v1/financial/debts
// Exercicio 3: CRUD create com validacao Zod
// Exercicio 7: code e UNIQUE — Prisma rejeita duplicados
export async function createDebt(input: CreateDebtInput, actorId: string, correlationId: string) {
  const student = await prisma.user.findUnique({ where: { id: input.studentId }, select: { id: true } });
  if (!student) {
    throw Object.assign(new Error('Estudante nao encontrado'), {
      statusCode: 404, code: 'STUDENT_NOT_FOUND',
    });
  }

  const code = generateCode('DB');
  const dueDate = new Date(input.dueDate);
  const initialStatus = dueDate < new Date() ? 'VENCIDA' : 'PENDENTE';

  const { debt, notificationId } = await prisma.$transaction(async (tx) => {
    const created = await tx.debt.create({
      data: {
        code,
        studentId: input.studentId,
        title: input.title,
        description: input.description ?? null,
        amount: input.amount,
        origin: input.origin,
        dueDate,
        status: initialStatus,
      },
    });

    // INV-1/INV-6: se a divida ja nasceu vencida, o estudante fica bloqueado imediatamente.
    await recalcularEstado(tx, input.studentId);

    // INV-8: notificar o estudante
    const notification = await tx.financialNotification.create({ data: {
      studentId: input.studentId,
      title: 'Nova Divida Registada',
      message: `Foi emitida uma nova divida "${input.title}" no valor de ${input.amount} MZN, com vencimento em ${dueDate.toLocaleDateString('pt-PT')}.`,
      eventType: 'DEBT_CREATED', resourceId: created.id, correlationId,
    } });

    return { debt: created, notificationId: notification.id };
  });

  await dispatchNotificationSafely(notificationId);

  // INV-4: registar auditoria
  await auditFinancial({
    action: 'DEBT_CREATED',
    resourceId: debt.id,
    actorId,
    correlationId,
    payload: { code, studentId: input.studentId, amount: input.amount, title: input.title },
  });

  return toDebtDto(debt);
}

// Consultar divida por ID
export async function getDebtById(id: string) {
  const debt = await prisma.debt.findUnique({ where: { id } });
  if (!debt) {
    const err = new Error('Divida nao encontrada') as Error & { statusCode: number; code: string };
    err.statusCode = 404;
    err.code = 'DEBT_NOT_FOUND';
    throw err;
  }
  return toDebtDto(debt);
}

// =============================================================================
// PAYMENTS — Pagamentos
// Exercicio 5: Transaccao ACID — pagamento + actualizacao de divida + estado financeiro
// =============================================================================

export async function createPayment(input: CreatePaymentInput, actorId: string, correlationId: string) {
  // Verificar se a divida existe
  const debt = await prisma.debt.findUnique({ where: { id: input.debtId } });
  if (!debt) {
    const err = new Error('Divida nao encontrada') as Error & { statusCode: number; code: string };
    err.statusCode = 404;
    err.code = 'DEBT_NOT_FOUND';
    throw err;
  }

  // Exercicio 4 — Regra de negocio: nao permite pagar uma divida ja regularizada ou cancelada
  if (debt.status === 'REGULARIZADA') {
    const err = new Error('Esta divida ja foi regularizada e nao pode receber novos pagamentos') as Error & { statusCode: number; code: string };
    err.statusCode = 409;
    err.code = 'DEBT_ALREADY_REGULARIZED';
    throw err;
  }

  if (debt.status === 'CANCELADA') {
    const err = new Error('Esta divida foi cancelada e nao pode receber novos pagamentos') as Error & { statusCode: number; code: string };
    err.statusCode = 400;
    err.code = 'DEBT_CANCELLED';
    throw err;
  }

  const debtAmount = debt.amount.toNumber();
  if (Math.round(input.amountPaid * 100) !== Math.round(debtAmount * 100)) {
    const err = new Error(`O pagamento deve liquidar o valor total da divida (${debtAmount} MZN)`) as Error & { statusCode: number; code: string };
    err.statusCode = 400;
    err.code = 'PAYMENT_AMOUNT_MISMATCH';
    throw err;
  }

  const code = generateCode('PAY');

  // Exercicio 5: TRANSACCAO ACID — os 3 passos sao atomicos
  // Se qualquer passo falhar, nenhuma alteracao fica gravada na base de dados
  const resultado = await prisma.$transaction(async (tx) => {
    // Passo 1: Criar o registo de pagamento
    const payment = await tx.payment.create({
      data: {
        code,
        debtId: input.debtId,
        studentId: debt.studentId,
        amountPaid: input.amountPaid,
        paymentMethod: input.paymentMethod,
        referenceCode: input.referenceCode,
        confirmedById: actorId,
      },
    });

    // Passo 2: Actualizar o estado da divida para REGULARIZADA
    await tx.debt.update({
      where: { id: input.debtId },
      data: { status: 'REGULARIZADA' },
    });

    // Passo 3: Recalcular estado financeiro do estudante (INV-6)
    const novoEstado = await recalcularEstado(tx, debt.studentId);

    // INV-8: Notificar o estudante sobre o pagamento
    const notification = await tx.financialNotification.create({
      data: {
        eventType: 'PAYMENT_CONFIRMED', resourceId: payment.id, correlationId,
        studentId: debt.studentId,
        title: 'Pagamento Confirmado',
        message: `O seu pagamento de ${input.amountPaid} MZN para a divida "${debt.title}" foi confirmado. Estado financeiro: ${novoEstado}.`,
      },
    });

    return { payment, novoEstado, notificationId: notification.id };
  });

  await dispatchNotificationSafely(resultado.notificationId);

  // INV-4: Auditoria (fora da transaccao — nao e critica para a consistencia)
  await auditFinancial({
    action: 'PAYMENT_CREATED',
    resourceId: resultado.payment.id,
    actorId,
    correlationId,
    payload: { code, debtId: input.debtId, amountPaid: input.amountPaid, novoEstado: resultado.novoEstado },
  });

  return {
    payment: toPaymentDto(resultado.payment),
    debtStatus: 'REGULARIZADA',
    studentFinancialStatus: resultado.novoEstado,
  };
}

// =============================================================================
// FINANCIAL STATUS — Estado Financeiro do Estudante
// =============================================================================

export async function getStudentStatus(studentId: string): Promise<FinancialStatusSummaryDto> {
  const fs = await prisma.financialStatus.findUnique({ where: { studentId } });

  // Calcular dividas vencidas em tempo real (INV-1)
  const dividasVencidas = await prisma.debt.findMany({
    where: { studentId, status: 'VENCIDA' },
  });

  const totalVencido = dividasVencidas.reduce((sum, d) => sum + d.amount.toNumber(), 0);
  const calculatedStatus = dividasVencidas.length > 0 ? 'BLOCKED' : 'ACTIVE';

  return {
    studentId,
    status: calculatedStatus,
    reason: calculatedStatus === 'BLOCKED'
      ? (fs?.reason ?? `Estudante possui ${dividasVencidas.length} divida(s) vencida(s)`)
      : null,
    blockedAt: calculatedStatus === 'BLOCKED' ? (fs?.blockedAt?.toISOString() ?? null) : null,
    overdueDebtsCount: dividasVencidas.length,
    totalOverdueAmount: totalVencido,
    updatedAt: fs?.updatedAt.toISOString() ?? new Date().toISOString(),
  };
}

// =============================================================================
// FINANCIAL HISTORY — Historico Financeiro
// =============================================================================

export async function getStudentHistory(studentId: string): Promise<FinancialHistoryDto> {
  const [debts, payments, status] = await Promise.all([
    prisma.debt.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.payment.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    }),
    getStudentStatus(studentId),
  ]);

  const totalPago = payments.reduce((sum, payment) => sum + payment.amountPaid.toNumber(), 0);

  const totalEmAberto = debts
    .filter(d => d.status === 'PENDENTE' || d.status === 'VENCIDA')
    .reduce((sum, d) => sum + d.amount.toNumber(), 0);

  return {
    studentId,
    debts: debts.map(toDebtDto),
    payments: payments.map(toPaymentDto),
    status,
    totalDebts: debts.length,
    totalPaid: totalPago,
    totalOutstanding: totalEmAberto,
  };
}

// =============================================================================
// ANALYSIS REQUESTS — Pedidos de Analise / Contestacao
// =============================================================================

export async function createAnalysisRequest(input: CreateAnalysisRequestInput, studentId: string, correlationId: string) {
  // Verificar se a divida existe e pertence ao estudante
  const debt = await prisma.debt.findUnique({ where: { id: input.debtId } });
  if (!debt) {
    const err = new Error('Divida nao encontrada') as Error & { statusCode: number; code: string };
    err.statusCode = 404;
    err.code = 'DEBT_NOT_FOUND';
    throw err;
  }

  // INV-5: Estudante so pode contestar as suas proprias dividas
  if (debt.studentId !== studentId) {
    const err = new Error('Nao pode contestar uma divida de outro estudante') as Error & { statusCode: number; code: string };
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  if (debt.status === 'REGULARIZADA') {
    const err = new Error('Esta divida ja se encontra regularizada e nao pode ser contestada') as Error & { statusCode: number; code: string };
    err.statusCode = 409;
    err.code = 'DEBT_ALREADY_REGULARIZED';
    throw err;
  }

  // Verificar se ja existe contestacao pendente (qualidade de dados)
  const contestacaoPendente = await prisma.analysisRequest.findFirst({
    where: { debtId: input.debtId, status: 'PENDENTE_ANALISE' },
  });
  if (contestacaoPendente) {
    const err = new Error('Ja existe um pedido de analise pendente para esta divida') as Error & { statusCode: number; code: string };
    err.statusCode = 409;
    err.code = 'ANALYSIS_REQUEST_ALREADY_OPEN';
    throw err;
  }

  const code = generateCode('AR');

  const ar = await prisma.analysisRequest.create({
    data: {
      code,
      debtId: input.debtId,
      studentId,
      reason: input.reason,
      status: 'PENDENTE_ANALISE',
      slaDueDate: calculateSlaDueDate(5),
    },
  });

  await auditFinancial({
    action: 'ANALYSIS_REQUEST_CREATED',
    resourceId: ar.id,
    actorId: studentId,
    correlationId,
    payload: { code, debtId: input.debtId },
  });

  return toAnalysisRequestDto(ar);
}

// Exercicio 4: Update com regra de negocio — resolver contestacao
// Regra: so pode resolver contestacoes no estado PENDENTE_ANALISE
export async function resolveAnalysisRequest(id: string, input: ResolveAnalysisRequestInput, actorId: string, correlationId: string) {
  const ar = await prisma.analysisRequest.findUnique({ where: { id } });
  if (!ar) {
    const err = new Error('Pedido de analise nao encontrado') as Error & { statusCode: number; code: string };
    err.statusCode = 404;
    err.code = 'ANALYSIS_REQUEST_NOT_FOUND';
    throw err;
  }

  // Regra de negocio: nao pode resolver o que ja foi decidido
  if (ar.status !== 'PENDENTE_ANALISE') {
    const err = new Error('Este pedido de analise ja foi resolvido e nao pode ser alterado') as Error & { statusCode: number; code: string };
    err.statusCode = 409;
    err.code = 'ANALYSIS_REQUEST_ALREADY_RESOLVED';
    throw err;
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const updated = await tx.analysisRequest.update({
      where: { id },
      data: {
        status: input.decision,
        resolvedById: actorId,
        resolvedAt: new Date(),
        resolutionNotes: input.resolutionNotes,
      },
    });

    // Se procedente: regularizar a divida e recalcular estado (INV-6)
    if (input.decision === 'PROCEDENTE') {
      await tx.debt.update({
        where: { id: ar.debtId },
        data: { status: 'REGULARIZADA' },
      });
      await recalcularEstado(tx, ar.studentId);
    }

    // INV-8: Notificar o estudante
    const notification = await tx.financialNotification.create({
      data: {
        eventType: 'ANALYSIS_REQUEST_RESOLVED', resourceId: ar.id, correlationId,
        studentId: ar.studentId,
        title: 'Decisao da sua Contestacao',
        message: `O seu pedido de analise ${ar.code} foi julgado ${input.decision}. ${input.resolutionNotes}`,
      },
    });

    return { updated, notificationId: notification.id };
  });

  await dispatchNotificationSafely(resultado.notificationId);

  await auditFinancial({
    action: 'ANALYSIS_REQUEST_RESOLVED',
    resourceId: id,
    actorId,
    correlationId,
    payload: { decision: input.decision, debtId: ar.debtId },
  });

  return toAnalysisRequestDto(resultado.updated);
}

// =============================================================================
// NOTIFICATIONS — Notificacoes Financeiras
// =============================================================================

export async function getStudentNotifications(studentId: string) {
  const notifications = await prisma.financialNotification.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  return notifications.map(toNotificationDto);
}

// =============================================================================
// POLICIES — Politica Financeira
// =============================================================================

export async function getPolicy(policyId: string) {
  const policy = await prisma.financialPolicy.findUnique({ where: { code: policyId } });
  if (!policy) {
    // Criar politica padrao se nao existir
    const defaultPolicy = await prisma.financialPolicy.create({
      data: { code: policyId },
    });
    return toPolicyDto(defaultPolicy);
  }
  return toPolicyDto(policy);
}

// Exercicio 4: Update da politica — so ADMIN pode actualizar
export async function updatePolicy(policyId: string, input: UpdateFinancialPolicyInput, actorId: string, correlationId: string) {
  const policy = await prisma.financialPolicy.upsert({
    where: { code: policyId },
    create: {
      code: policyId,
      gracePeriodDays: input.gracePeriodDays,
      autoBlockEnabled: input.autoBlockEnabled,
      maxDebtAmount: input.maxDebtAmount,
    },
    update: {
      gracePeriodDays: input.gracePeriodDays,
      autoBlockEnabled: input.autoBlockEnabled,
      maxDebtAmount: input.maxDebtAmount,
    },
  });

  await auditFinancial({
    action: 'POLICY_UPDATED',
    resourceId: policy.id,
    actorId,
    correlationId,
    payload: { gracePeriodDays: input.gracePeriodDays, autoBlockEnabled: input.autoBlockEnabled },
  });

  return toPolicyDto(policy);
}

// =============================================================================
// REPORTS — Relatorio Financeiro
// =============================================================================

export async function getReport() {
  const [totalDebts, pendentes, vencidas, regularizadas, canceladas] = await Promise.all([
    prisma.debt.count(),
    prisma.debt.count({ where: { status: 'PENDENTE' } }),
    prisma.debt.count({ where: { status: 'VENCIDA' } }),
    prisma.debt.count({ where: { status: 'REGULARIZADA' } }),
    prisma.debt.count({ where: { status: 'CANCELADA' } }),
  ]);

  const totalPayments = await prisma.payment.count();
  const blocked = await prisma.financialStatus.count({ where: { status: 'BLOCKED' } });

  return {
    totalDebts,
    byStatus: { pendentes, vencidas, regularizadas, canceladas },
    totalPayments,
    studentsBlocked: blocked,
    generatedAt: new Date().toISOString(),
  };
}
