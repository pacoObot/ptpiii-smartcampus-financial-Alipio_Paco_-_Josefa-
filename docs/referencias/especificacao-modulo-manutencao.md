# Especificacao do Modulo: Gestao de Manutencao e Ocorrencias

**Disciplina:** PTP III — UJAC  
**Grupo 5:** Alipio Anderson Moises Paco (2024080003) & Jocar Celio Elias (2024080038)  
**Modulo Particular:** `maintenance` (Gestao de Manutencao e Ocorrencias do Campus)  
**Data:** Agosto de 2026

---

## 1. Problema e Objectivo

### 1.1 Problema Real no Campus
No campus universitario da UJAC, equipamentos de laboratorio, sistemas de climatizacao, rede eletrica e mobiliario sofrem avarias frequentemente. Sem um sistema centralizado de manutencao:
- As ocorrencias sao reportadas verbalmente ou em papel, resultando em perdas de pedidos.
- Nao existe visibilidade sobre quais avarias sao urgentes versus de baixa prioridade.
- Os tecnicos nao possuem historico de intervencoes realizadas no mesmo espaco ou equipamento.
- Os coordenadores nao conseguem acompanhar o tempo medio de resolucao.

### 1.2 Capacidade Entregue pelo Modulo
O modulo **Gestao de Manutencao e Ocorrencias** entrega:
1. Registo estruturado de pedidos de manutencao associados a salas/edificios do campus.
2. Classificacao por categorias (Eletrica, Canalizacao, Hardware, Mobiliario, Climatizacao, Limpeza, Outro).
3. Gestao de prioridades (`LOW`, `MEDIUM`, `HIGH`, `URGENT`) com regras de atendimento.
4. Ciclo de vida completo do pedido (`OPEN` ➔ `IN_PROGRESS` ➔ `RESOLVED` ➔ `CLOSED` / `CANCELLED`).
5. Atribuicao de tecnicos responsaveis e registo de notas de intervencao tecnica.
6. Painel estatistico de ocorrencias e historico completo auditado.

### 1.3 Fora do Escopo
- Compra de pecas de reposicao e gestao de stock fisico de fornecedores.
- Integracao com pagamentos a empresas externas de manutencao.

---

## 2. Entidades e Regras de Negocio

### 2.1 Entidade Principal: `MaintenanceRequest` (Pedido de Manutencao)
- `id`: Identificador unico (`mnt_...`)
- `code`: Codigo legivel (`MN-2026-001`)
- `title`: Titulo resumido do problema
- `description`: Detalhes completos da avaria
- `category`: Categoria (`ELECTRICAL`, `PLUMBING`, `HARDWARE`, `FURNITURE`, `HVAC`, `CLEANING`, `OTHER`)
- `priority`: Prioridade (`LOW`, `MEDIUM`, `HIGH`, `URGENT`)
- `status`: Estado actual (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, `CANCELLED`)
- `roomId`: Identificador da sala afectada (relacao com `Room` do Core)
- `reportedById`: Identificador do utilizador que reportou (relacao com `User` do Core)
- `assignedToId`: Identificador do tecnico atribuido (opcional)
- `estimatedCost`: Custo estimado de reparacao (opcional)
- `resolvedAt`: Data/hora de resolucao
- `notes`: Historico de notas de intervencao (`MaintenanceNote[]`)

### 2.2 Entidade Secundaria: `MaintenanceNote` (Nota de Intervencao Tecnica)
- `id`: Identificador unico (`note_...`)
- `requestId`: Identificador do pedido
- `authorId`: Tecnico ou coordenador autor da nota
- `content`: Descricao da intervencao realizada ou observacao
- `createdAt`: Data/hora do registo

### 2.3 Invariantes (Regras Inviolaveis)
1. **Validacao de Sala**: Nao e possivel criar um pedido de manutencao para uma sala inexistente.
2. **Prioridade Obrigatoria**: Todos os pedidos devem ter uma prioridade explicitada.
3. **Transicao de Estados Valida**:
   - `OPEN` ➔ `IN_PROGRESS` (requer atribuicao de tecnico ou role `TECHNICIAN`/`COORDINATOR`/`ADMIN`)
   - `IN_PROGRESS` ➔ `RESOLVED` (requer nota tecnica explicativa)
   - `RESOLVED` ➔ `CLOSED` (confirmacao final pelo criador ou coordenador)
   - Qualquer estado inicial ➔ `CANCELLED` (apenas por `COORDINATOR` ou `ADMIN`)
4. **Auditoria**: Toda criacao, alteracao de estado e adicao de nota gera um `AuditEvent` rastreavel pelo `x-correlation-id`.

---

## 3. Matriz de Roles e Permissoes (RBAC)

| Operacao | Rota HTTP | Roles Permitidas | Regra de Acesso |
|---|---|---|---|
| Listar Pedidos | `GET /api/v1/maintenance` | Todos Autenticados | Pode filtrar por estado, prioridade e categoria |
| Ver Detalhes | `GET /api/v1/maintenance/:id` | Todos Autenticados | Ver pedido e historico de notas |
| Ver Estatisticas | `GET /api/v1/maintenance/stats` | Todos Autenticados | Resumo de ocorrencias por estado/prioridade |
| Criar Pedido | `POST /api/v1/maintenance` | Todos Autenticados | Associa automaticamente o autor autenticado |
| Alterar Estado | `PATCH /api/v1/maintenance/:id/status` | `TECHNICIAN`, `COORDINATOR`, `ADMIN` | Altera estado e atribui tecnico |
| Adicionar Nota | `POST /api/v1/maintenance/:id/notes` | `TECHNICIAN`, `COORDINATOR`, `ADMIN` | Regista intervencao tecnica |

---

## 4. Contratos da API REST (`/api/v1/maintenance`)

### 4.1 Resposta de Sucesso ao Criar Pedido (`POST /api/v1/maintenance`)
```json
{
  "data": {
    "id": "mnt_a1b2c3d4",
    "code": "MN-2026-003",
    "title": "Quadro Eletrico a Disparar",
    "description": "O disjuntor principal do Laboratorio 1 dispara ao ligar os computadores.",
    "category": "ELECTRICAL",
    "priority": "URGENT",
    "status": "OPEN",
    "roomId": "room_01",
    "roomCode": "LAB-INF-01",
    "reportedById": "usr_teacher_01",
    "reportedByName": "Carlos Manuel",
    "createdAt": "2026-08-27T10:00:00.000Z",
    "updatedAt": "2026-08-27T10:00:00.000Z",
    "notes": []
  },
  "meta": {
    "correlationId": "c47ac10b-58cc-4372-a567-0e02b2c3d479",
    "timestamp": "2026-08-27T10:00:00.000Z"
  }
}
```

---

## 5. Estrutura do Codigo no Monorepo

```
apps/api/src/modules/maintenance/
├── domain/
│   └── maintenanceDomain.ts      # Enums, DTO formatters, validacao de transicao
├── application/
│   └── maintenanceService.ts     # Casos de uso e integracao com mockStore/auditLog
└── http/
    └── maintenanceRouter.ts      # Endpoints Express e validacao Zod
```

---

## 6. Checklist de Qualidade

- [x] Documentacao completa em markdown
- [x] Integracao com shared-types e validation Zod
- [x] Respostas normalizadas (`data`, `meta.correlationId`)
- [x] Erros normalizados (`code`, `message`, `details`)
- [x] Auditoria registada em todas as alteracoes
- [x] Documentacao Swagger publicada em `/api/docs`
- [x] Catalogo Frontend actualizado
