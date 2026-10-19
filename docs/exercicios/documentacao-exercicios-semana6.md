# Semana 6 — Guião Prático dos Estudantes, Módulos V e VI

> **Âmbito desta publicação:** documentação e evidências da execução local de 6 de Outubro de 2026. Os 109 testes validam o estado local completo identificado pelo SHA-256 em `resumo-validacao.json`, incluindo alterações de segurança ainda não publicadas neste commit. Não representam uma execução de CI nem a validação do código actualmente publicado. Os comandos de reprodução descritos abaixo dependem desses ficheiros locais e ainda não estão disponíveis num clone apenas deste commit.

Fonte: `Semana 6/Guiao_Pratico_Estudantes_Modulos_V_VI.pdf`, disponibilizado na pasta da disciplina. Aplicação ao código local do SMART CAMPUS; não é necessário copiar o repositório de exemplo da ficha.

## 1. Identificação e escolha

| Campo | Preenchimento |
|---|---|
| Módulo | Gestão Financeira de Estudantes |
| Elementos | Alípio Paco e Josefa Muthemba (nomes presentes na configuração Swagger; confirmar antes da entrega) |
| Entidade principal | Debt — dívida de um estudante |
| Endpoint escolhido | `GET /api/v1/financial/debts/{id}` |
| Objectivo | Consultar uma dívida, permitindo FINANCE/ADMIN ou o estudante proprietário |

## 2. Passo 1 — Rever a autenticação e o contrato existente

Ler `apps/api/src/middlewares/auth.ts`, `apps/api/src/utils/response.ts` e `packages/shared-types/src/index.ts`.

A ordem nas rotas é `authenticate → authorize → handler/service`. O middleware partilhado verifica assinatura HS256, expiração, emissor, destinatário, tipo de token e sessão activa na base de dados. `authorize(roles)` já corresponde à função `requireRole` sugerida pela ficha: reutilizamo-la sem duplicar a implementação.

Adaptações necessárias dos exemplos genéricos ao projecto:

| Exemplo da ficha | Contrato real utilizado |
|---|---|
| `/api/auth/login` | `/api/v1/auth/login` |
| `requireRole(...)` | `authorize(...)` |
| `success: true` e `correlationId` no topo | `{ data, meta: { correlationId, timestamp } }` |
| `error.code` | `code` no topo do erro |
| `UNAUTHENTICATED` | `UNAUTHORIZED`, com HTTP 401 |
| UUID em qualquer `id` | Identificador interno string; não presumir UUID nem confundir com `code` |
| ADMIN/COORDINATOR em operações administrativas genéricas | FINANCE/ADMIN nas operações financeiras; política apenas ADMIN |

Preservámos o contrato já usado pelo frontend e pelos clientes. O estado HTTP mantém o significado exigido na ficha.

## 3. Passo 2 — Preencher a matriz de permissões (Módulo V)

Todos os caminhos abaixo têm o prefixo `/api/v1/financial`. Todas as rotas usam `authenticate` e `authorize`. Na coluna de testes, «S» identifica cobertura positiva e negativa explícita acrescentada nesta actividade; «parcial» não significa ausência de protecção.

| Método e caminho | Perfis permitidos | Restrição de posse | Testado nesta actividade |
|---|---|---|---|
| GET `/debts` | STUDENT, FINANCE, ADMIN | STUDENT só lista as próprias dívidas | S |
| GET `/debts/:id` | STUDENT, FINANCE, ADMIN | STUDENT só lê dívida própria | S |
| POST `/debts` | FINANCE, ADMIN | Operação administrativa | Cobertura anterior de validação/negação |
| POST `/payments` | FINANCE, ADMIN | Operação administrativa | Cobertura anterior |
| GET `/students/:studentId/status` | STUDENT, FINANCE, ADMIN | STUDENT só consulta o próprio ID | Parcial: BOLA e testes anteriores |
| GET `/students/:studentId/history` | STUDENT, FINANCE, ADMIN | STUDENT só consulta o próprio ID | Parcial: BOLA e testes anteriores |
| GET `/students/:studentId/notifications` | STUDENT, FINANCE, ADMIN | STUDENT só consulta o próprio ID | Parcial: BOLA |
| POST `/analysis-requests` | STUDENT | Dívida tem de pertencer ao requerente | Parcial: BOLA e testes anteriores |
| PATCH `/analysis-requests/:id` | FINANCE, ADMIN | Decisão administrativa; STUDENT recebe 403 | Cobertura anterior |
| GET `/reports` | FINANCE, ADMIN | Relatório administrativo | S |
| GET `/policies/:policyId` | ADMIN | Configuração administrativa | S |
| PATCH `/policies/:policyId` | ADMIN | Configuração administrativa | Cobertura anterior |
| GET `/notifications/:notificationId/delivery` | FINANCE, ADMIN | Consulta administrativa | Cobertura anterior |
| POST `/notifications/:notificationId/retry` | FINANCE, ADMIN | Operação administrativa | Cobertura anterior |

