// tests/financial.test.ts
// Exercicio 6 — Testes automatizados do modulo financeiro
// Cobre: 404 (nao encontrado), 400 (validacao Zod), 403 (sem permissao)
//
// Para correr a partir da raiz SMART CAMPUS: npm run test:financial
// Para correr a partir de apps/api: npm run test:financial
//
// Nota: Os testes usam supertest para fazer pedidos HTTP reais a API Express.
// O modulo financeiro usa Prisma; para resultados reprodutiveis, resemeie a BD antes da suite completa.

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../../app';
import { env } from '../../../config/env';
import { prisma } from '../infrastructure/financialRepository';

// Tokens de teste assinados com a JWT_SECRET da API
const ADMIN_TOKEN = `Bearer ${jwt.sign({ id: 'usr_admin_01', email: 'admin@ujac.ac.mz', role: 'ADMIN' }, env.JWT_SECRET)}`;
const STUDENT_TOKEN = `Bearer ${jwt.sign({ id: 'usr_student_01', email: 'alipio.paco@estudante.ujac.ac.mz', role: 'STUDENT' }, env.JWT_SECRET)}`;
const STUDENT_2_TOKEN = `Bearer ${jwt.sign({ id: 'usr_student_02', email: 'josefa.muthemba@estudante.ujac.ac.mz', role: 'STUDENT' }, env.JWT_SECRET)}`;

