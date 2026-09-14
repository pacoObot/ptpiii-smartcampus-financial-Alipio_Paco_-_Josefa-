import {
  ApiSuccess,
  ApiError,
  AuthResponseDto,
  RoomDto,
  IncidentDto,
  UserDto,
  BuildingDto,
  MaintenanceRequestDto,
  MaintenanceNoteDto,
  MaintenanceStatsDto,
  // --- Modulo Gestao Financeira ---
  DebtDto,
  PaymentDto,
  FinancialStatusSummaryDto,
  FinancialHistoryDto,
  AnalysisRequestDto,
  FinancialNotificationDto,
  FinancialPolicyDto,
} from '@smart-campus/shared-types';

export class SmartCampusApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = 'http://localhost:4100/api/v1') {
    this.baseUrl = baseUrl;
  }

  public setToken(token: string | null): void {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-correlation-id': crypto.randomUUID(),
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      const err = data as ApiError;
      throw new Error(err.message || 'Erro de comunicacao com a API do Smart Campus');
    }

    return (data as ApiSuccess<T>).data;
  }

  // Autenticacao
  public async login(email: string, password: string): Promise<AuthResponseDto> {
    const res = await this.request<AuthResponseDto>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.tokens.accessToken);
    return res;
  }

  public async getMe(): Promise<UserDto> {
    return this.request<UserDto>('/auth/me');
  }

  // Edificios
  public async getBuildings(): Promise<BuildingDto[]> {
    return this.request<BuildingDto[]>('/buildings');
  }

  // Salas
  public async getRooms(): Promise<RoomDto[]> {
    return this.request<RoomDto[]>('/rooms');
  }

  // Modulo de Manutencao & Ocorrencias (Grupo 5)

  public async getMaintenanceRequests(params?: { status?: string; priority?: string; category?: string }): Promise<MaintenanceRequestDto[]> {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    const url = `/maintenance${query ? `?${query}` : ''}`;
    return this.request<MaintenanceRequestDto[]>(url);
  }

  public async getMaintenanceRequestById(id: string): Promise<MaintenanceRequestDto> {
    return this.request<MaintenanceRequestDto>(`/maintenance/${id}`);
  }

  public async getMaintenanceStats(): Promise<MaintenanceStatsDto> {
    return this.request<MaintenanceStatsDto>('/maintenance/stats');
  }

  public async createMaintenanceRequest(input: {
    title: string;
    description: string;
    category: string;
    priority: string;
    roomId: string;
    estimatedCost?: number;
  }): Promise<MaintenanceRequestDto> {
    return this.request<MaintenanceRequestDto>('/maintenance', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  public async updateMaintenanceStatus(
    id: string,
    input: { status: string; assignedToId?: string; note?: string; estimatedCost?: number }
  ): Promise<MaintenanceRequestDto> {
    return this.request<MaintenanceRequestDto>(`/maintenance/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  public async addMaintenanceNote(id: string, content: string): Promise<MaintenanceNoteDto> {
    return this.request<MaintenanceNoteDto>(`/maintenance/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // ===========================================================================
  // MODULO: Gestao Financeira de Estudantes
  // Grupo: Alipio Anderson Moises Paco (2024080003) & Jocar Celio Elias (2024080038)
  // Base URL: /financial
  // ===========================================================================

  // --- DEBTS — Dividas ---

  /**
   * Lista todas as dividas registadas.
   * FINANCE/ADMIN veem todas; STUDENT so ve as suas proprias (filtro aplicado pelo servidor).
   * GET /api/v1/financial/debts
   */
  public async getDebts(params?: { studentId?: string }): Promise<DebtDto[]> {
    const query = params?.studentId ? `?studentId=${params.studentId}` : '';
    return this.request<DebtDto[]>(`/financial/debts${query}`);
  }

  /**
   * Consulta uma divida especifica pelo seu ID.
   * GET /api/v1/financial/debts/:id
   */
  public async getDebtById(id: string): Promise<DebtDto> {
    return this.request<DebtDto>(`/financial/debts/${id}`);
  }

  /**
   * Regista uma nova divida para um estudante. Apenas FINANCE e ADMIN.
   * POST /api/v1/financial/debts
   */
  public async createDebt(input: {
    studentId: string;
    title: string;
    description?: string;
    amount: number;
    origin: string;
    dueDate: string; // ISO 8601, ex: '2026-12-31T23:59:59.000Z'
  }): Promise<DebtDto> {
    return this.request<DebtDto>('/financial/debts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // --- PAYMENTS — Pagamentos ---

  /**
   * Confirma um pagamento e regulariza a divida correspondente (transaccao ACID no servidor).
   * Apenas FINANCE e ADMIN.
   * POST /api/v1/financial/payments
   */
  public async createPayment(input: {
    debtId: string;
    amountPaid: number;
    paymentMethod: 'BANK_TRANSFER' | 'CASH_DEPOSIT' | 'MOBILE_MONEY' | 'POS';
    referenceCode: string;
  }): Promise<{ payment: PaymentDto; debtStatus: string; studentFinancialStatus: string }> {
    return this.request<{ payment: PaymentDto; debtStatus: string; studentFinancialStatus: string }>(
      '/financial/payments',
      { method: 'POST', body: JSON.stringify(input) }
    );
  }

  // --- FINANCIAL STATUS — Estado Financeiro ---

  /**
   * Consulta o estado financeiro de um estudante (ACTIVE ou BLOCKED) com resumo de dividas vencidas.
   * STUDENT so pode consultar o seu proprio estado.
   * GET /api/v1/financial/students/:studentId/status
   */
  public async getStudentFinancialStatus(studentId: string): Promise<FinancialStatusSummaryDto> {
    return this.request<FinancialStatusSummaryDto>(`/financial/students/${studentId}/status`);
  }

  /**
   * Consulta o historico financeiro completo do estudante (todas as dividas e totais).
   * GET /api/v1/financial/students/:studentId/history
   */
  public async getStudentFinancialHistory(studentId: string): Promise<FinancialHistoryDto> {
    return this.request<FinancialHistoryDto>(`/financial/students/${studentId}/history`);
  }

  /**
   * Consulta as notificacoes financeiras do estudante (ultimas 30).
   * GET /api/v1/financial/students/:studentId/notifications
   */
  public async getStudentFinancialNotifications(studentId: string): Promise<FinancialNotificationDto[]> {
    return this.request<FinancialNotificationDto[]>(`/financial/students/${studentId}/notifications`);
  }

  // --- ANALYSIS REQUESTS — Contestacoes de Dividas ---

  /**
   * Submete uma contestacao de divida. Apenas STUDENT.
   * POST /api/v1/financial/analysis-requests
   */
  public async createAnalysisRequest(input: {
    debtId: string;
    reason: string; // minimo 10 caracteres
  }): Promise<AnalysisRequestDto> {
    return this.request<AnalysisRequestDto>('/financial/analysis-requests', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /**
   * Resolve uma contestacao pendente (PROCEDENTE ou IMPROCEDENTE). Apenas FINANCE e ADMIN.
   * PATCH /api/v1/financial/analysis-requests/:id
   */
  public async resolveAnalysisRequest(
    id: string,
    input: { decision: 'PROCEDENTE' | 'IMPROCEDENTE'; resolutionNotes: string }
  ): Promise<AnalysisRequestDto> {
    return this.request<AnalysisRequestDto>(`/financial/analysis-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  // --- REPORTS — Relatorio Financeiro ---

  /**
   * Obtem o relatorio financeiro consolidado do campus. Apenas FINANCE e ADMIN.
   * GET /api/v1/financial/reports
   */
  public async getFinancialReport(): Promise<{
    totalDebts: number;
    byStatus: { pendentes: number; vencidas: number; regularizadas: number; canceladas: number };
    totalPayments: number;
    studentsBlocked: number;
    generatedAt: string;
  }> {
    return this.request('/financial/reports');
  }

  // --- POLICIES — Politica Financeira ---

  /**
   * Consulta a politica financeira activa. Apenas ADMIN.
   * GET /api/v1/financial/policies/:policyId
   */
  public async getFinancialPolicy(policyId: string): Promise<FinancialPolicyDto> {
    return this.request<FinancialPolicyDto>(`/financial/policies/${policyId}`);
  }

  /**
   * Actualiza a politica de bloqueio automatico e periodo de graca. Apenas ADMIN.
   * PATCH /api/v1/financial/policies/:policyId
   */
  public async updateFinancialPolicy(
    policyId: string,
    input: { gracePeriodDays: number; autoBlockEnabled: boolean; maxDebtAmount: number }
  ): Promise<FinancialPolicyDto> {
    return this.request<FinancialPolicyDto>(`/financial/policies/${policyId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }
}
