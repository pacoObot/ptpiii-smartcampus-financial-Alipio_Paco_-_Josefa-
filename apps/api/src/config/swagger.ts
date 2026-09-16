export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Smart Campus — API de Gestão Financeira de Estudantes',
    version: '1.0.0',
    description: 'Documentação oficial das APIs do Módulo de Gestão Financeira de Estudantes com RBAC (Controlos de Acesso Baseados em Perfil). PTP III — UJAC (2026)',
    contact: {
      name: 'Alípio Paco & Josefa Muthemba',
      email: 'financeiro@smartcampus.ujac.ac.mz',
    },
  },
  servers: [
    {
      url: 'http://localhost:4100',
      description: 'Servidor Local de Desenvolvimento',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Autenticação Bearer JWT. Insira o token do perfil pretendido (FINANCE, ADMIN, STUDENT ou TEACHER) para testar.',
      },
    },
    schemas: {
      ApiSuccess: {
        type: 'object',
        properties: {
          data: { type: 'object' },
          meta: {
            type: 'object',
            properties: {
              correlationId: { type: 'string', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
              timestamp: { type: 'string', example: '2026-09-14T10:30:00.000Z' },
              totalCount: { type: 'integer', example: 10 },
            },
          },
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'FORBIDDEN' },
          message: { type: 'string', example: 'Acesso negado. A sua função (STUDENT) não possui permissão para esta operação.' },
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string', example: 'amount' },
                message: { type: 'string', example: 'O valor deve ser superior a zero' },
              },
            },
          },
          correlationId: { type: 'string', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
        },
      },
      CreateDebtInput: {
        type: 'object',
        required: ['studentId', 'title', 'amount', 'origin', 'dueDate'],
        properties: {
          studentId: { type: 'string', example: 'usr_student_01' },
          title: { type: 'string', example: 'Propina Setembro 2026' },
          description: { type: 'string', example: 'Mensalidade do curso de Engenharia Informática' },
          amount: { type: 'number', example: 3500 },
          origin: { type: 'string', example: 'TUITION_2026' },
          dueDate: { type: 'string', format: 'date-time', example: '2026-09-30T23:59:59.000Z' },
        },
      },
      CreatePaymentInput: {
        type: 'object',
        required: ['debtId', 'amountPaid', 'paymentMethod', 'referenceCode'],
        properties: {
          debtId: { type: 'string', example: 'debt_01' },
          amountPaid: { type: 'number', example: 3500 },
          paymentMethod: { type: 'string', enum: ['BANK_TRANSFER', 'CASH_DEPOSIT', 'MOBILE_MONEY', 'POS'], example: 'BANK_TRANSFER' },
          referenceCode: { type: 'string', example: 'REF-BIM-987654' },
        },
      },
      CreateAnalysisRequestInput: {
        type: 'object',
        required: ['debtId', 'reason'],
        properties: {
          debtId: { type: 'string', example: 'debt_02' },
          reason: { type: 'string', example: 'Solicito a anulação da taxa pois apresentei comprovativo médico dentro do prazo.' },
        },
      },
      ResolveAnalysisRequestInput: {
        type: 'object',
        required: ['decision', 'resolutionNotes'],
        properties: {
          decision: { type: 'string', enum: ['PROCEDENTE', 'IMPROCEDENTE'], example: 'PROCEDENTE' },
          resolutionNotes: { type: 'string', example: 'Comprovativo médico validado pela junta de saúde da UJAC.' },
        },
      },
      UpdateFinancialPolicyInput: {
        type: 'object',
        required: ['gracePeriodDays', 'autoBlockEnabled', 'maxDebtAmount'],
        properties: {
          gracePeriodDays: { type: 'integer', example: 10 },
          autoBlockEnabled: { type: 'boolean', example: true },
          maxDebtAmount: { type: 'number', example: 0 },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Verificação de Saúde da API',
        tags: ['Infraestrutura'],
        responses: { '200': { description: 'API em funcionamento normal' } },
      },
    },
    '/api/v1/auth/login': {
      post: {
        summary: 'Autenticar utilizador e obter token JWT com Role (RBAC)',
        tags: ['Autenticação'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' } } } } },
        },
        responses: { '200': { description: 'Login com sucesso. Retorna token JWT e perfil (role).' } },
      },
    },
    '/api/v1/financial/debts': {
      get: {
        summary: 'Listar Dívidas [RBAC: STUDENT vê apenas as suas | FINANCE e ADMIN vêem todas]',
        tags: ['Dívidas (Debts)'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'studentId', in: 'query', schema: { type: 'string' }, description: 'Filtrar por ID de estudante (apenas FINANCE/ADMIN). STUDENT recebe 403 se tentar consultar outro estudante.' },
        ],
        responses: {
          '200': { description: 'Lista de dívidas filtrada conforme o perfil RBAC' },
          '401': { description: 'Não autenticado' },
          '403': { description: 'Acesso Negado (STUDENT a tentar listar dívidas de outro estudante)' },
        },
      },
      post: {
        summary: 'Registar Nova Dívida [RBAC: Apenas FINANCE e ADMIN]',
        tags: ['Dívidas (Debts)'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateDebtInput' } } },
        },
        responses: {
          '201': { description: 'Dívida criada com sucesso' },
          '400': { description: 'Erro de Validação Zod (campos em falta ou inválidos)' },
          '403': { description: 'Acesso Negado (ex: STUDENT ou TEACHER a tentar criar dívida)' },
        },
      },
    },
    '/api/v1/financial/debts/{id}': {
      get: {
        summary: 'Consultar Dívida Específica [RBAC: Todos os Autenticados]',
        tags: ['Dívidas (Debts)'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID da dívida (ex: debt_01 ou DBT-2026-001)' }],
        responses: {
          '200': { description: 'Detalhes da dívida e histórico de pagamentos' },
          '404': { description: 'Dívida não encontrada (DEBT_NOT_FOUND)' },
        },
      },
    },
    '/api/v1/financial/payments': {
      post: {
        summary: 'Registar Pagamento e Regularizar Dívida via Transação ACID [RBAC: Apenas FINANCE e ADMIN]',
        tags: ['Pagamentos (Payments)'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePaymentInput' } } },
        },
        responses: {
          '201': { description: 'Pagamento registado com sucesso e dívida atualizada via ACID' },
          '400': { description: 'Validação Zod, montante diferente do valor da dívida ou dívida cancelada' },
          '403': { description: 'Acesso Negado (apenas FINANCE e ADMIN podem liquidar dívidas)' },
          '409': { description: 'Dívida já regularizada' },
        },
      },
    },
    '/api/v1/financial/students/{studentId}/status': {
      get: {
        summary: 'Consultar Estado Financeiro (ACTIVE / BLOCKED) [RBAC: STUDENT só vê o seu | FINANCE/ADMIN vêem qualquer um]',
        tags: ['Estado do Estudante (Financial Status)'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'studentId', in: 'path', required: true, schema: { type: 'string' }, description: 'ID do Estudante (ex: usr_student_01)' }],
        responses: {
          '200': { description: 'Estado financeiro (ACTIVE ou BLOCKED) e motivo de bloqueio se aplicável' },
          '403': { description: 'Acesso Negado (STUDENT a tentar ver o estado de outro estudante)' },
        },
      },
    },
    '/api/v1/financial/students/{studentId}/history': {
      get: {
        summary: 'Consultar Histórico Financeiro Completo [RBAC: STUDENT só vê o seu | FINANCE/ADMIN vêem qualquer um]',
        tags: ['Estado do Estudante (Financial Status)'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'studentId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Histórico consolidado de dívidas e pagamentos' },
          '403': { description: 'Acesso Negado' },
        },
      },
    },
    '/api/v1/financial/students/{studentId}/notifications': {
      get: {
        summary: 'Consultar Notificações Financeiras do Estudante [RBAC: STUDENT só vê as suas]',
        tags: ['Notificações (Notifications)'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'studentId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Lista de alertas e avisos emitidos para o estudante' },
          '403': { description: 'Acesso Negado' },
        },
      },
    },
    '/api/v1/financial/analysis-requests': {
      post: {
        summary: 'Submeter Pedido de Contestação de Dívida [RBAC: Apenas STUDENT]',
        tags: ['Contestações (Analysis Requests)'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateAnalysisRequestInput' } } },
        },
        responses: {
          '201': { description: 'Contestação submetida e SLA de análise ativado' },
          '400': { description: 'Validação Zod (justificação com menos de 10 caracteres ou ID inválido)' },
          '409': { description: 'Contestação já aberta ou dívida já regularizada' },
        },
      },
    },
    '/api/v1/financial/analysis-requests/{id}': {
      patch: {
        summary: 'Resolver Contestação (PROCEDENTE / IMPROCEDENTE) [RBAC: Apenas FINANCE e ADMIN]',
        tags: ['Contestações (Analysis Requests)'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ID do pedido de análise (ex: ar_01)' }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ResolveAnalysisRequestInput' } } },
        },
        responses: {
          '200': { description: 'Contestação resolvida com sucesso' },
          '403': { description: 'Acesso Negado (STUDENT não pode decidir a sua própria contestação)' },
          '404': { description: 'Pedido de análise não encontrado' },
          '409': { description: 'Regra de Negócio: Não é possível re-resolver uma contestação já decidida' },
        },
      },
    },
    '/api/v1/financial/reports': {
      get: {
        summary: 'Relatório Financeiro Consolidado do Campus [RBAC: Apenas FINANCE e ADMIN]',
        tags: ['Relatórios (Reports)'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Relatório consolidado com total de dívidas, total arrecadado, taxa de inadimplência e estudantes bloqueados' },
          '403': { description: 'Acesso Negado' },
        },
      },
    },
    '/api/v1/financial/policies/{policyId}': {
      get: {
        summary: 'Consultar Configuração da Política Financeira [RBAC: Apenas ADMIN]',
        tags: ['Políticas (Policies)'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'policyId', in: 'path', required: true, schema: { type: 'string' }, description: 'Código da política (ex: DEFAULT_POLICY)' }],
        responses: {
          '200': { description: 'Parâmetros actuais da política de bloqueio' },
          '403': { description: 'Acesso Negado' },
        },
      },
      patch: {
        summary: 'Atualizar Política Financeira do Campus [RBAC: Apenas ADMIN]',
        tags: ['Políticas (Policies)'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'policyId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateFinancialPolicyInput' } } },
        },
        responses: {
          '200': { description: 'Regras da política atualizadas com sucesso' },
          '403': { description: 'Acesso Negado' },
        },
      },
    },
  },
};
