# AGENTE — Contexto do Projecto Smart Campus Core (PTP III - UJAC)

> LEIA ESTE FICHEIRO ANTES DE QUALQUER ACCAO.
> Este ficheiro e o ponto de entrada para qualquer agente que retome este projecto.

---

## Identidade do Projecto

- **Nome:** Smart Campus Core
- **Disciplina:** PTP III — Pratica Tecnico-Profissional III
- **Universidade:** UJAC — Universidade Joaquim Alberto Chissano
- **Ano lectivo:** 2026
- **Docente:** Msc. Armando Correia
- **Grupo:** Alipio Anderson Moises Paco (2024080003) + Jocar Celio Elias (2024080038)
- **Semana actual:** Semana 3 (desenvolvimento do Core e modulos)

---

## Localizacao dos Ficheiros

```
Raiz do projecto:
  /home/paco/Documents/UJAC- 4 ano/PTP - III/SMART CAMPUS/

Documentos de referencia da Semana 3 (PDFs):
  /home/paco/Documents/UJAC- 4 ano/PTP - III/Semana 3/
    Manual_explicativo_completo_Smart_Campus_Core_estudantes.pdf
    Manual_exaustivo_APIs_Core_para_reproducao_e_modulos.pdf

Artefactos do agente (plano, tarefas, logs):
  /home/paco/.gemini/antigravity-ide/brain/7e5eb9b5-af4d-4541-b1f2-e1fecb369d3e/
    implementation_plan.md   <- plano tecnico detalhado
    task.md                  <- lista de tarefas com estado
    analise_semana3.md       <- comparacao manual vs projecto
    AGENT_CONTEXT.md         <- este ficheiro
```

---

## Arquitectura Obrigatoria

O projecto e um **Monolito Modular** num monorepo npm.

```
SMART CAMPUS/
  apps/
    api/          -> Backend Express.js na porta 4100
    web/          -> Frontend React + Vite na porta 3000
  packages/
    shared-types/ -> DTOs e interfaces TypeScript partilhados
    validation/   -> Schemas Zod de validacao de input
    api-client/   -> Cliente HTTP para o frontend
```

### Regras absolutas (do manual do docente)

1. Todas as rotas de dominio usam prefixo `/api/v1`
2. `/health` fica FORA de `/api/v1`
3. Resposta de sucesso: `{ data: T, meta: { correlationId, timestamp } }`
4. Resposta de erro: `{ code, message, details?, correlationId }`
5. Login retorna: `data.user + data.tokens.accessToken + data.tokens.refreshToken`
6. Validacao Zod ANTES de qualquer logica de negocio
7. Toda mutacao relevante regista `AuditEvent`
8. Autenticacao e autorizacao na API, NUNCA so no frontend
9. Estrutura interna dos modulos: `domain/` + `application/` + `http/`
10. Frontend usa `api-client` e nunca chama fetch directamente
11. `x-correlation-id` propagado em TODAS as respostas (sucesso e erro)
12. NAO usar emojis em ficheiros de codigo (.ts, .tsx, .css, .js)

---

## Estado Actual (27 Agosto 2026, 08:34)

### Ja existe e esta correcto
- Estrutura de directorios do monorepo
- `docker-compose.yml` (PostgreSQL 15 + MQTT Mosquitto)
- `.env.example` com todas as variaveis necessarias
- `apps/api/prisma/schema.prisma` (base — sem Building, sem isActive)
- `apps/api/src/config/env.ts`
- `apps/api/src/middlewares/auth.ts` — authenticate + authorize com JWT RBAC
- `apps/api/src/middlewares/correlationId.ts` — gera e propaga x-correlation-id
- `apps/api/src/middlewares/errorHandler.ts`
- `apps/api/src/utils/response.ts` — sendSuccess + sendError
- `apps/api/src/app.ts` — Express com /health fora de /api/v1
- `apps/api/src/server.ts`
- `apps/api/src/database/mockStore.ts` — dados demo em memoria (substitui Prisma)
- `packages/shared-types/src/index.ts` — DTOs actualizados com TokensDto, BuildingDto
- `apps/web/src/index.css` — design system
- `apps/web/src/App.tsx` — catalogo de modulos (tem emojis — a remover)
- `docs/` — documentacao tecnica

