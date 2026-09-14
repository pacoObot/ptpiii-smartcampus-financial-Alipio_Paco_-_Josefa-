import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 A semear dados de teste para o Módulo de Gestão Financeira...');

  // 1. Password padrão para os utilizadores de teste: "123456"
  const passwordHash = await bcrypt.hash('123456', 10);

  // 2. Criar ou atualizar Utilizadores com os vários Perfis (RBAC)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@ujac.ac.mz' },
    update: {},
    create: {
      id: 'usr_admin_01',
      name: 'Administrador Geral',
      email: 'admin@ujac.ac.mz',
      passwordHash,
      role: 'ADMIN',
      department: 'Direção TIC',
    },
  });

  const financeUser = await prisma.user.upsert({
    where: { email: 'financas@ujac.ac.mz' },
    update: {},
    create: {
      id: 'usr_finance_01',
      name: 'Gestor Financeiro',
      email: 'financas@ujac.ac.mz',
      passwordHash,
      role: 'FINANCE',
      department: 'Direção Financeira e Contabilidade',
    },
  });

  const student1 = await prisma.user.upsert({
    where: { email: 'alipio.paco@estudante.ujac.ac.mz' },
    update: {},
    create: {
      id: 'usr_student_01',
      name: 'Alípio Anderson Moisés Paço',
      email: 'alipio.paco@estudante.ujac.ac.mz',
      passwordHash,
      role: 'STUDENT',
      studentId: '2024080003',
      department: 'Engenharia Informática',
    },
  });

  const student2 = await prisma.user.upsert({
    where: { email: 'josefa.muthemba@estudante.ujac.ac.mz' },
    update: {},
    create: {
      id: 'usr_student_02',
      name: 'Josefa Muthemba',
      email: 'josefa.muthemba@estudante.ujac.ac.mz',
      passwordHash,
      role: 'STUDENT',
      studentId: '2024080038',
      department: 'Engenharia Informática',
    },
  });

  const teacherUser = await prisma.user.upsert({
    where: { email: 'docente@ujac.ac.mz' },
    update: {},
    create: {
      id: 'usr_teacher_01',
      name: 'Professor Docente',
      email: 'docente@ujac.ac.mz',
      passwordHash,
      role: 'TEACHER',
      department: 'Departamento de Computação',
    },
  });

  console.log('✅ Utilizadores RBAC criados: ADMIN, FINANCE, STUDENT (Alípio & Josefa), TEACHER');

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
  console.log('✅ Política financeira padrão criada:', policy.code);

  // 4. Limpar dados financeiros prévios para manter seed limpo e reprodutível
  await prisma.payment.deleteMany({});
  await prisma.analysisRequest.deleteMany({});
  await prisma.financialNotification.deleteMany({});
  await prisma.financialStatus.deleteMany({});
  await prisma.debt.deleteMany({});

  // 5. Criar Dívidas de Teste
  // Dívida 1: Propina Pendente de Alípio (3500 MZN)
  const debt1 = await prisma.debt.create({
    data: {
      id: 'debt_01',
      code: 'DBT-2026-001',
      studentId: student1.id,
      title: 'Propina de Setembro 2026',
      description: 'Mensalidade do curso de Engenharia Informática',
      amount: 3500.00,
      origin: 'TUITION_2026',
      dueDate: new Date('2026-09-30T23:59:59Z'),
      status: 'PENDENTE',
    },
  });

  // Dívida 2: Taxa de Exame VENCIDA de Alípio (1500 MZN) -> Provoca Bloqueio
  const debt2 = await prisma.debt.create({
    data: {
      id: 'debt_02',
      code: 'DBT-2026-002',
      studentId: student1.id,
      title: 'Taxa de Exame de Recorrência',
      description: 'Taxa de inscrição para exame especial',
      amount: 1500.00,
      origin: 'EXAM_FEE',
      dueDate: new Date('2026-08-15T23:59:59Z'), // Data passada
      status: 'VENCIDA',
    },
  });

  // Dívida 3: Propina de Agosto da Josefa (REGULARIZADA)
  const debt3 = await prisma.debt.create({
    data: {
      id: 'debt_03',
      code: 'DBT-2026-003',
      studentId: student2.id,
      title: 'Propina de Agosto 2026',
      description: 'Mensalidade regularizada',
      amount: 0.00,
      origin: 'TUITION_2026',
      dueDate: new Date('2026-08-31T23:59:59Z'),
      status: 'REGULARIZADA',
    },
  });

  // Dívida 4: Multa de Biblioteca da Josefa (PENDENTE, 500 MZN)
  const debt4 = await prisma.debt.create({
    data: {
      id: 'debt_04',
      code: 'DBT-2026-004',
      studentId: student2.id,
      title: 'Multa de Atraso de Livro de Biblioteca',
      description: 'Devolução de livro com 5 dias de atraso',
      amount: 500.00,
      origin: 'LIBRARY_FINE',
      dueDate: new Date('2026-10-15T23:59:59Z'),
      status: 'PENDENTE',
    },
  });

  console.log('✅ Dívidas de teste criadas (PENDENTE, VENCIDA, REGULARIZADA)');

  // 6. Criar Pagamento de Teste (Pagamento da Propina de Agosto da Josefa)
  const payment1 = await prisma.payment.create({
    data: {
      id: 'pay_01',
      code: 'PAY-2026-001',
      debtId: debt3.id,
      studentId: student2.id,
      amountPaid: 3500.00,
      paymentMethod: 'BANK_TRANSFER',
      referenceCode: 'REF-BIM-987654',
      confirmedById: financeUser.id,
      paidAt: new Date('2026-08-25T10:30:00Z'),
    },
  });
  console.log('✅ Pagamento de teste criado:', payment1.code);

  // 7. Configurar Estados Financeiros dos Estudantes
  // Alípio está BLOCKED por causa da dívida VENCIDA (debt_02)
  await prisma.financialStatus.create({
    data: {
      studentId: student1.id,
      status: 'BLOCKED',
      blockedAt: new Date('2026-08-20T00:00:00Z'),
      reason: 'Bloqueio automático por dívida vencida (DBT-2026-002: Taxa de Exame de Recorrência).',
    },
  });

  // Josefa está ACTIVE
  await prisma.financialStatus.create({
    data: {
      studentId: student2.id,
      status: 'ACTIVE',
    },
  });
  console.log('✅ Estados financeiros configurados: Alípio (BLOCKED), Josefa (ACTIVE)');

  // 8. Criar Pedido de Análise / Contestação de Teste
  const analysisReq = await prisma.analysisRequest.create({
    data: {
      id: 'ar_01',
      code: 'AR-2026-001',
      debtId: debt2.id,
      studentId: student1.id,
      reason: 'Solicito a isenção/anulação da taxa de exame pois apresentei comprovativo de doença na data limite.',
      status: 'PENDENTE_ANALISE',
      slaDueDate: new Date('2026-09-20T23:59:59Z'),
    },
  });
  console.log('✅ Contestação de teste criada:', analysisReq.code);

  // 9. Notificação de Teste
  await prisma.financialNotification.create({
    data: {
      studentId: student1.id,
      title: 'Aviso de Bloqueio Financeiro Preventivo',
      message: 'A sua conta académica encontra-se temporariamente suspensa devido à dívida vencida DBT-2026-002.',
      read: false,
    },
  });
  console.log('✅ Notificação de teste emitida');

  console.log('\n🎉 SEED CONCLUÍDO COM SUCESSO!');
}

main()
  .catch((e) => {
    console.error('❌ Erro durante o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
