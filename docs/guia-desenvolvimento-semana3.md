# Guia Prático de Desenvolvimento e Reprodução — Semana 3

**PTP III · Universidade Joaquim Alberto Chissano**

---

## 1. Objectivos da Semana 3

Nesta terceira semana de aulas, os objectivos práticos são:
1. Compreender a arquitectura do **Smart Campus Core** (Monólito Modular).
2. Executar e testar os serviços do Core (API, Base de Dados, Autenticação, Auditoria).
3. Definir e implementar o **Módulo Particular** atribuído ao grupo.
4. Garantir a correcta integração no Monorepo respeitando todas as convenções.

---

## 2. Passo a Passo Técnico

### Etapa A: Iniciar os Serviços Básicos

1. No terminal, vá para a pasta `SMART CAMPUS`:
   ```bash
   cd "SMART CAMPUS"
   ```

2. Copie o ficheiro `.env.example`:
   ```bash
   cp .env.example .env
   ```

3. Inicie o PostgreSQL através do Docker Compose:
   ```bash
   docker compose up -d db
   ```

4. Verifique se o container está saudável (`healthy`):
   ```bash
   docker compose ps
   ```

---

### Etapa B: Preparar o Monorepo e a Base de Dados

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Gere o cliente Prisma e aplique as migrações:
   ```bash
   npm run db:generate
   npm run db:migrate:dev -- --name init_smart_campus_core
   ```

3. Popule a base de dados com dados de teste (Seed):
   ```bash
   npm run db:seed
   ```

4. Compile os pacotes partilhados:
   ```bash
   npm run build:packages
   ```

---

### Etapa C: Executar a API Core

1. Inicie a API backend:
   ```bash
   npm run dev:api
   ```

2. Em outro terminal, teste a rota de Health Check:
   ```bash
   curl -s http://localhost:4100/health
   ```
   **Resultado esperado:**
   ```json
   {
     "status": "ok",
     "timestamp": "2026-08-27T08:20:00.000Z",
     "environment": "development"
   }
   ```

---

### Etapa D: Testar a Autenticação e Rotas Exemplo

1. **Fazer Login (Obter JWT Token):**
   ```bash
   curl -X POST http://localhost:4100/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "admin@ujac.ac.mz", "password": "password123"}'
   ```

2. **Consultar Salas (Usando o Token obtido):**
   ```bash
   curl -X GET http://localhost:4100/api/v1/rooms \
     -H "Authorization: Bearer <TOKEN_OBTIDO>"
   ```

---

### Etapa E: Desenvolver o Vosso Módulo Particular

Para adicionar um novo módulo (ex: `maintenance`, `academic`, `iot-sensors`):

1. **Adicionar o modelo no Prisma:**  
   Edite `apps/api/prisma/schema.prisma` e adicione a nova entidade.
   Execute `npm run db:migrate:dev -- --name add_meu_modulo`.

2. **Criar os Tipos Partilhados:**  
   Edite `packages/shared-types/src/index.ts` e exporte a interface DTO.

3. **Criar a Validação Zod:**  
   Edite `packages/validation/src/index.ts` e crie o schema Zod para criação e edição.

4. **Criar a estrutura do módulo na API:**  
   Crie a pasta `apps/api/src/modules/<nome-do-modulo>/` com os ficheiros:
   - `<modulo>.controller.ts`
   - `<modulo>.service.ts`
   - `<modulo>.routes.ts`

5. **Registar no Router Principal:**  
   Edite `apps/api/src/routes/v1.ts` e adicione a rota do vosso módulo.

6. **Integrar no Catálogo do Frontend:**  
   Edite `apps/web/src/modules/catalog.ts` para que o vosso módulo apareça na interface gráfica com o estado e descrição correctos.

---

## 3. Checklist de Validação Final

- [ ] A API arranca sem erros na porta 4100.
- [ ] Os pedidos devolvem `ApiSuccess` em sucesso e `ApiError` em falhas.
- [ ] Todas as operações de escrita registam `AuditEvent`.
- [ ] O header `x-correlation-id` é mantido e devolvido nas respostas.
- [ ] O módulo particular funciona com autenticação JWT e controlo de roles RBAC.
