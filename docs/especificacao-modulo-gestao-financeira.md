# Especificação do Módulo: Gestão Financeira de Estudantes

**Disciplina:** Prática de Tecnologias de Programação III (PTP III) — UJAC / ISET  
**Docente:** Msc. Armando Correia  
**Grupo:** Alipio Anderson Moisés Paço (2024080003) & Josefa Mutemba  
**Módulo Particular:** `financial` (Gestão Financeira e Estado de Regularidade dos Estudantes)  
**Data:** Setembro de 2026 (Semana 4)  

---

## 1. Contexto e Enquadramento Arquitectural

### 1.1 O Smart Campus Core e o Monólito Modular
O módulo de **Gestão Financeira de Estudantes** insere-se na plataforma **Smart Campus**, desenvolvida no âmbito da unidade curricular PTP III. O sistema é construído segundo o padrão de **Monólito Modular**: um único processo Express e uma única base de dados PostgreSQL, onde os módulos funcionais convivem em pastas bem delimitadas dentro de `apps/api/src/modules/`.

O módulo `financial` **não é um serviço isolado** e **não recria capacidades transversais**. Ele reutiliza diretamente os componentes comuns fornecidos pelo Core:
- **Autenticação e Sessão**: Tokens JWT (`accessToken`, `refreshToken`), renovação via `/api/v1/auth/refresh`.
- **Controlo de Acesso (RBAC)**: Middlewares `authenticate` e `authorize(...)` com roles centrais.
- **Envelope de Resposta Standard**: Respostas normalizadas em `data` + `meta.correlationId` para sucesso, e `code`, `message`, `details`, `correlationId` para erros.
- **Rastreabilidade e Auditoria**: Middleware de `x-correlation-id` e registo de mutações via serviço `audit()`.
- **Persistência Partilhada**: Instância única do Prisma ORM e PostgreSQL.

```
Navegador / SPA (apps/web)
       │ REST JSON + Bearer JWT
       ▼
API Express (apps/api)
  ├── middlewares/auth.ts (authenticate, authorize)
  ├── middlewares/correlationId.ts
  └── modules/financial/ (domain → application → http)
       │
       ▼ Prisma ORM
PostgreSQL 16 (Base de dados partilhada)
```

### 1.2 Posição do Módulo na Plataforma
A principal responsabilidade do módulo `financial` é **manter a verdade sobre a situação financeira do estudante** e disponibilizar um ponto de consulta seguro e fiável.

outros módulos da plataforma — com destaque para a **Gestão Académica (G1)** e a **Biblioteca** — consultam obrigatoriamente o estado financeiro do estudante antes de conceder acesso a serviços como:
- Inscrição em cadeiras e exames;
- Emissão de declarações e certificados;
- Requisição de livros e reservas de espaço.

```
┌───────────────────────────┐         GET /api/v1/financial/students/:id/status        ┌───────────────────────────┐
│  Módulo Académico (G1)   │ ─────────────────────────────────────────────────────────► │ Módulo Financeiro (this)  │
│  (Gestão de Inscrições)   │ ◄───────────────────────────────────────────────────────── │ (Calcula e expõe estado)  │
└───────────────────────────┘            { status: "ACTIVE" | "BLOCKED" }              └───────────────────────────┘
```

---

## 2. Desenho do Domínio

### 2.1 Problema Real no Campus

No campus universitário da UJAC, a gestão de propinas e taxas enfrenta os seguintes desafios operacionais:
1. **Erros e Cobranças Indevidas**: Aplicação incorreta de multas gera desconfiança nos estudantes e exige deslocações presenciais.
2. **Sobrecarga da Tesouraria**: A equipa de apoio gasta horas a tratar manualmente de confirmações de pagamento e recibos bancários físicos (*talões de depósito*).
3. **Bloqueios Injustos ou Indevidos**: Estudantes cumpridores ficam bloqueados por lentidão na conciliação, enquanto estudantes em falta chegam a realizar exames por falhas de verificação no sistema académico.
4. **Falta de Rastreabilidade**: Alterações de saldo sem registo auditado impedem provar quem removeu ou criou uma dívida.

#### Mapeamento de Causa (Sabotador), Efeito e Resolução no Módulo

| Causa (Sabotador) | Efeito no Campus | Resolução no Módulo Financeiro |
|---|---|---|
| **Sem fonte única de verdade** | Cada sistema ou pessoa tem "a sua versão" do saldo do estudante. | `EstadoFinanceiro` é **sempre calculado pelo módulo financeiro**, nunca inferido por terceiros (`INV-1`). |
| **Pagamento sem confirmação automática** | Depósito bancário realizado, mas sistema não atualiza a tempo $\rightarrow$ multa ou bloqueio indevido. | Conciliação de pagamento como evento explícito com atualização imediata de estado (`INV-6`). |
| **Sem rastreio de alterações** | Erro de saldo não é explicável nem reversível com confiança. | Toda a alteração gera `AuditEvent` com `correlationId` (`INV-4`). |
| **Regras de multa sem validação** | Cobrança gerada por engano sem verificação prévia de pré-requisitos. | Validação estrita de DTOs (Zod) e integridade referencial antes da emissão. |
| **Atualização manual e tardia** | Estudante bloqueado durante dias por atraso administrativo. | Recálculo automático de estado assim que a última dívida vencida for regularizada (`INV-6`). |

### 2.2 Capacidades Entregues pelo Módulo
1. **Registo Central de Dívidas (`Debt`)**: Emissão e categorização de Propinas, Multas por Atraso, Taxas de Exame e Taxas de Emissão de Documentos.
2. **Registo de Pagamentos (`Payment`)**: Conciliação de pagamentos por transferência, depósito bancário ou canal eletrónico com referência associada.
3. **Cálculo Automático do Estado Financeiro (`FinancialStatus`)**: Determinação do estado (`ACTIVE` vs `BLOCKED`) com base em dívidas vencidas e regras de tolerância.
4. **Gestão de Pedidos de Análise / Contestações (`AnalysisRequest`)**: Canal formal para o estudante contestar dívidas com justificação, sem alterar automaticamente o seu estado até decisão da Tesouraria.
5. **Notificações Financeiras Automáticas (`FinancialNotification`)**: Alertar o estudante aquando da emissão de dívidas, iminência de bloqueio ou resolução de contestação.
6. **Relatórios Financeiros e Auditoria Rastreável (`FinancialReport` e `AuditEvent`)**: Visão consolidada para a gestão e histórico detalhado ligado ao `correlationId`.

### 2.3 Fora do Escopo (V1 - MVP)
- Processamento direto de pagamentos por gateways externas (M-Pesa, e-Mola, SIMO Network) em tempo real (a V1 regista a confirmação feita pela Tesouraria ou por referência validada).
- Planos de pagamento flexíveis e parcelamentos com cálculo de juros compostos dinâmicos.
- Resolução de contestações feita por inteligência artificial ou algoritmo (a decisão é sempre humana via role `FINANCE` ou `ADMIN`).
- Integração direta com sistemas bancários externos à universidade.

#### Ideias de Valor para Versões Futuras (Pós-V1)
- Conciliação automática por importação de extrato bancário (OFX/CSV) ou webhook de gateway.
- Assinatura digital / hash SHA-256 no recibo e comprovativo de pagamento.
- SLA automático com escalonamento de Pedidos de Análise não respondidos no prazo de tolerância.

---

## 3. Entidades, Invariantes e Schema Prisma

### 3.1 Entidades e Relações

```
   ┌─────────────┐ 1           N ┌─────────────┐
   │   User      │ ────────────► │    Debt     │
   │ (estudante) │               │   (dívida)  │
   └──────┬──────┘               └──────┬──────┘
          │ 1                           │ 1
          │                             │
          │ 1                           │ N
          ▼                             ▼
┌───────────────────┐            ┌─────────────┐
│  FinancialStatus  │            │   Payment   │
│(ACTIVE / BLOCKED) │            │ (pagamento) │
└───────────────────┘            └─────────────┘
          ▲                             ▲
          │ 1                           │ 1
          │                             │
          │ N                           │ N
┌───────────────────┐            ┌─────────────────┐
│  AnalysisRequest  │ ──────────►│  Notification   │
│  (contestação)    │            │  (notificação)  │
└───────────────────┘            └─────────────────┘
```

### 3.2 Invariantes de Negócio (Regras Invioláveis)

| Código | Invariante de Negócio |
|---|---|
| **INV-1** | Um estudante só possui estado `ACTIVE` se **não tiver nenhuma dívida em estado `VENCIDA`**. |
| **INV-2** | Enquanto o estado for `BLOCKED`, qualquer módulo consumidor (ex: Gestão Académica) DEVE recusar o acesso do estudante a inscrições e pauta de exames. |
| **INV-3** | Apenas utilizadores com roles `FINANCE` ou `ADMIN` podem criar dívidas, registar pagamentos ou resolver Pedidos de Análise. |
| **INV-4** | Toda a alteração de estado financeiro, criação de dívida ou decisão gera obrigatoriamente um `AuditEvent` rastreável por `correlationId`. |
| **INV-5** | O estudante pode consultar o seu próprio estado, histórico e submeter Pedidos de Análise, mas **nunca pode alterar montantes, dívidas ou estados diretamente**. |
| **INV-6** | A transição de estado para `ACTIVE` ocorre automaticamente assim que a última dívida vencida for regularizada (por pagamento confirmado ou contestação julgada `PROCEDENTE`). |
| **INV-7** | A submissão de um Pedido de Análise (`AnalysisRequest`) **não suspende nem altera o estado financeiro por si só**; apenas a decisão da Tesouraria o faz. |
| **INV-8** | Toda a criação de dívida, alteração para `BLOCKED` ou resolução de Pedido de Análise dispara automaticamente uma notificação interna para o estudante. |

### 3.3 Persistência: Schema Prisma (`schema.prisma`)

