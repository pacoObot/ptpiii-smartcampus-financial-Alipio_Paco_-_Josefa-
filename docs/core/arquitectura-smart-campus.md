# Arquitectura do Sistema — Smart Campus Core (Semana 3)

**Disciplina:** PTP III — Projecto Tecnológico e Profissional III  
**Instituição:** UJAC — Universidade Joaquim Alberto Chissano  
**Versão da Arquitectura:** 1.1 (Agosto 2026)

---

## 1. Princípio Arquitectural Fundamentar: Monólito Modular

O **Smart Campus Core** adopta uma arquitectura de **Monólito Modular**. Isso significa que:
1. Existe **um único processo backend** (Express API) em execução na porta `4100`.
2. Existe **uma única base de dados relacional** (PostgreSQL).
3. O código é rigorosamente estruturado em **módulos isolados** por domínio (`apps/api/src/modules/`), com contratos explícitos e responsabilidades bem delimitadas.

> ⚠️ **Regra de Ouro:** Não fazer chamadas HTTP internas entre módulos que vivem no mesmo backend. O acesso a dados e serviços entre módulos é feito por exportação de serviços/casos de uso ou por eventos de auditoria internos.

---

## 2. Visão Geral da Arquitectura

```
                        UTILIZADOR (Navegador Web / Mobile)
                                         |
                                         | HTTPS / REST / WebSockets
                                         v
                         PORTAL FRONTEND (React + TypeScript)
                                         |
                                         | REST / JSON (/api/v1)
                                         | Header: x-correlation-id, Authorization: Bearer <token>
                                         v
                            BACKEND API (Monólito Modular)
  +-----------------------------------------------------------------------------------+
  | Middlewares: correlationId -> logger -> auth (JWT) -> rbac -> validation (Zod)    |
  +-----------------------------------------------------------------------------------+
  | Módulos de Domínio:                                                               |
  |  [Auth]      [Users]      [Rooms]      [Incidents]     [Parking]     [Audit]      |
  |  [Meu-Módulo-Particular]                                                          |
  +-----------------------------------------------------------------------------------+
  | Persistência e Integrações:                                                       |
  |  - Prisma ORM -> PostgreSQL Database (Tabelas com Logical Ownership por Módulo)   |
  |  - Servidor WebSocket (Notificações / Telemetria)                                 |
  |  - Broker MQTT Mosquitto (Sensores IoT & Dispositivos)                            |
  +-----------------------------------------------------------------------------------+
```

---

## 3. Padrão de Contrato das APIs (`/api/v1`)

### 3.1 Cabeçalhos Obrigatórios e Transversais
- `Content-Type: application/json`
- `Authorization: Bearer <accessToken>` (para rotas protegidas)
- `x-correlation-id: <uuid>` (gerado automaticamente pelo middleware se omitido)

### 3.2 Formato das Respostas
Todas as rotas publicadas no router `/api/v1` seguem rigorosamente o formato de contrato normalizado:

#### Sucesso (`ApiSuccess<T>`) — HTTP Status 200, 201
```json
{
  "data": {
    "id": "inc_001",
    "title": "Projector avariado",
    "status": "OPEN",
    "createdAt": "2026-08-27T08:00:00.000Z"
  },
  "meta": {
    "correlationId": "e23fa7b1-912a-4389-a9a3-5c2bf91000a1",
    "timestamp": "2026-08-27T08:00:00.000Z"
  }
}
```

#### Erro (`ApiError`) — HTTP Status 400, 401, 403, 404, 409, 500
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados de entrada inválidos.",
    "details": [
      {
        "field": "roomId",
        "issue": "O identificador da sala é obrigatório."
      }
    ]
  },
  "meta": {
    "correlationId": "e23fa7b1-912a-4389-a9a3-5c2bf91000a1",
    "timestamp": "2026-08-27T08:00:00.000Z"
  }
}
```

---

## 4. Matriz de Autenticação e Funções (RBAC)

O Core disponibiliza 5 roles predefinidos na enumeração `Role`:

1. `STUDENT`: Estudante regular do campus.
2. `TEACHER`: Docente / Investigador.
3. `TECHNICIAN`: Técnico de manutenção e suporte.
4. `COORDINATOR`: Coordenador de curso ou gestor de departamento.
5. `ADMIN`: Administrador geral da plataforma Smart Campus.

---

## 5. Auditoria e Rastreabilidade (`AuditEvent`)

Todas as operações de escrita (criação, edição, eliminação ou alteração de estado) devem registar um evento de auditoria na base de dados:

```typescript
interface AuditEvent {
  id: string;
  correlationId: string;
  userId: string;
  action: string;      // ex: "ROOM_CREATE", "INCIDENT_UPDATE_STATUS"
  module: string;      // ex: "rooms", "incidents", "meu-modulo"
  resourceId: string;  // ID do recurso afectado
  payload: object;     // Metadados ou alterações efectuadas
  createdAt: Date;
}
```

---

## 6. Critérios de Avaliação do Módulo Particular

Para um módulo particular ser considerado pronto e integrado no Smart Campus:
1. Deve ser desenvolvido numa branch dedicada (`feat/<nome-do-modulo>`).
2. Não deve duplicar código de autenticação, roles ou utilizadores.
3. Deve disponibilizar schemas de validação Zod e DTOs em `packages/validation` e `packages/shared-types`.
4. Deve possuir rotas `/api/v1/<modulo>` tratadas com middleware de autorização.
5. Deve registar migrações Prisma válidas em `apps/api/prisma/migrations`.
6. Deve constar no catálogo visual do frontend (`campusModules`) com o estado de desenvolvimento honesto (`available`, `partial` ou `development`).