### Existe mas com problemas (a reestruturar)
- `apps/api/src/modules/auth/` — formato tokens errado, sem refresh/logout, estrutura antiga
- `apps/api/src/modules/rooms/` — sem buildingId, sem /rooms/:id, sem auditoria, estrutura antiga
- `apps/api/src/modules/incidents/` — sem PATCH /status, sem auditoria, estrutura antiga
- `apps/api/src/routes/v1.ts` — faltam users, buildings, audit, dashboard

### Nao existe ainda (a criar)
- `apps/api/src/utils/audit.ts`
- `apps/api/src/modules/auth/domain/`, `application/`, `http/`
- `apps/api/src/modules/users/` — modulo completo
- `apps/api/src/modules/buildings/` — modulo completo
- `apps/api/src/modules/rooms/domain/`, `application/`, `http/`
- `apps/api/src/modules/incidents/domain/`, `application/`, `http/`
- `apps/api/src/modules/audit/` — modulo completo
- `apps/api/src/modules/dashboard/` — modulo completo
- `packages/validation/src/index.ts` — schemas incompletos

---

## Instrucoes para o Proximo Agente

### Passo 1 — Ler os artefactos de contexto
```
Ler: implementation_plan.md  (plano completo com todos os ficheiros)
Ler: task.md                 (lista de tarefas com estado)
```

### Passo 2 — Verificar o estado real dos ficheiros
```bash
ls "SMART CAMPUS/apps/api/src/modules/"
ls "SMART CAMPUS/apps/api/src/modules/auth/"
cat "SMART CAMPUS/apps/api/src/routes/v1.ts"
```

### Passo 3 — Continuar pela primeira tarefa NAO concluida em task.md
O task.md usa:
- `[x]` — concluido
- `[/]` — em progresso
- `[ ]` — por fazer

### Passo 4 — Testar apos implementar cada modulo
```bash
cd "SMART CAMPUS" && npm run dev:api

# Health check
curl -s http://localhost:4100/health

# Login
curl -s -X POST http://localhost:4100/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@smartcampus.demo","password":"Admin123!"}'
```

### Passo 5 — Actualizar task.md apos cada tarefa concluida

---

## Credenciais de Demonstracao

| Email | Password | Role |
|---|---|---|
| admin@smartcampus.demo | Admin123! | ADMIN |
| armando.correia@smartcampus.demo | Admin123! | COORDINATOR |
| jocar.elias@smartcampus.demo | Admin123! | TECHNICIAN |
| carlos.manuel@smartcampus.demo | Admin123! | TEACHER |
| maria.fernanda@smartcampus.demo | Admin123! | STUDENT |

---

## Fluxo de Demonstracao Obrigatorio (manual, seccao 13)

```
POST /api/v1/auth/login           -> obter tokens
GET  /api/v1/auth/me              -> confirmar identidade
GET  /api/v1/buildings            -> obter buildingId
GET  /api/v1/rooms                -> listar salas
POST /api/v1/incidents            -> criar ocorrencia (qualquer role)
PATCH /api/v1/incidents/:id/status -> actualizar estado (TECHNICIAN+)
GET  /api/v1/audit-events         -> ver auditoria (ADMIN/COORDINATOR)
```

Este fluxo DEVE funcionar completamente para a demonstracao.

---

## Notas Tecnicas Importantes

### mockStore.ts
O ficheiro `apps/api/src/database/mockStore.ts` e a base de dados em memoria.
- Importar os arrays directamente: `import { users, incidents, ... } from '../../database/mockStore'`
- Verificar existencia antes de criar (code unico para Room e Building)
- Auditoria vai para o array `auditEvents` via `utils/audit.ts`

### Formato AuthResponseDto (CORRECTO)
```json
{
  "data": {
    "user": { "id": "...", "name": "...", "email": "...", "role": "ADMIN", "isActive": true, ... },
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ..."
    }
  },
  "meta": { "correlationId": "uuid", "timestamp": "..." }
}
```

### Formato de Erro (CORRECTO — sem wrapper "error")
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Dados de entrada invalidos.",
  "details": [{ "path": "capacity", "message": "Deve ser positivo" }],
  "correlationId": "uuid"
}
```

**ATENCAO:** O formato de erro do `response.ts` actual usa `{ error: { code, message } }` — isto esta ERRADO segundo o manual. Deve ser corrigido para o formato flat acima.

### Estrutura interna dos modulos
```
modules/<nome>/
  domain/<entidade>.ts        -> tipos puros, invariantes, toDto
  application/<nome>Service.ts -> casos de uso, mockStore, auditoria
  http/<nome>Router.ts         -> Express router, authenticate, authorize, parse, service
```