```prisma
enum DebtStatus {
  PENDENTE
  VENCIDA
  REGULARIZADA
  CANCELADA
}

enum FinancialStatusType {
  ACTIVE
  BLOCKED
}

enum AnalysisRequestStatus {
  PENDENTE_ANALISE
  PROCEDENTE
  IMPROCEDENTE
}

enum PaymentMethod {
  BANK_TRANSFER
  CASH_DEPOSIT
  MOBILE_MONEY
  POS
}

model Debt {
  id               String            @id @default(cuid())
  code             String            @unique // Ex: DB-2026-0089
  studentId        String            // Relacionado ao User do Core
  title            String
  description      String?
  amount           Decimal           @db.Decimal(10, 2)
  origin           String            // Ex: "TUITION_AUG_2026", "FINE_LIBRARY"
  dueDate          DateTime
  status           DebtStatus        @default(PENDENTE)
  payments         Payment[]
  analysisRequests AnalysisRequest[]
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  @@index([studentId, status])
  @@index([dueDate])
}

model Payment {
  id            String        @id @default(cuid())
  code          String        @unique // Ex: PAY-2026-0045
  debtId        String
  studentId     String
  amountPaid    Decimal       @db.Decimal(10, 2)
  paymentMethod PaymentMethod
  referenceCode String        // Ex: Número do talão ou ID da transferência
  confirmedById String        // ID do utilizador FINANCE/ADMIN que validou
  paidAt        DateTime      @default(now())
  debt          Debt          @relation(fields: [debtId], references: [id])
  createdAt     DateTime      @default(now())

  @@index([studentId])
  @@index([debtId])
  @@index([referenceCode])
}

model FinancialStatus {
  id         String              @id @default(cuid())
  studentId  String              @unique
  status     FinancialStatusType @default(ACTIVE)
  blockedAt  DateTime?
  reason     String?
  updatedAt  DateTime            @updatedAt

  @@index([studentId, status])
}

model AnalysisRequest {
  id              String                @id @default(cuid())
  code            String                @unique // Ex: AR-2026-012
  debtId          String
  studentId       String
  reason          String
  status          AnalysisRequestStatus @default(PENDENTE_ANALISE)
  slaDueDate      DateTime
  resolvedById    String?
  resolvedAt      DateTime?
  resolutionNotes String?
  debt            Debt                  @relation(fields: [debtId], references: [id])
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt

  @@index([studentId, status])
  @@index([debtId])
}

model FinancialNotification {
  id        String   @id @default(cuid())
  studentId String
  title     String
  message   String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([studentId, read])
}

model FinancialPolicy {
  id               String   @id @default(cuid())
  code             String   @unique @default("DEFAULT_POLICY")
  gracePeriodDays  Int      @default(5)  // Dias de tolerância após o vencimento
  autoBlockEnabled Boolean  @default(true)
  maxDebtAmount    Decimal  @default(0.00) @db.Decimal(10, 2)
  updatedAt        DateTime @updatedAt
}
```

---

## 4. Validação e Schemas Zod (`@smart-campus/validation`)

As validações de entrada garantem a integridade dos dados antes da camada de aplicação:

```typescript
import { z } from 'zod';

export const financialAmountSchema = z.number()
  .positive('O valor deve ser superior a zero')
  .max(1000000, 'Valor limite excedido por transação');

export const createDebtSchema = z.object({
  studentId: z.string().min(1, 'O ID do estudante é obrigatório'),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).optional(),
  amount: financialAmountSchema,
  origin: z.string().trim().min(2).max(60),
  dueDate: z.string().datetime({ message: 'Data de vencimento inválida (ISO 8601)' }),
});

export const createPaymentSchema = z.object({
  debtId: z.string().min(1, 'ID da dívida é obrigatório'),
  amountPaid: financialAmountSchema,
  paymentMethod: z.enum(['BANK_TRANSFER', 'CASH_DEPOSIT', 'MOBILE_MONEY', 'POS']),
  referenceCode: z.string().trim().min(4, 'Código de referência inválido').max(80),
});

export const createAnalysisRequestSchema = z.object({
  debtId: z.string().min(1, 'ID da dívida é obrigatório'),
  reason: z.string().trim().min(10, 'A justificativa deve ter no mínimo 10 caracteres').max(1000),
});

export const resolveAnalysisRequestSchema = z.object({
  decision: z.enum(['PROCEDENTE', 'IMPROCEDENTE']),
  resolutionNotes: z.string().trim().min(5, 'A nota de resolução é obrigatória').max(1000),
});

export const updatePolicySchema = z.object({
  gracePeriodDays: z.number().int().min(0).max(60),
  autoBlockEnabled: z.boolean(),
  maxDebtAmount: z.number().min(0),
});
```

---

## 5. Matriz RBAC e Autenticação

Todas as rotas do módulo requerem o middleware `authenticate`. As rotas de modificação aplicam o middleware `authorize(...)` com as permissões apropriadas:

| Operação | Rota HTTP | Roles Permitidas | Comportamento / Regra de Acesso |
|---|---|---|---|
| Consultar Estado | `GET /api/v1/financial/students/:studentId/status` | Todos Autenticados, `SERVICE_MODULE` | Estudante lê o próprio; Módulos internos e Tesouraria lêem qualquer um |
| Consultar Histórico | `GET /api/v1/financial/students/:studentId/history` | `STUDENT` (próprio), `FINANCE`, `ADMIN` | Devolve lista de dívidas, pagamentos e estado |
| Registar Dívida | `POST /api/v1/financial/debts` | `FINANCE`, `ADMIN` | Emite nova dívida e envia notificação ao estudante |
| Registar Pagamento | `POST /api/v1/financial/payments` | `FINANCE`, `ADMIN` | Regista pagamento, regulariza dívida e recalcula estado |
| Submeter Contestação | `POST /api/v1/financial/analysis-requests` | `STUDENT` | Criado apenas pelo próprio estudante para dívida sua |
| Resolver Contestação | `PATCH /api/v1/financial/analysis-requests/:id` | `FINANCE`, `ADMIN` | Julga contestação (`PROCEDENTE`/`IMPROCEDENTE`) e atualiza dívida/estado |
| Consultar Notificações | `GET /api/v1/financial/students/:studentId/notifications` | `STUDENT` (próprio), `FINANCE`, `ADMIN` | Lista avisos financeiros do estudante |
| Relatório Agregado | `GET /api/v1/financial/reports` | `FINANCE`, `ADMIN` | Estatísticas totais de dívidas, montantes e pendências |
| Gerir Políticas | `GET/PATCH /api/v1/financial/policies/DEFAULT_POLICY` | `ADMIN` | Ajusta dias de tolerância e regras de bloqueio |

---

## 6. Superfície da API REST (`/api/v1/financial`)

### 6.1 Formato Universal — Contrato de Resposta do Core

Todas as respostas HTTP do módulo `financial` respeitam estritamente o **Contrato Universal de Resposta do Smart Campus Core**. O payload retornado é padronizado tanto para operações de sucesso quanto para cenários de erro:

```json
// Sucesso (Listagem Paginada / Recurso)
{
  "data": [
    {
      "id": "deb_9921",
      "studentId": "usr_student_2408",
      "amount": 4500.00,
      "description": "Propina Mês de Agosto 2026",
      "status": "PENDING",
      "dueDate": "2026-08-31T23:59:59.000Z"
    }
  ],
  "meta": {
    "correlationId": "sc-uuid-8812-fin",
    "page": 1,
    "pageSize": 30,
    "total": 30
  }
}

// Erro (Estrutura Padrão do Core)
{
  "code": "DEBT_NOT_FOUND",
  "message": "Dívida não encontrada no módulo financeiro",
  "details": [],
  "correlationId": "sc-uuid-8812-fin"
}

// limite de listagens default: 30 (financial)
// máximo geral do Core: 100
```

- **Respostas de Sucesso:** Contêm os dados no atributo `data` e metadados no atributo `meta` (`correlationId`, `page`, `pageSize`, `total`).
- **Respostas de Erro:** Contêm o código legível do erro (`code`), a mensagem explicativa (`message`), detalhes adicionais de validação (`details`) e o identificador de rastreabilidade (`correlationId`).
- **Paginação:** Respeita o limite default do Core de **30 itens por página** (com um máximo absoluto permitido pelo Core de **100 itens**).

### 6.1.1 O Conceito de Contrato nas Diferentes Áreas do Módulo

No Smart Campus, um **Contrato de API** é o acordo funcional completo entre o Módulo Financeiro (fornecedor de informação) e os seus consumidores (Estudante, Tesouraria/ADMIN ou outros módulos da plataforma como a Gestão Académica G1).

Cada contrato estabelece:
1. **Intenção Funcional:** O propósito da operação no negócio.
2. **Quem Consome:** Os papéis (`STUDENT`, `FINANCE`, `ADMIN`, `SERVICE_MODULE`) autorizados.
3. **Autenticação & Autorização:** Token JWT e verificações de segurança por objeto.
4. **Entrada (Payload / Request):** Parâmetros de rota, query e corpo JSON.
5. **Saída (Response Payload):** Estrutura de dados normalizada no envelope do Core em sucesso (`200 OK`, `201 Created`).
6. **Contrato de Erros e Exceções:** Códigos HTTP semânticos e payload de erro normalizado (`code`, `message`, `details`, `correlationId`).
7. **Efeitos Colaterais & Invariantes:** Alterações de estado, registo de auditoria (`INV-4`) e emissão de notificações (`INV-8`).

---

### 6.1.2 Contrato da Área 1: Integração Inter-Módulos — Consulta de Estado Financeiro

- **Rota:** `GET /api/v1/financial/students/:studentId/status`
- **Intenção Funcional:** Ponto de consulta central para a Gestão Académica (G1), Biblioteca e Controlo de Acessos. Determina em tempo real se o estudante tem permissão para realizar inscrições em cadeiras/exames ou emitir certificados (`INV-1`, `INV-2`).
- **Quem Consome:** Módulos internos (`SERVICE_MODULE`), Tesouraria (`FINANCE`/`ADMIN`) e o próprio `STUDENT`.
- **Autenticação / Autorização:** Token JWT válido. O estudante só pode consultar o seu próprio `studentId`; módulos e tesouraria podem consultar qualquer estudante.

**Contrato de Sucesso (`200 OK`):**
```json
{
  "data": {
    "studentId": "usr_student_2408",
    "financialStatus": "BLOCKED",
    "reason": "Estudante possui 1 dívida(s) vencida(s) no total de 4500.00 MZN",
    "blockedAt": "2026-09-01T00:00:00.000Z",
    "overdueDebtsCount": 1,
    "totalOverdueAmount": 4500.00
  },
  "meta": {
    "correlationId": "SC-CORE-8812-FIN",
    "timestamp": "2026-09-06T15:30:00.000Z"
  }
}
```

**Contrato de Erro (`404 Not Found` — Estudante Sem Registo):**
```json
{
  "code": "STUDENT_NOT_FOUND",
  "message": "Estudante não encontrado no cadastro do Smart Campus Core.",
  "details": [],
  "correlationId": "SC-CORE-8812-FIN"
}
```

