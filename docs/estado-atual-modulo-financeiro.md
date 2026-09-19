# Estado actual do módulo financeiro

Data de referência: **19 de Setembro de 2026**. Este documento descreve o código existente, sem apresentar os contratos propostos como funcionalidades concluídas.

## Organização e responsabilidades

O projecto mantém o monólito modular e os workspaces npm definidos para o Smart Campus. O Core e os pacotes partilhados são necessários para executar o Financeiro.

```text
apps/api/
  prisma/
    schema.prisma                 Modelo relacional
    migrations/                   Evolução versionada do modelo
    scripts/                      Verificações de integridade antes de migrar
  src/modules/financial/
    domain/                       Estados, conversões para DTO e funções de domínio
    application/                  Casos de uso, transacções e entrega de avisos
    http/                         Rotas, autenticação, autorização e validação
    infrastructure/               Cliente Prisma e cliente HTTP de Notificações
    schemas/                      Reexportação dos schemas partilhados
    tests/                        Testes HTTP, persistência e entrega de avisos
apps/web/                         Interface e catálogo de módulos
packages/
  shared-types/                   DTO e contratos TypeScript
  validation/                     Schemas Zod
  api-client/                     Cliente HTTP partilhado
docs/
  core/                          Arquitectura, guia e modelo de módulo do Core
  exercicios/                    Documentação dos exercícios da Semana 5
  exercicio-1/                    Diagramas e descrição das entidades financeiras
  referencias/                   Especificação de outro módulo como referência
```

Os contratos financeiros permanecem directamente em `docs/`, preservando os links do README. O ficheiro `financialRepository.ts` disponibiliza o cliente Prisma; as consultas e transacções são executadas principalmente nos serviços de aplicação.

## Funcionalidades disponíveis

Base das rotas: `/api/v1/financial`. Todas exigem autenticação JWT do Core.

| Operação | Rotas | Acesso actual |
|---|---|---|
| Listar e consultar dívidas | `GET /debts`, `GET /debts/:id` | Autenticados; estudante limitado aos próprios dados |
| Criar dívida | `POST /debts` | `FINANCE`, `ADMIN` |
| Confirmar pagamento integral | `POST /payments` | `FINANCE`, `ADMIN` |
| Consultar situação financeira | `GET /students/:studentId/status` | Autenticados; estudante limitado aos próprios dados |
| Consultar histórico | `GET /students/:studentId/history` | Autenticados; estudante limitado aos próprios dados |
| Consultar até 30 avisos recentes | `GET /students/:studentId/notifications` | Autenticados; estudante limitado aos próprios dados |
| Submeter contestação | `POST /analysis-requests` | `STUDENT`, sobre uma dívida própria |
| Resolver contestação | `PATCH /analysis-requests/:id` | `FINANCE`, `ADMIN` |
| Consultar relatório agregado | `GET /reports` | `FINANCE`, `ADMIN` |
| Consultar e alterar política | `GET /policies/:policyId`, `PATCH /policies/:policyId` | `ADMIN` |
| Consultar entrega e pedir reenvio | `GET /notifications/:notificationId/delivery`, `POST /notifications/:notificationId/retry` | `FINANCE`, `ADMIN` |

As respostas de sucesso usam `{ data, meta }`; os erros usam `{ code, message, details?, correlationId }`. O Swagger está disponível em `/api/docs`.

### Regras implementadas

- A criação da dívida verifica a existência de `User.id`. Uma data já ultrapassada origina uma dívida `VENCIDA`; caso contrário, `PENDENTE`.
- O pagamento tem de corresponder ao valor integral. Dívidas `REGULARIZADA` ou `CANCELADA` não aceitam pagamentos.
- Pagamento, regularização, recálculo financeiro e aviso são gravados na mesma transacção.
- O estudante não pode contestar uma dívida de outra pessoa, uma dívida regularizada ou uma dívida com contestação pendente.
- Uma contestação resolvida não pode ser novamente decidida. A decisão `PROCEDENTE` regulariza a dívida e recalcula a situação financeira.
- A existência de dívidas marcadas `VENCIDA` determina `BLOCKED`; a sua ausência determina `ACTIVE`.
- As operações relevantes registam auditoria. Nos casos de uso financeiros principais, a auditoria é gravada depois da transacção financeira.

## Persistência e migrações

O Financeiro utiliza PostgreSQL através de Prisma. As entidades são `Debt`, `Payment`, `FinancialStatus`, `AnalysisRequest`, `FinancialNotification` e `FinancialPolicy`, associadas a `User` e `AuditEvent` do Core.

`studentId` representa `User.id`, não o número de matrícula. Existem chaves estrangeiras para o estudante, o responsável pela confirmação e o responsável pela resolução. As relações com utilizadores impedem a eliminação de utilizadores referenciados (`ON DELETE RESTRICT`).

