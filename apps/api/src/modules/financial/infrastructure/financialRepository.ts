// infrastructure/financialRepository.ts
// Camada de Infraestrutura: encapsula todas as chamadas ao Prisma Client.
// Razao de existir: a camada de Aplicacao (financialService.ts) nao deve
// depender directamente do Prisma — apenas de contratos/funcoes desta camada.
// Isso facilita testes unitarios (mock do repositorio) e migracao de ORM.

import { PrismaClient } from '@prisma/client';

// Instancia unica do Prisma partilhada pelo modulo
const prisma = new PrismaClient();

// =============================================================================
// DEBTS — Dividas
// =============================================================================

/** Devolve todas as dividas, com filtro opcional por estudante. */
export async function findDebts(studentId?: string) {
  return prisma.debt.findMany({
    where: studentId ? { studentId } : undefined,
    orderBy: { createdAt: 'desc' },
  });
}

/** Devolve uma divida pelo ID, ou null se nao existir. */
export async function findDebtById(id: string) {
  return prisma.debt.findUnique({ where: { id } });
}

/** Cria uma nova divida na base de dados. */
export async function insertDebt(data: {
  code: string;
  studentId: string;
  title: string;
  description: string | null;
  amount: number;
  origin: string;
  dueDate: Date;
  status: string;
}) {
  return prisma.debt.create({ data });
}

// =============================================================================
// PAYMENTS — Pagamentos (efectuados dentro de $transaction no service)
// =============================================================================

/** Lista pagamentos, com filtro opcional por estudante ou divida. */
export async function findPayments(filter?: { studentId?: string; debtId?: string }) {
  return prisma.payment.findMany({
    where: filter,
    orderBy: { createdAt: 'desc' },
  });
}

// =============================================================================
// FINANCIAL STATUS — Estado Financeiro
// =============================================================================

/** Devolve o estado financeiro de um estudante, ou null se nao existir. */
export async function findFinancialStatus(studentId: string) {
  return prisma.financialStatus.findUnique({ where: { studentId } });
}

/** Conta as dividas vencidas de um estudante. */
export async function countOverdueDebts(studentId: string): Promise<number> {
  return prisma.debt.count({ where: { studentId, status: 'VENCIDA' } });
}

/** Lista as dividas vencidas de um estudante (para calculos de montante). */
export async function findOverdueDebts(studentId: string) {
  return prisma.debt.findMany({ where: { studentId, status: 'VENCIDA' } });
}

/** Lista todas as dividas de um estudante (para o historico). */
export async function findAllDebtsByStudent(studentId: string) {
  return prisma.debt.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
  });
}

// =============================================================================
// ANALYSIS REQUESTS — Contestacoes
// =============================================================================

/** Verifica se ja existe uma contestacao pendente para uma dada divida. */
export async function findPendingAnalysisRequest(debtId: string) {
  return prisma.analysisRequest.findFirst({
    where: { debtId, status: 'PENDENTE_ANALISE' },
  });
}

/** Devolve um pedido de analise pelo ID. */
export async function findAnalysisRequestById(id: string) {
  return prisma.analysisRequest.findUnique({ where: { id } });
}

// =============================================================================
// NOTIFICATIONS — Notificacoes
// =============================================================================

/** Lista as ultimas notificacoes financeiras de um estudante. */
export async function findNotifications(studentId: string, take: number = 30) {
  return prisma.financialNotification.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

// =============================================================================
// POLICIES — Politicas Financeiras
// =============================================================================

/** Devolve uma politica pelo codigo, ou null se nao existir. */
export async function findPolicy(code: string) {
  return prisma.financialPolicy.findUnique({ where: { code } });
}

// =============================================================================
// REPORTS — Contagens para Relatorio Agregado
// =============================================================================

/** Devolve contagens de dividas agrupadas por estado e totais de pagamentos/bloqueios. */
export async function getReportCounters() {
  const [totalDebts, pendentes, vencidas, regularizadas, canceladas, totalPayments, blocked] =
    await Promise.all([
      prisma.debt.count(),
      prisma.debt.count({ where: { status: 'PENDENTE' } }),
      prisma.debt.count({ where: { status: 'VENCIDA' } }),
      prisma.debt.count({ where: { status: 'REGULARIZADA' } }),
      prisma.debt.count({ where: { status: 'CANCELADA' } }),
      prisma.payment.count(),
      prisma.financialStatus.count({ where: { status: 'BLOCKED' } }),
    ]);

  return { totalDebts, byStatus: { pendentes, vencidas, regularizadas, canceladas }, totalPayments, studentsBlocked: blocked };
}

// Exporta a instancia do Prisma para uso nas transaccoes $transaction do service
export { prisma };