Escolha anti-BOLA: **403 FORBIDDEN** quando um estudante tenta aceder a dados existentes de outro. Dívida inexistente devolve **404 DEBT_NOT_FOUND**. Esta opção pode revelar a existência do identificador; é uma escolha explícita permitida pela ficha.

O novo ficheiro de testes cria estudantes A e B, cada um com dívida própria, e verifica detalhe, listagem, estado, histórico e notificações. Na escrita, verifica `POST /analysis-requests` e confirma que a tentativa não cria uma contestação. O módulo não expõe DELETE nem PATCH de dívida ao estudante: não criámos essas rotas apenas para imitar o exemplo. O PATCH de decisão está reservado a FINANCE/ADMIN e já tem teste de negação para STUDENT.

Os comentários dos testes indicam onde se encontra cada verificação de posse: `financialRouter.ts` para leitura e `financialService.createAnalysisRequest` para escrita.

## 4. Passo 3 — Documentar o endpoint em OpenAPI

Fonte editável: `apps/api/src/config/swagger.ts`. Entrega pedida: `docs/openapi.yaml`.

```bash
cd "SMART CAMPUS"
npm run docs:openapi
npm run docs:check
```

O primeiro comando exporta o documento usado pelo Swagger para YAML. O segundo lê o YAML e compara-o com a fonte, detectando erros de sintaxe ou divergências. Não editar apenas o YAML: alterar a fonte e voltar a exportar. Este teste verifica sintaxe/sincronização; não é um linter completo da especificação OpenAPI.

O endpoint inclui descrição em português, tag `Dívidas (Debts)`, Bearer JWT, parâmetro obrigatório `id`, schema `Debt` alinhado com `DebtDto`, envelope `ApiSuccessDebt`, envelope `ApiError` e exemplos.

| HTTP | Situação | Corpo |
|---|---|---|
| 200 | FINANCE/ADMIN ou proprietário autorizado | `data: DebtDto`, `meta.correlationId`, `meta.timestamp` |
| 400 | JSON malformado rejeitado pelo parser global | `code: INVALID_JSON` |
| 401 | Sem token, token expirado, assinatura alterada ou sessão inválida | `code: UNAUTHORIZED` |
| 403 | Perfil proibido ou estudante não proprietário | `code: FORBIDDEN` |
| 404 | Dívida inexistente | `code: DEBT_NOT_FOUND` |

Este GET não exige corpo nem query. O 400 documenta o comportamento global perante um pedido malformado, não uma validação inexistente de UUID. Datas, IDs e correlationId dos exemplos são ilustrativos e variam na execução.

## 5. Passo 4 — Explorar no Swagger UI

Com a base local já configurada/migrada e contas de desenvolvimento disponíveis:

```bash
npm run dev:api
```

1. Abrir `http://localhost:4100/api/docs/`.
2. Expandir `POST /api/v1/auth/login`, seleccionar **Try it out**, fornecer credenciais e executar.
3. Copiar `data.tokens.accessToken`. Em **Authorize**, colar apenas o token, sem escrever `Bearer` antes.
4. Como FINANCE, consultar a listagem de dívidas e copiar `data[n].id` (não `code`).
5. Expandir `GET /api/v1/financial/debts/{id}`, preencher o identificador e executar: esperar 200.
6. Fazer **Logout** em Authorize e executar novamente: esperar 401.
7. Autenticar como TEACHER e repetir: esperar 403.
8. Voltar ao token FINANCE e usar `semana6-divida-inexistente`: esperar 404.
9. Guardar capturas do bloco de resposta com estado e JSON, sem expor tokens.

