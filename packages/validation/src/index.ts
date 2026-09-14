import { z } from 'zod';

// --- Auth ---

export const loginSchema = z.object({
  email: z.string().email('E-mail invalido'),
  password: z.string().min(6, 'Password deve ter pelo menos 6 caracteres'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken e obrigatorio'),
});

// --- Users ---

export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(120),
  email: z.string().email('E-mail institucional invalido'),
  password: z.string().min(8, 'Password deve ter pelo menos 8 caracteres'),
  role: z.enum(['STUDENT', 'TEACHER', 'TECHNICIAN', 'COORDINATOR', 'ADMIN']).default('STUDENT'),
  studentId: z.string().trim().optional(),
  department: z.string().trim().optional(),
});

// --- Buildings ---

export const createBuildingSchema = z.object({
  code: z.string().trim().min(2, 'Codigo do edificio e obrigatorio').max(40),
  name: z.string().trim().min(3, 'Nome do edificio e obrigatorio').max(120),
  address: z.string().trim().min(5, 'Endereco e obrigatorio').max(200),
  floors: z.number().int().min(1, 'O edificio deve ter pelo menos 1 piso').max(30).default(1),
});

// --- Rooms ---

export const createRoomSchema = z.object({
  code: z.string().trim().min(2, 'Codigo da sala e obrigatorio').max(40),
  name: z.string().trim().min(3, 'Nome da sala e obrigatorio').max(120),
  buildingId: z.string().min(1, 'O identificador do edificio e obrigatorio'),
  floor: z.number().int().min(0).max(30).default(0),
  capacity: z.number().int().positive('Capacidade deve ser maior que 0'),
  type: z.enum(['CLASSROOM', 'LAB', 'AUDITORIUM', 'OFFICE', 'OTHER']).default('CLASSROOM'),
});

// --- Incidents ---

export const createIncidentSchema = z.object({
  title: z.string().trim().min(5, 'Titulo deve ter pelo menos 5 caracteres').max(200),
  description: z.string().trim().min(10, 'Descricao deve ter pelo menos 10 caracteres'),
  roomId: z.string().min(1, 'O identificador da sala e obrigatorio'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

export const updateIncidentStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  assignedToId: z.string().optional(),
});

// --- Modulo de Manutencao (Grupo 5) ---

export const createMaintenanceRequestSchema = z.object({
  title: z.string().trim().min(5, 'O titulo deve conter pelo menos 5 caracteres').max(150),
  description: z.string().trim().min(10, 'A descricao da avaria deve ter pelo menos 10 caracteres'),
  category: z.enum(['ELECTRICAL', 'PLUMBING', 'HARDWARE', 'FURNITURE', 'HVAC', 'CLEANING', 'OTHER']).default('OTHER'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  roomId: z.string().min(1, 'A identificacao da sala e obrigatoria'),
  estimatedCost: z.number().nonnegative('O custo estimado deve ser positivo ou zero').optional(),
});

export const updateMaintenanceStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED']),
  assignedToId: z.string().optional(),
  estimatedCost: z.number().nonnegative().optional(),
  note: z.string().trim().min(5, 'Ao alterar o estado, adicione uma breve nota explicativa').optional(),
});

export const addMaintenanceNoteSchema = z.object({
  content: z.string().trim().min(5, 'O conteudo da nota tecnica deve ter pelo menos 5 caracteres'),
});

export const filterMaintenanceQuerySchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  category: z.enum(['ELECTRICAL', 'PLUMBING', 'HARDWARE', 'FURNITURE', 'HVAC', 'CLEANING', 'OTHER']).optional(),
  roomId: z.string().optional(),
  assignedToId: z.string().optional(),
});

// Inferred types

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentStatusInput = z.infer<typeof updateIncidentStatusSchema>;
export type CreateMaintenanceRequestInput = z.infer<typeof createMaintenanceRequestSchema>;
export type UpdateMaintenanceStatusInput = z.infer<typeof updateMaintenanceStatusSchema>;
export type AddMaintenanceNoteInput = z.infer<typeof addMaintenanceNoteSchema>;
export type FilterMaintenanceQueryInput = z.infer<typeof filterMaintenanceQuerySchema>;

// =============================================================================
// MODULO: Gestao Financeira de Estudantes (financial)
// Grupo: Alipio Anderson Moises Paco (2024080003) & Jesefa Mutemba
// =============================================================================

// Valor monetario: positivo e com no maximo 2 casas decimais
const financialAmountSchema = z.number()
  .positive('O valor deve ser superior a zero')
  .max(1000000, 'Valor limite excedido por transacao');

// Schema de criacao de Divida (usado em POST /api/v1/financial/debts)
export const createDebtSchema = z.object({
  studentId: z.string().min(1, 'O ID do estudante e obrigatorio'),
  title: z.string().trim().min(3, 'Titulo deve ter pelo menos 3 caracteres').max(120),
  description: z.string().trim().max(500).optional(),
  amount: financialAmountSchema,
  origin: z.string().trim().min(2, 'Origem e obrigatoria').max(60),
  dueDate: z.string().datetime({ message: 'Data de vencimento invalida (formato ISO 8601 obrigatorio)' }),
});

// Schema de registo de Pagamento (usado em POST /api/v1/financial/payments)
export const createPaymentSchema = z.object({
  debtId: z.string().min(1, 'ID da divida e obrigatorio'),
  amountPaid: financialAmountSchema,
  paymentMethod: z.enum(['BANK_TRANSFER', 'CASH_DEPOSIT', 'MOBILE_MONEY', 'POS'], {
    errorMap: () => ({ message: 'Metodo de pagamento invalido' }),
  }),
  referenceCode: z.string().trim().min(4, 'Codigo de referencia invalido (minimo 4 caracteres)').max(80),
});

// Schema de contestacao de Divida (usado em POST /api/v1/financial/analysis-requests)
export const createAnalysisRequestSchema = z.object({
  debtId: z.string().min(1, 'ID da divida e obrigatorio'),
  reason: z.string().trim().min(10, 'A justificacao deve ter pelo menos 10 caracteres').max(1000),
});

// Schema de resolucao de contestacao (usado em PATCH /api/v1/financial/analysis-requests/:id)
export const resolveAnalysisRequestSchema = z.object({
  decision: z.enum(['PROCEDENTE', 'IMPROCEDENTE'], {
    errorMap: () => ({ message: 'Decisao invalida: use PROCEDENTE ou IMPROCEDENTE' }),
  }),
  resolutionNotes: z.string().trim().min(5, 'A nota de resolucao e obrigatoria').max(1000),
});

// Schema de actualizacao da Politica Financeira (usado em PATCH /api/v1/financial/policies/:id)
export const updateFinancialPolicySchema = z.object({
  gracePeriodDays: z.number().int().min(0).max(60),
  autoBlockEnabled: z.boolean(),
  maxDebtAmount: z.number().min(0),
});

// Inferred types — modulo financeiro
export type CreateDebtInput = z.infer<typeof createDebtSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type CreateAnalysisRequestInput = z.infer<typeof createAnalysisRequestSchema>;
export type ResolveAnalysisRequestInput = z.infer<typeof resolveAnalysisRequestSchema>;
export type UpdateFinancialPolicyInput = z.infer<typeof updateFinancialPolicySchema>;

