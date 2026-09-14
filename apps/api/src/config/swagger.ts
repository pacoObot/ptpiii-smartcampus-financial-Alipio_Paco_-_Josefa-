export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Smart Campus — API de Gestão Financeira de Estudantes',
    version: '1.0.0',
    description: 'Documentação oficial das APIs do Módulo de Gestão Financeira de Estudantes — PTP III (UJAC, 2026)',
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
        description: 'Forneça o accessToken obtido no login (ou o token JWT de teste fornecido)',
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
              timestamp: { type: 'string', example: '2026-09-10T09:30:00.000Z' },
              totalCount: { type: 'integer', example: 10 },
            },
          },
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'UNAUTHORIZED' },
          message: { type: 'string', example: 'Token de acesso inválido ou expirado.' },
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
          debtId: { type: 'string', example: 'debt_01' },
          reason: { type: 'string', example: 'Pagamento efetuado via transferência bancária mas ainda consta como pendente.' },
        },
      },
      ResolveAnalysisRequestInput: {
        type: 'object',
        required: ['decision', 'resolutionNotes'],
        properties: {
          decision: { type: 'string', enum: ['PROCEDENTE', 'IMPROCEDENTE'], example: 'PROCEDENTE' },
          resolutionNotes: { type: 'string', example: 'Comprovativo de transferência verificado no extrato bancário.' },
        },
      },
      UpdateFinancialPolicyInput: {
        type: 'object',
        required: ['gracePeriodDays', 'autoBlockEnabled', 'maxDebtAmount'],
        properties: {
          gracePeriodDays: { type: 'integer', example: 15 },
          autoBlockEnabled: { type: 'boolean', example: true },
          maxDebtAmount: { type: 'number', example: 5000 },
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
        summary: 'Autenticar utilizador e obter tokens JWT',
        tags: ['Autenticação'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' } } } } },
        },
        responses: { '200': { description: 'Login com sucesso' } },
      },
    },
    '/api/v1/financial/debts': {
      get: {
        summary: 'Listar dívidas (com filtro por studentId e status)',
        tags: ['Gestão Financeira de Estudantes'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'studentId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDENTE', 'VENCIDA', 'REGULARIZADA', 'CANCELADA'] } },
        ],
        responses: { '200': { description: 'Lista de dívidas' } },
      },
      post: {
        summary: 'Criar nova dívida de estudante (FINANCE, ADMIN)',
        tags: ['Gestão Financeira de Estudantes'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateDebtInput' } } },
        },
        responses: { '201': { description: 'Dívida criada com sucesso' } },
      },
    },
    '/api/v1/financial/debts/{id}': {
      get: {
        summary: 'Consultar dívida por ID ou código (DBT-2026-001)',
        tags: ['Gestão Financeira de Estudantes'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Detalhes da dívida e histórico de pagamentos' }, '404': { description: 'Dívida não encontrada' } },
      },
    },
    '/api/v1/financial/payments': {
      get: {
        summary: 'Consultar pagamentos (com filtro por studentId e debtId)',
        tags: ['Gestão Financeira de Estudantes'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'studentId', in: 'query', schema: { type: 'string' } },
          { name: 'debtId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Lista de pagamentos' } },
      },
      post: {
        summary: 'Registar pagamento e atualizar dívida via Transação ACID (FINANCE, ADMIN)',
        tags: ['Gestão Financeira de Estudantes'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePaymentInput' } } },
        },
        responses: { '201': { description: 'Pagamento registado e dívida atualizada' } },
      },
    },
    '/api/v1/financial/status/student/{studentId}': {
      get: {
        summary: 'Consultar estado financeiro de um estudante (ACTIVE / BLOCKED)',
        tags: ['Gestão Financeira de Estudantes'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'studentId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Estado financeiro do estudante' } },
      },
    },
    '/api/v1/financial/analysis-requests': {
      post: {
        summary: 'Submeter pedido de análise / contestação de dívida',
        tags: ['Gestão Financeira de Estudantes'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateAnalysisRequestInput' } } },
        },
        responses: { '201': { description: 'Contestação registada com sucesso' } },
      },
    },
    '/api/v1/financial/analysis-requests/{id}': {
      patch: {
        summary: 'Resolver contestação de dívida (PROCEDENTE ou IMPROCEDENTE) (FINANCE, ADMIN)',
        tags: ['Gestão Financeira de Estudantes'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ResolveAnalysisRequestInput' } } },
        },
        responses: { '200': { description: 'Contestação resolvida' } },
      },
    },
    '/api/v1/financial/reports': {
      get: {
        summary: 'Gerar relatório financeiro consolidado do campus (FINANCE, ADMIN)',
        tags: ['Gestão Financeira de Estudantes'],
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Relatório de dívidas, cobranças e inadimplência' } },
      },
    },
    '/api/v1/financial/policies/{id}': {
      patch: {
        summary: 'Actualizar regras da política financeira do campus (FINANCE, ADMIN)',
        tags: ['Gestão Financeira de Estudantes'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateFinancialPolicyInput' } } },
        },
        responses: { '200': { description: 'Política atualizada com sucesso' } },
      },
    },
  },
};