Use contas temporárias criadas no ambiente de teste e obtenha as respectivas credenciais por um canal seguro. Não inclua e-mails, palavras-passe ou tokens de demonstração na documentação. Não é necessário resementar a base habitual para os testes automatizados.

O script `scripts/semana6-swagger.cjs` reproduz os quatro cenários no Chrome através do Swagger UI, com login HTTP real, contas temporárias e base descartável. A automação configura o estado Authorize com a API do Swagger e acciona **Try it out/Execute**. A instância temporária usa uma porta livre e ajusta apenas o servidor do seu documento em memória.

## 6. Passo 5 — Executar os testes e a cobertura

Forma reproduzível, sem usar a base habitual:

```bash
npm run test:semana6:isolated
```

Requer Docker acessível. Cria PostgreSQL 15 descartável, aplica as migrações desde zero, compila pacotes/API/web, executa todas as suites Jest com cobertura e remove o contentor no fim. Os resultados ficam em `docs/exercicios/semana6/evidencias/`.

Para incluir as capturas automatizadas, indicar uma instalação disponível de Playwright e Chrome:

```bash
PLAYWRIGHT_MODULE=/caminho/para/playwright CHROME_PATH=/usr/bin/google-chrome npm run test:semana6:isolated
```

Sem `PLAYWRIGHT_MODULE`, o runner executa os testes e a cobertura; não afirma ter repetido a exploração visual. Indique explicitamente o caminho da instalação de Playwright disponível no seu ambiente.

Com uma base **exclusivamente de testes** já preparada, cujo nome termine em `_test`, também se pode executar:

```bash
# DATABASE_URL deve apontar para a base descartável preparada.
# NOTIFICATIONS_API_URL e NOTIFICATIONS_API_TOKEN devem estar vazios.
npm test
# Para forçar execução sequencial directamente na API:
npm run test --workspace=@smart-campus/api -- --runInBand
npm run test:coverage
```

O guard impede que a suite use implicitamente a base habitual. `npm test` não deve ser executado contra dados reais. As fixtures novas usam IDs únicos e as verificações de leitura não dependem de alterações efectuadas por outros testes. A limpeza final é feita pela destruição da base descartável.

Novo ficheiro: `apps/api/src/modules/financial/tests/financial-semana6.test.ts`. Cobre 200 para três perfis, 401 sem token/expirado/adulterado, 403 por perfil, 404, 400, disponibilidade Swagger, contrato documentado, BOLA em leitura/escrita e três rotas com autorização positiva/negativa.

Também foi corrigido um teste anterior que aceitava 401 num cenário cujo resultado obrigatório é 200. O hook de preparação da suite de segurança recebeu 60 segundos para criar e autenticar as contas com hashing real; os limites normais de cada teste mantêm-se.

## 7. Passo 6 — Provar que os testes detectam BOLA

```bash
npm run test:semana6:isolated -- --mutations
```

O script `scripts/check-bola-mutations.cjs` desactiva temporariamente uma guarda de leitura e depois a guarda de escrita, uma de cada vez. Para cada alteração, executa apenas o teste adversarial correspondente e exige uma falha na expectativa de HTTP 403. O conteúdo original é restaurado num bloco `finally`; a comparação final confirma a restauração. Executar sem outras suites ou edições simultâneas nesses ficheiros.

Estas falhas são **esperadas** e ficam em relatórios separados (`mutacao-leitura.json`, `mutacao-escrita.json`), sem substituir o resultado da suite normal. A opção pode ser combinada com `PLAYWRIGHT_MODULE` para obter testes, mutações e capturas na mesma base descartável.

## 8. Resultados e entrega

Consultar [resultados da execução](semana6/resultados.md) para os números reais, cobertura, capturas e estado da tabela exigida pela ficha.
