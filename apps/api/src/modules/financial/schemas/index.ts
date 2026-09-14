// schemas/index.ts
// Ponto de reexportacao dos schemas Zod do modulo Gestao Financeira.
// Razao de existir: centraliza as importacoes no router e nos testes.
// Os schemas estao definidos no pacote partilhado @smart-campus/validation.

export {
  // Schema de criacao de Divida (POST /api/v1/financial/debts)
  createDebtSchema,
  type CreateDebtInput,

  // Schema de registo de Pagamento (POST /api/v1/financial/payments)
  createPaymentSchema,
  type CreatePaymentInput,

  // Schema de contestacao de Divida (POST /api/v1/financial/analysis-requests)
  createAnalysisRequestSchema,
  type CreateAnalysisRequestInput,

  // Schema de resolucao de contestacao (PATCH /api/v1/financial/analysis-requests/:id)
  resolveAnalysisRequestSchema,
  type ResolveAnalysisRequestInput,

  // Schema de actualizacao de Politica (PATCH /api/v1/financial/policies/:id)
  updateFinancialPolicySchema,
  type UpdateFinancialPolicyInput,
} from '@smart-campus/validation';