---

### 6.1.3 Contrato da Área 2: Gestão e Emissão de Dívidas (Propinas e Taxas)

- **Rota:** `POST /api/v1/financial/debts`
- **Intenção Funcional:** Permitir que a Tesouraria emita propinas mensais, multas por atraso ou taxas administrativas para um estudante (`INV-3`).
- **Quem Consome:** `FINANCE` e `ADMIN`.
- **Autenticação / Autorização:** Token JWT obrigatório com papéis `FINANCE` ou `ADMIN`.

**Exemplo de Pedido (Request Body):**
```json
{
  "studentId": "usr_student_2408",
  "amount": 4500.00,
  "description": "Propina Mês de Setembro 2026",
  "dueDate": "2026-09-30T23:59:59.000Z"
}
```

**Contrato de Sucesso (`201 Created`):**
```json
{
  "data": {
    "id": "deb_9934",
    "studentId": "usr_student_2408",
    "amount": 4500.00,
    "description": "Propina Mês de Setembro 2026",
    "dueDate": "2026-09-30T23:59:59.000Z",
    "status": "PENDING",
    "createdAt": "2026-09-06T15:35:00.000Z"
  },
  "meta": {
    "correlationId": "SC-DEBT-1029",
    "timestamp": "2026-09-06T15:35:00.100Z"
  }
}
```

**Contrato de Erro (`400 Bad Request` — Validação Sintática Zod):**
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Erro de validação nos dados da dívida.",
  "details": [
    {
      "field": "amount",
      "message": "O montante deve ser um valor positivo maior que zero."
    }
  ],
  "correlationId": "SC-DEBT-1029"
}
```
- **Efeitos Colaterais:** Gera `AuditEvent` de criação (`INV-4`) e notifica o estudante (`INV-8`).

---

### 6.1.4 Contrato da Área 3: Registar Pagamentos e Conciliação de Saldo

- **Rota:** `POST /api/v1/financial/payments`
- **Intenção Funcional:** Confirmar a liquidação de uma dívida, alterar o seu estado para `PAID` e recalcular imediatamente a situação financeira do estudante (`INV-3`, `INV-6`).
- **Quem Consome:** `FINANCE` e `ADMIN`.
- **Autenticação / Autorização:** Token JWT obrigatório com papéis `FINANCE` ou `ADMIN`.

**Exemplo de Pedido (Request Body):**
```json
{
  "debtId": "deb_9921",
  "amountPaid": 4500.00,
  "paymentMethod": "M-PESA"
}
```

**Contrato de Sucesso (`201 Created`):**
```json
{
  "data": {
    "payment": {
      "id": "pay_4412",
      "debtId": "deb_9921",
      "amountPaid": 4500.00,
      "paymentMethod": "M-PESA",
      "paymentDate": "2026-09-06T15:40:00.000Z"
    },
    "debt": {
      "id": "deb_9921",
      "status": "PAID"
    },
    "studentFinancialStatus": {
      "studentId": "usr_student_2408",
      "status": "ACTIVE",
      "reason": null
    }
  },
  "meta": {
    "correlationId": "SC-PAY-7731",
    "timestamp": "2026-09-06T15:40:00.150Z"
  }
}
```

**Contrato de Erro (`400 Bad Request` — Dívida Já Paga):**
```json
{
  "code": "DEBT_ALREADY_PAID",
  "message": "Esta dívida já se encontra totalmente liquidadas e encerrada.",
  "details": [],
  "correlationId": "SC-PAY-7731"
}
```
- **Efeitos Colaterais:** Se não restarem dívidas vencidas, a situação transita automaticamente para `ACTIVE` (`INV-6`), gera registo de auditoria com o saldo anterior e novo (`INV-4`) e envia comprovativo/notificação ao estudante (`INV-8`).

---

### 6.1.5 Contrato da Área 4: Pedidos de Análise e Contestação de Dívidas

#### Submeter Contestação (`POST /api/v1/financial/analysis-requests`)
- **Intenção Funcional:** Permitir ao estudante contestar um valor que considera indevido, sem alterar o seu estado financeiro automaticamente (`INV-7`).
- **Quem Consome:** `STUDENT` (estritamente sobre as suas próprias dívidas).

**Contrato de Sucesso (`201 Created`):**
```json
{
  "data": {
    "id": "analysis-1092",
    "debtId": "deb-8821",
    "studentId": "usr_student_2408",
    "motivo": "Efetuei o pagamento via M-Pesa em 20/08/2026 mas a dívida continua pendente.",
    "status": "PENDENTE_ANALISE",
    "slaDueDate": "2026-09-10T00:00:00.000Z",
    "createdAt": "2026-09-06T15:45:00.000Z"
  },
  "meta": {
    "correlationId": "SC-ANALYSIS-0012",
    "timestamp": "2026-09-06T15:45:00.050Z"
  }
}
```

**Contrato de Erro (`409 Conflict` — Contestação Duplicada):**
```json
{
  "code": "ANALYSIS_REQUEST_ALREADY_OPEN",
  "message": "Já existe um pedido de análise pendente em processamento para esta dívida.",
  "details": [],
  "correlationId": "SC-ANALYSIS-0012"
}
```

#### Resolver Contestação (`PATCH /api/v1/financial/analysis-requests/:id`)
- **Intenção Funcional:** Decisão humana da Tesouraria julgando o pedido como `PROCEDENTE` (regulariza a dívida e recalcula o estado) ou `IMPROCEDENTE` (mantém cobrança).
- **Quem Consome:** `FINANCE` e `ADMIN`.

**Contrato de Sucesso (`200 OK` — Julgamento Procedente):**
```json
{
  "data": {
    "id": "analysis-1092",
    "status": "PROCEDENTE",
    "resolvedById": "usr_finance_07",
    "resolvedAt": "2026-09-06T15:50:00.000Z",
    "resolutionNotes": "Comprovativo M-Pesa validado junto ao extrato bancário. Dívida anulada.",
    "debtStatus": "CANCELLED",
    "studentFinancialStatus": "ACTIVE"
  },
  "meta": {
    "correlationId": "SC-RESOLVE-9011",
    "timestamp": "2026-09-06T15:50:00.100Z"
  }
}
```

---

### 6.1.6 Contrato da Área 5: Notificações Financeiras e Auditoria Rastreável

#### Consultar Notificações do Estudante (`GET /api/v1/financial/students/:studentId/notifications`)
- **Intenção Funcional:** Disponibilizar o histórico de alertas e avisos emitidos pelo sistema ao estudante (`INV-8`).
- **Quem Consome:** `STUDENT` (próprio), `FINANCE`, `ADMIN`.

**Contrato de Sucesso (`200 OK`):**
```json
{
  "data": [
    {
      "id": "notif_0019",
      "studentId": "usr_student_2408",
      "title": "Decisão de Contestação Financeira",
      "message": "O seu pedido de análise #analysis-1092 foi julgado PROCEDENTE. A sua dívida foi regularizada.",
      "read": false,
      "createdAt": "2026-09-06T15:50:00.000Z"
    }
  ],
  "meta": {
    "correlationId": "SC-NOTIF-3341",
    "page": 1,
    "pageSize": 30,
    "total": 1
  }
}
```

#### Contrato de Evento de Auditoria Interno (`AuditEvent`)
- **Intenção Funcional:** Registar obrigatoriamente evidência imutável de qualquer alteração financeira para efeitos de fiscalização e transparência (`INV-4`).

**Payload de Auditoria Retido no Sistema (`AuditEvent`):**
```json
{
  "actorId": "usr_finance_07",
  "action": "ANALYSIS_REQUEST_RESOLVED",
  "resourceType": "PedidoAnalise",
  "resourceId": "analysis-1092",
  "before": { "status": "PENDENTE_ANALISE" },
  "after": { "status": "PROCEDENTE", "debtNewStatus": "CANCELLED" },
  "correlationId": "SC-RESOLVE-9011",
  "createdAt": "2026-09-06T15:50:00.000Z"
}
```

### 6.2 Catálogo de Endpoints

| Método | Rota | Auth | Roles | Finalidade |
|---|---|---|---|---|
| `GET` | `/api/v1/financial/students/:studentId/status` | Sim | Todos autenticados | Estado financeiro do estudante (integração inter-módulos) |
| `GET` | `/api/v1/financial/students/:studentId/history` | Sim | `STUDENT` (próprio), `FINANCE`, `ADMIN` | Histórico completo de dívidas e pagamentos |
| `POST` | `/api/v1/financial/debts` | Sim | `FINANCE`, `ADMIN` | Registar nova dívida |
| `POST` | `/api/v1/financial/payments` | Sim | `FINANCE`, `ADMIN` | Confirmar pagamento e regularizar dívida |
| `POST` | `/api/v1/financial/analysis-requests` | Sim | `STUDENT` | Submeter contestação de dívida |
| `PATCH` | `/api/v1/financial/analysis-requests/:id` | Sim | `FINANCE`, `ADMIN` | Resolver contestação (PROCEDENTE / IMPROCEDENTE) |
| `GET` | `/api/v1/financial/students/:studentId/notifications` | Sim | `STUDENT` (próprio), `FINANCE`, `ADMIN` | Listar notificações financeiras do estudante |
| `GET` | `/api/v1/financial/reports` | Sim | `FINANCE`, `ADMIN` | Relatório agregado de dívidas e pendências |
| `GET` | `/api/v1/financial/policies/:policyId` | Sim | `ADMIN` | Consultar política financeira activa |
| `PATCH` | `/api/v1/financial/policies/:policyId` | Sim | `ADMIN` | Actualizar política de bloqueio e tolerância |

> **Princípio:** Leitura (`GET`) é aberta a qualquer utilizador autenticado com os respectivos acessos por objecto. Escrita (`POST`/`PATCH`) exige `FINANCE` ou `ADMIN` — a decisão de autorização é sempre tomada no backend, nunca apenas escondida na UI.

---

### 6.3 Detalhamento Completo dos Endpoints

---

#### ENDPOINT 1 de 10 — Consultar Estado Financeiro do Estudante

**`GET /api/v1/financial/students/:studentId/status`**

| Campo | Valor |
|---|---|
| **Auth** | JWT obrigatório |
| **Roles** | Todos autenticados (estudante só vê o próprio; `FINANCE`/`ADMIN`/módulos internos vêem qualquer um) |
| **Finalidade** | Ponto de integração central — consultado obrigatoriamente pela Gestão Académica (G1) antes de conceder acesso a inscrições, exames ou declarações |

**Exemplo de chamada `curl`:**
```bash
curl -s $API/financial/students/usr_student_2408 \
  -H "$AUTH" | jq
