// Roles de Utilizadores no Smart Campus
export type Role = 'STUDENT' | 'TEACHER' | 'TECHNICIAN' | 'COORDINATOR' | 'ADMIN' | 'FINANCE';

// Formato de Resposta Padronizada de Sucesso
export interface ApiSuccess<T> {
  data: T;
  meta: {
    correlationId: string;
    timestamp: string;
    totalCount?: number;
  };
}

// Formato de Resposta Padronizada de Erro
export interface ApiError {
  code: string;
  message: string;
  details?: Array<{ path: string; message: string }>;
  correlationId: string;
}

// Utilizador DTO (sem password)
export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  studentId?: string;
  department?: string;
  isActive: boolean;
  createdAt: string;
}

// Tokens de Autenticacao
export interface TokensDto {
  accessToken: string;
  refreshToken: string;
}

// Resposta do Login — formato: data.user + data.tokens.accessToken
export interface AuthResponseDto {
  user: UserDto;
  tokens: TokensDto;
}

// Edificio DTO
export interface BuildingDto {
  id: string;
  code: string;
  name: string;
  address: string;
  floors: number;
  createdAt: string;
}

// Sala / Espaco DTO
export interface RoomDto {
  id: string;
  code: string;
  name: string;
  buildingId: string;
  buildingName?: string;
  floor: number;
  capacity: number;
  isAvailable: boolean;
  type: 'CLASSROOM' | 'LAB' | 'AUDITORIUM' | 'OFFICE' | 'OTHER';
  createdAt: string;
  updatedAt: string;
}

// Ocorrencia / Incidente DTO (Core)
export interface IncidentDto {
  id: string;
  title: string;
  description: string;
  roomId: string;
  roomCode?: string;
  reportedById: string;
  reportedByName?: string;
  assignedToId?: string;
  assignedToName?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: string;
  updatedAt: string;
}

// Modulo de Manutencao & Ocorrencias (Grupo 5)

export type MaintenanceCategory =
  | 'ELECTRICAL'
  | 'PLUMBING'
  | 'HARDWARE'
  | 'FURNITURE'
  | 'HVAC'
  | 'CLEANING'
  | 'OTHER';

export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type MaintenanceStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';

export interface MaintenanceNoteDto {
  id: string;
  requestId: string;
  authorId: string;
  authorName?: string;
  content: string;
  createdAt: string;
}

export interface MaintenanceRequestDto {
  id: string;
  code: string;
  title: string;
  description: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  roomId: string;
  roomCode?: string;
  buildingName?: string;
  reportedById: string;
  reportedByName?: string;
  assignedToId?: string;
  assignedToName?: string;
  estimatedCost?: number;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  notes?: MaintenanceNoteDto[];
}

export interface MaintenanceStatsDto {
  totalRequests: number;
  openRequests: number;
  inProgressRequests: number;
  resolvedRequests: number;
  closedRequests: number;
  cancelledRequests: number;
  urgentRequests: number;
  highPriorityRequests: number;
  byCategory: Record<string, number>;
}

// Auditoria DTO
export interface AuditEventDto {
  id: string;
  correlationId: string;
  userId: string;
  userName?: string;
  action: string;
  module: string;
  resourceId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

// Dashboard DTO
export interface DashboardDto {
  summary: {
    totalUsers: number;
    totalRooms: number;
    availableRooms: number;
    openIncidents: number;
    inProgressIncidents: number;
  };
  recentIncidents: IncidentDto[];
  auditedAt: string;
}

// Catalogo de Modulos (Frontend)
export interface CampusModuleInfo {
  id: string;
  name: string;
  description: string;
  status: 'available' | 'partial' | 'development';
  category: 'core' | 'academic' | 'infrastructure' | 'iot' | 'particular';
  route: string;
  requiredRoles?: Role[];
  teamMembers?: string[];
}

// =============================================================================
// MODULO: Gestao Financeira de Estudantes (financial)
// Grupo: Alipio Anderson Moises Paco (2024080003) & Jesefa Mutemba
// =============================================================================

export type DebtStatus = 'PENDENTE' | 'VENCIDA' | 'REGULARIZADA' | 'CANCELADA';
export type FinancialStatusType = 'ACTIVE' | 'BLOCKED';
export type AnalysisRequestStatus = 'PENDENTE_ANALISE' | 'PROCEDENTE' | 'IMPROCEDENTE';
export type PaymentMethod = 'BANK_TRANSFER' | 'CASH_DEPOSIT' | 'MOBILE_MONEY' | 'POS';

// DTO de Divida
export interface DebtDto {
  id: string;
  code: string;
  studentId: string;
  title: string;
  description?: string;
  amount: number;
  origin: string;
  dueDate: string;
  status: DebtStatus;
  createdAt: string;
  updatedAt: string;
}

// DTO de Pagamento
export interface PaymentDto {
  id: string;
  code: string;
  debtId: string;
  studentId: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  referenceCode: string;
  confirmedById: string;
  paidAt: string;
  createdAt: string;
}

// DTO de Estado Financeiro
export interface FinancialStatusDto {
  id: string;
  studentId: string;
  status: FinancialStatusType;
  blockedAt?: string;
  reason?: string;
  updatedAt: string;
}

// DTO de Pedido de Analise / Contestacao
export interface AnalysisRequestDto {
  id: string;
  code: string;
  debtId: string;
  studentId: string;
  reason: string;
  status: AnalysisRequestStatus;
  slaDueDate: string;
  resolvedById?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

// DTO de Notificacao Financeira
export interface FinancialNotificationDto {
  id: string;
  studentId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

// DTO de Politica Financeira
export interface FinancialPolicyDto {
  id: string;
  code: string;
  gracePeriodDays: number;
  autoBlockEnabled: boolean;
  maxDebtAmount: number;
  updatedAt: string;
}

// DTO do Estado Financeiro Completo (resposta da rota /status)
export interface FinancialStatusSummaryDto {
  studentId: string;
  status: FinancialStatusType;
  reason: string | null;
  blockedAt: string | null;
  overdueDebtsCount: number;
  totalOverdueAmount: number;
  updatedAt: string;
}

// DTO do Historico Financeiro (resposta da rota /history)
export interface FinancialHistoryDto {
  studentId: string;
  debts: DebtDto[];
  payments: PaymentDto[];
  status: FinancialStatusSummaryDto;
  totalDebts: number;
  totalPaid: number;
  totalOutstanding: number;
}
