# Role FINANCE — Funções e propostas de implementação

Data de referência: 23 de Setembro de 2026.

## 1. Identificação e finalidade

`financial` é o nome técnico do módulo de Gestão Financeira. `FINANCE` é a role atribuída aos utilizadores responsáveis pelos serviços financeiros ou pela tesouraria. Não existe uma role denominada `FINANCIAL` no código actual.

A role permite acompanhar a situação financeira dos estudantes, registar dívidas, confirmar pagamentos, decidir contestações e acompanhar avisos financeiros. O seu âmbito abrange os estudantes em geral, sem limitação aos dados do próprio operador.

Este documento descreve as permissões implementadas na API e apresenta propostas para completar o trabalho do operador financeiro. As propostas abaixo ainda não constituem funcionalidades disponíveis.

## 2. Funções implementadas

Todas as rotas abaixo exigem autenticação. Os caminhos são relativos a `/api/v1/financial`.

| Função da role FINANCE | Operação disponível | Endpoint |
|---|---|---|
| Consultar dívidas | Listar todas as dívidas ou filtrar por `studentId` | `GET /debts` |
| Consultar uma dívida | Obter os detalhes de uma dívida pelo seu identificador | `GET /debts/:id` |
| Registar dívidas | Criar uma cobrança associada a um estudante, com valor e vencimento | `POST /debts` |
| Confirmar pagamentos | Registar o pagamento integral e regularizar a dívida | `POST /payments` |
| Consultar situação financeira | Verificar o estado `ACTIVE` ou `BLOCKED` de um estudante | `GET /students/:studentId/status` |
| Consultar histórico financeiro | Consultar dívidas, pagamentos, estado e totais pagos e em aberto | `GET /students/:studentId/history` |
| Decidir contestações | Resolver um pedido como `PROCEDENTE` ou `IMPROCEDENTE`, com notas de resolução | `PATCH /analysis-requests/:id` |
| Consultar avisos financeiros | Consultar até 30 notificações recentes de um estudante | `GET /students/:studentId/notifications` |
| Acompanhar entrega de avisos | Consultar estado de envio, tentativas e informação de falha | `GET /notifications/:notificationId/delivery` |
| Pedir nova tentativa de entrega | Solicitar o reenvio de um aviso elegível, sem alterar conteúdo ou destinatário | `POST /notifications/:notificationId/retry` |
| Consultar relatório agregado | Obter contagens de dívidas por estado, pagamentos e estudantes bloqueados | `GET /reports` |

As operações de criação de dívida, confirmação de pagamento, resolução de contestação, relatório e acompanhamento/reenvio de entrega são autorizadas explicitamente para `FINANCE` e `ADMIN`.

As consultas de dívidas, situação, histórico e avisos actualmente permitem outros perfis autenticados; o código restringe especificamente `STUDENT` aos próprios dados. Portanto, essas consultas ainda não são exclusivas de `FINANCE` e `ADMIN`.

## 3. Regras de funcionamento

- **Dívidas:** o utilizador referenciado deve existir. Uma dívida criada com vencimento já ultrapassado recebe `VENCIDA`; caso contrário, recebe `PENDENTE`. A validação actual verifica a existência do utilizador, mas ainda não exige o seu perfil `STUDENT`.
- **Pagamentos:** o valor deve corresponder ao total da dívida. Não são aceites pagamentos parciais nem pagamentos de dívidas `REGULARIZADA` ou `CANCELADA`. A confirmação identifica o operador responsável.
- **Regularização:** pagamento, regularização, recálculo da situação e criação do aviso são persistidos na mesma transacção.
- **Contestações:** apenas pedidos em `PENDENTE_ANALISE` podem ser decididos. A decisão identifica o responsável e a data. Uma decisão `PROCEDENTE` regulariza a dívida sem representar um pagamento; `IMPROCEDENTE` não regulariza a dívida.
- **Situação financeira:** a existência de dívidas com estado armazenado `VENCIDA` determina `BLOCKED`. A regularização de uma dívida não garante `ACTIVE` se existirem outras dívidas vencidas. Não existe uma acção independente da role para escolher manualmente esse estado.
- **Notificações:** o sistema gera avisos associados às operações financeiras. `SENT` significa aceitação pelo receptor externo, não leitura pelo estudante. Avisos `SENT` e `LOCAL_ONLY` não são reenviados.
- **Rastreabilidade:** as operações relevantes registam auditoria. Nos casos financeiros principais, a auditoria é escrita depois da transacção, uma limitação a corrigir.

## 4. Limites actuais da role

| Acção | Situação actual |
|---|---|
| Submeter contestação como estudante | Exclusiva de `STUDENT`; `FINANCE` decide pedidos existentes |
| Consultar ou alterar políticas financeiras | Exclusiva de `ADMIN`, incluindo a consulta |
| Listar e consultar pedidos de análise por rotas próprias | Ainda não existem esses endpoints; a resolução exige conhecer o ID do pedido |
| Editar, cancelar ou eliminar dívidas por uma operação própria | Não existem rotas para essas operações |
| Estornar ou reembolsar pagamentos | Não implementado |
| Emitir recibos oficiais ou exportar relatórios | Não implementado |
| Criar avisos manuais pela API | Não existe endpoint para esta função |
| Operar através de ecrãs financeiros completos | A interface web ainda apresenta um catálogo de módulos |

O relatório existente apresenta contagens; não inclui ainda um relatório monetário agregado, filtros por período ou exportação. A tolerância, o limite de dívida e a configuração de bloqueio são persistidos em políticas, mas ainda não são aplicados no recálculo financeiro.