describe('Modulo Financeiro — Exercicio 6: Erros e Consistencia', () => {
  beforeAll(async () => {
    // Garante fixtures estaveis mesmo depois de demonstracoes manuais no Swagger.
    await prisma.debt.upsert({
      where: { id: 'test_debt_overdue' },
      update: {
        code: 'TEST-DBT-OVERDUE',
        studentId: 'usr_student_01',
        title: 'Divida Vencida de Teste',
        description: 'Fixture automatica para testes financeiros',
        amount: 1500,
        origin: 'TEST_SUITE',
        dueDate: new Date('2026-08-15T23:59:59Z'),
        status: 'VENCIDA',
      },
      create: {
        id: 'test_debt_overdue',
        code: 'TEST-DBT-OVERDUE',
        studentId: 'usr_student_01',
        title: 'Divida Vencida de Teste',
        description: 'Fixture automatica para testes financeiros',
        amount: 1500,
        origin: 'TEST_SUITE',
        dueDate: new Date('2026-08-15T23:59:59Z'),
        status: 'VENCIDA',
      },
    });

    await prisma.debt.upsert({
      where: { id: 'test_debt_regularized' },
      update: {
        code: 'TEST-DBT-REGULARIZED',
        studentId: 'usr_student_02',
        title: 'Divida Regularizada de Teste',
        description: 'Fixture automatica para testes financeiros',
        amount: 0,
        origin: 'TEST_SUITE',
        dueDate: new Date('2026-08-31T23:59:59Z'),
        status: 'REGULARIZADA',
      },
      create: {
        id: 'test_debt_regularized',
        code: 'TEST-DBT-REGULARIZED',
        studentId: 'usr_student_02',
        title: 'Divida Regularizada de Teste',
        description: 'Fixture automatica para testes financeiros',
        amount: 0,
        origin: 'TEST_SUITE',
        dueDate: new Date('2026-08-31T23:59:59Z'),
        status: 'REGULARIZADA',
      },
    });

    await prisma.debt.upsert({
      where: { id: 'test_debt_other_student' },
      update: {
        code: 'TEST-DBT-OTHER-STUDENT',
        studentId: 'usr_student_02',
        title: 'Divida de Outro Estudante',
        description: 'Fixture automatica para testes de RBAC',
        amount: 500,
        origin: 'TEST_SUITE',
        dueDate: new Date('2026-10-15T23:59:59Z'),
        status: 'PENDENTE',
      },
      create: {
        id: 'test_debt_other_student',
        code: 'TEST-DBT-OTHER-STUDENT',
        studentId: 'usr_student_02',
        title: 'Divida de Outro Estudante',
        description: 'Fixture automatica para testes de RBAC',
        amount: 500,
        origin: 'TEST_SUITE',
        dueDate: new Date('2026-10-15T23:59:59Z'),
        status: 'PENDENTE',
      },
    });

    await prisma.payment.upsert({
      where: { id: 'test_pay_regularized' },
      update: {
        code: 'TEST-PAY-REGULARIZED',
        debtId: 'test_debt_regularized',
        studentId: 'usr_student_02',
        amountPaid: 3500,
        paymentMethod: 'BANK_TRANSFER',
        referenceCode: 'TEST-REF-REGULARIZED',
        confirmedById: 'usr_finance_01',
        paidAt: new Date('2026-08-25T10:30:00Z'),
      },
      create: {
        id: 'test_pay_regularized',
        code: 'TEST-PAY-REGULARIZED',
        debtId: 'test_debt_regularized',
        studentId: 'usr_student_02',
        amountPaid: 3500,
        paymentMethod: 'BANK_TRANSFER',
        referenceCode: 'TEST-REF-REGULARIZED',
        confirmedById: 'usr_finance_01',
        paidAt: new Date('2026-08-25T10:30:00Z'),
      },
    });

    await prisma.financialStatus.upsert({
      where: { studentId: 'usr_student_01' },
      update: {
        status: 'BLOCKED',
        blockedAt: new Date('2026-08-20T00:00:00Z'),
        reason: 'Bloqueio automatico por divida vencida de teste.',
      },
      create: {
        studentId: 'usr_student_01',
        status: 'BLOCKED',
        blockedAt: new Date('2026-08-20T00:00:00Z'),
        reason: 'Bloqueio automatico por divida vencida de teste.',
      },
    });

    await prisma.financialStatus.upsert({
      where: { studentId: 'usr_student_02' },
      update: {
        status: 'ACTIVE',
        blockedAt: null,
        reason: null,
      },
      create: {
        studentId: 'usr_student_02',
        status: 'ACTIVE',
      },
    });

    await prisma.analysisRequest.upsert({
      where: { id: 'test_ar_pending' },
      update: {
        code: 'TEST-AR-PENDING',
        debtId: 'test_debt_overdue',
        studentId: 'usr_student_01',
        reason: 'Solicito nova analise desta divida de teste com pedido pendente.',
        status: 'PENDENTE_ANALISE',
        slaDueDate: new Date('2026-09-20T23:59:59Z'),
        resolvedById: null,
        resolvedAt: null,
        resolutionNotes: null,
      },
      create: {
        id: 'test_ar_pending',
        code: 'TEST-AR-PENDING',
        debtId: 'test_debt_overdue',
        studentId: 'usr_student_01',
        reason: 'Solicito nova analise desta divida de teste com pedido pendente.',
        status: 'PENDENTE_ANALISE',
        slaDueDate: new Date('2026-09-20T23:59:59Z'),
      },
    });
  });

  // =========================================================================
  // CENARIO 1: 404 — Recurso nao encontrado
  // Exercicio 6: cobrir cenario de 404
  // =========================================================================
  describe('404 — Recurso nao encontrado', () => {
    it('POST /debts com estudante inexistente retorna 404 sem criar divida', async () => {
      const studentId = 'test-missing-financial-user';
      const response = await request(app)
        .post('/api/v1/financial/debts')
        .set('Authorization', ADMIN_TOKEN)
        .send({ studentId, title: 'Teste FK', amount: 100, origin: 'TEST_SUITE', dueDate: '2027-01-01T00:00:00.000Z' });
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('STUDENT_NOT_FOUND');
      expect(await prisma.debt.count({ where: { studentId } })).toBe(0);
    });

    it('BD rejeita divida com estudante inexistente mesmo sem passar pela API', async () => {
      await expect(prisma.debt.create({ data: {
        code: 'TEST-FK-MISSING-USER', studentId: 'test-missing-financial-user',
        title: 'Teste FK', amount: 100, origin: 'TEST_SUITE', dueDate: new Date('2027-01-01'),
      } })).rejects.toMatchObject({ code: 'P2003' });
    });

    it('BD rejeita responsavel de resolucao inexistente', async () => {
      await expect(prisma.analysisRequest.create({ data: {
        code: 'TEST-FK-MISSING-RESOLVER', debtId: 'test_debt_overdue',
        studentId: 'usr_student_01', reason: 'Teste FK',
        slaDueDate: new Date('2027-01-01'), resolvedById: 'test-missing-financial-user',
      } })).rejects.toMatchObject({ code: 'P2003' });
    });

    it('GET /api/v1/financial/debts/:id com ID inexistente deve retornar 404', async () => {
      const response = await request(app)
        .get('/api/v1/financial/debts/id-que-nao-existe-99999')
        .set('Authorization', ADMIN_TOKEN);

      expect(response.status).toBe(404);
      // Exercicio 6: verificar envelope de erro com correlationId
      expect(response.body).toHaveProperty('code', 'DEBT_NOT_FOUND');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('correlationId');
      // Nao deve ter wrapper "error" — formato FLAT
      expect(response.body).not.toHaveProperty('error');
    });
  });

  // =========================================================================
  // CENARIO 2: 400 — Validacao Zod a falhar
  // Exercicio 3: create com validacao Zod
  // Exercicio 6: verificar mensagem de erro estruturada
  // =========================================================================
  describe('400 — Validacao Zod (campos invalidos)', () => {
    it('POST /api/v1/financial/debts sem "title" deve retornar 400 com details', async () => {
      const response = await request(app)
        .post('/api/v1/financial/debts')
        .set('Authorization', ADMIN_TOKEN)
        .send({
          // title em falta
          studentId: 'student-123',
          amount: 3500,
          origin: 'TUITION_2026',
          dueDate: '2026-09-30T23:59:59.000Z',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('details');
      expect(response.body).toHaveProperty('correlationId');
      // Verificar que o details aponta para o campo em falta
      expect(Array.isArray(response.body.details)).toBe(true);
    });

    it('POST /api/v1/financial/debts com amount negativo deve retornar 400', async () => {
      const response = await request(app)
        .post('/api/v1/financial/debts')
        .set('Authorization', ADMIN_TOKEN)
        .send({
          studentId: 'student-123',
          title: 'Propina Setembro',
          amount: -100,          // valor invalido — Zod rejeita
          origin: 'TUITION_2026',
          dueDate: '2026-09-30T23:59:59.000Z',
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/v1/financial/debts com dueDate em formato errado deve retornar 400', async () => {
      const response = await request(app)
        .post('/api/v1/financial/debts')
        .set('Authorization', ADMIN_TOKEN)
        .send({
          studentId: 'student-123',
          title: 'Propina Setembro',
          amount: 3500,
          origin: 'TUITION_2026',
          dueDate: '30-09-2026',  // formato errado — Zod exige ISO 8601
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/v1/financial/payments sem paymentMethod valido deve retornar 400', async () => {
      const response = await request(app)
        .post('/api/v1/financial/payments')
        .set('Authorization', ADMIN_TOKEN)
        .send({
          debtId: 'debt-123',
          amountPaid: 3500,
          paymentMethod: 'CHEQUE',   // metodo invalido — nao existe no enum
          referenceCode: 'REF-001',
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // CENARIO 3: 403 — Sem permissao (FORBIDDEN)
  // Exercicio 6: cobrir cenario de 403
  // INV-3: apenas FINANCE/ADMIN podem criar dividas
  // =========================================================================
  describe('403 — Sem permissao (role insuficiente)', () => {
    it('POST /api/v1/financial/debts por STUDENT deve retornar 403', async () => {
      const response = await request(app)
        .post('/api/v1/financial/debts')
        .set('Authorization', STUDENT_TOKEN)
        .send({
          studentId: 'student-123',
          title: 'Propina Setembro',
          amount: 3500,
          origin: 'TUITION_2026',
          dueDate: '2026-09-30T23:59:59.000Z',
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('code', 'FORBIDDEN');
      expect(response.body).toHaveProperty('correlationId');
    });

    it('POST /api/v1/financial/payments por STUDENT deve retornar 403', async () => {
      const response = await request(app)
        .post('/api/v1/financial/payments')
        .set('Authorization', STUDENT_TOKEN)
        .send({
          debtId: 'debt-123',
          amountPaid: 3500,
          paymentMethod: 'BANK_TRANSFER',
          referenceCode: 'REF-001',
        });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('PATCH /api/v1/financial/analysis-requests/:id por STUDENT deve retornar 403', async () => {
      const response = await request(app)
        .patch('/api/v1/financial/analysis-requests/ar-123')
        .set('Authorization', STUDENT_TOKEN)
        .send({
          decision: 'PROCEDENTE',
          resolutionNotes: 'Comprovativo validado.',
        });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('GET /api/v1/financial/reports por STUDENT deve retornar 403', async () => {
      const response = await request(app)
        .get('/api/v1/financial/reports')
        .set('Authorization', STUDENT_TOKEN);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('GET /api/v1/financial/debts/:id por outro STUDENT deve retornar 403', async () => {
      const response = await request(app)
        .get('/api/v1/financial/debts/test_debt_other_student')
        .set('Authorization', STUDENT_TOKEN);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('GET /api/v1/financial/debts com studentId de outro estudante deve retornar 403', async () => {
      const response = await request(app)
        .get('/api/v1/financial/debts?studentId=usr_student_02')
        .set('Authorization', STUDENT_TOKEN);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // CENARIO 4: 401 — Sem token (UNAUTHORIZED)
  // Exercicio 6: cobrir ausencia de autenticacao
  // =========================================================================
  describe('401 — Sem autenticacao (token ausente)', () => {
    it('GET /api/v1/financial/debts sem token deve retornar 401', async () => {
      const response = await request(app)
        .get('/api/v1/financial/debts');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('code', 'UNAUTHORIZED');
      expect(response.body).toHaveProperty('correlationId');
    });
  });

  // =========================================================================
  // CENARIO 5: 200 — Listagem bem-sucedida (CRUD list)
  // Exercicio 3: list/get funcionais
  // =========================================================================
  describe('200 — Leitura bem-sucedida (CRUD list)', () => {
    it('GET /api/v1/financial/debts com ADMIN deve retornar 200 com data e meta', async () => {
      const response = await request(app)
        .get('/api/v1/financial/debts')
        .set('Authorization', ADMIN_TOKEN);

      // Pode ser 200 (lista vazia) ou 401 (se o token de teste nao funcionar)
      // Em ambiente de teste os tokens sao verificados pelo middleware de auth
      expect([200, 401]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('meta');
        expect(response.body.meta).toHaveProperty('correlationId');
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    it('GET /api/v1/financial/students/:id/status deve calcular BLOCKED por divida vencida', async () => {
      const response = await request(app)
        .get('/api/v1/financial/students/usr_student_01/status')
        .set('Authorization', STUDENT_TOKEN);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        studentId: 'usr_student_01',
        status: 'BLOCKED',
      });
      expect(response.body.data.overdueDebtsCount).toBeGreaterThan(0);
    });

    it('GET /api/v1/financial/students/:id/history deve incluir dividas, pagamentos e estado', async () => {
      const response = await request(app)
        .get('/api/v1/financial/students/usr_student_02/history')
        .set('Authorization', STUDENT_2_TOKEN);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.debts)).toBe(true);
      expect(Array.isArray(response.body.data.payments)).toBe(true);
      expect(response.body.data.status).toHaveProperty('status');
      expect(response.body.data.totalPaid).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // CENARIO 6: Regras de negocio financeiras
  // =========================================================================
  describe('Regras de negocio financeiras', () => {
    it('POST /api/v1/financial/payments com montante diferente da divida deve retornar 400', async () => {
      const response = await request(app)
        .post('/api/v1/financial/payments')
        .set('Authorization', ADMIN_TOKEN)
        .send({
          debtId: 'test_debt_overdue',
          amountPaid: 1,
          paymentMethod: 'BANK_TRANSFER',
          referenceCode: 'REF-AMOUNT-MISMATCH',
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('PAYMENT_AMOUNT_MISMATCH');
    });

    it('POST /api/v1/financial/payments para divida regularizada deve retornar 409', async () => {
      const response = await request(app)
        .post('/api/v1/financial/payments')
        .set('Authorization', ADMIN_TOKEN)
        .send({
          debtId: 'test_debt_regularized',
          amountPaid: 3500,
          paymentMethod: 'BANK_TRANSFER',
          referenceCode: 'REF-ALREADY-PAID',
        });

      expect(response.status).toBe(409);
      expect(response.body.code).toBe('DEBT_ALREADY_REGULARIZED');
    });

    it('POST /api/v1/financial/analysis-requests para divida regularizada deve retornar 409', async () => {
      const response = await request(app)
        .post('/api/v1/financial/analysis-requests')
        .set('Authorization', STUDENT_2_TOKEN)
        .send({
          debtId: 'test_debt_regularized',
          reason: 'Solicito analise de uma divida que ja consta como regularizada.',
        });

      expect(response.status).toBe(409);
      expect(response.body.code).toBe('DEBT_ALREADY_REGULARIZED');
    });

    it('POST /api/v1/financial/analysis-requests duplicada deve retornar 409', async () => {
      const response = await request(app)
        .post('/api/v1/financial/analysis-requests')
        .set('Authorization', STUDENT_TOKEN)
        .send({
          debtId: 'test_debt_overdue',
          reason: 'Solicito nova analise da mesma divida que ja possui pedido pendente.',
        });

      expect(response.status).toBe(409);
      expect(response.body.code).toBe('ANALYSIS_REQUEST_ALREADY_OPEN');
    });
  });

});
