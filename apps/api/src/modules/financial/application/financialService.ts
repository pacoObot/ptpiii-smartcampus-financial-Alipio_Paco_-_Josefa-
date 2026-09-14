// application/financialService.ts
// Camada de aplicacao: casos de uso do modulo financeiro
// Usa Prisma para persistencia real em PostgreSQL

import { PrismaClient } from '@prisma/client';
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

const prisma = new PrismaClient();

// Funcao auxiliar: cria uma notificacao interna para o estudante (INV-8)
async function createNotification(tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>, studentId: string, title: string, message: string) {
  await tx.financialNotification.create({
    data: { studentId, title, message },
  });
}

// Funcao auxiliar: recalcula e actualiza o estado financeiro do estudante (INV-1, INV-6)
async function recalcularEstado(tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>, studentId: string) {
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
  const code = generateCode('DB');

  const debt = await prisma.debt.create({
    data: {
      code,
      studentId: input.studentId,
      title: input.title,
      description: input.description ?? null,
      amount: input.amount,
      origin: input.origin,
      dueDate: new Date(input.dueDate),
      status: 'PENDENTE',
    },
  });

  // INV-8: notificar o estudante
  await createNotification(
    prisma,
    input.studentId,
    'Nova Divida Registada',
    `Foi emitida uma nova divida "${input.title}" no valor de ${input.amount} MZN, com vencimento em ${new Date(input.dueDate).toLocaleDateString('pt-PT')}.`
  );

  // INV-4: registar auditoria
  await auditLog({
    action: 'DEBT_CREATED',
    module: 'financial',
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
  if (debt.status === 'REGULARIZADA' || debt.status === 'CANCELADA') {
    const err = new Error('Esta divida ja foi regularizada ou cancelada e nao pode receber novos pagamentos') as Error & { statusCode: number; code: string };
    err.statusCode = 400;
    err.code = 'DEBT_ALREADY_CLOSED';
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
    await tx.financialNotification.create({
      data: {
        studentId: debt.studentId,
        title: 'Pagamento Confirmado',
        message: `O seu pagamento de ${input.amountPaid} MZN para a divida "${debt.title}" foi confirmado. Estado financeiro: ${novoEstado}.`,
      },
    });

    return { payment, novoEstado };
  });

  // INV-4: Auditoria (fora da transaccao — nao e critica para a consistencia)
  await auditLog({
    action: 'PAYMENT_CREATED',
    module: 'financial',
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

  return {
    studentId,
    status: fs?.status === 'BLOCKED' ? 'BLOCKED' : 'ACTIVE',
    reason: fs?.reason ?? null,
    blockedAt: fs?.blockedAt?.toISOString() ?? null,
    overdueDebtsCount: dividasVencidas.length,
    totalOverdueAmount: totalVencido,
    updatedAt: fs?.updatedAt.toISOString() ?? new Date().toISOString(),
  };
}

// =============================================================================
// FINANCIAL HISTORY — Historico Financeiro
// =============================================================================

export async function getStudentHistory(studentId: string): Promise<FinancialHistoryDto> {
  const debts = await prisma.debt.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
  });

  const totalPago = debts
    .filter(d => d.status === 'REGULARIZADA')
    .reduce((sum, d) => sum + d.amount.toNumber(), 0);

  const totalEmAberto = debts
    .filter(d => d.status === 'PENDENTE' || d.status === 'VENCIDA')
    .reduce((sum, d) => sum + d.amount.toNumber(), 0);

  return {
    studentId,
    debts: debts.map(toDebtDto),
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

  // Verificar se ja existe contestacao pendente (qualidade de dados)
  const contestacaoPendente = await prisma.analysisRequest.findFirst({
    where: { debtId: input.debtId, status: 'PENDENTE_ANALISE' },
  });
  if (contestacaoPendente) {
    const err = new Error('Ja existe um pedido de analise pendente para esta divida') as Error & { statusCode: number; code: string };
    err.statusCode = 409;
    err.code = 'DUPLICATE_ANALYSIS_REQUEST';
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

  await auditLog({
    action: 'ANALYSIS_REQUEST_CREATED',
    module: 'financial',
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
    err.statusCode = 400;
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

    // Se procedente: cancelar a divida e recalcular estado (INV-6)
    if (input.decision === 'PROCEDENTE') {
      await tx.debt.update({
        where: { id: ar.debtId },
        data: { status: 'CANCELADA' },
      });
      await recalcularEstado(tx, ar.studentId);
    }

    // INV-8: Notificar o estudante
    await tx.financialNotification.create({
      data: {
        studentId: ar.studentId,
        title: 'Decisao da sua Contestacao',
        message: `O seu pedido de analise ${ar.code} foi julgado ${input.decision}. ${input.resolutionNotes}`,
      },
    });

    return updated;
  });

  await auditLog({
    action: 'ANALYSIS_REQUEST_RESOLVED',
    module: 'financial',
    resourceId: id,
    actorId,
    correlationId,
    payload: { decision: input.decision, debtId: ar.debtId },
  });

  return toAnalysisRequestDto(resultado);
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

  await auditLog({
    action: 'POLICY_UPDATED',
    module: 'financial',
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