## 5. Propostas para implementação

As prioridades seguintes são propostas técnicas e funcionais para discussão. Mantêm `FINANCE` como o identificador da role e não exigem criar uma role duplicada chamada `FINANCIAL`.

| Prioridade | Proposta | Implementação sugerida | Critério de aceitação |
|---|---|---|---|
| Alta | Definir explicitamente o acesso às consultas financeiras | Autorizar `FINANCE`, `ADMIN` e `STUDENT` nas consultas operacionais, mantendo o estudante limitado aos próprios dados; definir acesso de outros módulos por contratos específicos | Pedidos sem autenticação recebem `401`; perfis sem permissão e estudantes a consultar terceiros recebem `403` |
| Alta | Disponibilizar uma fila de contestações | Criar `GET /analysis-requests` com filtros e paginação e `GET /analysis-requests/:id`, acessíveis a `FINANCE` e `ADMIN` | O operador encontra pedidos pendentes, consulta a justificação e decide sem obter IDs fora da aplicação |
| Alta | Criar a área de trabalho da tesouraria | Implementar ecrãs de pesquisa de estudante, dívidas, pagamento, histórico, contestações e avisos; usar as permissões da API | Um utilizador `FINANCE` completa os fluxos pela interface e vê erros de validação compreensíveis |
| Alta | Reforçar a confirmação de pagamentos | Introduzir idempotência e protecção contra confirmações concorrentes; gravar auditoria financeira na mesma transacção | Repetir ou enviar simultaneamente a mesma confirmação não gera pagamentos duplicados; uma falha de auditoria não deixa a operação parcialmente registada |
| Alta | Validar correctamente o destinatário da cobrança | Exigir um utilizador elegível como estudante; validar a identidade académica conforme o contrato acordado | Uma dívida não pode ser criada para um operador financeiro ou outro perfil inelegível |
| Alta | Tornar o estado financeiro consistente com vencimentos e políticas | Implementar a aplicação das regras aprovadas de tolerância e bloqueio e um processo de actualização de vencimentos; rejeitar estudante inexistente na consulta de situação | A passagem do vencimento e a regularização produzem o estado esperado; um ID inexistente não recebe `ACTIVE` por ausência de dívidas |
| Média | Permitir a leitura de políticas pela tesouraria | Alargar `GET /policies/:policyId` a `FINANCE`; manter a alteração reservada a `ADMIN` | O operador compreende a regra aplicada e não consegue alterá-la |
| Média | Produzir relatórios financeiros úteis à tesouraria | Acrescentar totais monetários, filtros por período e estado, paginação quando aplicável e exportação CSV | Os totais correspondem aos registos filtrados e distinguem pagamentos de regularizações por contestação |
| Média | Emitir comprovativos de pagamento | Disponibilizar comprovativo ligado ao pagamento, estudante e operador; acordar previamente requisitos de numeração e conteúdo | O comprovativo corresponde a um pagamento persistido e a reemissão mantém a mesma referência |
| Média | Permitir correcções e cancelamentos controlados | Definir transições permitidas e criar operação com motivo obrigatório, histórico e auditoria; tratar dívidas pagas por fluxo separado | A correcção preserva os valores anteriores e não apaga o histórico financeiro |
| Média | Facilitar a recuperação de avisos falhados | Criar uma lista paginada de entregas pendentes/falhadas e ligá-la à consulta e ao reenvio existentes | O operador identifica falhas e solicita nova tentativa sem duplicar avisos já aceites |
| Futura | Avaliar estornos, reembolsos e pagamentos parciais | Acordar regras de aprovação, saldo e reconciliação antes de criar entidades e endpoints | Cada movimento mantém rastreabilidade e o saldo é consistente com todos os movimentos |

Os caminhos novos apresentados nesta secção são propostas; não estão registados no router actual.

## 6. Sequência de entrega proposta

1. **Permissões e integridade:** fechar a matriz de acesso, validar estudantes, proteger pagamentos e tornar a auditoria transaccional.
2. **Operação diária:** implementar consultas de contestações e os ecrãs da tesouraria sobre os endpoints existentes.
3. **Regularidade financeira:** aplicar vencimentos e políticas, com testes das transições de estado.
4. **Acompanhamento e documentos:** acrescentar relatórios, comprovativos e gestão de entregas falhadas.
5. **Evoluções funcionais:** implementar correcções, estornos ou pagamentos parciais apenas depois de definidas as respectivas regras.

Para cada entrega, validar o acesso de `FINANCE`, `ADMIN`, `STUDENT` e perfis sem permissão. Nos fluxos de escrita, verificar também repetição, concorrência, auditoria e efeitos sobre dívida, situação financeira e notificações. Esta sequência é uma proposta, não um registo de testes já executados.

## 7. Fontes da documentação

As funções actuais foram verificadas nas rotas e serviços do módulo. A especificação funcional contém também intenções de evolução e deve ser lida juntamente com o estado da implementação.

- [Rotas e permissões financeiras](../apps/api/src/modules/financial/http/financialRouter.ts)
- [Regras e casos de uso financeiros](../apps/api/src/modules/financial/application/financialService.ts)
- [Serviço de entrega de notificações](../apps/api/src/modules/financial/application/notificationDeliveryService.ts)
- [Definição das roles e entidades](../apps/api/prisma/schema.prisma)
- [Estado actual do módulo financeiro](estado-atual-modulo-financeiro.md)
- [Especificação funcional](especificacao-modulo-gestao-financeira.md)
- [Contratos de integração](contratos-financial.md)
