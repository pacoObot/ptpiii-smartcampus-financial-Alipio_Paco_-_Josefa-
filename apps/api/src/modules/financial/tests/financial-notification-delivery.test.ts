import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { randomUUID } from 'crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../../app';
import { env } from '../../../config/env';
import { prisma } from '../infrastructure/financialRepository';
import { dispatchNotification, dispatchPendingNotifications, getNotificationDelivery } from '../application/notificationDeliveryService';
import { createDebt, createPayment, createAnalysisRequest, resolveAnalysisRequest } from '../application/financialService';

const prefix = `notification-test-${randomUUID()}`;
const studentId = `${prefix}-student`;
const operatorId = `${prefix}-operator`;
const correlationId = `${prefix}-correlation`;
const token = (id: string, role: string) => `Bearer ${jwt.sign({ id, role }, env.JWT_SECRET)}`;
const operatorToken = token(operatorId, 'FINANCE');
const originalConfig = {
  url: env.NOTIFICATIONS_API_URL, token: env.NOTIFICATIONS_API_TOKEN, timeout: env.NOTIFICATIONS_TIMEOUT_MS,
};
let server: Server;
let url: string;
let mode: 'ok' | 'error' | 'wrong-ack' | 'timeout' | 'lost-ack' | 'slow' = 'ok';
let received: Array<{ body: any; headers: any }> = [];
const remoteRecords = new Map<string, string>();

async function makeNotice() {
  return prisma.financialNotification.create({ data: {
    studentId, title: 'Aviso de teste', message: 'Mensagem de teste',
    eventType: 'DEBT_CREATED', resourceId: 'test-resource', correlationId,
  } });
}