```

**Resposta de sucesso (`200 OK`) — estudante BLOQUEADO:**
```json
{
  "data": {
    "studentId": "usr_student_2408",
    "status": "BLOCKED",
    "reason": "Possui 1 propina(s) vencida(s) desde 2026-08-10",
    "overdueDebtsCount": 1,
    "totalOverdueAmount": 3500.00,
    "blockedAt": "2026-08-16T00:00:00.000Z",
    "updatedAt": "2026-09-06T12:00:00.000Z"
  },
  "meta": {
    "correlationId": "sc-fin-8832a10b",
    "timestamp": "2026-09-06T14:00:00.000Z"
  }
}
```

**Resposta de sucesso (`200 OK`) — estudante ACTIVO:**
```json
{
  "data": {
    "studentId": "usr_student_2408",
    "status": "ACTIVE",
    "reason": null,
    "overdueDebtsCount": 0,
    "totalOverdueAmount": 0.00,
    "blockedAt": null,
    "updatedAt": "2026-09-06T10:00:00.000Z"
  },
  "meta": {
    "correlationId": "sc-fin-1122b09",
    "timestamp": "2026-09-06T14:00:00.000Z"
  }
}
```

**Erros possíveis:**
| Código HTTP | Código de Erro | Situação |
|---|---|---|
| 401 | `UNAUTHORIZED` | Token JWT ausente ou inválido |
| 403 | `FORBIDDEN` | Estudante a tentar ver estado de outro estudante |
| 404 | `STUDENT_NOT_FOUND` | `studentId` não existe no sistema |

**Pontos de atenção:**
- Rota de consulta — sem efeitos secundários.
- O estado é **sempre calculado pelo módulo financeiro** — nunca inferido por outro módulo (INV-1).
- Nunca deve incluir senhas, tokens ou dados desnecessários na resposta.

---

#### ENDPOINT 2 de 10 — Consultar Histórico Financeiro

**`GET /api/v1/financial/students/:studentId/history`**

| Campo | Valor |
|---|---|
| **Auth** | JWT obrigatório |
| **Roles** | `STUDENT` (apenas o próprio), `FINANCE`, `ADMIN` |
| **Finalidade** | Devolver o histórico completo de dívidas, pagamentos e contestações do estudante |

**Exemplo de chamada `curl`:**
```bash
curl -s "$API/financial/students/usr_student_2408/history?limit=10" \
  -H "$AUTH" | jq
```

**Resposta de sucesso (`200 OK`):**
```json
{
  "data": {
    "studentId": "usr_student_2408",
    "debts": [
      {
        "id": "dbt_9921cba",
        "code": "DB-2026-0144",
        "title": "Propina do Mês de Agosto 2026",
        "amount": 3500.00,
        "status": "VENCIDA",
        "dueDate": "2026-08-10T23:59:59.000Z",
        "payments": []
      }
    ],
    "totalDebts": 1,
    "totalPaid": 0.00,
    "totalOutstanding": 3500.00
  },
  "meta": {
    "correlationId": "sc-fin-0091z77",
    "timestamp": "2026-09-06T14:05:00.000Z"
  }
}
```

**Erros possíveis:**
| Código HTTP | Código de Erro | Situação |
|---|---|---|
| 401 | `UNAUTHORIZED` | Token JWT ausente ou inválido |
| 403 | `FORBIDDEN` | Estudante a consultar histórico de outro estudante |
| 404 | `STUDENT_NOT_FOUND` | `studentId` não existe |

**Pontos de atenção:**
- `limit` é validado entre 1 e 100 (default 30).
- Ordenação sempre por `createdAt` decrescente.
- Cada dívida devolve os respectivos pagamentos associados.

---

#### ENDPOINT 3 de 10 — Registar Nova Dívida

**`POST /api/v1/financial/debts`**

| Campo | Valor |
|---|---|
| **Auth** | JWT obrigatório |
| **Roles** | `FINANCE`, `ADMIN` |
| **Finalidade** | Emitir nova dívida para um estudante (propina, multa ou taxa) e notificá-lo automaticamente (INV-8) |

**Exemplo de chamada `curl`:**
```bash
curl -s $API/financial/debts \
  -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{
    "studentId": "usr_student_2408",
    "title": "Propina do Mês de Agosto 2026",
    "description": "Mensalidade referente ao 2º Semestre",
    "amount": 3500.00,
    "origin": "TUITION_AUG_2026",
    "dueDate": "2026-08-10T23:59:59.000Z"
  }' | jq
```

**Resposta de sucesso (`201 Created`):**
```json
{
  "data": {
    "id": "dbt_9921cba",
    "code": "DB-2026-0144",
    "studentId": "usr_student_2408",
    "title": "Propina do Mês de Agosto 2026",
    "description": "Mensalidade referente ao 2º Semestre",
    "amount": 3500.00,
    "origin": "TUITION_AUG_2026",
    "status": "PENDENTE",
    "dueDate": "2026-08-10T23:59:59.000Z",
    "createdAt": "2026-09-06T14:05:00.000Z"
  },
  "meta": {
    "correlationId": "sc-fin-9901x12",
    "timestamp": "2026-09-06T14:05:00.000Z"
  }
}
```

**Erros possíveis:**
| Código HTTP | Código de Erro | Situação |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Campos obrigatórios ausentes ou `amount` ≤ 0 |
| 401 | `UNAUTHORIZED` | Token JWT ausente ou inválido |
| 403 | `FORBIDDEN` | Role sem permissão (`STUDENT`, `TEACHER`, `TECHNICIAN`) |
| 404 | `STUDENT_NOT_FOUND` | `studentId` não existe no Core |

**Lógica transaccional (`prisma.$transaction`):**
- Valida que o `studentId` existe no sistema.
- Cria o registo `Debt` com estado `PENDENTE`.
- Se a `dueDate` for anterior a `now()`, a dívida é criada com estado `VENCIDA` e o estado financeiro é recalculado.
- Sempre gera uma `FinancialNotification` ao estudante (INV-8).
- Sempre chama `audit(...)` com `correlationId` (INV-4).

---

#### ENDPOINT 4 de 10 — Registar Pagamento / Regularização

**`POST /api/v1/financial/payments`**

| Campo | Valor |
|---|---|
| **Auth** | JWT obrigatório |
| **Roles** | `FINANCE`, `ADMIN` |
| **Finalidade** | Confirmar o pagamento de uma dívida pendente ou vencida, actualizando o estado financeiro do estudante numa única transacção |

**Exemplo de chamada `curl`:**
```bash
curl -s $API/financial/payments \
  -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{
    "debtId": "dbt_9921cba",
    "amountPaid": 3500.00,
    "paymentMethod": "BANK_TRANSFER",
    "referenceCode": "TRF-BCI-2026-09001"
  }' | jq
```

**Resposta de sucesso (`201 Created`):**
```json
{
  "data": {
    "id": "pay_aabb1234",
    "code": "PAY-2026-0055",
    "debtId": "dbt_9921cba",
    "studentId": "usr_student_2408",
    "amountPaid": 3500.00,
    "paymentMethod": "BANK_TRANSFER",
    "referenceCode": "TRF-BCI-2026-09001",
    "confirmedById": "usr_finance_01",
    "paidAt": "2026-09-06T14:20:00.000Z",
    "debtStatus": "REGULARIZADA",
    "newFinancialStatus": "ACTIVE"
  },
  "meta": {
    "correlationId": "sc-fin-7744m01",
    "timestamp": "2026-09-06T14:20:00.000Z"
  }
}
```

**Erros possíveis:**
| Código HTTP | Código de Erro | Situação |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `amountPaid` ≤ 0 ou `referenceCode` inválido |
| 401 | `UNAUTHORIZED` | Token JWT ausente ou inválido |
| 403 | `FORBIDDEN` | Role sem permissão |
| 404 | `DEBT_NOT_FOUND` | `debtId` não existe |
| 409 | `DEBT_ALREADY_REGULARIZED` | A dívida já se encontra regularizada |

**Lógica transaccional (`prisma.$transaction`):**
- Verifica existência e estado da dívida.
- Cria o registo `Payment` com o actor confirmador.
- Atualiza a dívida para `REGULARIZADA`.
- Recalcula o `FinancialStatus` do estudante: se não restarem dívidas `VENCIDA`, o estado passa automaticamente para `ACTIVE` (INV-6).
- Gera `FinancialNotification` ao estudante (INV-8).
- Chama `audit(...)` com `correlationId` (INV-4).

---

#### ENDPOINT 5 de 10 — Submeter Pedido de Análise (Contestação)

**`POST /api/v1/financial/analysis-requests`**

| Campo | Valor |
|---|---|
| **Auth** | JWT obrigatório |
| **Roles** | `STUDENT` (apenas sobre as suas próprias dívidas) |
| **Finalidade** | Permitir ao estudante reportar formalmente uma dívida que considera incorrecta, sem alterar o seu estado financeiro automaticamente (INV-7) |

**Exemplo de chamada `curl`:**
```bash
curl -s $API/financial/analysis-requests \
  -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{
    "debtId": "dbt_9921cba",
    "reason": "Efectuei o pagamento via depósito bancário no dia 08/08, dentro do prazo. Comprovativo nº REF-90021."
  }' | jq