| Migração | Finalidade |
|---|---|
| `20260910002221_add_financial_module` | Tabelas e estados financeiros |
| `20260910052314_add_finance_role` | Perfil `FINANCE` |
| `20260916000000_add_financial_user_relations` | Integridade das referências a utilizadores |
| `20260917000000_add_notification_delivery` | Fila persistente e acompanhamento da entrega |

Antes de aplicar as chaves estrangeiras numa base já preenchida, executar na raiz:

```bash
node apps/api/prisma/scripts/check-financial-user-relations.cjs
```

O script apenas consulta e conta referências inválidas; termina com erro se encontrar inconsistências. Não corrige nem apaga dados.

O seed reside em `apps/api/src/prisma/seed.ts`. **Apaga e recria dados financeiros de demonstração**; deve ser executado apenas numa base descartável de desenvolvimento ou testes. A configuração local e os comandos de arranque permanecem no [README](../README.md#execução-local).

## Entrega de notificações

São produzidos eventos `DEBT_CREATED`, `PAYMENT_CONFIRMED` e `ANALYSIS_REQUEST_RESOLVED`. O aviso é persistido na transacção financeira e o envio HTTP acontece depois do commit.

O processador arranca com a API, procura até 10 avisos elegíveis por ciclo e utiliza uma reserva com prazo de expiração para reduzir envios concorrentes. Falhas são registadas com códigos sanitizados e reagendadas com espera progressiva até uma hora. A chave `financial:<sourceEventId>` mantém-se nos reenvios; o receptor deve implementar a deduplicação.

| Estado | Significado |
|---|---|
| `LOCAL_ONLY` | Aviso histórico preservado pela migração, sem envio externo |
| `PENDING` | À espera de envio; mantém-se assim quando falta configuração |
| `PROCESSING` | Reservado para tentativa de envio |
| `SENT` | Receptor confirmou aceitação; não significa leitura pelo estudante |
| `FAILED` | Tentativa falhou e pode voltar a ser processada |

Configuração: `NOTIFICATIONS_API_URL`, `NOTIFICATIONS_API_TOKEN`, `NOTIFICATIONS_TIMEOUT_MS` (padrão: 5000) e `NOTIFICATIONS_POLL_INTERVAL_MS` (padrão: 30000). URL e token são definidos apenas no ambiente local ou no serviço de alojamento.

Consultar a [integração de notificações](integracao-notificacoes.md) e o [contrato OpenAPI](contrato-notificacoes.openapi.json).

## Limitações e trabalho pendente

- A autenticação utiliza contas em memória. O seed cria utilizadores com IDs correspondentes em PostgreSQL; criar apenas um utilizador na base não o torna autenticável.
- As consultas restringem `STUDENT` aos próprios dados, mas permitem que os outros perfis autenticados consultem outros estudantes.
- A consulta de situação não verifica a existência do estudante; um ID sem dívidas pode devolver `ACTIVE`. A criação de dívida verifica a existência do utilizador, mas não o perfil `STUDENT`.
- O cálculo usa o estado armazenado `VENCIDA`. Não existe um processo que marque automaticamente como vencidas todas as dívidas cuja data entretanto passou.
- Os parâmetros da política são persistidos, mas o recálculo actual não aplica tolerância, limite de dívida ou a opção de bloqueio automático.
- A auditoria fora da transacção pode falhar depois de a operação financeira já ter sido confirmada.
- A interface web é um catálogo de módulos; não contém ainda os ecrãs completos de operação financeira.
- As integrações académicas C1–C4 continuam propostas ou parciais. O receptor real de Notificações ainda precisa de validação conjunta.
- As novas tentativas dependem do processo da API estar activo. Não existe um serviço de processamento independente.

## Verificação

A compilação de `shared-types`, `validation`, `api-client`, `api` e `web` passou em 19 de Setembro de 2026.

Os testes existentes cobrem autorização, validação, referências inexistentes, regras financeiras, falhas de entrega, reenvio, idempotência e concorrência de envio com receptor simulado. Exigem PostgreSQL preparado com o schema e utilizadores de demonstração. Executar numa base de testes:

```bash
npm run test:financial -w @smart-campus/api -- --runInBand
```

Nesta revisão, as quatro migrações foram aplicadas com sucesso numa instância PostgreSQL 15 temporária e isolada. Após o seed de demonstração, passaram **36 testes em 2 suites**. A primeira tentativa no ambiente restrito não conseguiu ligar-se ao PostgreSQL; o resultado acima corresponde à execução isolada concluída. Os testes com receptor simulado não comprovam integração com o serviço externo real.

## Documentos complementares

- [Contratos financeiros e académicos](contratos-financial.md)
- [Especificação funcional](especificacao-modulo-gestao-financeira.md)
- [Entidades, atributos e relações](exercicio-1/atributos-e-relacoes.md)
- [Integração com módulos académicos](integracao-modulos-academicos.md)
- [Exercícios da Semana 5](exercicios/documentacao-exercicios-semana5.md)
- [Arquitectura do Core](core/arquitectura-smart-campus.md)
- [Organização e publicação](organizacao-e-publicacao.md)