beforeAll(async () => {
  await prisma.user.createMany({ data: [
    { id: studentId, name: 'Aluno teste', email: `${studentId}@example.test`, passwordHash: 'unused', role: 'STUDENT' },
    { id: operatorId, name: 'Operador teste', email: `${operatorId}@example.test`, passwordHash: 'unused', role: 'FINANCE' },
  ] });
  server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    received.push({ body, headers: req.headers });
    if (mode === 'timeout') return;
    if (mode === 'slow') await new Promise(resolve => setTimeout(resolve, 60));
    if (mode === 'error') { res.writeHead(503); res.end('unavailable'); return; }
    const existed = remoteRecords.has(body.sourceEventId);
    const id = remoteRecords.get(body.sourceEventId) ?? `remote-${body.sourceEventId}`;
    remoteRecords.set(body.sourceEventId, id);
    if (mode === 'lost-ack') { res.writeHead(500); res.end(); return; }
    res.writeHead(existed ? 200 : 201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: { id, sourceEventId: mode === 'wrong-ack' ? 'wrong' : body.sourceEventId, status: 'ACCEPTED' } }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/notifications`;
});

beforeEach(() => {
  env.NOTIFICATIONS_API_URL = url;
  env.NOTIFICATIONS_API_TOKEN = 'test-service-token';
  env.NOTIFICATIONS_TIMEOUT_MS = 1000;
  mode = 'ok'; received = [];
});

afterEach(() => { jest.restoreAllMocks(); });
afterAll(async () => {
  env.NOTIFICATIONS_API_URL = originalConfig.url;
  env.NOTIFICATIONS_API_TOKEN = originalConfig.token;
  env.NOTIFICATIONS_TIMEOUT_MS = originalConfig.timeout;
  if (server) {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
  await prisma.financialNotification.deleteMany({ where: { studentId } });
  await prisma.analysisRequest.deleteMany({ where: { studentId } });
  await prisma.payment.deleteMany({ where: { studentId } });
  await prisma.debt.deleteMany({ where: { studentId } });
  await prisma.financialStatus.deleteMany({ where: { studentId } });
  await prisma.auditEvent.deleteMany({ where: { userId: { in: [studentId, operatorId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [studentId, operatorId] } } });
  await prisma.$disconnect();
});

test('sem configuracao: conserva PENDING e nao faz pedidos HTTP', async () => {
  env.NOTIFICATIONS_API_URL = '';
  const n = await makeNotice();
  await dispatchNotification(n.id);
  expect(await getNotificationDelivery(n.id)).toMatchObject({ deliveryStatus: 'PENDING', attempts: 0 });
  expect(received).toHaveLength(0);
  const response = await request(app).post(`/api/v1/financial/notifications/${n.id}/retry`).set('Authorization', operatorToken).send({});
  expect(response.status).toBe(503);
  expect(response.body.code).toBe('NOTIFICATIONS_NOT_CONFIGURED');
});

test('envia contrato, credencial de servico, correlacao e chave de idempotencia', async () => {
  const n = await makeNotice();
  await dispatchNotification(n.id);
  expect(received[0].body).toEqual({ sourceModule: 'financial', sourceEventId: n.id, recipientUserId: studentId,
    eventType: 'DEBT_CREATED', resourceId: 'test-resource', title: n.title, message: n.message,
    channel: 'IN_APP', occurredAt: n.createdAt.toISOString() });
  expect(received[0].headers).toMatchObject({ authorization: 'Bearer test-service-token',
    'idempotency-key': `financial:${n.id}`, 'x-correlation-id': correlationId });
  expect(await getNotificationDelivery(n.id)).toMatchObject({ deliveryStatus: 'SENT', externalNotificationId: `remote-${n.id}`, attempts: 1 });
  await dispatchNotification(n.id);
  expect(received).toHaveLength(1);
});

test.each(['error', 'wrong-ack', 'timeout'] as const)('%s: conserva aviso, regista falha e agenda nova tentativa', async failure => {
  mode = failure; env.NOTIFICATIONS_TIMEOUT_MS = 100;
  const n = await makeNotice();
  await dispatchNotification(n.id);
  const result = await getNotificationDelivery(n.id);
  expect(result.deliveryStatus).toBe('FAILED');
  expect(result.externalNotificationId).toBeNull();
  expect(result.lastError).toMatch(/^NOTIFICATIONS_/);
  expect(new Date(result.nextAttemptAt!).getTime()).toBeGreaterThan(Date.now());
});

test('reenvio apos confirmacao perdida usa o mesmo evento sem duplicar no receptor', async () => {
  mode = 'lost-ack';
  const n = await makeNotice();
  await dispatchNotification(n.id);
  mode = 'ok';
  const response = await request(app).post(`/api/v1/financial/notifications/${n.id}/retry`).set('Authorization', operatorToken).send({});
  expect(response.status).toBe(200);
  expect(response.body.data).toMatchObject({ deliveryStatus: 'SENT', attempts: 2, externalNotificationId: remoteRecords.get(n.id) });
  expect(received).toHaveLength(2);
  expect(received[0].headers['idempotency-key']).toBe(received[1].headers['idempotency-key']);
  expect(await prisma.auditEvent.count({ where: { resourceId: n.id, action: 'NOTIFICATION_RETRY_REQUESTED' } })).toBe(1);
});

test('duas tentativas concorrentes resultam num unico envio', async () => {
  mode = 'slow';
  const n = await makeNotice();
  await Promise.all([dispatchNotification(n.id), dispatchNotification(n.id)]);
  expect(received).toHaveLength(1);
  expect((await getNotificationDelivery(n.id)).deliveryStatus).toBe('SENT');
});

test('recupera envio abandonado depois de expirar a reserva', async () => {
  const n = await makeNotice();
  await prisma.financialNotification.update({ where: { id: n.id }, data: {
    deliveryStatus: 'PROCESSING', lockedUntil: new Date(0), lockToken: 'abandoned', attempts: 1,
  } });
  await dispatchNotification(n.id);
  expect(await getNotificationDelivery(n.id)).toMatchObject({ deliveryStatus: 'SENT', attempts: 2 });
});

test('historico LOCAL_ONLY nao e enviado, incluindo por retry', async () => {
  const n = await makeNotice();
  await prisma.financialNotification.update({ where: { id: n.id }, data: { deliveryStatus: 'LOCAL_ONLY' } });
  await dispatchNotification(n.id);
  const response = await request(app).post(`/api/v1/financial/notifications/${n.id}/retry`).set('Authorization', operatorToken).send({});
  expect(response.status).toBe(200);
  expect(response.body.data.deliveryStatus).toBe('LOCAL_ONLY');
  expect(received).toHaveLength(0);
});

test('endpoints exigem autenticacao, perfil e corpo valido; consulta devolve estado', async () => {
  const n = await makeNotice();
  for (const suffix of ['retry', 'delivery']) {
    const path = `/api/v1/financial/notifications/${n.id}/${suffix}`;
    const call = () => suffix === 'retry' ? request(app).post(path) : request(app).get(path);
    expect((await call()).status).toBe(401);
    expect((await call().set('Authorization', token(studentId, 'STUDENT'))).status).toBe(403);
  }
  expect((await request(app).post(`/api/v1/financial/notifications/${n.id}/retry`).set('Authorization', operatorToken).send({ url: 'arbitrary' })).status).toBe(400);
  expect((await request(app).get('/api/v1/financial/notifications/missing/delivery').set('Authorization', operatorToken)).status).toBe(404);
  const result = await request(app).get(`/api/v1/financial/notifications/${n.id}/delivery`).set('Authorization', operatorToken);
  expect(result.status).toBe(200);
  expect(result.body.data.deliveryStatus).toBe('PENDING');
  expect(result.body.meta.correlationId).toBeTruthy();
});

test('divida e pagamento mantem sucesso mesmo com API externa indisponivel', async () => {
  mode = 'error';
  const debt = await createDebt({ studentId, title: 'Propina teste envio', amount: 100, origin: 'TEST_SUITE', dueDate: '2027-01-01T00:00:00.000Z' }, operatorId, correlationId);
  const payment = await createPayment({ debtId: debt.id, amountPaid: 100, paymentMethod: 'BANK_TRANSFER', referenceCode: `${prefix}-payment` }, operatorId, correlationId);
  expect(payment.debtStatus).toBe('REGULARIZADA');
  const notices = await prisma.financialNotification.findMany({ where: { resourceId: { in: [debt.id, payment.payment.id] } } });
  expect(notices).toHaveLength(2);
  expect(notices.every(n => n.deliveryStatus === 'FAILED')).toBe(true);
  expect(notices.map(n => n.eventType).sort()).toEqual(['DEBT_CREATED', 'PAYMENT_CONFIRMED']);
});

test('resolucao de contestacao envia o aviso associado ao pedido', async () => {
  const debt = await createDebt({ studentId, title: 'Contestacao teste', amount: 100, origin: 'TEST_SUITE', dueDate: '2027-01-01T00:00:00.000Z' }, operatorId, correlationId);
  const analysis = await createAnalysisRequest({ debtId: debt.id, reason: 'Justificacao de teste de integracao' }, studentId, correlationId);
  await resolveAnalysisRequest(analysis.id, { decision: 'IMPROCEDENTE', resolutionNotes: 'Decisao de teste' }, operatorId, correlationId);
  const notice = await prisma.financialNotification.findFirstOrThrow({ where: { resourceId: analysis.id } });
  expect(notice.eventType).toBe('ANALYSIS_REQUEST_RESOLVED');
  expect(notice.deliveryStatus).toBe('SENT');
});

test('rollback financeiro tambem remove o aviso e nao envia HTTP', async () => {
  const before = await prisma.financialNotification.count({ where: { studentId } });
  await expect(prisma.$transaction(async tx => {
    await tx.financialNotification.create({ data: { studentId, title: 'Rollback', message: 'Nao enviar' } });
    throw new Error('rollback-test');
  })).rejects.toThrow('rollback-test');
  expect(await prisma.financialNotification.count({ where: { studentId } })).toBe(before);
  expect(received).toHaveLength(0);
});


test('processador automatico recupera um aviso falhado quando chega a proxima tentativa', async () => {
  const n = await makeNotice();
  await prisma.financialNotification.update({ where: { id: n.id }, data: {
    deliveryStatus: 'FAILED', nextAttemptAt: new Date(0), attempts: 1,
  } });
  // Isolate the batch from unrelated notices in the shared development database.
  jest.spyOn(prisma.financialNotification, 'findMany').mockResolvedValue([n]);
  await dispatchPendingNotifications();
  expect(received).toHaveLength(1);
  expect(await getNotificationDelivery(n.id)).toMatchObject({ deliveryStatus: 'SENT', attempts: 2 });
});