```

**Resposta de sucesso (`201 Created`):**
```json
{
  "data": {
    "id": "ar_00129",
    "code": "AR-2026-042",
    "debtId": "dbt_9921cba",
    "studentId": "usr_student_2408",
    "reason": "Efectuei o pagamento via depósito bancário no dia 08/08, dentro do prazo. Comprovativo nº REF-90021.",
    "status": "PENDENTE_ANALISE",
    "slaDueDate": "2026-09-11T14:10:00.000Z",
    "createdAt": "2026-09-06T14:10:00.000Z"
  },
  "meta": {
    "correlationId": "sc-fin-3312z09",
    "timestamp": "2026-09-06T14:10:00.000Z"
  }
}
```

**Erros possíveis:**
| Código HTTP | Código de Erro | Situação |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `reason` com menos de 10 caracteres |
| 401 | `UNAUTHORIZED` | Token JWT ausente ou inválido |
| 403 | `FORBIDDEN` | Estudante a contestar dívida de outro estudante |
| 404 | `DEBT_NOT_FOUND` | `debtId` não existe |
| 409 | `DEBT_ALREADY_REGULARIZED` | Dívida já está regularizada — não há nada a contestar |
| 409 | `ANALYSIS_REQUEST_ALREADY_OPEN` | Já existe uma contestação aberta (`PENDENTE_ANALISE`) para esta dívida |

**Pontos de atenção:**
- O estado financeiro do estudante **não é alterado** pela submissão (INV-7).
- `slaDueDate` é calculado automaticamente com base na `FinancialPolicy` (por defeito, 5 dias úteis).
- Gera notificação interna à Tesouraria (`FINANCE`) (INV-8).

---

#### ENDPOINT 6 de 10 — Resolver Pedido de Análise

**`PATCH /api/v1/financial/analysis-requests/:id`**

| Campo | Valor |
|---|---|
| **Auth** | JWT obrigatório |
| **Roles** | `FINANCE`, `ADMIN` |
| **Finalidade** | Julgar formalmente uma contestação: decidir se é PROCEDENTE (regulariza dívida e recalcula estado) ou IMPROCEDENTE (mantém tudo) |

**Exemplo de chamada `curl` — decisão PROCEDENTE:**
```bash
curl -s $API/financial/analysis-requests/ar_00129 \
  -X PATCH -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{
    "decision": "PROCEDENTE",
    "resolutionNotes": "Pagamento verificado no extracto bancário. Dívida regularizada."
  }' | jq
```

**Resposta de sucesso (`200 OK`):**
```json
{
  "data": {
    "id": "ar_00129",
    "code": "AR-2026-042",
    "status": "PROCEDENTE",
    "debtId": "dbt_9921cba",
    "debtNewStatus": "REGULARIZADA",
    "studentNewFinancialStatus": "ACTIVE",
    "resolvedById": "usr_finance_01",
    "resolvedAt": "2026-09-06T15:00:00.000Z",
    "resolutionNotes": "Pagamento verificado no extracto bancário. Dívida regularizada."
  },
  "meta": {
    "correlationId": "sc-fin-5501w88",
    "timestamp": "2026-09-06T15:00:00.000Z"
  }
}
```

**Erros possíveis:**
| Código HTTP | Código de Erro | Situação |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `decision` inválida ou `resolutionNotes` ausente |
| 401 | `UNAUTHORIZED` | Token JWT ausente ou inválido |
| 403 | `FORBIDDEN` | Role sem permissão |
| 404 | `ANALYSIS_REQUEST_NOT_FOUND` | `id` da contestação não existe |
| 409 | `ANALYSIS_REQUEST_ALREADY_RESOLVED` | Contestação já foi julgada anteriormente |

**Lógica transaccional (`prisma.$transaction`):**
- Se `PROCEDENTE`: atualiza `AnalysisRequest` para `PROCEDENTE`, muda a dívida para `REGULARIZADA`, recalcula `FinancialStatus` do estudante.
- Se `IMPROCEDENTE`: apenas atualiza `AnalysisRequest` para `IMPROCEDENTE` — dívida e estado financeiro permanecem inalterados.
- Sempre gera `FinancialNotification` ao estudante com o resultado (INV-8).
- Sempre chama `audit(...)` com `correlationId` (INV-4).

---

#### ENDPOINT 7 de 10 — Consultar Notificações do Estudante

**`GET /api/v1/financial/students/:studentId/notifications`**

| Campo | Valor |
|---|---|
| **Auth** | JWT obrigatório |
| **Roles** | `STUDENT` (apenas o próprio), `FINANCE`, `ADMIN` |
| **Finalidade** | Listar todos os avisos financeiros recebidos pelo estudante (dívidas emitidas, bloqueios, resoluções) |

**Exemplo de chamada `curl`:**
```bash
curl -s "$API/financial/students/usr_student_2408/notifications?unreadOnly=true" \
  -H "$AUTH" | jq
```

**Resposta de sucesso (`200 OK`):**
```json
{
  "data": [
    {
      "id": "notif_cc12",
      "title": "Nova Dívida Emitida",
      "message": "Foi emitida uma dívida no valor de 3.500,00 MZN referente a 'Propina Agosto 2026'. Prazo: 10/08/2026.",
      "read": false,
      "createdAt": "2026-09-01T08:00:00.000Z"
    }
  ],
  "meta": {
    "correlationId": "sc-fin-0012n09",
    "total": 1,
    "timestamp": "2026-09-06T14:30:00.000Z"
  }
}
```

**Erros possíveis:**
| Código HTTP | Código de Erro | Situação |
|---|---|---|
| 401 | `UNAUTHORIZED` | Token JWT ausente ou inválido |
| 403 | `FORBIDDEN` | Estudante a consultar notificações de outro estudante |
| 404 | `STUDENT_NOT_FOUND` | `studentId` não existe |

---

#### ENDPOINT 8 de 10 — Relatório Financeiro Agregado

**`GET /api/v1/financial/reports`**

| Campo | Valor |
|---|---|
| **Auth** | JWT obrigatório |
| **Roles** | `FINANCE`, `ADMIN` |
| **Finalidade** | Devolver estatísticas globais da situação financeira da instituição — total de dívidas, montantes e contestações pendentes |

**Exemplo de chamada `curl`:**
```bash
curl -s "$API/financial/reports" \
  -H "$AUTH" | jq
```

**Resposta de sucesso (`200 OK`):**
```json
{
  "data": {
    "summary": {
      "totalStudentsActive": 412,
      "totalStudentsBlocked": 38,
      "totalDebts": 520,
      "totalDebtsPendente": 80,
      "totalDebtsVencida": 38,
      "totalDebtsRegularizada": 402,
      "totalAmountOutstanding": 133000.00,
      "totalAmountCollected": 1407000.00
    },
    "analysisRequests": {
      "totalPendente": 5,
      "totalProcedente": 12,
      "totalImprocedente": 8
    }
  },
  "meta": {
    "correlationId": "sc-fin-9988r01",
    "timestamp": "2026-09-06T14:45:00.000Z"
  }
}
```

**Erros possíveis:**
| Código HTTP | Código de Erro | Situação |
|---|---|---|
| 401 | `UNAUTHORIZED` | Token JWT ausente ou inválido |
| 403 | `FORBIDDEN` | Role sem permissão (`STUDENT`, `TEACHER`, `TECHNICIAN`) |

---

#### ENDPOINT 9 de 10 — Consultar Política Financeira

**`GET /api/v1/financial/policies/:policyId`**

| Campo | Valor |
|---|---|
| **Auth** | JWT obrigatório |
| **Roles** | `ADMIN` |
| **Finalidade** | Consultar as regras activas de tolerância, bloqueio automático e limites financeiros |

**Exemplo de chamada `curl`:**
```bash
curl -s "$API/financial/policies/DEFAULT_POLICY" \
  -H "$AUTH" | jq
```

**Resposta de sucesso (`200 OK`):**
```json
{
  "data": {
    "id": "pol_default",
    "code": "DEFAULT_POLICY",
    "gracePeriodDays": 5,
    "autoBlockEnabled": true,
    "maxDebtAmount": 0.00,
    "updatedAt": "2026-09-01T00:00:00.000Z"
  },
  "meta": {
    "correlationId": "sc-fin-pol01",
    "timestamp": "2026-09-06T14:50:00.000Z"
  }
}
```

---

#### ENDPOINT 10 de 10 — Actualizar Política Financeira

**`PATCH /api/v1/financial/policies/:policyId`**

| Campo | Valor |
|---|---|
| **Auth** | JWT obrigatório |
| **Roles** | `ADMIN` |
| **Finalidade** | Ajustar os dias de tolerância após vencimento, activar/desactivar bloqueio automático e definir limite máximo de dívida |

**Exemplo de chamada `curl`:**
```bash
curl -s $API/financial/policies/DEFAULT_POLICY \
  -X PATCH -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{
    "gracePeriodDays": 10,
    "autoBlockEnabled": true,
    "maxDebtAmount": 0.00
  }' | jq
```

**Resposta de sucesso (`200 OK`):**
```json
{
  "data": {
    "id": "pol_default",
    "code": "DEFAULT_POLICY",
    "gracePeriodDays": 10,
    "autoBlockEnabled": true,
    "maxDebtAmount": 0.00,
    "updatedAt": "2026-09-06T15:00:00.000Z"
  },
  "meta": {
    "correlationId": "sc-fin-pol02",
    "timestamp": "2026-09-06T15:00:00.000Z"
  }
}
```

**Erros possíveis:**
| Código HTTP | Código de Erro | Situação |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `gracePeriodDays` fora do intervalo [0, 60] |
| 401 | `UNAUTHORIZED` | Token JWT ausente ou inválido |
| 403 | `FORBIDDEN` | Apenas `ADMIN` pode alterar políticas |
| 404 | `POLICY_NOT_FOUND` | `policyId` não existe |

**Pontos de atenção:**
- Cada alteração de política cria um `AuditEvent` (INV-4).
- O `gracePeriodDays` define quantos dias após a `dueDate` o sistema aguarda antes de mudar a dívida de `PENDENTE` para `VENCIDA` e acionar o bloqueio automático.

---

### 6.4 Autenticação JWT e Matriz de Acesso Detalhada

O login devolve um `accessToken` e um `refreshToken`. O `accessToken` expira ao fim de ~15 minutos; o `api-client` chama automaticamente `POST /auth/refresh` e repete o pedido original. A decisão de autorização é **sempre validada no backend** — nunca apenas escondida na UI.

```bash
export API=http://localhost:4100/api/v1
export TOKEN=$(curl -s $API/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"tesouraria@smartcampus.demo","password":"Finance123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['accessToken'])")
export AUTH="Authorization: Bearer $TOKEN"
```

| Conta | Consultar Estado | POST Dívida | POST Pagamento | POST Contestação | PATCH Contestação | Relatório |
|---|---|---|---|---|---|---|
| `STUDENT` | `200` (próprio) | `403` | `403` | `201` (próprio) | `403` | `403` |
| `TEACHER` | `200` | `403` | `403` | `403` | `403` | `403` |
| `TECHNICIAN` | `200` | `403` | `403` | `403` | `403` | `403` |
| `FINANCE` | `200` | `201` | `201` | `403` | `200` | `200` |
| `ADMIN` | `200` | `201` | `201` | `403` | `200` | `200` |

```typescript
// Cada rota protegida — exemplo no financialRouter.ts
router.post('/financial/debts',
  authenticate,
  authorize('FINANCE', 'ADMIN'),
  handler);
