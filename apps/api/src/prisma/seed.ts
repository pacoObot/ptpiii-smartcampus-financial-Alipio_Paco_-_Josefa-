import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../security/passwords';
import '../config/env';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Seed de demonstracao proibido em producao.');
  const seedPassword = process.env.SMART_CAMPUS_SEED_PASSWORD;
  if (!seedPassword || seedPassword.length < 12)
    throw new Error(
      'Defina SMART_CAMPUS_SEED_PASSWORD com pelo menos 12 caracteres antes de executar o seed.',
    );
  console.log(' A semear dados de teste para o Módulo de Gestão Financeira...');

  // A palavra-passe do ambiente local nunca é incluída no código ou nos logs.
  const passwordHash = await hashPassword(seedPassword);

  // 2. Criar ou atualizar Utilizadores com os vários Perfis (RBAC)
  const adminUser = await prisma.user.upsert({
    where: { id: 'usr_admin_01' },
    update: {
      name: 'Administrador de Teste',
      email: 'admin@smart-campus.test',
      passwordHash,
      role: 'ADMIN',
      department: 'Direção TIC',
      studentId: null,
    },
    create: {
      id: 'usr_admin_01',
      name: 'Administrador de Teste',
      email: 'admin@smart-campus.test',
      passwordHash,
      role: 'ADMIN',
      department: 'Direção TIC',
    },
  });

  const financeUser = await prisma.user.upsert({
    where: { id: 'usr_finance_01' },
    update: {
      name: 'Gestor Financeiro de Teste',
      email: 'finance@smart-campus.test',
      passwordHash,
      role: 'FINANCE',
      department: 'Direção Financeira e Contabilidade',
      studentId: null,
    },
    create: {
      id: 'usr_finance_01',
      name: 'Gestor Financeiro de Teste',
      email: 'finance@smart-campus.test',
      passwordHash,
      role: 'FINANCE',
      department: 'Direção Financeira e Contabilidade',
    },
  });

  const student1 = await prisma.user.upsert({
    where: { id: 'usr_student_01' },
    update: {
      name: 'Estudante de Teste Um',
      email: 'student.one@smart-campus.test',
      passwordHash,
      role: 'STUDENT',
      studentId: 'STUDENT-DEMO-001',
      department: 'Engenharia Informática',
    },
    create: {
      id: 'usr_student_01',
      name: 'Estudante de Teste Um',
      email: 'student.one@smart-campus.test',
      passwordHash,
      role: 'STUDENT',
      studentId: 'STUDENT-DEMO-001',
      department: 'Engenharia Informática',
    },
  });

  const student2 = await prisma.user.upsert({
    where: { id: 'usr_student_02' },
    update: {
      name: 'Estudante de Teste Dois',
      email: 'student.two@smart-campus.test',
      passwordHash,
      role: 'STUDENT',
      studentId: 'STUDENT-DEMO-002',
      department: 'Engenharia Informática',
    },
    create: {
      id: 'usr_student_02',
      name: 'Estudante de Teste Dois',
      email: 'student.two@smart-campus.test',
      passwordHash,
      role: 'STUDENT',
      studentId: 'STUDENT-DEMO-002',
      department: 'Engenharia Informática',
    },
  });

  const teacherUser = await prisma.user.upsert({
    where: { id: 'usr_teacher_01' },
    update: {
      name: 'Docente de Teste',
      email: 'teacher@smart-campus.test',
      passwordHash,
      role: 'TEACHER',
      department: 'Departamento de Computação',
      studentId: null,
    },
    create: {
      id: 'usr_teacher_01',
      name: 'Docente de Teste',
      email: 'teacher@smart-campus.test',
      passwordHash,
      role: 'TEACHER',
      department: 'Departamento de Computação',
    },
  });

  console.log(' Utilizadores de teste criados: ADMIN, FINANCE, STUDENT e TEACHER');

  // 3. Criar ou Atualizar Política Financeira Padrão
  const policy = await prisma.financialPolicy.upsert({
    where: { code: 'DEFAULT_POLICY' },
    update: {},
    create: {
      code: 'DEFAULT_POLICY',
      gracePeriodDays: 5,
      autoBlockEnabled: true,
      maxDebtAmount: 0,
    },
  });
  console.log(' Política financeira padrão criada:', policy.code);

  // 4. Limpar dados financeiros prévios para manter seed limpo e reprodutível
  await prisma.payment.deleteMany({});
  await prisma.analysisRequest.deleteMany({});
  await prisma.financialNotification.deleteMany({});
  await prisma.financialStatus.deleteMany({});
  await prisma.debt.deleteMany({});

  // 5. Criar Dívidas de Teste
  // Dívida 1: propina pendente do estudante de teste um (3500 MZN)
  const debt1 = await prisma.debt.create({
    data: {
      id: 'debt_01',
      code: 'DBT-2026-001',
      studentId: student1.id,
      title: 'Propina de Setembro 2026',
      description: 'Mensalidade do curso de Engenharia Informática',
      amount: 3500.0,
      origin: 'TUITION_2026',
      dueDate: new Date('2026-09-30T23:59:59Z'),
      status: 'PENDENTE',
    },
  });

  // Dívida 2: taxa de exame vencida do estudante de teste um (1500 MZN)
  const debt2 = await prisma.debt.create({
    data: {
      id: 'debt_02',
      code: 'DBT-2026-002',
      studentId: student1.id,
      title: 'Taxa de Exame de Recorrência',
      description: 'Taxa de inscrição para exame especial',
      amount: 1500.0,
      origin: 'EXAM_FEE',
      dueDate: new Date('2026-08-15T23:59:59Z'), // Data passada
      status: 'VENCIDA',
    },
  });

  // Dívida 3: propina regularizada do estudante de teste dois
  const debt3 = await prisma.debt.create({
    data: {
      id: 'debt_03',
      code: 'DBT-2026-003',
      studentId: student2.id,
      title: 'Propina de Agosto 2026',
      description: 'Mensalidade regularizada',
      amount: 0.0,
      origin: 'TUITION_2026',
      dueDate: new Date('2026-08-31T23:59:59Z'),
      status: 'REGULARIZADA',
    },
  });

  // Dívida 4: multa de biblioteca do estudante de teste dois (PENDENTE, 500 MZN)
  const debt4 = await prisma.debt.create({
    data: {
      id: 'debt_04',
      code: 'DBT-2026-004',
      studentId: student2.id,
      title: 'Multa de Atraso de Livro de Biblioteca',
      description: 'Devolução de livro com 5 dias de atraso',
      amount: 500.0,
      origin: 'LIBRARY_FINE',
      dueDate: new Date('2026-10-15T23:59:59Z'),
      status: 'PENDENTE',
    },
  });

  console.log(' Dividas de teste criadas (PENDENTE, VENCIDA, REGULARIZADA)');

  // 6. Criar Pagamento de Teste (Pagamento da Propina de Agosto da Josefa)
  const payment1 = await prisma.payment.create({
    data: {
      id: 'pay_01',
      code: 'PAY-2026-001',
      debtId: debt3.id,
      studentId: student2.id,
      amountPaid: 3500.0,
      paymentMethod: 'BANK_TRANSFER',
      referenceCode: 'REF-BIM-987654',
      confirmedById: financeUser.id,
      paidAt: new Date('2026-08-25T10:30:00Z'),
    },
  });
  console.log(' Pagamento de teste criado:', payment1.code);

  // 7. Configurar Estados Financeiros dos Estudantes
  // O estudante de teste um está BLOCKED por causa da dívida VENCIDA (debt_02)
  await prisma.financialStatus.create({
    data: {
      studentId: student1.id,
      status: 'BLOCKED',
      blockedAt: new Date('2026-08-20T00:00:00Z'),
      reason:
        'Bloqueio automático por dívida vencida (DBT-2026-002: Taxa de Exame de Recorrência).',
    },
  });

  // O estudante de teste dois está ACTIVE
  await prisma.financialStatus.create({
    data: {
      studentId: student2.id,
      status: 'ACTIVE',
    },
  });
  console.log(' Estados financeiros configurados: estudante um (BLOCKED), estudante dois (ACTIVE)');

  // 8. Criar Pedido de Análise / Contestação de Teste
  const analysisReq = await prisma.analysisRequest.create({
    data: {
      id: 'ar_01',
      code: 'AR-2026-001',
      debtId: debt2.id,
      studentId: student1.id,
      reason:
        'Solicito a isenção/anulação da taxa de exame pois apresentei comprovativo de doença na data limite.',
      status: 'PENDENTE_ANALISE',
      slaDueDate: new Date('2026-09-20T23:59:59Z'),
    },
  });
  console.log(' Contestacao de teste criada:', analysisReq.code);

  // 9. Notificação de Teste
  await prisma.financialNotification.create({
    data: {
      studentId: student1.id,
      title: 'Aviso de Bloqueio Financeiro Preventivo',
      message:
        'A sua conta académica encontra-se temporariamente suspensa devido à dívida vencida DBT-2026-002.',
      read: false,
    },
  });
  console.log(' Notificacao de teste emitida');

  console.log('\nSEED CONCLUIDO COM SUCESSO!');
}

main()
  .catch((e) => {
    console.error('Erro durante o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
