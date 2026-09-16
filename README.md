# Smart Campus — UJAC (PTP III - Semana 5)

Plataforma integrada de gestão operacional, académica e de infraestruturas para a **Universidade Joaquim Alberto Chissano (UJAC)**, desenvolvida no âmbito da disciplina de **Prática Técnico-Profissional III (PTP III)** - Ano Lectivo 2026.

---

## Visão Geral

O **Smart Campus Core** é a fundação comum partilhada por toda a turma da PTP III. Em vez de produzir aplicações isoladas e incompatíveis, toda a turma constrói uma **única plataforma integrada** baseada numa arquitectura de **Monólito Modular** num monorepo.

O **Core** fornece:
- **Identidade e Segurança:** Autenticação (JWT, refresh tokens) e controlo de acesso baseado em funções (RBAC).
- **Contratos e Validação:** Padrão `/api/v1`, respostas normalizadas (`ApiSuccess`, `ApiError`), DTOs partilhados e schemas Zod.
- **Persistência:** Base de dados PostgreSQL unificada com Prisma ORM e migrações reproduzíveis.
- **Observabilidade & Auditoria:** Rastreabilidade por `x-correlation-id`, logs estruturados e registo automático de `AuditEvent`.
- **Catálogo de Módulos:** Frontend React com gestão transparente de estado dos módulos (`available`, `partial`, `development`).

---

## Estrutura do Repositório (`SMART CAMPUS`)

```
SMART CAMPUS/
├── apps/
│   ├── api/                      # Backend Node.js / Express (Core API)
│   │   ├── prisma/
│   │   │   └── schema.prisma     # Schema central de base de dados (PostgreSQL)
│   │   └── src/
│   │       ├── config/           # Configuração de variáveis de ambiente
│   │       ├── middlewares/      # auth, rbac, correlationId, errorHandler
│   │       └── modules/          # Módulos do sistema (Monólito Modular)
│   │           ├── auth/         # Autenticação e tokens JWT
│   │           ├── users/        # Perfis e gestão de utilizadores
│   │           ├── rooms/        # Gestão de salas e edifícios
│   │           ├── incidents/    # Ocorrências
│   │           ├── audit/        # Registo e consulta de auditoria
│   │           └── financial/    # Módulo particular: Gestão Financeira de Estudantes
│   │
│   └── web/                      # Frontend React + TypeScript (Portal Smart Campus)
│       └── src/
│           ├── components/       # Componentes visuais e layout
│           ├── modules/          # Views dos módulos no catálogo
│           └── services/         # Consumo da API via api-client
│
├── packages/
│   ├── shared-types/             # Tipos TypeScript partilhados (DTOs, erros, respostas)
│   ├── validation/               # Schemas de validação Zod partilhados
│   └── api-client/               # Cliente HTTP comum para o frontend
│
├── docs/                         # Documentação técnica e fichas da Semana 3 e 4
│   ├── arquitectura-smart-campus.md  # Arquitectura oficial e decisões do Core
│   ├── especificacao-modulo-gestao-financeira.md # Especificação oficial do Módulo Financeiro (Semana 4)
│   ├── documentacao-exercicios-semana5.md        # Guia de apresentação e conformidade da Semana 5
│   ├── template-modulo.md        # Template obrigatório para especificação do módulo
│   └── guia-desenvolvimento-semana3.md # Guia prático de arranque e reprodução
│
├── docker-compose.yml            # Infraestrutura local (PostgreSQL 15, MQTT Mosquitto)
├── .env.example                  # Modelo de variáveis de ambiente
└── package.json                  # Monorepo Root (npm workspaces)
```

---

## Pré-Requisitos e Arranque Rápido

### 1. Requisitos
- **Node.js**: `v20.x` ou `v22.x`
- **npm**: `v9.x` ou superior
- **Docker & Docker Compose**: Para a base de dados PostgreSQL

### 2. Passo a Passo de Arranque

```bash
# 1. Copiar as variáveis de ambiente
cp .env.example .env

# 2. Instalar dependências do monorepo
npm install

# 3. Iniciar a base de dados PostgreSQL via Docker
docker compose up -d db

# 4. Gerar o cliente Prisma e executar as migrações
npm run db:generate
npm run db:migrate:dev
npm run db:seed

# 5. Compilar os pacotes partilhados
npm run build -w @smart-campus/shared-types
npm run build -w @smart-campus/validation
npm run build -w @smart-campus/api-client

# 6. Iniciar o servidor API em modo de desenvolvimento (Porta 4100)
npm run dev:api
```

Em outro terminal, verificar o estado do sistema:
```bash
curl -s http://localhost:4100/health
# Resposta esperada: {"status":"ok","timestamp":"...","environment":"development"}
```

---

## Contratos da API REST (`/api/v1`)

### Resposta de Sucesso (`ApiSuccess<T>`)
```json
{
  "data": { ... },
  "meta": {
    "correlationId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "timestamp": "2026-08-27T08:00:00.000Z"
  }
}
```

### Resposta de Erro (`ApiError`)
```json
{
  "code": "UNAUTHORIZED",
  "message": "Token de acesso inválido ou expirado.",
  "details": [],
  "correlationId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

---

## Roles e Matriz de Permissões (RBAC)

| Role | Descrição | Permissões |
|---|---|---|
| `STUDENT` | Estudante | Consultar salas, criar ocorrências, ver catálogo |
| `TEACHER` | Docente | Consultar salas, criar ocorrências, ver relatórios |
| `TECHNICIAN` | Técnico de Manutenção | Actualizar estado de ocorrências, gerir dispositivos |
| `COORDINATOR` | Coordenador de Curso/Sector | Criar/Editar salas, atribuir tarefas, ver auditoria |
| `FINANCE` | Gestor financeiro | Criar dívidas, registar pagamentos, resolver contestações e consultar relatórios |
| `ADMIN` | Administrador do Sistema | Controlo total do sistema, utilizadores e auditoria |

---

## Módulo Financial (Semana 5)

O módulo particular do grupo é `financial`, disponível em `apps/api/src/modules/financial/` e registado em `/api/v1/financial`.

Principais capacidades implementadas:
- Dívidas: `GET/POST /api/v1/financial/debts` e `GET /api/v1/financial/debts/:id`
- Pagamentos: `POST /api/v1/financial/payments`
- Estado, histórico e notificações do estudante
- Contestações com submissão e resolução por RBAC
- Relatórios e política financeira
- Prisma, Zod, Swagger, SDK tipado e testes Jest/Supertest

---

## Autores / Grupo

- **Alípio Anderson Moisés Paco** (Código: 2024080003) — Coordenação, Análise e Desenvolvimento de Software
- **Josefa Mutemba** — Análise, Testes e Integração do Módulo Financeiro

**Docente:** Msc. Armando Correia  
**Disciplina:** PTP III — UJAC (2026)