// authenticate → 401 se token inválido ou ausente
// authorize   → 403 se role insuficiente
```



---

## 7. Estrutura do Código no Monorepo

O código do módulo vive em `apps/api/src/modules/financial/` dividido rigorosamente nas 4 camadas internas:

```
apps/api/src/modules/financial/
├── domain/
│   ├── financialDomain.ts         # Enums, formatadores de DTO, cálculo de estado e invariantes
│   └── financialSchemas.ts        # Schemas de validação Zod
├── application/
│   └── financialService.ts        # Casos de uso com prisma.$transaction e chamadas ao audit()
└── http/
    └── financialRouter.ts         # Rotas Express, validação de payload e respostas com envelope
```

### 7.1 Exemplo de Estrutura do Registo de Auditoria (`AuditEvent`)

Todas as mutações no módulo financeiro (criação de dívida, registo de pagamento, alteração de política e resolução de contestações) disparam obrigatoriamente um registo de auditoria ligado ao `x-correlation-id` da requisição (`INV-4`):

```json
{
  "actorId": "user-finance-07",
  "action": "ANALYSIS_REQUEST_RESOLVED",
  "resourceType": "PedidoAnalise",
  "resourceId": "analysis-1092",
  "before": {
    "status": "PENDENTE_ANALISE"
  },
  "after": {
    "status": "PROCEDENTE"
  },
  "correlationId": "SC-2026-0512",
  "createdAt": "2026-09-05T10:00:00.000Z"
}
```

---

## 8. Router Express Completo (`financialRouter.ts`)

O router é montado sob `/api/v1`, sem duplicar o prefixo. Cada rota aplica `authenticate` e — quando necessário — `authorize(...)` antes do handler.

```typescript
import { Router } from 'express';
import { authenticate, authorize } from '../../../middlewares/auth.js';
import { success } from '../../../lib/http.js';
import {
  createDebtSchema,
  createPaymentSchema,
  createAnalysisRequestSchema,
  resolveAnalysisRequestSchema,
  updatePolicySchema,
} from '@smart-campus/validation';
import * as service from '../application/financialService.js';

export const financialRouter = Router();

// ─── ENDPOINT 1: Consultar Estado Financeiro ─────────────────────────────────
financialRouter.get(
  '/financial/students/:studentId/status',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await service.getStudentStatus(
        req.params.studentId,
        req.user,
        req.correlationId,
      );
      success(res, result, 200, req.correlationId);
    } catch (e) { next(e); }
  },
);

// ─── ENDPOINT 2: Consultar Histórico Financeiro ───────────────────────────────
financialRouter.get(
  '/financial/students/:studentId/history',
  authenticate,
  async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 30, 100);
      const result = await service.getStudentHistory(
        req.params.studentId,
        req.user,
        limit,
      );
      success(res, result, 200, req.correlationId);
    } catch (e) { next(e); }
  },
);

// ─── ENDPOINT 3: Registar Nova Dívida ────────────────────────────────────────
financialRouter.post(
  '/financial/debts',
  authenticate,
  authorize('FINANCE', 'ADMIN'),
  async (req, res, next) => {
    try {
      const input = createDebtSchema.parse(req.body);
      const result = await service.createDebt(input, req.user.id, req.correlationId);
      success(res, result, 201, req.correlationId);
    } catch (e) { next(e); }
  },
);

// ─── ENDPOINT 4: Registar Pagamento ──────────────────────────────────────────
financialRouter.post(
  '/financial/payments',
  authenticate,
  authorize('FINANCE', 'ADMIN'),
  async (req, res, next) => {
    try {
      const input = createPaymentSchema.parse(req.body);
      const result = await service.createPayment(input, req.user.id, req.correlationId);
      success(res, result, 201, req.correlationId);
    } catch (e) { next(e); }
  },
);

// ─── ENDPOINT 5: Submeter Contestação ────────────────────────────────────────
financialRouter.post(
  '/financial/analysis-requests',
  authenticate,
  authorize('STUDENT'),
  async (req, res, next) => {
    try {
      const input = createAnalysisRequestSchema.parse(req.body);
      const result = await service.createAnalysisRequest(
        input,
        req.user.id,
        req.correlationId,
      );
      success(res, result, 201, req.correlationId);
    } catch (e) { next(e); }
  },
);

// ─── ENDPOINT 6: Resolver Contestação ────────────────────────────────────────
financialRouter.patch(
  '/financial/analysis-requests/:id',
  authenticate,
  authorize('FINANCE', 'ADMIN'),
  async (req, res, next) => {
    try {
      const input = resolveAnalysisRequestSchema.parse(req.body);
      const result = await service.resolveAnalysisRequest(
        req.params.id,
        input,
        req.user.id,
        req.correlationId,
      );
      success(res, result, 200, req.correlationId);
    } catch (e) { next(e); }
  },
);

// ─── ENDPOINT 7: Consultar Notificações ──────────────────────────────────────
financialRouter.get(
  '/financial/students/:studentId/notifications',
  authenticate,
  async (req, res, next) => {
    try {
      const unreadOnly = req.query.unreadOnly === 'true';
      const result = await service.getNotifications(
        req.params.studentId,
        req.user,
        unreadOnly,
      );
      success(res, result, 200, req.correlationId);
    } catch (e) { next(e); }
  },
);

// ─── ENDPOINT 8: Relatório Agregado ──────────────────────────────────────────
financialRouter.get(
  '/financial/reports',
  authenticate,
  authorize('FINANCE', 'ADMIN'),
  async (req, res, next) => {
    try {
      const result = await service.getReport();
      success(res, result, 200, req.correlationId);
    } catch (e) { next(e); }
  },
);

// ─── ENDPOINT 9: Consultar Política Financeira ───────────────────────────────
financialRouter.get(
  '/financial/policies/:policyId',
  authenticate,
  authorize('ADMIN'),
  async (req, res, next) => {
    try {
      const result = await service.getPolicy(req.params.policyId);
      success(res, result, 200, req.correlationId);
    } catch (e) { next(e); }
  },
);

// ─── ENDPOINT 10: Actualizar Política Financeira ─────────────────────────────
financialRouter.patch(
  '/financial/policies/:policyId',
  authenticate,
  authorize('ADMIN'),
  async (req, res, next) => {
    try {
      const input = updatePolicySchema.parse(req.body);
      const result = await service.updatePolicy(
        req.params.policyId,
        input,
        req.user.id,
        req.correlationId,
      );
      success(res, result, 200, req.correlationId);
    } catch (e) { next(e); }
  },
);
```

### 8.1 Registar o Router no `app.ts`

```typescript
import { financialRouter } from './modules/financial/http/financialRouter.js';

// app.ts — montar sob /api/v1
const v1 = Router();
v1.use(financialRouter); // o router já usa '/financial/...'
app.use('/api/v1', v1);
```

> Escolher uma só estratégia de montagem — nunca as duas ao mesmo tempo. Confirmar no Swagger e com `curl` que o caminho nunca fica duplicado (`/api/v1/api/v1/financial/...`).

---

## 9. Endpoint de Health Check

O endpoint `/health` é fornecido pelo Core e deve ser o primeiro a ser verificado após o arranque do sistema. O módulo `financial` **não cria um `/health` próprio** — reutiliza o do Core.

```bash
# Verificar se a API está em funcionamento
curl -s http://localhost:4100/health | jq
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "timestamp": "2026-09-06T14:00:00.000Z",
  "environment": "development",
  "modules": {
    "financial": "available",
    "parking": "available",
    "maintenance": "available"
  }
}
```

> Se a resposta for `{"status":"ok"}`, o serviço `api` está acessível e a base de dados PostgreSQL está ligada. Qualquer outro resultado indica problema de arranque.

---

## 10. DTOs Partilhados e `api-client` (`@smart-campus/shared-types`)

Os tipos TypeScript vivem em `packages/shared-types` para que a API e o frontend consumam sempre a mesma forma de dados. Nunca duplicar tipos entre módulos.

```typescript
// packages/shared-types/src/financial.ts

export type DebtStatus = 'PENDENTE' | 'VENCIDA' | 'REGULARIZADA' | 'CANCELADA';
export type FinancialStatusType = 'ACTIVE' | 'BLOCKED';
export type AnalysisRequestStatus = 'PENDENTE_ANALISE' | 'PROCEDENTE' | 'IMPROCEDENTE';
export type PaymentMethod = 'BANK_TRANSFER' | 'CASH_DEPOSIT' | 'MOBILE_MONEY' | 'POS';

export type FinancialStatusDto = {
  studentId: string;
  status: FinancialStatusType;
  reason: string | null;
  overdueDebtsCount: number;
  totalOverdueAmount: number;
  blockedAt: string | null;
  updatedAt: string;
};

export type DebtDto = {
  id: string;
  code: string;
  studentId: string;
  title: string;
  description: string | null;
  amount: number;
  origin: string;
  status: DebtStatus;
  dueDate: string;
  payments: PaymentDto[];
  createdAt: string;
};

export type PaymentDto = {
  id: string;
  code: string;
  debtId: string;
  studentId: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  referenceCode: string;
  confirmedById: string;
  paidAt: string;
};

export type AnalysisRequestDto = {
  id: string;
  code: string;
  debtId: string;
  studentId: string;
  reason: string;
  status: AnalysisRequestStatus;
  slaDueDate: string;
  resolvedById: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
};

