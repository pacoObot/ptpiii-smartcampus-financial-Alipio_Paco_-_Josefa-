# Template de Especificação de Módulo Particular — Smart Campus

> **Instruções:** Copie este ficheiro para a pasta do vosso módulo ou renomeie esta cópia ao definir o vosso módulo na Semana 3.

---

# Módulo: [Nome do Módulo]

## 1. Problema e Objectivo
- **Problema real a resolver:**
- **Utilizadores afectados:** (Estudantes / Docentes / Técnicos / Coordenadores / Admins)
- **Capacidade principal entregue:**
- **Fora do escopo (Adiado para versões futuras):**

---

## 2. Entidades e Regras de Negócio
- **Entidades principais:**
- **Estados e transições de estado:**
- **Invariantes (Regras que devem ser sempre verdadeiras):**
- **Relações com tabelas do Core (ex: User, Room):**

---

## 3. Matriz de Roles e Permissões
| Operação | Rota / Acção | Roles Permitidas | Validação por Objecto |
|---|---|---|---|
| Criar | `POST /api/v1/...` | `COORDINATOR`, `ADMIN` | Pertence ao departamento do utilizador |
| Consultar | `GET /api/v1/...` | Todos os utilizadores autenticados | Apenas dados públicos |
| Actualizar | `PATCH /api/v1/...` | `TECHNICIAN`, `ADMIN` | Responsável atribuído |

---

## 4. Contratos de API REST (`/api/v1`)
| Método | Rota | Payload (Entrada) | Resposta Sucesso (200/201) | Erros Possíveis |
|---|---|---|---|---|
| `GET` | `/api/v1/modulo` | Query params | `ApiSuccess<ModuloDto[]>` | 401, 403 |
| `POST` | `/api/v1/modulo` | JSON Body | `ApiSuccess<ModuloDto>` | 400, 401, 403, 409 |

---

## 5. Modelo de Dados e Persistência (Prisma)
- **Modelos a adicionar em `schema.prisma`:**
- **Migrations geradas:**
- **Dados iniciais para o Seed:**

---

## 6. Integração com Pacotes do Monorepo
- [ ] DTOs definidos em `packages/shared-types`
- [ ] Schemas de validação em `packages/validation`
- [ ] Métodos auxiliares em `packages/api-client`
- [ ] Registo de `AuditEvent` em operações de escrita
- [ ] Módulo integrado no catálogo de módulos do Frontend React (`campusModules`)
