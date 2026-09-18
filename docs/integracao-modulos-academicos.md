# Contratos propostos — Financeiro e módulos académicos

> A referência central para partilha e evolução dos contratos é [Contratos Financial](contratos-financial.md). Este documento conserva o detalhe anterior à consolidação.

**Estado: proposta para discussão com os grupos de Estudantes e Docentes, Avaliações e Horários.** Apenas a consulta financeira indicada como existente está implementada. Os restantes endpoints, campos e permissões abaixo precisam de implementação e acordo; não representam APIs já fornecidas pelos outros grupos.

Ver [atributos, cardinalidades e diagrama conceptual](exercicio-1/atributos-e-relacoes.md#relações-propostas-com-os-módulos-académicos). O [contrato de Notificações](integracao-notificacoes.md) permanece aplicável aos avisos.

## Responsabilidades e decisões de negócio

| Módulo | Fornece | Consome |
|---|---|---|
| Estudantes e Docentes | Identidade académica ligada ao User.id; situação académica; identificação do docente responsável | Regularidade financeira para operações de inscrição sujeitas à política institucional |
| Avaliações | Avaliação, inscrição e pedido de taxa de exame/recurso | Regularidade financeira para acesso às notas e situação da dívida específica da inscrição |
| Horários | Sessão da avaliação, data, sala e docente responsável | Inscrições confirmadas por Avaliações para compor a lista de participantes |
| Financeiro | Dívida, confirmação de pagamento e regularidade financeira | Identidade académica, inscrição de origem e contexto da sessão |

A relação com Horários é de contexto e planeamento: o Financeiro pode consultar a sessão para identificar a cobrança; Horários recebe de Avaliações as inscrições confirmadas. Consultar o horário normal de aulas não depende de uma dívida. Não se propõe cobrar pela simples criação ou alteração de um horário.

`ACTIVE` significa regularidade financeira segundo as regras do Financeiro, não aprovação académica nem prova de pagamento de uma taxa específica. Para confirmar inscrição numa avaliação paga, Avaliações deve verificar tanto a regularidade como a liquidação da taxa associada. `BLOCKED` impede a confirmação da inscrição nesta proposta; a especificação financeira já prevê restrições às inscrições e pautas de exames. Para o acesso do estudante às notas, a regra acordada nesta modelação é explícita: ACTIVE permite a consulta e BLOCKED impede a consulta. As notas, inscrições e horários existentes continuam guardados. A implementação entre grupos permanece pendente.

## Convenções comuns do contrato v1

- Rotas `/api/v1`, JSON e datas ISO 8601 com fuso horário, preferencialmente UTC (`Z`). IDs são strings opacas.
- Identidade partilhada: `studentUserId` e `teacherUserId` são `User.id`. No Financeiro, o campo existente `studentId` também contém esse ID. IDs de perfis académicos e números de matrícula não o substituem.
- Sucesso: `{ "data": ..., "meta": { "correlationId": "...", "timestamp": "..." } }`. Erro: `{ "code": "...", "message": "...", "correlationId": "..." }`, com `details` opcional. Propagar `x-correlation-id` também no cabeçalho de resposta.
- Consultas devolvem `200`; recursos desconhecidos, `404`; dados inválidos, `400`; ausência de autenticação, `401`; falta de permissão, `403`; conflito, `409`; indisponibilidade, `503`.
- Para APIs de grupos separados, usar HTTPS e credenciais de serviço restritas por consumidor e operação. As permissões descritas abaixo são propostas, ainda não suportadas pelo middleware JWT actual. Não reutilizar a conta ADMIN como identidade de um módulo.
- No monólito, a mesma fronteira pode ser uma interface de aplicação com os mesmos DTOs e autorizações. Cada módulo escreve apenas nos dados de que é responsável; não se criam FK entre bases externas.
- Montantes dos novos contratos são strings decimais com duas casas e moeda `MZN`; a consulta financeira existente usa números. Nunca devolver passwordHash, credenciais, histórico de pagamentos ou saldos a Horários.

## C1 — Identidade académica

**Fornecedor:** Estudantes e Docentes. **Consumidores:** Financeiro e Avaliações, com permissão de leitura de identidade académica.

`GET /api/v1/academic/students/by-user/:userId`

Exemplo de `data`:

```json
{
  "id": "student_001",
  "userId": "usr_student_01",
  "studentNumber": "2024080003",
  "academicStatus": "ACTIVE"
}
```

Os quatro campos são obrigatórios. O Financeiro valida a correspondência com o utilizador local antes de aceitar uma cobrança. Perfil inexistente retorna `404 STUDENT_NOT_FOUND`; indisponibilidade não equivale a estudante inexistente. A inactivação académica não apaga dívidas nem altera automaticamente o estado financeiro.

`GET /api/v1/academic/teachers/by-user/:userId` fornece `data: { id, userId, departmentId }`, sendo `departmentId` anulável. Horários usa esta consulta para validar o responsável; o Financeiro só a usa se precisar desse contexto. Ser docente não autoriza criar dívidas nem confirmar pagamentos.

## C2 — Regularidade financeira

**Existente:** `GET /api/v1/financial/students/:studentId/status`.

O endpoint usa JWT do Core. Actualmente impede STUDENT de consultar outro estudante, mas não implementa permissões específicas para identidades de módulos. Retorna em `data`: `studentId`, `status`, `reason`, `blockedAt`, `overdueDebtsCount`, `totalOverdueAmount` e `updatedAt`.

**Limites observados no código actual:** a consulta não verifica se o estudante existe e pode devolver ACTIVE para um ID desconhecido; calcula o estado a partir das dívidas já marcadas VENCIDA. Estes comportamentos precisam de ser tratados antes de usar esta rota como decisão automática entre grupos. `updatedAt` não é uma versão de decisão nem garante que houve actualização dos vencimentos.

**Contrato mínimo proposto para integração:** `GET /api/v1/financial/integration/students/:studentUserId/standing`, acessível a Estudantes e Docentes e Avaliações com permissão de consulta de regularidade.

```json
{
  "data": {
    "studentUserId": "usr_student_01",
    "status": "ACTIVE",
    "checkedAt": "2026-09-18T08:00:00.000Z"
  },
  "meta": {
    "correlationId": "corr_001",
    "timestamp": "2026-09-18T08:00:00.000Z"
  }
}
```

Todos os campos são obrigatórios; `status` é ACTIVE ou BLOCKED. A implementação deve validar a existência e o perfil do estudante, actualizar/considerar os vencimentos segundo a política financeira e devolver `404 STUDENT_NOT_FOUND` para identidade desconhecida. Não expõe montantes nem motivos detalhados aos consumidores académicos.

Consulta imediatamente antes da confirmação da operação. A resposta é uma observação naquele instante, não uma reserva: alterações posteriores não cancelam automaticamente uma inscrição confirmada. Timeout/503 deixa a operação pendente para nova tentativa, sem atribuir ACTIVE ou BLOCKED por defeito.

### C2.1 — Aplicação da regularidade ao acesso às notas

**Responsável pela decisão e bloqueio:** API de Avaliações. **Fonte do estado:** Financeiro, pelo contrato C2. Esta regra de modelação foi confirmada; a integração ainda não está implementada.

Antes de cada pedido do estudante que devolva notas (listagem, detalhe ou exportação), Avaliações verifica a identidade e autorização académica e consulta a regularidade pelo ID do Core. Nesta versão, não reutiliza uma decisão antiga guardada na sessão.

| Resposta do Financeiro | Resposta da API de Avaliações ao estudante |
|---|---|
| 200 com ACTIVE para o estudante pedido | Prossegue com a consulta das próprias notas, sujeita às regras académicas. |
| 200 com BLOCKED para o estudante pedido | `403 FINANCIAL_ACCESS_BLOCKED`, sem notas no corpo. |
| Timeout, 429/5xx, resposta inválida ou identidade divergente | `503 FINANCIAL_VERIFICATION_UNAVAILABLE`, sem notas; permite nova tentativa. |
| 404 STUDENT_NOT_FOUND | `404 STUDENT_NOT_FOUND`, sem notas; requer correcção da identidade. |
| 401/403 na chamada entre módulos | Tratar como falha de configuração da integração: `503 FINANCIAL_VERIFICATION_UNAVAILABLE`, sem notas, e registar para correcção. |

Exemplo do bloqueio devolvido por Avaliações, usando o envelope comum:

```json
{
  "code": "FINANCIAL_ACCESS_BLOCKED",
  "message": "A consulta das notas está indisponível. Regularize a sua situação financeira.",
  "correlationId": "corr_001"
}
```

Uma falha de comunicação apresenta a mensagem «Não foi possível verificar a regularidade financeira. Tente novamente.» e nunca deve ser apresentada como dívida confirmada. Depois da regularização, uma nova consulta com ACTIVE permite o acesso. O bloqueio afecta a leitura pelo estudante, não o armazenamento nem o lançamento das notas pelos docentes. A restrição deve existir no servidor; esconder ligações ou botões não impede acesso directo à API.

## C3 — Avaliação e pedido de cobrança

**Fornecedor da inscrição:** Avaliações. **Consumidor:** Financeiro.

`GET /api/v1/assessments/registrations/:registrationId`

`data` obrigatório: `id: string`, `assessmentId: string`, `studentUserId: string`, `status: PENDING | CONFIRMED | CANCELLED`; `scheduleSessionId: string | null` é obrigatório mas anulável. O Financeiro valida estudante, inscrição não cancelada e correspondência com a sessão indicada. Se necessário, `GET /api/v1/assessments/:assessmentId` fornece `data: { id, courseUnitId, type }`, todos strings obrigatórias.

**Fornecedor da cobrança:** Financeiro. **Consumidor autorizado:** serviço de Avaliações.

```http
POST /api/v1/financial/integration/assessment-charges
Authorization: Bearer <credencial-de-servico>
Idempotency-Key: assessments:req_001
x-correlation-id: corr_001
Content-Type: application/json
```

```json
{
  "sourceModule": "assessments",
  "sourceRequestId": "req_001",
  "studentUserId": "usr_student_01",
  "externalRegistrationId": "registration_001",
  "externalScheduleSessionId": "session_001",
  "feeCode": "EXAM_RESIT"
}
```

Todos os campos são strings não vazias obrigatórias, excepto `externalScheduleSessionId`, opcional/anulável. `sourceModule` é fixo e deve corresponder à identidade autenticada. O Financeiro define valor, descrição e vencimento a partir de um catálogo de taxas aprovado, ainda a implementar. Avaliações não escolhe livremente montantes nem confirma pagamentos. Código de taxa desconhecido: `400 UNKNOWN_FEE_CODE`; identidade ou inscrição desconhecida: `404`; divergência de estudante/sessão ou inscrição cancelada: `409 REGISTRATION_CONFLICT`.

Resposta `201` na criação e `200` na repetição idêntica, com o mesmo `debtId`:

```json
{
  "data": {
    "sourceRequestId": "req_001",
    "debtId": "debt_001",
    "studentUserId": "usr_student_01",
    "externalRegistrationId": "registration_001",
    "feeCode": "EXAM_RESIT",
    "amount": "1500.00",
    "currency": "MZN",
    "dueDate": "2026-09-25T21:59:59.000Z",
    "status": "PENDENTE"
  },
  "meta": { "correlationId": "corr_001", "timestamp": "2026-09-18T08:00:00.000Z" }
}
```

Todos os campos da resposta são obrigatórios. `status` usa DebtStatus. Criação e deduplicação devem ser atómicas, com as duas restrições de unicidade propostas na modelação. Repetir a chave com conteúdo diferente devolve `409 IDEMPOTENCY_CONFLICT`; pedir a mesma taxa da mesma inscrição com nova chave devolve `409 CHARGE_ALREADY_EXISTS`. Preservar os valores originais em repetições, mesmo se o catálogo mudar. Guardar o pedido normalizado para comparação, incluindo a sessão opcional.

`GET /api/v1/financial/integration/assessment-charges/:debtId` devolve o mesmo formato com o estado actual. Avaliações apenas pode consultar cobranças da sua origem; o consumidor confirma a correspondência de estudante, inscrição e taxa. `REGULARIZADA` permite considerar a taxa liquidada; PENDENTE/VENCIDA mantém a inscrição pendente; CANCELADA exige revisão da cobrança, não prova de pagamento. Uma contestação procedente pode regularizar a dívida sem pagamento, conforme a regra financeira existente.

## C4 — Contexto de Horários

**Fornecedor:** Horários. **Consumidores:** Avaliações e Financeiro, com leitura de sessões de avaliação.

`GET /api/v1/schedules/sessions/:sessionId`

Exemplo de `data`, com todos os campos obrigatórios:

```json
{
  "id": "session_001",
  "assessmentId": "assessment_001",
  "responsibleTeacherUserId": "usr_teacher_01",
  "roomId": "room_001",
  "startsAt": "2026-09-28T08:00:00.000Z",
  "endsAt": "2026-09-28T10:00:00.000Z",
  "status": "SCHEDULED"
}
```

`endsAt` deve ser posterior a `startsAt`; `status` aceita SCHEDULED/CANCELLED. A sessão deve pertencer à avaliação da inscrição. Uma sessão cancelada impede uma nova cobrança associada a essa sessão. A mudança de data/sala não modifica automaticamente `Debt.dueDate` nem gera outra taxa; uma correcção financeira é decisão auditada da tesouraria.

Para obter participantes, Horários consulta Avaliações: `GET /api/v1/assessments/:assessmentId/registrations?status=CONFIRMED&cursor=<cursor>&limit=50`. Resposta proposta: `data` contém uma lista de `{ id, assessmentId, studentUserId, scheduleSessionId, status }`; `meta` inclui `correlationId`, `timestamp` e `nextCursor: string | null`. `status` deve ser CONFIRMED; `scheduleSessionId` pode ser null. Limite entre 1 e 100, cursor opaco e ordenação estável por ID. Horários selecciona inscrições da sessão pertinente; uma inscrição sem sessão ainda requer atribuição por Avaliações. Não consulta o saldo financeiro de cada estudante para construir o horário.

## Fluxo integrado e recuperação

1. Avaliações valida o estudante no módulo académico e cria uma inscrição PENDING.
2. Se houver taxa, consulta a sessão em Horários e solicita a cobrança ao Financeiro com chave estável; guarda o debtId devolvido.
3. O Financeiro valida as referências, cria a dívida e o aviso na mesma transacção local; envia o aviso pelo contrato de Notificações após commit.
4. A tesouraria confirma o pagamento pelo fluxo existente. Avaliações consulta a taxa específica e a regularidade financeira antes de confirmar a inscrição.
5. Horários consulta as inscrições CONFIRMED em Avaliações para planear os participantes; obtém a identidade do docente em Estudantes e Docentes.
6. Ao consultar notas, o estudante faz o pedido a Avaliações, que verifica a regularidade: ACTIVE permite a consulta; BLOCKED devolve 403; falha na verificação devolve 503 sem notas.

A proposta inicial usa consultas REST, sem exigir um barramento de eventos. Em timeout de criação de cobrança, Avaliações repete com a mesma chave. Proposta operacional: timeout de 5 segundos, até 3 tentativas automáticas com espera crescente para falhas de rede/429/5xx, respeitando Retry-After; depois manter pendente e permitir retoma com a mesma chave. Erros 400/401/403/404/409 exigem correcção ou tratamento específico, não repetição cega.

Não existe transacção distribuída: uma falha na confirmação da inscrição não desfaz um pagamento. Cada módulo conserva IDs e correlationId para reconciliação. Cancelar uma inscrição/sessão não cancela nem reembolsa automaticamente uma dívida; o caso segue para decisão financeira auditada. Não se pressupõe implementação de reembolsos nesta versão.

## Critérios para validar entre os grupos

| Cenário | Resultado esperado |
|---|---|
| Matrícula usada em vez de User.id ou estudante inexistente | Rejeitar a identidade; nunca responder ACTIVE por ausência de dados |
| Mesmo pedido enviado duas vezes, incluindo em concorrência | Uma única dívida e o mesmo debtId |
| Mesma chave, conteúdo diferente | 409 IDEMPOTENCY_CONFLICT |
| Nova chave para a mesma inscrição e taxa | 409 CHARGE_ALREADY_EXISTS |
| Consulta de notas com ACTIVE | Devolve as próprias notas quando as regras académicas também permitem |
| Consulta de notas com BLOCKED, incluindo exportação ou acesso directo à API | 403 FINANCIAL_ACCESS_BLOCKED, sem notas |
| Consulta de notas com timeout no Financeiro | 503 FINANCIAL_VERIFICATION_UNAVAILABLE, sem atribuir BLOCKED |
| Consulta de notas após regularização | Nova verificação ACTIVE permite acesso, sem reutilizar bloqueio antigo |
| Estado ACTIVE mas taxa específica ainda pendente | Inscrição permanece PENDING |
| Taxa regularizada mas outra dívida causa BLOCKED | Inscrição permanece PENDING |
| Financeiro indisponível | Estado de verificação pendente, sem decisão financeira inventada |
| Alteração da sala/data ou cancelamento da sessão | Sem cobrança duplicada nem reembolso automático |
| Horários tenta criar dívida ou consultar detalhes de cobrança | 403; acesso limitado ao seu contrato |

Antes da implementação conjunta, acordar nomes e URLs reais, credenciais e permissões, IDs do Core, catálogo/valores/vencimentos das taxas, regras de inscrição e restrições de acesso, cardinalidade de docentes por sessão e responsáveis por cada endpoint. Estes contratos são uma base concreta para esse acordo, não confirmação de aceitação pelos outros grupos.