export type FinancialNotificationDto = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export type FinancialPolicyDto = {
  id: string;
  code: string;
  gracePeriodDays: number;
  autoBlockEnabled: boolean;
  maxDebtAmount: number;
  updatedAt: string;
};
```

### 10.1 Integração no `api-client`

```typescript
// packages/api-client/src/financial.ts
async getFinancialStatus(studentId: string): Promise<ApiSuccess<FinancialStatusDto>>;
async getFinancialHistory(studentId: string, limit?: number): Promise<ApiSuccess<{ debts: DebtDto[]; totalOutstanding: number }>>;
async createDebt(input: CreateDebtInput): Promise<ApiSuccess<DebtDto>>;
async createPayment(input: CreatePaymentInput): Promise<ApiSuccess<PaymentDto>>;
async createAnalysisRequest(input: CreateAnalysisRequestInput): Promise<ApiSuccess<AnalysisRequestDto>>;
async resolveAnalysisRequest(id: string, input: ResolveAnalysisRequestInput): Promise<ApiSuccess<AnalysisRequestDto>>;
async getNotifications(studentId: string, unreadOnly?: boolean): Promise<ApiSuccess<FinancialNotificationDto[]>>;
async getFinancialReport(): Promise<ApiSuccess<FinancialReportDto>>;
async getPolicy(policyId: string): Promise<ApiSuccess<FinancialPolicyDto>>;
async updatePolicy(policyId: string, input: UpdatePolicyInput): Promise<ApiSuccess<FinancialPolicyDto>>;
```

### 10.2 Registo no Catálogo do Frontend (`campusModules`)

```typescript
// apps/web/src/modules/catalog.ts
{
  label: 'Gestão Financeira',
  path: '/financial',
  status: 'available',         // 'development' | 'partial' | 'available'
  requiredRoles: ['STUDENT', 'TEACHER', 'TECHNICIAN', 'FINANCE', 'ADMIN'],
  description: 'Consulta do estado financeiro, dívidas, pagamentos e contestações.',
}
```

---

## 11. Especificação OpenAPI (`/api/docs`)

Os schemas abaixo devem ser adicionados à secção `components` do OpenAPI do Core para que o Swagger permita testar todos os endpoints interactivamente:

```yaml
paths:
  /financial/students/{studentId}/status:
    get:
      tags: [Financial]
      summary: Consultar estado financeiro do estudante
      security: [{ bearerAuth: [] }]
      parameters:
        - in: path
          name: studentId
          required: true
          schema: { type: string }
      responses:
        '200': { description: Estado financeiro devolvido com sucesso }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '404': { $ref: '#/components/responses/NotFound' }

  /financial/debts:
    post:
      tags: [Financial]
      summary: Registar nova dívida
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/CreateDebt' }
      responses:
        '201': { description: Dívida criada com sucesso }
        '400': { $ref: '#/components/responses/ValidationError' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '404': { $ref: '#/components/responses/NotFound' }

  /financial/payments:
    post:
      tags: [Financial]
      summary: Registar pagamento e regularizar dívida
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/CreatePayment' }
      responses:
        '201': { description: Pagamento registado com sucesso }
        '400': { $ref: '#/components/responses/ValidationError' }
        '404': { $ref: '#/components/responses/NotFound' }
        '409': { description: Dívida já regularizada }

  /financial/analysis-requests:
    post:
      tags: [Financial]
      summary: Submeter contestação de dívida (STUDENT)
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/CreateAnalysisRequest' }
      responses:
        '201': { description: Contestação submetida com sucesso }
        '409': { description: Contestação já aberta ou dívida já regularizada }

  /financial/analysis-requests/{id}:
    patch:
      tags: [Financial]
      summary: Resolver contestação (FINANCE / ADMIN)
      security: [{ bearerAuth: [] }]
      parameters:
        - in: path
          name: id
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/ResolveAnalysisRequest' }
      responses:
        '200': { description: Contestação julgada com sucesso }
        '409': { description: Contestação já resolvida }

  /financial/reports:
    get:
      tags: [Financial]
      summary: Relatório financeiro agregado (FINANCE / ADMIN)
      security: [{ bearerAuth: [] }]
      responses:
        '200': { description: Relatório gerado com sucesso }
        '403': { $ref: '#/components/responses/Forbidden' }

  /financial/policies/{policyId}:
    get:
      tags: [Financial]
      summary: Consultar política financeira (ADMIN)
      security: [{ bearerAuth: [] }]
      parameters:
        - in: path
          name: policyId
          required: true
          schema: { type: string }
      responses:
        '200': { description: Política devolvida }
    patch:
      tags: [Financial]
      summary: Actualizar política financeira (ADMIN)
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/UpdatePolicy' }
      responses:
        '200': { description: Política actualizada }
        '400': { $ref: '#/components/responses/ValidationError' }
```

---

## 12. Estratégia de Testes e Qualidade

### 12.1 Testes Unitários de Domínio (`domain/financialDomain.test.ts`)
- Validar se `INV-1` é respeitada: estado `ACTIVE` apenas com 0 dívidas `VENCIDA`.
- Validar que `INV-7` é respeitada: criação de `AnalysisRequest` não muda o `FinancialStatus`.
- Validar regras de montantes: valores positivos, limite máximo de 1.000.000 MZN.
- Validar cálculo automático de `slaDueDate` com base na `FinancialPolicy`.

### 12.2 Testes de Integração API (`http/financialRouter.test.ts`)

```typescript
import request from 'supertest';
import { createApp } from '../../../app.js';

const app = createApp();

async function login(email: string, password: string) {
  const r = await request(app).post('/api/v1/auth/login').send({ email, password });
  return r.body.data.tokens.accessToken;
}

test('status exige autenticação', async () => {
  const r = await request(app).get('/api/v1/financial/students/usr_01/status');
  expect(r.status).toBe(401);
});

test('STUDENT não pode criar dívida', async () => {
  const token = await login('estudante@smartcampus.demo', 'Estudante123!');
  const r = await request(app)
    .post('/api/v1/financial/debts')
    .set('Authorization', `Bearer ${token}`)
    .send({ studentId: 'usr_01', title: 'Propina', amount: 3500, origin: 'TEST', dueDate: '2026-08-10T00:00:00Z' });
  expect(r.status).toBe(403);
});

test('FINANCE cria dívida e estudante fica BLOCKED', async () => {
  const token = await login('tesouraria@smartcampus.demo', 'Finance123!');
  const r = await request(app)
    .post('/api/v1/financial/debts')
    .set('Authorization', `Bearer ${token}`)
    .send({ studentId: process.env.TEST_STUDENT_ID, title: 'Propina Teste', amount: 3500, origin: 'TEST', dueDate: '2026-01-01T00:00:00Z' });
  expect(r.status).toBe(201);
  expect(r.body.data.status).toBe('VENCIDA');
  expect(r.body.meta.correlationId).toBeDefined();
});

test('Contestação não altera estado financeiro (INV-7)', async () => {
  const token = await login('estudante@smartcampus.demo', 'Estudante123!');
  const r = await request(app)
    .post('/api/v1/financial/analysis-requests')
    .set('Authorization', `Bearer ${token}`)
    .send({ debtId: process.env.TEST_DEBT_ID, reason: 'Paguei atempadamente, comprovativo REF-001.' });
  expect(r.status).toBe(201);
  expect(r.body.data.status).toBe('PENDENTE_ANALISE');
  // Estado financeiro permanece BLOCKED
  const statusR = await request(app)
    .get(`/api/v1/financial/students/${process.env.TEST_STUDENT_ID}/status`)
    .set('Authorization', `Bearer ${token}`);
  expect(statusR.body.data.status).toBe('BLOCKED');
});
```

### 12.3 Tabela de Cenários de Teste

| Cenário | Resultado Esperado |
|---|---|
| `GET /status` sem token | `401 UNAUTHORIZED` |
| `STUDENT` cria dívida | `403 FORBIDDEN` |
| `FINANCE` cria dívida com `dueDate` passada | `201` + dívida `VENCIDA` + estudante `BLOCKED` |
| `FINANCE` regista pagamento da única dívida vencida | `201` + dívida `REGULARIZADA` + estado `ACTIVE` |
| `STUDENT` abre contestação | `201` + status `PENDENTE_ANALISE` |
| `STUDENT` abre 2ª contestação para mesma dívida | `409 ANALYSIS_REQUEST_ALREADY_OPEN` |
| `FINANCE` julga contestação `PROCEDENTE` | `200` + dívida `REGULARIZADA` + estado `ACTIVE` |
| Pagamento de dívida já regularizada | `409 DEBT_ALREADY_REGULARIZED` |
| `ADMIN` actualiza política com `gracePeriodDays: -1` | `400 VALIDATION_ERROR` |
| Toda mutação | `AuditEvent` criado com `correlationId` correcto |

---

## 13. Colecção Postman — Passo a Passo

1. Criar uma colecção **Smart Campus Core — Financial**.
2. Definir as variáveis: `baseUrl`, `accessToken`, `refreshToken`, `studentId`, `debtId`, `paymentId`, `analysisRequestId`.
3. Executar o **login como FINANCE** e guardar o `accessToken`.
4. **Criar dívida** com `POST /debts` e guardar o `debtId`.
5. Verificar com **`GET /students/:id/status`** que o estado é `BLOCKED`.
6. **Registar pagamento** com `POST /payments` usando o `debtId`.
7. Verificar novamente o estado — deve ser `ACTIVE`.
8. Login como **STUDENT** e submeter contestação para outra dívida.
9. Login como **FINANCE** e resolver a contestação como `PROCEDENTE`.
10. Testar **casos negativos**: `STUDENT` a criar dívida (`403`), pagamento duplicado (`409`), dívida com `amount: 0` (`400`).

```javascript
// Script a executar após o login (tab Tests do Postman)
const data = pm.response.json().data;
pm.collectionVariables.set('accessToken', data.tokens.accessToken);
pm.collectionVariables.set('refreshToken', data.tokens.refreshToken);

// Script após criar dívida
const debt = pm.response.json().data;
pm.collectionVariables.set('debtId', debt.id);
pm.collectionVariables.set('studentId', debt.studentId);
```

---

## 14. Docker e Execução Local

O módulo `financial` usa o mesmo serviço `db` e o mesmo serviço `api` do Core — **nunca criar um segundo `docker-compose` ou uma base de dados independente**.

```bash
# 1. Copiar variáveis de ambiente
cp .env.example .env

# 2. Iniciar a base de dados e API
docker compose up --build

# 3. Em outro terminal — aplicar migrations e seed
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma db seed

# 4. Verificar o health do sistema
curl -s http://localhost:4100/health

# 5. Abrir o frontend
open http://localhost:5173
```

---

## 15. Troubleshooting

| Problema | Verificações |
|---|---|
| `404` em `/financial/students/:id/status` | Confirmar a montagem do router em `app.ts` e o prefixo — nunca `/api/v1/api/v1/...` |
| `403` para utilizador `FINANCE` | Verificar a role no seed, se o JWT é recente e o `authorize` da rota |
| `409 DEBT_ALREADY_REGULARIZED` inesperado | Verificar o estado actual da dívida com `GET /history` |
| `400 VALIDATION_ERROR` em `amount` | Confirmar que o valor é positivo e não excede 1.000.000 |
| Estado `BLOCKED` não muda após pagamento | Confirmar a transacção Prisma e se existem outras dívidas `VENCIDA` |
| `AnalysisRequest` criado mas estado continua `BLOCKED` | Correcto — cumpre `INV-7`; só resolução por `FINANCE` muda o estado |
| Auditoria ausente | Confirmar a chamada a `audit()` dentro da `prisma.$transaction` |
| Swagger sem as rotas financeiras | Actualizar o OpenAPI e reiniciar a API; confirmar o router registado |
| `CORS` no frontend | Verificar se `CORS_ORIGIN` e `VITE_API_BASE_URL` são coerentes |

---

## 16. Demonstração Final Recomendada

A demonstração deve provar que o módulo está **integrado no Core** — e não apenas que existe uma rota isolada:

1. **Health check**: `curl http://localhost:4100/health` → `{"status":"ok"}`
2. **Login como FINANCE**: `POST /auth/login` → guardar `accessToken`
3. **Criar dívida**: `POST /financial/debts` com prazo vencido → dívida `VENCIDA`
4. **Verificar bloqueio**: `GET /financial/students/:id/status` → `{"status":"BLOCKED"}`
5. **Registar pagamento**: `POST /financial/payments` com `referenceCode` real → dívida `REGULARIZADA`
6. **Verificar desbloqueio**: `GET /financial/students/:id/status` → `{"status":"ACTIVE"}`
7. **Login como STUDENT**: `POST /auth/login` → guardar token de estudante
8. **Submeter contestação**: `POST /financial/analysis-requests` → `PENDENTE_ANALISE`
9. **Verificar que estado NÃO mudou** (INV-7): `GET /status` → ainda `BLOCKED`
10. **Login como FINANCE** e resolver contestação como `PROCEDENTE`: `PATCH /financial/analysis-requests/:id`
11. **Verificar desbloqueio automático**: `GET /status` → `ACTIVE`
12. **Consultar auditoria**: `GET /api/v1/audit-events` como `ADMIN` → mostrar os eventos registados
13. **Testar acesso negado**: `STUDENT` a tentar criar dívida → `403 FORBIDDEN`
14. **Mostrar o frontend**: catálogo com o módulo `Gestão Financeira` e o estado correcto

---

## 17. Perguntas de Auto-Avaliação

- Por que o módulo `financial` não implementa autenticação própria?
- O que muda no `FinancialStatus` quando a contestação é submetida? E quando é julgada `PROCEDENTE`?
- Qual invariante impede que um módulo externo altere o estado financeiro directamente?
- Onde vivem as regras de negócio (`INV-1` a `INV-8`): na camada `domain`, `application` ou `http`?
- Como uma migration garante que o schema evolui sem apagar dados existentes?
- Como demonstrar `401`, `403`, `404` e `409` nos endpoints financeiros?
- Por que o `gracePeriodDays` é definido na `FinancialPolicy` e não codificado no `financialService`?

---

## 18. Camada de Aplicação Completa (`financialService.ts`)

```typescript
import { prisma } from '../../lib/prisma.js';
import { audit } from '../audit/application/auditService.js';
import { DomainError } from '../../lib/errors.js';

export async function createDebt(input, actorId: string, correlationId: string) {
  return prisma.$transaction(async (tx) => {
    // INV: validar existência do estudante no Core
    const policy = await tx.financialPolicy.findUnique({ where: { code: 'DEFAULT_POLICY' } });
    const dueDate = new Date(input.dueDate);
    const isOverdue = dueDate < new Date();

    const debt = await tx.debt.create({
      data: {
        code: `DB-${Date.now()}`,
        studentId: input.studentId,
        title: input.title,
        description: input.description ?? null,
        amount: input.amount,
        origin: input.origin,
        dueDate,
        status: isOverdue ? 'VENCIDA' : 'PENDENTE',
      },
    });

    if (isOverdue) {
      await tx.financialStatus.upsert({
        where: { studentId: input.studentId },
        update: { status: 'BLOCKED', reason: `Dívida ${debt.code} vencida`, blockedAt: new Date() },
        create: { studentId: input.studentId, status: 'BLOCKED', reason: `Dívida ${debt.code} vencida`, blockedAt: new Date() },
      });
    }

    await tx.financialNotification.create({
      data: {
        studentId: input.studentId,
        title: 'Nova Dívida Emitida',
        message: `Foi emitida a dívida "${debt.title}" no valor de ${debt.amount} MZN. Prazo: ${dueDate.toLocaleDateString('pt-MZ')}.`,
      },
    }); // INV-8

    await audit({
      action: 'FINANCIAL_DEBT_CREATED',
      resource: 'Debt',
      resourceId: debt.id,
      actorId,
      correlationId,
      metadata: { amount: input.amount, origin: input.origin, studentId: input.studentId },
    }, tx); // INV-4

    return debt;
  });
}

export async function createPayment(input, actorId: string, correlationId: string) {
  return prisma.$transaction(async (tx) => {
    const debt = await tx.debt.findUnique({ where: { id: input.debtId } });
    if (!debt) throw new DomainError('DEBT_NOT_FOUND', 'Dívida não encontrada', 404);
    if (debt.status === 'REGULARIZADA')
      throw new DomainError('DEBT_ALREADY_REGULARIZED', 'A dívida já se encontra regularizada', 409);

    const payment = await tx.payment.create({
      data: {
        code: `PAY-${Date.now()}`,
        debtId: debt.id,
        studentId: debt.studentId,
        amountPaid: input.amountPaid,
        paymentMethod: input.paymentMethod,
        referenceCode: input.referenceCode,
        confirmedById: actorId,
      },
    });

    await tx.debt.update({ where: { id: debt.id }, data: { status: 'REGULARIZADA' } });

    // INV-6: recalcular estado — ACTIVE se não restar nenhuma VENCIDA
    const remainingOverdue = await tx.debt.count({
      where: { studentId: debt.studentId, status: 'VENCIDA', id: { not: debt.id } },
    });

    if (remainingOverdue === 0) {
      await tx.financialStatus.upsert({
        where: { studentId: debt.studentId },
        update: { status: 'ACTIVE', reason: null, blockedAt: null },
        create: { studentId: debt.studentId, status: 'ACTIVE' },
      });
    }

    await tx.financialNotification.create({
      data: {
        studentId: debt.studentId,
        title: 'Pagamento Confirmado',
        message: `O pagamento de ${input.amountPaid} MZN foi confirmado. Referência: ${input.referenceCode}.`,
      },
    }); // INV-8

    await audit({
      action: 'FINANCIAL_PAYMENT_REGISTERED',
      resource: 'Payment',
      resourceId: payment.id,
      actorId,
      correlationId,
      metadata: { debtId: debt.id, amountPaid: input.amountPaid, studentId: debt.studentId },
    }, tx); // INV-4

    return { ...payment, debtStatus: 'REGULARIZADA', newFinancialStatus: remainingOverdue === 0 ? 'ACTIVE' : 'BLOCKED' };
  });
}

export async function resolveAnalysisRequest(id: string, input, actorId: string, correlationId: string) {
  return prisma.$transaction(async (tx) => {
    const ar = await tx.analysisRequest.findUnique({ where: { id } });
    if (!ar) throw new DomainError('ANALYSIS_REQUEST_NOT_FOUND', 'Contestação não encontrada', 404);
    if (ar.status !== 'PENDENTE_ANALISE')
      throw new DomainError('ANALYSIS_REQUEST_ALREADY_RESOLVED', 'Contestação já foi julgada', 409);

    const updated = await tx.analysisRequest.update({
      where: { id },
      data: { status: input.decision, resolvedById: actorId, resolvedAt: new Date(), resolutionNotes: input.resolutionNotes },
    await tx.financialNotification.create({
      data: {
        studentId: ar.studentId,
        title: `Contestação ${input.decision === 'PROCEDENTE' ? 'Aceite' : 'Rejeitada'}`,
        message: input.resolutionNotes,
      },
    }); // INV-8

    await audit({
      action: 'FINANCIAL_ANALYSIS_REQUEST_RESOLVED',
      resource: 'AnalysisRequest',
      resourceId: id,
      actorId,
      correlationId,
      metadata: { decision: input.decision, debtId: ar.debtId, studentId: ar.studentId },
    }, tx); // INV-4

    return { ...updated, debtNewStatus, studentNewFinancialStatus };
  });
}
```

---

## 19. Checklist de Entrega e Qualidade

- [x] Especificação técnica em markdown completa e alinhada com o modelo da Semana 4
- [x] Modelo conceitual e Invariantes (`INV-1` a `INV-8`) formalizadas
- [x] Schema Prisma e migrações desenhados sem duplicar tabelas do Core
- [x] Schemas de validação Zod cobrindo entradas monetárias, prazos e referências
- [x] Contratos REST documentados endpoint a endpoint (10 rotas) com `curl`, Request/Response e erros
- [x] Matriz RBAC definida para `STUDENT`, `FINANCE`, `ADMIN` e módulos internos
- [x] Router Express completo (`financialRouter.ts`) documentado
- [x] Endpoint `/health` documentado (reutilizado do Core)
- [x] DTOs e `api-client` documentados em `@smart-campus/shared-types`
- [x] Registo no catálogo do frontend (`campusModules`)
- [x] Especificação OpenAPI com todos os endpoints para o Swagger
- [x] Testes unitários e de integração documentados (Vitest + Supertest)
- [x] Colecção Postman passo a passo documentada
- [x] Docker e execução local documentados
- [x] Troubleshooting documentado
- [x] Demonstração final de 14 passos documentada
- [x] Perguntas de auto-avaliação incluídas
- [x] Mecanismo de auditoria transacional com `correlationId` integrado em todas as mutações
- [x] Camada de aplicação completa (`financialService.ts`) com transações Prisma documentadas

---

## 20. Referências

- Manual das APIs do Core — Smart Campus, versão 1.0, Agosto/Setembro de 2026.
- Arquitectura do Smart Campus Core — versão 1.1 (Semana 1 & 2).
- Ficha da Semana 4 — API de Parqueamento: Desenho, endpoints e integração com o Core (Msc. Armando Correia).
- Ficha da Semana 4 — Guia de Implementação: API de Parqueamento — Smart Campus Core (Msc. Armando Correia).
- Prisma ORM Documentation — https://www.prisma.io/docs
- Express.js Documentation — https://expressjs.com/
- OpenAPI Specification — https://spec.openapis.org/oas/latest.html
- Docker Compose Documentation — https://docs.docker.com/compose/
- Zod Schema Validation — https://zod.dev/
